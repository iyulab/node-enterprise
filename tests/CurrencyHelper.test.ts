import { describe, it, expect, vi } from 'vitest';
import { CurrencyHelper } from '../src/helpers/CurrencyHelper';

describe('CurrencyHelper (formatCurrency 위임으로 축소됨)', () => {
  it('formatKRW 는 종전과 동일한 출력을 낸다', () => {
    expect(CurrencyHelper.formatKRW(550000)).toBe('₩550,000');
  });

  it('formatUSD 는 종전과 동일한 출력을 낸다', () => {
    expect(CurrencyHelper.formatUSD(1999.5)).toBe('$1,999.5');
  });

  it('null/undefined 는 em dash("—")를 반환한다 — 0과 구분되는 "값 없음" 표기', () => {
    expect(CurrencyHelper.formatKRW(null)).toBe('—');
    expect(CurrencyHelper.formatKRW(undefined)).toBe('—');
  });

  it('0은 "값 없음"과 구분되어 그대로 표기된다', () => {
    expect(CurrencyHelper.formatKRW(0)).toBe('₩0');
  });

  it('formatCurrency 는 KRW 에서 소수점을 반올림한다', () => {
    expect(CurrencyHelper.formatCurrency(1234.5, 'KRW', 'ko-KR')).toBe('₩1,235');
  });

  it('parseCurrency 는 통화 기호·구분자를 제거하고 숫자로 되돌린다', () => {
    expect(CurrencyHelper.parseCurrency('₩550,000')).toBe(550000);
    expect(CurrencyHelper.parseCurrency('')).toBe(0);
  });
});

describe('CurrencyHelper deprecation 경고 — 프로세스당 1회', () => {
  it('formatCurrency(및 그 위임 경로인 formatKRW 등)를 처음 호출하면 console.warn 1회', async () => {
    vi.resetModules();
    const { CurrencyHelper: FreshCurrencyHelper } = await import('../src/helpers/CurrencyHelper');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    FreshCurrencyHelper.formatKRW(1000);
    FreshCurrencyHelper.formatUSD(1000);
    FreshCurrencyHelper.formatCurrency(1000);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('CurrencyHelper');
    warnSpy.mockRestore();
  });

  it('parseCurrency는 formatCurrency 계열이 아니라 경고를 내지 않는다', async () => {
    vi.resetModules();
    const { CurrencyHelper: FreshCurrencyHelper } = await import('../src/helpers/CurrencyHelper');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    FreshCurrencyHelper.parseCurrency('₩1,000');

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
