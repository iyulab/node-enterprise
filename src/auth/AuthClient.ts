/**
 * 쿠키 세션 인증 클라이언트 팩토리.
 *
 * 여러 소비앱이 동일하게 재작성하던 `fetchMe`/`login`/`logout` 흐름을 범용 primitive 로 승격.
 * **원시 `fetch`** 를 쓴다(HttpClient 의 401 인터셉터를 의도적으로 우회) — `fetchMe` 의 401 이 곧
 * "미인증" 신호이고, 이 신호가 로그인 게이트를 구동하기 때문.
 *
 * 세션 조회의 답은 **셋**이다 — 인증됨 · 미인증(서버가 401 로 «아니다» 라고 답함) · 모름(5xx·네트워크
 * 실패처럼 답을 못 받음). «모름» 을 «미인증» 으로 접으면 서버가 잠깐 내려간 순간 로그인된 사용자가 로그인
 * 화면으로 가므로, `fetchMe` 는 셋을 가르고 «모름» 에는 권한 store 를 건드리지 않는다.
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
 * const session = await auth.fetchMe()
 * if (session.status === 'anonymous') showLogin()          // 미인증 — 로그인 게이트
 * else if (session.status === 'unknown') showOffline(session.error)  // 모름 — 화면 유지 · 재시도
 */
import { ApiError } from '../data/ODataService'
import { readErrorEnvelope } from '../data/error-envelope'
import { defaultPermissionStore, type PermissionStore } from './permissions'

export interface AuthClientMessages {
  /** 401 로그인 실패 */
  invalidCredentials: string
  /** 기타 로그인 실패(non-401) 폴백 — 서버 메시지가 없을 때 */
  loginFailed: string
  /** 세션 조회가 2xx·401 이 아닌 답을 받았을 때의 폴백 — 서버 메시지가 없을 때 */
  sessionCheckFailed: string
  /** 응답을 받지 못함(네트워크·오프라인) */
  networkError: string
  /** 2xx 응답의 본문을 읽지 못함 */
  invalidResponse: string
}

const DEFAULT_AUTH_MESSAGES: AuthClientMessages = {
  invalidCredentials: 'Invalid username or password.',
  loginFailed: 'Login failed.',
  sessionCheckFailed: 'Could not verify the session.',
  networkError: 'A network error occurred.',
  invalidResponse: 'The server returned an unreadable response.',
}

/**
 * 세션 조회 결과 — `status` 로 가른다.
 * - `authenticated`: 2xx 로 사용자를 받았다.
 * - `anonymous`: 서버가 401 로 «세션 없음» 이라 답했다. 로그인 화면으로 보낼 자리.
 * - `unknown`: 답을 못 받았다(401 이 아닌 비-2xx · 네트워크 실패 · 읽을 수 없는 본문). 세션이 있는지
 *   모르므로 로그인 화면으로 보내지 말고 «닿지 못함» 을 알린 뒤 재시도할 자리. `error.status` 는 응답이 없던
 *   실패에서 `0` 이다.
 */
export type SessionState<TUser> =
  | { status: 'authenticated'; user: TUser }
  | { status: 'anonymous' }
  | { status: 'unknown'; error: ApiError }

/**
 * 로그인 결과 — 실패에도 `error`(`status`·`code`·`details`)가 실려, 401(자격 증명) · 429(시도 제한) ·
 * 서버 거절 코드(예: 403 `password-change-required`)로 화면을 가를 수 있다. `message` 는 사용자 대면 문구다.
 * 응답이 없던 실패의 `error.status` 는 `0` 이다.
 */
export type LoginResult<TUser> =
  | { ok: true; user: TUser }
  | { ok: false; message: string; error: ApiError }

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
  /**
   * 로그인 실패(non-401) 응답 바디에서 사용자 대면 메시지 추출. 기본: OData 봉투 `error.message` →
   * `message` → `Message`. `error.code`·`error.details` 는 이 함수와 무관하게 `LoginResult.error` 에 실린다.
   */
  extractLoginError?: (body: unknown) => string | undefined
  /**
   * user 에서 권한 코드 배열을 추출. 지정하면 «인증됨» 에서 권한 store 를 갱신하고, «미인증»·`logout` 에서
   * 비운다. «모름» 에는 건드리지 않는다(마지막으로 알던 권한이 남고, 처음이면 store 는 계속 «모름»).
   */
  getPermissions?: (user: TUser) => string[]
  /** 권한 자동 갱신 대상 store(기본: `defaultPermissionStore`). */
  permissionStore?: PermissionStore
}

export interface AuthClient<TUser, TCredentials> {
  /** 현재 세션 조회. 던지지 않는다 — 결과는 `SessionState` 의 셋 중 하나다. */
  fetchMe(): Promise<SessionState<TUser>>
  /** 로그인. 던지지 않는다. 성공 시 권한 store 자동 갱신(getPermissions 지정 시). */
  login(credentials: TCredentials): Promise<LoginResult<TUser>>
  /** 로그아웃. 권한 store 자동 clear(getPermissions 지정 시). */
  logout(): Promise<void>
}

/** 본문을 JSON 으로 읽는다 — 비었거나 JSON 이 아니면 undefined. */
async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

/**
 * 실패 응답을 `ApiError` 로. 메시지는 `pickMessage`(소비자 추출기)가 있으면 그 결과, 없으면 서버 문장 —
 * 서버 문장은 200자를 넘으면(내부 스택 등) 쓰지 않는다. 둘 다 없으면 `fallback`.
 */
async function failureFrom(res: Response, fallback: string, pickMessage?: (body: unknown) => string | undefined): Promise<ApiError> {
  const body = await readJson(res)
  const { rawMessage, code, details } = readErrorEnvelope(body)
  const picked = pickMessage ? pickMessage(body) : rawMessage
  const message = (pickMessage ? picked : picked && picked.length <= 200 ? picked : undefined) || fallback
  return new ApiError(message, res.status, { code, details })
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

  async function fetchMe(): Promise<SessionState<TUser>> {
    let res: Response
    try {
      res = await fetch(url(config.meUrl), { credentials })
    } catch {
      return { status: 'unknown', error: new ApiError(messages.networkError, 0) }
    }
    if (res.status === 401) {
      syncPermissions(null)
      return { status: 'anonymous' }
    }
    if (!res.ok) {
      return { status: 'unknown', error: await failureFrom(res, messages.sessionCheckFailed) }
    }
    let user: TUser
    try {
      user = (await res.json()) as TUser
    } catch {
      return { status: 'unknown', error: new ApiError(messages.invalidResponse, res.status) }
    }
    syncPermissions(user)
    return { status: 'authenticated', user }
  }

  async function login(cred: TCredentials): Promise<LoginResult<TUser>> {
    let res: Response
    try {
      res = await fetch(url(config.loginUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials,
        body: JSON.stringify(cred),
      })
    } catch {
      return { ok: false, message: messages.networkError, error: new ApiError(messages.networkError, 0) }
    }
    if (!res.ok) {
      // 401 은 자격 증명 문구로 고정한다 — 서버 문장(«Unauthorized» 등)보다 사용자에게 맞는 말이다.
      const error =
        res.status === 401
          ? await failureFrom(res, messages.invalidCredentials, () => messages.invalidCredentials)
          : await failureFrom(res, messages.loginFailed, config.extractLoginError)
      return { ok: false, message: error.message, error }
    }
    let user: TUser
    try {
      user = (await res.json()) as TUser
    } catch {
      const error = new ApiError(messages.invalidResponse, res.status)
      return { ok: false, message: error.message, error }
    }
    syncPermissions(user)
    return { ok: true, user }
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
