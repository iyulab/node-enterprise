/**
 * @iyulab/enterprise
 * Enterprise utilities and components for iyulab framework
 */

export { FormSection } from './FormSection'
export { FormRow } from './FormRow'

/** Package version */
export const VERSION = '0.2.1';

// Re-export from dependencies
export * from '@iyulab/components';
export * from '@iyulab/data-components';
export * from '@iyulab/modern-app';

// 충돌 해소: DialogOptions 는 components(다이얼로그 UI 옵션)와 modern-app(별개 타입)에
// 동명으로 존재한다. enterprise 는 컴포넌트 중심이므로 components 의 정의를 노출한다.
export type { DialogOptions } from '@iyulab/components';

// Enterprise helpers
export * from './helpers';

// API Configuration
export * from './ApiConfig';
