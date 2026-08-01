# Changelog

## 0.5.0

### Added

- ★**[LOB 계층 헌장](./docs/lob-layers.md)** — 이 패키지가 **무엇을 소유하고 무엇을 소유하지
  않는지**를 정한 문서. L0~L3 계층 정의 · 오버라이드 계약 · 카탈로그 등급 · 의존 방향.

  - **오버라이드 계약이 1급 조항이다** — 소비자가 조정할 경로가 없는 패턴은 이 계층에
    들어올 수 없다. 경로가 없으면 소비자는 통째로 복제하게 되고, 그러면 이 계층은
    **쓰기 전보다 나쁜 상태**를 만든다.
  - **카탈로그에 등급을 매긴다** — 반복이 실측된 것만 착수하고, 요청만 있는 것은
    **만들지 않는다**고 명시한다.
  - ★**프레임워크 전제를 못 박는다**: *L0·L1 은 프레임워크 중립, L2·L3 는 React 전제.*
    적어 두지 않으면 다른 프레임워크의 소비자가 나타났을 때 아무도 결정하지 않은 채
    갈라진다.

  헌장과 구현이 어긋나면 실패하는 대조 테스트 6건이 함께 있다 — 계층 헌장의 실패 형태는
  위반이 아니라 **표류**이고, 표류는 문서와 코드가 각각 멀쩡해 보여서 눈에 띄지 않는다.

- **`FormRow`에 `columns`** — 2열 고정이 맞지 않을 때 컴포넌트를 복제하지 않고 조정한다.
  (README 가 *"로드맵에 있다"* 고 적어 두었던 항목이다.)
- **`FormSection`·`FormRow`에 `className`·`style`**(+ `FormSection`의 `titleStyle`) —
  기본값 **뒤에** 병합되므로 필요한 항목만 골라 덮을 수 있다.
- **`FormSection`의 `title`이 `ReactNode`를 받는다** — 종전에는 `string` 이라 배지·아이콘을
  붙이려면 블록을 복제해야 했다.

### Fixed

- **폼 블록 제목이 브랜드 색을 따르지 않던 문제 수정** — 팔레트(`--u-blue-600`)를 직접
  읽고 있었다. 소비자가 브랜드를 맞추려면 팔레트를 덮는 수밖에 없었고, 그러면 *진짜
  파랑*이 필요한 곳까지 함께 바뀐다. 역할 토큰(`--u-primary-color`)에서 파생하도록 고쳤다.
- **폼 블록 제목의 대비 부족 해소** — 11px 텍스트가 3.68:1 로 WCAG AA(4.5:1)에 미달했다.
  한 단 어두운 파생값(4.85:1)으로 교체했다.

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
