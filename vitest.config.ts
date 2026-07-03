import { defineConfig } from 'vitest/config'

// 서비스 팩토리는 순수 로직(DOM 비의존)이라 node 환경으로 충분하다.
// 라이브러리 빌드용 vite.config.ts(dts/lib) 와 분리해 테스트가 빌드 설정에 얽히지 않게 한다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
