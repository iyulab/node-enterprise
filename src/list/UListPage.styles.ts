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

  /* 검색 조건은 보통 여럿이다(검색 칸 + 상태 고르기) — 한 줄에 같은 간격으로 놓고, 좁으면 접는다.
     아래 끝 정렬: 라벨이 있는 칸과 없는 단추가 같은 선에 선다.
     ⚠toolbar 는 블록으로 둔다 — 그 자리의 정석은 폭 전체를 쓰는 동작 줄(u-action-bar)이고, 그것은 inline-size 컨테이너라
     줄 배치의 항목이 되면 폭이 0 으로 접힌다(실측: React 레퍼런스 앱의 목록). */
  [part~='filters'] {
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
