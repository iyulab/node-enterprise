import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Locale } from '@iyulab/components/dist/utilities/Locale.js'
import { createODataService, ApiError } from '../src/data/ODataService'
import { createAuthClient } from '../src/auth/AuthClient'
import { isStatusCode } from '../src/data/error-envelope'

// OData JSON Format §21.2: `code` 는 언어 독립 식별자, `message` 는 사람이 읽는 문장이다. 범주 코드(`Forbidden`)에
// 구체 문장을 싣는 서버가 정석이라 기본은 서버 문장을 보인다(`serverMessages: 'always'`). 본문 없던 실패에 영어 상투
// 봉투를 싣는 서버를 그대로 쓰는 앱만 `'domain-codes'` 로 상태 이름 코드의 문장을 로캘 문구로 바꾼다.

let queue: Response[] = []
beforeEach(() => {
  queue = []
  vi.stubGlobal('fetch', () => {
    const next = queue.shift()
    if (!next) throw new Error('no queued response')
    return Promise.resolve(next)
  })
})
afterEach(() => Locale.set('en'))
const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const BASE = 'https://app.test'

describe('isStatusCode', () => {
  it('상태 이름 — 대소문자 · 구분자 무시', () => {
    expect(isStatusCode('Forbidden', 403)).toBe(true)
    expect(isStatusCode('NotFound', 404)).toBe(true)
    expect(isStatusCode('MethodNotAllowed', 405)).toBe(true)
    expect(isStatusCode('Internal_Server_Error', 500)).toBe(true)
    expect(isStatusCode('internal-server-error', 500)).toBe(true)
  })

  it('⚪NEGATIVE — 도메인 코드 · 다른 상태의 이름 · 코드 없음은 아니다', () => {
    expect(isStatusCode('KeyNotFound', 404)).toBe(false)
    expect(isStatusCode('NotFound', 403)).toBe(false)
    expect(isStatusCode('PasswordExpired', 403)).toBe(false)
    expect(isStatusCode(undefined, 403)).toBe(false)
    expect(isStatusCode('Teapot', 418)).toBe(false)
  })
})

describe('data service — 기본은 서버 문장', () => {
  it('403 Forbidden 의 사람 문장을 그대로 보인다(코드 · 본문도 실린다)', async () => {
    // 소비자가 `messages` 를 줬지만 `http` 는 주지 않은 설정 — 0.31 은 여기서 영어 «Forbidden» 을 냈다.
    const svc = createODataService({ baseUrl: BASE, messages: { saved: '저장됨' } })
    const body = { error: { code: 'Forbidden', message: "'maintenance.read' 권한이 필요합니다." } }
    queue.push(json(body, 403))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe("'maintenance.read' 권한이 필요합니다.")
    expect(err.code).toBe('Forbidden')
    expect(err.body).toEqual(body)
  })

  it('503 ServiceUnavailable 의 안내 문장을 보인다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ error: { code: 'ServiceUnavailable', message: '데이터베이스에 연결할 수 없습니다 — 잠시 후 다시 시도하세요.' } }, 503))
    const err = (await svc.apiGet('things').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('데이터베이스에 연결할 수 없습니다 — 잠시 후 다시 시도하세요.')
  })

  it('⚪NEGATIVE — 200자를 넘는 문장(내부 스택)은 기본에서도 보이지 않는다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ error: { code: 'InternalServerError', message: 'x'.repeat(201) } }, 500))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('Server error')
  })
})

describe("data service — serverMessages: 'domain-codes'", () => {
  it('403 Forbidden 봉투 → 로캘 문구', async () => {
    const svc = createODataService({ baseUrl: BASE, serverMessages: 'domain-codes', messages: { http: { 403: '권한이 없습니다' } } })
    queue.push(json({ error: { code: 'Forbidden', message: 'The policy denied access to this set.' } }, 403))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('권한이 없습니다')
    expect(err.code).toBe('Forbidden')
  })

  it('500 InternalServerError 봉투 → 레지스트리 문구', async () => {
    const svc = createODataService({ baseUrl: BASE, serverMessages: 'domain-codes' })
    queue.push(json({ error: { code: 'InternalServerError', message: 'An unexpected error occurred.', innererror: { traceId: 't' } } }, 500))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('Server error')
  })

  it('⚪NEGATIVE — 도메인 코드의 문장은 그대로 보인다(행 없음 KeyNotFound)', async () => {
    const svc = createODataService({ baseUrl: BASE, serverMessages: 'domain-codes' })
    queue.push(json({ error: { code: 'KeyNotFound', message: 'Order G-7 does not exist.' } }, 404))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('Order G-7 does not exist.')
  })

  it('formatError 는 서버 문장을 그대로 받는다 — 앱이 고를 수 있다', async () => {
    let raw: string | undefined
    const svc = createODataService({ baseUrl: BASE, serverMessages: 'domain-codes', formatError: (info) => { raw = info.rawMessage; return undefined } })
    queue.push(json({ error: { code: 'NotFound', message: 'No such set.' } }, 404))
    await svc.odataGet('Nope').catch(() => {})
    expect(raw).toBe('No such set.')
  })
})

describe('기본 문구는 로캘 레지스트리를 따른다', () => {
  it('서비스를 만든 뒤 Locale.set(ko) 해도 한국어 문구', async () => {
    const svc = createODataService({ baseUrl: BASE, serverMessages: 'domain-codes' })
    Locale.set('ko')
    queue.push(json({ error: { code: 'Forbidden', message: 'Forbidden' } }, 403))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('권한이 없습니다.')
    queue.push(new Response('', { status: 418 }))
    const teapot = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(teapot.message).toBe('요청이 실패했습니다. (418)')
  })

  it('⚪NEGATIVE — 설정 messages 가 레지스트리보다 앞선다', async () => {
    Locale.set('ko')
    const svc = createODataService({ baseUrl: BASE, messages: { http: { 404: 'Missing' } } })
    queue.push(new Response('', { status: 404 }))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('Missing')
  })

  it('인증 클라이언트 — 네트워크 실패 문구가 Locale 을 따른다', async () => {
    const auth = createAuthClient({ meUrl: '/me', loginUrl: '/login', logoutUrl: '/logout' })
    Locale.set('ko')
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))
    const session = await auth.fetchMe()
    expect(session.status).toBe('unknown')
    if (session.status === 'unknown') expect(session.error.message).toBe('네트워크 오류가 발생했습니다.')
  })
})

describe('auth client — 서버 문장 규칙', () => {
  it('fetchMe 의 503 사람 문장이 error.message 로 온다(기본)', async () => {
    const auth = createAuthClient({ meUrl: '/me', loginUrl: '/login', logoutUrl: '/logout' })
    queue.push(json({ error: { code: 'ServiceUnavailable', message: '데이터베이스에 연결할 수 없습니다.' } }, 503))
    const session = await auth.fetchMe()
    expect(session.status).toBe('unknown')
    if (session.status === 'unknown') expect(session.error.message).toBe('데이터베이스에 연결할 수 없습니다.')
  })

  it("'domain-codes' — 405 MethodNotAllowed 봉투 → 로캘 «로그아웃 실패» 문구", async () => {
    const auth = createAuthClient({ meUrl: '/me', loginUrl: '/login', logoutUrl: '/logout', serverMessages: 'domain-codes', messages: { logoutFailed: '로그아웃하지 못했습니다' } })
    queue.push(json({ error: { code: 'MethodNotAllowed', message: 'POST is not allowed here.' } }, 405))
    const result = await auth.logout()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('로그아웃하지 못했습니다')
      expect(result.error.code).toBe('MethodNotAllowed')
    }
  })
})
