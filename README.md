# @iyulab/enterprise

iyulab 프레임워크의 엔터프라이즈 통합 패키지. 하위 UI/데이터/앱 패키지를 재노출하고, 폼 레이아웃 컴포넌트·API 설정·도메인 헬퍼를 제공합니다.

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

### 2. 재노출 (편의를 위한 re-export)

`@iyulab/enterprise`는 하위 패키지를 `export *`로 재노출합니다:

- `@iyulab/components` (기반 UI 컴포넌트)
- `@iyulab/data-components` (데이터 그리드/시트)
- `@iyulab/modern-app` (앱 프레임워크)

> ⚠️ **재노출은 편의용이며 SoT가 아닙니다.** 프레임워크(`app`)·컴포넌트를 쓸 때는 **각 하위 패키지에서 직접 import**하는 것을 권장합니다. enterprise를 통한 간접 소비와 직접 소비를 섞으면 심볼 출처가 갈라져 혼란과(중복 설치 시) 이중 인스턴스 위험이 생길 수 있습니다.
> - 컴포넌트 → `@iyulab/components`
> - 프레임워크(`app`, 라우팅) → `@iyulab/modern-app`
> - 폼 레이아웃/API 설정/도메인 헬퍼 → `@iyulab/enterprise`

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
