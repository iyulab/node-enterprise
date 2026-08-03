import { Locale } from '@iyulab/components';

/**
 * `@iyulab/enterprise` 의 화면 문자열 — **영어 기본 + 로케일 레지스트리**.
 *
 * ## 왜 이 파일이 생겼나
 *
 * 헬퍼들이 라벨을 **한국어 리터럴로** 들고 있었다(실측 14건). 이 리포는 이미 로케일 표준을
 * 채택했지만(영어 기본 + 레지스트리) **강제하는 장치가 없어서** 채택 이후에 들어온 코드가
 * 한국어 기본값을 갖고 있었다.
 *
 * ⚠**「의견 있음」이 정당화하는 것은 스타일 값의 의견이지 언어가 아니다**(2026-08-04 결정).
 *
 * ## 왜 자체 레지스트리를 만들지 않았나
 *
 * `@iyulab/components` 의 `Locale.namespace()`(1.23.0~)를 쓴다. 자체 구현은 이 조직의
 * **네 번째 레지스트리**가 됐을 것이고, 그러면 소비자가 앱 하나에서 로케일을 **두 번**
 * 전환해야 한다. `Locale.set()` 한 번으로 검증 메시지·이 라벨이 함께 따라온다.
 *
 * ## 동작 변화
 *
 * ⚠기본 로케일은 브라우저 언어에서 감지된다 — **한국어 브라우저는 종전과 같은 문구**를 본다
 * (`ko-KR` → `ko`). 그 밖의 환경은 한국어 대신 **영어**를 본다. 그것이 이 이주의 목적이다.
 */
export type EnterpriseMessageKey =
  | 'progressNotStarted' | 'progressEarly' | 'progressInProgress'
  | 'progressPastMid' | 'progressAlmost' | 'progressDone'
  | 'urgencyOverdue' | 'urgencyCritical' | 'urgencyUrgent' | 'urgencySoon' | 'urgencyNormal'
  | 'daysOverdue' | 'daysToday' | 'daysRemaining';

/** 이 패키지의 문자열 묶음. 소비자는 `messages.register(locale, table)` 로 덮거나 언어를 더한다. */
export const messages = Locale.namespace<EnterpriseMessageKey>('@iyulab/enterprise');

messages.register('en', {
  progressNotStarted: 'Not started',
  progressEarly: 'Early stage',
  progressInProgress: 'In progress',
  progressPastMid: 'Past halfway',
  progressAlmost: 'Almost done',
  progressDone: 'Done',

  urgencyOverdue: 'Overdue',
  urgencyCritical: 'Critical',
  urgencyUrgent: 'Urgent',
  urgencySoon: 'Due soon',
  urgencyNormal: 'On track',

  daysOverdue: '{days} days overdue',
  daysToday: 'Today',
  daysRemaining: '{days} days left',
});

messages.register('ko', {
  progressNotStarted: '시작 전',
  progressEarly: '초기 단계',
  progressInProgress: '진행 중',
  progressPastMid: '중반 이상',
  progressAlmost: '거의 완료',
  progressDone: '완료',

  urgencyOverdue: '지연',
  urgencyCritical: '매우 급함',
  urgencyUrgent: '급함',
  urgencySoon: '곧 도래',
  urgencyNormal: '여유',

  daysOverdue: '{days}일 지연',
  daysToday: '오늘',
  daysRemaining: '{days}일',
});
