import { describe, it, expect, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@iyulab/components/dist/components/input/UInput.js';
import '@iyulab/components/dist/components/field/UField.js';
import { ApiError, applyFieldErrors, clearFieldErrors } from '../../src';

/**
 * **`applyFieldErrors` — 서버 거절의 필드 상세를 폼 컨트롤에.**
 *
 * | 계약 | 재는 것 |
 * |---|---|
 * | 내려놓기 | `target` = 컨트롤 `name` · 네이티브와 components 컨트롤 둘 다 · components 는 오류가 보인다 |
 * | 폼 단위 | `target` 없음 · 그 이름의 컨트롤 없음 → `formLevel` |
 * | 걷기 | 사용자가 그 칸을 고치면 걷힌다 · 다시 적용하면 앞의 것을 먼저 걷는다 · `clearFieldErrors` |
 * | 문장 | `options.message` 로 바꾼다 · 같은 `target` 여럿은 잇는다 |
 */

type Control = HTMLElement & { updateComplete?: Promise<unknown>; invalid?: boolean; validationMessage: string; value?: unknown };

async function settle(): Promise<void> {
  for (let i = 0; i < 2; i++) {
    for (const el of Array.from(document.body.querySelectorAll('*')) as Control[]) {
      if (el.updateComplete) await el.updateComplete;
    }
    await new Promise((r) => setTimeout(r, 30));
  }
}

const rejection = (details: { code: string; message: string; target?: string }[]) =>
  new ApiError('Validation failed.', 400, { code: 'InvalidBody', details });

async function mountForm(): Promise<HTMLFormElement> {
  document.body.innerHTML = `
    <form>
      <u-field label="Customer"><u-input name="Customer" value="Aster"></u-input></u-field>
      <input name="DeliveryDate" value="2026-03-31">
    </form>`;
  await settle();
  return document.querySelector('form')!;
}

const $ = (sel: string) => document.querySelector(sel) as Control;

describe('applyFieldErrors', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('대상 컨트롤에 메시지를 얹고, components 컨트롤은 오류를 보인다', async () => {
    const form = await mountForm();
    const r = applyFieldErrors(form, rejection([
      { code: 'ValidationFailed', message: 'Customer is suspended.', target: 'Customer' },
      { code: 'ValidationFailed', message: 'Must be after the order date.', target: 'DeliveryDate' },
    ]));
    await settle();
    expect(r.applied.map((a) => [a.control.getAttribute('name'), a.message])).toEqual([
      ['Customer', 'Customer is suspended.'],
      ['DeliveryDate', 'Must be after the order date.'],
    ]);
    expect(r.formLevel).toEqual([]);
    expect($('u-input').invalid).toBe(true);
    expect($('u-input').validationMessage).toBe('Customer is suspended.');
    expect(($('input') as unknown as HTMLInputElement).validationMessage).toBe('Must be after the order date.');
    expect(form.checkValidity()).toBe(false);
  });

  it('대상이 없거나 그 이름의 컨트롤이 없으면 폼 단위로 돌려준다', async () => {
    const form = await mountForm();
    const noTarget = { code: 'Conflict', message: 'The order was changed by someone else.' };
    const elsewhere = { code: 'ValidationFailed', message: 'Quantity too large.', target: 'Lines(1)/Qty' };
    const r = applyFieldErrors(form, rejection([noTarget, elsewhere]));
    expect(r.applied).toEqual([]);
    expect(r.formLevel).toEqual([noTarget, elsewhere]);
    expect(form.checkValidity()).toBe(true);
  });

  it('사용자가 그 칸을 고치면 서버 메시지가 걷힌다', async () => {
    const form = await mountForm();
    applyFieldErrors(form, rejection([{ code: 'ValidationFailed', message: 'Customer is suspended.', target: 'Customer' }]));
    await settle();
    expect($('u-input').invalid).toBe(true);
    await userEvent.click($('u-input'));
    await userEvent.keyboard(' Trading');
    await settle();
    expect($('u-input').invalid).toBe(false);
    expect(form.checkValidity()).toBe(true);
  });

  it('다시 적용하면 앞의 메시지를 먼저 걷는다 · clearFieldErrors 도 걷는다', async () => {
    const form = await mountForm();
    applyFieldErrors(form, rejection([{ code: 'X', message: 'first', target: 'Customer' }]));
    applyFieldErrors(form, rejection([{ code: 'X', message: 'second', target: 'DeliveryDate' }]));
    await settle();
    expect($('u-input').invalid).toBe(false);
    expect(($('input') as unknown as HTMLInputElement).validationMessage).toBe('second');

    clearFieldErrors(form);
    expect(form.checkValidity()).toBe(true);
  });

  it('문장은 options.message 로 바꾸고, 같은 대상 여럿은 잇는다', async () => {
    const form = await mountForm();
    const r = applyFieldErrors(form, [
      { code: 'Unconvertible', message: "Cannot convert 'x' to Edm.Date.", target: 'DeliveryDate' },
      { code: 'ValidationFailed', message: 'Must be a weekday.', target: 'DeliveryDate' },
    ], { message: (d) => (d.code === 'Unconvertible' ? '날짜 형식이 아닙니다.' : d.message) });
    expect(r.applied.map((a) => a.message)).toEqual(['날짜 형식이 아닙니다.', 'Must be a weekday.']);
    expect(($('input') as unknown as HTMLInputElement).validationMessage).toBe('날짜 형식이 아닙니다. Must be a weekday.');
  });

  it('ApiError 가 아닌 실패(네트워크 등)는 빈 결과다', async () => {
    const form = await mountForm();
    expect(applyFieldErrors(form, new TypeError('Failed to fetch'))).toEqual({ applied: [], formLevel: [] });
  });
});
