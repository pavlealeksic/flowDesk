/**
 * Rust OAuth Bridge - Final Integration Layer
 * 
 * Bridges the JavaScript OAuth2 system with the Rust engine for
 * complete OAuth2 integration using the Rust engine's secure storage.
 */

import log from 'electron-log';
import { oAuth2ProviderConfig } from './providers/oauth-provider-config';
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';

export interface RustOAuthResult {
  success: boolean;
  accountId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  userInfo?: {
    email: string;
    name?: string;
  };
  error?: string;
}

/**
 * Rust OAuth Bridge - Integrates JS OAuth with Rust engine
 */
export class RustOAuthBridge {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('Initializing Rust OAuth Bridge...');
      
      // Ensure Rust engine is initialized
      if (!rustEngineIntegration.isInitialized()) {
        await rustEngineIntegration.initialize();
      }

      // Register all configured OAuth providers with Rust engine
      await this.registerConfiguredProviders();
      
      this.isInitialized = true;
      log.info('Rust OAuth Bridge initialized successfully');
    } catch (error) {
      log.error('Failed to initialize Rust OAuth Bridge:', error);
      throw error;
    }
  }

  /**
   * Start OAuth flow using Rust engine
   */
  async startOAuthFlow(providerId: string, accountId?: string): Promise<RustOAuthResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      log.info('Starting OAuth flow via Rust bridge', { providerId, accountId });

      // Check if provider is configured
      if (!oAuth2ProviderConfig.isProviderConfigured(providerId)) {
        return {
          success: false,
          error: `Provider ${providerId} is not configured. Please set OAuth2 credentials.`
        };
      }

      // Ensure provider is registered with Rust engine
      await this.registerProvider(providerId);

      // Start OAuth flow through Rust engine
      const { authUrl, state } = await rustEngineIntegration.startOAuthFlow(providerId);
      
      // Open authorization URL in browser
      const { shell } = require('electron');
      await shell.openExternal(authUrl);
      
      // Return initial success - actual token exchange will happen in callback
      return {
        success: true,
        accountId: accountId || `${providerId}_${Date.now()}`,
      };
    } catch (error) {
      log.error('Rust OAuth flow start failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth flow start failed'
      };
    }
  }

  /**
   * Handle OAuth callback through Rust engine
   */
  async handleOAuthCallback(code: string, state: string, providerId: string): Promise<RustOAuthResult> {
    try {
      log.info('Handling OAuth callback via Rust bridge', { providerId, hasCode: !!code, hasState: !!state });

      if (!code || !state) {
        return {
          success: false,
          error: 'Missing authorization code or state parameter'
        };
      }

      // Handle callback through Rust engine
      const result = await rustEngineIntegration.handleOAuthCallback(code, state, providerId);
      
      return {
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userInfo: result.userInfo,
        expiresAt: new Date(Date.now() + 3600 * 1000) // Default 1 hour
      };
    } catch (error) {
      log.error('Rust OAuth callback handling failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OAuth callback handling failed'
      };
    }
  }

  /**
   * Refresh OAuth token using Rust engine
   */
  async refreshToken(providerId: string, refreshToken: string, accountId: string): Promise<RustOAuthResult> {
    try {
      log.info('Refreshing OAuth token via Rust bridge', { providerId, accountId });

      const result = await rustEngineIntegration.refreshOAuthToken(providerId, refreshToken);
      
      return {
        success: true,
        accountId,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: new Date(Date.now() + (result.expiresIn || 3600) * 1000)
      };
    } catch (error) {
      log.error('Rust OAuth token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  /**
   * Store OAuth credentials in Rust engine
   */
  async storeCredentials(accountId: string, providerId: string, credentials: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<boolean> {
    try {
      await rustEngineIntegration.storeOAuthCredentials(accountId, providerId, credentials);
      log.info('OAuth credentials stored in Rust engine', { accountId, providerId });
      return true;
    } catch (error) {
      log.error('Failed to store OAuth credentials in Rust engine:', error);
      return false;
    }
  }

  /**
   * Get stored OAuth credentials from Rust engine
   */
  async getStoredCredentials(accountId: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  } | null> {
    try {
      const credentials = await rustEngineIntegration.getStoredOAuthCredentials(accountId);
      if (credentials) {
        log.debug('Retrieved OAuth credentials from Rust engine', { accountId });
        return credentials;
      }
      return null;
    } catch (error) {
      log.error('Failed to get OAuth credentials from Rust engine:', error);
      return null;
    }
  }

  /**
   * Revoke OAuth token using Rust engine
   */
  async revokeToken(providerId: string, accessToken: string): Promise<boolean> {
    try {
      await rustEngineIntegration.revokeOAuthToken(providerId, accessToken);
      log.info('OAuth token revoked via Rust engine', { providerId });
      return true;
    } catch (error) {
      log.error('Failed to revoke OAuth token via Rust engine:', error);
      return false;
    }
  }

  /**
   * Register a provider with the Rust engine
   */
  private async registerProvider(providerId: string): Promise<void> {
    try {
      const config = oAuth2ProviderConfig.getProviderConfig(providerId);
      if (!config) {
        throw new Error(`Provider configuration not found: ${providerId}`);
      }

      if (!config.clientId || !config.clientSecret) {
        throw new Error(`OAuth credentials not configured for provider: ${providerId}`);
      }

      await rustEngineIntegration.registerOAuthProvider(providerId, config.clientId, config.clientSecret);
      log.debug('Provider registered with Rust engine', { providerId });
    } catch (error) {
      log.error('Failed to register provider with Rust engine:', error);
      throw error;
    }
  }

  /**
   * Register all configured providers with Rust engine
   */
  private async registerConfiguredProviders(): Promise<void> {
    const providers = oAuth2ProviderConfig.getConfiguredProviders();
    
    for (const provider of providers) {
      try {
        await this.registerProvider(provider.providerId);
      } catch (error) {
        log.warn(`Failed to register provider ${provider.providerId} with Rust engine:`, error);
        // Continue with other providers
      }
    }

    log.info(`Registered ${providers.length} OAuth providers with Rust engine`);
  }

  /**
   * Create mail account with OAuth credentials
   */
  async createMailAccountWithOAuth(providerId: string, credentials: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    userInfo?: {
      email: string;
      name?: string;
    };
  }): Promise<{ accountId: string; account: any } | null> {
    try {
      const accountId = `${providerId}_${Date.now()}`;
      
      // Store credentials in Rust engine
      await this.storeCredentials(accountId, providerId, {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt
      });

      // Create account data
      const account = {
        id: accountId,
        name: `${providerId} Account`,
        email: credentials.userInfo?.email || 'unknown@example.com',
        provider: providerId,
        status: 'active' as const,
        syncIntervalMinutes: 15,
        isEnabled: true,
        userId: 'current-user', // TODO: Get from auth context
        config: {
          provider: providerId,
          oauth: {
            accessToken: credentials.accessToken,
            refreshToken: credentials.refreshToken,
            expiresAt: credentials.expiresAt
          }
        }
      };

      log.info('Created mail account with OAuth credentials', { accountId, provider: providerId });
      return { accountId, account };
    } catch (error) {
      log.error('Failed to create mail account with OAuth:', error);
      return null;
    }
  }

  /**
   * Check if Rust engine OAuth is available
   */
  isRustOAuthAvailable(): boolean {
    return this.isInitialized && rustEngineIntegration.isInitialized();
  }

  /**
   * Get Rust engine version for diagnostics
   */
  getRustEngineVersion(): string {
    return rustEngineIntegration.getVersion();
  }

  /**
   * Cleanup bridge resources
   */
  async cleanup(): Promise<void> {
    log.info('Cleaning up Rust OAuth Bridge');
    this.isInitialized = false;
  }
}

// Export singleton instance
export const rustOAuthBridge = new RustOAuthBridge();
export default rustOAuthBridge;