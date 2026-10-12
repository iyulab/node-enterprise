import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createODataService } from '../src/data/ODataService'
import { createAuthClient } from '../src/auth/AuthClient'
import { createPermissionStore } from '../src/auth/permissions'

/**
 * 서버가 오래 답하지 않을 때(DB 대기 · 재시도) 부트 게이트(`fetchMe`)와 연결 확인(`fetchRaw`)에 시간 예산을 걸고
 * 지난 요청을 끊는 길. 인증 클라이언트는 끊겨도 던지지 않고(«모름»), 서비스는 다른 메서드처럼 `signal.reason` 을 던진다.
 */

let seenSignals: (AbortSignal | null | undefined)[] = []
/** 신호가 끊을 때까지 답하지 않는 서버. */
function hangingFetch() {
  seenSignals = []
  vi.stubGlobal('fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal
    seenSignals.push(signal)
    return new Promise<Response>((_resolve, reject) => {
      if (signal?.aborted) return reject(signal.reason)
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
  })
}

beforeEach(() => hangingFetch())

const auth = (extra: Record<string, unknown> = {}) =>
  createAuthClient<{ id: string; perms: string[] }>({ meUrl: '/me', loginUrl: '/login', logoutUrl: '/logout', ...extra })

describe('AuthClient — signal', () => {
  it('fetchMe: 끊기면 던지지 않고 unknown · status 0 · cause = signal.reason', async () => {
    const ac = new AbortController()
    const p = auth().fetchMe({ signal: ac.signal })
    ac.abort()
    const session = await p
    expect(session.status).toBe('unknown')
    if (session.status === 'unknown') {
      expect(session.error.status).toBe(0)
      expect(session.error.cause).toBe(ac.signal.reason)
      expect(session.error.message).toBe('The request was canceled.')
    }
  })

  it('fetchMe: 이미 끊긴 신호도 같은 결과', async () => {
    const ac = new AbortController()
    ac.abort(new DOMException('budget', 'TimeoutError'))
    const session = await auth().fetchMe({ signal: ac.signal })
    expect(session.status).toBe('unknown')
    if (session.status === 'unknown') expect(session.error.cause).toBe(ac.signal.reason)
  })

  it('끊긴 fetchMe 는 권한 store 를 건드리지 않는다', async () => {
    const store = createPermissionStore()
    store.set(['orders.read'])
    const ac = new AbortController()
    const p = auth({ permissionStore: store, getPermissions: (u: { perms: string[] }) => u.perms }).fetchMe({ signal: ac.signal })
    ac.abort()
    await p
    expect(store.has('orders.read')).toBe(true)
  })

  it('login · logout: 끊기면 ok:false 와 canceled 문구', async () => {
    const ac = new AbortController()
    const client = auth()
    const pl = client.login({ user: 'a' } as never, { signal: ac.signal })
    const po = client.logout({ signal: ac.signal })
    ac.abort()
    const [l, o] = await Promise.all([pl, po])
    expect(l.ok).toBe(false)
    expect(o.ok).toBe(false)
    if (!l.ok) expect(l.error.cause).toBe(ac.signal.reason)
    if (!o.ok) expect(o.message).toBe('The request was canceled.')
  })

  it('신호가 fetch 에 닿는다(login → loginUser me 의 재조회까지)', async () => {
    const ac = new AbortController()
    let calls = 0
    vi.stubGlobal('fetch', (_input: RequestInfo | URL, init?: RequestInit) => {
      seenSignals.push(init?.signal)
      calls++
      return Promise.resolve(calls === 1
        ? new Response('{"Success":true}', { status: 200 })
        : new Response('{"id":"u1","perms":[]}', { status: 200 }))
    })
    seenSignals = []
    const result = await auth({ loginUser: 'me' }).login({ user: 'a' } as never, { signal: ac.signal })
    expect(result.ok).toBe(true)
    expect(seenSignals).toEqual([ac.signal, ac.signal])
  })

  it('⚪NEGATIVE — 신호 없이 실패한 요청은 종전처럼 networkError', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    const session = await auth().fetchMe()
    expect(session.status).toBe('unknown')
    if (session.status === 'unknown') expect(session.error.message).toBe('A network error occurred.')
  })

  it('⚪NEGATIVE — 끊기지 않은 신호를 준 실패도 networkError(cause = 원래 실패)', async () => {
    const failure = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', () => Promise.reject(failure))
    const session = await auth().fetchMe({ signal: new AbortController().signal })
    if (session.status === 'unknown') {
      expect(session.error.message).toBe('A network error occurred.')
      expect(session.error.cause).toBe(failure)
    }
  })
})

describe('ODataService.fetchRaw — signal', () => {
  it('끊기면 signal.reason 을 그대로 던진다', async () => {
    const svc = createODataService({ baseUrl: 'https://app.test' })
    const ac = new AbortController()
    const p = svc.fetchRaw('https://app.test/api/me', { signal: ac.signal })
    ac.abort()
    await expect(p).rejects.toBe(ac.signal.reason)
    expect(seenSignals.at(-1)).toBeTruthy()
  })

  it('⚪NEGATIVE — 옵션 없이 부른 fetchRaw 는 종전처럼 응답을 그대로 준다', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 401 })))
    const svc = createODataService({ baseUrl: 'https://app.test' })
    const res = await svc.fetchRaw('https://app.test/api/me')
    expect(res.status).toBe(401)
  })
})
