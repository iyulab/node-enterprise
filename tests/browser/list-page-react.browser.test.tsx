import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ListPage } from '../../src/react';
import type { UListPage } from '../../src/list/UListPage';
import type { ViewSource, ViewSourceState } from '../../src/list/bindSource';

/**
 * **`ListPage`(React 래퍼)** — `source` 를 프로퍼티로 넘기고(React 18 은 JSX 속성을 문자열로 만든다), 자식이 슬롯으로 간다.
 *
 * ## 왜 브라우저인가
 *
 * `@lit/react` 는 node 조건에서 SSR 빌드로 갈라져 프로퍼티를 쓰는 효과를 등록하지 않는다 — node 에서는 원리적으로 못 잰다.
 */

function staticSource(): ViewSource {
  const state: ViewSourceState = {
    data: [{ id: 1 }], totalCount: 1, loading: false, error: null, page: 0, pageSize: 20, sortCriteria: [], search: '',
  };
  return {
    getState: () => state, subscribe: () => () => {},
    setPage() {}, setPageSize() {}, setSort() {}, setSearch() {},
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

describe('ListPage', () => {
  it('source 를 프로퍼티로 넘기고 view·자식 슬롯이 요소에 닿는다', async () => {
    const source = staticSource();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <ListPage source={source} view="card">
          <div slot="view" view-name="table">table</div>
          <div slot="view" view-name="card">card</div>
        </ListPage>,
      );
    });
    const el = container.querySelector('u-list-page') as UListPage;
    await el.updateComplete;
    expect(el.source).toBe(source);
    expect(el.view).toBe('card');
    const [table, card] = el.querySelectorAll('[slot="view"]') as NodeListOf<HTMLElement>;
    expect(table.hidden).toBe(true);
    expect(card.hidden).toBe(false);
  });
});

describe('ListPage — 자식의 슬롯이 React 래퍼로 들어올 때', () => {
  it('NEGATIVE: @lit/react 래퍼가 slot 을 삽입 뒤에 주어도 «슬롯 없음» 을 말하지 않는다', async () => {
    const { createComponent } = await import('@lit/react');
    const React = await import('react');
    class SlotProbe extends HTMLElement {}
    if (!customElements.get('slot-probe')) customElements.define('slot-probe', SlotProbe);
    const Probe = createComponent({ tagName: 'slot-probe', elementClass: SlotProbe, react: React });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <ListPage source={staticSource()}>
          <Probe slot="filters" />
          <Probe slot="view" />
        </ListPage>,
      );
    });
    await new Promise((r) => setTimeout(r, 20));
    const el = container.querySelector('u-list-page') as UListPage;
    expect([...el.querySelectorAll('slot-probe')].map((p) => p.getAttribute('slot'))).toEqual(['filters', 'view']);
    expect(warn.mock.calls.filter(([m]) => String(m).includes('has no slot'))).toEqual([]);
    warn.mockRestore();
  });
});
