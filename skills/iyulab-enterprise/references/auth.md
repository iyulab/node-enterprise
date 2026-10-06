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
| `sessionCheckFailed` | `fetchMe` gets a non-2xx other than 401 and no server message is found | `Could not verify the session.` |
| `logoutFailed` | `logout` gets a non-2xx other than 401 and no server message is found | `Could not sign out.` |
| `networkError` | No response at all (network failure, offline) | `A network error occurred.` |
| `invalidResponse` | A 2xx response whose body is not JSON | `The server returned an unreadable response.` |

The client uses plain `fetch`, deliberately bypassing any HTTP interceptors: a 401 from
`meUrl` is the "not signed in" signal, not an error to redirect on.

### Methods (`AuthClient<TUser, TCredentials>`)

| Method | Returns | Behaviour |
|---|---|---|
| `fetchMe()` | `Promise<SessionState<TUser>>` | One of three answers, below. Never throws |
| `login(credentials)` | `Promise<LoginResult<TUser>>` | Never throws; see below |
| `logout()` | `Promise<LogoutResult>` | POSTs to `logoutUrl`. Never throws; see below |

`SessionState<TUser>` — a session lookup has three answers, and only one of them means
"sign in":

| `status` | When | Extra field |
|---|---|---|
| `'authenticated'` | 2xx with the user | `user` |
| `'anonymous'` | The server answered **401** | — |
| `'unknown'` | Any other non-2xx, no response (network/offline), or an unreadable 2xx body | `error: ApiError` (`status` is `0` when there was no response) |

`LoginResult<TUser>` is `{ ok: true, user }` or `{ ok: false, message, error }`. `message` is
user-facing (`invalidCredentials` for 401, else the server message, else `loginFailed`;
`networkError` with no response). `error` is an `ApiError` carrying `status`, the server's `code`
and `details` read from the same error envelope as the data service — branch on them:

```ts
const result = await auth.login({ Username: name, Password: pw })
if (result.ok) {
  startApp(result.user)
} else if (result.error.status === 403 && result.error.code === 'password-change-required') {
  showChangePassword()
} else {
  showError(result.message)
}
```

### Boot gate

```ts
const session = await auth.fetchMe()
if (session.status === 'authenticated') startApp(session.user)
else if (session.status === 'anonymous') showLoginScreen()   // the library never redirects
else showUnavailable(session.error)                            // unknown: do not send them to sign in
```

Treating `unknown` as signed out logs everyone out the moment the server briefly returns 503 or
the device goes offline. Keep the current screen (or an offline view) and retry instead.

### Automatic permission sync

`LogoutResult` is `{ ok: true }` or `{ ok: false, message, error }`. With a cookie session, signing out
*is* the server ending the session — so only 2xx and **401** (the session is already gone) are success.
Any other answer, or no answer, means the cookie may still be valid: keep the screen, say `message`,
and let the user retry. Treating it as signed out would hand the session to the next person at a shared
terminal.

```ts
const r = await auth.logout();
if (r.ok) navigate('/login');
else Toast.error(r.message);
```

When `getPermissions` is set:

| Event | Store action |
|---|---|
| `fetchMe()` gives `authenticated`, `login()` succeeds | `store.set(getPermissions(user))` |
| `fetchMe()` gives `anonymous` | `store.clear()` |
| `fetchMe()` gives `unknown` | nothing: the last known permissions stay (a store never answered stays *not known*) |
| `logout()` succeeds (2xx or 401) | `store.clear()` |
| `logout()` fails | nothing: the session is still alive, so its permissions stay |

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
| `permissionsKnown()` | Whether the default store has been answered yet (`isKnown()`) |

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
| `clear()` | Empty the set: known, with no permissions. Notifies only if something changed |
| `isKnown()` | `false` until the first `set`/`clear` (unless created with `initial`) |
| `subscribe(listener)` | `listener(codes)` on every change, including becoming known; returns an unsubscribe function |

**Not known is not "no permissions".** Right after boot, and while the session is `unknown`,
`has()` returns `false` because nothing has been answered yet. A UI that hides or disables
controls on `has() === false` should wait while `isKnown()` is `false`, so menus do not render as
forbidden and then flip.

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
