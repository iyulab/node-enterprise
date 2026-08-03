import { messages } from './messages';

/**
 * Progress bar and percentage utility class
 */
export class ProgressHelper {
    /**
     * Get color based on progress percentage
     * @param progress - Progress value (0-100)
     * @param thresholds - Custom thresholds { high, medium }
     */
    static getProgressColor(
        progress: number,
        thresholds: { high?: number; medium?: number } = {}
    ): string {
        const { high = 80, medium = 40 } = thresholds;

        if (progress >= high) return '#4CAF50';  // Green
        if (progress >= medium) return '#FF9800'; // Orange
        return '#F44336'; // Red
    }

    /**
     * Validate and clamp progress to 0-100 range
     * @param progress - Raw progress value
     * @param round - Whether to round to integer (default: true)
     */
    static validateProgress(progress: number | null | undefined, round: boolean = true): number {
        if (progress === null || progress === undefined || isNaN(progress)) {
            return 0;
        }

        let value = progress;
        if (value < 0) value = 0;
        if (value > 100) value = 100;

        return round ? Math.round(value) : value;
    }

    /**
     * Convert decimal ratio to percentage
     * @param ratio - Decimal ratio (0-1)
     * @param round - Whether to round to integer
     */
    static ratioToPercent(ratio: number | null | undefined, round: boolean = true): number {
        if (ratio === null || ratio === undefined || isNaN(ratio)) {
            return 0;
        }

        const percent = ratio * 100;
        return this.validateProgress(percent, round);
    }

    /**
     * Get progress label text
     * @param progress - Progress value (0-100)
     */
    static getProgressLabel(progress: number): string {
        const validated = this.validateProgress(progress);

        if (validated === 0) return messages.text('progressNotStarted');
        if (validated < 25) return messages.text('progressEarly');
        if (validated < 50) return messages.text('progressInProgress');
        if (validated < 75) return messages.text('progressPastMid');
        if (validated < 100) return messages.text('progressAlmost');
        return messages.text('progressDone');
    }

    /**
     * Calculate progress from current and total values
     * @param current - Current value
     * @param total - Total value
     */
    static calculateProgress(current: number, total: number): number {
        if (total <= 0) return 0;
        return this.validateProgress((current / total) * 100);
    }

    /**
     * Get CSS gradient for progress bar
     * @param progress - Progress value (0-100)
     */
    static getProgressGradient(progress: number): string {
        const validated = this.validateProgress(progress);
        const color = this.getProgressColor(validated);

        return `linear-gradient(to right, ${color} ${validated}%, #e0e0e0 ${validated}%)`;
    }
}
