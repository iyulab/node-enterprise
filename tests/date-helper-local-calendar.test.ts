import { describe, it, expect, afterEach } from 'vitest';
import { DateHelper } from '../src/helpers/DateHelper';
import { ApiConfig } from '../src/ApiConfig';

/**
 * `DateHelper` 의 시간 모델은 로컬 달력이다.
 *
 * 결함: `formatDate`·`formatDateTime` 이 `toISOString()`(UTC)을 잘라, KST 새벽 00:00~08:59 는 전날로,
 * 시각은 9시간 틀리게 적었다. 날짜만 있는 문자열은 UTC 자정으로 읽혀 미주 시간대에서 전날이 됐다.
 * 시간대를 바꿔 재야 보인다 — 러너의 시간대가 UTC 면 종전 코드도 초록이다.
 */
const original = process.env.TZ;
afterEach(() => {
  process.env.TZ = original;
});

describe('DateHelper — 로컬 달력', () => {
  it('KST 새벽의 날짜와 시각을 그 시간대 그대로 적는다', () => {
    process.env.TZ = 'Asia/Seoul';
    const d = new Date(2026, 8, 29, 3, 5);
    expect(DateHelper.formatDate(d)).toBe('2026-09-29');
    expect(DateHelper.formatDateTime(d)).toBe('2026-09-29 03:05');
  });

  it('날짜만 있는 문자열은 그 날로 읽는다 — UTC 보다 뒤인 시간대에서도', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(DateHelper.formatDate('2026-09-29')).toBe('2026-09-29');
    expect(DateHelper.addDays('2026-09-29', 1).getDate()).toBe(30);
    expect(DateHelper.isToday(DateHelper.formatDate(new Date()))).toBe(true);
  });

  it('시점이 담긴 ISO 문자열은 시점으로 읽고 로컬로 적는다', () => {
    process.env.TZ = 'Asia/Seoul';
    expect(DateHelper.formatDateTime('2026-09-28T18:30:00Z')).toBe('2026-09-29 03:30');
  });
});

describe('ApiConfig — 끝 슬래시', () => {
  afterEach(() => ApiConfig.initialize({ baseUrl: '', odataPrefix: '$data', apiPrefix: 'api' }));

  it("baseUrl '/' 는 '' 와 같다 — 종전에는 '//$data/…' 로 다른 호스트를 가리켰다", () => {
    ApiConfig.initialize({ baseUrl: '/' });
    expect(ApiConfig.getODataUrl('Orders')).toBe('/$data/Orders');
    expect(ApiConfig.getApiUrl('/auth/me')).toBe('/api/auth/me');
  });

  it('절대 URL 의 끝 슬래시와 접두사의 양쪽 슬래시를 뗀다', () => {
    ApiConfig.initialize({ baseUrl: 'https://api.example.com/', odataPrefix: '/odata/', apiPrefix: 'api/' });
    expect(ApiConfig.getODataUrl('Orders')).toBe('https://api.example.com/odata/Orders');
    expect(ApiConfig.getApiUrl('x')).toBe('https://api.example.com/api/x');
    ApiConfig.setBaseUrl('https://h/');
    expect(ApiConfig.baseUrl).toBe('https://h');
  });
});
