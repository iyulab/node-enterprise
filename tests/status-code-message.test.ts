import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createODataService, ApiError } from '../src/data/ODataService'
import { createAuthClient } from '../src/auth/AuthClient'
import { isStatusCode } from '../src/data/error-envelope'

// 서버가 본문 없던 실패(401 · 403 · 404 · 405)와 처리 못 한 예외(500)에도 OData 오류 봉투를 싣기 시작했다 —
// `{ error: { code: 'Forbidden', message: '…' } }`. 그 코드는 상태 이름을 되풀이할 뿐이라 문장은 전송 계층의 상투어다.
// 종전처럼 로캘 문구를 보이고, 도메인 코드의 문장은 그대로 보인다. 코드·본문은 어느 쪽이든 실린다.

let queue: Response[] = []
beforeEach(() => {
  queue = []
  vi.stubGlobal('fetch', () => {
    const next = queue.shift()
    if (!next) throw new Error('no queued response')
    return Promise.resolve(next)
  })
})
const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const BASE = 'https://app.test'

describe('isStatusCode', () => {
  it('상태 이름을 되풀이하는 코드 — 대소문자·밑줄·하이픈·공백은 보지 않는다', () => {
    expect(isStatusCode('Forbidden', 403)).toBe(true)
    expect(isStatusCode('NotFound', 404)).toBe(true)
    expect(isStatusCode('MethodNotAllowed', 405)).toBe(true)
    expect(isStatusCode('INTERNAL_SERVER_ERROR', 500)).toBe(true)
    expect(isStatusCode('conflict', 409)).toBe(true)
  })

  it('⚪NEGATIVE — 도메인 코드 · 다른 상태의 이름 · 코드 없음은 아니다', () => {
    expect(isStatusCode('KeyNotFound', 404)).toBe(false)
    expect(isStatusCode('NotFound', 403)).toBe(false)
    expect(isStatusCode('PasswordExpired', 403)).toBe(false)
    expect(isStatusCode(undefined, 403)).toBe(false)
    expect(isStatusCode('Teapot', 418)).toBe(false)
  })
})

describe('data service — 상태 이름뿐인 코드의 문장은 보이지 않는다', () => {
  it('403 Forbidden 봉투 → 로캘 문구, 코드·본문은 실린다', async () => {
    const svc = createODataService({ baseUrl: BASE, messages: { http: { 403: '권한이 없습니다' } } })
    const body = { error: { code: 'Forbidden', message: 'The policy denied access to this set.' } }
    queue.push(json(body, 403))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('권한이 없습니다')
    expect(err.code).toBe('Forbidden')
    expect(err.body).toEqual(body)
  })

  it('500 InternalServerError 봉투 → 로캘 문구', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ error: { code: 'InternalServerError', message: 'An unexpected error occurred.', innererror: { traceId: 't' } } }, 500))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('Server error')
  })

  it('⚪NEGATIVE — 도메인 코드의 문장은 그대로 보인다(행 없음 KeyNotFound)', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ error: { code: 'KeyNotFound', message: 'Order G-7 does not exist.' } }, 404))
    const err = (await svc.odataGet('Orders').catch((e: unknown) => e)) as ApiError
    expect(err.message).toBe('Order G-7 does not exist.')
  })

  it('formatError 는 서버 문장을 그대로 받는다 — 앱이 고를 수 있다', async () => {
    let raw: string | undefined
    const svc = createODataService({ baseUrl: BASE, formatError: (info) => { raw = info.rawMessage; return undefined } })
    queue.push(json({ error: { code: 'NotFound', message: 'No such set.' } }, 404))
    await svc.odataGet('Nope').catch(() => {})
    expect(raw).toBe('No such set.')
  })
})

describe('auth client — 로그아웃 실패의 상태 이름 코드', () => {
  it('405 MethodNotAllowed 봉투 → 로캘 «로그아웃 실패» 문구', async () => {
    const auth = createAuthClient({ meUrl: '/me', loginUrl: '/login', logoutUrl: '/logout', messages: { logoutFailed: '로그아웃하지 못했습니다' } })
    queue.push(json({ error: { code: 'MethodNotAllowed', message: 'POST is not allowed here.' } }, 405))
    const result = await auth.logout()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('로그아웃하지 못했습니다')
      expect(result.error.code).toBe('MethodNotAllowed')
    }
  })
})
