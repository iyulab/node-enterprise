/**
 * OData v4 + custom REST 서비스 팩토리.
 *
 * 여러 소비앱이 글자 단위로 동일하게 재작성하던 OData/REST CRUD 래퍼 —
 * 401 세션 처리, 에러 메시지 추출, 성공 토스트, 빈-바디(204) 안전 파싱 — 를
 * 범용 primitive 로 승격한 것. 도메인/로케일 요소(엔티티 목록, 한국어 문구,
 * 도메인 액션)는 라이브러리에 넣지 않고 주입(config)으로 앱 adapter 에 남긴다.
 *
 * @example
 * const svc = createODataService({
 *   baseUrl: window.location.origin,
 *   onUnauthorized: () => { window.location.href = '/' },
 *   notify: { success: (m) => app.success(m), error: (m) => app.error(m) },
 *   messages: { saved: '저장되었습니다', updated: '수정되었습니다', deleted: '삭제되었습니다' },
 * })
 * const rows = await svc.odataGet<BankAccount>('BankAccounts', { $top: '20' })
 */
import { HttpClient, type HttpResponse } from '@iyulab/http-client'
import buildQuery from 'odata-query'

/**
 * API 호출 실패 에러 — HTTP status 를 실어 호출부가 상태별 분기(예: 404 도메인 문구)를 할 수 있게 한다.
 * `Error` 를 상속하므로 기존 `e instanceof Error`/`e.message` 소비처는 그대로 동작한다.
 */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 서비스가 토스트/에러에 쓰는 사용자 대면 문구. 기본값은 영어 — 앱이 로케일별로 오버라이드한다. */
export interface ODataServiceMessages {
  /** POST 성공 토스트 */
  saved: string
  /** PATCH 성공 토스트 */
  updated: string
  /** DELETE 성공 토스트 */
  deleted: string
  /** 401 세션 만료 시 throw 되는 에러 메시지 */
  sessionExpired: string
  /** status별 매핑이 없을 때의 폴백 */
  requestFailed: string
  /** 서버 raw 메시지가 없거나 너무 길 때 status → 친화 메시지 */
  http: Record<number, string>
}

const DEFAULT_MESSAGES: ODataServiceMessages = {
  saved: 'Saved',
  updated: 'Updated',
  deleted: 'Deleted',
  sessionExpired: 'Your session has expired. Please sign in again.',
  requestFailed: 'Request failed',
  http: {
    400: 'Bad request',
    403: 'Forbidden',
    404: 'Not found',
    409: 'Conflict',
    500: 'Server error',
  },
}

export interface ODataServiceConfig {
  /** 모든 요청의 베이스 URL (예: `window.location.origin`). 슬래시 없이 오리진만. */
  baseUrl: string
  /** OData 엔드포인트 prefix (기본 `$data`) */
  odataPrefix?: string
  /** custom REST 엔드포인트 prefix (기본 `api`) */
  apiPrefix?: string
  /**
   * 401 응답 시 호출된다(모든 메서드 공통). 세션 만료 리다이렉트는 앱이 결정한다.
   * 재진입 가드(한 번만 리다이렉트)도 앱 콜백 쪽에서 처리한다 — 라이브러리는 status만 통지.
   */
  onUnauthorized?: (status: number) => void
  /** 성공/실패 토스트 훅. 생략하면 토스트를 내지 않는다(순수 · 테스트 용이). */
  notify?: {
    success?: (message: string) => void
    error?: (message: string) => void
  }
  /** 사용자 대면 문구 오버라이드(로케일). 지정한 키만 기본값을 대체한다. */
  messages?: Partial<ODataServiceMessages>
  /**
   * 에러 메시지 포매팅 오버라이드. 반환값이 있으면 그것을 에러 메시지로 사용한다.
   * (앱별 정책 — 예: 영문 raw OData 메시지를 로케일 친화 문구로 치환 — 을 여기에 둔다.)
   */
  formatError?: (info: {
    status: number
    statusText: string
    rawMessage?: string
    body?: unknown
  }) => string | undefined
}

export interface ODataService {
  /** 설정된 prefix + baseUrl 로 OData 엔티티 URL 을 만든다(flex-table useODataSource 등에서 사용). */
  odataUrl(entity: string): string
  /** 설정된 prefix + baseUrl 로 REST 엔드포인트 URL 을 만든다. */
  apiUrl(path: string): string

  /** OData GET(목록). `value` 배열을 벗겨 반환한다. */
  odataGet<T>(entity: string, params?: Record<string, string>): Promise<T[]>
  /** OData GET(단건, key). */
  odataGetById<T>(entity: string, id: string): Promise<T>
  /** `$count=true&$top=0` — 데이터 없이 총 건수만. */
  odataCount(entity: string, filter?: Record<string, unknown>): Promise<number>
  /** OData POST(생성) — 토스트 없이 결과만(일괄 처리에서 토스트 폭주 방지). */
  odataPostQuiet<T>(entity: string, body: Partial<T>): Promise<T>
  /** OData POST(생성) — 성공 시 `saved` 토스트. */
  odataPost<T>(entity: string, body: Partial<T>): Promise<T>
  /** OData PATCH(수정) — 성공 시 `updated` 토스트. */
  odataPatch<T>(entity: string, id: string, body: Partial<T>): Promise<void>
  /** OData DELETE — 성공 시 `deleted` 토스트. */
  odataDelete(entity: string, id: string): Promise<void>

  /** custom REST GET — 204 등 빈 바디를 안전 파싱. */
  apiGet<T>(path: string): Promise<T>
  /** custom REST POST. */
  apiPost<T>(path: string, body?: unknown): Promise<T>
  /** custom REST PUT(리소스 전체 교체/생성). `body`가 `FormData`면 자동으로 멀티파트로 전송된다
   *  (`@iyulab/http-client`가 Content-Type을 브라우저에 맡긴다 — `apiPost`/`apiPatch`도 동일). */
  apiPut<T>(path: string, body?: unknown): Promise<T>
  /** custom REST PATCH. */
  apiPatch<T>(path: string, body?: unknown): Promise<T>
  /** custom REST DELETE — 대부분 204 No Content. */
  apiDelete<T = void>(path: string): Promise<T>

  /** URL 을 직접 조립한 커스텀 조회(csv-export 등)를 위해 raw 응답을 반환. */
  fetchRaw(url: string): Promise<HttpResponse>

  /**
   * flex-table `useODataSource` 에 주입할 공용 transport 옵션.
   * useODataSource 는 자체 fetcher 를 쓰므로 별도로 `onUnauthorized` 를 배선해야 401 처리가 걸린다.
   */
  readonly sourceDefaults: { baseUrl: string; onUnauthorized: () => void }

  /** `instanceof` 판정을 위해 재노출. (모듈 export `ApiError` 와 동일 클래스) */
  readonly ApiError: typeof ApiError
}

/** 빈 문자열을 null 로 정규화 — OData 서버가 빈 문자열을 400으로 거부하는 패턴 방지. */
function normalizeBody<T>(body: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, v === '' ? null : v]),
  ) as Partial<T>
}

/**
 * 응답 바디를 안전하게 JSON 파싱 — custom REST 엔드포인트 다수가 성공 시 204 No Content(빈 바디)를
 * 반환한다. `res.json()` 은 빈 바디에서 SyntaxError 를 던지므로 항상 `.text()` 로 먼저 읽고
 * 내용이 있을 때만 파싱한다.
 */
async function parseJsonBody<T>(res: HttpResponse): Promise<T> {
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/**
 * OData v4 + custom REST 서비스를 생성한다.
 * 반환된 서비스는 상태를 공유하지 않는 순수 클로저이므로 여러 개를 만들어도 안전하다(테스트 격리에도 유리).
 */
export function createODataService(config: ODataServiceConfig): ODataService {
  const baseUrl = config.baseUrl
  const odataPrefix = config.odataPrefix ?? '$data'
  const apiPrefix = config.apiPrefix ?? 'api'
  const messages: ODataServiceMessages = {
    ...DEFAULT_MESSAGES,
    ...config.messages,
    http: { ...DEFAULT_MESSAGES.http, ...config.messages?.http },
  }
  const notifySuccess = config.notify?.success
  const notifyError = config.notify?.error

  // baseUrl 은 우리가 URL 조립 시 직접 붙이므로 client 에는 넘기지 않는다(이중 prefix 방지).
  const client = new HttpClient({})

  const odataUrl = (entity: string) => `${baseUrl}/${odataPrefix}/${entity}`
  const apiUrl = (path: string) => {
    const clean = path.startsWith('/') ? path.slice(1) : path
    return `${baseUrl}/${apiPrefix}/${clean}`
  }

  /** OData 응답에서 사용자 친화적 에러 메시지 추출. */
  async function extractErrorMsg(res: HttpResponse): Promise<string> {
    let body: Record<string, unknown> | undefined
    try {
      body = await res.json<Record<string, unknown>>()
    } catch {
      body = undefined
    }
    // OData 는 error.message(lowercase), 커스텀 REST 는 최상위 Message(PascalCase) 컨벤션을 함께 지원.
    const rawVal =
      (body?.error as Record<string, unknown> | undefined)?.message ?? body?.message ?? body?.Message
    const rawMessage = typeof rawVal === 'string' ? rawVal : undefined

    if (config.formatError) {
      const m = config.formatError({ status: res.status, statusText: res.statusText, rawMessage, body })
      if (m) return m
    }
    // 너무 긴 raw 메시지(서버 내부 스택 등)는 노출하지 않고 친화 메시지로 대체.
    if (rawMessage && rawMessage.length <= 200) return rawMessage
    return messages.http[res.status] ?? `${messages.requestFailed} (${res.status})`
  }

  /** 에러 확인 후 throw. 401 은 onUnauthorized 통지 후 세션 만료 에러로 단락. */
  async function throwIfError(res: HttpResponse): Promise<void> {
    if (res.ok) return
    if (res.status === 401) {
      config.onUnauthorized?.(401)
      throw new ApiError(messages.sessionExpired, 401)
    }
    throw new ApiError(await extractErrorMsg(res), res.status)
  }

  async function odataGet<T>(entity: string, params?: Record<string, string>): Promise<T[]> {
    const u = new URL(odataUrl(entity))
    if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
    const res = await client.get(u.toString())
    await throwIfError(res)
    const json = await res.json<{ value?: T[] }>()
    return json.value ?? (json as unknown as T[])
  }

  async function odataGetById<T>(entity: string, id: string): Promise<T> {
    const res = await client.get(`${odataUrl(entity)}(${id})`)
    await throwIfError(res)
    return res.json<T>()
  }

  async function odataCount(entity: string, filter?: Record<string, unknown>): Promise<number> {
    const qs = buildQuery({ filter, top: 0, count: true })
    const res = await client.get(`${odataUrl(entity)}${qs}`)
    await throwIfError(res)
    const json = await res.json<{ '@odata.count'?: number }>()
    return json['@odata.count'] ?? 0
  }

  async function odataPostQuiet<T>(entity: string, body: Partial<T>): Promise<T> {
    const res = await client.post(odataUrl(entity), normalizeBody(body))
    await throwIfError(res)
    return res.json<T>()
  }

  async function odataPost<T>(entity: string, body: Partial<T>): Promise<T> {
    try {
      const result = await odataPostQuiet<T>(entity, body)
      notifySuccess?.(messages.saved)
      return result
    } catch (e) {
      // 401(세션 만료)은 onUnauthorized 가 이미 안내함 — 중복 토스트 방지.
      if (!(e instanceof ApiError && e.status === 401)) {
        notifyError?.(e instanceof Error ? e.message : messages.requestFailed)
      }
      throw e
    }
  }

  async function odataPatch<T>(entity: string, id: string, body: Partial<T>): Promise<void> {
    const res = await client.patch(`${odataUrl(entity)}(${id})`, normalizeBody(body))
    if (!res.ok) {
      if (res.status === 401) {
        config.onUnauthorized?.(401)
        throw new ApiError(messages.sessionExpired, 401)
      }
      const msg = await extractErrorMsg(res)
      notifyError?.(msg)
      throw new ApiError(msg, res.status)
    }
    notifySuccess?.(messages.updated)
  }

  async function odataDelete(entity: string, id: string): Promise<void> {
    const res = await client.delete(`${odataUrl(entity)}(${id})`)
    if (!res.ok) {
      if (res.status === 401) {
        config.onUnauthorized?.(401)
        throw new ApiError(messages.sessionExpired, 401)
      }
      const msg = await extractErrorMsg(res)
      notifyError?.(msg)
      throw new ApiError(msg, res.status)
    }
    notifySuccess?.(messages.deleted)
  }

  async function apiGet<T>(path: string): Promise<T> {
    // 쿼리스트링이 붙은 path 지원(`endpoint?x=1`).
    const [p, ...q] = path.split('?')
    const url = q.length ? `${apiUrl(p)}?${q.join('?')}` : apiUrl(p)
    const res = await client.get(url)
    await throwIfError(res)
    return parseJsonBody<T>(res)
  }

  async function apiPost<T>(path: string, body?: unknown): Promise<T> {
    const res = await client.post(apiUrl(path), body ?? {})
    await throwIfError(res)
    return parseJsonBody<T>(res)
  }

  async function apiPut<T>(path: string, body?: unknown): Promise<T> {
    const res = await client.put(apiUrl(path), body ?? {})
    await throwIfError(res)
    return parseJsonBody<T>(res)
  }

  async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
    const res = await client.patch(apiUrl(path), body ?? {})
    await throwIfError(res)
    return parseJsonBody<T>(res)
  }

  async function apiDelete<T = void>(path: string): Promise<T> {
    const res = await client.delete(apiUrl(path))
    await throwIfError(res)
    return parseJsonBody<T>(res)
  }

  async function fetchRaw(url: string): Promise<HttpResponse> {
    const res = await client.get(url)
    await throwIfError(res)
    return res
  }

  return {
    odataUrl,
    apiUrl,
    odataGet,
    odataGetById,
    odataCount,
    odataPostQuiet,
    odataPost,
    odataPatch,
    odataDelete,
    apiGet,
    apiPost,
    apiPut,
    apiPatch,
    apiDelete,
    fetchRaw,
    sourceDefaults: {
      baseUrl,
      onUnauthorized: () => config.onUnauthorized?.(401),
    },
    ApiError,
  }
}
