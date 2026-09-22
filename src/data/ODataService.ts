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
 * OData v4 오류 봉투의 `error.details` 항목 — 필드별 검증 실패 상세.
 *
 * 규격(OData JSON Format v4.0)상 각 항목은 `code`/`message` 를 **반드시** 갖고
 * `target`(오류가 난 속성 이름)은 **선택**이다 — 필수로 선언하면 target 을 생략한
 * 서버 응답에서 타입이 거짓말을 하게 된다.
 */
export interface ApiErrorDetail {
  code: string
  message: string
  target?: string
}

/**
 * `error.details` 를 검증해 추출한다 — 규격이 요구하는 형태(`code`/`message` 둘 다 문자열)를
 * 갖춘 항목만 남긴다. 이 파일이 `error.message` 에 이미 적용하는 규칙(`typeof === "string"` 을
 * 확인한 뒤 사용)과 같은 이유다: 검증 없이 캐스팅하면 타입만 맞고 런타임에 호출부가 깨진다.
 * 쓸 수 있는 항목이 하나도 없으면 undefined 로 정규화한다 — 빈 배열을 주면 호출부의
 * `if (e.details)` 가 참이 되어 "상세가 있다"고 오해한다.
 */
function extractErrorDetails(raw: unknown): ApiErrorDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const details = raw.filter((d): d is ApiErrorDetail => {
    if (typeof d !== "object" || d === null) return false
    const rec = d as Record<string, unknown>
    return typeof rec.code === "string" && typeof rec.message === "string"
  })
  return details.length > 0 ? details : undefined
}

/**
 * API 호출 실패 에러 — HTTP status 를 실어 호출부가 상태별 분기(예: 404 도메인 문구)를 할 수 있게 한다.
 * `Error` 를 상속하므로 기존 `e instanceof Error`/`e.message` 소비처는 그대로 동작한다.
 */
export class ApiError extends Error {
  readonly status: number
  /** OData v4 오류 봉투의 `error.details`(필드별 검증 상세) — 서버 응답에 없거나 파싱 실패면 undefined. */
  readonly details?: ApiErrorDetail[]
  constructor(message: string, status: number, details?: ApiErrorDetail[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
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

/**
 * 한 호출에만 적용되는 요청 옵션 — 서비스 전역 정책(`ODataServiceConfig`)의 호출 단위 예외.
 *
 * 🔴**전역 정책을 «끄는» 축만 둔다.** 새 동작을 켜는 스위치가 아니라, config 가 세운 기본
 * 정책이 *그 호출에서만* 틀린 경우를 위한 탈출구다 — 그래서 기본값은 항상 «config 그대로» 이고,
 * 옵션을 생략한 호출은 이 타입이 생기기 전과 **한 글자도 다르게 동작하지 않는다.**
 */
export interface ODataRequestOptions {
  /**
   * `false` → 이 호출의 401 을 «세션 만료» 로 취급하지 않는다: 전역 `onUnauthorized` 를
   * 부르지 않고, `messages.sessionExpired` 로 덮어쓰지도 않으며, **서버가 준 메시지**로
   * `ApiError(…, 401)` 을 던진다. 기본값(생략 시)은 전역 정책 그대로다.
   *
   * ⚠**로그인 자체가 이 옵션이 태어난 자리다** — 401 이 「세션이 끊겼다」가 아니라
   * 「자격 증명이 틀렸다」를 뜻하는 유일한 호출이라, 전역 훅이 발화하면 로그인 화면에서
   * 로그인 화면으로 리다이렉트되고 화면이 실패 사유를 **지어내야** 한다.
   *
   * ⚠**`authenticate()` 같은 이름 있는 프리미티브를 두지 않은 이유**: 그것은 엔드포인트
   * 경로·바디 모양·토큰 처리 규약을 이 라이브러리가 안다고 가정하는 **도메인 이름**이다.
   * 그 규약은 앱마다 다르므로 adapter 에 남기고, 라이브러리는 범용 축만 연다.
   */
  onUnauthorized?: false
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
    /** OData v4 `error.details` — 검증을 마친 항목만 실린다(`ApiError.details` 와 같은 값). */
    details?: ApiErrorDetail[]
    body?: unknown
  }) => string | undefined
}

export interface ODataService {
  /** 설정된 prefix + baseUrl 로 OData 엔티티 URL 을 만든다(flex-table useODataSource 등에서 사용). */
  odataUrl(entity: string): string
  /** 설정된 prefix + baseUrl 로 REST 엔드포인트 URL 을 만든다. */
  apiUrl(path: string): string

  /** OData GET(목록). `value` 배열을 벗겨 반환한다. */
  odataGet<T>(entity: string, params?: Record<string, string>, opts?: ODataRequestOptions): Promise<T[]>
  /** OData GET(단건, key). */
  odataGetById<T>(entity: string, id: string, opts?: ODataRequestOptions): Promise<T>
  /** `$count=true&$top=0` — 데이터 없이 총 건수만. */
  odataCount(entity: string, filter?: Record<string, unknown>, opts?: ODataRequestOptions): Promise<number>
  /** OData POST(생성) — 토스트 없이 결과만(일괄 처리에서 토스트 폭주 방지). */
  odataPostQuiet<T>(entity: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<T>
  /** OData POST(생성) — 성공 시 `saved` 토스트. */
  odataPost<T>(entity: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<T>
  /** OData PATCH(수정) — 토스트 없이 결과만(자식 컬렉션 편집 후 부모의 파생 필드를
   *  함께 동기화하는 등, 한 사용자 액션이 여러 mutation을 낼 때 토스트 폭주 방지). */
  odataPatchQuiet<T>(entity: string, id: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<void>
  /** OData PATCH(수정) — 성공 시 `updated` 토스트. */
  odataPatch<T>(entity: string, id: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<void>
  /** OData DELETE — 토스트 없이(`odataPatchQuiet`와 같은 이유). */
  odataDeleteQuiet(entity: string, id: string, opts?: ODataRequestOptions): Promise<void>
  /** OData DELETE — 성공 시 `deleted` 토스트. */
  odataDelete(entity: string, id: string, opts?: ODataRequestOptions): Promise<void>

  /** custom REST GET — 204 등 빈 바디를 안전 파싱. */
  apiGet<T>(path: string, opts?: ODataRequestOptions): Promise<T>
  /** custom REST POST — 실패 시 `error` 토스트 후 rethrow(401 제외). `body`가 `FormData`
   *  인스턴스면 그대로(직렬화 없이) 멀티파트로 전송된다 — `@iyulab/http-client`가
   *  Content-Type을 브라우저 자동 설정에 맡기고 JSON 직렬화 분기를 타지 않는다.
   *  `apiPut`/`apiPatch`도 동일하게 동작한다. */
  apiPost<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T>
  /** custom REST POST — 토스트 없이 결과만(`odataPostQuiet`와 같은 이유: 한 사용자 액션이
   *  여러 요청을 내거나, 소비자가 자기 래퍼로 이미 통지할 때). */
  apiPostQuiet<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T>
  /** custom REST PUT(리소스 전체 교체/생성) — 실패 시 `error` 토스트 후 rethrow(401 제외).
   *  `body`의 `FormData` 처리는 `apiPost` 참조. */
  apiPut<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T>
  /** custom REST PUT — 토스트 없이 결과만. */
  apiPutQuiet<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T>
  /** custom REST PATCH — 실패 시 `error` 토스트 후 rethrow(401 제외). `body`의 `FormData`
   *  처리는 `apiPost` 참조. */
  apiPatch<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T>
  /** custom REST PATCH — 토스트 없이 결과만. */
  apiPatchQuiet<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T>
  /** custom REST DELETE — 실패 시 `error` 토스트 후 rethrow(401 제외). 대부분 204 No Content. */
  apiDelete<T = void>(path: string, opts?: ODataRequestOptions): Promise<T>
  /** custom REST DELETE — 토스트 없이 결과만. */
  apiDeleteQuiet<T = void>(path: string, opts?: ODataRequestOptions): Promise<T>

  /**
   * URL 을 직접 조립한 커스텀 조회(csv-export·연결 프로브 등)를 위해 응답을 **그대로** 반환한다.
   *
   * 🔴**비-2xx 에도 던지지 않고 `onUnauthorized` 도 부르지 않는다 — 판단은 호출부가 한다.**
   * 「raw」는 정책을 태우지 않는다는 뜻이고, 이 메서드가 존재하는 이유가 그것이다.
   * 상태에 따라 예외·토스트·세션 처리를 원하면 `apiGet` 을 쓴다.
   *
   * ⚠**0.15.0 이전에는 선언이 이렇게 적혀 있으면서 실제로는 비-2xx 에 던졌다**(`throwIfError`
   * 를 거쳤다). 그 어긋남 때문에 *"응답이 왔는가"* 만 묻는 연결 프로브가 401 을 「끊김」으로
   * 세었다 — 서버가 살아서 거절한 것인데도. 선언이 옳고 구현이 틀렸던 자리라 구현을 고쳤다.
   */
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

  /** OData 응답에서 사용자 친화적 에러 메시지 + 구조화된 필드별 상세를 추출. */
  async function extractErrorInfo(
    res: HttpResponse,
  ): Promise<{ message: string; details?: ApiErrorDetail[] }> {
    let body: Record<string, unknown> | undefined
    try {
      body = await res.json<Record<string, unknown>>()
    } catch {
      body = undefined
    }
    const errorObj = body?.error as Record<string, unknown> | undefined
    // OData 는 error.message(lowercase), 커스텀 REST 는 최상위 Message(PascalCase) 컨벤션을 함께 지원.
    const rawVal = errorObj?.message ?? body?.message ?? body?.Message
    const rawMessage = typeof rawVal === 'string' ? rawVal : undefined
    // OData v4 오류 봉투의 error.details(필드별 검증 상세) — 이미 파싱된 값을 검증만 해서 싣는다.
    const details = extractErrorDetails(errorObj?.details)

    if (config.formatError) {
      const m = config.formatError({ status: res.status, statusText: res.statusText, rawMessage, details, body })
      if (m) return { message: m, details }
    }
    // 너무 긴 raw 메시지(서버 내부 스택 등)는 노출하지 않고 친화 메시지로 대체.
    if (rawMessage && rawMessage.length <= 200) return { message: rawMessage, details }
    return { message: messages.http[res.status] ?? `${messages.requestFailed} (${res.status})`, details }
  }

  /**
   * 에러 확인 후 throw. 401 은 기본적으로 `onUnauthorized` 통지 후 세션 만료 에러로 단락한다.
   *
   * ⚠`opts.onUnauthorized === false` 면 그 단락을 건너뛰고 **다른 상태 코드와 똑같이** 다룬다 —
   * 훅도 부르지 않고 메시지도 덮어쓰지 않는다(`ODataRequestOptions.onUnauthorized` 참조).
   */
  async function throwIfError(res: HttpResponse, opts?: ODataRequestOptions): Promise<void> {
    if (res.ok) return
    if (res.status === 401 && opts?.onUnauthorized !== false) {
      config.onUnauthorized?.(401)
      throw new ApiError(messages.sessionExpired, 401)
    }
    const { message, details } = await extractErrorInfo(res)
    throw new ApiError(message, res.status, details)
  }

  async function odataGet<T>(entity: string, params?: Record<string, string>, opts?: ODataRequestOptions): Promise<T[]> {
    const u = new URL(odataUrl(entity))
    if (params) for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
    const res = await client.get(u.toString())
    await throwIfError(res, opts)
    const json = await res.json<{ value?: T[] }>()
    return json.value ?? (json as unknown as T[])
  }

  async function odataGetById<T>(entity: string, id: string, opts?: ODataRequestOptions): Promise<T> {
    const res = await client.get(`${odataUrl(entity)}(${id})`)
    await throwIfError(res, opts)
    return res.json<T>()
  }

  async function odataCount(entity: string, filter?: Record<string, unknown>, opts?: ODataRequestOptions): Promise<number> {
    const qs = buildQuery({ filter, top: 0, count: true })
    const res = await client.get(`${odataUrl(entity)}${qs}`)
    await throwIfError(res, opts)
    const json = await res.json<{ '@odata.count'?: number }>()
    return json['@odata.count'] ?? 0
  }

  /**
   * 쓰기 실패를 사용자에게 알린 뒤 그대로 다시 던진다.
   *
   * 🔴**이 서비스의 통지 축은 «쓰기 ↔ 읽기» 이지 «odata ↔ api» 가 아니다.** 조회
   * (`odataGet`·`odataGetById`·`odataCount`·`apiGet`·`fetchRaw`)는 어느 쪽도 통지하지
   * 않는다 — 화면이 비어 있는 것 자체가 신호이고, 목록 조회마다 토스트를 띄우면 읽을 수
   * 없다. 쓰기는 **결과가 화면에 안 보일 수 있으므로** 통지한다: 서버가 409 와 사유를
   * 돌려줘도 아무 일도 일어나지 않은 화면과 구별되지 않는다.
   *
   * ⚠**401 은 제외한다** — `onUnauthorized` 가 이미 안내하므로 토스트가 겹친다.
   *
   * ⚠성공 토스트는 **`odata*` 쓰기에만** 있다. `api*` 는 임의의 RPC(상태 전이·발행·업로드)를
   * 태우는 경로라 «저장되었습니다» 같은 문구를 우리가 지어낼 수 없다 — 실패 메시지는 서버가
   * 주므로 어느 엔드포인트에서나 뜻이 통하지만, 성공 문구는 그렇지 않다.
   */
  async function notifyingWrite<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) {
        notifyError?.(e instanceof Error ? e.message : messages.requestFailed)
      }
      throw e
    }
  }

  async function odataPostQuiet<T>(entity: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<T> {
    const res = await client.post(odataUrl(entity), normalizeBody(body))
    await throwIfError(res, opts)
    return res.json<T>()
  }

  async function odataPost<T>(entity: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<T> {
    return notifyingWrite(async () => {
      const result = await odataPostQuiet<T>(entity, body, opts)
      notifySuccess?.(messages.saved)
      return result
    })
  }

  async function odataPatchQuiet<T>(entity: string, id: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<void> {
    const res = await client.patch(`${odataUrl(entity)}(${id})`, normalizeBody(body))
    await throwIfError(res, opts)
  }

  async function odataPatch<T>(entity: string, id: string, body: Partial<T>, opts?: ODataRequestOptions): Promise<void> {
    return notifyingWrite(async () => {
      await odataPatchQuiet<T>(entity, id, body, opts)
      notifySuccess?.(messages.updated)
    })
  }

  async function odataDeleteQuiet(entity: string, id: string, opts?: ODataRequestOptions): Promise<void> {
    const res = await client.delete(`${odataUrl(entity)}(${id})`)
    await throwIfError(res, opts)
  }

  async function odataDelete(entity: string, id: string, opts?: ODataRequestOptions): Promise<void> {
    return notifyingWrite(async () => {
      await odataDeleteQuiet(entity, id, opts)
      notifySuccess?.(messages.deleted)
    })
  }

  async function apiGet<T>(path: string, opts?: ODataRequestOptions): Promise<T> {
    // 쿼리스트링이 붙은 path 지원(`endpoint?x=1`).
    const [p, ...q] = path.split('?')
    const url = q.length ? `${apiUrl(p)}?${q.join('?')}` : apiUrl(p)
    const res = await client.get(url)
    await throwIfError(res, opts)
    return parseJsonBody<T>(res)
  }

  async function apiPostQuiet<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T> {
    const res = await client.post(apiUrl(path), body ?? {})
    await throwIfError(res, opts)
    return parseJsonBody<T>(res)
  }

  async function apiPost<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T> {
    return notifyingWrite(() => apiPostQuiet<T>(path, body, opts))
  }

  async function apiPutQuiet<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T> {
    const res = await client.put(apiUrl(path), body ?? {})
    await throwIfError(res, opts)
    return parseJsonBody<T>(res)
  }

  async function apiPut<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T> {
    return notifyingWrite(() => apiPutQuiet<T>(path, body, opts))
  }

  async function apiPatchQuiet<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T> {
    const res = await client.patch(apiUrl(path), body ?? {})
    await throwIfError(res, opts)
    return parseJsonBody<T>(res)
  }

  async function apiPatch<T>(path: string, body?: unknown, opts?: ODataRequestOptions): Promise<T> {
    return notifyingWrite(() => apiPatchQuiet<T>(path, body, opts))
  }

  async function apiDeleteQuiet<T = void>(path: string, opts?: ODataRequestOptions): Promise<T> {
    const res = await client.delete(apiUrl(path))
    await throwIfError(res, opts)
    return parseJsonBody<T>(res)
  }

  async function apiDelete<T = void>(path: string, opts?: ODataRequestOptions): Promise<T> {
    return notifyingWrite(() => apiDeleteQuiet<T>(path, opts))
  }

  async function fetchRaw(url: string): Promise<HttpResponse> {
    return client.get(url)
  }

  return {
    odataUrl,
    apiUrl,
    odataGet,
    odataGetById,
    odataCount,
    odataPostQuiet,
    odataPost,
    odataPatchQuiet,
    odataPatch,
    odataDeleteQuiet,
    odataDelete,
    apiGet,
    apiPost,
    apiPostQuiet,
    apiPut,
    apiPutQuiet,
    apiPatch,
    apiPatchQuiet,
    apiDelete,
    apiDeleteQuiet,
    fetchRaw,
    sourceDefaults: {
      baseUrl,
      onUnauthorized: () => config.onUnauthorized?.(401),
    },
    ApiError,
  }
}
