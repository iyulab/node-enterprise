import { formatCurrency as formatCurrencyBase } from '@iyulab/components';

/**
 * Currency formatting utility class.
 *
 * @deprecated The formatting logic now lives in `@iyulab/components`' `formatCurrency`
 * (framework-neutral, lower in the dependency stack so `@iyulab/modern-app` can consume it
 * too). This class is kept as a thin, behavior-preserving wrapper for existing callers —
 * new code should import `formatCurrency`/`formatNumber`/`formatDate` from
 * `@iyulab/components` directly.
 */
export class CurrencyHelper {
  /**
   * Format amount as currency string.
   * @param amount - Amount to format
   * @param currency - Currency code (default: 'KRW')
   * @param locale - Locale for formatting (default: 'ko-KR')
   */
  static formatCurrency(
    amount: number | null | undefined,
    currency: string = 'KRW',
    locale: string = 'ko-KR'
  ): string {
    if (amount === null || amount === undefined) return '-';

    return formatCurrencyBase(amount, currency, {
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === 'KRW' ? 0 : 2,
    }, locale);
  }

  /** Format amount as Korean Won (KRW) */
  static formatKRW(amount: number | null | undefined): string {
    return this.formatCurrency(amount, 'KRW', 'ko-KR');
  }

  /** Format amount as US Dollar (USD) */
  static formatUSD(amount: number | null | undefined): string {
    return this.formatCurrency(amount, 'USD', 'en-US');
  }

  /** Format amount as Euro (EUR) */
  static formatEUR(amount: number | null | undefined): string {
    return this.formatCurrency(amount, 'EUR', 'de-DE');
  }

  /** Format amount as Japanese Yen (JPY) */
  static formatJPY(amount: number | null | undefined): string {
    return this.formatCurrency(amount, 'JPY', 'ja-JP');
  }

  /** Format amount as Chinese Yuan (CNY) */
  static formatCNY(amount: number | null | undefined): string {
    return this.formatCurrency(amount, 'CNY', 'zh-CN');
  }

  /**
   * Parse currency string to number.
   * @param value - Currency string to parse
   */
  static parseCurrency(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
}
