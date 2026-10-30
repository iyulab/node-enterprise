import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@iyulab/components/dist/components/input/UInput.js';
import '@iyulab/components/dist/components/button/UButton.js';
import '@iyulab/components/dist/components/checkbox/UCheckbox.js';
import '@iyulab/components/dist/components/switch/USwitch.js';
import '@iyulab/components/dist/components/select/USelect.js';
import '../../src/list-page';
import type { UListPage } from '../../src/list/UListPage';

/**
 * **`filters` 영역의 줄 맞춤.** 두 조건을 한 파일이 함께 잰다 — 하나만 재면 다른 하나를 잃는 수정이 초록으로 통과한다.
 *
 * | 계약 | 재는 것 |
 * |---|---|
 * | 컨트롤 | 라벨 있는 칸 · 라벨 없는 칸 · 단추의 **아래 끝**이 한 선이다 |
 * | 비컨트롤 | 체크박스 토글 같은 항목의 **가운데**가 단추의 가운데에 선다(높이 리터럴 없음) |
 *
 * ## 왜 브라우저인가
 *
 * 줄 맞춤은 상자 모델과 글자 기준선의 결과다 — jsdom 은 레이아웃을 계산하지 않는다.
 */

let host: HTMLDivElement;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { host.remove(); });

async function mount(filters: string): Promise<UListPage> {
  // 뷰포트가 좁아 접히지 않게 칸 폭을 줄이고, 토글은 한 줄로 둔다.
  const slotted = filters
    .replace(/<(u-input|u-select)/g, '<$1 slot="filters" style="inline-size: 100px"')
    .replace(/<(u-button|u-switch|label|span)/g, '<$1 slot="filters" style="white-space: nowrap"');
  host.innerHTML = `<u-list-page>${slotted}</u-list-page>`;
  const page = host.querySelector('u-list-page') as UListPage;
  await page.updateComplete;
  await Promise.all(['u-input', 'u-select', 'u-button', 'u-checkbox', 'u-switch'].map((t) => customElements.whenDefined(t)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => setTimeout(r, 50));
  return page;
}

const box = (el: Element) => el.getBoundingClientRect();
const bottom = (el: Element) => box(el).bottom;
const middle = (el: Element) => box(el).top + box(el).height / 2;

describe('u-list-page filters — 줄 맞춤', () => {
  it('라벨 있는 칸 · 라벨 없는 칸 · 단추의 아래 끝이 한 선이다', async () => {
    const page = await mount(`
      <u-input label="Name"></u-input>
      <u-input aria-label="Search"></u-input>
      <u-button>Go</u-button>`);
    const [named, bare] = [...page.querySelectorAll('u-input')];
    const button = page.querySelector('u-button')!;
    expect(Math.abs(bottom(named) - bottom(button))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(bottom(bare) - bottom(button))).toBeLessThanOrEqual(0.5);
  });

  it('체크박스 토글의 가운데가 단추의 가운데에 선다 — 그러면서 칸의 아래 끝도 단추와 같다', async () => {
    const page = await mount(`
      <u-input label="Name"></u-input>
      <u-button>Go</u-button>
      <label><input type="checkbox"> Include archived</label>`);
    const input = page.querySelector('u-input')!;
    const button = page.querySelector('u-button')!;
    const check = page.querySelector('label')!;
    expect(Math.abs(middle(check) - middle(button))).toBeLessThanOrEqual(2);
    expect(Math.abs(bottom(input) - bottom(button))).toBeLessThanOrEqual(0.5);
  });

  it('단추가 없는 줄에서도 칸의 아래 끝과 토글이 어긋나 흩어지지 않는다', async () => {
    const page = await mount(`
      <u-input label="Name"></u-input>
      <span>Archived are hidden</span>`);
    const input = page.querySelector('u-input')!;
    const check = page.querySelector('span')!;
    // 칸의 입력 상자 가운데 근처(칸 전체 높이의 아래쪽 절반)에 선다
    expect(middle(check)).toBeGreaterThan(box(input).top + box(input).height / 2);
  });

  it('라벨을 단 스위치도 토글이다 — 단추의 글자 줄에 서고, 라벨 있는 고르기 칸은 아래 끝에 선다', async () => {
    const page = await mount(`
      <u-select label="Status"></u-select>
      <u-button>Go</u-button>
      <u-switch label="Include archived"></u-switch>`);
    const select = page.querySelector('u-select')!;
    const button = page.querySelector('u-button')!;
    const toggle = page.querySelector('u-switch')!;
    expect(Math.abs(bottom(select) - bottom(button))).toBeLessThanOrEqual(0.5);
    expect(Math.abs(middle(toggle) - middle(button))).toBeLessThanOrEqual(2);
  });
});
