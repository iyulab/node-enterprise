/**
 * `bindSource` — 프레임워크 중립 데이터 소스를 «뷰 어휘» 를 말하는 요소에 묶는다.
 *
 * 두 표(`flex-table` · `u-rich-table`) · 카드 뷰(`u-data-view`) · 페이저(`u-pagination`)가 같은 이름으로 상태를 받고
 * 같은 모양으로 이벤트를 낸다(루트 `table-vocab-check` 가 그 어휘를 잰다). 그러므로 «목록 화면» 의 배선은 뷰마다 다르지
 * 않다 — 소스 상태를 뷰의 속성에 쓰고, 뷰의 이벤트를 소스 조작으로 돌린다. 그 한 가지를 여기서 한다.
 *
 * 소스는 구조로만 안다(`ViewSource`) — `@iyulab/flex-table/odata` 의 `createODataSource`·`createArraySource` 가 그 모양이지만
 * 이 패키지는 flex-table 에 의존하지 않는다. 뷰도 구조로만 안다 — 요소가 **가진** 속성만 쓰고(카드 뷰에는 정렬이 없다),
 * 이벤트를 내지 않는 요소에는 리스너가 그냥 아무 일도 하지 않는다.
 */

/** 정렬 기준 — 두 표와 소스가 주고받는 모양. */
export interface ViewSortCriterion {
  key: string;
  direction: 'asc' | 'desc';
}

/** 뷰에 쓰는 소스 상태 — `createODataSource(...).getState()` 와 같은 모양(구조적). */
export interface ViewSourceState<T = unknown> {
  data: T[];
  totalCount: number;
  loading: boolean;
  error: { message: string } | null;
  page: number;
  pageSize: number;
  sortCriteria: ViewSortCriterion[];
  search: string;
}

/** `bindSource` 가 읽고 조작하는 소스 — flex-table 의 두 소스가 이 모양이다. */
export interface ViewSource<T = unknown> {
  getState(): ViewSourceState<T>;
  subscribe(listener: () => void): () => void;
  setPage(page: number): void;
  setPageSize(size: number): void;
  setSort(criteria: ViewSortCriterion[]): void;
  setSearch(term: string): void;
}

/**
 * 뷰에 쓰는 속성 — 뷰 프로토콜의 정본(루트 `table-vocab-check` 가 같은 목록으로 두 표를 잰다). 요소가 그 속성을 갖고 쓸 수
 * 있을 때만 쓴다.
 */
export const VIEW_PROPERTIES = ['data', 'totalCount', 'loading', 'error', 'sortCriteria', 'page', 'pageSize'] as const;

/** 요소에 `key` 가 있고 쓸 수 있는가 — 데이터 속성(쓰기 가능)이거나 setter 를 가진 접근자. 프로토타입 사슬을 따라간다. */
function writable(target: object, key: string): boolean {
  for (let o: object | null = target; o; o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, key);
    if (d) return 'value' in d ? d.writable === true : typeof d.set === 'function';
  }
  return false;
}

/**
 * `source` 를 `view` 에 묶는다. 돌려주는 함수가 묶음을 푼다(구독 해지 · 리스너 제거).
 *
 * - **쓴다**: `data` · `totalCount` · `loading` · `error` · `sortCriteria` · `page` · `pageSize` — 요소가 가진 것만, 소스 값이
 *   바뀐 때만. 그리고 요소에 `dataMode` 가 있으면 `'server'` 로 — 질의(정렬 · 검색 · 페이지)는 소스가 하므로 뷰가 받은 한
 *   페이지를 다시 거르거나 나누면 안 된다.
 * - **듣는다**: `sort-change {criteria}` → `setSort` · `page-change {page, pageSize?}` → `setPage`(크기가 바뀌었으면
 *   `setPageSize` — 첫 장으로) · `search {query}` → `setSearch`(목록 검색 칸 — `u-input type="search"` 가 검색을 확정할 때 내는 모양).
 *
 * 선택(`selection-change`)과 행 열기(`row-activate`)는 묶지 않는다 — 소스의 것이 아니라 화면의 것이라, 뷰에서 직접 듣는다.
 *
 * ```ts
 * const orders = createODataSource('/api/orders', { pageSize: 20 });
 * const unbind = [bindSource(orders, table), bindSource(orders, pager), bindSource(orders, searchBox)];
 * ```
 */
export function bindSource<T>(source: ViewSource<T>, view: EventTarget): () => void {
  const target = view as unknown as Record<string, unknown>;
  const last = new Map<string, unknown>();

  if (writable(view, 'dataMode') && target.dataMode !== 'server') target.dataMode = 'server';

  const write = () => {
    const state = source.getState() as unknown as Record<string, unknown>;
    for (const key of VIEW_PROPERTIES) {
      if (!writable(view, key)) continue;
      // 마지막으로 쓴 값과 비교한다 — 뷰의 getter 는 복사본을 돌려줄 수 있어(flex-table `sortCriteria`) 뷰 값과 비교하면 매번 쓴다.
      if (last.has(key) && last.get(key) === state[key]) continue;
      last.set(key, state[key]);
      target[key] = state[key];
    }
  };

  const onSort = (e: Event) => {
    const criteria = (e as CustomEvent<{ criteria?: unknown }>).detail?.criteria;
    if (Array.isArray(criteria)) source.setSort(criteria as ViewSortCriterion[]);
  };
  const onPage = (e: Event) => {
    const detail = (e as CustomEvent<{ page?: unknown; pageSize?: unknown }>).detail;
    if (!detail) return;
    const state = source.getState();
    if (typeof detail.pageSize === 'number' && detail.pageSize !== state.pageSize) source.setPageSize(detail.pageSize);
    else if (typeof detail.page === 'number' && detail.page !== state.page) source.setPage(detail.page);
  };
  const onSearch = (e: Event) => {
    const query = (e as CustomEvent<{ query?: unknown }>).detail?.query;
    if (typeof query === 'string') source.setSearch(query);
  };

  view.addEventListener('sort-change', onSort);
  view.addEventListener('page-change', onPage);
  view.addEventListener('search', onSearch);
  const unsubscribe = source.subscribe(write);
  write();

  return () => {
    unsubscribe();
    view.removeEventListener('sort-change', onSort);
    view.removeEventListener('page-change', onPage);
    view.removeEventListener('search', onSearch);
  };
}

/** Lit `ReactiveControllerHost` 의 필요한 부분 — 구조적이라 이 패키지가 `lit` 에 의존하지 않는다. */
export interface SourceBindingHost {
  addController(controller: { hostConnected?(): void; hostDisconnected?(): void; hostUpdated?(): void }): void;
}

/**
 * Lit 어댑터 — 호스트가 그린 요소에 소스를 묶는다. 요소는 렌더 뒤에 생기므로 `targets` 를 함수로 받아 갱신마다 다시 찾고,
 * 새로 생긴 요소는 묶고 사라진 요소는 푼다. 호스트가 떨어지면 전부 푼다.
 *
 * ```ts
 * class OrdersPage extends LitElement {
 *   private orders = createODataSource('/api/orders', { pageSize: 20 });
 *   private binding = new SourceBinding(this, this.orders, () => this.renderRoot.querySelectorAll('flex-table, u-pagination'));
 *   render() { return html`<flex-table .columns=${cols}></flex-table><u-pagination></u-pagination>`; }
 * }
 * ```
 */
export class SourceBinding<T = unknown> {
  private bound = new Map<EventTarget, () => void>();
  private connected = false;

  constructor(
    host: SourceBindingHost,
    readonly source: ViewSource<T>,
    private readonly targets: () => Iterable<EventTarget | null | undefined>,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.connected = true;
    this.sync();
  }

  hostUpdated(): void {
    if (this.connected) this.sync();
  }

  hostDisconnected(): void {
    this.connected = false;
    for (const unbind of this.bound.values()) unbind();
    this.bound.clear();
  }

  private sync(): void {
    const now = new Set<EventTarget>();
    for (const t of this.targets()) if (t) now.add(t);
    for (const [t, unbind] of this.bound) {
      if (!now.has(t)) { unbind(); this.bound.delete(t); }
    }
    for (const t of now) if (!this.bound.has(t)) this.bound.set(t, bindSource(this.source, t));
  }
}
