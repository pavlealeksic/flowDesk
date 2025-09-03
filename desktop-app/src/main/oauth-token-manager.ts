/**
 * OAuth2 Token Manager - Automated Token Refresh and Validation
 * 
 * Handles automatic token refresh, validation, and lifecycle management
 * for all OAuth2 providers with secure storage integration.
 */

import { EventEmitter } from 'events';
import log from 'electron-log';
import { oAuth2IntegrationManager } from './oauth-integration-manager';
import { oAuth2ProviderConfig } from './providers/oauth-provider-config';
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';

export interface StoredOAuthToken {
  accountId: string;
  providerId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope?: string;
  tokenType?: string;
  userInfo?: {
    email: string;
    name?: string;
  };
  createdAt: Date;
  lastRefreshed?: Date;
  refreshCount: number;
}

export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  needsRefresh: boolean;
  error?: string;
}

export interface TokenRefreshResult {
  success: boolean;
  newToken?: StoredOAuthToken;
  error?: string;
}

/**
 * OAuth2 Token Manager with automatic refresh and validation
 */
export class OAuth2TokenManager extends EventEmitter {
  private tokens: Map<string, StoredOAuthToken> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private refreshInProgress: Set<string> = new Set();
  private refreshCheckInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_MARGIN_MINUTES = 5; // Refresh tokens 5 minutes before expiry
  private readonly CHECK_INTERVAL_MINUTES = 2; // Check for token expiry every 2 minutes
  private readonly MAX_REFRESH_RETRIES = 3;

  constructor() {
    super();
    this.startPeriodicRefreshCheck();
    log.info('OAuth2 Token Manager initialized');
  }

  /**
   * Store OAuth token with automatic refresh scheduling
   */
  async storeToken(token: StoredOAuthToken): Promise<void> {
    const key = this.getTokenKey(token.accountId, token.providerId);
    
    // Store in memory
    this.tokens.set(key, {
      ...token,
      createdAt: token.createdAt || new Date(),
      refreshCount: token.refreshCount || 0
    });

    // Store securely in Rust engine
    try {
      await rustEngineIntegration.storeOAuthCredentials(token.accountId, token.providerId, {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt
      });
    } catch (error) {
      log.warn('Failed to store token in Rust engine:', error);
    }

    // Schedule automatic refresh
    this.scheduleTokenRefresh(token);

    // Emit token stored event
    this.emit('tokenStored', token);
    
    log.info('OAuth token stored and refresh scheduled', {
      accountId: token.accountId,
      providerId: token.providerId,
      expiresAt: token.expiresAt
    });
  }

  /**
   * Get OAuth token with automatic validation and refresh
   */
  async getValidToken(accountId: string, providerId: string): Promise<StoredOAuthToken | null> {
    const key = this.getTokenKey(accountId, providerId);
    let token = this.tokens.get(key);

    // Try to load from Rust engine if not in memory
    if (!token) {
      try {
        const rustCredentials = await rustEngineIntegration.getStoredOAuthCredentials(accountId);
        if (rustCredentials) {
          token = {
            accountId,
            providerId,
            accessToken: rustCredentials.accessToken,
            refreshToken: rustCredentials.refreshToken,
            expiresAt: rustCredentials.expiresAt || new Date(Date.now() + 3600 * 1000),
            createdAt: new Date(),
            refreshCount: 0
          };
          this.tokens.set(key, token);
        }
      } catch (error) {
        log.warn('Failed to load token from Rust engine:', error);
      }
    }

    if (!token) {
      return null;
    }

    // Validate and refresh if necessary
    const validation = this.validateToken(token);
    if (!validation.valid) {
      if (validation.needsRefresh && token.refreshToken) {
        const refreshResult = await this.refreshToken(accountId, providerId);
        if (refreshResult.success && refreshResult.newToken) {
          return refreshResult.newToken;
        }
      }
      return null;
    }

    return token;
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(accountId: string, providerId: string, retryCount = 0): Promise<TokenRefreshResult> {
    const key = this.getTokenKey(accountId, providerId);
    
    // Prevent concurrent refresh attempts
    if (this.refreshInProgress.has(key)) {
      log.info('Token refresh already in progress', { accountId, providerId });
      return { success: false, error: 'Refresh already in progress' };
    }

    const token = this.tokens.get(key);
    if (!token || !token.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    this.refreshInProgress.add(key);

    try {
      log.info('Refreshing OAuth token', { accountId, providerId, retryCount });

      const result = await oAuth2IntegrationManager.refreshToken(
        providerId,
        token.refreshToken,
        accountId
      );

      if (result.success && result.accessToken) {
        const newToken: StoredOAuthToken = {
          ...token,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken || token.refreshToken,
          expiresAt: result.expiresAt || new Date(Date.now() + 3600 * 1000),
          lastRefreshed: new Date(),
          refreshCount: token.refreshCount + 1
        };

        // Store the refreshed token
        await this.storeToken(newToken);

        // Emit token refreshed event
        this.emit('tokenRefreshed', newToken);

        log.info('OAuth token refreshed successfully', {
          accountId,
          providerId,
          refreshCount: newToken.refreshCount
        });

        return { success: true, newToken };
      } else {
        throw new Error(result.error || 'Token refresh failed');
      }
    } catch (error) {
      log.error('OAuth token refresh failed', { accountId, providerId, error });

      // Retry if we haven't exceeded max retries
      if (retryCount < this.MAX_REFRESH_RETRIES) {
        log.info('Retrying token refresh', { accountId, providerId, retryCount: retryCount + 1 });
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.refreshToken(accountId, providerId, retryCount + 1);
      }

      // Emit token refresh failed event
      this.emit('tokenRefreshFailed', { accountId, providerId, error });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    } finally {
      this.refreshInProgress.delete(key);
    }
  }

  /**
   * Validate OAuth token
   */
  validateToken(token: StoredOAuthToken): TokenValidationResult {
    if (!token.accessToken) {
      return { valid: false, expired: true, needsRefresh: false, error: 'No access token' };
    }

    const now = new Date();
    const expiryTime = new Date(token.expiresAt);
    const refreshTime = new Date(expiryTime.getTime() - this.REFRESH_MARGIN_MINUTES * 60 * 1000);

    const expired = now >= expiryTime;
    const needsRefresh = now >= refreshTime;

    return {
      valid: !expired,
      expired,
      needsRefresh: needsRefresh && !expired,
      error: expired ? 'Token expired' : undefined
    };
  }

  /**
   * Revoke OAuth token
   */
  async revokeToken(accountId: string, providerId: string): Promise<boolean> {
    const key = this.getTokenKey(accountId, providerId);
    const token = this.tokens.get(key);

    if (!token) {
      return false;
    }

    try {
      // Revoke with provider
      await oAuth2IntegrationManager.revokeToken(providerId, token.accessToken);

      // Clear from memory
      this.tokens.delete(key);

      // Clear refresh timer
      const timer = this.refreshTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.refreshTimers.delete(key);
      }

      // Emit token revoked event
      this.emit('tokenRevoked', { accountId, providerId });

      log.info('OAuth token revoked successfully', { accountId, providerId });
      return true;
    } catch (error) {
      log.error('Failed to revoke OAuth token', { accountId, providerId, error });
      return false;
    }
  }

  /**
   * Get all stored tokens
   */
  getAllTokens(): StoredOAuthToken[] {
    return Array.from(this.tokens.values());
  }

  /**
   * Get tokens for a specific provider
   */
  getTokensByProvider(providerId: string): StoredOAuthToken[] {
    return this.getAllTokens().filter(token => token.providerId === providerId);
  }

  /**
   * Get token status summary
   */
  getTokenStatusSummary(): Record<string, {
    valid: boolean;
    expired: boolean;
    expiresIn: number;
    needsRefresh: boolean;
  }> {
    const summary: Record<string, any> = {};

    for (const [key, token] of this.tokens.entries()) {
      const validation = this.validateToken(token);
      const expiresIn = Math.max(0, token.expiresAt.getTime() - Date.now());

      summary[key] = {
        valid: validation.valid,
        expired: validation.expired,
        expiresIn: Math.floor(expiresIn / 1000), // seconds
        needsRefresh: validation.needsRefresh
      };
    }

    return summary;
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(token: StoredOAuthToken): void {
    const key = this.getTokenKey(token.accountId, token.providerId);
    
    // Clear existing timer
    const existingTimer = this.refreshTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate refresh time (5 minutes before expiry)
    const now = new Date();
    const refreshTime = new Date(token.expiresAt.getTime() - this.REFRESH_MARGIN_MINUTES * 60 * 1000);
    const delay = Math.max(0, refreshTime.getTime() - now.getTime());

    if (delay > 0 && token.refreshToken) {
      const timer = setTimeout(async () => {
        log.info('Automatic token refresh triggered', {
          accountId: token.accountId,
          providerId: token.providerId
        });
        
        await this.refreshToken(token.accountId, token.providerId);
      }, delay);

      this.refreshTimers.set(key, timer);
      
      log.debug('Token refresh scheduled', {
        accountId: token.accountId,
        providerId: token.providerId,
        refreshAt: refreshTime,
        delayMs: delay
      });
    }
  }

  /**
   * Start periodic token refresh check
   */
  private startPeriodicRefreshCheck(): void {
    this.refreshCheckInterval = setInterval(async () => {
      const now = new Date();
      
      for (const token of this.tokens.values()) {
        const validation = this.validateToken(token);
        
        if (validation.needsRefresh && !validation.expired && token.refreshToken) {
          const key = this.getTokenKey(token.accountId, token.providerId);
          
          if (!this.refreshInProgress.has(key)) {
            log.info('Periodic token refresh triggered', {
              accountId: token.accountId,
              providerId: token.providerId
            });
            
            // Don't await - let refresh happen in background
            this.refreshToken(token.accountId, token.providerId).catch(error => {
              log.error('Periodic token refresh failed', {
                accountId: token.accountId,
                providerId: token.providerId,
                error
              });
            });
          }
        }
      }
    }, this.CHECK_INTERVAL_MINUTES * 60 * 1000);
  }

  /**
   * Clear all tokens and timers
   */
  async clearAllTokens(): Promise<void> {
    log.info('Clearing all OAuth tokens');

    // Clear all timers
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();

    // Clear tokens
    this.tokens.clear();

    // Stop periodic check
    if (this.refreshCheckInterval) {
      clearInterval(this.refreshCheckInterval);
      this.refreshCheckInterval = null;
    }

    // Emit event
    this.emit('allTokensCleared');
  }

  /**
   * Get token key for storage
   */
  private getTokenKey(accountId: string, providerId: string): string {
    return `${providerId}:${accountId}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.clearAllTokens();
    log.info('OAuth2 Token Manager cleaned up');
  }
}

// Export singleton instance
export const oAuth2TokenManager = new OAuth2TokenManager();
export default oAuth2TokenManager;