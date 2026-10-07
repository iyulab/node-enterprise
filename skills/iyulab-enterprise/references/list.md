# Binding a list: `bindSource`

```ts
import { bindSource, SourceBinding } from '@iyulab/enterprise';
```

A list screen is the same wiring whichever view shows it. `flex-table`, `u-rich-table`, `u-data-view` (cards) and
`u-pagination` take the same state properties and fire the same events, and the data sources of
`@iyulab/flex-table` (`createODataSource`, `createArraySource`) hold that state. `bindSource(source, element)` joins
the two:

| Direction | Name | Source side |
|---|---|---|
| writes | `data` · `totalCount` · `loading` · `error` · `sortCriteria` · `page` · `pageSize` | `getState()` |
| writes | `dataMode = 'server'` (when the element has it) | the source runs the query; the view must not filter or page its one page again |
| listens | `sort-change { criteria }` | `setSort(criteria)` |
| listens | `page-change { page, pageSize? }` | `setPage(page)`, or `setPageSize(pageSize)` when the size changed (back to page 0) |
| listens | `search { query }` | `setSearch(query)` — a list search box: `u-input type="search"` fires this when a search is committed (Enter, clear, Escape; `@iyulab/components` 2.17) |

It writes only the properties the element has and can set (a card view has no sort; a pager has no `data`), and only
when the source value changed. It does not bind selection (`selection-change`) or opening a row (`row-activate`) —
those belong to the screen, so listen on the view directly.

```ts
import { createODataSource } from '@iyulab/flex-table/odata';

const orders = createODataSource<Order>('/api/orders', { pageSize: 20 });
const unbind = [table, pager, searchBox].map((el) => bindSource(orders, el));
table.addEventListener('row-activate', (e) => openOrder(e.detail.id));
// later: unbind.forEach((u) => u());
```

`bindSource` subscribes to the source, so an OData source starts loading when the first element is bound. The source
is known by its shape (`ViewSource`) — this package does not depend on `@iyulab/flex-table`.

## The list skeleton: `u-list-page`

```ts
import '@iyulab/enterprise/list-page'; // registers <u-list-page>
```

A list screen as slots — header, filters, toolbar, view, pager, empty, error — with a source bound to the view and
the pager. The skeleton does not draw a table: whatever sits in `slot="view"` does, as long as it speaks the view
vocabulary above.

```html
<u-list-page view="table">
  <u-page-header slot="header" title="Orders"></u-page-header>
  <u-input slot="filters" type="search" label="Search orders"></u-input>
  <flex-table slot="view" view-name="table"></flex-table>
  <u-data-view slot="view" view-name="card"></u-data-view>
  <u-pagination slot="pager"></u-pagination>
  <u-empty-state slot="empty" title="No orders"></u-empty-state>
  <u-empty-state slot="error" variant="error" title="Could not load orders"></u-empty-state>
</u-list-page>
```

```ts
const page = document.querySelector('u-list-page')!;
page.source = createODataSource<Order>('/api/orders', { pageSize: 20 });
```

| Part of the screen | How |
|---|---|
| Binding | every element in `slot="view"` and `slot="pager"` is bound with `bindSource` — including views added later |
| Table ↔ cards | give each view a `view-name` and set `view` on the skeleton; the others get `hidden` (the skeleton owns `hidden` on its views). Without `view` the first view shows. Hidden views stay bound, so switching is instant |
| Search | a `search { query }` from the header, filters or toolbar becomes `setSearch(query)` |
| Empty and error | `slot="error"` replaces the view and the pager while the source has an error; `slot="empty"` while the result is empty. Leave a slot out and the view shows its own message (both tables draw one) |
| Status | the `status` attribute is `loading` (first load, no rows yet), `error`, `empty` or `ready` — for CSS and tests |
| Spacing | `--list-page-gap` (default `var(--u-space-md)`). Regions with nothing in them take no space. Parts: `region` plus `header`, `filters`, `toolbar`, `view`, `pager`, `status` |

Selection and opening a row stay on the view (`selection-change`, `row-activate`) — the skeleton fires no events of
its own. For a layout the slots do not fit, use `bindSource` alone.

React: `ListPage` from `@iyulab/enterprise/react` (a thin wrapper — `@lit/react` is an optional peer):

```tsx
<ListPage source={orders} view={view}>
  <flex-table slot="view" view-name="table" />
  <u-pagination slot="pager" />
</ListPage>
```

## Lit

`SourceBinding` binds the elements a host renders, rebinds when they change and unbinds when the host disconnects:

```ts
class OrdersPage extends LitElement {
  private orders = createODataSource<Order>('/api/orders', { pageSize: 20 });
  private binding = new SourceBinding(this, this.orders,
    () => this.renderRoot.querySelectorAll('flex-table, u-pagination'));

  render() {
    return html`<flex-table .columns=${columns}></flex-table><u-pagination></u-pagination>`;
  }
}
```

## React

Bind in an effect against the element refs:

```tsx
useEffect(() => {
  const offs = [tableRef.current, pagerRef.current].filter(Boolean).map((el) => bindSource(orders, el!));
  return () => offs.forEach((off) => off());
}, [orders]);
```

## Export the whole result

The bound table holds one page. To export what the list shows, read the source's whole result and hand it to the
table (`@iyulab/flex-table` 0.60):

```ts
await table.exportToFile('xlsx', 'orders.xlsx', { rows: await orders.fetchAll() });
```
