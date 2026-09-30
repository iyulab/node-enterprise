import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { EMPTY_VALUE_DISPLAY } from './constants';

/**
 * 이 헬퍼의 시간 모델은 **로컬 달력** 하나다.
 *
 * - 날짜만 있는 문자열(`'2026-09-29'`)은 그 날의 로컬 자정으로 읽는다. `new Date('2026-09-29')` 는
 *   UTC 자정으로 읽어, UTC 보다 뒤인 시간대(미주)에서는 전날이 된다.
 * - 출력은 로컬 접근자로 만든다. `toISOString()` 은 UTC 라, UTC 보다 앞선 시간대(KST 등)의
 *   새벽 00:00~08:59 를 전날로, 시각은 시차만큼 틀리게 적었다.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
function toDate(value: Date | string): Date {
    if (typeof value !== 'string') return new Date(value.getTime());
    const m = DATE_ONLY.exec(value);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Date manipulation and formatting utility class
 */
export class DateHelper {
    /**
     * Format date to YYYY-MM-DD string — the local calendar date
     * @param date - Date to format (Date object or ISO string; `YYYY-MM-DD` is read as a local date)
     */
    static formatDate(date: Date | string | null | undefined): string {
        if (!date) return EMPTY_VALUE_DISPLAY;

        const d = toDate(date);
        if (isNaN(d.getTime())) return EMPTY_VALUE_DISPLAY;

        return localDate(d);
    }

    /**
     * Format date to localized string
     * @param date - Date to format
     * @param locale - Locale for formatting (default: the app locale — `Locale.get()` from `@iyulab/components`)
     * @param options - Intl.DateTimeFormat options
     */
    static formatLocalDate(
        date: Date | string | null | undefined,
        locale: string = Locale.get(),
        options?: Intl.DateTimeFormatOptions
    ): string {
        if (!date) return EMPTY_VALUE_DISPLAY;

        const d = toDate(date);
        if (isNaN(d.getTime())) return EMPTY_VALUE_DISPLAY;

        return d.toLocaleDateString(locale, options || {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /**
     * Format datetime to YYYY-MM-DD HH:mm string — local date and time
     * @param date - Date to format
     */
    static formatDateTime(date: Date | string | null | undefined): string {
        if (!date) return EMPTY_VALUE_DISPLAY;

        const d = toDate(date);
        if (isNaN(d.getTime())) return EMPTY_VALUE_DISPLAY;

        return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    /**
     * Calculate days difference between two dates
     * @param startDate - Start date
     * @param endDate - End date
     * @returns Number of days (positive if endDate > startDate)
     */
    static getDaysDifference(
        startDate: Date | string,
        endDate: Date | string
    ): number {
        const start = toDate(startDate);
        const end = toDate(endDate);

        const timeDiff = end.getTime() - start.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    /**
     * Calculate days from now to target date
     * @param targetDate - Target date
     * @returns Days remaining (negative if overdue)
     */
    static getDaysFromNow(targetDate: Date | string): number {
        const target = toDate(targetDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return this.getDaysDifference(now, target);
    }

    /**
     * Check if date is today
     */
    static isToday(date: Date | string): boolean {
        const d = toDate(date);
        const today = new Date();

        return d.toDateString() === today.toDateString();
    }

    /**
     * Check if date is in the past
     */
    static isPast(date: Date | string): boolean {
        const d = toDate(date);
        return d.getTime() < Date.now();
    }

    /**
     * Check if date is in the future
     */
    static isFuture(date: Date | string): boolean {
        const d = toDate(date);
        return d.getTime() > Date.now();
    }

    /**
     * Add days to date
     * @param date - Base date
     * @param days - Number of days to add (can be negative)
     */
    static addDays(date: Date | string, days: number): Date {
        const d = toDate(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    /**
     * Get start of day (00:00:00)
     */
    static startOfDay(date: Date | string): Date {
        const d = toDate(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Get end of day (23:59:59.999)
     */
    static endOfDay(date: Date | string): Date {
        const d = toDate(date);
        d.setHours(23, 59, 59, 999);
        return d;
    }
}
