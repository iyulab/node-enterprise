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
| listens | `search { query }` | `setSearch(query)` — `u-select searchable` fires this shape |

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
