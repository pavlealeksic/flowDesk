/**
 * Comprehensive OAuth2 Service for Flow Desk
 * Supports 15+ providers with proper token management, refresh, and error handling
 */
export interface OAuthConfig {
    clientId: string;
    clientSecret?: string;
    redirectUri: string;
    scope: string[];
    authUrl: string;
    tokenUrl: string;
    revokeUrl?: string;
    userInfoUrl?: string;
    pkce?: boolean;
    customParams?: Record<string, string>;
}
export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    tokenType: 'Bearer' | 'bearer' | string;
    expiresIn?: number;
    expiresAt?: number;
    scope?: string;
}
export interface OAuthUserInfo {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    locale?: string;
    [key: string]: any;
}
export interface OAuthProvider {
    id: string;
    name: string;
    config: OAuthConfig;
    tokenStorage: 'secure' | 'memory' | 'persistent';
    autoRefresh: boolean;
    customAuthFlow?: (config: OAuthConfig) => Promise<string>;
    customTokenExchange?: (code: string, config: OAuthConfig, codeVerifier?: string) => Promise<OAuthTokens>;
    customUserInfo?: (tokens: OAuthTokens) => Promise<OAuthUserInfo>;
}
export declare const OAUTH_PROVIDERS: Record<string, OAuthProvider>;
export declare class OAuthService {
    private static instance;
    private tokens;
    private refreshIntervals;
    private tokenStorage;
    private isElectron;
    constructor(tokenStorage?: any, isElectron?: boolean);
    static getInstance(tokenStorage?: any, isElectron?: boolean): OAuthService;
    /**
     * Initialize OAuth service and load existing tokens
     */
    initialize(): Promise<void>;
    /**
     * Get authorization URL for a provider
     */
    getAuthorizationUrl(providerId: string, state?: string): Promise<string>;
    /**
     * Exchange authorization code for tokens
     */
    exchangeCodeForTokens(providerId: string, code: string, state?: string): Promise<OAuthTokens>;
    /**
     * Get stored tokens for a provider
     */
    getTokens(providerId: string): Promise<OAuthTokens | null>;
    /**
     * Refresh tokens for a provider
     */
    refreshTokens(providerId: string): Promise<OAuthTokens>;
    /**
     * Revoke tokens for a provider
     */
    revokeTokens(providerId: string): Promise<void>;
    /**
     * Get user information using stored tokens
     */
    getUserInfo(providerId: string): Promise<OAuthUserInfo | null>;
    /**
     * Check if user is authenticated for a provider
     */
    isAuthenticated(providerId: string): Promise<boolean>;
    /**
     * Get list of authenticated providers
     */
    getAuthenticatedProviders(): string[];
    private storeTokens;
    private loadTokensFromStorage;
    private loadStoredTokens;
    private clearTokens;
    private setupAutoRefresh;
    private generateState;
    private generateCodeVerifier;
    private generateCodeChallenge;
    private storeCodeVerifier;
    private getCodeVerifier;
    private normalizeUserInfo;
    /**
     * Cleanup resources
     */
    dispose(): void;
}
export declare const createOAuthService: (tokenStorage?: any, isElectron?: boolean) => OAuthService;
export declare const getAvailableProviders: () => OAuthProvider[];
export declare const getProviderById: (providerId: string) => OAuthProvider | null;
//# sourceMappingURL=oauth-service.d.ts.map