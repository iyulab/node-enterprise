# Changelog

## 0.12.0

### Added

- **`ApiError.details`** — OData v4 error envelopes carry per-field validation
  errors in `error.details`, and `ODataService` already parsed that envelope to
  build `ApiError.message`, but discarded the rest of the same parse. `ApiError`
  now also carries `details` (`ApiErrorDetail[] | undefined`), so a caller can
  bind server-side validation failures to the fields that produced them instead
  of showing one flattened string. Backward compatible: callers that never read
  `.details` are unaffected.
  - Per the OData JSON Format v4.0 spec each detail entry MUST have `code` and
    `message` and MAY have `target`, so `target` is optional on `ApiErrorDetail`
    and entries that lack a string `code`/`message` are dropped; when nothing
    usable remains `details` is `undefined` rather than an empty array.

## 0.11.1

### Fixed

- **`createAuthClient`'s README section documented only 4 of `AuthClientConfig`'s
  7 fields** — `baseUrl`, `credentials`, and `extractLoginError` had no mention
  anywhere (only `permissionStore` was covered, in prose). Added a config table
  matching the one already used for `createODataService`.

## 0.11.0

### Added

- **`ODataService.odataPatchQuiet`/`odataDeleteQuiet`** — quiet counterparts to
  `odataPatch`/`odataDelete`, mirroring the existing `odataPost`/`odataPostQuiet`
  split. For an action that fires more than one mutation in response to a single
  user click (e.g. editing a row and syncing a denormalized parent field), the
  toasting variants would show a toast per mutation; the quiet variants do the
  request and error handling without one, so the caller can toast once for the
  whole action. Previously PATCH/DELETE had no quiet path, forcing a raw
  `fetch()` that lost 401 handling and `ApiError` extraction.

## 0.10.2

### Changed

- **`CurrencyHelper` now logs a one-time `console.warn`** (per process) the first time any of its
  `format*` methods (`formatCurrency`/`formatKRW`/`formatUSD`/`formatEUR`/`formatJPY`/`formatCNY`)
  is called, pointing callers to `formatCurrency`/`formatNumber`/`formatDate` from
  `@iyulab/components` directly. `parseCurrency` is unaffected (no equivalent exists elsewhere yet).
  No behavior change — this is usage telemetry ahead of a future removal, not a functional change.

## 0.10.1

### Added

- **`ODataService` gained `apiPut<T>(path, body?)`.** The other three custom-REST verbs
  (`apiGet`/`apiPost`/`apiPatch`/`apiDelete`) were already there; `PUT` was the one missing member
  of that set, even though the underlying `@iyulab/http-client` `HttpClient` has always had `.put()`.
  A consumer whose backend models "replace this resource" as `PUT` had no way to reach it through
  this wrapper. Passing a `FormData` body to `apiPost`/`apiPut`/`apiPatch` already worked before this
  change and needed no fix — `HttpClient` never forces JSON serialization on it and lets the browser
  set the multipart boundary itself.

## 0.10.0

### Changed

- **`ProgressHelper.validateProgress`/`ratioToPercent` now return `number | null` instead of
  folding a missing input into `0`.** "No value yet" and "0% progress" are different facts and
  were rendering identically. A call site that already narrows its input to a definite `number`
  keeps getting a definite `number` back (an overload preserves this); a call site that may pass
  `null`/`undefined` now has to handle a `null` result explicitly.
- **`CurrencyHelper.formatCurrency`, `DateHelper.formatDate`/`formatLocalDate`/`formatDateTime`,
  and `UrgencyHelper.formatDaysRemaining` now render a missing value as an em dash (`—`) instead
  of a hyphen (`-`).** The two glyphs looked almost identical but meant different things; the
  empty-value string is now one shared constant (`EMPTY_VALUE_DISPLAY`, exported from
  `@iyulab/enterprise`) instead of eight independent hardcoded literals across the four helpers.

## 0.9.1

### Fixed

- **`CurrencyHelper`, `messages`, and `icons` now deep-import `@iyulab/components`' utility
  modules instead of the full package barrel.** Importing the barrel alongside
  `@iyulab/components/react` in the same TypeScript program produced duplicate custom-element
  registration and nominal-type conflicts for consumers; deep-importing avoids pulling in the
  registration side effect these helpers never needed.

## 0.9.0

### Added

- **New opt-in subpath `@iyulab/enterprise/icons`.** Bundles 10 hand-drawn nav-style SVG
  icons and registers them under the icon-library name `'house'` via `@iyulab/components`'
  `IconRegistry`. Importing the main `@iyulab/enterprise` entry does not pull this in —
  only importing `@iyulab/enterprise/icons` registers the library, matching how
  `./styles/preset.css` is already opt-in.

### Changed

- **`sideEffects` narrowed from `false` to an explicit array.** Protects the new
  `icons.ts` module (and, since this package builds as a single bundle with no
  per-file output, the whole `index.ts`/`index.js` — which also covers a pre-existing
  side effect in `helpers/messages.ts`) from being tree-shaken away by consumers'
  production bundlers.

## 0.8.2

### Changed

- **`CurrencyHelper` now delegates to `@iyulab/components`' `formatCurrency`** instead of
  duplicating `Intl.NumberFormat` logic. Output is unchanged for all existing methods
  (`formatCurrency`/`formatKRW`/`formatUSD`/`formatEUR`/`formatJPY`/`formatCNY`/
  `parseCurrency`) — this is a behavior-preserving internal change. The class is now marked
  `@deprecated`; new code should call `formatCurrency`/`formatNumber`/`formatDate` from
  `@iyulab/components` directly.
- **`@iyulab/components` peer floor raised to `>=1.27.0`** (the delegation above needs
  `formatCurrency`, added in that release).

## 0.8.1

### Fixed

- **`@types/react` was missing from the manifest**, so a standalone checkout (outside the
  monorepo workspace, where hoisting used to paper over it) failed to typecheck against this
  package's React-facing exports. Declared explicitly.

## 0.8.0

### Changed

- ⚠**헬퍼 라벨이 «영어 기본 + 로케일 레지스트리»로 이주했다** — `ProgressHelper` 6건 ·
  `UrgencyHelper` 8건이 한국어 리터럴이었다.

  ```ts
  import { Locale } from '@iyulab/components';
  import { messages } from '@iyulab/enterprise';

  Locale.set('ko');                                   // 검증 메시지와 함께 전환된다
  messages.register('ja', { progressDone: '完了' });   // 언어를 더하거나 문구를 덮는다
  ```

  ⚠**한국어 환경은 종전과 같은 문구를 본다** — 내장 로케일에 `ko` 가 들어 있고, 활성 로케일은
  브라우저 언어에서 감지된다(`ko-KR` → `ko`). 그 밖의 환경은 이제 **영어**를 본다.

  ⚠**호출자가 준 `labels` 인자는 여전히 최우선**이다(`getUrgencyText`) — 종전 계약 유지.

  ★자체 레지스트리를 만들지 않고 `@iyulab/components` 의 `Locale.namespace()` 를 쓴다. 앱
  하나에서 로케일을 두 번 전환하게 만들지 않기 위해서다.

### Requires

- `@iyulab/components >= 1.23.0` (`Locale.namespace`) — peer 하한을 올렸다.

## 0.7.1

### Fixed

- 🔴**하우스 프리셋이 한 줄도 적용되지 않았다** — `0.7.0` 의 프리셋은 **구조적으로 무효**였다.

  ```css
  /* components/styles/light.css */   :root        { … }   /* 특이도 (0,1,0) */
  /* enterprise/styles/preset.css */  :where(:root){ … }   /* 특이도 (0,0,0) ← 항상 진다 */
  ```

  `:where()` 는 특이도를 0 으로 만들므로 **로드 순서와 무관하게** 기본 시트가 이긴다.
  그리고 프리셋 40선언 중 **기본 시트에 없는 것이 0개**여서, 특이도 0 이 이길 수 있는
  자리가 **하나도 없었다**. 40선언 전부가 사문이었다.

  ⚠**의도는 옳았다** — *"프리셋이 소비자 브랜드를 덮으면 안 된다"*. 그러나 특이도 0 은
  **이겨야 할 상대(기본값)와 지지 말아야 할 상대(브랜드)를 구분하지 못한다.**

  ⇒ **`:root` 로 선언하고 층은 «로드 순서»로 세운다.** 소비자가 이미 통제하는 축이다.

  ```js
  import '@iyulab/components/styles/light.css';   // 기본값
  import '@iyulab/enterprise/styles/preset.css';  // 하우스 — 기본값을 덮는다
  import './brand.css';                            // 소비자 브랜드 — 하우스를 덮는다
  ```

  ⚠**이 실패는 조용했다** — 오류도 경고도 없어, 로드해 보고도 *"프리셋 값이 우리 값과
  우연히 같았나 보다"* 로 읽히는 형태였다.

  ★**계약 테스트는 통과하고 있었다.** `:where()` 로 감싸졌는지를 물었을 뿐 **효력이
  있는지**를 묻지 않았다. 이제 둘을 잰다 — *기본 시트를 이길 수 있는가*(특이도)와
  *이길 것이 있는가*(기본값과 다른 선언이 하나 이상인가).

- **`0.7.0` 을 이미 로드한 소비자**: 렌더가 바뀐다. 그것이 프리셋이 원래 하려던 일이다.
  프리셋을 로드하지 않은 소비자는 **변화 없다**.

## 0.7.0

### Added

- 🆕**하우스 스타일 프리셋** — `@iyulab/enterprise/styles/preset.css`

  ```
  import '@iyulab/enterprise/styles/preset.css';
  ```

  `@iyulab/components` 가 여는 **토큰 축**에 이유랩의 값을 채운 한 장이다. 축(이름·단 수)은
  `components` 소유이고 이 파일은 **값만** 정한다 — 타이포 스케일(LOB 밀도) · 반경(컨트롤 단을
  한 단씩 올림) · 엘리베이션(순수 검정 → **청흑 틴트**, 라이트/다크 각각).

  **계약 셋** (`tests/preset-contract.test.ts` 가 강제한다):
  ⑴ **선택적 로드** — 로드하지 않은 소비자는 `components` 의 중립 기본값을 그대로 받는다.
  ⑵ **`--u-*` 값만 덮는다** — 새 클래스·새 선택자 0개.
  ⑶ 🔴**소비자가 항상 이긴다** — 선택자를 `:where()` 로 감싸 **특이도 0** 으로 선언한다.
     ⚠**이 항목은 `0.7.1` 에서 정정됐다** — 특이도 0 은 기본 시트도 이기지 못해 프리셋이
     통째로 무효였다. 지금은 `:root` 이고 층은 **로드 순서**로 선다.

  **정하지 않는 것**: 중립 램프의 색조(웜/쿨) — 역할 토큰 다수가 중립에서 파생되므로 램프를
  옮기면 대비가 함께 움직인다. 전수 대비 검증 전에는 손대지 않는다. **브랜드 색** — 소비앱의
  몫이고 프리셋은 브랜드를 갖지 않는다.

  ⚠**빌드에 복사 단계가 붙었다**(`scripts/copy-styles.mjs`). `index.ts` 에서 import 하면
  프리셋이 **강제 로드**되어 계약 ⑴이 깨지므로, 번들과 무관하게 파일만 옮긴다.
  복사할 CSS 가 0개면 **실패한다** — 경로가 어긋났을 때 조용히 초록이 되지 않게.

### Fixed

- 🔴**`FormSection` 제목에서 `text-transform: uppercase` 와 `letter-spacing` 제거**

  한글에는 대문자가 없어 `uppercase` 가 **아무 효과가 없고**, 제목에 영문이 섞이면 그것만
  커져 오히려 어수선해진다. 양수 `letter-spacing` 은 **한글 가독성을 떨어뜨린다** —
  라틴 소문자 조판 관례를 그대로 옮기면 안 되는 자리다.
  ⇒ 위계는 **크기·굵기·색** 세 신호로만 만든다. 영문 전용 UI 에서 눈썹 텍스트가 필요하면
  `titleStyle` 로 `--u-text-overline-*` 단을 지정한다(그 단은 영문·숫자 라벨을 전제한다).

### Changed

- **`FormSection`·`FormRow` 의 크기·여백이 토큰 참조가 된다** — `11px`·`20px`·`10px`·`6px`·`8px`
  리터럴이 `--u-text-label-*` · `--u-space-{xs,sm,xl}` 로 바뀌었다.
  ⚠**제목 글자가 11px → 13px(`label` 단)로 커진다.** 종전 값은 스케일 축이 생기기 전이라
  고립돼 있었고, 이제 폼 라벨·표 머리행과 **같은 층**을 쓴다.
  오버라이드 계약(§2-1)은 그대로다 — 호출자의 `style`·`titleStyle` 이 여전히 뒤에 온다.

### Docs

- 헌장에 **L0.5 하우스 스타일 프리셋** 절 신설. ★하우스 값은 **cross-consumer 수요 게이트(§3-1)의
  대상이 아니다** — 게이트가 지키는 것은 **새 표면**이고 프리셋은 표면을 열지 않는다.

### 요구 사항

`@iyulab/components` **1.21.0 이상**(타입 스케일·여백 상단·반경 상단 축).

## 0.6.0

### Fixed

- **매니페스트가 산출물과 어긋나 있었다** — 양방향 모두.

  ```
  제거   @iyulab/components · @iyulab/data-components · @iyulab/modern-app
         → dist 가 셋 다 import 하지 않는다(소스에서도 0건)
  추가   react → peerDependencies
         → dist 가 import 하는데 dependencies·peerDependencies·devDependencies
           어디에도 선언이 없었다
  ```

  ★**미사용 선언의 비용은 디스크가 아니라 사본이다.** `0.x` 캐럿은 마이너를 고정하므로
  (`^0.6.0` 은 `0.8.0` 을 받지 못한다) 소비자가 셸을 올릴수록 중복이 확정된다. 지금은
  `dist` 가 import 하지 않아 로드되지 않지만, 그 무해 판정의 근거는 *"지금 import 하지
  않는다"* 하나뿐이었다 — 커스텀 엘리먼트를 등록하는 패키지가 섞여 있어 한 줄이면
  `customElements.define` 이 두 번 불린다.

  ★**`react` 미선언이 더 위험했다.** 번들에서 external 로 빼 놓고 요구하지 않았으니,
  지금 동작하는 이유는 소비자가 React 앱이라 **우연히 있기 때문**이다.

  ⚠**이 패키지의 렌더·동작은 변하지 않는다** — 제거된 셋은 `dist` 가 참조한 적이 없다.
  `--u-*` 커스텀 프로퍼티는 리터럴 폴백과 함께 쓰므로 코드 의존이 아니다(토큰 시트를
  로드하면 그 값을 따라간다).

  🔴**다만 설치 그래프는 바뀐다.** 이 셋을 `enterprise` 의 전이 의존으로 받아 쓰던
  소비자는 **자기 매니페스트에 직접 선언해야 한다** — 원래 그것이 옳고, 호이스팅에
  기대던 것이 우연히 동작하고 있었을 뿐이다. 엄격한 설치기(pnpm 등)에서는 애초에
  그렇게 쓸 수 없었다.
  ⇒ 업그레이드 시 `@iyulab/components`·`@iyulab/data-components`·`@iyulab/modern-app` 를
  직접 쓰고 있다면 자기 `dependencies` 에 있는지 확인할 것.

- **`odata-query` 가 번들에 인라인돼 있었다** — external 목록에 없어 라이브러리 코드가
  `dist` 에 통째로 실렸고, 그러면서 `dependencies` 에도 선언돼 있었다. 소비자가 같은
  것을 **두 벌** 갖는 형태다. external 로 옮겼다(선언은 그대로).

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
