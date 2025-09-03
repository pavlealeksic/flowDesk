/**
 * OAuth2 IPC Service - Bridge between React UI and OAuth2 Integration Manager
 * 
 * Handles IPC communication for OAuth2 authentication flows,
 * connecting React components with the complete OAuth2 system.
 */

import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { oAuth2IntegrationManager } from './oauth-integration-manager';
import { oAuth2TokenManager } from './oauth-token-manager';
import { oAuth2ProviderConfig } from './providers/oauth-provider-config';
import { v4 as uuidv4 } from 'uuid';

export interface OAuthStartResult {
  success: boolean;
  accountId?: string;
  email?: string;
  config?: any;
  error?: string;
}

export interface OAuthProviderStatus {
  providerId: string;
  name: string;
  configured: boolean;
  setupInstructions?: string[];
  setupUrl?: string;
}

export interface TokenStatus {
  accountId: string;
  providerId: string;
  valid: boolean;
  expired: boolean;
  expiresIn: number;
  needsRefresh: boolean;
}

/**
 * OAuth2 IPC Service Class
 */
class OAuth2IPCService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('Initializing OAuth2 IPC Service...');

      this.setupIPCHandlers();
      
      // Initialize OAuth2 components
      await oAuth2IntegrationManager;
      
      this.isInitialized = true;
      log.info('OAuth2 IPC Service initialized successfully');
    } catch (error) {
      log.error('Failed to initialize OAuth2 IPC Service:', error);
      throw error;
    }
  }

  /**
   * Setup IPC handlers for OAuth2 operations
   */
  private setupIPCHandlers(): void {
    // Start OAuth flow for any provider
    ipcMain.handle('oauth:start-flow', async (_, providerId: string, accountId?: string) => {
      try {
        log.info('Starting OAuth flow via IPC', { providerId, accountId });

        // Check if provider is configured
        if (!oAuth2ProviderConfig.isProviderConfigured(providerId)) {
          const setup = oAuth2ProviderConfig.getSetupInstructions(providerId);
          return {
            success: false,
            error: `${providerId} not configured. Please set up OAuth2 credentials.`,
            setupInstructions: setup?.instructions,
            setupUrl: setup?.setupUrl
          };
        }

        const result = await oAuth2IntegrationManager.authenticateProvider(providerId, accountId);
        
        if (result.success && result.userInfo) {
          return {
            success: true,
            accountId: result.accountId || uuidv4(),
            email: result.userInfo.email,
            name: result.userInfo.name,
            config: {
              provider: providerId,
              oauth: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresAt: result.expiresAt
              }
            }
          };
        } else {
          return {
            success: false,
            error: result.error || 'OAuth authentication failed'
          };
        }
      } catch (error) {
        log.error('IPC oauth:start-flow error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'OAuth flow failed'
        };
      }
    });

    // Legacy Gmail OAuth support (for backward compatibility)
    ipcMain.handle('mail:start-gmail-oauth', async () => {
      try {
        log.info('Starting Gmail OAuth flow (legacy)');
        return await this.handleStartOAuth('gmail');
      } catch (error) {
        log.error('Legacy Gmail OAuth error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Gmail OAuth failed' };
      }
    });

    // Start OAuth for specific provider (enhanced version)
    ipcMain.handle('oauth:authenticate-provider', async (_, providerId: string) => {
      return await this.handleStartOAuth(providerId);
    });

    // Get OAuth provider status and configuration
    ipcMain.handle('oauth:get-provider-status', async (_, providerId?: string) => {
      try {
        if (providerId) {
          return this.getProviderStatus(providerId);
        } else {
          return this.getAllProviderStatus();
        }
      } catch (error) {
        log.error('IPC oauth:get-provider-status error:', error);
        return null;
      }
    });

    // Get all configured providers
    ipcMain.handle('oauth:get-configured-providers', async () => {
      try {
        const providers = oAuth2ProviderConfig.getConfiguredProviders();
        return providers.map(p => ({
          providerId: p.providerId,
          name: p.name,
          configured: true
        }));
      } catch (error) {
        log.error('IPC oauth:get-configured-providers error:', error);
        return [];
      }
    });

    // Get providers that need setup
    ipcMain.handle('oauth:get-providers-needing-setup', async () => {
      try {
        return oAuth2ProviderConfig.getProvidersNeedingSetup();
      } catch (error) {
        log.error('IPC oauth:get-providers-needing-setup error:', error);
        return [];
      }
    });

    // Refresh token for account
    ipcMain.handle('oauth:refresh-token', async (_, accountId: string, providerId: string) => {
      try {
        log.info('Refreshing token via IPC', { accountId, providerId });
        const result = await oAuth2TokenManager.refreshToken(accountId, providerId);
        return result;
      } catch (error) {
        log.error('IPC oauth:refresh-token error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Token refresh failed' };
      }
    });

    // Get token status
    ipcMain.handle('oauth:get-token-status', async (_, accountId?: string, providerId?: string) => {
      try {
        if (accountId && providerId) {
          const token = await oAuth2TokenManager.getValidToken(accountId, providerId);
          if (token) {
            const validation = oAuth2TokenManager.validateToken(token);
            return {
              accountId: token.accountId,
              providerId: token.providerId,
              valid: validation.valid,
              expired: validation.expired,
              expiresIn: Math.max(0, token.expiresAt.getTime() - Date.now()) / 1000,
              needsRefresh: validation.needsRefresh
            };
          }
          return null;
        } else {
          return oAuth2TokenManager.getTokenStatusSummary();
        }
      } catch (error) {
        log.error('IPC oauth:get-token-status error:', error);
        return null;
      }
    });

    // Revoke token
    ipcMain.handle('oauth:revoke-token', async (_, accountId: string, providerId: string) => {
      try {
        log.info('Revoking token via IPC', { accountId, providerId });
        const result = await oAuth2TokenManager.revokeToken(accountId, providerId);
        return { success: result };
      } catch (error) {
        log.error('IPC oauth:revoke-token error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Token revocation failed' };
      }
    });

    // Get all stored tokens
    ipcMain.handle('oauth:get-all-tokens', async () => {
      try {
        const tokens = oAuth2TokenManager.getAllTokens();
        return tokens.map(token => ({
          accountId: token.accountId,
          providerId: token.providerId,
          email: token.userInfo?.email,
          name: token.userInfo?.name,
          expiresAt: token.expiresAt,
          createdAt: token.createdAt,
          refreshCount: token.refreshCount
        }));
      } catch (error) {
        log.error('IPC oauth:get-all-tokens error:', error);
        return [];
      }
    });

    // Legacy OAuth callback handler (for backward compatibility)
    ipcMain.handle('mail:handle-oauth-callback', async (_, code: string, state: string, accountId?: string) => {
      try {
        log.info('Handling OAuth callback via legacy IPC', { hasCode: !!code, hasState: !!state, accountId });
        
        // Try to determine provider from state or default to Gmail
        const providerId = 'gmail'; // Could be enhanced to extract from state
        
        const result = await oAuth2IntegrationManager.authenticateProvider(providerId, accountId);
        
        if (result.success && result.userInfo) {
          return {
            id: result.accountId || uuidv4(),
            name: `${providerId} Account`,
            email: result.userInfo.email,
            provider: providerId,
            status: 'active',
            syncIntervalMinutes: 15,
            isEnabled: true,
            userId: 'current-user'
          };
        } else {
          throw new Error(result.error || 'OAuth callback handling failed');
        }
      } catch (error) {
        log.error('IPC mail:handle-oauth-callback error:', error);
        throw error;
      }
    });

    // Get OAuth setup instructions
    ipcMain.handle('oauth:get-setup-instructions', async (_, providerId: string) => {
      try {
        const instructions = oAuth2ProviderConfig.getSetupInstructions(providerId);
        return instructions || null;
      } catch (error) {
        log.error('IPC oauth:get-setup-instructions error:', error);
        return null;
      }
    });

    // Test OAuth configuration
    ipcMain.handle('oauth:test-configuration', async (_, providerId: string) => {
      try {
        const validation = oAuth2ProviderConfig.validateProviderConfig(providerId);
        return validation;
      } catch (error) {
        log.error('IPC oauth:test-configuration error:', error);
        return { valid: false, errors: ['Configuration test failed'] };
      }
    });

    log.info('OAuth2 IPC handlers registered');
  }

  /**
   * Handle OAuth start flow
   */
  private async handleStartOAuth(providerId: string): Promise<OAuthStartResult> {
    try {
      const result = await oAuth2IntegrationManager.authenticateProvider(providerId);
      
      if (result.success && result.userInfo) {
        return {
          success: true,
          accountId: result.accountId || uuidv4(),
          email: result.userInfo.email,
          config: {
            provider: providerId,
            oauth: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              expiresAt: result.expiresAt
            }
          }
        };
      } else {
        return {
          success: false,
          error: result.error || `${providerId} OAuth authentication failed`
        };
      }
    } catch (error) {
      log.error(`OAuth start flow error for ${providerId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : `${providerId} OAuth flow failed`
      };
    }
  }

  /**
   * Get provider status
   */
  private getProviderStatus(providerId: string): OAuthProviderStatus | null {
    const config = oAuth2ProviderConfig.getProviderConfig(providerId);
    if (!config) return null;

    const setup = oAuth2ProviderConfig.getSetupInstructions(providerId);
    
    return {
      providerId: config.providerId,
      name: config.name,
      configured: !!config.clientId,
      setupInstructions: setup?.instructions,
      setupUrl: setup?.setupUrl
    };
  }

  /**
   * Get all provider status
   */
  private getAllProviderStatus(): Record<string, OAuthProviderStatus> {
    const allProviders = oAuth2ProviderConfig.getAllProviders();
    const status: Record<string, OAuthProviderStatus> = {};

    for (const provider of allProviders) {
      const providerStatus = this.getProviderStatus(provider.providerId);
      if (providerStatus) {
        status[provider.providerId] = providerStatus;
      }
    }

    return status;
  }

  /**
   * Cleanup IPC handlers
   */
  cleanup(): void {
    log.info('Cleaning up OAuth2 IPC Service');
    
    // Remove IPC handlers
    const handlers = [
      'oauth:start-flow',
      'oauth:authenticate-provider',
      'oauth:get-provider-status',
      'oauth:get-configured-providers',
      'oauth:get-providers-needing-setup',
      'oauth:refresh-token',
      'oauth:get-token-status',
      'oauth:revoke-token',
      'oauth:get-all-tokens',
      'oauth:get-setup-instructions',
      'oauth:test-configuration',
      'mail:start-gmail-oauth',
      'mail:handle-oauth-callback'
    ];

    handlers.forEach(handler => {
      ipcMain.removeAllListeners(handler);
    });

    this.isInitialized = false;
    log.info('OAuth2 IPC Service cleaned up');
  }
}

// Export singleton instance
export const oAuth2IPCService = new OAuth2IPCService();

// Initialize on module load
oAuth2IPCService.initialize().catch(error => {
  log.error('Failed to initialize OAuth2 IPC Service on module load:', error);
});

export default oAuth2IPCService;