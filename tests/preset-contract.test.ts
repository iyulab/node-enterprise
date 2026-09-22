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

  /**
   * 🔴**⑶-c — 세 번째 전제는 «우리가» 지킬 수 없다. 위임했고, 그 위임을 여기서 잰다.**
   *
   * ⑶은 전제가 **셋**이다: ⓐ특이도 대등 · ⓑ이길 것이 있음 · ⓒ**로드 순서가 실제로 프리셋을
   * 기본 시트보다 뒤에 둔다.** 위 두 검사는 ⓐⓑ만 재고, 둘 다 **0.7.0 의 `:where()` 사고에서
   * 태어났다** — 즉 *예전에 실패한 전제*만 지키고 있었다.
   *
   * ⚠**ⓒ가 깨진 채로 오래 살았다.** 기본 시트는 `Theme.init()` 이 **런타임에** 넣고, 이 파일은
   * 번들러가 **파싱 시점에** 올린다. `@iyulab/components` 1.43.x 이하는 그 시트를 `<head>`
   * **끝**에 붙였으므로 ***언제나 기본값이 이겼다*** — 문서한 `import` 한 줄이 무효였고,
   * 오류도 경고도 없었다.
   *
   * 🔴**그래서 이 검사는 «동작» 이 아니라 «위임» 을 잰다.** ⓒ의 실제 측정은 그 동작을 소유한
   * 패키지에 있다(`@iyulab/components` 의 `tests/browser/theme-base-layer.browser.test.ts` —
   * 실 브라우저 계산값으로 재고, 삽입 지점을 되돌리면 발화한다). 이 패키지가 할 수 있는 유일한
   * 일은 ***그 동작을 가진 버전을 요구하는 것*** 이고, 그것은 `peerDependencies` 로 표현된다.
   *
   * ⚠**브라우저 프로젝트를 신설하지 않은 근거**: 여기서 그것을 다시 재면 위 상류 검사와 **같은
   * 기전**을 재게 된다(이 파일 고유의 실패 모드가 아니다). 이 패키지에 두 번째 CSS 계약이
   * 생기면 그때 다시 저울질한다.
   */
  it('🔴⑶-c 세 번째 전제를 가진 버전을 peer 로 «요구» 한다', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
    const range: string | undefined = pkg.peerDependencies?.['@iyulab/components'];
    expect(range, '@iyulab/components 가 peer 로 선언돼 있어야 한다').toBeTruthy();

    // 기본값 층이 «바닥» 에 서기 시작한 판. 이 아래를 담는 범위는 ⑶이 조용히 무효인
    // 조합을 소비자에게 허용한다 — 「범위가 담는다」와 「범위가 요구한다」는 다르다.
    const BASE_LAYER_MIN = [1, 44, 0];
    const floor = /(\d+)\.(\d+)\.(\d+)/.exec(range!);
    expect(floor, `해석할 수 없는 범위: ${range}`).not.toBeNull();
    const declared = floor!.slice(1).map(Number);

    const gte =
      declared[0] > BASE_LAYER_MIN[0] ||
      (declared[0] === BASE_LAYER_MIN[0] &&
        (declared[1] > BASE_LAYER_MIN[1] ||
          (declared[1] === BASE_LAYER_MIN[1] && declared[2] >= BASE_LAYER_MIN[2])));

    expect(
      gte,
      `peer 범위가 ${range} 라 기본값 층이 «끝» 에 붙던 판(≤1.43.x)을 담는다 — ` +
        '그 조합에서는 이 파일의 문서한 사용법(정적 import)이 조용히 무효다.',
    ).toBe(true);
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
