import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createODataService, ApiError } from '../src/data/ODataService'

/**
 * OData v4 적합성 — README 의 «OData v4 conformance» 표에서 «implemented» 로 적은 행마다
 * 여기 시험이 하나씩 있다. 픽스처는 손으로 쓴 목이 아니라 **명세의 예시 응답 모양**이다
 * (OData JSON Format 4.01 · Protocol 4.01 · URL Conventions 4.01). 서버가 조항을 쓰기 시작한
 * 날 처음 드러나는 결함(서버 주도 페이징의 `nextLink` 를 버린 적이 있다)을 서버보다 먼저 잰다.
 */

interface Recorded { url: string; method: string }
let recorded: Recorded[] = []
let queue: Response[] = []

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  recorded = []
  queue = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    recorded.push({ url: String(input), method: (init?.method ?? 'GET').toUpperCase() })
    const res = queue.shift()
    if (!res) throw new Error(`no queued response for ${String(input)}`)
    return Promise.resolve(res)
  })
})

const BASE = 'https://host.test'
const svc = () => createODataService({ baseUrl: BASE, odataPrefix: 'service', notify: { success() {}, error() {} } })

describe('server-driven paging (JSON Format §4.5.5 · Protocol §11.2.6.7)', () => {
  it('follows a relative @odata.nextLink until the collection ends', async () => {
    queue.push(json({
      '@odata.context': '$metadata#Customers',
      value: [{ ID: 'ALFKI' }, { ID: 'ANATR' }],
      '@odata.nextLink': 'Customers?$skiptoken=2',
    }))
    queue.push(json({ '@odata.context': '$metadata#Customers', value: [{ ID: 'ANTON' }] }))
    const rows = await svc().odataGet<{ ID: string }>('Customers')
    expect(rows.map(r => r.ID)).toEqual(['ALFKI', 'ANATR', 'ANTON'])
    // 상대 URL 은 요청한 URL 기준으로 풀린다(RFC 3986 §5).
    // ⚠의미로 잰다 — 요청 경로가 쿼리를 폼 인코딩으로 다시 직렬화해 달러 기호가 %24 로 나간다
    //   (README 적합성 표의 «opaque nextLink» 행 · 주요 서버는 같은 요청으로 디코드한다).
    const next = new URL(recorded[1].url)
    expect(next.origin + next.pathname).toBe(BASE + '/service/Customers')
    expect(next.searchParams.get('$skiptoken')).toBe('2')
  })

  it('a single page carries nextLink and count for callers that page themselves', async () => {
    queue.push(json({ value: [{ ID: 1 }], '@odata.count': 42, '@odata.nextLink': BASE + '/service/Orders?$skiptoken=1' }))
    const page = await svc().odataGetPage<{ ID: number }>('Orders', { $count: 'true' })
    expect(page.count).toBe(42)
    expect(page.nextLink).toBe(BASE + '/service/Orders?$skiptoken=1')
  })

  it('NEGATIVE — refuses a nextLink outside the service origin', async () => {
    queue.push(json({ value: [], '@odata.nextLink': 'https://elsewhere.test/Customers?$skiptoken=2' }))
    await expect(svc().odataGet('Customers')).rejects.toThrow(/outside the service origin/)
  })
})

describe('$count (Protocol §11.2.6.5)', () => {
  it('odataCount asks for the count without rows and reads @odata.count', async () => {
    queue.push(json({ value: [], '@odata.count': 7 }))
    expect(await svc().odataCount('Orders', { Status: 'open' })).toBe(7)
    const u = new URL(recorded[0].url)
    expect(u.searchParams.get('$count')).toBe('true')
    expect(u.searchParams.get('$top')).toBe('0')
  })
})

describe('error response (JSON Format §21)', () => {
  // 명세의 예시 봉투 그대로 — code·message·target·details·innererror.
  const specExample = {
    error: {
      code: 'err123',
      message: 'Unsupported functionality',
      target: 'query',
      details: [{ code: 'forty-two', target: '$search', message: '$search query option not supported' }],
      innererror: { trace: [], context: {} },
    },
  }

  it('surfaces message and each detail (code · message · target) on ApiError', async () => {
    queue.push(json(specExample, 501))
    const err = await svc().odataGet('Customers').catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(501)
    expect(err.message).toBe('Unsupported functionality')
    expect(err.details).toEqual([{ code: 'forty-two', target: '$search', message: '$search query option not supported' }])
  })

  it('NEGATIVE — innererror is not surfaced (it is the server\'s debugging aid, not a contract)', async () => {
    queue.push(json(specExample, 501))
    const err = await svc().odataGet('Customers').catch(e => e)
    expect(JSON.stringify(err)).not.toContain('trace')
  })
})

describe('data modification (Protocol §11.4)', () => {
  it('create: 201 Created with the entity in the body', async () => {
    queue.push(json({ ID: 5, Name: 'x' }, 201))
    expect(await svc().odataPostQuiet('Products', { Name: 'x' })).toEqual({ ID: 5, Name: 'x' })
  })

  it('update and delete: 204 No Content resolves without parsing a body', async () => {
    queue.push(new Response(null, { status: 204 }))
    queue.push(new Response(null, { status: 204 }))
    await expect(svc().odataPatchQuiet('Products', '5', { Name: 'y' })).resolves.toBeUndefined()
    await expect(svc().odataDeleteQuiet('Products', '5')).resolves.toBeUndefined()
    expect(recorded.map(r => r.method)).toEqual(['PATCH', 'DELETE'])
  })
})

describe('key predicate (URL Conventions §4.3.1) — the caller passes the literal', () => {
  // 클라이언트는 EDM 을 모르므로 GUID 키(따옴표 없음)와 문자열 키(따옴표)를 가를 수 없다 —
  // 그래서 `id` 는 URL 에 쓰이는 리터럴 그대로다. README 표의 «caller» 행이 이 계약이다.
  it('a GUID or number key goes in as given', async () => {
    queue.push(json({ ID: 1 }))
    await svc().odataGetById('Orders', '0b9f3c1e-7a2d-4c55-9e1b-5f2d8a6c4b10')
    expect(recorded[0].url).toBe(BASE + '/service/Orders(0b9f3c1e-7a2d-4c55-9e1b-5f2d8a6c4b10)')
  })

  it('a string key is passed quoted by the caller, with single quotes doubled', async () => {
    queue.push(json({ ID: "O'Neil" }))
    await svc().odataGetById('Customers', "'O''Neil'")
    expect(recorded[0].url).toBe(BASE + "/service/Customers('O''Neil')")
  })
})
