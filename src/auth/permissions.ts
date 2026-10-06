/**
 * 권한 스냅샷 store — 부팅 시점의 현재 사용자 권한 코드 집합을 보관하고
 * `hasPermission`/`hasAny`/`hasAll` 판정을 제공한다. 프레임워크 무관(React·Lit 공통)이며
 * 권한 코드는 **불투명 문자열**로만 다룬다(도메인 의미는 앱이 소유).
 *
 * 부팅 시점 스냅샷 모델 — 권한 변경은 다음 로그인(재-set)까지 반영되지 않는다. 단일 운영자
 * 모델에 충분하며, 실시간 권한 회수/멀티테넌트가 필요하면 `subscribe` 로 반응형 확장 가능.
 *
 * **«알려짐» 축**: 아직 아무도 권한을 묻지 않았거나(부팅 직후) 물었지만 답을 못 받은 동안 store 는
 * «모름» 이고, 그때의 빈 집합은 «권한 없음» 이 아니다. `set`·`clear` 가 store 를 «알려짐» 으로 만든다
 * (`clear` = 알려진 빈 권한 — 로그아웃·미인증). 메뉴·버튼을 거르는 소비자는 `isKnown()` 이 거짓인 동안
 * 숨기지도 막지도 말고 기다리면 된다.
 */
export interface PermissionStore {
  /** 현재 권한 집합을 통째로 교체한다(로그인/세션 조회 성공 시). */
  set(codes: Iterable<string>): void
  /** 현재 권한 집합(읽기 전용). */
  get(): ReadonlySet<string>
  /** 단일 권한 코드 보유 여부. */
  has(code: string): boolean
  /** 주어진 코드 중 하나라도 보유. 빈 목록은 `true`(제약 없음). */
  hasAny(codes: Iterable<string>): boolean
  /** 주어진 코드를 모두 보유. 빈 목록은 `true`. */
  hasAll(codes: Iterable<string>): boolean
  /** 권한을 비운다(로그아웃/세션 만료 시) — 알려진 «권한 없음» 이 된다. */
  clear(): void
  /**
   * 권한이 알려졌는가 — `set`·`clear` 뒤 참. 초기값 없이 만든 store 는 처음에 거짓이고,
   * 그동안의 빈 집합은 «권한 없음» 이 아니라 «아직 모름» 이다.
   */
  isKnown(): boolean
  /** 권한 또는 «알려짐» 변경 구독. 해제 함수를 반환한다. */
  subscribe(listener: (codes: ReadonlySet<string>) => void): () => void
}

/**
 * 독립적인 권한 store 를 생성한다(테스트 격리·다중 컨텍스트에 유리). `initial` 을 주면 처음부터
 * «알려짐» 이고, 주지 않으면 «모름» 으로 시작한다.
 */
export function createPermissionStore(initial?: Iterable<string>): PermissionStore {
  let codes = new Set(initial ?? [])
  let known = initial !== undefined
  const listeners = new Set<(codes: ReadonlySet<string>) => void>()
  const emit = () => {
    for (const l of listeners) l(codes)
  }
  return {
    set(next) {
      codes = new Set(next)
      known = true
      emit()
    },
    get() {
      return codes
    },
    has(code) {
      return codes.has(code)
    },
    hasAny(list) {
      const arr = [...list]
      if (arr.length === 0) return true
      return arr.some((c) => codes.has(c))
    },
    hasAll(list) {
      return [...list].every((c) => codes.has(c))
    },
    clear() {
      if (known && codes.size === 0) return
      codes = new Set()
      known = true
      emit()
    },
    isKnown() {
      return known
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * 기본 싱글톤 권한 store. 앱 전역에서 `hasPermission(code)` 를 어디서나 호출하는
 * 흔한 패턴을 위해 free 함수로 바인딩해 노출한다. 격리가 필요하면 `createPermissionStore()` 를 쓴다.
 */
export const defaultPermissionStore: PermissionStore = createPermissionStore()

/** 기본 store 의 권한을 교체한다(부팅 시 `setPermissions(user.Permissions)`). */
export const setPermissions = (codes: Iterable<string>): void => defaultPermissionStore.set(codes)
/** 기본 store 의 현재 권한 집합. */
export const getPermissions = (): ReadonlySet<string> => defaultPermissionStore.get()
/** 기본 store 기준 단일 권한 보유 여부. */
export const hasPermission = (code: string): boolean => defaultPermissionStore.has(code)
/** 기본 store 기준 하나라도 보유. */
export const hasAnyPermission = (codes: Iterable<string>): boolean => defaultPermissionStore.hasAny(codes)
/** 기본 store 기준 모두 보유. */
export const hasAllPermissions = (codes: Iterable<string>): boolean => defaultPermissionStore.hasAll(codes)
/** 기본 store 의 권한이 알려졌는가(`PermissionStore.isKnown`). */
export const permissionsKnown = (): boolean => defaultPermissionStore.isKnown()
/** 기본 store 권한을 비운다. */
export const clearPermissions = (): void => defaultPermissionStore.clear()
