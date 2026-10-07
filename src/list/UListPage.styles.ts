import { css } from 'lit';

export const styles = css`
  /* 영역은 세로로 쌓이고 간격은 --list-page-gap 하나다(헌장 2-1 — 정규 경로는 커스텀 속성).
     채워지지 않은 영역은 상자째 빠진다 — 빈 영역이 간격을 두 번 만들지 않게. */
  :host {
    display: flex;
    flex-direction: column;
    gap: var(--list-page-gap, var(--u-space-md, 12px));
    min-width: 0;
  }

  :host([hidden]) {
    display: none;
  }

  [part~='region'][hidden] {
    display: none;
  }

  [part~='view'] {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
`;
