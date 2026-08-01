# @iyulab/enterprise

iyulab 프레임워크의 엔터프라이즈 통합 패키지. 폼 레이아웃 컴포넌트·API 설정·도메인 헬퍼를 제공합니다.

## Installation

```bash
npm install @iyulab/enterprise
```

## 무엇을 제공하나

### 1. 고유 export (enterprise에서만 제공)

| Export | 종류 | 용도 |
|--------|------|------|
| `FormSection` | React | 제목 + 세로 스택 폼 섹션 |
| `FormRow` | React | 2컬럼 그리드 폼 행(`full`로 1컬럼) |
| `ApiConfig` | class | baseUrl/OData·API prefix·dev 판별 중앙 설정 |
| `createODataService` | factory | OData v4 + custom REST CRUD 서비스(401·토스트·에러파싱) |
| `ApiError` | class | HTTP status 를 실은 API 호출 실패 에러 |
| `createAuthClient` | factory | 쿠키 세션 인증(fetchMe/login/logout) — 제네릭 user/자격증명 |
| `createPermissionStore` · `hasPermission` 외 | store | 권한 스냅샷 store + 판정 free 함수 |
| `CurrencyHelper` | class | 통화 포맷(`formatKRW` 등) |
| `DateHelper` | class | 날짜 포맷/파싱 |
| `ProgressHelper` | class | 진행률 계산 |
| `UrgencyHelper` | class | 긴급도 계산 |

### 2. 심볼 출처 (v0.3.0부터 하위 패키지 재노출 제거됨)

`@iyulab/enterprise`는 **자기 고유 export만** 제공합니다(위 표). `@iyulab/components`(컴포넌트), `@iyulab/data-components`(데이터 그리드/시트), `@iyulab/modern-app`(앱 프레임워크, 라우팅)은 각 패키지에서 **직접 import**하세요.

> v0.2.x까지는 위 3개 패키지를 `export *`로 재노출했으나, 심볼 출처 혼란과 exact-pin(v0.2.2 이전) 조합 시 이중 인스턴스 위험 때문에 v0.3.0에서 제거했습니다. 재노출에 의존하던 코드는 `@iyulab/enterprise`가 아닌 각 하위 패키지에서 직접 import하도록 수정해야 합니다.

## Usage

### 폼 레이아웃 (React)

```tsx
import { FormSection, FormRow } from '@iyulab/enterprise'

<FormSection title="기본 정보">
  <FormRow>
    <u-input label="이름" />
    <u-input label="코드" />
  </FormRow>
  <FormRow full>
    <u-textarea label="비고" />
  </FormRow>
</FormSection>
```

- `FormRow`는 기본 2컬럼 그리드입니다. 한 칸을 차지하려면 `full`을, 다른 열 수가 필요하면 `columns`를 씁니다.
- 두 컴포넌트 모두 `className`·`style`을 받아 기본값 **뒤에** 병합합니다 — 블록을 복제하지 않고 조정하는 정규 경로입니다. `FormSection`은 제목 줄만 바꾸는 `titleStyle`도 받습니다.

```tsx
<FormRow columns={3}>…</FormRow>
<FormSection title="기본 정보" style={{ marginBottom: 32 }}>…</FormSection>
```

> 이 계층이 무엇을 소유하고 무엇을 소유하지 않는지, 새 패턴이 언제 추가되는지는
> **[LOB 계층 헌장](./docs/lob-layers.md)** 이 정합니다. 패턴을 제안하기 전에 읽어 주세요.

### API 설정

```typescript
import { ApiConfig } from '@iyulab/enterprise'

ApiConfig.initialize({ baseUrl: '/', odataPrefix: '$data', apiPrefix: 'api' })

ApiConfig.getODataUrl('Orders')          // → /$data/Orders
ApiConfig.getApiUrl('auth/me')           // → /api/auth/me
ApiConfig.getUrlWithParams('report', { year: 2026, active: true })
ApiConfig.isDevelopment                   // 환경 판별
```

### OData 서비스 (`createODataService`)

OData v4 + custom REST CRUD 를 한 번에 구성한다. 401 세션 처리·에러 메시지 추출·성공 토스트·204 빈 바디 안전 파싱이 내장돼 있고, **도메인/로케일 요소는 전부 주입**으로 앱 adapter 에 남긴다.

```typescript
import { createODataService } from '@iyulab/enterprise'
import { app } from '@iyulab/modern-app'

// 앱 adapter (예: src/lib/odata.ts) — 라이브러리는 이 배선만 받는다.
export const svc = createODataService({
  baseUrl: window.location.origin,
  onUnauthorized: () => { window.location.href = '/' },        // 세션 만료 리다이렉트는 앱이 결정
  notify: { success: (m) => app.success(m), error: (m) => app.error(m) },
  messages: {                                                   // 기본은 영어 — 로케일 오버라이드
    saved: '저장되었습니다', updated: '수정되었습니다', deleted: '삭제되었습니다',
    sessionExpired: '세션이 만료되었습니다. 다시 로그인하세요.',
  },
})

await svc.odataGet<Order>('Orders', { $top: '20' })   // value 배열 언랩
await svc.odataPost<Order>('Orders', { name: 'A', note: '' })  // '' → null 정규화 + 성공 토스트
await svc.apiDelete('orders/7')                        // 204 안전
svc.odataUrl('Orders')                                 // flex-table useODataSource 엔드포인트
svc.sourceDefaults                                     // { baseUrl, onUnauthorized } 주입용
```

주입 항목:

| config | 용도 |
|--------|------|
| `baseUrl` | 모든 요청의 오리진 (필수) |
| `odataPrefix` / `apiPrefix` | 엔드포인트 prefix (기본 `$data` / `api`) |
| `onUnauthorized(status)` | 401 시 호출 — 리다이렉트/재진입 가드는 앱이 처리 |
| `notify.success/error` | 토스트 훅 (생략 시 토스트 없음 — 순수) |
| `messages` | 사용자 대면 문구 (기본 영어, 지정 키만 대체) |
| `formatError(info)` | 에러 메시지 포매팅 오버라이드 (앱별 정책) |

> 도메인 액션(상태 전이 등)·엔티티 목록·권한 코드는 라이브러리에 넣지 말고 앱 adapter 에 둔다.

### 인증 + 권한 (`createAuthClient` · 권한 store)

쿠키 세션 인증 흐름과 권한 스냅샷을 승격. 사용자·자격증명 **형태는 앱이 제네릭으로 정의**하고, 권한 코드는 불투명 문자열로만 다룬다. `getPermissions` 를 주면 로그인/세션 조회 성공 시 권한 store 가 자동 갱신된다.

```typescript
import { createAuthClient, hasPermission, setPermissions } from '@iyulab/enterprise'

interface User { Id: string; Permissions: string[] }   // 도메인 형태 = 앱 소유

export const auth = createAuthClient<User, { Username: string; Password: string }>({
  meUrl: '/api/auth/me', loginUrl: '/api/auth/login', logoutUrl: '/api/auth/logout',
  getPermissions: (u) => u.Permissions,                 // 성공 시 권한 store 자동 set
  messages: { invalidCredentials: '사용자명 또는 비밀번호가 올바르지 않습니다.' },
})

// 부팅 게이트
const user = await auth.fetchMe()   // null → 미인증(로그인 화면)

// 어디서나 권한 판정(부팅 스냅샷)
if (hasPermission('orders.write')) { /* 저장 버튼 노출 */ }
```

- `fetchMe()` 는 401/네트워크 오류 시 `null` — 이 신호가 로그인 게이트를 구동한다(라이브러리가 리다이렉트하지 않음).
- 격리가 필요하면 `createPermissionStore()` 로 별도 store 를 만들어 `permissionStore` 로 주입한다.
- 도메인 판정(`isPortalUser` 등)·권한 코드 상수는 라이브러리가 아니라 앱 adapter 에 둔다.

### 도메인 헬퍼

```typescript
import { CurrencyHelper, DateHelper } from '@iyulab/enterprise'

CurrencyHelper.formatKRW(1234000)   // ₩1,234,000
```

## Development

```bash
npm run build
```

## License

MIT
