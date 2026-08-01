import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'fs';
import { resolve, join, basename } from 'path';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf-8');
const charter = () => read('docs/lob-layers.md');

/** L2 UI 컴포넌트 = `src/` 최상위의 `.tsx`. 그 아래 디렉터리는 서비스·헬퍼 층이다. */
const l2Files = () =>
  globSync('src/*.tsx', { cwd: root }).map(rel => [basename(rel, '.tsx'), read(rel)] as const);

/**
 * 헌장(`docs/lob-layers.md`)이 문서로만 남지 않게 한다.
 *
 * ★계층 헌장의 실패 형태는 **위반이 아니라 표류**다. 문서는 그대로인데 구현이 조금씩
 * 어긋나고, 어긋남이 눈에 띄지 않는 이유는 **둘 다 그 자체로는 멀쩡해 보이기** 때문이다.
 * 그래서 이 파일은 "헌장이 있는가"가 아니라 **헌장과 구현이 같은 것을 말하는가**를 본다.
 *
 * 이 계층은 문서가 곧 계약이라, 문서가 낡으면 소비자가 없는 것을 믿게 된다.
 */
describe('LOB 계층 헌장 — 문서와 구현의 정합', () => {
  it('L2 컴포넌트가 팔레트를 직접 읽지 않는다 (§2-2)', () => {
    // 팔레트는 이름이 곧 값의 약속이다. 소비자가 브랜드를 맞추려고 덮으면
    // *진짜 그 색*이 필요한 곳까지 함께 오염된다.
    const hits = l2Files().flatMap(([name, src]) =>
      [...src.matchAll(/--u-(?:blue|red|green|yellow|neutral)-\d+/g)].map(m => `${name}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });

  it('L2 컴포넌트가 오버라이드 경로를 연다 (§2 — 1급 조항)', () => {
    // 오버라이드 경로가 없는 패턴은 이 계층에 들어올 수 없다. 경로가 없으면 소비자는
    // 통째로 복제하게 되고, 그 순간 이 계층은 **쓰기 전보다 나쁜 상태**를 만든다.
    const missing = l2Files()
      .filter(([, src]) => !/className\?: string/.test(src) || !/style\?: CSSProperties/.test(src))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('L2 컴포넌트가 스타일을 인라인으로 굳히지 않는다 (§2-1)', () => {
    // 호출자의 style 이 뒤에 와야 병합된다. 앞에 오거나 아예 받지 않으면 소비자 값이
    // 기본값에 덮여, prop 이 있는데도 아무 일이 일어나지 않는다.
    const offenders = l2Files()
      .filter(([, src]) => /style=\{\{/.test(src) && !/\.\.\.style,?\s*\}\}/.test(src))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it('헌장이 "제공 중"이라 적은 패턴이 실제로 export 된다', () => {
    const provided = [...charter().matchAll(/^\| `([A-Za-z]+)`(?: · `([A-Za-z]+)`)? \| ★★ 실측 \| \*\*제공 중\*\* \|/gm)]
      .flatMap(m => [m[1], m[2]])
      .filter(Boolean) as string[];
    expect(provided.length).toBeGreaterThan(0); // 표 파싱이 깨지면 아래 대조가 무의미해진다

    const index = read('src/index.ts');
    expect(provided.filter(name => !index.includes(`export { ${name} }`))).toEqual([]);
  });

  it('★"만들지 않는다"로 등재된 패턴이 구현돼 있지 않다', () => {
    // 등급 ○(요구)는 실측 없는 요청이다. 만들면 "만들어 두고 아무도 쓰지 않는" 형태로
    // 끝나고, 그 뒤로는 지우기도 어려워진다. 이 단언은 그 선을 코드로 지킨다.
    const forbidden = [...charter().matchAll(/^\| ([A-Za-z]+)\([^)]*\) \| ○ 요구 \| ❌/gm)].map(m => m[1]);
    expect(forbidden.length).toBeGreaterThan(0);

    const exported = read('src/index.ts');
    expect(forbidden.filter(name => exported.includes(name))).toEqual([]);
  });

  it('프레임워크 전제가 헌장에 명시돼 있다', () => {
    // ★이 문장이 없으면 다른 프레임워크의 소비자가 나타났을 때 아무도 결정하지 않은 채
    // 갈라진다 — 이 계층이 막으려는 실패가 정확히 그 형태다.
    expect(charter()).toMatch(/L0·L1 은 프레임워크 중립이다\. L2·L3 는 React 를 전제한다/);
  });
});
