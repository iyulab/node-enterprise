// 프리셋 CSS 를 dist 로 옮긴다.
//
// 왜 별도 단계인가: 이 패키지의 vite 빌드는 **라이브러리 번들**(`src/index.ts` → `index.js`)만
// 낸다. `index.ts` 가 import 하지 않는 CSS 는 산출물에 들어오지 않는다. 그렇다고 `index.ts`
// 에서 import 하면 **프리셋이 강제 로드**되어 계약 ⑴("선택적 로드")이 깨진다.
// ⇒ 번들과 무관하게 파일만 복사한다.
//
// ⚠빈 결과를 성공으로 처리하지 않는다 — 경로가 어긋나면 `dist/styles` 가 없는 채로
//   빌드가 초록이 되고, 소비자는 404 를 본다.
import { mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const from = 'src/styles';
const to = 'dist/styles';

mkdirSync(to, { recursive: true });
const files = readdirSync(from).filter(f => f.endsWith('.css'));
if (files.length === 0) {
  console.error(`복사할 CSS 가 없다(${from}) — 경로가 어긋나면 조용히 성공한다.`);
  process.exit(1);
}
for (const f of files) copyFileSync(join(from, f), join(to, f));
console.log(`styles → dist: ${files.join(', ')}`);
