import { describe, it, expect, afterEach } from 'vitest';
import { Locale } from '@iyulab/components';
import { ProgressHelper, UrgencyHelper, messages } from '../src/helpers';

/**
 * 헬퍼 라벨의 **로케일 이주** 계약.
 *
 * ## 무엇을 재는가
 *
 * ⑴ 기본이 **영어**다 — 이 리포가 채택한 표준(영어 기본 + 레지스트리)이 실제로 적용됐는가.
 * ⑵ **한국어 환경은 종전 문구를 본다** — 이주가 기존 사용자에게 회귀가 아니어야 한다.
 * ⑶ 소비자가 **덮을 수 있다** — 레지스트리가 레지스트리답게 동작하는가.
 * ⑷ 치환이 산다 — `{days}` 자리가 실제 숫자로 바뀌는가.
 *
 * ⚠⑵ 가 이 파일의 핵심이다. 이주의 실패 형태는 *"영어로 잘 바뀌었다"* 가 아니라
 * **한국어 사용자가 갑자기 영어를 보는 것**이다.
 */

afterEach(() => Locale.set('en'));

describe('enterprise 헬퍼 라벨 — 영어 기본 + 레지스트리', () => {
  it('⑴ 기본 로케일(en)에서 영어를 낸다', () => {
    Locale.set('en');
    expect(ProgressHelper.getProgressLabel(0)).toBe('Not started');
    expect(ProgressHelper.getProgressLabel(100)).toBe('Done');
    expect(UrgencyHelper.getUrgencyText(-1)).toBe('Overdue');
    expect(UrgencyHelper.formatDaysRemaining(0)).toBe('Today');
  });

  it('🔴⑵ 한국어 환경은 이주 전과 «같은 문구»를 본다', () => {
    Locale.set('ko');
    expect(ProgressHelper.getProgressLabel(0)).toBe('시작 전');
    expect(ProgressHelper.getProgressLabel(30)).toBe('진행 중');
    expect(ProgressHelper.getProgressLabel(100)).toBe('완료');
    expect(UrgencyHelper.getUrgencyText(-1)).toBe('지연');
    expect(UrgencyHelper.getUrgencyText(0)).toBe('매우 급함');
    expect(UrgencyHelper.formatDaysRemaining(-3)).toBe('3일 지연');
    expect(UrgencyHelper.formatDaysRemaining(0)).toBe('오늘');
    expect(UrgencyHelper.formatDaysRemaining(5)).toBe('5일');
  });

  it('⑵-b 지역 태그도 따라온다 (ko-KR → ko)', () => {
    Locale.set('ko-KR');
    expect(ProgressHelper.getProgressLabel(100)).toBe('완료');
  });

  it('⑶ 소비자가 문구를 덮을 수 있다', () => {
    messages.register('en', { progressDone: 'Complete' });
    Locale.set('en');
    expect(ProgressHelper.getProgressLabel(100)).toBe('Complete');
    messages.register('en', { progressDone: 'Done' }); // 원복
  });

  it('⑷ 치환이 산다', () => {
    Locale.set('en');
    expect(UrgencyHelper.formatDaysRemaining(-2)).toBe('2 days overdue');
    expect(UrgencyHelper.formatDaysRemaining(7)).toBe('7 days left');
  });

  it('호출자가 준 labels 는 여전히 최우선이다 (종전 계약)', () => {
    Locale.set('en');
    expect(UrgencyHelper.getUrgencyText(-1, undefined, { overdue: 'LATE' })).toBe('LATE');
  });
});
