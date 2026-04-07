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
      // 번들링하면 소비자(yesung 등)에서 modern-app/components/react가
      // 중복 로드되어 customElements.define 충돌(u-icon) 발생.
      external: [
        /^@iyulab\//,
        /^lit($|\/)/,
        /^react($|\/)/,
        /^react-dom($|\/)/,
      ],
    },
  },
  plugins: [
    dts({
      include: ['src/**/*'],
      rollupTypes: true,
    }),
  ]
});
