import type { CSSProperties, ReactNode } from 'react'

/**
 * L2 폼 행 — 기본 2열, `full` 이면 1열.
 *
 * 오버라이드 계약(docs/lob-layers.md §2)에 따라 `className`·`style` 을 받아 병합한다.
 * `columns` 는 2열 고정이 맞지 않는 소비자가 **컴포넌트를 복제하지 않고** 조정하는 경로다
 * — 복제가 시작되면 이 계층은 쓰기 전보다 나쁜 상태를 만든다.
 *
 * 🔴**트랙은 `minmax(0, 1fr)` 이지 `1fr` 이 아니다 — 순수 `1fr` 은 «균등» 을 약속하고**
 * **지키지 않는다.** 그리드 아이템의 기본 `min-width: auto` 는 내용의 min-content 아래로
 * 줄어들기를 거부하므로, 한 칸에 긴 내용이 들어오면 그 칸만 부풀고 나머지가 찌그러진다.
 * 실측(400px 컨테이너 · 한 칸에 긴 불가분 문자열): 2열이 **425/8**, 3열이 **425/8/8** 이었고
 * 행 자체가 컨테이너를 넘쳤다. `minmax(0, 1fr)` 은 트랙의 최소를 0 으로 만들어 **자식을**
 * **건드리지 않고** 이를 고친다 — 같은 실측에서 **196/196** · **128/128/128**.
 *
 * ⚠**긴 불가분 내용 자체의 넘침은 별개 축이고 이 컴포넌트의 몫이 아니다.** 칸이 균등해져도
 * 그 안의 긴 문자열은 여전히 자기 칸을 넘는다 — 그것은 셀의 `overflow-wrap` 이 답이다
 * (`@iyulab/components` 의 엘리먼트는 이미 그 값을 갖는다). 같은 실측에서 `overflow-wrap` 을
 * 주면 행의 넘침이 0 이 됐다.
 *
 * 🔴**열 수는 상한이고, 실제 열 수는 컨테이너 폭이 정한다**(0.38.0). 고정 `repeat(n, …)` 은 폰 폭에서
 * 칸을 컨트롤이 읽히지 않는 폭까지 줄였다 — 실측(390px · 2열 · 일시 입력 둘): 칸 143px, 입력 69px 에
 * 값 140px 이 잘렸다. 트랙은 «최대 `columns` 열, 한 칸은 최소 `minColumnWidth`» 를 한 식으로 말한다:
 * `repeat(auto-fill, minmax(max(min(100%, 최소), (100% − 사이 간격 합) / columns), 1fr))`. 넓으면 정확히
 * `columns` 칸(종전과 같은 폭), 좁으면 담기는 만큼, 끝내 한 열. `auto-fill` 이라 칸이 모자란 행도
 * 다른 행과 같은 격자에 선다. 트랙 최소가 확정 길이라 `1fr` 의 내용 부풀기(아래)도 생기지 않는다.
 *
 * 계약은 `tests/form-layout-contract.test.ts` 가 고정한다 — 다만 그 파일은 **«선언» 을 재지**
 * **«배치» 를 재지 않는다**(이 패키지엔 레이아웃을 계산하는 테스트 자리가 없다). 위 수치는
 * 형제 패키지의 브라우저 프로젝트를 계측기로 빌린 일회성 탐침으로 쟀다.
 */
const GAP = 'var(--u-space-sm, 8px)'
const DEFAULT_MIN_COLUMN_WIDTH = '14rem'

function columnTracks(columns: number, minColumnWidth: number | string): string {
  const min = typeof minColumnWidth === 'number' ? `${minColumnWidth}px` : minColumnWidth
  const share = columns > 1 ? `calc((100% - ${columns - 1} * ${GAP}) / ${columns})` : '100%'
  return `repeat(auto-fill, minmax(max(min(100%, ${min}), ${share}), 1fr))`
}

export function FormRow({
  children,
  full,
  columns = 2,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  className,
  style,
}: {
  children: ReactNode
  /** 한 행 전체를 한 칸으로 쓴다. `columns` 보다 우선한다. */
  full?: boolean
  /** 열 수의 상한. 기본 2. 칸이 `minColumnWidth` 보다 좁아지면 그보다 적은 열로 접힌다. */
  columns?: number
  /**
   * 한 칸의 최소 폭 — 컨테이너가 `columns` 칸을 이 폭으로 담지 못하면 열이 줄어든다(끝내 한 열).
   * 숫자는 px. 기본 `'14rem'` — 날짜·일시 입력이 값을 다 보이는 폭이다. `0` 이면 늘 `columns` 열.
   */
  minColumnWidth?: number | string
  className?: string
  style?: CSSProperties
}) {
  if (full) {
    return (
      <div className={className} style={{ width: '100%', ...style }}>
        {children}
      </div>
    )
  }
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: columnTracks(columns, minColumnWidth),
        gap: GAP,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
