import { html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { UElement } from '@iyulab/components/dist/components/UElement.js';
import { bindSource, type ViewSource } from './bindSource.js';
import { styles } from './UListPage.styles.js';

/** 목록이 지금 보이는 상태 — 호스트의 `status` 속성으로 반영된다. */
export type ListPageStatus = 'loading' | 'error' | 'empty' | 'ready';
/** 외형 — `plain`(기본: 영역이 간격만 두고 쌓인다) · `card`(툴바 · 뷰 · 페이저를 한 면에 — 테두리 하나, 영역 사이 선). */
export type ListPageAppearance = 'plain' | 'card';

/** 소스가 묶이는 영역 — 뷰와 페이저. 나머지 영역(머리 · 필터 · 툴바)은 소스를 받지 않는다. */
const BOUND_SLOTS = ['view', 'pager'] as const;
/**
 * 같은 이름 `search {query}` 를 «목록 검색» 이 아닌 뜻으로 내는 요소 — 그 이벤트는 자기 선택지를 거르는 질의다
 * (`u-select searchable` 은 글자를 칠 때마다 낸다). 필터 영역에 놓여도 목록 검색어가 되지 않는다.
 */
const OPTION_QUERY_EMITTERS = new Set(['u-select']);
/** 모든 영역 — 채워지지 않은 영역은 상자째 빠진다. */
const SLOTS = ['header', 'filters', 'applied', 'toolbar', 'view', 'pager', 'empty', 'error'] as const;
type SlotName = typeof SLOTS[number];

/**
 * 목록 화면의 골격 — 머리 · 필터 · 툴바 · 뷰 · 페이저 · 빈/오류 영역을 슬롯으로 두고, 프레임워크 중립 소스를 뷰와 페이저에
 * 묶는다(`bindSource`).
 *
 * 골격은 **표를 그리지 않는다.** 무엇을 그릴지는 `slot="view"` 에 놓인 요소가 정한다 — «뷰 어휘»(`data` · `loading` · `error` ·
 * `sortCriteria` · `page` · `pageSize` · `totalCount` 를 받고 `sort-change` · `page-change` 를 내는 것)를 말하는 요소면 무엇이든
 * (flex-table · u-rich-table · u-data-view). 페이저(`slot="pager"`, 예: `u-pagination`)도 같은 소스에 묶인다.
 *
 * - **뷰 전환**: 뷰 요소마다 `view-name` 을 주고 골격의 `view` 에 보일 이름을 준다 — 나머지 뷰에는 골격이 `hidden` 을 건다
 *   (뷰 요소의 `hidden` 은 골격이 소유한다). `view` 가 없으면 첫 뷰가 보인다. 숨은 뷰도 소스에 묶인 채라 전환이 즉시다.
 * - **검색**: 머리 · 필터 · 툴바 영역의 요소가 낸 `search {query}` 를 소스의 `setSearch` 로 돌린다. 검색 가능한 선택
 *   (`u-select searchable`)이 선택지를 거르며 내는 같은 이름의 이벤트는 목록 검색어가 아니다 — 필터에 그대로 둔다.
 * - **빈·오류**: 소스가 오류면 `slot="error"`, 결과가 비면 `slot="empty"` 를 뷰와 페이저 대신 보인다. 그 슬롯이 비어 있으면
 *   뷰가 자기 표시(두 표가 이미 그리는 오류·빈 문구)를 그대로 보인다.
 * - **상태**: 호스트 `status` 속성(`loading` · `error` · `empty` · `ready`) — 소비자 CSS 와 시험이 읽는다.
 * - **적용된 조건**: `slot="applied"` 에 지금 걸린 조건(예: `u-chip removable`)을 둔다 — 필터 아래 한 줄로 감기고,
 *   마지막 칩이 빠지면 영역째 접힌다. 칩을 지웠을 때 조건을 푸는 것은 화면의 몫이다(칩의 `remove` 를 듣는다).
 * - **카드**: `appearance="card"` 면 툴바 · 뷰(또는 빈·오류) · 페이저가 한 면에 놓인다 — 테두리 하나, 영역 사이 선.
 *   뷰가 자기 테두리를 그리면(`flex-table` · `u-rich-table`) 면 안에서는 그 테두리를 걷는다.
 *
 * - **선택 상태**: 보이는 뷰가 `selection-change {selectedIds}` 로 하나라도 골랐다고 말하는 동안 `:state(selected)` 가 켜진다 —
 *   카드 툴바를 일괄 동작 막대로 칠하는 손잡이다(`u-list-page:state(selected)::part(toolbar)`). 숨은 뷰의 선택은 세지 않는다.
 *
 * 선택과 행 열기는 묶지 않는다 — 소스의 것이 아니라 화면의 것이라, 뷰에서 직접 듣는다(골격은 선택을 읽어 상태로만 낸다).
 * 레이아웃이 전혀 다르면 이 요소 없이 `bindSource` 만 쓴다.
 *
 * @slot header - 화면 머리(예: `u-page-header` — 그 `actions` 슬롯에 화면 고유 버튼)
 * @slot filters - 화면 고유 검색 조건 — `search {query}` 를 내면 소스 검색어가 된다
 * @slot applied - 지금 걸린 조건(칩) — 비면 영역째 접힌다
 * @slot toolbar - 뷰 위의 동작 줄
 * @slot view - 뷰 요소(여럿이면 `view-name` 으로 고른다)
 * @slot pager - 페이저(예: `u-pagination`) — 소스에 묶인다
 * @slot empty - 결과가 없을 때 뷰 대신 보일 것
 * @slot error - 소스가 오류일 때 뷰 대신 보일 것
 *
 * @csspart region - 각 영역의 상자(영역 이름 part 와 함께 붙는다)
 * @csspart header
 * @csspart filters
 * @csspart applied
 * @csspart surface - 툴바 · 뷰 · 빈·오류 · 페이저를 담는 상자(`appearance="card"` 의 면 — `plain` 에서는 상자를 만들지 않는다)
 * @csspart toolbar
 * @csspart view
 * @csspart pager
 * @csspart status - 빈·오류 영역
 *
 * @cssprop --list-page-gap - 영역 사이 간격(기본 `var(--u-space-md)`)
 */
@customElement('u-list-page')
export class UListPage extends UElement {
  static styles = [super.styles, styles];

  /** 목록의 데이터 소스 — `createODataSource` · `createArraySource`(flex-table)의 모양(`ViewSource`). */
  @property({ attribute: false }) source?: ViewSource;

  /** 보일 뷰의 `view-name`. 없으면 첫 뷰. */
  @property({ type: String, reflect: true }) view?: string;

  /** 외형 — `plain`(기본) · `card`(툴바 · 뷰 · 페이저를 한 면에). */
  @property({ type: String, reflect: true }) appearance: ListPageAppearance = 'plain';

  /** 목록 상태 — 소스에서 도출되며 속성으로 반영된다(읽기 전용으로 쓴다). */
  @property({ type: String, reflect: true }) status: ListPageStatus = 'ready';

  /** 채워진 영역. */
  @state() private filled = new Set<SlotName>();

  private bound = new Map<Element, () => void>();
  private unsubscribe?: () => void;

  /** 뷰마다 마지막으로 말한 선택 수 — `selection-change {selectedIds}` 에서. 보이는 뷰의 것만 `:state(selected)` 를 켠다. */
  private selections = new WeakMap<Element, number>();
  /** 지금 보이는 뷰(`applyView`). */
  private activeView?: Element;

  /**
   * `:state(selected)` 을 싣는 자리 — 보이는 뷰에 선택이 있는 동안(`u-select:state(open)` 과 같은 관례).
   * ⚠생성자에서 한 번만 붙인다 — 같은 인스턴스에 두 번 부르면 `NotSupportedError` 다.
   */
  private readonly internals: ElementInternals | undefined =
    typeof this.attachInternals === 'function' ? this.attachInternals() : undefined;

  constructor() {
    super();
    this.addEventListener('search', this.onSearch);
    this.addEventListener('selection-change', this.onSelectionChange);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.attachSource();
  }

  disconnectedCallback(): void {
    this.detachSource();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('source') && this.isConnected) {
      this.detachSource();
      this.attachSource();
    }
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('view')) this.applyView();
  }

  render() {
    const panel = this.panel();
    const region = (name: SlotName) => html`
      <div part="region ${name}" ?hidden=${!this.filled.has(name)}>
        <slot name=${name} @slotchange=${this.onSlotChange}></slot>
      </div>
    `;
    return html`
      ${region('header')}
      ${region('filters')}
      ${region('applied')}
      <div part="surface">
        ${region('toolbar')}
        <div part="region view" ?hidden=${panel !== null || !this.filled.has('view')}>
          <slot name="view" @slotchange=${this.onSlotChange}></slot>
        </div>
        <div part="region status" ?hidden=${panel === null}>
          <slot name="empty" ?hidden=${panel !== 'empty'} @slotchange=${this.onSlotChange}></slot>
          <slot name="error" ?hidden=${panel !== 'error'} @slotchange=${this.onSlotChange}></slot>
        </div>
        <div part="region pager" ?hidden=${panel !== null || !this.filled.has('pager')}>
          <slot name="pager" @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    `;
  }

  /** 뷰 대신 보일 영역 — 그 상태이고 그 슬롯이 채워졌을 때만. */
  private panel(): 'empty' | 'error' | null {
    if (this.status === 'error' && this.filled.has('error')) return 'error';
    if (this.status === 'empty' && this.filled.has('empty')) return 'empty';
    return null;
  }

  private assigned(name: SlotName): Element[] {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>(`slot[name="${name}"]`);
    return slot ? slot.assignedElements({ flatten: true }) : [];
  }

  private onSlotChange = () => {
    const filled = new Set<SlotName>();
    for (const name of SLOTS) if (this.assigned(name).length) filled.add(name);
    this.filled = filled;
    this.syncBindings();
    this.applyView();
  };

  /** 뷰 요소의 `hidden` — 보일 뷰 하나만 연다. */
  private applyView() {
    const views = this.assigned('view');
    const active = (this.view && views.find((v) => v.getAttribute('view-name') === this.view)) || views[0];
    for (const v of views) v.toggleAttribute('hidden', v !== active);
    this.activeView = active;
    this.applySelected();
  }

  /** 보이는 뷰의 선택 수 → `:state(selected)`. */
  private applySelected() {
    const count = this.activeView ? this.selections.get(this.activeView) ?? 0 : 0;
    this.internals?.states?.[count > 0 ? 'add' : 'delete']('selected');
  }

  /**
   * 뷰 영역의 요소가 낸 `selection-change {selectedIds}` → 그 뷰의 선택 수. 선택을 소스에 묶지 않는다 — 읽어서 상태로만 낸다.
   * 뷰 밖(머리 · 필터 · 툴바)에서 난 같은 이름의 이벤트는 목록의 선택이 아니다.
   * ⚠뷰 영역은 슬롯 배정이 아니라 자식의 `slot` 으로 가른다 — 골격이 처음 그려지기 전(슬롯이 아직 없을 때) 뷰가 알린 초기 선택도
   *   잃지 않는다. 직계 자식의 `slot="view"` 가 곧 그 슬롯의 배정이다.
   */
  private onSelectionChange = (e: Event) => {
    const ids = (e as CustomEvent<{ selectedIds?: unknown }>).detail?.selectedIds;
    if (!Array.isArray(ids)) return;
    const child = e.composedPath().find((n) => n instanceof Element && n.parentElement === this) as Element | undefined;
    if (!child || child.slot !== 'view') return;
    this.selections.set(child, ids.length);
    if (child === this.activeView) this.applySelected();
  };

  private attachSource() {
    const source = this.source;
    if (!source) return;
    this.unsubscribe = source.subscribe(() => this.readStatus());
    this.readStatus();
    this.syncBindings();
  }

  private detachSource() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const unbind of this.bound.values()) unbind();
    this.bound.clear();
  }

  /** 소스 상태 → `status`. 처음 불러오는 동안만 `loading` — 이미 행이 있으면 새로 고치는 동안에도 `ready` 다. */
  private readStatus() {
    const s = this.source?.getState();
    if (!s) return;
    this.status = s.error ? 'error'
      : s.loading && s.data.length === 0 ? 'loading'
      : !s.loading && s.data.length === 0 && s.totalCount === 0 ? 'empty'
      : 'ready';
  }

  /** 뷰·페이저 영역의 요소를 소스에 묶는다 — 새로 온 것은 묶고 떠난 것은 푼다. */
  private syncBindings() {
    const source = this.source;
    if (!source || !this.isConnected) return;
    const now = new Set(BOUND_SLOTS.flatMap((name) => this.assigned(name)));
    for (const [el, unbind] of this.bound) {
      if (!now.has(el)) { unbind(); this.bound.delete(el); }
    }
    for (const el of now) if (!this.bound.has(el)) this.bound.set(el, bindSource(source, el));
  }

  /**
   * 머리 · 필터 · 툴바에서 온 `search {query}` → 소스 검색어. 뷰·페이저의 것은 그 묶음이 이미 듣고, 선택지 질의
   * (`OPTION_QUERY_EMITTERS`)는 목록 검색이 아니다 — 영역의 자식 자신이든 그 안쪽(예: `u-field` 가 감싼 선택)이든.
   */
  private onSearch = (e: Event) => {
    const source = this.source;
    const query = (e as CustomEvent<{ query?: unknown }>).detail?.query;
    if (!source || typeof query !== 'string') return;
    const path = e.composedPath();
    const at = path.findIndex((n) => n instanceof Element && n.parentElement === this);
    if (at < 0) return;
    const child = path[at] as Element;
    if (this.bound.has(child)) return;
    if (path.slice(0, at + 1).some((n) => n instanceof Element && OPTION_QUERY_EMITTERS.has(n.localName))) return;
    source.setSearch(query);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'u-list-page': UListPage;
  }
}
