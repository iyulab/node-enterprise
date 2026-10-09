---
name: iyulab-enterprise
description: Opinionated line-of-business (LOB) toolkit for web apps built on @iyulab/components — an OData v4 + REST data service factory with 401, toast and error handling, a cookie-session auth client with a permission store, React form layout blocks, an API URL config, formatting/urgency/progress helpers and an opt-in icon set. Use when working with @iyulab/enterprise — wiring createODataService or createAuthClient, handling ApiError, checking permissions, laying out forms with FormSection/FormRow, or loading the preset/icons.
license: MIT
metadata:
  author: iyulab
---

# @iyulab/enterprise

LOB building blocks for business apps. Domain concepts (entity lists, permission codes,
login endpoints, locale text) stay in **your app's adapter**; the library only receives
them through configuration.

## Install

```bash
npm install @iyulab/enterprise @iyulab/components
# React form components only:
npm install react
```

- `@iyulab/components` (`>=1.44.0`) is a **required** peer — the runtime imports its
  locale, formatting and icon utilities.
- `react` (`>=18`) is an **optional** peer, needed only for the `/react` subpath.

## Entry points

| Import | Contents | Side effects |
|---|---|---|
| `@iyulab/enterprise` | `createODataService`, `ApiError`, `wasNotified`, `createAuthClient`, permission store, `bindSource`, `SourceBinding`, `ApiConfig`, helpers | Registers the helper locale strings |
| `@iyulab/enterprise/react` | `FormSection`, `FormRow` | none |
| `@iyulab/enterprise/icons` | Registers the `'house'` icon library | opt-in: import once |

The root entry does **not** re-export `@iyulab/components`, `@iyulab/data-components` or
`@iyulab/modern-app` — import those packages directly.

## Data service (OData v4 + REST)

```ts
import { createODataService } from '@iyulab/enterprise'

export const svc = createODataService({
  baseUrl: window.location.origin,                 // origin only, no trailing slash
  onUnauthorized: () => { window.location.href = '/' },
  notify: { success: showToast, error: showErrorToast },
  onMutated: ({ source, target }) => invalidate(source === 'odata' ? target : 'api'),
})

const orders = await svc.odataGet<Order>('Orders', { $filter: "Status eq 'Open'" })
await svc.odataPatch<Order>('Orders', '7', { note: 'urgent' })   // toast: "Updated"
await svc.apiPost('auth/login', creds, { onUnauthorized: false }) // 401 = wrong credentials
```

- `odataGet` follows `@odata.nextLink` to the end; use `odataGetPage`/`odataGetNextPage`
  for paged screens, `maxRows` to fail loudly on unexpectedly large sets.
- Writes notify (error toast; success toast for `odata*` only). Reads never notify.
  `*Quiet` variants never notify.
- Every failure throws `ApiError` with `status`, `details` (OData `error.details`) and
  `notified`.

Full details: [references/odata.md](./references/odata.md).

## Auth + permissions

```ts
import { createAuthClient, hasPermission } from '@iyulab/enterprise'

export const auth = createAuthClient<User, { Username: string; Password: string }>({
  meUrl: '/api/auth/me', loginUrl: '/api/auth/login', logoutUrl: '/api/auth/logout',
  getPermissions: (u) => u.Permissions,   // keeps the permission store in sync
})

const user = await auth.fetchMe()          // null → not signed in
if (hasPermission('orders.write')) { /* show Save */ }
```

Full details: [references/auth.md](./references/auth.md).

## Form layout (React)

```tsx
import { FormSection, FormRow } from '@iyulab/enterprise/react'
import { UInput, UTextarea } from '@iyulab/components/react'

<FormSection title="General">
  <FormRow>
    <UInput label="Name" />
    <UInput label="Code" />
  </FormRow>
  <FormRow full>
    <UTextarea label="Notes" />
  </FormRow>
</FormSection>
```

`FormRow` is a 2-column grid of equal `minmax(0, 1fr)` tracks (`columns` changes the
count, `full` makes one cell). Both accept `className`/`style`, merged after the defaults.

## Other exports

- `ApiConfig` — static URL/environment config (`initialize`, `getODataUrl`, `getApiUrl`,
  `getUrlWithParams`, `isDevelopment`).
- `DateHelper`, `ProgressHelper`, `UrgencyHelper` — formatting and deadline/progress logic;
  labels come from the `messages` locale namespace (English and Korean built in).
- Currency and number formatting is not here — use `formatCurrency`/`formatNumber` from
  `@iyulab/components` (`CurrencyHelper` was removed in 0.29.0).

Details: [references/forms-and-helpers.md](./references/forms-and-helpers.md).

## Binding a list

`bindSource(source, element)` ties a data source of `@iyulab/flex-table` (`createODataSource`, `createArraySource`) to
an element that speaks the list view vocabulary — `flex-table`, `u-rich-table`, `u-data-view`, `u-pagination`, a
search box (`u-input type="search"`). It writes `data`, `totalCount`, `loading`, `error`, `sortCriteria`, `page`, `pageSize` (only those the
element has) and turns `sort-change`, `page-change` and `search` into source calls. `SourceBinding` is the Lit adapter.

`<u-list-page>` (`@iyulab/enterprise/list-page`; React: `ListPage` from `/react`) is the list screen as slots —
header, filters, toolbar, view, pager, empty, error. It binds its views and pager to `source`, shows the view named by
`view`, and swaps in the empty or error slot. It draws no table; the view in the slot does.

Details: [references/list.md](./references/list.md).

## Rules of thumb

1. Create **one** service/auth client in an app adapter module and import it everywhere.
2. Put locale text in `messages` config, not in call sites.
3. Keep entity names, permission codes and domain actions in the app — never ask this
   library to know them.
4. At a global error boundary, toast only failures where `wasNotified(err)` is `false`.
5. House values (type scale, radii, elevation) come from `@iyulab/house-style`, not from
   this package — `import '@iyulab/house-style'`.

## References

- [references/odata.md](./references/odata.md) — `createODataService`: reads, writes,
  `onMutated`, `notify`, 401 handling, `fetchRaw`, `ApiError`, `notified`/`wasNotified`,
  OData v4 conformance.
- [references/auth.md](./references/auth.md) — `createAuthClient`, permission store.
- [references/list.md](./references/list.md) — `bindSource`, `SourceBinding`, `u-list-page`: one wiring for table,
  cards, pager and search, and the list skeleton.
- [references/forms-and-helpers.md](./references/forms-and-helpers.md) — React form
  layout, `ApiConfig`, domain helpers, `./icons`, where the house values live.
