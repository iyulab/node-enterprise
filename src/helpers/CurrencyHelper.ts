/**
 * Currency formatting utility class
 */
export class CurrencyHelper {
    /**
     * Format amount as currency string
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

        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: currency === 'KRW' ? 0 : 2
        }).format(amount);
    }

    /**
     * Format amount as Korean Won (KRW)
     */
    static formatKRW(amount: number | null | undefined): string {
        return this.formatCurrency(amount, 'KRW', 'ko-KR');
    }

    /**
     * Format amount as US Dollar (USD)
     */
    static formatUSD(amount: number | null | undefined): string {
        return this.formatCurrency(amount, 'USD', 'en-US');
    }

    /**
     * Format amount as Euro (EUR)
     */
    static formatEUR(amount: number | null | undefined): string {
        return this.formatCurrency(amount, 'EUR', 'de-DE');
    }

    /**
     * Format amount as Japanese Yen (JPY)
     */
    static formatJPY(amount: number | null | undefined): string {
        return this.formatCurrency(amount, 'JPY', 'ja-JP');
    }

    /**
     * Format amount as Chinese Yuan (CNY)
     */
    static formatCNY(amount: number | null | undefined): string {
        return this.formatCurrency(amount, 'CNY', 'zh-CN');
    }

    /**
     * Parse currency string to number
     * @param value - Currency string to parse
     */
    static parseCurrency(value: string): number {
        if (!value) return 0;
        // Remove all non-numeric characters except decimal point and minus
        const cleaned = value.replace(/[^0-9.-]/g, '');
        return parseFloat(cleaned) || 0;
    }
}
