import type { CSSProperties, ReactNode } from 'react'

/**
 * L2 폼 블록 — 제목이 붙은 필드 묶음.
 *
 * 🔴**제목에 `text-transform: uppercase` 와 `letter-spacing` 을 걸지 않는다**(0.7.0 에서 제거).
 *   ⑴ 한글에는 대문자가 없어 `uppercase` 가 **아무 효과가 없고**, 제목에 영문이 섞이면
 *      그것만 커져 오히려 어수선해진다.
 *   ⑵ 양수 `letter-spacing` 은 **한글 가독성을 떨어뜨린다** — 라틴 소문자 조판 관례를
 *      그대로 옮기면 안 되는 자리다.
 *   ⇒ 위계는 **크기·굵기·색** 세 신호로만 만든다(타입 스케일의 `label` 단).
 *   영문 전용 UI 에서 눈썹 텍스트 느낌이 필요하면 `titleStyle` 로 `--u-text-overline-*`
 *   단을 직접 지정한다 — 그 단은 영문·숫자 라벨을 전제하고 양수 자간을 갖는다.
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
    <div className={className} style={{ marginBottom: 'var(--u-space-xl, 20px)', ...style }}>
      <div
        style={{
          // 타입 스케일의 **label** 단 — 폼 라벨·표 머리행과 같은 층이다.
          // 종전에는 `11px` 리터럴이었고, 스케일 축이 생기기 전이라 값이 고립돼 있었다.
          fontSize: 'var(--u-text-label-size, 13px)',
          fontWeight: 'var(--u-text-label-weight, 600)' as unknown as number,
          lineHeight: 'var(--u-text-label-leading, 1.5)',
          letterSpacing: 'var(--u-text-label-tracking, 0)',
          // 역할 토큰을 읽는다 — 팔레트를 직접 읽으면 브랜드를 맞추려는 소비자가
          // "진짜 파랑"이 필요한 곳까지 함께 덮게 된다.
          // 한 단 어둡게 하는 것은 대비 때문이다: 흰 배경에서 --u-primary-color 는
          // 3.68:1 로 본문 크기 텍스트에 부족하고, 이 파생값은 4.85:1 로 WCAG AA 를 넘는다.
          color: 'color-mix(in srgb, var(--u-primary-color, #1E88E5) 85%, black)',
          paddingBottom: 'var(--u-space-xs, 6px)',
          borderBottom: '1px solid var(--u-border-color-weak, #EEEEEE)',
          marginBottom: 'var(--u-space-sm, 8px)',
          ...titleStyle,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--u-space-sm, 8px)' }}>
        {children}
      </div>
    </div>
  )
}
