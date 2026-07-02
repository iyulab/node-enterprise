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

- `FormRow`는 기본 2컬럼 그리드입니다. 한 칸을 차지하려면 `full`을 씁니다.
- (3컬럼 이상 등 커스텀 레이아웃이 필요하면 현재는 직접 CSS grid를 쓰세요. `columns` prop 확장은 로드맵에 있습니다.)

### API 설정

```typescript
import { ApiConfig } from '@iyulab/enterprise'

ApiConfig.initialize({ baseUrl: '/', odataPrefix: '$data', apiPrefix: 'api' })

ApiConfig.getODataUrl('Orders')          // → /$data/Orders
ApiConfig.getApiUrl('auth/me')           // → /api/auth/me
ApiConfig.getUrlWithParams('report', { year: 2026, active: true })
ApiConfig.isDevelopment                   // 환경 판별
```

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
