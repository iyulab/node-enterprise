import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

// 라이브러리 빌드용 vite.config.ts(dts/lib) 와 분리해 테스트가 빌드 설정에 얽히지 않게 한다.
//
// - unit:    서비스 팩토리·헬퍼·bindSource — 순수 로직(DOM 비의존)이라 node 로 충분하다.
// - browser: `u-list-page` 와 그 React 래퍼 — 슬롯 배정·커스텀 엘리먼트 수명주기는 실제 엔진에서만 재현되고,
//            `@lit/react` 는 node 조건에서 SSR 빌드로 갈라져 프로퍼티를 쓰지 않는다(CLAUDE.md).
//
// ⚠`include` 를 좁게 잡으면 그 밖의 테스트는 조용히 실행되지 않는다 — 프로젝트를 더할 때 반대편도 함께 확인할 것.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/browser/**'],
        },
      },
      {
        test: {
          name: 'browser',
          // 직렬 — 파일마다 브라우저 페이지가 함께 뜨면 여유 메모리가 바닥나 시험이 «timed out waiting for click»·
          // «Failed to fetch dynamically imported module» 로 비결정적으로 죽는다(메모리가 적은 기계에서 병렬은 여유를 바닥까지 끌어내렸다).
          fileParallelism: false,
          include: ['tests/browser/**/*.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: playwright(),
            // headless 고정 — 헤드 있는 창은 OS 표시 배율에 물린다(components 설정 주석 참조).
            instances: [{ browser: 'chromium', headless: true }],
          },
          // 고정 포트 — 이 머신의 Windows 동적 포트 제외 범위와 기본 포트가 충돌한다(components 설정 주석 참조).
          api: { host: '127.0.0.1', port: 41510 },
        },
      },
    ],
  },
})
