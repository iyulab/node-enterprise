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
  /* 칸(입력 상자를 가진 컨트롤)은 아래 끝에 선다. 그 밖의 항목 — 단추 · 체크박스 토글 · 짧은 글자 — 은 한 글자 기준선 묶음이다:
     묶음의 가장 깊은 항목(단추)이 아래 끝에 닿고 나머지는 그 단추의 글자 줄에 선다. 높이 리터럴 없이 밀도를 따른다.
     ⚠칸 전부를 기준선 묶음에 넣지 않는다 — 입력과 단추는 글자 아래의 깊이가 달라 글자를 맞추면 아래 끝이 어긋난다(실측 2.8px). */
  [part~='filters'] ::slotted(:not(u-input, u-select, u-textarea, u-date-picker, u-date-range-picker, u-file-input, u-record-picker, u-field, [label])) {
    align-self: last baseline;
  }

  [part~='view'] {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  /* 적용된 조건 — 칩 줄. 필터보다 촘촘한 간격으로 감긴다(같은 줄의 칩은 한 묶음으로 읽힌다). */
  [part~='applied'] {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--u-space-xs, 6px);
  }

  /* 면 — plain 에서는 상자를 만들지 않는다(영역이 호스트의 간격으로 그대로 쌓인다). */
  [part~='surface'] {
    display: contents;
  }

  /* card — 툴바 · 뷰 · 페이저가 한 면에: 테두리 하나, 영역 사이는 간격이 아니라 선이다.
     숨은 영역은 상자째 빠지므로 선이 겹치지 않는다(첫 영역의 위 · 마지막 영역의 아래에는 선이 없다). */
  :host([appearance='card']) [part~='surface'] {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 1px solid var(--u-border-color, #E0E0E0);
    border-radius: var(--u-radius-xl, 8px);
    background-color: var(--u-panel-bg-color, #FFFFFF);
    overflow: hidden;
  }
  /* 툴바는 꽉 찬다 — 그 자리의 내용(u-action-bar · 툴바 줄)은 자기 여백과 면(선택 상태의 틴트)을 갖는다. 영역은 선만 긋는다. */
  :host([appearance='card']) [part~='toolbar'] {
    border-bottom: 1px solid var(--u-border-color, #E0E0E0);
  }
  :host([appearance='card']) [part~='pager'] {
    padding: var(--u-space-sm, 8px) var(--u-space-md, 12px);
    border-top: 1px solid var(--u-border-color, #E0E0E0);
  }
  :host([appearance='card']) [part~='status'] {
    padding: var(--u-space-lg, 16px);
  }
  /* 자기 테두리를 그리는 뷰(flex-table · u-rich-table)는 면 안에서 그 테두리를 걷는다 — 이중 테두리를 막는다.
     두 표는 상자를 섀도 안에 그리므로(문서 리셋에 지지 않게) 호스트의 border 로는 닿지 않는다 — 각자 읽는 외곽선 속성으로. */
  :host([appearance='card']) ::slotted([slot='view']) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    --ft-outline: none;
    --dc-table-outline: none;
    --dc-table-radius: 0;
  }
`;
