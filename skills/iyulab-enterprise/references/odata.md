# Data service — `createODataService`

One factory builds an OData v4 + custom REST client with session (401) handling, error
message extraction, toasts, write notifications and safe parsing of empty (204) bodies.
The returned service is a stateless closure — creating several is safe.

```ts
import { createODataService } from '@iyulab/enterprise'

export const svc = createODataService({
  baseUrl: window.location.origin,
  onUnauthorized: () => { window.location.href = '/' },
  notify: { success: (m) => toast.success(m), error: (m) => toast.error(m) },
  messages: { saved: 'Saved', sessionExpired: 'Please sign in again.' },
})
```

## Configuration (`ODataServiceConfig`)

| Option | Type | Default | Purpose |
|---|---|---|---|
| `baseUrl` | `string` | required | Origin for every request, without trailing slash |
| `odataPrefix` | `string` | `'$data'` | OData path prefix → `${baseUrl}/${odataPrefix}/Entity` |
| `apiPrefix` | `string` | `'api'` | REST path prefix → `${baseUrl}/${apiPrefix}/path` |
| `onUnauthorized` | `(status) => void` | — | Called on 401. Redirects and re-entry guards are the app's job |
| `notify` | `{ success?, error? }` | — | Toast hooks. Omit for no toasts |
| `onMutated` | `(mutation) => void` | — | Called once after each successful write |
| `messages` | `Partial<ODataServiceMessages>` | English | Override only the keys you set |
| `formatError` | `(info) => string \| undefined` | — | Custom error message; return `undefined` to fall through |

`messages` keys: `saved`, `updated`, `deleted` (success toasts), `sessionExpired` (401
error message), `requestFailed` (fallback), `http` (status → message map; defaults for
400, 403, 404, 409, 500; your entries are merged in).

`formatError` receives `{ status, statusText, rawMessage?, code?, details?, body? }`.
Message resolution order: `formatError` result → server message (if ≤ 200 chars) →
`messages.http[status]` → `` `${requestFailed} (${status})` ``. The server message is read
from `error.message`, then top-level `message`, then `Message`.

## URLs

| Member | Returns |
|---|---|
| `odataUrl(entity)` | `${baseUrl}/${odataPrefix}/${entity}` |
| `apiUrl(path)` | `${baseUrl}/${apiPrefix}/${path}` (leading `/` stripped) |
| `sourceDefaults` | `{ baseUrl, onUnauthorized }` for table data sources with their own fetcher (e.g. `useODataSource` from `@iyulab/flex-table/react`) so they get the same 401 handling. `onUnauthorized(response)` forwards only a 401 — a 403 is not a session expiry and stays the table's own error |
| `ApiError` | The `ApiError` class, for `instanceof` without an extra import |

## Reads

| Method | Result | Notes |
|---|---|---|
| `odataGet<T>(entity, params?, opts?)` | `T[]` | Unwraps `value`; follows every `@odata.nextLink` |
| `odataGetPage<T>(entity, params?, opts?)` | `ODataPage<T>` | One page: `{ value, nextLink?, count? }` |
| `odataGetNextPage<T>(nextLink, opts?)` | `ODataPage<T>` | Pass `nextLink` unchanged — never rebuild it |
| `odataGetById<T>(entity, id, opts?)` | `T` | Requests `Entity(id)` |
| `odataCount(entity, filter?, opts?)` | `number` | `$top=0&$count=true`; `filter` is an `odata-query` filter object |
| `apiGet<T>(path, opts?)` | `T` | Query string inside `path` is allowed; empty body → `undefined` |

`params` is a `Record<string, string>` of raw query options (`$filter`, `$orderby`,
`$select`, `$expand`, `$top`, `$count`, …).

```ts
// All rows, but fail instead of silently loading a huge set
const rows = await svc.odataGet<Order>('Orders', undefined, { maxRows: 5000 })

// Paged screen
const page = await svc.odataGetPage<Order>('Orders', { $top: '50', $count: 'true' })
if (page.nextLink) {
  const more = await svc.odataGetNextPage<Order>(page.nextLink)
}
```

`odataGet` throws rather than returning a partial list when:
- a `nextLink` points outside the service origin, or repeats an already-read page (`Error`);
- the collected rows exceed `maxRows` (`RangeError`). `maxRows` must be a positive integer.
  A collection with exactly `maxRows` rows passes.

`odataGetPage`/`odataGetNextPage` apply the same origin rule to `nextLink`.

## Writes

| Method | HTTP | Error toast | Success toast |
|---|---|---|---|
| `odataPost<T>(entity, body, opts?)` → `T` | POST | yes (except 401) | `messages.saved` |
| `odataPatch<T>(entity, id, body, opts?)` → `void` | PATCH `Entity(id)` | yes (except 401) | `messages.updated` |
| `odataDelete(entity, id, opts?)` → `void` | DELETE `Entity(id)` | yes (except 401) | `messages.deleted` |
| `apiPost` / `apiPut` / `apiPatch` `<T>(path, body?, opts?)` → `T` | POST/PUT/PATCH | yes (except 401) | none |
| `apiDelete<T = void>(path, opts?)` → `T` | DELETE | yes (except 401) | none |
| `odataPostQuiet`, `odataPatchQuiet`, `odataDeleteQuiet`, `apiPostQuiet`, `apiPutQuiet`, `apiPatchQuiet`, `apiDeleteQuiet` | same | no | no |

- `odata*` writes normalize `''` to `null` in the body (many OData servers reject empty strings).
- `api*` writes send `{}` when `body` is omitted. A `FormData` body is sent as multipart
  unchanged; the browser sets `Content-Type` with the boundary.
- Responses with an empty body parse to `undefined`.
- `api*` has no success toast because the library cannot phrase success for an arbitrary
  RPC — show one from the caller if needed.
- Use `*Quiet` when one user action issues several requests, or when your own wrapper
  already notifies (avoids double toasts).

## Notification policy (`notify`)

The axis is **write vs read**, not OData vs REST:

- Reads (`odataGet*`, `odataGetById`, `odataCount`, `apiGet`, `fetchRaw`) never call `notify`.
- Non-quiet writes call `notify.error(message)` on failure, then **re-throw** the same error.
- 401 never toasts — `onUnauthorized` already handles it.

## `onMutated` — invalidate after writes

```ts
createODataService({
  baseUrl: window.location.origin,
  onMutated: ({ method, source, target, id }) => cache.invalidate(target),
})
```

`ODataMutation` fields:

| Field | Value |
|---|---|
| `method` | `'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'` |
| `source` | `'odata' \| 'api'` |
| `target` | Entity set name (`odata`) or the path passed to the call (`api`) |
| `id` | Key, only for `odataPatch*` / `odataDelete*` |

- Fires once per **successful** write, including `*Quiet` variants, regardless of toasts.
- Never fires for failed writes or for reads.
- If the callback throws, the write still succeeds; the error goes to `reportError`
  (or `console.error`).

## 401 handling

Default (global policy): on 401 the service calls `onUnauthorized(401)` and throws
`ApiError(messages.sessionExpired, 401)`.

Per-call escape hatch — every read/write method takes a last `opts` argument
(`ODataRequestOptions`; its other fields are below) with `onUnauthorized?: false`:

```ts
// Login: 401 means "wrong credentials", not "session expired".
try {
  await svc.apiPost('auth/login', creds, { onUnauthorized: false })
} catch (e) {
  if (e instanceof ApiError && e.status === 401) showLoginError(e.message) // server's reason
}
```

With `false`, the hook is not called and the message is not replaced — the 401 is treated
like any other status. Omitting `opts` keeps the global behaviour. There is no
`authenticate()` helper by design: endpoint paths and body shapes belong to the app.

## Cancelling a call (`signal`)

`opts.signal` is a standard `AbortSignal`. A cancelled call rejects with **`signal.reason` itself**
(an `AbortError` `DOMException` by default) — not `ApiError` — and neither `notify.error` nor
`onMutated` runs: a request the user dropped is not a failure. An already-aborted signal sends
nothing.

```ts
let current: AbortController | undefined
async function pick(x: number, y: number) {
  current?.abort()                 // drop the previous click's request
  current = new AbortController()
  try {
    return await svc.apiGet(`hit?x=${x}&y=${y}`, { signal: current.signal })
  } catch (e) {
    if (current.signal.aborted) return undefined   // superseded — ignore
    throw e
  }
}
```

## Optimistic concurrency (`ifMatch` · `etagOf`)

A server that declares a concurrency token returns `@odata.etag` on every entity (and an `ETag`
header on a single-entity GET) and honours `If-Match`. Read the tag with `etagOf(entity)` and send
it back with the write; if someone changed the record in between, the server answers 412 and the
service throws `ApiError(messages.http[412], 412)` (notified like any write failure).

```ts
import { etagOf, ApiError } from '@iyulab/enterprise'

const order = await svc.odataGetById<Order>('Orders', id)
try {
  await svc.odataPatch('Orders', id, changes, { ifMatch: etagOf(order) })
} catch (e) {
  if (e instanceof ApiError && e.status === 412) reloadAndShowConflict()
}
```

The tag is opaque — do not read, compare or compute the row-version field; pass the tag back.
`odataGetById` copies the `ETag` header into `@odata.etag` when the body has none, so `etagOf`
is the one way to read it. Without `ifMatch` a write is unconditional, as before.

## `fetchRaw(url)`

Returns the `HttpResponse` from `@iyulab/http-client` **as is**: it does not throw on
non-2xx and does not call `onUnauthorized`. It takes only a URL (no `opts`). Use it for
hand-built URLs such as CSV export or a reachability probe:

```ts
const res = await svc.fetchRaw(svc.apiUrl('ping'))
// Reaching this line means the server answered — even a 401 proves it is reachable.
if (!res.ok) { /* decide yourself */ }
```

Want exceptions, toasts and session handling? Use `apiGet` instead.

## `ApiError`

Every service method except `fetchRaw` throws `ApiError extends Error` for a non-2xx response.
Network failures surface as the underlying error, and the paging guards above throw
`Error`/`RangeError`.

| Member | Meaning |
|---|---|
| `message` | User-facing message (see resolution order above) |
| `status` | HTTP status |
| `code` | The server's rejection code — OData `error.code` (top-level `code` when there is no envelope); `undefined` when absent or empty. Branch on it to tell apart failures that share a status |
| `details` | `ApiErrorDetail[] \| undefined` from OData `error.details` |
| `notified` | Read-only: `true` if the service already showed this failure via `notify.error` |

Each `ApiErrorDetail` has `code` and `message` (required) and `target` (optional property
name). Only entries with string `code` and `message` are kept; an empty result becomes
`undefined`, so `if (e.details)` is reliable.

```ts
try {
  await svc.odataPost('Roles', draft)
} catch (e) {
  if (e instanceof ApiError && e.details) {
    for (const d of e.details) if (d.target) markFieldError(d.target, d.message)
  }
}
```

## `notified` / `wasNotified` — avoid double toasts at the boundary

Write failures are toasted and re-thrown. At a global handler, toast only what the
service did not:

```ts
import { ApiError, wasNotified } from '@iyulab/enterprise'

window.addEventListener('unhandledrejection', (ev) => {
  const err = ev.reason
  if (err instanceof ApiError || wasNotified(err)) ev.preventDefault()
  if (err instanceof ApiError && !err.notified) toast.error(err.message) // e.g. read failures
})
```

- `wasNotified(err)` also works for non-`ApiError` failures (e.g. a network error on a write).
- `notified` is `false` for reads, `*Quiet` calls, 401s, and services without `notify.error`.
- Only the service can set the mark; it is not a writable field on the error.

## OData v4 conformance

| Feature | Status | Notes |
|---|---|---|
| Server-driven paging (`@odata.nextLink`, relative or absolute) | Supported | Followed opaquely, query bytes preserved; other-origin and cyclic links throw |
| `$count=true` → `@odata.count` | Supported | `ODataPage.count`, `odataCount` |
| Error envelope `error.code` / `message` / `details[]` | Supported | Mapped to `ApiError`; `innererror` is not carried |
| 201 Created, 204 No Content | Supported | Empty bodies are not parsed |
| Key literals in URLs | Caller | `id` is inserted verbatim: GUIDs and numbers as is; quote string keys yourself (`'A''B'`) |
| Optimistic concurrency (ETag, `If-Match`, 412) | Not implemented | |
| `Prefer`, `$batch`, `@odata.deltaLink` | Not implemented | |
| `429` / `Retry-After` | Not implemented | Thrown as `ApiError`, no retry |
