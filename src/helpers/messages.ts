import { Locale } from '@iyulab/components/dist/utilities/Locale.js';

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
  | 'daysOverdue' | 'daysToday' | 'daysRemaining'
  // 데이터 서비스(`createODataService`) — 설정 `messages` 가 주지 않은 문구
  | 'saved' | 'updated' | 'deleted' | 'sessionExpired' | 'requestFailed'
  | 'http400' | 'http403' | 'http404' | 'http409' | 'http412' | 'http500'
  // 인증 클라이언트(`createAuthClient`) — 설정 `messages` 가 주지 않은 문구
  | 'authInvalidCredentials' | 'authLoginFailed' | 'authSessionCheckFailed' | 'authLogoutFailed'
  | 'authNetworkError' | 'authInvalidResponse';

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

  saved: 'Saved',
  updated: 'Updated',
  deleted: 'Deleted',
  sessionExpired: 'Your session has expired. Please sign in again.',
  requestFailed: 'Request failed',
  http400: 'Bad request',
  http403: 'Forbidden',
  http404: 'Not found',
  http409: 'Conflict',
  http412: 'Someone else changed this record. Reload it and try again.',
  http500: 'Server error',

  authInvalidCredentials: 'Invalid username or password.',
  authLoginFailed: 'Login failed.',
  authSessionCheckFailed: 'Could not verify the session.',
  authLogoutFailed: 'Could not sign out.',
  authNetworkError: 'A network error occurred.',
  authInvalidResponse: 'The server returned an unreadable response.',
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

  saved: '저장했습니다',
  updated: '수정했습니다',
  deleted: '삭제했습니다',
  sessionExpired: '세션이 만료되었습니다. 다시 로그인하세요.',
  requestFailed: '요청이 실패했습니다.',
  http400: '요청이 올바르지 않습니다.',
  http403: '권한이 없습니다.',
  http404: '찾을 수 없습니다.',
  http409: '다른 변경과 충돌했습니다.',
  http412: '다른 사람이 이 항목을 바꿨습니다. 다시 불러온 뒤 시도하세요.',
  http500: '서버 오류가 발생했습니다.',

  authInvalidCredentials: '아이디 또는 비밀번호가 올바르지 않습니다.',
  authLoginFailed: '로그인하지 못했습니다.',
  authSessionCheckFailed: '세션을 확인하지 못했습니다.',
  authLogoutFailed: '로그아웃하지 못했습니다.',
  authNetworkError: '네트워크 오류가 발생했습니다.',
  authInvalidResponse: '서버 응답을 읽을 수 없습니다.',
});
