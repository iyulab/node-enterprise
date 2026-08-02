import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: (format, entry) => {
        return format === 'es' ? 'index.js' : `${entry}.${format}.js`;
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
      bundleTypes: true,
    }),
  ]
});
