/**
 * API configuration and environment-based endpoint management
 *
 * Supports both development (proxy) and production (same-origin) deployments
 */

export interface ApiConfigOptions {
    /** Base URL for all API requests (default: '') */
    baseUrl?: string;
    /** OData endpoint prefix (default: '$data') */
    odataPrefix?: string;
    /** REST API endpoint prefix (default: 'api') */
    apiPrefix?: string;
    /** Force development mode detection */
    isDevelopment?: boolean;
}

export class ApiConfig {
    private static _baseUrl: string = '';
    private static _odataPrefix: string = '$data';
    private static _apiPrefix: string = 'api';
    private static _isDevelopment: boolean | undefined = undefined;

    /**
     * Initialize API configuration
     * @param options Configuration options
     */
    static initialize(options: ApiConfigOptions = {}): void {
        if (options.baseUrl !== undefined) {
            this._baseUrl = options.baseUrl;
        }
        if (options.odataPrefix !== undefined) {
            this._odataPrefix = options.odataPrefix;
        }
        if (options.apiPrefix !== undefined) {
            this._apiPrefix = options.apiPrefix;
        }
        if (options.isDevelopment !== undefined) {
            this._isDevelopment = options.isDevelopment;
        }
    }

    /**
     * API Base URL (always relative path by default)
     */
    static get baseUrl(): string {
        return this._baseUrl;
    }

    /**
     * Manually set Base URL (for testing or custom configurations)
     */
    static setBaseUrl(url: string): void {
        this._baseUrl = url;
    }

    /**
     * OData endpoint prefix
     */
    static get odataPrefix(): string {
        return this._odataPrefix;
    }

    /**
     * REST API endpoint prefix
     */
    static get apiPrefix(): string {
        return this._apiPrefix;
    }

    /**
     * Generate OData endpoint URL
     * @param entityName Entity name for OData endpoint
     */
    static getODataUrl(entityName: string): string {
        return `${this._baseUrl}/${this._odataPrefix}/${entityName}`;
    }

    /**
     * Generate REST API endpoint URL
     * @param endpoint API endpoint path
     */
    static getApiUrl(endpoint: string): string {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${this._baseUrl}/${this._apiPrefix}/${cleanEndpoint}`;
    }

    /**
     * Generate full URL with query parameters
     * @param endpoint Endpoint path
     * @param params Query parameters
     */
    static getUrlWithParams(endpoint: string, params: Record<string, string | number | boolean | undefined>): string {
        const baseEndpoint = this.getApiUrl(endpoint);
        const searchParams = new URLSearchParams();

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
                searchParams.append(key, String(value));
            }
        }

        const queryString = searchParams.toString();
        return queryString ? `${baseEndpoint}?${queryString}` : baseEndpoint;
    }

    /**
     * Check if running in development environment
     * Tries to detect from various bundler environments
     */
    static get isDevelopment(): boolean {
        if (this._isDevelopment !== undefined) {
            return this._isDevelopment;
        }

        // Try to detect from environment
        try {
            // Vite
            if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV !== undefined) {
                return (import.meta as any).env.DEV;
            }
        } catch {
            // ignore
        }

        try {
            // Node.js / Webpack
            if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
                return process.env.NODE_ENV === 'development';
            }
        } catch {
            // ignore
        }

        // Default to false (production)
        return false;
    }

    /**
     * Check if running in production environment
     */
    static get isProduction(): boolean {
        return !this.isDevelopment;
    }

    /**
     * Reset configuration to defaults
     */
    static reset(): void {
        this._baseUrl = '';
        this._odataPrefix = '$data';
        this._apiPrefix = 'api';
        this._isDevelopment = undefined;
    }
}
