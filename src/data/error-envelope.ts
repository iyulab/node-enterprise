/**
 * 실패 응답 본문 읽기 — OData v4 오류 봉투(`error.message`·`error.code`·`error.details`)와 커스텀 REST
 * 최상위 관례(`message`·`Message`·`code`·`Code`), RFC 9457 problem details(`detail` → `title`)를 한 규칙으로 읽는다. 데이터 서비스와 인증 클라이언트가 같은
 * 본문에서 같은 `ApiError` 필드를 얻게 하려는 내부 모듈이다(패키지 엔트리로 내보내지 않는다).
 */
import type { ApiErrorDetail, ServerMessages } from './ODataService'

export interface ErrorEnvelope {
  /** 서버가 준 문장 — 봉투 `error.message` → 최상위 `message` → `Message` → problem details `detail` → `title` 순. */
  rawMessage?: string
  /** 거절 코드 — 봉투 `error.code` → 최상위 `code` → `Code` 순, 빈 문자열은 «없음». */
  code?: string
  /** 규격 형태(`code`/`message` 문자열)를 갖춘 `error.details` 항목 — 하나도 없으면 undefined. */
  details?: ApiErrorDetail[]
}

/**
 * `error.details` 를 검증해 추출한다 — 검증 없이 캐스팅하면 타입만 맞고 런타임에 호출부가 깨진다.
 * 쓸 수 있는 항목이 없으면 undefined 로 정규화한다(빈 배열은 호출부의 `if (e.details)` 를 참으로 만든다).
 */
function extractErrorDetails(raw: unknown): ApiErrorDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const details = raw.filter((d): d is ApiErrorDetail => {
    if (typeof d !== 'object' || d === null) return false
    const rec = d as Record<string, unknown>
    return typeof rec.code === 'string' && typeof rec.message === 'string'
  })
  return details.length > 0 ? details : undefined
}

/** 이미 파싱된 실패 본문에서 메시지·코드·상세를 읽는다. 객체가 아니면 빈 결과다. */
export function readErrorEnvelope(body: unknown): ErrorEnvelope {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>
  const errorObj = b.error && typeof b.error === 'object' ? (b.error as Record<string, unknown>) : undefined
  // problem details 는 이 일의 문장(`detail`)이 종류의 이름(`title`)보다 구체적이다.
  const rawVal = [errorObj?.message, b.message, b.Message, b.detail, b.title].find(v => typeof v === 'string' && v)
  const rawCode = errorObj?.code ?? b.code ?? b.Code
  return {
    rawMessage: typeof rawVal === 'string' ? rawVal : undefined,
    code: typeof rawCode === 'string' && rawCode ? rawCode : undefined,
    details: extractErrorDetails(errorObj?.details),
  }
}

/** 상태 코드의 표준 이름(공백 없이) — 거절 코드가 상태를 되풀이할 뿐인지 가르는 데만 쓴다. */
const STATUS_NAMES: Record<number, string> = {
  400: 'badrequest', 401: 'unauthorized', 403: 'forbidden', 404: 'notfound', 405: 'methodnotallowed',
  406: 'notacceptable', 408: 'requesttimeout', 409: 'conflict', 410: 'gone', 412: 'preconditionfailed',
  413: 'payloadtoolarge', 415: 'unsupportedmediatype', 422: 'unprocessableentity', 428: 'preconditionrequired',
  429: 'toomanyrequests', 500: 'internalservererror', 501: 'notimplemented', 502: 'badgateway',
  503: 'serviceunavailable', 504: 'gatewaytimeout',
}

/**
 * 거절 코드가 HTTP 상태의 이름을 되풀이할 뿐인가(`Forbidden` · `NotFound` · `Internal_Server_Error` …) — 그러면 그 문장은
 * 전송 계층의 상투어라 사용자에게 보일 말이 아니다(로캘 문구를 쓴다). 도메인 코드(`KeyNotFound` · `PasswordExpired`)의
 * 문장은 그대로 보인다. 서버가 본문 없던 실패(401·403·404·405)와 처리 못 한 예외(500)에도 오류 봉투를 싣기 시작하면서
 * 상태 이름 코드와 영어 문장이 로캘 문구를 밀어냈다.
 */
export function isStatusCode(code: string | undefined, status: number): boolean {
  const name = STATUS_NAMES[status]
  return !!code && !!name && code.replace(/[\s_-]/g, '').toLowerCase() === name
}

/** 실패 응답 본문 텍스트 → JSON 이면 파싱한 값, 아니면 텍스트 그대로, 비었으면 undefined(`ApiError.body` 의 규칙). */
export function parseBody(text: string): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** 서버 문장을 보일 것인가 — 데이터 서비스와 인증 클라이언트가 같은 규칙을 쓴다. */
export function showsServerMessage(
  rawMessage: string | undefined,
  code: string | undefined,
  status: number,
  policy: ServerMessages = 'always',
): rawMessage is string {
  if (!rawMessage || rawMessage.length > 200) return false
  return policy === 'always' || !isStatusCode(code, status)
}
