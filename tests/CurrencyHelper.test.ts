import { describe, it, expect } from 'vitest';
import { CurrencyHelper } from '../src/helpers/CurrencyHelper';

describe('CurrencyHelper (formatCurrency 재-export로 축소됨)', () => {
  it('formatKRW 는 종전과 동일한 출력을 낸다', () => {
    expect(CurrencyHelper.formatKRW(550000)).toBe('₩550,000');
  });

  it('formatUSD 는 종전과 동일한 출력을 낸다', () => {
    expect(CurrencyHelper.formatUSD(1999.5)).toBe('$1,999.5');
  });

  it('null/undefined 는 "-" 를 반환한다', () => {
    expect(CurrencyHelper.formatKRW(null)).toBe('-');
    expect(CurrencyHelper.formatKRW(undefined)).toBe('-');
  });

  it('formatCurrency 는 KRW 에서 소수점을 반올림한다', () => {
    expect(CurrencyHelper.formatCurrency(1234.5, 'KRW', 'ko-KR')).toBe('₩1,235');
  });

  it('parseCurrency 는 통화 기호·구분자를 제거하고 숫자로 되돌린다', () => {
    expect(CurrencyHelper.parseCurrency('₩550,000')).toBe(550000);
    expect(CurrencyHelper.parseCurrency('')).toBe(0);
  });
});
