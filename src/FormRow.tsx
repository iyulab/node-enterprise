import type { CSSProperties, ReactNode } from 'react'

/**
 * L2 폼 행 — 기본 2열, `full` 이면 1열.
 *
 * 오버라이드 계약(docs/lob-layers.md §2)에 따라 `className`·`style` 을 받아 병합한다.
 * `columns` 는 2열 고정이 맞지 않는 소비자가 **컴포넌트를 복제하지 않고** 조정하는 경로다
 * — 복제가 시작되면 이 계층은 쓰기 전보다 나쁜 상태를 만든다.
 */
export function FormRow({
  children,
  full,
  columns = 2,
  className,
  style,
}: {
  children: ReactNode
  /** 한 행 전체를 한 칸으로 쓴다. `columns` 보다 우선한다. */
  full?: boolean
  /** 열 수. 기본 2. */
  columns?: number
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
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '8px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
