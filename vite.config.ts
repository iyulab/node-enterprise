import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

// api-extractor 는 자기 TypeScript 를 내장하는데, 플러그인은 «프로젝트의»
// TypeScript lib 폴더를 넘긴다. 프로젝트가 그보다 새 TS 를 쓰면 내장 분석기가 새 lib 파일을
// 읽지 못해 `AsyncGenerator` 같은 표준 심볼에서 "Unable to follow symbol" 로 죽는다 — 워크스페이스
// 에서는 두 쪽이 같은 TS 로 호이스팅돼 가려지고 단독 설치에서만 드러난다. 그래서 api-extractor 가
// 실제로 로드하는 TypeScript 를 명시해 둘을 맞춘다.
const requireFromHere = createRequire(import.meta.url);
const extractorTypescript = dirname(
  requireFromHere.resolve('typescript/package.json', {
    paths: [dirname(requireFromHere.resolve('@microsoft/api-extractor/package.json'))],
  }),
);

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        icons: resolve(__dirname, 'src/icons.ts'),
      },
      formats: ['es'],
      fileName: (format, entry) => {
        return format === 'es' ? `${entry}.js` : `${entry}.${format}.js`;
      }
    },
    rollupOptions: {
      // 모든 peer/외부 패키지는 external로 선언한다.
      // 번들링하면 소비 앱에서 modern-app/components/react가
      // 중복 로드되어 customElements.define 충돌(u-icon) 발생.
      external: [
        /^@iyulab\//,
        /^lit($|\/)/,
        /^react($|\/)/,
        /^react-dom($|\/)/,
        // ★선언과 산출물을 일치시킨다. 종전에는 external 이 아니라 `odata-query` 코드가
        // dist 에 통째로 인라인됐고, 그러면서 dependencies 에도 선언돼 있었다 —
        // 소비자가 같은 라이브러리를 **두 벌**(번들 1 + node_modules 1) 갖게 된다.
        // 소비자가 이미 odata-query 를 쓰는 경우(흔하다) 그 중복이 사라진다.
        /^odata-query($|\/)/,
      ],
    },
  },
  plugins: [
    dts({
      include: ['src/**/*'],
      bundleTypes: { invokeOptions: { typescriptCompilerFolder: extractorTypescript } },
    }),
  ]
});
