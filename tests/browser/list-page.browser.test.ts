import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@iyulab/components/dist/components/pagination/UPagination.js';
import '@iyulab/components/dist/components/input/UInput.js';
import type { UPagination } from '@iyulab/components/dist/components/pagination/UPagination.js';
import '../../src/list-page';
import type { UListPage } from '../../src/list/UListPage';
import type { ViewSource, ViewSourceState, ViewSortCriterion } from '../../src/list/bindSource';

/**
 * **`u-list-page` — 목록 골격.** 소스를 뷰와 페이저에 묶고, 보일 뷰를 고르고, 빈·오류 영역을 바꿔 보인다.
 *
 * | 계약 | 재는 것 |
 * |---|---|
 * | 묶음 | 뷰·페이저가 소스 상태를 받고, 뷰의 `sort-change`·페이저의 `page-change` 가 소스를 조작한다 |
 * | 뷰 전환 | `view` = 보일 뷰의 `view-name` · 없으면 첫 뷰 · 나머지는 `hidden` |
 * | 검색 | 필터 영역의 `search {query}` → `setSearch` 한 번(뷰의 것은 그 묶음이 듣고 골격은 다시 부르지 않는다) |
 * | 상태 | `status` = loading · error · empty · ready · 오류/빈 슬롯이 있으면 뷰·페이저 대신 그것 · 없으면 뷰가 그대로 |
 * | 영역 | 채워지지 않은 영역은 상자째 빠진다 · 늦게 온 뷰도 묶인다 · 소스를 바꾸면 새 소스로 다시 묶인다 |
 *
 * ## 왜 브라우저인가
 *
 * 슬롯 배정(`assignedElements`)과 `slotchange`, 커스텀 엘리먼트 수명주기는 실제 엔진에서 잰다. 페이저는 실제 `u-pagination` 을
 * 쓴다 — 골격이 실제로 묶일 상대이고, 그 이벤트가 섀도 경계를 넘어 오는 경로까지 함께 잰다.
 */

/** 뷰 어휘를 말하는 가짜 뷰 — 쓰기 가능한 필드를 갖는다. */
class FakeView extends HTMLElement {
  data: unknown[] = [];
  totalCount = 0;
  loading = false;
  error: { message: string } | null = null;
  sortCriteria: ViewSortCriterion[] = [];
  page = 0;
  pageSize = 0;
}
if (!customElements.get('fake-view')) customElements.define('fake-view', FakeView);

type Calls = { sort: ViewSortCriterion[][]; page: number[]; pageSize: number[]; search: string[] };

function createSource(initial: Partial<ViewSourceState> = {}): ViewSource & { set(p: Partial<ViewSourceState>): void; calls: Calls } {
  let state: ViewSourceState = {
    data: [{ id: 1 }, { id: 2 }], totalCount: 42, loading: false, error: null,
    page: 0, pageSize: 20, sortCriteria: [], search: '', ...initial,
  };
  const listeners = new Set<() => void>();
  const calls: Calls = { sort: [], page: [], pageSize: [], search: [] };
  const set = (p: Partial<ViewSourceState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
  return {
    calls,
    set,
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    setPage: (page) => { calls.page.push(page); set({ page }); },
    setPageSize: (pageSize) => { calls.pageSize.push(pageSize); set({ pageSize, page: 0 }); },
    setSort: (c) => { calls.sort.push(c); set({ sortCriteria: c }); },
    setSearch: (q) => { calls.search.push(q); set({ search: q }); },
  };
}

const tick = async () => {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => setTimeout(r, 0));
};

let host: HTMLDivElement;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { host.remove(); });

async function mount(markup: string, source?: ViewSource): Promise<UListPage> {
  host.innerHTML = markup;
  const page = host.querySelector('u-list-page') as UListPage;
  if (source) page.source = source;
  await page.updateComplete;
  await tick();
  return page;
}

const region = (page: UListPage, name: string) => page.shadowRoot!.querySelector(`[part~="${name}"]`) as HTMLElement;

describe('u-list-page — 묶음', () => {
  it('뷰와 페이저가 소스 상태를 받는다', async () => {
    const src = createSource({ page: 1 });
    const page = await mount(`
      <u-list-page>
        <fake-view slot="view"></fake-view>
        <u-pagination slot="pager"></u-pagination>
      </u-list-page>`, src);
    const view = page.querySelector('fake-view') as FakeView;
    const pager = page.querySelector('u-pagination') as UPagination;
    expect(view.data).toBe(src.getState().data);
    expect(view.totalCount).toBe(42);
    expect(pager.totalCount).toBe(42);
    expect(pager.page).toBe(1);
  });

  it('뷰의 sort-change 와 실제 페이저의 다음 쪽 누름이 소스를 조작한다', async () => {
    const src = createSource();
    const page = await mount(`
      <u-list-page>
        <fake-view slot="view"></fake-view>
        <u-pagination slot="pager"></u-pagination>
      </u-list-page>`, src);
    const view = page.querySelector('fake-view') as FakeView;
    const criteria = [{ key: 'name', direction: 'asc' as const }];
    view.dispatchEvent(new CustomEvent('sort-change', { detail: { criteria }, bubbles: true, composed: true }));
    expect(src.calls.sort).toEqual([criteria]);

    const pager = page.querySelector('u-pagination') as UPagination;
    await pager.updateComplete;
    const next = pager.shadowRoot!.querySelector('[part~="next"]') as HTMLElement;
    next.click();
    await tick();
    expect(src.calls.page).toEqual([1]);
    expect(pager.page).toBe(1);
  });

  it('늦게 온 뷰도 묶이고, 떠난 뷰는 풀린다', async () => {
    const src = createSource();
    const page = await mount(`<u-list-page></u-list-page>`, src);
    const view = document.createElement('fake-view') as FakeView;
    view.slot = 'view';
    page.appendChild(view);
    await tick();
    expect(view.totalCount).toBe(42);

    view.remove();
    await tick();
    src.set({ totalCount: 7 });
    expect(view.totalCount).toBe(42);
  });

  it('소스를 바꾸면 새 소스로 다시 묶인다', async () => {
    const a = createSource({ totalCount: 1 });
    const b = createSource({ totalCount: 2 });
    const page = await mount(`<u-list-page><fake-view slot="view"></fake-view></u-list-page>`, a);
    const view = page.querySelector('fake-view') as FakeView;
    page.source = b;
    await page.updateComplete;
    expect(view.totalCount).toBe(2);
    a.set({ totalCount: 99 });
    expect(view.totalCount).toBe(2);
  });
});

describe('u-list-page — 뷰 전환', () => {
  const markup = `
    <u-list-page>
      <fake-view slot="view" view-name="table"></fake-view>
      <fake-view slot="view" view-name="card"></fake-view>
    </u-list-page>`;

  it('view 가 없으면 첫 뷰가 보인다', async () => {
    const page = await mount(markup, createSource());
    const [table, card] = page.querySelectorAll('fake-view') as NodeListOf<FakeView>;
    expect(table.hidden).toBe(false);
    expect(card.hidden).toBe(true);
  });

  it('view 한 곳으로 표↔카드를 바꾸고, 숨은 뷰도 묶인 채라 상태를 갖고 있다', async () => {
    const src = createSource();
    const page = await mount(markup, src);
    const [table, card] = page.querySelectorAll('fake-view') as NodeListOf<FakeView>;
    page.view = 'card';
    await page.updateComplete;
    expect(table.hidden).toBe(true);
    expect(card.hidden).toBe(false);
    expect(card.totalCount).toBe(42);
    src.set({ totalCount: 5 });
    expect(table.totalCount).toBe(5);
  });
});

describe('u-list-page — 검색', () => {
  it('필터 영역의 search {query} 가 소스 검색어가 된다 — 한 번', async () => {
    const src = createSource();
    const page = await mount(`
      <u-list-page>
        <input slot="filters">
        <fake-view slot="view"></fake-view>
      </u-list-page>`, src);
    const input = page.querySelector('input')!;
    input.dispatchEvent(new CustomEvent('search', { detail: { query: 'kim' }, bubbles: true, composed: true }));
    expect(src.calls.search).toEqual(['kim']);
  });

  it('실제 검색 칸(u-input type="search")의 Enter 가 소스 검색어가 된다', async () => {
    const src = createSource();
    const page = await mount(`
      <u-list-page>
        <u-input slot="filters" type="search" label="Search orders"></u-input>
        <fake-view slot="view"></fake-view>
      </u-list-page>`, src);
    const input = page.querySelector('u-input')!;
    await input.updateComplete;
    await userEvent.click(input.shadowRoot!.querySelector('input')!);
    await userEvent.keyboard('kim{Enter}');
    expect(src.calls.search).toEqual(['kim']);
  });

  it('뷰가 낸 search 는 그 묶음이 듣는다 — 골격이 다시 부르지 않는다', async () => {
    const src = createSource();
    const page = await mount(`<u-list-page><fake-view slot="view"></fake-view></u-list-page>`, src);
    page.querySelector('fake-view')!.dispatchEvent(new CustomEvent('search', { detail: { query: 'x' }, bubbles: true, composed: true }));
    expect(src.calls.search).toEqual(['x']);
  });
});

describe('u-list-page — 상태와 빈·오류 영역', () => {
  const full = `
    <u-list-page>
      <fake-view slot="view"></fake-view>
      <u-pagination slot="pager"></u-pagination>
      <p slot="empty">No orders</p>
      <p slot="error">Could not load</p>
    </u-list-page>`;

  it('처음 불러오는 동안 loading · 행이 있는 채 새로 고치면 ready', async () => {
    const src = createSource({ loading: true, data: [], totalCount: 0 });
    const page = await mount(full, src);
    expect(page.status).toBe('loading');
    expect(page.getAttribute('status')).toBe('loading');
    src.set({ loading: false, data: [{ id: 1 }], totalCount: 1 });
    src.set({ loading: true });
    await page.updateComplete;
    expect(page.status).toBe('ready');
  });

  it('오류면 오류 영역이 뷰·페이저 대신 보인다', async () => {
    const src = createSource();
    const page = await mount(full, src);
    src.set({ error: { message: 'boom' } });
    await page.updateComplete;
    expect(page.status).toBe('error');
    expect(region(page, 'status').hidden).toBe(false);
    expect(region(page, 'view').hidden).toBe(true);
    expect(region(page, 'pager').hidden).toBe(true);
    const shown = [...page.shadowRoot!.querySelectorAll('[part~="status"] slot')].filter((s) => !(s as HTMLElement).hidden);
    expect(shown.map((s) => s.getAttribute('name'))).toEqual(['error']);
  });

  it('결과가 비면 빈 영역이 보인다', async () => {
    const page = await mount(full, createSource({ data: [], totalCount: 0 }));
    expect(page.status).toBe('empty');
    const shown = [...page.shadowRoot!.querySelectorAll('[part~="status"] slot')].filter((s) => !(s as HTMLElement).hidden);
    expect(shown.map((s) => s.getAttribute('name'))).toEqual(['empty']);
    expect(region(page, 'view').hidden).toBe(true);
  });

  it('오류 슬롯이 없으면 뷰가 그대로 보인다 — 뷰 자신의 오류 표시에 맡긴다', async () => {
    const src = createSource();
    const page = await mount(`<u-list-page><fake-view slot="view"></fake-view></u-list-page>`, src);
    src.set({ error: { message: 'boom' } });
    await page.updateComplete;
    expect(page.status).toBe('error');
    expect(region(page, 'view').hidden).toBe(false);
    expect((page.querySelector('fake-view') as FakeView).error).toEqual({ message: 'boom' });
  });

  it('채워지지 않은 영역은 상자째 빠진다', async () => {
    const page = await mount(`<u-list-page><fake-view slot="view"></fake-view></u-list-page>`, createSource());
    for (const name of ['header', 'filters', 'toolbar', 'pager']) expect(region(page, name).hidden).toBe(true);
    expect(region(page, 'view').hidden).toBe(false);
  });
});
