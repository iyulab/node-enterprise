/**
 * Urgency level types
 */
export type UrgencyLevel = 'overdue' | 'critical' | 'urgent' | 'soon' | 'normal';

/**
 * Urgency configuration
 */
export interface UrgencyConfig {
    /** Days threshold for critical urgency (default: 1) */
    critical?: number;
    /** Days threshold for urgent level (default: 3) */
    urgent?: number;
    /** Days threshold for soon level (default: 7) */
    soon?: number;
}

/**
 * Urgency calculation and display utility class
 */
export class UrgencyHelper {
    private static defaultConfig: Required<UrgencyConfig> = {
        critical: 1,
        urgent: 3,
        soon: 7
    };

    /**
     * Get urgency color based on days remaining
     * @param daysRemaining - Days until deadline (negative if overdue)
     * @param config - Custom urgency thresholds
     */
    static getUrgencyColor(
        daysRemaining: number | null | undefined,
        config?: UrgencyConfig
    ): string {
        const level = this.getUrgencyLevel(daysRemaining, config);

        switch (level) {
            case 'overdue': return '#F44336';   // Red
            case 'critical': return '#E91E63';  // Pink
            case 'urgent': return '#FF9800';    // Orange
            case 'soon': return '#FFC107';      // Yellow
            case 'normal': return '#4CAF50';    // Green
            default: return '#9E9E9E';          // Grey
        }
    }

    /**
     * Get urgency level based on days remaining
     * @param daysRemaining - Days until deadline
     * @param config - Custom urgency thresholds
     */
    static getUrgencyLevel(
        daysRemaining: number | null | undefined,
        config?: UrgencyConfig
    ): UrgencyLevel {
        if (daysRemaining === null || daysRemaining === undefined) {
            return 'normal';
        }

        const { critical, urgent, soon } = { ...this.defaultConfig, ...config };

        if (daysRemaining < 0) return 'overdue';
        if (daysRemaining <= critical) return 'critical';
        if (daysRemaining <= urgent) return 'urgent';
        if (daysRemaining <= soon) return 'soon';
        return 'normal';
    }

    /**
     * Get urgency text label
     * @param daysRemaining - Days until deadline
     * @param config - Custom urgency thresholds
     * @param labels - Custom label text
     */
    static getUrgencyText(
        daysRemaining: number | null | undefined,
        config?: UrgencyConfig,
        labels?: Partial<Record<UrgencyLevel, string>>
    ): string {
        const defaultLabels: Record<UrgencyLevel, string> = {
            overdue: '지연',
            critical: '매우 급함',
            urgent: '급함',
            soon: '곧 도래',
            normal: '여유'
        };

        const level = this.getUrgencyLevel(daysRemaining, config);
        return labels?.[level] || defaultLabels[level];
    }

    /**
     * Get background and text color for urgency badge
     * @param daysRemaining - Days until deadline
     * @param config - Custom urgency thresholds
     */
    static getUrgencyBadgeColors(
        daysRemaining: number | null | undefined,
        config?: UrgencyConfig
    ): { bg: string; text: string } {
        const level = this.getUrgencyLevel(daysRemaining, config);

        switch (level) {
            case 'overdue': return { bg: '#F44336', text: '#FFFFFF' };
            case 'critical': return { bg: '#FFEBEE', text: '#C62828' };
            case 'urgent': return { bg: '#FFF3E0', text: '#E65100' };
            case 'soon': return { bg: '#FFFDE7', text: '#F57F17' };
            case 'normal': return { bg: '#E8F5E9', text: '#2E7D32' };
            default: return { bg: '#E0E0E0', text: '#666666' };
        }
    }

    /**
     * Format days remaining as display text
     * @param daysRemaining - Days until deadline
     */
    static formatDaysRemaining(daysRemaining: number | null | undefined): string {
        if (daysRemaining === null || daysRemaining === undefined) {
            return '-';
        }

        if (daysRemaining < 0) {
            return `${Math.abs(daysRemaining)}일 지연`;
        }
        if (daysRemaining === 0) {
            return '오늘';
        }
        return `${daysRemaining}일`;
    }

    /**
     * Check if deadline is overdue
     */
    static isOverdue(daysRemaining: number | null | undefined): boolean {
        return daysRemaining !== null && daysRemaining !== undefined && daysRemaining < 0;
    }

    /**
     * Check if deadline requires attention
     */
    static needsAttention(
        daysRemaining: number | null | undefined,
        config?: UrgencyConfig
    ): boolean {
        const level = this.getUrgencyLevel(daysRemaining, config);
        return ['overdue', 'critical', 'urgent'].includes(level);
    }
}
