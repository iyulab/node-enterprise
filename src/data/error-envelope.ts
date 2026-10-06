/**
 * 실패 응답 본문 읽기 — OData v4 오류 봉투(`error.message`·`error.code`·`error.details`)와 커스텀 REST
 * 최상위 관례(`message`·`Message`·`code`)를 한 규칙으로 읽는다. 데이터 서비스와 인증 클라이언트가 같은
 * 본문에서 같은 `ApiError` 필드를 얻게 하려는 내부 모듈이다(패키지 엔트리로 내보내지 않는다).
 */
import type { ApiErrorDetail } from './ODataService'

export interface ErrorEnvelope {
  /** 서버가 준 문장 — 봉투 `error.message` → 최상위 `message` → `Message` 순. */
  rawMessage?: string
  /** 거절 코드 — 봉투 `error.code` → 최상위 `code` 순, 빈 문자열은 «없음». */
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
  const rawVal = errorObj?.message ?? b.message ?? b.Message
  const rawCode = errorObj?.code ?? b.code
  return {
    rawMessage: typeof rawVal === 'string' ? rawVal : undefined,
    code: typeof rawCode === 'string' && rawCode ? rawCode : undefined,
    details: extractErrorDetails(errorObj?.details),
  }
}
