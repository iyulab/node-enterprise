import type { CSSProperties, ReactNode } from 'react'

/**
 * L2 폼 블록 — 제목이 붙은 필드 묶음.
 *
 * 오버라이드 계약(docs/lob-layers.md §2): 구조는 두고 **children 치환 + prop** 으로 바꾼다.
 * ⚠기본 스타일은 병합 가능한 형태로만 둔다 — 호출자의 `style` 이 뒤에 오므로 필요한
 * 항목만 골라 덮을 수 있다. 인라인으로 굳혀 두면 소비자 CSS 가 이길 수 없어(`!important`
 * 외) 계약이 원천적으로 무효가 된다.
 */
export function FormSection({
  title,
  children,
  className,
  style,
  titleStyle,
}: {
  title: ReactNode
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** 제목 줄만 따로 조정할 때. 블록을 통째로 갈아엎지 않기 위한 훅이다. */
  titleStyle?: CSSProperties
}) {
  return (
    <div className={className} style={{ marginBottom: '20px', ...style }}>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          // 역할 토큰을 읽는다 — 팔레트를 직접 읽으면 브랜드를 맞추려는 소비자가
          // "진짜 파랑"이 필요한 곳까지 함께 덮게 된다.
          // 한 단 어둡게 하는 것은 대비 때문이다: 흰 배경에서 --u-primary-color 는
          // 3.68:1 로 11px 텍스트에 부족하고, 이 파생값은 4.85:1 로 WCAG AA 를 넘는다.
          color: 'color-mix(in srgb, var(--u-primary-color, #1E88E5) 85%, black)',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--u-border-color-weak, #EEEEEE)',
          marginBottom: '10px',
          ...titleStyle,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </div>
  )
}
