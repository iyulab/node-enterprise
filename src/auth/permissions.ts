/**
 * 권한 스냅샷 store — 부팅 시점의 현재 사용자 권한 코드 집합을 보관하고
 * `hasPermission`/`hasAny`/`hasAll` 판정을 제공한다. 프레임워크 무관(React·Lit 공통)이며
 * 권한 코드는 **불투명 문자열**로만 다룬다(도메인 의미는 앱이 소유).
 *
 * 부팅 시점 스냅샷 모델 — 권한 변경은 다음 로그인(재-set)까지 반영되지 않는다. 단일 운영자
 * 모델에 충분하며, 실시간 권한 회수/멀티테넌트가 필요하면 `subscribe` 로 반응형 확장 가능.
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
  /** 권한을 비운다(로그아웃/세션 만료 시). */
  clear(): void
  /** 권한 변경 구독. 해제 함수를 반환한다. */
  subscribe(listener: (codes: ReadonlySet<string>) => void): () => void
}

/** 독립적인 권한 store 를 생성한다(테스트 격리·다중 컨텍스트에 유리). */
export function createPermissionStore(initial?: Iterable<string>): PermissionStore {
  let codes = new Set(initial ?? [])
  const listeners = new Set<(codes: ReadonlySet<string>) => void>()
  const emit = () => {
    for (const l of listeners) l(codes)
  }
  return {
    set(next) {
      codes = new Set(next)
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
      if (codes.size === 0) return
      codes = new Set()
      emit()
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
/** 기본 store 권한을 비운다. */
export const clearPermissions = (): void => defaultPermissionStore.clear()
