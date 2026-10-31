import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { FormRow, FormSection } from '../../src/react';

/**
 * **`FormRow` 의 열 수는 상한이고, 실제 열 수는 컨테이너 폭이 정한다** · **`FormSection` 의 제목은 선택**.
 *
 * ## 왜 브라우저인가
 *
 * 열이 접히는지는 배치 계산의 결과라 node · jsdom 에서는 원리적으로 못 잰다(폭이 전부 0).
 * `tests/form-layout-contract.test.ts` 는 선언을, 이 파일은 실제 칸 폭을 잰다.
 */

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

async function mount(width: number, node: ReactNode): Promise<HTMLDivElement> {
  container = document.createElement('div');
  container.style.width = `${width}px`;
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(node); });
  return container;
}

/** 칸마다 [left, width] — 같은 행은 top 이 같다. */
function cells(host: HTMLElement): { top: number; left: number; width: number }[] {
  const row = host.firstElementChild as HTMLElement;
  const origin = row.getBoundingClientRect();
  return [...row.children].map((c) => {
    const r = c.getBoundingClientRect();
    return { top: Math.round(r.top - origin.top), left: Math.round(r.left - origin.left), width: Math.round(r.width) };
  });
}

const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);
const cell = (text = 'x') => <div>{text}</div>;

describe('FormRow — 좁은 자리에서 접힌다', () => {
  it('넓으면 정확히 columns 칸 · 균등(종전과 같은 폭)', async () => {
    const host = await mount(800, <FormRow>{cell()}{cell()}</FormRow>);
    const [a, b] = cells(host);
    expect(a.top).toBe(b.top);
    expect([a.width, b.width]).toEqual([396, 396]);
  });

  it('폰 폭(390px) · 기본 최소 폭(14rem)이면 한 열로', async () => {
    const host = await mount(390, <FormRow>{cell()}{cell()}</FormRow>);
    const [a, b] = cells(host);
    expect(b.top, '둘째 칸이 다음 줄로').toBeGreaterThan(a.top);
    expect([a.width, b.width]).toEqual([390, 390]);
  });

  it('columns=3 이 담기지 않으면 담기는 만큼(2열)', async () => {
    const min = 14 * rem();
    const width = Math.floor(3 * min + 2 * 8) - 20; // 세 칸은 안 되고 두 칸은 되는 폭
    const host = await mount(width, <FormRow columns={3}>{cell()}{cell()}{cell()}</FormRow>);
    const [a, b, c] = cells(host);
    expect(a.top).toBe(b.top);
    expect(c.top).toBeGreaterThan(a.top);
    expect(a.width).toBe(Math.round((width - 8) / 2));
  });

  it('minColumnWidth={0} 이면 늘 columns 열', async () => {
    const host = await mount(390, <FormRow minColumnWidth={0}>{cell()}{cell()}</FormRow>);
    const [a, b] = cells(host);
    expect(a.top).toBe(b.top);
    expect([a.width, b.width]).toEqual([191, 191]);
  });

  it('숫자 minColumnWidth 는 px', async () => {
    const host = await mount(390, <FormRow minColumnWidth={150}>{cell()}{cell()}</FormRow>);
    const [a, b] = cells(host);
    expect(a.top, '150px 두 칸은 390 에 담긴다').toBe(b.top);
  });

  it('긴 불가분 내용이 든 칸도 부풀지 않는다', async () => {
    const host = await mount(800, <FormRow>{cell('가'.repeat(5) + 'x'.repeat(200))}{cell()}</FormRow>);
    const [a, b] = cells(host);
    expect([a.width, b.width]).toEqual([396, 396]);
  });

  it('칸이 모자란 행도 같은 격자에 선다(한 칸이면 반 폭)', async () => {
    const host = await mount(800, <FormRow>{cell()}</FormRow>);
    expect(cells(host)[0].width).toBe(396);
  });
});

describe('FormSection — 제목은 선택', () => {
  it('제목이 없으면 제목 줄을 그리지 않는다', async () => {
    const host = await mount(600, <FormSection><FormRow>{cell()}{cell()}</FormRow></FormSection>);
    const block = host.firstElementChild as HTMLElement;
    expect(block.children.length, '블록 안에 본문 하나뿐').toBe(1);
    expect(block.textContent).toBe('xx');
  });

  it("빈 문자열도 '없음' 이다", async () => {
    const host = await mount(600, <FormSection title="">{cell()}</FormSection>);
    expect((host.firstElementChild as HTMLElement).children.length).toBe(1);
  });

  it('제목이 있으면 제목 줄 + 본문', async () => {
    const host = await mount(600, <FormSection title="기본 정보">{cell()}</FormSection>);
    const block = host.firstElementChild as HTMLElement;
    expect(block.children.length).toBe(2);
    expect(block.children[0].textContent).toBe('기본 정보');
    expect(getComputedStyle(block.children[0]).borderBottomStyle).toBe('solid');
  });
});
