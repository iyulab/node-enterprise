# Auth — `createAuthClient` and the permission store

A cookie-session auth client (`fetchMe` / `login` / `logout`) plus a framework-neutral
permission snapshot store. The user and credential shapes are **generic** — the app
defines them. Permission codes are opaque strings; their meaning belongs to the app.

## `createAuthClient<TUser, TCredentials>(config)`

```ts
import { createAuthClient } from '@iyulab/enterprise'

interface User { Id: string; Name: string; Permissions: string[] }

export const auth = createAuthClient<User, { Username: string; Password: string }>({
  meUrl: '/api/auth/me',
  loginUrl: '/api/auth/login',
  logoutUrl: '/api/auth/logout',
  getPermissions: (u) => u.Permissions,
  messages: { invalidCredentials: 'Wrong username or password.' },
})
```

`TCredentials` defaults to `Record<string, unknown>`.

### Configuration (`AuthClientConfig<TUser>`)

| Option | Type | Default | Purpose |
|---|---|---|---|
| `meUrl` | `string` | required | Current-session endpoint (GET) |
| `loginUrl` | `string` | required | Login endpoint (POST, credentials as JSON body) |
| `logoutUrl` | `string` | required | Logout endpoint (POST) |
| `baseUrl` | `string` | `''` | Prefixed to URLs that start with `/` (empty = same origin) |
| `credentials` | `RequestCredentials` | `'same-origin'` | `fetch` credentials mode (cookie session) |
| `messages` | `Partial<AuthClientMessages>` | English | Override only the keys you set |
| `extractLoginError` | `(body) => string \| undefined` | `body.Message ?? body.message` | Server message for non-401 login failures |
| `getPermissions` | `(user) => string[]` | — | Enables automatic permission-store sync |
| `permissionStore` | `PermissionStore` | `defaultPermissionStore` | Store to sync into |

`messages` keys:

| Key | Used when | Default |
|---|---|---|
| `invalidCredentials` | Login returns 401 | `Invalid username or password.` |
| `loginFailed` | Login returns another non-2xx and no server message is found | `Login failed.` |
| `networkError` | The login request throws | `A network error occurred.` |

The client uses plain `fetch`, deliberately bypassing any HTTP interceptors: a 401 from
`meUrl` is the "not signed in" signal, not an error to redirect on.

### Methods (`AuthClient<TUser, TCredentials>`)

| Method | Returns | Behaviour |
|---|---|---|
| `fetchMe()` | `Promise<TUser \| null>` | `null` for any non-2xx response or network error. Never throws |
| `login(credentials)` | `Promise<LoginResult<TUser>>` | Never throws; see below |
| `logout()` | `Promise<void>` | POSTs to `logoutUrl`; network errors are swallowed |

`LoginResult<TUser>` fields: `ok`, `user` (on success), `message` (on failure).

```ts
const result = await auth.login({ Username: name, Password: pw })
if (result.ok) {
  startApp(result.user)
} else {
  showError(result.message)   // invalidCredentials / server message / loginFailed / networkError
}
```

### Boot gate

```ts
const user = await auth.fetchMe()
if (!user) showLoginScreen()      // the library never redirects
else startApp(user)
```

### Automatic permission sync

When `getPermissions` is set:

| Event | Store action |
|---|---|
| `fetchMe()` succeeds, `login()` succeeds | `store.set(getPermissions(user))` |
| `fetchMe()` returns `null` | `store.clear()` |
| `logout()` (always, even if the request fails) | `store.clear()` |

Without `getPermissions` the store is never touched — call `setPermissions` yourself.

## Permission store

A snapshot of the current user's permission codes, taken at boot/login. Changes on the
server are not reflected until the next `set` (e.g. next login or `fetchMe`); use
`subscribe` if the UI must react to updates.

### Free functions (bound to `defaultPermissionStore`)

| Function | Purpose |
|---|---|
| `setPermissions(codes)` | Replace the whole set |
| `getPermissions()` | Current `ReadonlySet<string>` |
| `hasPermission(code)` | Has one code |
| `hasAnyPermission(codes)` | Has at least one; an empty list returns `true` |
| `hasAllPermissions(codes)` | Has all; an empty list returns `true` |
| `clearPermissions()` | Empty the set |

```ts
import { hasPermission, hasAnyPermission } from '@iyulab/enterprise'

if (hasPermission('orders.write')) renderSaveButton()
if (hasAnyPermission(['reports.view', 'reports.admin'])) renderReportsLink()
```

### `PermissionStore` interface

| Member | Purpose |
|---|---|
| `set(codes)` | Replace the set and notify subscribers |
| `get()` | Current `ReadonlySet<string>` |
| `has(code)` | Has one code |
| `hasAny(codes)` | At least one (empty → `true`) |
| `hasAll(codes)` | All (empty → `true`) |
| `clear()` | Empty the set; notifies only if it was non-empty |
| `subscribe(listener)` | `listener(codes)` on every change; returns an unsubscribe function |

### Isolated stores

`createPermissionStore(initial?)` returns an independent store — useful for tests or
several contexts in one page. Pass it to the auth client via `permissionStore`:

```ts
import { createAuthClient, createPermissionStore } from '@iyulab/enterprise'

const adminPerms = createPermissionStore()
const adminAuth = createAuthClient<User>({
  meUrl: '/admin/me', loginUrl: '/admin/login', logoutUrl: '/admin/logout',
  getPermissions: (u) => u.Permissions,
  permissionStore: adminPerms,
})

const off = adminPerms.subscribe((codes) => rerender(codes))
```

### React: re-render on change

```tsx
import { useSyncExternalStore } from 'react'
import { defaultPermissionStore } from '@iyulab/enterprise'

export function useCan(code: string): boolean {
  return useSyncExternalStore(
    defaultPermissionStore.subscribe,
    () => defaultPermissionStore.has(code),
  )
}
```

## Boundaries

- Domain checks (e.g. "is this a portal user") and permission-code constants live in the
  app, not in this library.
- Pair with `createODataService` by calling `apiPost(loginUrl, creds, { onUnauthorized: false })`
  only if you prefer the data service over `auth.login` — do not use both for the same login.
