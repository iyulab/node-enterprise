import { EMPTY_VALUE_DISPLAY } from './constants';

/**
 * Date manipulation and formatting utility class
 */
export class DateHelper {
    /**
     * Format date to YYYY-MM-DD string
     * @param date - Date to format (Date object or ISO string)
     */
    static formatDate(date: Date | string | null | undefined): string {
        if (!date) return EMPTY_VALUE_DISPLAY;

        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return EMPTY_VALUE_DISPLAY;

        return d.toISOString().slice(0, 10);
    }

    /**
     * Format date to localized string
     * @param date - Date to format
     * @param locale - Locale for formatting (default: 'ko-KR')
     * @param options - Intl.DateTimeFormat options
     */
    static formatLocalDate(
        date: Date | string | null | undefined,
        locale: string = 'ko-KR',
        options?: Intl.DateTimeFormatOptions
    ): string {
        if (!date) return EMPTY_VALUE_DISPLAY;

        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return EMPTY_VALUE_DISPLAY;

        return d.toLocaleDateString(locale, options || {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /**
     * Format datetime to YYYY-MM-DD HH:mm string
     * @param date - Date to format
     */
    static formatDateTime(date: Date | string | null | undefined): string {
        if (!date) return EMPTY_VALUE_DISPLAY;

        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return EMPTY_VALUE_DISPLAY;

        return d.toISOString().slice(0, 16).replace('T', ' ');
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
        const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
        const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

        const timeDiff = end.getTime() - start.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    /**
     * Calculate days from now to target date
     * @param targetDate - Target date
     * @returns Days remaining (negative if overdue)
     */
    static getDaysFromNow(targetDate: Date | string): number {
        const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return this.getDaysDifference(now, target);
    }

    /**
     * Check if date is today
     */
    static isToday(date: Date | string): boolean {
        const d = typeof date === 'string' ? new Date(date) : date;
        const today = new Date();

        return d.toDateString() === today.toDateString();
    }

    /**
     * Check if date is in the past
     */
    static isPast(date: Date | string): boolean {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.getTime() < Date.now();
    }

    /**
     * Check if date is in the future
     */
    static isFuture(date: Date | string): boolean {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.getTime() > Date.now();
    }

    /**
     * Add days to date
     * @param date - Base date
     * @param days - Number of days to add (can be negative)
     */
    static addDays(date: Date | string, days: number): Date {
        const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
        d.setDate(d.getDate() + days);
        return d;
    }

    /**
     * Get start of day (00:00:00)
     */
    static startOfDay(date: Date | string): Date {
        const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Get end of day (23:59:59.999)
     */
    static endOfDay(date: Date | string): Date {
        const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
        d.setHours(23, 59, 59, 999);
        return d;
    }
}
