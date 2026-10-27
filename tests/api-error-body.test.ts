import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createODataService, ApiError } from '../src/data/ODataService'
import { createAuthClient } from '../src/auth/AuthClient'

// 거절 응답이 싣는 «충돌의 현재 상태»(409 의 새 판정 · 412 의 현재 표현)를 호출부가 같은 요청을 다시 보내지 않고 읽는다.
// 본문은 서버 계약이라 `unknown` 이다 — JSON 이면 파싱한 값, 아니면 텍스트, 비었으면 없다.

let queue: (Response | Error)[] = []

beforeEach(() => {
  queue = []
  vi.stubGlobal('fetch', () => {
    const next = queue.shift()
    if (next instanceof Error) return Promise.reject(next)
    if (!next) throw new Error('no queued response')
    return Promise.resolve(next)
  })
})

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}

const BASE = 'https://app.test'

describe('ApiError.body — data service', () => {
  it('carries the parsed JSON body of a rejected write', async () => {
    const svc = createODataService({ baseUrl: BASE })
    const body = { error: { code: 'LedgerChanged', message: 'The ledger changed.' }, report: { rows: 3 } }
    queue.push(json(body, 409))
    const err = await svc.apiPost('imports/commit', { id: 1 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(409)
    expect((err as ApiError).code).toBe('LedgerChanged')
    expect((err as ApiError).body).toEqual(body)
  })

  it('keeps a non-JSON body as text, and leaves an empty body undefined', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(new Response('upstream timeout', { status: 502 }))
    const text = await svc.odataGet('Orders').catch((e: unknown) => e)
    expect((text as ApiError).body).toBe('upstream timeout')

    queue.push(new Response(null, { status: 404 }))
    const empty = await svc.odataGet('Orders').catch((e: unknown) => e)
    expect((empty as ApiError).body).toBeUndefined()
  })

  it('gives formatError the same body the error carries', async () => {
    let seen: unknown
    const svc = createODataService({ baseUrl: BASE, formatError: (info) => { seen = info.body; return undefined } })
    const body = { error: { code: 'Conflict', message: 'x' }, current: { Version: 7 } }
    queue.push(json(body, 412))
    const err = await svc.odataGet('Orders').catch((e: unknown) => e)
    expect(seen).toEqual(body)
    expect((err as ApiError).body).toBe(seen)
  })
})

// 코드는 메시지와 같은 관례 집합에서 읽는다 — 문장(`Message`)은 읽고 코드(`Code`)는 버리면 소비자가 문구로 분기한다.
describe('ApiError.code — the same conventions as the message', () => {
  it('reads a top-level PascalCase Code next to Message', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ Code: 'order_ship_hold', Message: 'The order is on hold.' }, 409))
    const err = await svc.apiPost('shipments', { id: 1 }).catch((e: unknown) => e)
    expect((err as ApiError).code).toBe('order_ship_hold')
    expect((err as ApiError).message).toBe('The order is on hold.')
  })

  it('prefers the envelope, then lowercase code, over Code', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ error: { code: 'Envelope', message: 'x' }, code: 'lower', Code: 'Pascal' }, 409))
    const enveloped = await svc.odataGet('Orders').catch((e: unknown) => e)
    expect((enveloped as ApiError).code).toBe('Envelope')

    queue.push(json({ code: 'lower', Code: 'Pascal' }, 409))
    const lower = await svc.odataGet('Orders').catch((e: unknown) => e)
    expect((lower as ApiError).code).toBe('lower')
  })

  it('treats an empty Code as no code', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ Code: '', Message: 'x' }, 409))
    const err = await svc.odataGet('Orders').catch((e: unknown) => e)
    expect((err as ApiError).code).toBeUndefined()
  })

  it('gives formatError the Code', async () => {
    let seen: string | undefined
    const svc = createODataService({ baseUrl: BASE, formatError: (info) => { seen = info.code; return undefined } })
    queue.push(json({ Code: 'issued_waybills', Message: 'x' }, 409))
    await svc.odataGet('Orders').catch(() => undefined)
    expect(seen).toBe('issued_waybills')
  })

  it('reads Code for the auth client too', async () => {
    const auth = createAuthClient<{ Id: string }, { u: string }>({
      meUrl: '/api/auth/me', loginUrl: '/api/auth/login', logoutUrl: '/api/auth/logout',
    })
    queue.push(json({ Code: 'password_expired', Message: 'Change your password.' }, 403))
    const r = await auth.login({ u: 'a' })
    if (r.ok) throw new Error('expected failure')
    expect(r.error.code).toBe('password_expired')
  })
})

describe('ApiError — auth client', () => {
  const urls = { meUrl: '/api/auth/me', loginUrl: '/api/auth/login', logoutUrl: '/api/auth/logout' }

  it('carries the body of a rejected login', async () => {
    const auth = createAuthClient<{ Id: string }, { u: string }>({ ...urls })
    const body = { error: { code: 'Locked', message: 'Account locked.' }, retryAfter: 300 }
    queue.push(json(body, 423))
    const r = await auth.login({ u: 'a' })
    if (r.ok) throw new Error('expected failure')
    expect(r.error.body).toEqual(body)
  })

  it('keeps the transport exception as the standard cause when there was no response', async () => {
    const auth = createAuthClient<{ Id: string }, { u: string }>({ ...urls })
    const offline = new TypeError('Failed to fetch')
    queue.push(offline)
    const r = await auth.fetchMe()
    if (r.status !== 'unknown') throw new Error('expected unknown')
    expect(r.error.status).toBe(0)
    expect(r.error.cause).toBe(offline)
    expect(r.error.body).toBeUndefined()
  })
})

describe('ApiError — RFC 9457 problem details', () => {
  it('a 400 problem body gives its detail as the message and its code as `code`', async () => {
    const svc = createODataService({ baseUrl: BASE })
    const body = { type: 'about:blank', title: 'Invalid value', status: 400, detail: 'Quantity must be positive.', code: 'CheckViolation' }
    queue.push(new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': 'application/problem+json' } }))
    const err = (await svc.odataPostQuiet('Orders', { Quantity: -1 }).catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.code).toBe('CheckViolation')
    expect(err.message).toContain('Quantity must be positive.')
  })

  it('falls back to the title when there is no detail', async () => {
    const svc = createODataService({ baseUrl: BASE })
    queue.push(json({ title: 'Conflict with the stored rows', status: 409 }, 409))
    const err = (await svc.odataPostQuiet('Orders', {}).catch((e: unknown) => e)) as ApiError
    expect(err.message).toContain('Conflict with the stored rows')
  })
})
