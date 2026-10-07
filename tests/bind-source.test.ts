import { describe, it, expect } from 'vitest';
import { bindSource, SourceBinding, VIEW_PROPERTIES, type ViewSource, type ViewSourceState } from '../src/list/bindSource';

/**
 * `bindSource` — 소스를 «뷰 어휘» 를 말하는 요소에 묶는다(목록 키트 설계안 §2 뷰 프로토콜).
 *
 * 뷰는 구조로만 안다: 두 표 · 카드 뷰 · 페이저가 같은 이름을 받고 같은 모양의 이벤트를 낸다. 여기서는 그 모양을 가진
 * `EventTarget` 으로 잰다 — Lit 처럼 프로토타입 접근자(setter)를 가진 것, flex-table 처럼 getter 만 있던 것, 속성이 일부뿐인 것.
 */

function makeSource(init: Partial<ViewSourceState<{ id: number }>> = {}) {
  let state: ViewSourceState<{ id: number }> = {
    data: [{ id: 1 }], totalCount: 40, loading: false, error: null, page: 0, pageSize: 20, sortCriteria: [], search: '', ...init,
  };
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const set = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; for (const l of listeners) l(); };
  const source: ViewSource<{ id: number }> & { set: typeof set; listeners: Set<() => void> } = {
    getState: () => state,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l); }; },
    setPage(page) { calls.push(`page:${page}`); set({ page }); },
    setPageSize(size) { calls.push(`size:${size}`); set({ pageSize: size, page: 0 }); },
    setSort(criteria) { calls.push(`sort:${criteria.map((c) => `${c.key} ${c.direction}`).join(',')}`); set({ sortCriteria: criteria, page: 0 }); },
    setSearch(term) { calls.push(`search:${term}`); set({ search: term, page: 0 }); },
    set,
    listeners,
  };
  return { source, calls };
}

/** Lit 처럼 프로토타입에 접근자를 가진 뷰 — 표. */
class TableView extends EventTarget {
  writes: string[] = [];
  _v: Record<string, unknown> = { dataMode: 'client' };
}
for (const key of ['data', 'loading', 'error', 'sortCriteria', 'dataMode']) {
  Object.defineProperty(TableView.prototype, key, {
    get(this: TableView) { return this._v?.[key]; },
    set(this: TableView, v: unknown) { (this._v ??= {})[key] = v; this.writes.push(key); },
    configurable: true,
  });
}

/** 페이저 — 데이터 속성으로(클래스 필드). */
class PagerView extends EventTarget {
  page = 0;
  pageSize = 20;
  totalCount = 0;
}

/** getter 만 있는 정렬(쓰기 불가) — 이 사이클 전의 flex-table 모양. */
class ReadOnlySortView extends EventTarget {
  get sortCriteria() { return []; }
  data: unknown[] = [];
}

const fire = (t: EventTarget, type: string, detail: unknown) => t.dispatchEvent(new CustomEvent(type, { detail }));

describe('bindSource', () => {
  it('🔴writes the source state to the properties the view has — and only those', () => {
    const { source } = makeSource({ sortCriteria: [{ key: 'name', direction: 'asc' }] });
    const table = new TableView() as TableView & Record<string, unknown>;
    const pager = new PagerView();
    bindSource(source, table);
    bindSource(source, pager);
    expect(table.data).toEqual([{ id: 1 }]);
    expect(table.sortCriteria).toEqual([{ key: 'name', direction: 'asc' }]);
    expect(table.loading).toBe(false);
    expect('page' in table).toBe(false);
    expect(pager).toMatchObject({ page: 0, pageSize: 20, totalCount: 40 });
    expect('data' in pager).toBe(false);
  });

  it('🔴puts a view that has dataMode into server mode — the source runs the query', () => {
    const { source } = makeSource();
    const table = new TableView() as TableView & Record<string, unknown>;
    bindSource(source, table);
    expect(table.dataMode).toBe('server');
  });

  it('follows the source — and writes only what changed', () => {
    const { source } = makeSource();
    const table = new TableView() as TableView & Record<string, unknown>;
    bindSource(source, table);
    table.writes.length = 0;
    source.set({ loading: true });
    expect(table.writes).toEqual(['loading']);
    table.writes.length = 0;
    source.set({ loading: false, data: [{ id: 2 }], error: { message: 'x' } });
    expect(table.writes.sort()).toEqual(['data', 'error', 'loading']);
  });

  it('turns the view events into source calls: sort, page, page size, search', () => {
    const { source, calls } = makeSource();
    const table = new TableView();
    const pager = new PagerView();
    const search = new EventTarget();
    bindSource(source, table);
    bindSource(source, pager);
    bindSource(source, search);
    fire(table, 'sort-change', { criteria: [{ key: 'name', direction: 'desc' }] });
    fire(pager, 'page-change', { page: 1, pageSize: 20 });
    fire(pager, 'page-change', { page: 0, pageSize: 50 });
    fire(search, 'search', { query: 'pump' });
    expect(calls).toEqual(['sort:name desc', 'page:1', 'size:50', 'search:pump']);
    expect(pager).toMatchObject({ page: 0, pageSize: 50 });
  });

  it('NEGATIVE: a getter-only property is not written (no TypeError), malformed details are ignored', () => {
    const { source, calls } = makeSource({ sortCriteria: [{ key: 'a', direction: 'asc' }] });
    const view = new ReadOnlySortView();
    expect(() => bindSource(source, view)).not.toThrow();
    expect(view.data).toEqual([{ id: 1 }]);
    fire(view, 'sort-change', { criteria: 'nope' });
    fire(view, 'page-change', null);
    fire(view, 'search', { term: 'not the shape' });
    expect(calls).toEqual([]);
  });

  it('NEGATIVE: a page-change to the page the source is on is not a call', () => {
    const { source, calls } = makeSource({ page: 2 });
    const pager = new PagerView();
    bindSource(source, pager);
    fire(pager, 'page-change', { page: 2, pageSize: 20 });
    expect(calls).toEqual([]);
  });

  it('the returned function unbinds: no more writes, no more calls, unsubscribed', () => {
    const { source, calls } = makeSource();
    const table = new TableView() as TableView & Record<string, unknown>;
    const unbind = bindSource(source, table);
    expect(source.listeners.size).toBe(1);
    unbind();
    expect(source.listeners.size).toBe(0);
    table.writes.length = 0;
    source.set({ loading: true });
    fire(table, 'sort-change', { criteria: [] });
    expect(table.writes).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('the protocol names are the documented seven', () => {
    expect([...VIEW_PROPERTIES]).toEqual(['data', 'totalCount', 'loading', 'error', 'sortCriteria', 'page', 'pageSize']);
  });
});

describe('SourceBinding (Lit adapter)', () => {
  function host() {
    const controllers: Array<{ hostConnected?(): void; hostDisconnected?(): void; hostUpdated?(): void }> = [];
    return { controllers, addController(c: (typeof controllers)[number]) { controllers.push(c); } };
  }

  it('binds what the host rendered, rebinds as it changes, unbinds on disconnect', () => {
    const { source } = makeSource();
    const h = host();
    let rendered: EventTarget[] = [];
    const binding = new SourceBinding(h, source, () => rendered);
    const c = h.controllers[0];
    expect(c).toBe(binding);

    const a = new PagerView();
    rendered = [a];
    c.hostConnected!();
    expect(a.totalCount).toBe(40);
    expect(source.listeners.size).toBe(1);

    const b = new PagerView();
    rendered = [b];
    c.hostUpdated!();
    expect(source.listeners.size).toBe(1);
    source.set({ totalCount: 41 });
    expect(b.totalCount).toBe(41);
    expect(a.totalCount).toBe(40);

    c.hostDisconnected!();
    expect(source.listeners.size).toBe(0);
  });
});
