# Changelog

## 0.4.0

### Added

- **`createODataService(config)`** — OData v4 + custom REST 서비스 팩토리. 여러 소비앱이 동일하게 재작성하던 CRUD 래퍼(401 세션 처리, 에러 메시지 추출, 성공 토스트, 204 빈-바디 안전 파싱)를 범용 primitive 로 승격.
  - 도메인/로케일 요소는 주입: `baseUrl`, `onUnauthorized`, `notify`(토스트 훅), `messages`(문구 오버라이드 — 기본 영어), `formatError`(에러 포매팅 훅).
  - 반환 서비스: `odataGet/odataGetById/odataCount/odataPost/odataPostQuiet/odataPatch/odataDelete`, `apiGet/apiPost/apiPatch/apiDelete`, `fetchRaw`, `odataUrl`/`apiUrl`, `sourceDefaults`(flex-table `useODataSource` 용).
  - `ApiError`(HTTP status 포함) 함께 export.
- 신규 의존성: `@iyulab/http-client`, `odata-query`.
- `vitest` 단위 테스트 인프라 도입(모노레포 표준) — `npm test`.
- **`createAuthClient<TUser, TCredentials>(config)`** — 쿠키 세션 인증 클라이언트 팩토리. `fetchMe`(미인증 시 null)/`login`/`logout` 흐름을 승격. 사용자·자격증명 형태는 제네릭으로 앱이 정의(라이브러리는 URL 호출만). 원시 `fetch` 사용(401 인터셉터 우회 — null 이 곧 미인증 신호). `getPermissions` 지정 시 성공/로그아웃마다 권한 store 자동 갱신.
- **권한 스냅샷 store** — `createPermissionStore(initial?)`(factory) + 기본 싱글톤 바인딩 free 함수(`setPermissions`/`getPermissions`/`hasPermission`/`hasAnyPermission`/`hasAllPermissions`/`clearPermissions`). 권한 코드는 불투명 문자열, false-by-default, `subscribe` 반응형 훅. React·Lit 공통.

### Notes

- 토스트/문구·사용자 형태·권한 코드를 모두 주입/제네릭으로 받으므로 서비스·인증 모듈은 `@iyulab/modern-app` 에 의존하지 않는다(순수·테스트 용이).
- 도메인 요소(엔티티 목록, `isPortalUser` 같은 도메인 판정, 권한 코드 상수)는 라이브러리에 넣지 않고 앱 adapter 에 남긴다.
