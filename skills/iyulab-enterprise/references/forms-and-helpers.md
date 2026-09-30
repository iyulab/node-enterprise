# Forms, API config, helpers, icons and preset

## Form layout — `@iyulab/enterprise/react`

React-only LOB layout blocks. `react` is an optional peer, so non-React apps never load it.
Lit/Vue apps should compose `@iyulab/components` elements directly.

```tsx
import { FormSection, FormRow } from '@iyulab/enterprise/react'

<FormSection title="General">
  <FormRow>
    <u-input label="Name" />
    <u-input label="Code" />
  </FormRow>
  <FormRow columns={3}>
    <u-input label="City" />
    <u-input label="Region" />
    <u-input label="Postcode" />
  </FormRow>
  <FormRow full>
    <u-textarea label="Notes" />
  </FormRow>
</FormSection>
```

### `FormSection` props

| Prop | Type | Purpose |
|---|---|---|
| `title` | `ReactNode` | Section heading (required) |
| `children` | `ReactNode` | Rows, stacked vertically with `--u-space-sm` gap |
| `className` | `string` | Added to the outer block |
| `style` | `CSSProperties` | Merged **after** the defaults (bottom margin `--u-space-xl`) |
| `titleStyle` | `CSSProperties` | Merged after the heading defaults — adjust only the title line |

The heading uses the `label` type-scale tokens (`--u-text-label-*`), a darkened
`--u-primary-color`, and a `--u-border-color-weak` underline. It applies no uppercase or
letter-spacing; for an overline look in Latin-only UIs, set it through `titleStyle`.

### `FormRow` props

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `children` | `ReactNode` | — | Cells |
| `columns` | `number` | `2` | Column count |
| `full` | `boolean` | — | Single full-width cell; takes precedence over `columns` |
| `className` | `string` | — | Added to the row |
| `style` | `CSSProperties` | — | Merged after the defaults |

Tracks are `repeat(columns, minmax(0, 1fr))` with `--u-space-sm` gap, so declared columns
stay equal even when one cell holds long content. Overflow of a long unbreakable string
inside a cell is the cell's concern (`overflow-wrap`).

Override contract: change content through `children` and props, and styling through
`className`/`style` and `--u-*` tokens. Do not reach into internal DOM, and do not copy the
component to tweak it.

## `ApiConfig` — static endpoint config

```ts
import { ApiConfig } from '@iyulab/enterprise'

ApiConfig.initialize({ baseUrl: 'https://api.example.com', odataPrefix: '$data', apiPrefix: 'api' })

ApiConfig.getODataUrl('Orders')              // https://api.example.com/$data/Orders
ApiConfig.getApiUrl('/auth/me')              // https://api.example.com/api/auth/me
ApiConfig.getUrlWithParams('report', { year: 2026, active: true, q: undefined })
                                             // https://api.example.com/api/report?year=2026&active=true
```

URLs are built as `${baseUrl}/${prefix}/…`. A trailing `/` on `baseUrl` and slashes around the
prefixes are ignored, so `''` and `'/'` both give same-origin root-relative URLs (`/$data/Orders`).

| Member | Purpose |
|---|---|
| `initialize(options)` | Set `baseUrl`, `odataPrefix`, `apiPrefix`, `isDevelopment` (only given keys change) |
| `baseUrl`, `odataPrefix`, `apiPrefix` | Current values (getters) |
| `setBaseUrl(url)` | Change `baseUrl` only |
| `getODataUrl(entityName)` | OData entity URL |
| `getApiUrl(endpoint)` | REST URL; a leading `/` in `endpoint` is stripped |
| `getUrlWithParams(endpoint, params)` | REST URL + query; `undefined` values are skipped |
| `isDevelopment` / `isProduction` | Forced value, else Vite `import.meta.env.DEV`, else `NODE_ENV === 'development'`, else production |
| `reset()` | Restore defaults |

`createODataService` has its own `baseUrl`/prefix options and does not read `ApiConfig`.

## Domain helpers

All helpers are static classes. Missing or unparsable input renders as
`EMPTY_VALUE_DISPLAY` (`'—'`), never as `0`.

### `DateHelper`

| Method | Result |
|---|---|
| `formatDate(date)` | `YYYY-MM-DD` — the local calendar date |
| `formatDateTime(date)` | `YYYY-MM-DD HH:mm` — local date and time |
| `formatLocalDate(date, locale = Locale.get(), options?)` | `toLocaleDateString` (default: numeric year, 2-digit month/day) |
| `getDaysDifference(start, end)` | Whole days, rounded up; positive when `end` is later |
| `getDaysFromNow(target)` | Days from today's midnight; negative when overdue |
| `isToday`, `isPast`, `isFuture` | `boolean` |
| `addDays(date, days)`, `startOfDay(date)`, `endOfDay(date)` | New `Date` (input not mutated) |

All methods use one time model — the local calendar. A date-only string (`'2026-09-29'`) is read as that
day in the local time zone; a string with a time and offset (`'…T18:30:00Z'`) is read as that instant.

### `UrgencyHelper`

Deadline levels: `UrgencyLevel` = `'overdue' | 'critical' | 'urgent' | 'soon' | 'normal'`.
Thresholds (`UrgencyConfig`): `critical` (default 1), `urgent` (3), `soon` (7) days.

| Method | Result |
|---|---|
| `getUrgencyLevel(daysRemaining, config?)` | Level (`null`/`undefined` → `'normal'`) |
| `getUrgencyColor(daysRemaining, config?)` | Hex color |
| `getUrgencyBadgeColors(daysRemaining, config?)` | `{ bg, text }` |
| `getUrgencyText(daysRemaining, config?, labels?)` | Localized label; `labels` overrides per level |
| `formatDaysRemaining(daysRemaining)` | e.g. `3 days left`, `Today`, `2 days overdue` |
| `isOverdue(daysRemaining)`, `needsAttention(daysRemaining, config?)` | `boolean` (attention = overdue/critical/urgent) |

```ts
const days = DateHelper.getDaysFromNow(order.dueDate)
const { bg, text } = UrgencyHelper.getUrgencyBadgeColors(days)
const label = UrgencyHelper.formatDaysRemaining(days)
```

### `ProgressHelper`

| Method | Result |
|---|---|
| `validateProgress(value, round = true)` | Clamped 0–100; `null` for missing/NaN input |
| `ratioToPercent(ratio, round = true)` | `ratio * 100`, clamped; `null` for missing input |
| `calculateProgress(current, total)` | Percentage; `0` when `total <= 0` |
| `getProgressColor(progress, { high = 80, medium = 40 }?)` | Green / orange / red hex |
| `getProgressLabel(progress)` | Localized stage label (`Not started` … `Done`) |
| `getProgressGradient(progress)` | CSS `linear-gradient` for a bar |

### `CurrencyHelper` (deprecated)

`formatCurrency(amount, currency = 'KRW', locale = 'ko-KR')`, `formatKRW`, `formatUSD`,
`formatEUR`, `formatJPY`, `formatCNY`, `parseCurrency(value)`. Logs a one-time deprecation
warning. New code should use `formatCurrency`/`formatNumber`/`formatDate` from
`@iyulab/components`.

### Localizing helper labels — `messages`

Labels come from a `Locale` namespace of `@iyulab/components` (`'@iyulab/enterprise'`),
with English and Korean built in. The active locale follows `Locale` from
`@iyulab/components` (browser language by default).

```ts
import { messages } from '@iyulab/enterprise'

messages.register('de', { urgencyOverdue: 'Überfällig', daysRemaining: 'noch {days} Tage' })
```

Keys (`EnterpriseMessageKey`): `progressNotStarted`, `progressEarly`, `progressInProgress`,
`progressPastMid`, `progressAlmost`, `progressDone`, `urgencyOverdue`, `urgencyCritical`,
`urgencyUrgent`, `urgencySoon`, `urgencyNormal`, `daysOverdue`, `daysToday`,
`daysRemaining` (`{days}` placeholder).

## Icons — `@iyulab/enterprise/icons`

Opt-in side-effect import. Registers ten navigation-style SVG icons as the icon library
`'house'` in the `@iyulab/components` icon registry:

`code`, `contrast`, `flow`, `home`, `identity`, `layers`, `layout`, `message`, `pulse`, `table`.

```ts
import '@iyulab/enterprise/icons'
```

```html
<u-icon lib="house" name="table"></u-icon>
```

The main entry does not register them; import the subpath once at app start.

## House-style preset — `@iyulab/enterprise/styles/preset.css`

An optional stylesheet that only sets values for `--u-*` tokens owned by
`@iyulab/components` on `:root` (plus dark shadows on `:root[theme='dark']`). It adds no
classes or selectors.

It sets: type scale (`--u-text-{display,title,subtitle,body,label,caption,overline}-{size,weight,leading,tracking}`,
denser than the neutral defaults), control radii (`--u-radius-sm` … `--u-radius-xl`), and
elevation (`--u-shadow-color-*`, `--u-shadow-sm` … `--u-shadow-xl`). It does not set brand
colors or the neutral ramp.

```ts
import '@iyulab/enterprise/styles/preset.css'
```

Layering is by load order (all three layers use `:root`, so the last one wins):

```
@iyulab/components defaults  →  enterprise preset  →  your brand overrides
```

- Requires `@iyulab/components` 1.44.0+, whose theme stylesheet is inserted before the first
  stylesheet so the preset wins. With older versions the defaults silently win.
- Load your own brand overrides after the preset.
- The overline tier has positive tracking for Latin labels; set
  `--u-text-overline-tracking: 0` if you use it for CJK text.
- If the preset seems to have no effect, check the `@iyulab/components` version first,
  then stylesheet order.
