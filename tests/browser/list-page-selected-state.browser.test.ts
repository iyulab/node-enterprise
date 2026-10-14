import { describe, it, expect, afterEach } from 'vitest';
import '../../src/list-page';
import type { UListPage } from '../../src/list/UListPage';

/**
 * `u-list-page` 의 `:state(selected)` — **보이는** 뷰에 선택이 있는 동안.
 *
 * 카드 툴바(`slot="toolbar"`)를 «일괄 동작 막대» 로 칠하려면 그 화면에 선택이 있다는 사실이 바깥 시트에 닿아야 한다.
 * 선택은 뷰(flex-table · u-rich-table)가 갖고 `selection-change {selectedIds}` 로 말한다(뷰 어휘) — 골격은 그것을 **읽기만**
 * 한다(소스에 묶지 않는다). 그래서 화면마다 «선택 수 → 툴바 클래스» 를 다시 짜지 않는다.
 *
 * | 계약 | 재는 것 |
 * |---|---|
 * | 상태 | 보이는 뷰가 하나라도 고르면 켜지고, 비우면 꺼진다 |
 * | 뷰 전환 | 숨은 뷰의 선택은 세지 않는다 — 돌아오면 그 뷰의 선택이 다시 켠다 |
 * | 뷰가 떠남 | 고른 채로 빠진 뷰는 상태를 남기지 않는다 |
 * | 출처 | 뷰 밖(툴바)에서 난 같은 이름의 이벤트는 세지 않는다 |
 * | 바깥 시트 | `u-list-page:state(selected)::part(toolbar)` 가 실제로 칠한다 |
 */

class SelectView extends HTMLElement {
  select(ids: string[]) {
    this.dispatchEvent(new CustomEvent('selection-change', {
      detail: { selectedIds: ids, selectedRows: ids.map((id) => ({ id })) }, bubbles: true, composed: true,
    }));
  }
}
if (!customElements.get('select-view')) customElements.define('select-view', SelectView);

const TINT = 'rgb(1, 2, 3)';
const sheet = document.createElement('style');
sheet.textContent = `u-list-page:state(selected)::part(toolbar) { background-color: ${TINT}; }`;

afterEach(() => {
  document.body.replaceChildren();
  sheet.remove();
});

async function mount(): Promise<UListPage> {
  document.head.appendChild(sheet);
  document.body.innerHTML = `
    <u-list-page appearance="card">
      <div slot="toolbar">toolbar</div>
      <select-view slot="view" view-name="table"></select-view>
      <select-view slot="view" view-name="cards"></select-view>
    </u-list-page>`;
  const page = document.querySelector('u-list-page') as UListPage;
  await page.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await page.updateComplete;
  return page;
}

const view = (name: string) => document.querySelector(`select-view[view-name="${name}"]`) as SelectView;
const selected = (page: UListPage) => page.matches(':state(selected)');
const settle = async (page: UListPage) => {
  await page.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
};

describe('u-list-page :state(selected)', () => {
  it('🔴a selection in the visible view turns it on; clearing it turns it off', async () => {
    const page = await mount();
    expect(selected(page)).toBe(false);
    view('table').select(['1', '2']);
    await settle(page);
    expect(selected(page)).toBe(true);
    view('table').select([]);
    await settle(page);
    expect(selected(page)).toBe(false);
  });

  it('🔴only the visible view counts — switching views follows that view\'s own selection', async () => {
    const page = await mount();
    view('table').select(['1']);
    await settle(page);
    page.view = 'cards';
    await settle(page);
    expect(selected(page)).toBe(false);
    page.view = 'table';
    await settle(page);
    expect(selected(page)).toBe(true);
  });

  it('🔴a view that leaves with a selection leaves no state behind', async () => {
    const page = await mount();
    view('table').select(['1']);
    await settle(page);
    view('table').remove();
    await settle(page);
    expect(selected(page)).toBe(false);
  });

  it('🔴a selection the view reports before the skeleton first renders is kept (an initial selection)', async () => {
    document.head.appendChild(sheet);
    const page = document.createElement('u-list-page') as UListPage;
    const table = document.createElement('select-view') as SelectView;
    table.slot = 'view';
    page.append(table);
    document.body.append(page);
    table.select(['1']); // before the skeleton's first update — its slots are not assigned yet
    await settle(page);
    expect(selected(page)).toBe(true);
  });

  it('NEGATIVE: the same event from outside the view region does not count', async () => {
    const page = await mount();
    const toolbar = page.querySelector('[slot="toolbar"]')!;
    toolbar.dispatchEvent(new CustomEvent('selection-change', { detail: { selectedIds: ['x'] }, bubbles: true }));
    await settle(page);
    expect(selected(page)).toBe(false);
  });

  it('🔴an outside sheet paints the toolbar through ::part while the state holds', async () => {
    const page = await mount();
    const toolbar = page.shadowRoot!.querySelector('[part~="toolbar"]') as HTMLElement;
    expect(getComputedStyle(toolbar).backgroundColor).not.toBe(TINT);
    view('table').select(['1']);
    await settle(page);
    expect(getComputedStyle(toolbar).backgroundColor).toBe(TINT);
  });
});
