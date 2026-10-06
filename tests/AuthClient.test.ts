import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAuthClient } from '../src/auth/AuthClient'
import { createPermissionStore } from '../src/auth/permissions'
import { ApiError } from '../src/data/ODataService'

interface User {
  Id: string
  Permissions: string[]
}
type Cred = { Username: string; Password: string }

interface Recorded {
  url: string
  method: string
  body?: string
}
let recorded: Recorded[] = []
let queue: (Response | Error)[] = []

function enqueue(r: Response | Error) {
  queue.push(r)
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  recorded = []
  queue = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    recorded.push({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: typeof init?.body === 'string' ? init.body : undefined,
    })
    const next = queue.shift()
    if (next instanceof Error) return Promise.reject(next)
    if (!next) throw new Error(`no queued response for ${String(input)}`)
    return Promise.resolve(next)
  })
})

const urls = {
  meUrl: '/api/auth/me',
  loginUrl: '/api/auth/login',
  logoutUrl: '/api/auth/logout',
}

describe('createAuthClient — fetchMe', () => {
  it('2xx → authenticated with the user', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(json({ Id: 'u1', Permissions: ['orders.read'] }))
    expect(await auth.fetchMe()).toEqual({ status: 'authenticated', user: { Id: 'u1', Permissions: ['orders.read'] } })
    expect(recorded[0].url).toBe('/api/auth/me')
  })

  it('401 → anonymous', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(new Response(null, { status: 401 }))
    expect(await auth.fetchMe()).toEqual({ status: 'anonymous' })
  })

  it('network failure → unknown with status 0, never anonymous', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(new Error('offline'))
    const s = await auth.fetchMe()
    expect(s.status).toBe('unknown')
    if (s.status !== 'unknown') return
    expect(s.error).toBeInstanceOf(ApiError)
    expect(s.error.status).toBe(0)
    expect(s.error.message).toBe('A network error occurred.')
  })

  it('5xx / 403 → unknown carrying status, envelope code and details', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(json({ error: { code: 'maintenance', message: 'Back soon', details: [{ code: 'x', message: 'y' }, { bad: 1 }] } }, 503))
    const s = await auth.fetchMe()
    if (s.status !== 'unknown') throw new Error(`expected unknown, got ${s.status}`)
    expect(s.error.status).toBe(503)
    expect(s.error.code).toBe('maintenance')
    expect(s.error.message).toBe('Back soon')
    expect(s.error.details).toEqual([{ code: 'x', message: 'y' }])
    enqueue(new Response(null, { status: 403 }))
    const t = await auth.fetchMe()
    if (t.status !== 'unknown') throw new Error(`expected unknown, got ${t.status}`)
    expect(t.error.status).toBe(403)
    expect(t.error.message).toBe('Could not verify the session.')
  })

  it('unreadable 2xx body → unknown', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(new Response('<html>', { status: 200 }))
    const s = await auth.fetchMe()
    if (s.status !== 'unknown') throw new Error(`expected unknown, got ${s.status}`)
    expect(s.error.status).toBe(200)
  })

  it('syncs permissions on authenticated, clears on anonymous, keeps them on unknown', async () => {
    const store = createPermissionStore()
    const auth = createAuthClient<User, Cred>({
      ...urls,
      getPermissions: (u) => u.Permissions,
      permissionStore: store,
    })
    expect(store.isKnown()).toBe(false)
    enqueue(new Error('offline'))
    await auth.fetchMe()
    expect(store.isKnown()).toBe(false) // first answer unknown — still unknown, not «no permissions»
    enqueue(json({ Id: 'u1', Permissions: ['orders.read', 'orders.write'] }))
    await auth.fetchMe()
    expect(store.isKnown()).toBe(true)
    expect(store.has('orders.write')).toBe(true)
    enqueue(new Response(null, { status: 503 }))
    await auth.fetchMe()
    expect(store.has('orders.write')).toBe(true) // last known permissions survive an outage
    enqueue(new Response(null, { status: 401 }))
    await auth.fetchMe()
    expect(store.get().size).toBe(0)
    expect(store.isKnown()).toBe(true) // known: no permissions
  })
})

describe('createAuthClient — login', () => {
  it('posts credentials as JSON and returns ok+user', async () => {
    const store = createPermissionStore()
    const auth = createAuthClient<User, Cred>({
      ...urls,
      getPermissions: (u) => u.Permissions,
      permissionStore: store,
    })
    enqueue(json({ Id: 'u1', Permissions: ['orders.read'] }))
    const result = await auth.login({ Username: 'a', Password: 'b' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.user.Id).toBe('u1')
    expect(recorded[0].method).toBe('POST')
    expect(JSON.parse(recorded[0].body!)).toEqual({ Username: 'a', Password: 'b' })
    expect(store.has('orders.read')).toBe(true)
  })

  it('401 → invalidCredentials message (locale override) with a 401 error', async () => {
    const auth = createAuthClient<User, Cred>({
      ...urls,
      messages: { invalidCredentials: '사용자명 또는 비밀번호가 올바르지 않습니다.' },
    })
    enqueue(json({ message: 'Unauthorized' }, 401))
    const result = await auth.login({ Username: 'a', Password: 'x' })
    if (result.ok) throw new Error('expected failure')
    expect(result.message).toBe('사용자명 또는 비밀번호가 올바르지 않습니다.')
    expect(result.error.status).toBe(401)
  })

  it('non-401 failure keeps status and server code; message from server, fallback otherwise', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(json({ error: { code: 'password-change-required', message: '비밀번호를 바꿔야 합니다' } }, 403))
    const r1 = await auth.login({ Username: 'a', Password: 'b' })
    if (r1.ok) throw new Error('expected failure')
    expect(r1.message).toBe('비밀번호를 바꿔야 합니다')
    expect(r1.error.status).toBe(403)
    expect(r1.error.code).toBe('password-change-required')
    enqueue(json({ Message: '계정이 잠겼습니다' }, 423))
    const r2 = await auth.login({ Username: 'a', Password: 'b' })
    if (r2.ok) throw new Error('expected failure')
    expect(r2.message).toBe('계정이 잠겼습니다')
    enqueue(new Response(null, { status: 429 }))
    const r3 = await auth.login({ Username: 'a', Password: 'b' })
    if (r3.ok) throw new Error('expected failure')
    expect(r3.message).toBe('Login failed.')
    expect(r3.error.status).toBe(429)
  })

  it('extractLoginError picks the message; code still comes from the envelope', async () => {
    const auth = createAuthClient<User, Cred>({
      ...urls,
      extractLoginError: (b) => (b as { reason?: string }).reason,
    })
    enqueue(json({ reason: 'Locked', code: 'locked' }, 403))
    const r = await auth.login({ Username: 'a', Password: 'b' })
    if (r.ok) throw new Error('expected failure')
    expect(r.message).toBe('Locked')
    expect(r.error.code).toBe('locked')
  })

  it('network error → networkError message, status 0', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(new Error('offline'))
    const r = await auth.login({ Username: 'a', Password: 'b' })
    if (r.ok) throw new Error('expected failure')
    expect(r.message).toBe('A network error occurred.')
    expect(r.error.status).toBe(0)
  })
})

// 쿠키 세션에서 로그아웃의 효과는 서버가 세션을 끊는 것이다 — «답을 못 받음» 을 «로그아웃됨» 으로 접으면 쿠키가 산 채로
// 화면이 로그인으로 서고, 공용 단말에서 다음 사람이 그 세션을 이어받는다.
describe('createAuthClient — logout', () => {
  const setup = () => {
    const store = createPermissionStore(['orders.read'])
    const auth = createAuthClient<User, Cred>({ ...urls, getPermissions: (u) => u.Permissions, permissionStore: store })
    return { store, auth }
  }

  it('2xx → ok, posts to logoutUrl, clears permissions', async () => {
    const { store, auth } = setup()
    enqueue(new Response(null, { status: 204 }))
    expect(await auth.logout()).toEqual({ ok: true })
    expect(recorded[0].url).toBe('/api/auth/logout')
    expect(recorded[0].method).toBe('POST')
    expect(store.get().size).toBe(0)
  })

  it('401 → ok: the session is already gone', async () => {
    const { store, auth } = setup()
    enqueue(new Response(null, { status: 401 }))
    expect(await auth.logout()).toEqual({ ok: true })
    expect(store.get().size).toBe(0)
  })

  it('5xx → not ok, server message or the fallback, permissions kept', async () => {
    const { store, auth } = setup()
    enqueue(json({ error: { code: 'maintenance', message: 'Back soon' } }, 503))
    const r = await auth.logout()
    if (r.ok) throw new Error('expected failure')
    expect(r.message).toBe('Back soon')
    expect(r.error.status).toBe(503)
    expect(r.error.code).toBe('maintenance')
    expect(store.get().has('orders.read')).toBe(true)

    enqueue(new Response(null, { status: 500 }))
    const r2 = await auth.logout()
    if (r2.ok) throw new Error('expected failure')
    expect(r2.message).toBe('Could not sign out.')
  })

  it('network failure → not ok with status 0, permissions kept', async () => {
    const { store, auth } = setup()
    enqueue(new Error('offline'))
    const r = await auth.logout()
    if (r.ok) throw new Error('expected failure')
    expect(r.message).toBe('A network error occurred.')
    expect(r.error.status).toBe(0)
    expect(store.get().has('orders.read')).toBe(true)
  })

  it('messages.logoutFailed localizes the fallback', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls, messages: { logoutFailed: '로그아웃하지 못했습니다.' } })
    enqueue(new Response(null, { status: 500 }))
    const r = await auth.logout()
    if (r.ok) throw new Error('expected failure')
    expect(r.message).toBe('로그아웃하지 못했습니다.')
  })
})

describe('createAuthClient — baseUrl', () => {
  it('prepends baseUrl to relative urls', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls, baseUrl: 'https://api.test' })
    enqueue(json({ Id: 'u1', Permissions: [] }))
    await auth.fetchMe()
    expect(recorded[0].url).toBe('https://api.test/api/auth/me')
  })
})
