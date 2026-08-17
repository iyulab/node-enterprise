import { describe, it, expect } from 'vitest';
import { CurrencyHelper } from '../src/helpers/CurrencyHelper';
import { DateHelper } from '../src/helpers/DateHelper';
import { UrgencyHelper } from '../src/helpers/UrgencyHelper';
import { ProgressHelper } from '../src/helpers/ProgressHelper';
import { EMPTY_VALUE_DISPLAY } from '../src/helpers/constants';

/**
 * "값 없음"과 "0"은 다른 사실이다 — 이 패키지의 모든 포맷 헬퍼가 `null`/`undefined`를
 * 실제 `0`과 구분해서 표기하는지 재확인한다.
 *
 * `EMPTY_VALUE_DISPLAY`(em dash `—`)를 8곳(Currency 1 · Date 6 · Urgency 1)에서 공유하고,
 * `ProgressHelper`는 값 자체가 숫자 하나뿐이라 문자열로 접을 수 없어 `null`을 반환한다
 * (호출자가 렌더 시점에 `EMPTY_VALUE_DISPLAY`로 표기할지 결정한다).
 */
describe('빈 값 표기 — null/undefined ≠ 0', () => {
  it('EMPTY_VALUE_DISPLAY는 em dash다(하이픈이 아니다)', () => {
    expect(EMPTY_VALUE_DISPLAY).toBe('—');
    expect(EMPTY_VALUE_DISPLAY).not.toBe('-');
  });

  it('CurrencyHelper — null/undefined는 em dash, 0은 0으로 표기된다', () => {
    expect(CurrencyHelper.formatCurrency(null)).toBe(EMPTY_VALUE_DISPLAY);
    expect(CurrencyHelper.formatCurrency(undefined)).toBe(EMPTY_VALUE_DISPLAY);
    expect(CurrencyHelper.formatKRW(0)).toBe('₩0');
  });

  it('DateHelper — 세 포맷 함수 모두 null/undefined/불가해 문자열에 em dash를 낸다', () => {
    expect(DateHelper.formatDate(null)).toBe(EMPTY_VALUE_DISPLAY);
    expect(DateHelper.formatDate(undefined)).toBe(EMPTY_VALUE_DISPLAY);
    expect(DateHelper.formatDate('not-a-date')).toBe(EMPTY_VALUE_DISPLAY);
    expect(DateHelper.formatLocalDate(null)).toBe(EMPTY_VALUE_DISPLAY);
    expect(DateHelper.formatLocalDate('not-a-date')).toBe(EMPTY_VALUE_DISPLAY);
    expect(DateHelper.formatDateTime(null)).toBe(EMPTY_VALUE_DISPLAY);
    expect(DateHelper.formatDateTime('not-a-date')).toBe(EMPTY_VALUE_DISPLAY);

    // 유효한 날짜는 여전히 정상 포맷된다(회귀 아님)
    expect(DateHelper.formatDate('2026-08-17')).toBe('2026-08-17');
  });

  it('UrgencyHelper — formatDaysRemaining의 null/undefined는 em dash, 0("오늘")은 0으로 취급된다', () => {
    expect(UrgencyHelper.formatDaysRemaining(null)).toBe(EMPTY_VALUE_DISPLAY);
    expect(UrgencyHelper.formatDaysRemaining(undefined)).toBe(EMPTY_VALUE_DISPLAY);
    expect(UrgencyHelper.formatDaysRemaining(0)).not.toBe(EMPTY_VALUE_DISPLAY);
  });

  it('ProgressHelper.validateProgress — null/undefined/NaN은 null, 0은 0을 반환한다', () => {
    expect(ProgressHelper.validateProgress(null)).toBeNull();
    expect(ProgressHelper.validateProgress(undefined)).toBeNull();
    expect(ProgressHelper.validateProgress(NaN)).toBeNull();
    expect(ProgressHelper.validateProgress(0)).toBe(0);
    expect(ProgressHelper.validateProgress(0)).not.toBeNull();
  });

  it('ProgressHelper.ratioToPercent — null/undefined/NaN은 null, 0은 0을 반환한다', () => {
    expect(ProgressHelper.ratioToPercent(null)).toBeNull();
    expect(ProgressHelper.ratioToPercent(undefined)).toBeNull();
    expect(ProgressHelper.ratioToPercent(NaN)).toBeNull();
    expect(ProgressHelper.ratioToPercent(0)).toBe(0);
  });

  it('ProgressHelper — 정상 숫자 호출부(getProgressLabel 등)는 종전과 동일하게 동작한다(회귀 아님)', () => {
    expect(ProgressHelper.getProgressLabel(0)).toBeTruthy();
    expect(ProgressHelper.calculateProgress(50, 100)).toBe(50);
    expect(ProgressHelper.calculateProgress(0, 0)).toBe(0); // total<=0은 값 결정 불가 케이스라 0 유지(별개 사실)
  });
});
