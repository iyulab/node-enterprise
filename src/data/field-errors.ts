import { ApiError, type ApiErrorDetail } from './ODataService'

/**
 * 서버 거절의 필드 상세를 폼 컨트롤에 내려놓는다 — `ApiError.details[]` 의 `target` 이 컨트롤의 `name` 이다.
 *
 * 컨트롤은 «`setCustomValidity()` 를 가진 요소» 면 된다 — 네이티브 `<input>`·`<select>`·`<textarea>` 와
 * `@iyulab/components` 의 폼 컨트롤. 이 모듈은 components 를 import 하지 않는다(덕 타이핑).
 */

/** 서버 메시지를 받을 수 있는 컨트롤 — 네이티브 폼 요소와 폼 연동 커스텀 요소. */
interface ValidatableControl extends HTMLElement {
  setCustomValidity(message: string): void
  /** `@iyulab/components` 컨트롤 — 있으면 불러 오류를 화면에 보인다. */
  validate?(report?: boolean): boolean
}

/** 컨트롤에 내려간 항목 하나. */
export interface AppliedFieldError {
  detail: ApiErrorDetail
  control: HTMLElement
  /** 컨트롤에 실린 문장(`options.message` 를 거친 것). */
  message: string
}

/** `applyFieldErrors` 의 결과 — 요약을 그리는 재료. */
export interface FieldErrorsResult {
  /** 컨트롤에 내려간 항목 — 요약에 칸으로 가는 링크로 싣는다(`control.focus()`). 문서 순서. */
  applied: AppliedFieldError[]
  /**
   * 폼 단위로 보여야 하는 항목 — `target` 이 없거나, 그 이름의 컨트롤이 `root` 안에 없다(서버 쪽 속성 경로
   * `Lines(1)/Qty` 처럼 화면에 같은 이름이 없는 것 포함). 요약에 링크 없는 줄로 싣는다.
   */
  formLevel: ApiErrorDetail[]
}

export interface ApplyFieldErrorsOptions {
  /**
   * 보일 문장 — 기본은 `detail.message`(서버가 사람에게 쓴 문장). `detail.code` 로 지역화할 때 쓴다
   * (예: 값을 그 타입으로 읽지 못한 `Unconvertible` 만 앱의 언어로).
   */
  message?: (detail: ApiErrorDetail) => string
}

/** 이 모듈이 메시지를 얹은 컨트롤 → 그것을 걷을 리스너의 중단 신호. 다시 적용하거나 사용자가 고치면 걷는다. */
const pending = new WeakMap<HTMLElement, AbortController>()

const isValidatable = (el: Element): el is ValidatableControl =>
  typeof (el as Partial<ValidatableControl>).setCustomValidity === 'function'

const nameOf = (el: Element): string | null =>
  el.getAttribute('name') ?? ((el as { name?: unknown }).name as string | undefined) ?? null

/** 컨트롤의 검증 상태를 다시 계산해 화면에 반영한다 — components 컨트롤만(네이티브는 `:invalid` 가 따라간다). */
const refresh = (control: ValidatableControl): void => {
  control.validate?.()
}

function clear(control: ValidatableControl): void {
  pending.get(control)?.abort()
  pending.delete(control)
  control.setCustomValidity('')
  refresh(control)
}

/**
 * `root` 안에서 이 모듈이 얹은 서버 메시지를 전부 걷는다 — 다시 저장하기 전 상태로. `applyFieldErrors` 는 적용
 * 전에 이것을 먼저 하므로 보통은 부를 일이 없다(폼을 닫거나 처음 값으로 되돌릴 때).
 */
export function clearFieldErrors(root: ParentNode): void {
  for (const el of root.querySelectorAll('*')) {
    if (pending.has(el as HTMLElement) && isValidatable(el)) clear(el)
  }
}

/**
 * 서버가 거절한 필드마다 그 컨트롤에 메시지를 얹고 오류를 보인다 — 저장 실패가 «어느 칸» 의 일인지 칸 옆에 말한다.
 *
 * - `target` 과 같은 `name` 을 가진 컨트롤(`root` 안, 문서 순서로 첫 것)에 `setCustomValidity(message)` 하고,
 *   `@iyulab/components` 컨트롤이면 `validate()` 로 오류를 보인다. 같은 `target` 이 여럿이면 문장을 잇는다.
 * - 사용자가 그 칸을 고치면(`input`·`change`) 그 메시지를 걷는다 — 고친 값을 다시 보내는 것을 막지 않는다.
 * - 다시 부르면 앞서 얹은 메시지를 먼저 걷는다.
 * - 컨트롤로 못 내려간 항목은 `formLevel` 로 돌려준다 — 요약에 싣는다.
 *
 * ```ts
 * try { await svc.odataPatch('Orders', id, draft) }
 * catch (e) {
 *   const { applied, formLevel } = applyFieldErrors(form, e)
 *   showSummary(applied, formLevel)   // 칸 링크 + 폼 단위 줄 — 그리고 요약으로 포커스
 * }
 * ```
 *
 * @param source `ApiError`(그 `details`) 또는 상세 배열. 그 밖의 값(네트워크 오류 등)은 빈 결과다.
 */
export function applyFieldErrors(
  root: ParentNode,
  source: unknown,
  options: ApplyFieldErrorsOptions = {},
): FieldErrorsResult {
  clearFieldErrors(root)
  const details: readonly ApiErrorDetail[] =
    source instanceof ApiError ? source.details ?? [] : Array.isArray(source) ? source : []
  const textOf = options.message ?? ((d: ApiErrorDetail) => d.message)

  const controls = Array.from(root.querySelectorAll('*')).filter(isValidatable)
  const byControl = new Map<ValidatableControl, { detail: ApiErrorDetail, message: string }[]>()
  const formLevel: ApiErrorDetail[] = []

  for (const detail of details) {
    const control = detail.target ? controls.find((c) => nameOf(c) === detail.target) : undefined
    if (!control) { formLevel.push(detail); continue }
    const list = byControl.get(control) ?? []
    list.push({ detail, message: textOf(detail) })
    byControl.set(control, list)
  }

  const applied: AppliedFieldError[] = []
  for (const control of controls) {
    const items = byControl.get(control)
    if (!items) continue
    control.setCustomValidity(items.map((i) => i.message).join(' '))
    refresh(control)
    const abort = new AbortController()
    const onEdit = () => clear(control)
    control.addEventListener('input', onEdit, { signal: abort.signal })
    control.addEventListener('change', onEdit, { signal: abort.signal })
    pending.set(control, abort)
    for (const { detail, message } of items) applied.push({ detail, control, message })
  }

  return { applied, formLevel }
}
