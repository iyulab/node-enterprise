import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const root = resolve(__dirname, '..');
const SRC = 'src/styles/preset.css';
const css = readFileSync(join(root, SRC), 'utf-8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const body = stripComments(css);

/** `selector { … }` 블록을 뽑는다. */
const blocks = () =>
  [...body.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(m => ({
    selector: m[1].trim(),
    decls: [...m[2].matchAll(/^\s*([\w-]+)\s*:\s*([^;]+);/gm)].map(d => [d[1], d[2].trim()] as const),
  }));

/**
 * 하우스 프리셋의 **계약**.
 *
 * 이 파일은 값만 담는 한 장이다. 그 성격이 무너지는 방식은 위반이 아니라 **표류**다 —
 * 편의를 위해 클래스 하나를 넣고, 그 다음 사람이 하나 더 넣고, 어느새 소비자가
 * 특이도 싸움을 하게 된다. 그래서 성격 자체를 여기서 잰다.
 */
describe('하우스 프리셋 계약', () => {
  it('⑵ `--u-*` 값만 덮는다 — 일반 CSS 속성 선언 0건', () => {
    const nonToken = blocks().flatMap(b =>
      b.decls.filter(([name]) => !name.startsWith('--u-')).map(([n]) => `${b.selector}: ${n}`),
    );
    expect(nonToken, '프리셋은 값만 담는다 — 속성을 직접 그리면 프리셋이 아니다').toEqual([]);
  });

  it('⑵ 새 클래스·요소 선택자를 만들지 않는다', () => {
    const bad = blocks()
      .map(b => b.selector)
      .filter(s => !/^:root(\[theme='dark'\])?$/.test(s));
    expect(bad, "허용 선택자는 :root 와 :root[theme='dark'] 뿐이다").toEqual([]);
  });

  /**
   * 🔴 **이 두 단언은 0.7.0 의 결함을 정정하며 «뒤집힌» 것이다.**
   *
   * 종전 판은 *"모든 선택자가 `:where()` 로 감싸져 특이도 0"* 을 요구했다. 의도는 옳았다 —
   * 프리셋이 소비자 브랜드를 덮으면 안 된다. 그러나 특이도 0 은 **이겨야 할 상대(기본값)와
   * 지지 말아야 할 상대(브랜드)를 구분하지 못한다.**
   *
   * ⇒ 그 테스트는 **통과하면서 기능을 무효로 만들고 있었다.** 실측: 프리셋 40선언 중
   * 기본 시트(`:root`)에 없는 것이 **0개** ⇒ `:where()`(0,0,0)가 이길 수 있는 자리가
   * 하나도 없어 **한 줄도 적용되지 않았다.** 그리고 그 실패는 **조용했다.**
   *
   * ★이 리포가 반복해서 본 형태다 — *"계약을 «존재»로 검증하고 «효력»으로 검증하지 않았다"*
   * (모션 축: 시트에 축이 있고 단언 둘이 통과하는데 경유 컴포넌트가 0개였다).
   * 그래서 아래 둘은 **효력**을 잰다: ⑴ 기본 시트를 이길 수 있는가, ⑵ 이길 것이 있는가.
   */
  it('🔴⑶-a 기본 시트를 이길 수 있다 — 특이도가 `:root` 와 대등하다', () => {
    const weak = blocks()
      .map(b => b.selector)
      .filter(s => s.includes(':where('));
    expect(
      weak,
      ':where() 는 특이도 0 이라 기본 시트의 :root 를 «로드 순서와 무관하게» 이길 수 없다. ' +
        '층은 로드 순서로 세운다 — 기본 → 프리셋 → 브랜드.',
    ).toEqual([]);
  });

  it('🔴⑶-b 이길 «것»이 있다 — 기본 시트와 다른 값이 하나 이상이다', () => {
    // 특이도가 맞아도 값이 전부 같으면 프리셋은 여전히 아무 일도 하지 않는다.
    // 소비자에게 두 상태는 렌더에서 구별되지 않으므로 여기서 가른다.
    const BASE = resolve(root, '..', 'components', 'src', 'assets', 'styles', 'light.css');
    if (!existsSync(BASE)) return; // 단독 클론 — 형제 소스가 없다

    const read = (p: string) =>
      new Map([...stripComments(readFileSync(p, 'utf-8')).matchAll(/(--u-[\w-]+)\s*:\s*([^;]+);/g)]
        .map(m => [m[1], m[2].trim()] as const));

    const base = read(BASE);
    const differing = [...read(join(root, SRC))].filter(([k, v]) => base.has(k) && base.get(k) !== v);
    expect(differing.length, '프리셋이 기본값과 전부 같다 — 로드해도 아무 일이 일어나지 않는다')
      .toBeGreaterThan(0);
  });

  it('축 이름을 발명하지 않는다 — components 가 여는 축만 채운다', () => {
    // 프리셋이 새 토큰 이름을 만들면 그 이름의 소유자가 사라진다(어느 패키지의 축인가?).
    const AXES = [
      /^--u-text-(display|title|subtitle|body|label|caption|overline)-(size|weight|leading|tracking)$/,
      /^--u-radius-(sm|md|lg|xl|2xl|3xl)$/,
      /^--u-shadow-(sm|md|lg|xl)$/,
      /^--u-shadow-color-(weakest|weaker|weak|normal|strong|stronger)$/,
      /^--u-space-(3xs|2xs|xs|sm|md|lg|xl|2xl|3xl|4xl)$/,
      /^--u-duration-(instant|fast|normal|slow)$/,
      /^--u-ease-(standard|decelerate|accelerate)$/,
      /^--u-font-(base|mono|serif|display|modern|rounded)$/,
    ];
    const unknown = blocks().flatMap(b =>
      b.decls.map(([n]) => n).filter(n => !AXES.some(re => re.test(n))),
    );
    expect(unknown, 'components 축 밖의 이름이다 — 축을 먼저 열어야 한다').toEqual([]);
  });

  it('🔴한글 안전 — 양수 자간은 `overline` 하나뿐이다', () => {
    const positive = blocks()
      .flatMap(b => b.decls)
      .filter(([n, v]) => n.endsWith('-tracking') && !v.startsWith('-') && parseFloat(v) > 0)
      .map(([n]) => n);
    expect(positive).toEqual(['--u-text-overline-tracking']);
  });

  it('★엘리베이션이 2겹을 유지한다 (components 의 배치 규약)', () => {
    const shadows = blocks()
      .flatMap(b => b.decls)
      .filter(([n]) => /^--u-shadow-(sm|md|lg|xl)$/.test(n));
    expect(shadows.length).toBeGreaterThan(0);
    const single = shadows.filter(([, v]) => v.split('),').length < 2).map(([n]) => n);
    expect(single, '1겹 그림자는 경계가 탁해 회색이 낀 것처럼 보인다').toEqual([]);
  });

  it('타입 스케일이 스케일답다 — 인접 단 비율 1.05~1.35 · 역전 없음', () => {
    const STEPS = ['display', 'title', 'subtitle', 'body', 'label', 'caption', 'overline'];
    const map = Object.fromEntries(blocks().flatMap(b => b.decls));
    const sizes = STEPS.map(s => Number(String(map[`--u-text-${s}-size`]).replace('px', '')));
    const bad: string[] = [];
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i], `${STEPS[i]} 가 ${STEPS[i - 1]} 이상이다`).toBeLessThan(sizes[i - 1]);
      const r = sizes[i - 1] / sizes[i];
      if (r < 1.05 || r > 1.35) bad.push(`${STEPS[i - 1]}/${STEPS[i]} = ${r.toFixed(3)}`);
    }
    expect(bad).toEqual([]);
  });

  it('🔴한글 행간 — 모든 단이 1.4 이상', () => {
    const map = Object.fromEntries(blocks().flatMap(b => b.decls));
    const bad = Object.entries(map)
      .filter(([n]) => n.endsWith('-leading'))
      .filter(([, v]) => !(Number(v) >= 1.4))
      .map(([n, v]) => `${n}: ${v}`);
    expect(bad).toEqual([]);
  });

  it('⑴ 소비자가 로드할 수 있는 경로로 export 된다', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    expect(pkg.exports?.['./styles/preset.css'], 'package.json exports 에 없다').toBeTruthy();
    // 빌드 후에만 존재한다 — 빌드를 돌린 트리에서만 검사한다.
    if (existsSync(join(root, 'dist')))
      expect(existsSync(join(root, 'dist/styles/preset.css')), 'dist 에 복사되지 않았다').toBe(true);
  });
});
