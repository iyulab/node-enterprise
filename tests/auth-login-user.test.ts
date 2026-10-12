import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAuthClient } from '../src/auth/AuthClient'
import { createPermissionStore } from '../src/auth/permissions'

// 로그인 응답이 세션 사용자 모양이 아닌 서버(`{ Success, User, Token }` 같은 봉투)에서 `login()` 은 그 봉투를 `TUser` 로
// 돌려주고, `getPermissions` 를 넘기면 봉투에서 권한을 읽어 store 를 비웠다. `loginUser: 'me'` 면 로그인 뒤 세션 사용자를
// `me` 에서 얻는다 — 쿠키 세션에서 세션 사용자의 정본이다. 어느 쪽이든 로그인 응답 원문은 `body` 로 실린다.

let calls: string[] = []
let queue: Response[] = []
beforeEach(() => {
  calls = []
  queue = []
  vi.stubGlobal('fetch', (input: string) => {
    calls.push(String(input))
    const next = queue.shift()
    if (!next) throw new Error('no queued response')
    return Promise.resolve(next)
  })
})
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

interface SessionUser { UserID: string; Permissions: string[] }
const envelope = { Success: true, User: { Id: 7 }, Token: { access: 't' } }
const me: SessionUser = { UserID: 'kim', Permissions: ['orders.read'] }
const urls = { meUrl: '/accounts/me', loginUrl: '/accounts/app-login', logoutUrl: '/accounts/logout' }

describe("login — loginUser: 'me'", () => {
  it('세션 사용자는 me 에서 · 권한도 me 에서 · 로그인 응답 원문은 body', async () => {
    const store = createPermissionStore()
    const auth = createAuthClient<SessionUser>({ ...urls, loginUser: 'me', getPermissions: (u) => u.Permissions, permissionStore: store })
    queue.push(json(envelope), json(me))
    const result = await auth.login({ Username: 'kim', Password: 'x' })
    expect(calls).toEqual(['/accounts/app-login', '/accounts/me'])
    expect(result).toEqual({ ok: true, user: me, body: envelope })
    expect([...store.get()]).toEqual(['orders.read'])
  })

  it('로그인은 2xx 인데 me 가 미인증이면 실패 — 쿠키가 서지 않았다', async () => {
    const auth = createAuthClient<SessionUser>({ ...urls, loginUser: 'me' })
    queue.push(json(envelope), new Response(null, { status: 401 }))
    const result = await auth.login({})
    expect(result.ok).toBe(false)
  })

  it('me 조회가 «모름»(5xx)이면 그 오류로 실패한다', async () => {
    const auth = createAuthClient<SessionUser>({ ...urls, loginUser: 'me' })
    queue.push(json(envelope), json({ error: { code: 'Boom', message: 'db down' } }, 503))
    const result = await auth.login({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.status).toBe(503)
  })
})

describe("login — loginUser: 'body'(기본)", () => {
  it('본문이 곧 세션 사용자 · body 도 같은 값 · me 를 부르지 않는다', async () => {
    const auth = createAuthClient<SessionUser>({ ...urls })
    queue.push(json(me))
    const result = await auth.login({})
    expect(result).toEqual({ ok: true, user: me, body: me })
    expect(calls).toEqual(['/accounts/app-login'])
  })

  it('⚪NEGATIVE — 2xx 인데 본문이 객체가 아니면(빈 본문 · 글자) 종전처럼 실패', async () => {
    const auth = createAuthClient<SessionUser>({ ...urls })
    queue.push(new Response('', { status: 200 }))
    expect((await auth.login({})).ok).toBe(false)
    queue.push(new Response('ok', { status: 200 }))
    expect((await auth.login({})).ok).toBe(false)
  })
})
