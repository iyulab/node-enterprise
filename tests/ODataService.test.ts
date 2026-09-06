import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createODataService, ApiError } from '../src/data/ODataService'

// ---- fetch 목: 요청을 기록하고 큐에 넣은 응답을 순서대로 돌려준다 ----
interface Recorded {
  url: string
  method: string
  body?: string
  rawBody?: BodyInit
  contentType?: string | null
}
let recorded: Recorded[] = []
let queue: Response[] = []

function enqueue(res: Response) {
  queue.push(res)
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  recorded = []
  queue = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    recorded.push({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: typeof init?.body === 'string' ? init.body : undefined,
      rawBody: init?.body as BodyInit | undefined,
      contentType: init?.headers ? new Headers(init.headers).get('Content-Type') : null,
    })
    const res = queue.shift()
    if (!res) throw new Error(`no queued response for ${String(input)}`)
    return Promise.resolve(res)
  })
})

const BASE = 'https://app.test'

describe('createODataService — URL building', () => {
  it('builds odata/api URLs from configured prefixes', () => {
    const svc = createODataService({ baseUrl: BASE })
    expect(svc.odataUrl('Orders')).toBe(`${BASE}/$data/Orders`)
    expect(svc.apiUrl('auth/me')).toBe(`${BASE}/api/auth/me`)
    expect(svc.apiUrl('/auth/me')).toBe(`${BASE}/api/auth/me`)
  })

  it('honors custom prefixes', () => {
    const svc = createODataService({ baseUrl: BASE, odataPrefix: 'odata', apiPrefix: 'v1' })
    expect(svc.odataUrl('Orders')).toBe(`${BASE}/odata/Orders`)
    expect(svc.apiUrl('ping')).toBe(`${BASE}/v1/ping`)
  })
})

describe('createODataService — reads', () => {
  it('odataGet unwraps the OData value array', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }, { id: 2 }] }))
    const rows = await svc.odataGet<{ id: number }>('Orders', { $top: '20' })
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders?%24top=20`)
  })

  it('odataGetById builds the (id) key URL', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ id: 7 }))
    const row = await svc.odataGetById<{ id: number }>('Orders', '7')
    expect(row).toEqual({ id: 7 })
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)
  })

  it('odataCount reads @odata.count', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ '@odata.count': 42, value: [] }))
    const n = await svc.odataCount('Orders')
    expect(n).toBe(42)
  })
})

describe('createODataService — mutations + toasts', () => {
  it('odataPost normalizes empty strings to null and fires success toast', async () => {
    const success = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      notify: { success },
      messages: { saved: '저장되었습니다' },
    })
    enqueue(json({ id: 1, name: 'a' }, 201))
    await svc.odataPost('Orders', { name: 'a', note: '' })
    expect(success).toHaveBeenCalledWith('저장되었습니다')
    expect(JSON.parse(recorded[0].body!)).toEqual({ name: 'a', note: null })
  })

  it('odataPostQuiet does not toast on success', async () => {
    const success = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { success } })
    enqueue(json({ id: 1 }, 201))
    await svc.odataPostQuiet('Orders', { name: 'a' })
    expect(success).not.toHaveBeenCalled()
  })

  it('odataPatch fires updated toast; odataDelete fires deleted toast', async () => {
    const success = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      notify: { success },
      messages: { updated: '수정되었습니다', deleted: '삭제되었습니다' },
    })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataPatch('Orders', '7', { name: 'b' })
    expect(success).toHaveBeenCalledWith('수정되었습니다')
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)

    enqueue(new Response(null, { status: 204 }))
    await svc.odataDelete('Orders', '7')
    expect(success).toHaveBeenCalledWith('삭제되었습니다')
  })

  // §D-33 / ISSUE-enterprise-20260812-odataservice-missing-quiet-patch-delete:
  // odataPostQuiet은 이미 있는데 PATCH/DELETE에는 quiet 짝이 없어, 자식 컬렉션을
  // 편집하고 부모의 파생 필드를 동기화하는 한 사용자 액션이 토스트 두 번을 내는
  // 문제를 피할 방법이 raw fetch() 우회뿐이었다.
  it('odataPatchQuiet does not toast on success', async () => {
    const success = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { success } })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataPatchQuiet('Orders', '7', { name: 'b' })
    expect(success).not.toHaveBeenCalled()
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)
  })

  it('odataDeleteQuiet does not toast on success', async () => {
    const success = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { success } })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataDeleteQuiet('Orders', '7')
    expect(success).not.toHaveBeenCalled()
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)
  })

  it('odataPatchQuiet normalizes empty strings to null, same as odataPatch', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataPatchQuiet('Orders', '7', { name: 'b', note: '' })
    expect(JSON.parse(recorded[0].body!)).toEqual({ name: 'b', note: null })
  })
})

describe('createODataService — errors', () => {
  it('non-401 error fires error toast and throws ApiError with status', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPost('Orders', { name: 'a' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: '중복된 이름',
    })
    expect(error).toHaveBeenCalledWith('중복된 이름')
  })

  it('OData v4 오류 봉투의 error.details(필드별 검증 상세)를 ApiError.details로 그대로 실어 던진다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(
      json(
        {
          error: {
            code: '',
            message: 'Name: The 역할 코드 field is required.',
            details: [{ code: '', message: 'The 역할 코드 field is required.', target: 'Name' }],
          },
        },
        400,
      ),
    )
    await expect(svc.odataPost('Orders', { name: '' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      details: [{ code: '', message: 'The 역할 코드 field is required.', target: 'Name' }],
    })
  })

  it('규격상 선택 항목인 target이 없어도 detail을 그대로 싣는다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(
      json(
        { error: { code: 'ValidationError', message: 'bad', details: [{ code: 'ValidationError', message: 'required' }] } },
        400,
      ),
    )
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({
      details: [{ code: 'ValidationError', message: 'required' }],
    })
  })

  it('규격이 요구하는 code/message가 없는 항목은 걸러내고, 남는 항목이 없으면 undefined다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(
      json(
        {
          error: {
            message: 'bad',
            details: [{ code: 'A', message: 'keep' }, { target: 'Name' }, null, 'nope', { code: 1, message: 2 }],
          },
        },
        400,
      ),
    )
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({
      details: [{ code: 'A', message: 'keep' }],
    })

    enqueue(json({ error: { message: 'bad', details: [{ target: 'Name' }] } }, 400))
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({ details: undefined })
  })

  it('details가 배열이 아니면 undefined다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ error: { message: 'bad', details: { code: 'A', message: 'not an array' } } }, 400))
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({ details: undefined })
  })

  it('error.details가 없는 응답은 ApiError.details가 undefined다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPost('Orders', { name: 'a' })).rejects.toMatchObject({
      name: 'ApiError',
      details: undefined,
    })
  })

  it('401 calls onUnauthorized, throws sessionExpired, and does NOT fire an error toast', async () => {
    const onUnauthorized = vi.fn()
    const error = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      onUnauthorized,
      notify: { error },
      messages: { sessionExpired: '세션이 만료되었습니다' },
    })
    enqueue(new Response(null, { status: 401 }))
    await expect(svc.odataPost('Orders', { name: 'a' })).rejects.toMatchObject({
      status: 401,
      message: '세션이 만료되었습니다',
    })
    expect(onUnauthorized).toHaveBeenCalledWith(401)
    expect(error).not.toHaveBeenCalled()
  })

  // odataPatch/odataDelete는 이전에 throwIfError를 쓰지 않고 401/에러 처리를 각자
  // 인라인으로 중복 구현하고 있었다 — quiet 짝을 추가하며 throwIfError 재사용으로
  // 리팩터(§D-33) 했으므로, 그 리팩터가 기존 동작(에러 토스트·401 처리)을 그대로
  // 보존하는지 PATCH/DELETE 각각으로 직접 확인한다(이전엔 POST로만 커버돼 있었다).
  it('odataPatch non-401 error fires error toast and throws ApiError with status', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPatch('Orders', '7', { name: 'a' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: '중복된 이름',
    })
    expect(error).toHaveBeenCalledWith('중복된 이름')
  })

  it('odataDelete 401 calls onUnauthorized, throws sessionExpired, and does NOT fire an error toast', async () => {
    const onUnauthorized = vi.fn()
    const error = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      onUnauthorized,
      notify: { error },
      messages: { sessionExpired: '세션이 만료되었습니다' },
    })
    enqueue(new Response(null, { status: 401 }))
    await expect(svc.odataDelete('Orders', '7')).rejects.toMatchObject({
      status: 401,
      message: '세션이 만료되었습니다',
    })
    expect(onUnauthorized).toHaveBeenCalledWith(401)
    expect(error).not.toHaveBeenCalled()
  })

  it('odataPatchQuiet/odataDeleteQuiet propagate errors without notifying', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })

    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPatchQuiet('Orders', '7', { name: 'a' })).rejects.toMatchObject({
      status: 409,
    })
    expect(error).not.toHaveBeenCalled()

    enqueue(json({ error: { message: '삭제 불가' } }, 409))
    await expect(svc.odataDeleteQuiet('Orders', '7')).rejects.toMatchObject({
      status: 409,
    })
    expect(error).not.toHaveBeenCalled()
  })

  it('formatError override wins over raw message', async () => {
    const svc = createODataService({
      baseUrl: BASE,
      formatError: ({ status }) => (status === 400 ? '입력값을 확인하세요' : undefined),
    })
    enqueue(json({ error: { message: 'Validation failed for field X' } }, 400))
    await expect(svc.odataGetById('Orders', '1')).rejects.toMatchObject({
      status: 400,
      message: '입력값을 확인하세요',
    })
  })

  it('falls back to http[status] message when raw is too long', async () => {
    const svc = createODataService({
      baseUrl: BASE,
      messages: { http: { 500: '서버 오류가 발생했습니다' } },
    })
    enqueue(json({ error: { message: 'x'.repeat(300) } }, 500))
    await expect(svc.odataGetById('Orders', '1')).rejects.toMatchObject({
      status: 500,
      message: '서버 오류가 발생했습니다',
    })
  })
})

describe('createODataService — custom REST', () => {
  it('apiDelete tolerates 204 empty body (no JSON parse error)', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(new Response(null, { status: 204 }))
    await expect(svc.apiDelete('orders/7')).resolves.toBeUndefined()
    expect(recorded[0].method).toBe('DELETE')
    expect(recorded[0].url).toBe(`${BASE}/api/orders/7`)
  })

  it('apiGet passes through a query string on the path', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ ok: true }))
    await svc.apiGet('reports?year=2026')
    expect(recorded[0].url).toBe(`${BASE}/api/reports?year=2026`)
  })

  it('ApiError is re-exposed on the service instance and matches the module class', () => {
    const svc = createODataService({ baseUrl: BASE })
    expect(svc.ApiError).toBe(ApiError)
  })

  it('apiPut sends a PUT with a JSON-serialized body', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ id: 1 }))
    await svc.apiPut('orders/1', { status: 'shipped' })
    expect(recorded[0].method).toBe('PUT')
    expect(recorded[0].url).toBe(`${BASE}/api/orders/1`)
    expect(recorded[0].body).toBe(JSON.stringify({ status: 'shipped' }))
    expect(recorded[0].contentType).toContain('application/json')
  })

  // docket #108 — 요청 본문은 apiPut 부재와 함께 "FormData가 JSON으로 강제 직렬화될 것"이라는
  // 우려도 제기했다. 실측: @iyulab/http-client의 guessMimeType이 FormData에는 Content-Type을
  // 세팅하지 않고(브라우저가 멀티파트 boundary와 함께 자동 설정) JSON.stringify 분기도
  // Content-Type이 application/json일 때만 타므로, apiPost/apiPatch/apiPut 전부 FormData를
  // 이미 있는 그대로(직렬화 없이) 전달한다 — 별도 코드 추가가 필요 없었다.
  it.each(['apiPost', 'apiPut', 'apiPatch'] as const)(
    '%s passes a FormData body through untouched (no JSON.stringify, no forced Content-Type)',
    async (method) => {
      const svc = createODataService({ baseUrl: BASE })
      enqueue(json({ ok: true }))
      const form = new FormData()
      form.append('file', new Blob(['x']), 'x.txt')
      await svc[method]('uploads/1', form)
      expect(recorded[0].rawBody).toBe(form)
      expect(recorded[0].contentType).toBeNull()
    },
  )
})
