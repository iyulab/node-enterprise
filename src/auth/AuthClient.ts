/**
 * 쿠키 세션 인증 클라이언트 팩토리.
 *
 * 여러 소비앱이 동일하게 재작성하던 `fetchMe`/`login`/`logout` 흐름을 범용 primitive 로 승격.
 * **원시 `fetch`** 를 쓴다(HttpClient 의 401 인터셉터를 의도적으로 우회) — `fetchMe` 가 401 에
 * `null` 을 반환하는 것이 곧 "미인증" 신호이고, 이 신호가 로그인 게이트를 구동하기 때문.
 *
 * 사용자/자격증명 형태는 앱이 제네릭 타입으로 정의한다(라이브러리는 URL 을 호출만).
 * 권한 추출기(`getPermissions`)를 주면 `fetchMe`/`login` 성공 시 자동으로 권한 store 를 갱신한다.
 *
 * @example
 * interface User { Id: string; Permissions: string[] }
 * const auth = createAuthClient<User, { Username: string; Password: string }>({
 *   meUrl: '/api/auth/me', loginUrl: '/api/auth/login', logoutUrl: '/api/auth/logout',
 *   getPermissions: (u) => u.Permissions,   // → 성공 시 defaultPermissionStore 자동 set
 *   messages: { invalidCredentials: '사용자명 또는 비밀번호가 올바르지 않습니다.' },
 * })
 * const user = await auth.fetchMe()          // null → 미인증(로그인 게이트)
 */
import { defaultPermissionStore, type PermissionStore } from './permissions'

export interface AuthClientMessages {
  /** 401 로그인 실패 */
  invalidCredentials: string
  /** 기타 로그인 실패(non-401) 폴백 */
  loginFailed: string
  /** 네트워크/예외 */
  networkError: string
}

const DEFAULT_AUTH_MESSAGES: AuthClientMessages = {
  invalidCredentials: 'Invalid username or password.',
  loginFailed: 'Login failed.',
  networkError: 'A network error occurred.',
}

export interface LoginResult<TUser> {
  ok: boolean
  user?: TUser
  message?: string
}

export interface AuthClientConfig<TUser> {
  /** 현재 세션 조회 URL (GET) */
  meUrl: string
  /** 로그인 URL (POST, 자격증명을 JSON 바디로) */
  loginUrl: string
  /** 로그아웃 URL (POST) */
  logoutUrl: string
  /** 상대 URL 앞에 붙일 오리진(기본 '' = same-origin). */
  baseUrl?: string
  /** fetch credentials 모드(기본 'same-origin' — 쿠키 세션). */
  credentials?: RequestCredentials
  /** 사용자 대면 문구(로케일). 기본 영어. */
  messages?: Partial<AuthClientMessages>
  /** 로그인 실패(non-401) 응답 바디에서 서버 메시지 추출. 기본: `body.Message ?? body.message`. */
  extractLoginError?: (body: unknown) => string | undefined
  /**
   * user 에서 권한 코드 배열을 추출. 지정하면 `fetchMe`/`login` 성공 시 권한 store 를 자동 갱신,
   * `fetchMe`→null / `logout` 시 자동 clear.
   */
  getPermissions?: (user: TUser) => string[]
  /** 권한 자동 갱신 대상 store(기본: `defaultPermissionStore`). */
  permissionStore?: PermissionStore
}

export interface AuthClient<TUser, TCredentials> {
  /** 현재 세션 조회. 미인증/세션 만료 시 `null`. 성공 시 권한 store 자동 갱신(getPermissions 지정 시). */
  fetchMe(): Promise<TUser | null>
  /** 로그인. 성공 시 권한 store 자동 갱신(getPermissions 지정 시). */
  login(credentials: TCredentials): Promise<LoginResult<TUser>>
  /** 로그아웃. 권한 store 자동 clear(getPermissions 지정 시). */
  logout(): Promise<void>
}

function pickServerMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    const m = b.Message ?? b.message
    if (typeof m === 'string') return m
  }
  return undefined
}

export function createAuthClient<TUser, TCredentials = Record<string, unknown>>(
  config: AuthClientConfig<TUser>,
): AuthClient<TUser, TCredentials> {
  const messages: AuthClientMessages = { ...DEFAULT_AUTH_MESSAGES, ...config.messages }
  const credentials: RequestCredentials = config.credentials ?? 'same-origin'
  const baseUrl = config.baseUrl ?? ''
  const store = config.permissionStore ?? defaultPermissionStore
  const url = (u: string) => (baseUrl && u.startsWith('/') ? `${baseUrl}${u}` : u)

  const syncPermissions = (user: TUser | null) => {
    if (!config.getPermissions) return
    if (user) store.set(config.getPermissions(user))
    else store.clear()
  }

  async function fetchMe(): Promise<TUser | null> {
    try {
      const res = await fetch(url(config.meUrl), { credentials })
      if (!res.ok) {
        syncPermissions(null)
        return null
      }
      const user = (await res.json()) as TUser
      syncPermissions(user)
      return user
    } catch {
      syncPermissions(null)
      return null
    }
  }

  async function login(cred: TCredentials): Promise<LoginResult<TUser>> {
    try {
      const res = await fetch(url(config.loginUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials,
        body: JSON.stringify(cred),
      })
      if (res.status === 401) {
        return { ok: false, message: messages.invalidCredentials }
      }
      if (!res.ok) {
        let msg = messages.loginFailed
        try {
          const body = await res.json()
          const extracted = (config.extractLoginError ?? pickServerMessage)(body)
          if (extracted) msg = extracted
        } catch {
          /* ignore parse error — keep fallback */
        }
        return { ok: false, message: msg }
      }
      const user = (await res.json()) as TUser
      syncPermissions(user)
      return { ok: true, user }
    } catch {
      return { ok: false, message: messages.networkError }
    }
  }

  async function logout(): Promise<void> {
    try {
      await fetch(url(config.logoutUrl), { method: 'POST', credentials })
    } catch {
      /* swallow — 로그아웃 실패는 클라이언트 세션 정리를 막지 않는다 */
    }
    syncPermissions(null)
  }

  return { fetchMe, login, logout }
}
