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

  /* 검색 조건과 동작 줄은 보통 여럿이다(검색 칸 + 상태 고르기 · 단추 몇 개) — 한 줄에 같은 간격으로 놓고, 좁으면 접는다.
     아래 끝 정렬: 라벨이 있는 칸과 없는 단추가 같은 선에 선다. */
  [part~='filters'],
  [part~='toolbar'] {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--list-page-gap, var(--u-space-md, 12px));
  }

  [part~='view'] {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
`;
