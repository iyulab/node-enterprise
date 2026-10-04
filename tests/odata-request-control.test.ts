import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createODataService, ApiError, etagOf, wasNotified } from '../src/data/ODataService'

/**
 * 호출 단위 제어 — 취소(`signal`)와 조건부 쓰기(`ifMatch`).
 *
 * ⑴ 앞선 요청을 버리는 화면(연속 클릭 · 입력 중 조회)이 이 서비스를 못 타고 raw fetch 로 남았다 —
 *    요청마다 `AbortSignal` 을 넘길 자리가 없었다.
 * ⑵ 서버가 동시성 토큰(`@odata.etag`)을 내고 `If-Match` 를 지키는데, 쓰기에 그것을 실을 길이 없었다.
 */
interface Seen { url: string; method: string; ifMatch: string | null; signal?: AbortSignal | null }
let seen: Seen[] = []
let respond: (req: Seen) => Promise<Response>

beforeEach(() => {
  seen = []
  respond = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const req: Seen = {
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      ifMatch: init?.headers ? new Headers(init.headers).get('If-Match') : null,
      signal: init?.signal,
    }
    seen.push(req)
    // 실제 fetch 처럼 신호가 오면 그 이유로 거부한다.
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal
      if (signal?.aborted) return reject(signal.reason)
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      respond(req).then(resolve, reject)
    })
  })
})

const BASE = 'https://app.test'
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
const never = () => new Promise<Response>(() => {})

describe('ODataRequestOptions.signal — 취소', () => {
  it('🔴a cancelled read rejects with signal.reason itself (AbortError), not ApiError', async () => {
    respond = never
    const svc = createODataService({ baseUrl: BASE })
    const ac = new AbortController()
    const p = svc.odataGet('Orders', undefined, { signal: ac.signal })
    ac.abort()
    const err = await p.catch((e: unknown) => e)
    expect(err).toBe(ac.signal.reason)
    expect((err as DOMException).name).toBe('AbortError')
    expect(err).not.toBeInstanceOf(ApiError)
  })

  it('🔴a cancelled write does not notify and does not report a mutation', async () => {
    respond = never
    const error = vi.fn()
    const onMutated = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error }, onMutated })
    const ac = new AbortController()
    const p = svc.odataPatch('Orders', '1', { Name: 'x' }, { signal: ac.signal })
    ac.abort(new DOMException('replaced', 'AbortError'))
    const err = await p.catch((e: unknown) => e)
    expect((err as DOMException).message).toBe('replaced')
    expect(error).not.toHaveBeenCalled()
    expect(onMutated).not.toHaveBeenCalled()
    expect(wasNotified(err)).toBe(false)
  })

  it('an already-aborted signal does not send the request', async () => {
    const svc = createODataService({ baseUrl: BASE })
    const ac = new AbortController()
    ac.abort()
    await expect(svc.apiGet('ping', { signal: ac.signal })).rejects.toBe(ac.signal.reason)
    expect(seen).toHaveLength(0)
  })

  it('the signal reaches fetch on every page of odataGet', async () => {
    let page = 0
    respond = async () =>
      page++ === 0
        ? json({ value: [1], '@odata.nextLink': `${BASE}/$data/Orders?$skiptoken=1` })
        : json({ value: [2] })
    const svc = createODataService({ baseUrl: BASE })
    const ac = new AbortController()
    expect(await svc.odataGet('Orders', undefined, { signal: ac.signal })).toEqual([1, 2])
    expect(seen.map((s) => s.signal != null)).toEqual([true, true])
  })

  it('without options the request carries neither signal nor If-Match (unchanged)', async () => {
    respond = async () => json({ value: [] })
    const svc = createODataService({ baseUrl: BASE })
    await svc.odataGet('Orders')
    expect(seen[0].ifMatch).toBeNull()
  })
})

describe('ODataRequestOptions.ifMatch — 낙관적 동시성', () => {
  it('🔴sends If-Match on a write', async () => {
    respond = async () => new Response(null, { status: 204 })
    const svc = createODataService({ baseUrl: BASE })
    await svc.odataPatch('Orders', '1', { Name: 'x' }, { ifMatch: 'W/"AAAAAAAAB9E="' })
    await svc.odataDelete('Orders', '1', { ifMatch: 'W/"3"' })
    expect(seen.map((s) => [s.method, s.ifMatch])).toEqual([['PATCH', 'W/"AAAAAAAAB9E="'], ['DELETE', 'W/"3"']])
  })

  it('🔴a 412 is an ApiError with status 412 and the conflict message, notified on a write', async () => {
    respond = async () => json({ error: { code: 'PreconditionFailed', message: 'x'.repeat(300) } }, 412)
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    const err = (await svc.odataPatch('Orders', '1', {}, { ifMatch: 'W/"1"' }).catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(412)
    expect(err.message).toBe('Someone else changed this record. Reload it and try again.')
    expect(error).toHaveBeenCalledWith(err.message)
  })

  it('etagOf reads @odata.etag from a read; odataGetById fills it from the ETag header when the body has none', async () => {
    expect(etagOf({ '@odata.etag': 'W/"5"', Id: 1 })).toBe('W/"5"')
    expect(etagOf({ Id: 1 })).toBeUndefined()
    expect(etagOf(null)).toBeUndefined()

    respond = async () => json({ Id: 1 }, 200, { ETag: 'W/"9"' })
    const svc = createODataService({ baseUrl: BASE })
    const row = await svc.odataGetById<{ Id: number }>('Orders', '1')
    expect(etagOf(row)).toBe('W/"9"')
  })

  it('a body etag wins over the header', async () => {
    respond = async () => json({ Id: 1, '@odata.etag': 'W/"body"' }, 200, { ETag: 'W/"header"' })
    const svc = createODataService({ baseUrl: BASE })
    expect(etagOf(await svc.odataGetById('Orders', '1'))).toBe('W/"body"')
  })
})
