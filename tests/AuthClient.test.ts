import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAuthClient } from '../src/auth/AuthClient'
import { createPermissionStore } from '../src/auth/permissions'

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
  it('returns the user on 200', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(json({ Id: 'u1', Permissions: ['orders.read'] }))
    const user = await auth.fetchMe()
    expect(user).toEqual({ Id: 'u1', Permissions: ['orders.read'] })
    expect(recorded[0].url).toBe('/api/auth/me')
  })

  it('returns null on 401 and on network error', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(new Response(null, { status: 401 }))
    expect(await auth.fetchMe()).toBeNull()
    enqueue(new Error('offline'))
    expect(await auth.fetchMe()).toBeNull()
  })

  it('syncs permission store on success and clears on null', async () => {
    const store = createPermissionStore()
    const auth = createAuthClient<User, Cred>({
      ...urls,
      getPermissions: (u) => u.Permissions,
      permissionStore: store,
    })
    enqueue(json({ Id: 'u1', Permissions: ['orders.read', 'orders.write'] }))
    await auth.fetchMe()
    expect(store.has('orders.write')).toBe(true)
    enqueue(new Response(null, { status: 401 }))
    await auth.fetchMe()
    expect(store.get().size).toBe(0)
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
    expect(result.ok).toBe(true)
    expect(result.user?.Id).toBe('u1')
    expect(recorded[0].method).toBe('POST')
    expect(JSON.parse(recorded[0].body!)).toEqual({ Username: 'a', Password: 'b' })
    expect(store.has('orders.read')).toBe(true)
  })

  it('401 → invalidCredentials message (locale override)', async () => {
    const auth = createAuthClient<User, Cred>({
      ...urls,
      messages: { invalidCredentials: '사용자명 또는 비밀번호가 올바르지 않습니다.' },
    })
    enqueue(new Response(null, { status: 401 }))
    const result = await auth.login({ Username: 'a', Password: 'x' })
    expect(result).toEqual({ ok: false, message: '사용자명 또는 비밀번호가 올바르지 않습니다.' })
  })

  it('non-401 failure extracts server Message, falls back otherwise', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(json({ Message: '계정이 잠겼습니다' }, 403))
    expect((await auth.login({ Username: 'a', Password: 'b' })).message).toBe('계정이 잠겼습니다')
    enqueue(new Response(null, { status: 500 }))
    expect((await auth.login({ Username: 'a', Password: 'b' })).message).toBe('Login failed.')
  })

  it('network error → networkError message', async () => {
    const auth = createAuthClient<User, Cred>({ ...urls })
    enqueue(new Error('offline'))
    expect((await auth.login({ Username: 'a', Password: 'b' })).message).toBe('A network error occurred.')
  })
})

describe('createAuthClient — logout', () => {
  it('posts to logoutUrl and clears permissions; swallows errors', async () => {
    const store = createPermissionStore(['orders.read'])
    const auth = createAuthClient<User, Cred>({
      ...urls,
      getPermissions: (u) => u.Permissions,
      permissionStore: store,
    })
    enqueue(new Error('server down'))
    await expect(auth.logout()).resolves.toBeUndefined()
    expect(recorded[0].url).toBe('/api/auth/logout')
    expect(store.get().size).toBe(0)
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
