import { describe, it, expect, afterEach } from 'vitest';
import '@iyulab/components/dist/components/chip/UChip.js';
import '../../src/list-page';
import type { UListPage } from '../../src/list/UListPage';

/**
 * `u-list-page` 의 두 배치 — 적용된 조건 줄(`slot="applied"`)과 한 면(`appearance="card"`).
 *
 * | 계약 | 재는 것 |
 * |---|---|
 * | 적용된 조건 | 필터 아래 · 툴바 위에 감기는 칩 줄 · 마지막 칩이 빠지면 영역째 접혀 간격을 남기지 않는다 |
 * | 카드 | 툴바 · 뷰 · 페이저가 한 테두리 안 · 영역 사이는 간격이 아니라 선 · 뷰 자신의 테두리는 걷힌다 · 머리·필터는 면 밖 |
 * | plain | 종전 그대로 — 면 상자가 없고 영역이 호스트의 간격으로 쌓인다 |
 */
afterEach(() => document.body.replaceChildren());

/** 자기 테두리를 «호스트 규칙» 으로 그리는 뷰 — flex-table · u-rich-table 이 그렇게 그린다(인라인 style 이 아니다). */
class FramedView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML =
      '<style>:host { display: block; height: 100px; border: 3px solid red; border-radius: 6px; }</style>rows';
  }
}
if (!customElements.get('framed-view')) customElements.define('framed-view', FramedView);

async function mount(markup: string): Promise<UListPage> {
  document.body.innerHTML = markup;
  const page = document.querySelector('u-list-page') as UListPage;
  await page.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await page.updateComplete;
  return page;
}

const part = (page: UListPage, name: string) =>
  page.shadowRoot!.querySelector(`[part~="${name}"]`) as HTMLElement;
const rect = (el: Element) => el.getBoundingClientRect();

const LIST = (attrs = '', applied = '') => `
  <u-list-page ${attrs} style="width:600px; --list-page-gap: 10px">
    <div slot="header" style="height:30px">Orders</div>
    <div slot="filters" style="height:32px">filters</div>
    ${applied}
    <div slot="toolbar" style="height:28px">toolbar</div>
    <framed-view slot="view"></framed-view>
    <div slot="pager" style="height:24px">pager</div>
  </u-list-page>`;

const CHIPS = `
  <u-chip slot="applied" removable>Status: Open</u-chip>
  <u-chip slot="applied" removable>Owner: Me</u-chip>`;

describe('u-list-page applied', () => {
  it('🔴the applied conditions sit between the filters and the toolbar', async () => {
    const page = await mount(LIST('', CHIPS));
    const applied = part(page, 'applied');
    expect(applied.hidden).toBe(false);
    expect(rect(applied).top).toBeGreaterThanOrEqual(rect(part(page, 'filters')).bottom);
    expect(rect(applied).bottom).toBeLessThanOrEqual(rect(part(page, 'toolbar')).top);
    expect(getComputedStyle(applied).flexWrap).toBe('wrap');
  });

  it('🔴when the last chip goes, the row folds and leaves no gap', async () => {
    const page = await mount(LIST('', CHIPS));
    const gapWith = rect(part(page, 'toolbar')).top - rect(part(page, 'filters')).bottom;
    for (const chip of [...page.querySelectorAll('u-chip')]) chip.remove();
    await page.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(part(page, 'applied').hidden).toBe(true);
    const gapWithout = rect(part(page, 'toolbar')).top - rect(part(page, 'filters')).bottom;
    expect(gapWithout).toBeCloseTo(10, 0);
    expect(gapWith).toBeGreaterThan(gapWithout);
  });
});

describe('u-list-page appearance="card"', () => {
  it('🔴toolbar, view and pager sit inside one bordered surface; header and filters stay outside', async () => {
    const page = await mount(LIST('appearance="card"'));
    const surface = rect(part(page, 'surface'));
    for (const name of ['toolbar', 'view', 'pager']) {
      const r = rect(part(page, name));
      expect(r.top).toBeGreaterThanOrEqual(surface.top);
      expect(r.bottom).toBeLessThanOrEqual(surface.bottom + 0.5);
    }
    expect(rect(part(page, 'filters')).bottom).toBeLessThanOrEqual(surface.top);
    expect(getComputedStyle(part(page, 'surface')).borderTopWidth).toBe('1px');
  });

  it('🔴inside the surface the regions are joined by lines, not gaps', async () => {
    const page = await mount(LIST('appearance="card"'));
    const toolbar = rect(part(page, 'toolbar'));
    const view = rect(part(page, 'view'));
    const pager = rect(part(page, 'pager'));
    expect(view.top - toolbar.bottom).toBeCloseTo(0, 0);
    expect(pager.top - view.bottom).toBeCloseTo(0, 0);
    expect(getComputedStyle(part(page, 'toolbar')).borderBottomWidth).toBe('1px');
    expect(getComputedStyle(part(page, 'pager')).borderTopWidth).toBe('1px');
  });

  it('🔴a view that draws its own border loses it inside the surface (no double frame)', async () => {
    const page = await mount(LIST('appearance="card"'));
    const view = page.querySelector('[slot="view"]') as HTMLElement;
    expect(getComputedStyle(view).borderTopWidth).toBe('0px');
  });

  it('NEGATIVE plain keeps the old stack — no surface box, the host gap between regions, the view keeps its border', async () => {
    const page = await mount(LIST());
    expect(getComputedStyle(part(page, 'surface')).display).toBe('contents');
    expect(rect(part(page, 'view')).top - rect(part(page, 'toolbar')).bottom).toBeCloseTo(10, 0);
    const view = page.querySelector('[slot="view"]') as HTMLElement;
    expect(getComputedStyle(view).borderTopWidth).toBe('3px');
  });
});
