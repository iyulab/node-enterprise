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
