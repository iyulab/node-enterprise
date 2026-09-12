import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, join } from 'path';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');

/**
 * L2 폼 레이아웃의 **크기 계약**.
 *
 * ⚠**이 파일은 «선언» 을 재지 «배치» 를 재지 않는다.** 이 패키지의 vitest 는
 * `environment: 'node'` 이고 include 가 `tests/**\/*.test.ts` 라 `.tsx` 가 애초에
 * 글롭 밖이며, jsdom 을 켜도 레이아웃을 계산하지 않아 `getBoundingClientRect()` 가
 * 전부 0 이다. ⇒ 여기서 «열 폭이 실제로 균등한가» 는 원리적으로 잴 수 없다.
 *
 * 그래서 이 패키지의 기존 관용구를 따른다 — `lob-charter.test.ts` 와
 * `preset-contract.test.ts` 도 파일을 읽어 정규식으로 «구현이 계약과 같은 것을
 * 말하는가» 를 잰다. 한계를 숨기지 않고 적어 둔다: **이 단언이 초록이어도 배치가
 * 옳다는 증명은 아니다.** 배치는 형제 패키지의 브라우저 프로젝트를 계측기로 빌려
 * 일회성 탐침으로 쟀고, 그 수치는 CHANGELOG 와 README 에 남겼다.
 */
describe('L2 폼 레이아웃 크기 계약', () => {
  it('🔴`FormRow` 의 그리드 트랙이 `minmax(0, 1fr)` 이다 — 순수 `1fr` 은 «균등» 을 약속하고 지키지 않는다', () => {
    // 그리드 아이템의 기본 `min-width: auto` 는 내용의 min-content 아래로 줄어들기를
    // 거부한다. 그래서 `repeat(n, 1fr)` 은 한 칸에 긴 내용이 들어오면 그 칸만 부풀고
    // 나머지가 찌그러진다 — 실측(400px 컨테이너): 2열이 425/8, 3열이 425/8/8 이었다.
    // `minmax(0, 1fr)` 은 트랙의 최소를 0 으로 만들어 자식을 건드리지 않고 이를 고친다
    // (같은 실측에서 196/196 · 128/128/128).
    const src = read('src/FormRow.tsx');
    expect(src, '트랙 정의가 minmax(0, 1fr) 이어야 한다').toMatch(
      /repeat\(\$\{columns\},\s*minmax\(0,\s*1fr\)\)/,
    );
    expect(
      /repeat\(\$\{columns\},\s*1fr\)/.test(src),
      '순수 1fr 트랙이 남아 있다',
    ).toBe(false);
  });

  it('`full` 경로는 폭을 100% 로 주장한다', () => {
    expect(read('src/FormRow.tsx')).toMatch(/width:\s*'100%'/);
  });

  it('크기 계약이 문서화돼 있다 — 소비자가 읽는 자리에', () => {
    // 이 계층은 문서가 곧 계약이다(docs/lob-layers.md). 동작만 고치고 적지 않으면
    // 소비자는 여전히 «2열이면 반반» 을 가정한 채 긴 내용을 넣는다.
    const readme = read('README.md');
    expect(readme, 'README 에 그리드 폭 거동 설명이 없다').toMatch(/minmax\(0,\s*1fr\)/);
  });
});
