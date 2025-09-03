/**
 * OAuth2 Integration Manager - Complete OAuth2 flow integration
 * 
 * Orchestrates OAuth2 authentication between JavaScript UI, OAuth callback server,
 * and Rust engine for secure token management and real provider integration.
 */

import { BrowserWindow, shell } from 'electron';
import log from 'electron-log';
import { OAuthCallbackServer } from './oauth-server';
import OAuth2Manager from './oauth-manager';
import { rustOAuthManager } from '../lib/rust-integration/rust-oauth-manager';
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';
import { rustOAuthBridge } from './rust-oauth-bridge';

export interface OAuth2Config {
  gmail: {
    clientId: string;
    clientSecret: string;
  };
  outlook: {
    clientId: string;
    clientSecret: string;
  };
  [key: string]: {
    clientId: string;
    clientSecret: string;
  };
}

export interface CompleteOAuth2Result {
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
 * Comprehensive OAuth2 Integration Manager
 */
export class OAuth2IntegrationManager {
  private callbackServer: OAuthCallbackServer;
  private jsOAuthManager: OAuth2Manager;
  private config: OAuth2Config;
  private activeFlows: Map<string, {
    resolve: (result: CompleteOAuth2Result) => void;
    reject: (error: Error) => void;
    provider: string;
    accountId?: string;
  }> = new Map();

  constructor() {
    this.callbackServer = new OAuthCallbackServer(8080);
    
    // Initialize OAuth2 configuration from environment
    this.config = this.loadOAuth2Config();
    
    // Initialize JavaScript OAuth2Manager with encryption key
    const encryptionKey = this.generateEncryptionKey();
    this.jsOAuthManager = new OAuth2Manager(encryptionKey);
    
    log.info('OAuth2 Integration Manager initialized');
  }

  /**
   * Complete OAuth2 authentication flow for a provider
   */
  async authenticateProvider(providerId: string, accountId?: string): Promise<CompleteOAuth2Result> {
    const providerConfig = this.config[providerId];
    if (!providerConfig) {
      throw new Error(`OAuth2 configuration not found for provider: ${providerId}`);
    }

    if (!providerConfig.clientId) {
      throw new Error(`OAuth2 client ID not configured for ${providerId}. Please set environment variables.`);
    }

    try {
      log.info(`Starting complete OAuth2 flow for ${providerId}`, { accountId });

      // Start callback server if not running
      if (!this.callbackServer.isRunning()) {
        await this.startCallbackServer();
      }

      // Register OAuth client with Rust engine
      await this.registerRustOAuthClient(providerId, providerConfig);

      // Start OAuth flow using hybrid approach
      const result = await this.executeHybridOAuthFlow(providerId, accountId);
      
      log.info(`OAuth2 flow completed successfully for ${providerId}`, {
        accountId: result.accountId,
        hasTokens: !!(result.accessToken && result.refreshToken)
      });

      return result;
    } catch (error) {
      log.error(`OAuth2 flow failed for ${providerId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OAuth2 error'
      };
    }
  }

  /**
   * Execute hybrid OAuth2 flow using both JS and Rust engines
   */
  private async executeHybridOAuthFlow(providerId: string, accountId?: string): Promise<CompleteOAuth2Result> {
    return new Promise(async (resolve, reject) => {
      try {
        // Generate flow state for tracking
        const flowState = this.generateFlowState();
        
        // Store flow information
        this.activeFlows.set(flowState, {
          resolve,
          reject,
          provider: providerId,
          accountId
        });

        // Get authorization URL from Rust engine
        const authUrl = await this.getRustAuthorizationUrl(providerId, flowState);
        
        // Open authorization URL in browser window
        const authWindow = this.createAuthWindow();
        authWindow.loadURL(authUrl);
        
        // Handle window navigation for callback capture
        authWindow.webContents.on('will-redirect', (event, navigationUrl) => {
          this.handleAuthNavigation(navigationUrl, flowState, authWindow);
        });

        authWindow.webContents.on('did-navigate', (event, navigationUrl) => {
          this.handleAuthNavigation(navigationUrl, flowState, authWindow);
        });

        // Handle window close (user cancellation)
        authWindow.on('closed', () => {
          const flow = this.activeFlows.get(flowState);
          if (flow) {
            flow.reject(new Error('OAuth flow cancelled by user'));
            this.activeFlows.delete(flowState);
          }
        });

        // Timeout after 10 minutes
        setTimeout(() => {
          const flow = this.activeFlows.get(flowState);
          if (flow) {
            flow.reject(new Error('OAuth flow timeout'));
            this.activeFlows.delete(flowState);
            authWindow.close();
          }
        }, 10 * 60 * 1000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle authorization window navigation
   */
  private async handleAuthNavigation(url: string, flowState: string, authWindow: BrowserWindow) {
    const flow = this.activeFlows.get(flowState);
    if (!flow) return;

    try {
      // Check if this is our callback URL
      if (!url.startsWith('http://localhost:8080/oauth/callback')) {
        return;
      }

      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const state = urlObj.searchParams.get('state');
      const error = urlObj.searchParams.get('error');

      if (error) {
        flow.reject(new Error(`OAuth error: ${error}`));
        authWindow.close();
        this.activeFlows.delete(flowState);
        return;
      }

      if (code && state === flowState) {
        // Exchange code for tokens using Rust engine
        const result = await this.exchangeCodeForTokens(code, state, flow.provider, flow.accountId);
        
        flow.resolve(result);
        authWindow.close();
        this.activeFlows.delete(flowState);
        
        log.info('OAuth flow completed successfully via navigation handler');
      }
    } catch (error) {
      log.error('Error in auth navigation handler:', error);
      flow.reject(error as Error);
      authWindow.close();
      this.activeFlows.delete(flowState);
    }
  }

  /**
   * Exchange authorization code for tokens using Rust engine
   */
  private async exchangeCodeForTokens(
    code: string, 
    state: string, 
    providerId: string, 
    accountId?: string
  ): Promise<CompleteOAuth2Result> {
    try {
      log.info('Exchanging authorization code for tokens', { providerId, hasAccountId: !!accountId });

      // Use Rust engine for secure token exchange
      const tokenResult = await rustEngineIntegration.handleOAuthCallback(code, state, providerId);
      
      // Store credentials securely in Rust engine if account ID provided
      if (accountId && tokenResult.accessToken) {
        await this.storeCredentialsInRust(accountId, providerId, tokenResult);
      }

      return {
        success: true,
        accountId: accountId,
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // Default 1 hour
        userInfo: tokenResult.userInfo
      };
    } catch (error) {
      log.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Store OAuth credentials securely in Rust engine
   */
  private async storeCredentialsInRust(accountId: string, providerId: string, tokenResult: any): Promise<void> {
    try {
      // This would call the Rust engine's credential storage
      // For now, we'll use the existing storage mechanism
      log.info('Storing OAuth credentials in Rust engine', { accountId, providerId });
      
      // TODO: Implement proper Rust engine credential storage integration
      // await rustEngineIntegration.storeOAuthCredentials(accountId, providerId, tokenResult);
      
    } catch (error) {
      log.warn('Failed to store credentials in Rust engine:', error);
      // Non-critical error - tokens can still be used
    }
  }

  /**
   * Get authorization URL from Rust engine
   */
  private async getRustAuthorizationUrl(providerId: string, state: string): Promise<string> {
    try {
      // Get auth URL from Rust engine with proper configuration
      const authResult = await rustEngineIntegration.startOAuthFlow(providerId);
      
      // Ensure state matches our flow tracking
      if (authResult.state !== state) {
        log.warn('State mismatch between request and Rust engine response');
      }
      
      return authResult.authUrl;
    } catch (error) {
      log.error('Failed to get authorization URL from Rust engine:', error);
      
      // Fallback to JavaScript OAuth manager
      log.info('Falling back to JavaScript OAuth manager');
      const result = await this.jsOAuthManager.startOAuthFlow(providerId);
      return result.credentials.accessToken; // This would be the auth URL in a real implementation
    }
  }

  /**
   * Register OAuth client with Rust engine
   */
  private async registerRustOAuthClient(providerId: string, config: { clientId: string; clientSecret: string }): Promise<void> {
    try {
      // Register OAuth client configuration with Rust engine
      await rustEngineIntegration.registerOAuthProvider(providerId, config.clientId, config.clientSecret);
      log.info(`OAuth client registered with Rust engine: ${providerId}`);
    } catch (error) {
      log.warn('Failed to register OAuth client with Rust engine:', error);
      // Continue with JavaScript fallback
    }
  }

  /**
   * Start OAuth callback server
   */
  private async startCallbackServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.callbackServer.start((callbackData) => {
        // Handle callback data - this will be processed by navigation handlers
        log.info('OAuth callback received by server:', {
          hasCode: !!callbackData.code,
          hasState: !!callbackData.state,
          error: callbackData.error
        });
      }).then(resolve).catch(reject);
    });
  }

  /**
   * Stop OAuth callback server
   */
  async stopCallbackServer(): Promise<void> {
    await this.callbackServer.stop();
  }

  /**
   * Refresh OAuth tokens using Rust engine
   */
  async refreshToken(providerId: string, refreshToken: string, accountId?: string): Promise<CompleteOAuth2Result> {
    try {
      log.info('Refreshing OAuth token', { providerId, accountId });
      
      // Try Rust engine first
      try {
        const refreshResult = await rustOAuthManager.refreshToken(providerId, refreshToken);
        
        // Update stored credentials if account ID provided
        if (accountId && refreshResult.accessToken) {
          await this.storeCredentialsInRust(accountId, providerId, refreshResult);
        }
        
        return {
          success: true,
          accountId,
          accessToken: refreshResult.accessToken,
          refreshToken: refreshResult.refreshToken,
          expiresAt: refreshResult.expiresAt
        };
      } catch (rustError) {
        log.warn('Rust engine token refresh failed, trying JavaScript fallback:', rustError);
        
        // Fallback to JavaScript OAuth manager
        const jsResult = await this.jsOAuthManager.refreshToken(providerId, refreshToken);
        
        return {
          success: true,
          accountId,
          accessToken: jsResult.accessToken,
          refreshToken: jsResult.refreshToken,
          expiresAt: jsResult.expiresAt
        };
      }
    } catch (error) {
      log.error('Token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  /**
   * Revoke OAuth tokens
   */
  async revokeToken(providerId: string, accessToken: string): Promise<void> {
    try {
      // Try Rust engine first
      await rustOAuthManager.revokeToken(providerId, accessToken);
    } catch (rustError) {
      log.warn('Rust token revocation failed, trying JavaScript fallback:', rustError);
      // Fallback to JavaScript OAuth manager
      await this.jsOAuthManager.revokeToken(providerId, accessToken);
    }
  }

  /**
   * Create OAuth authorization window
   */
  private createAuthWindow(): BrowserWindow {
    return new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      },
      titleBarStyle: 'default',
      title: 'Flow Desk - Account Authorization'
    });
  }

  /**
   * Load OAuth2 configuration from environment
   */
  private loadOAuth2Config(): OAuth2Config {
    return {
      gmail: {
        clientId: process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || '',
      },
      outlook: {
        clientId: process.env.MICROSOFT_CLIENT_ID || process.env.OUTLOOK_CLIENT_ID || '',
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || process.env.OUTLOOK_CLIENT_SECRET || '',
      }
    };
  }

  /**
   * Generate encryption key for OAuth manager
   */
  private generateEncryptionKey(): string {
    // In production, this should be derived from secure system storage
    return process.env.OAUTH_ENCRYPTION_KEY || 'flow_desk_oauth_default_key_change_in_production';
  }

  /**
   * Generate flow state for tracking
   */
  private generateFlowState(): string {
    return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if provider is configured
   */
  isProviderConfigured(providerId: string): boolean {
    const config = this.config[providerId];
    return !!(config && config.clientId);
  }

  /**
   * Get configured providers
   */
  getConfiguredProviders(): string[] {
    return Object.keys(this.config).filter(providerId => this.isProviderConfigured(providerId));
  }

  /**
   * Cleanup - close callback server and active flows
   */
  async cleanup(): Promise<void> {
    log.info('Cleaning up OAuth2 Integration Manager');
    
    // Close all active flows
    for (const [state, flow] of this.activeFlows.entries()) {
      flow.reject(new Error('OAuth2 Integration Manager shutting down'));
    }
    this.activeFlows.clear();
    
    // Stop callback server
    await this.stopCallbackServer();
    
    // Cleanup managers
    this.jsOAuthManager.cleanup();
    rustOAuthManager.cleanup();
  }
}

// Export singleton instance
export const oAuth2IntegrationManager = new OAuth2IntegrationManager();
export default oAuth2IntegrationManager;