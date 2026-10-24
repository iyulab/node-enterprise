import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../src/list-page';
import type { UListPage } from '../../src/list/UListPage';
import type { ViewSource, ViewSourceState } from '../../src/list/bindSource';

/**
 * `u-list-page` writes the source into whatever sits in `slot="view"` / `slot="pager"`. A wrapper there (a layout around
 * the table) has no `data`, so the source reaches nothing: the pager reports a count and the table stays empty, with no
 * error. The page says so once, naming the element — and stays quiet for an element that speaks the view vocabulary,
 * including one defined only after it was slotted.
 */

class VocabView extends HTMLElement { data: unknown[] = []; totalCount = 0; }
class VocabPager extends HTMLElement { page = 0; pageSize = 0; totalCount = 0; }
class Wrapper extends HTMLElement {}
for (const [tag, ctor] of [['vocab-view', VocabView], ['vocab-pager', VocabPager], ['plain-wrapper', Wrapper]] as const) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

function source(): ViewSource {
  const state: ViewSourceState = {
    data: [{ id: 1 }], totalCount: 1, loading: false, error: null, page: 0, pageSize: 20, sortCriteria: [], search: '',
  };
  return {
    getState: () => state, subscribe: () => () => undefined,
    setPage() {}, setPageSize() {}, setSort() {}, setSearch() {},
  };
}

async function mount(markup: string): Promise<UListPage> {
  document.body.innerHTML = `<u-list-page>${markup}</u-list-page>`;
  const page = document.querySelector('u-list-page') as UListPage;
  page.source = source();
  await page.updateComplete;
  await new Promise((r) => setTimeout(r, 30));
  return page;
}

const vocabWarnings = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[@iyulab/enterprise] u-list-page:'));

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('u-list-page — a slotted element that cannot take the source', () => {
  it('warns once, naming the wrapper in the view slot', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const page = await mount('<plain-wrapper slot="view"></plain-wrapper>');
    page.source = source(); // rebinding does not repeat it
    await page.updateComplete;
    await new Promise((r) => setTimeout(r, 30));
    const messages = vocabWarnings(warn);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('<plain-wrapper> in slot="view"');
    expect(messages[0]).toContain('`data`');
  });

  it('a pager slot asks for `page`', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount('<vocab-view slot="view"></vocab-view><div slot="pager"></div>');
    const messages = vocabWarnings(warn);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('<div> in slot="pager"');
  });

  it('NEGATIVE a view and a pager that speak the vocabulary stay quiet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount('<vocab-view slot="view"></vocab-view><vocab-pager slot="pager"></vocab-pager>');
    expect(vocabWarnings(warn)).toEqual([]);
  });

  it('NEGATIVE an element defined after it was slotted is judged once it is defined', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount('<late-view slot="view"></late-view>');
    expect(vocabWarnings(warn)).toEqual([]);
    customElements.define('late-view', class extends HTMLElement { data: unknown[] = []; });
    await new Promise((r) => setTimeout(r, 30));
    expect(vocabWarnings(warn)).toEqual([]);
  });
});

describe('u-list-page — a layout around the view', () => {
  it('binds the view inside a wrapper in the view slot, and stays quiet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount('<plain-wrapper slot="view"><vocab-view></vocab-view><div slot="detail">preview</div></plain-wrapper>');
    const view = document.querySelector('vocab-view') as VocabView;
    expect(view.data).toEqual([{ id: 1 }]);
    expect(view.totalCount).toBe(1);
    expect(vocabWarnings(warn)).toEqual([]);
  });

  it('waits for a view inside the wrapper that is defined after it was slotted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount('<plain-wrapper slot="view"><later-view></later-view></plain-wrapper>');
    class LaterView extends HTMLElement { data: unknown[] = []; }
    customElements.define('later-view', LaterView);
    await new Promise((r) => setTimeout(r, 30));
    expect((document.querySelector('later-view') as LaterView).data).toEqual([{ id: 1 }]);
    expect(vocabWarnings(warn)).toEqual([]);
  });

  it('a selection inside the wrapper still lights the selected state', async () => {
    const page = await mount('<plain-wrapper slot="view"><vocab-view></vocab-view></plain-wrapper>');
    document.querySelector('vocab-view')!.dispatchEvent(new CustomEvent('selection-change', { detail: { selectedIds: [1] }, bubbles: true, composed: true }));
    await page.updateComplete;
    expect(page.matches(':state(selected)')).toBe(true);
  });
});

describe('u-list-page — a child it does not render', () => {
  it('warns once for a child without a slot or with a slot the page does not have', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const page = await mount('<vocab-view slot="view"></vocab-view><plain-wrapper></plain-wrapper><div slot="filter"></div>');
    const messages = vocabWarnings(warn);
    expect(messages.filter((m) => m.includes('<plain-wrapper> has no slot'))).toHaveLength(1);
    expect(messages.filter((m) => m.includes('<div> has slot="filter"'))).toHaveLength(1);
    page.appendChild(document.createElement('aside'));
    await new Promise((r) => setTimeout(r, 0));
    expect(vocabWarnings(warn).filter((m) => m.includes('<aside> has no slot'))).toHaveLength(1);
  });

  it('NEGATIVE children in the page\'s own slots stay quiet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount('<div slot="header"></div><div slot="filters"></div><vocab-view slot="view"></vocab-view><vocab-pager slot="pager"></vocab-pager><div slot="empty"></div>');
    expect(vocabWarnings(warn)).toEqual([]);
  });
});
