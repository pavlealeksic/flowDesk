/**
 * Comprehensive OAuth2 Service for Flow Desk
 * Supports 15+ providers with proper token management, refresh, and error handling
 */

import crypto from 'crypto';

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
  customAuthFlow?: (config: OAuthConfig) => Promise<string>; // Custom auth URL
  customTokenExchange?: (code: string, config: OAuthConfig, codeVerifier?: string) => Promise<OAuthTokens>;
  customUserInfo?: (tokens: OAuthTokens) => Promise<OAuthUserInfo>;
}

// Predefined OAuth providers
export const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  // Email & Calendar
  google: {
    id: 'google',
    name: 'Google',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      pkce: true
    }
  },

  microsoft: {
    id: 'microsoft',
    name: 'Microsoft',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: [
        'https://graph.microsoft.com/User.Read',
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Calendars.Read',
        'https://graph.microsoft.com/Calendars.ReadWrite'
      ],
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      revokeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      pkce: true
    }
  },

  // Communication
  slack: {
    id: 'slack',
    name: 'Slack',
    tokenStorage: 'secure',
    autoRefresh: false, // Slack tokens don't expire
    config: {
      clientId: process.env.SLACK_CLIENT_ID || '',
      clientSecret: process.env.SLACK_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: [
        'channels:read',
        'groups:read',
        'im:read',
        'mpim:read',
        'users:read',
        'chat:write',
        'files:read',
        'reactions:read'
      ],
      authUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      userInfoUrl: 'https://slack.com/api/users.info'
    }
  },

  discord: {
    id: 'discord',
    name: 'Discord',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['identify', 'guilds', 'guilds.members.read', 'messages.read'],
      authUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      revokeUrl: 'https://discord.com/api/oauth2/token/revoke',
      userInfoUrl: 'https://discord.com/api/users/@me'
    }
  },

  telegram: {
    id: 'telegram',
    name: 'Telegram',
    tokenStorage: 'secure',
    autoRefresh: false,
    config: {
      clientId: process.env.TELEGRAM_APP_ID || '',
      clientSecret: process.env.TELEGRAM_APP_HASH || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['messages', 'contacts'],
      authUrl: 'https://oauth.telegram.org/auth',
      tokenUrl: 'https://oauth.telegram.org/token',
      customParams: {
        bot_id: process.env.TELEGRAM_BOT_ID || ''
      }
    }
  },

  // Project Management
  notion: {
    id: 'notion',
    name: 'Notion',
    tokenStorage: 'secure',
    autoRefresh: false,
    config: {
      clientId: process.env.NOTION_CLIENT_ID || '',
      clientSecret: process.env.NOTION_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['read_content', 'read_user_with_email'],
      authUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      userInfoUrl: 'https://api.notion.com/v1/users/me'
    }
  },

  asana: {
    id: 'asana',
    name: 'Asana',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.ASANA_CLIENT_ID || '',
      clientSecret: process.env.ASANA_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['default'],
      authUrl: 'https://app.asana.com/-/oauth_authorize',
      tokenUrl: 'https://app.asana.com/-/oauth_token',
      userInfoUrl: 'https://app.asana.com/api/1.0/users/me'
    }
  },

  trello: {
    id: 'trello',
    name: 'Trello',
    tokenStorage: 'secure',
    autoRefresh: false,
    config: {
      clientId: process.env.TRELLO_API_KEY || '',
      clientSecret: process.env.TRELLO_API_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['read', 'write'],
      authUrl: 'https://trello.com/1/authorize',
      tokenUrl: 'https://trello.com/1/OAuthGetAccessToken',
      userInfoUrl: 'https://api.trello.com/1/members/me'
    }
  },

  jira: {
    id: 'jira',
    name: 'Jira',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.JIRA_CLIENT_ID || '',
      clientSecret: process.env.JIRA_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['read:jira-user', 'read:jira-work', 'write:jira-work'],
      authUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      userInfoUrl: 'https://api.atlassian.com/me'
    }
  },

  linear: {
    id: 'linear',
    name: 'Linear',
    tokenStorage: 'secure',
    autoRefresh: false,
    config: {
      clientId: process.env.LINEAR_CLIENT_ID || '',
      clientSecret: process.env.LINEAR_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['read', 'write'],
      authUrl: 'https://linear.app/oauth/authorize',
      tokenUrl: 'https://api.linear.app/oauth/token',
      userInfoUrl: 'https://api.linear.app/graphql'
    }
  },

  clickup: {
    id: 'clickup',
    name: 'ClickUp',
    tokenStorage: 'secure',
    autoRefresh: false,
    config: {
      clientId: process.env.CLICKUP_CLIENT_ID || '',
      clientSecret: process.env.CLICKUP_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: [],
      authUrl: 'https://app.clickup.com/api',
      tokenUrl: 'https://api.clickup.com/api/v2/oauth/token',
      userInfoUrl: 'https://api.clickup.com/api/v2/user'
    }
  },

  // Development
  github: {
    id: 'github',
    name: 'GitHub',
    tokenStorage: 'secure',
    autoRefresh: false,
    config: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['user:email', 'repo', 'notifications', 'read:org'],
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user'
    }
  },

  gitlab: {
    id: 'gitlab',
    name: 'GitLab',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.GITLAB_CLIENT_ID || '',
      clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['read_user', 'read_repository', 'api'],
      authUrl: 'https://gitlab.com/oauth/authorize',
      tokenUrl: 'https://gitlab.com/oauth/token',
      userInfoUrl: 'https://gitlab.com/api/v4/user'
    }
  },

  // Cloud Storage
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.DROPBOX_APP_KEY || '',
      clientSecret: process.env.DROPBOX_APP_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['files.metadata.read', 'files.content.read', 'files.content.write'],
      authUrl: 'https://www.dropbox.com/oauth2/authorize',
      tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
      revokeUrl: 'https://api.dropboxapi.com/2/auth/token/revoke',
      userInfoUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
      pkce: true
    }
  },

  box: {
    id: 'box',
    name: 'Box',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.BOX_CLIENT_ID || '',
      clientSecret: process.env.BOX_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['root_readwrite'],
      authUrl: 'https://account.box.com/api/oauth2/authorize',
      tokenUrl: 'https://api.box.com/oauth2/token',
      revokeUrl: 'https://api.box.com/oauth2/revoke',
      userInfoUrl: 'https://api.box.com/2.0/users/me'
    }
  },

  // Social & Marketing
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    tokenStorage: 'secure',
    autoRefresh: true,
    config: {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      redirectUri: 'flowdesk://oauth/callback',
      scope: ['tweet.read', 'tweet.write', 'users.read', 'follows.read'],
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
      userInfoUrl: 'https://api.twitter.com/2/users/me',
      pkce: true
    }
  }
};

export class OAuthService {
  private static instance: OAuthService | null = null;
  private tokens: Map<string, OAuthTokens> = new Map();
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private tokenStorage: any; // Platform-specific storage
  private isElectron: boolean;

  constructor(tokenStorage?: any, isElectron: boolean = false) {
    this.tokenStorage = tokenStorage;
    this.isElectron = isElectron;
  }

  static getInstance(tokenStorage?: any, isElectron?: boolean): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService(tokenStorage, isElectron);
    }
    return OAuthService.instance;
  }

  /**
   * Initialize OAuth service and load existing tokens
   */
  async initialize(): Promise<void> {
    try {
      // Load stored tokens
      await this.loadStoredTokens();
      
      // Set up auto-refresh for providers that support it
      for (const [providerId, provider] of Object.entries(OAUTH_PROVIDERS)) {
        if (provider.autoRefresh && this.tokens.has(providerId)) {
          this.setupAutoRefresh(providerId, provider);
        }
      }
      
      console.log('OAuthService initialized');
    } catch (error) {
      console.error('Failed to initialize OAuth service:', error);
      throw error;
    }
  }

  /**
   * Get authorization URL for a provider
   */
  async getAuthorizationUrl(providerId: string, state?: string): Promise<string> {
    const provider = OAUTH_PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const config = provider.config;
    
    // Use custom auth flow if provided
    if (provider.customAuthFlow) {
      return await provider.customAuthFlow(config);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope.join(' '),
      state: state || this.generateState()
    });

    // Add PKCE parameters if supported
    let codeVerifier: string | undefined;
    if (config.pkce) {
      codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
      
      // Store code verifier for token exchange
      await this.storeCodeVerifier(providerId, codeVerifier);
    }

    // Add custom parameters
    if (config.customParams) {
      for (const [key, value] of Object.entries(config.customParams)) {
        params.append(key, value);
      }
    }

    return `${config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    providerId: string,
    code: string,
    state?: string
  ): Promise<OAuthTokens> {
    const provider = OAUTH_PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const config = provider.config;
    
    // Use custom token exchange if provided
    if (provider.customTokenExchange) {
      const codeVerifier = await this.getCodeVerifier(providerId);
      const tokens = await provider.customTokenExchange(code, config, codeVerifier);
      await this.storeTokens(providerId, tokens, provider);
      return tokens;
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri
    });

    // Add client secret if provided (not needed for PKCE)
    if (config.clientSecret) {
      body.append('client_secret', config.clientSecret);
    }

    // Add PKCE code verifier if used
    if (config.pkce) {
      const codeVerifier = await this.getCodeVerifier(providerId);
      if (codeVerifier) {
        body.append('code_verifier', codeVerifier);
      }
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      const tokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        tokenType: data.token_type || 'Bearer',
        expiresIn: data.expires_in,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        scope: data.scope
      };

      await this.storeTokens(providerId, tokens, provider);
      
      // Set up auto-refresh if supported
      if (provider.autoRefresh && tokens.refreshToken) {
        this.setupAutoRefresh(providerId, provider);
      }

      return tokens;
    } catch (error) {
      console.error(`Failed to exchange code for tokens (${providerId}):`, error);
      throw error;
    }
  }

  /**
   * Get stored tokens for a provider
   */
  async getTokens(providerId: string): Promise<OAuthTokens | null> {
    // Check memory cache first
    const cachedTokens = this.tokens.get(providerId);
    if (cachedTokens) {
      // Check if tokens are expired
      if (cachedTokens.expiresAt && cachedTokens.expiresAt <= Date.now()) {
        // Try to refresh if possible
        const provider = OAUTH_PROVIDERS[providerId];
        if (provider?.autoRefresh && cachedTokens.refreshToken) {
          try {
            return await this.refreshTokens(providerId);
          } catch (error) {
            console.error(`Failed to refresh tokens for ${providerId}:`, error);
            // Clear expired tokens
            await this.clearTokens(providerId);
            return null;
          }
        } else {
          // Clear expired tokens
          await this.clearTokens(providerId);
          return null;
        }
      }
      return cachedTokens;
    }

    // Try to load from storage
    try {
      const storedTokens = await this.loadTokensFromStorage(providerId);
      if (storedTokens) {
        this.tokens.set(providerId, storedTokens);
        return storedTokens;
      }
    } catch (error) {
      console.error(`Failed to load tokens from storage for ${providerId}:`, error);
    }

    return null;
  }

  /**
   * Refresh tokens for a provider
   */
  async refreshTokens(providerId: string): Promise<OAuthTokens> {
    const provider = OAUTH_PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const currentTokens = this.tokens.get(providerId);
    if (!currentTokens?.refreshToken) {
      throw new Error(`No refresh token available for ${providerId}`);
    }

    const config = provider.config;
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentTokens.refreshToken,
      client_id: config.clientId
    });

    if (config.clientSecret) {
      body.append('client_secret', config.clientSecret);
    }

    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      const newTokens: OAuthTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || currentTokens.refreshToken, // Some providers don't return new refresh token
        idToken: data.id_token,
        tokenType: data.token_type || currentTokens.tokenType,
        expiresIn: data.expires_in,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        scope: data.scope || currentTokens.scope
      };

      await this.storeTokens(providerId, newTokens, provider);
      
      console.log(`Refreshed tokens for ${providerId}`);
      return newTokens;
    } catch (error) {
      console.error(`Failed to refresh tokens for ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Revoke tokens for a provider
   */
  async revokeTokens(providerId: string): Promise<void> {
    const provider = OAUTH_PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    const tokens = await this.getTokens(providerId);
    if (!tokens) {
      return; // No tokens to revoke
    }

    // Try to revoke on the server if supported
    if (provider.config.revokeUrl) {
      try {
        const body = new URLSearchParams({
          token: tokens.accessToken,
          client_id: provider.config.clientId
        });

        if (provider.config.clientSecret) {
          body.append('client_secret', provider.config.clientSecret);
        }

        await fetch(provider.config.revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        });
      } catch (error) {
        console.warn(`Failed to revoke tokens on server for ${providerId}:`, error);
      }
    }

    // Clear locally stored tokens
    await this.clearTokens(providerId);
    
    console.log(`Revoked tokens for ${providerId}`);
  }

  /**
   * Get user information using stored tokens
   */
  async getUserInfo(providerId: string): Promise<OAuthUserInfo | null> {
    const provider = OAUTH_PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown OAuth provider: ${providerId}`);
    }

    // Use custom user info method if provided
    if (provider.customUserInfo) {
      const tokens = await this.getTokens(providerId);
      if (!tokens) return null;
      return await provider.customUserInfo(tokens);
    }

    if (!provider.config.userInfoUrl) {
      throw new Error(`User info URL not configured for ${providerId}`);
    }

    const tokens = await this.getTokens(providerId);
    if (!tokens) {
      return null;
    }

    try {
      const response = await fetch(provider.config.userInfoUrl, {
        headers: {
          'Authorization': `${tokens.tokenType} ${tokens.accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
      }

      const userData = await response.json();
      
      // Normalize user data based on provider
      return this.normalizeUserInfo(providerId, userData);
    } catch (error) {
      console.error(`Failed to get user info for ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated for a provider
   */
  async isAuthenticated(providerId: string): Promise<boolean> {
    const tokens = await this.getTokens(providerId);
    return tokens !== null;
  }

  /**
   * Get list of authenticated providers
   */
  getAuthenticatedProviders(): string[] {
    return Array.from(this.tokens.keys());
  }

  // Private methods

  private async storeTokens(providerId: string, tokens: OAuthTokens, provider: OAuthProvider): Promise<void> {
    // Store in memory cache
    this.tokens.set(providerId, tokens);
    
    // Store persistently based on provider settings
    if (this.tokenStorage) {
      const storageKey = `oauth_tokens_${providerId}`;
      
      try {
        if (provider.tokenStorage === 'secure' && this.tokenStorage.setSecureItem) {
          // Use secure storage for sensitive tokens
          await this.tokenStorage.setSecureItem(storageKey, JSON.stringify(tokens));
        } else if (provider.tokenStorage === 'persistent' && this.tokenStorage.setItem) {
          // Use regular persistent storage
          await this.tokenStorage.setItem(storageKey, JSON.stringify(tokens));
        }
        // Memory storage doesn't need persistent storage
      } catch (error) {
        console.error(`Failed to store tokens for ${providerId}:`, error);
      }
    }
  }

  private async loadTokensFromStorage(providerId: string): Promise<OAuthTokens | null> {
    if (!this.tokenStorage) return null;
    
    const storageKey = `oauth_tokens_${providerId}`;
    const provider = OAUTH_PROVIDERS[providerId];
    
    if (!provider) return null;
    
    try {
      let tokensJson: string | null = null;
      
      if (provider.tokenStorage === 'secure' && this.tokenStorage.getSecureItem) {
        tokensJson = await this.tokenStorage.getSecureItem(storageKey);
      } else if (provider.tokenStorage === 'persistent' && this.tokenStorage.getItem) {
        tokensJson = await this.tokenStorage.getItem(storageKey);
      }
      
      if (tokensJson) {
        return JSON.parse(tokensJson);
      }
    } catch (error) {
      console.error(`Failed to load tokens for ${providerId}:`, error);
    }
    
    return null;
  }

  private async loadStoredTokens(): Promise<void> {
    for (const providerId of Object.keys(OAUTH_PROVIDERS)) {
      try {
        const tokens = await this.loadTokensFromStorage(providerId);
        if (tokens) {
          this.tokens.set(providerId, tokens);
        }
      } catch (error) {
        console.error(`Failed to load stored tokens for ${providerId}:`, error);
      }
    }
  }

  private async clearTokens(providerId: string): Promise<void> {
    // Clear from memory
    this.tokens.delete(providerId);
    
    // Clear auto-refresh
    const refreshInterval = this.refreshIntervals.get(providerId);
    if (refreshInterval) {
      clearInterval(refreshInterval);
      this.refreshIntervals.delete(providerId);
    }
    
    // Clear from storage
    if (this.tokenStorage) {
      const storageKey = `oauth_tokens_${providerId}`;
      const provider = OAUTH_PROVIDERS[providerId];
      
      if (provider) {
        try {
          if (provider.tokenStorage === 'secure' && this.tokenStorage.removeSecureItem) {
            await this.tokenStorage.removeSecureItem(storageKey);
          } else if (provider.tokenStorage === 'persistent' && this.tokenStorage.removeItem) {
            await this.tokenStorage.removeItem(storageKey);
          }
        } catch (error) {
          console.error(`Failed to clear tokens for ${providerId}:`, error);
        }
      }
    }
  }

  private setupAutoRefresh(providerId: string, provider: OAuthProvider): void {
    const tokens = this.tokens.get(providerId);
    if (!tokens?.expiresAt || !tokens.refreshToken) return;
    
    // Clear existing interval
    const existingInterval = this.refreshIntervals.get(providerId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // Calculate refresh time (refresh 5 minutes before expiry)
    const refreshTime = tokens.expiresAt - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      const interval = setTimeout(async () => {
        try {
          await this.refreshTokens(providerId);
          // Set up next refresh
          this.setupAutoRefresh(providerId, provider);
        } catch (error) {
          console.error(`Auto-refresh failed for ${providerId}:`, error);
        }
      }, refreshTime);
      
      // Store interval for cleanup
      this.refreshIntervals.set(providerId, interval);
    }
  }

  private generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  private async storeCodeVerifier(providerId: string, verifier: string): Promise<void> {
    if (this.tokenStorage?.setItem) {
      await this.tokenStorage.setItem(`code_verifier_${providerId}`, verifier);
    }
  }

  private async getCodeVerifier(providerId: string): Promise<string | null> {
    if (this.tokenStorage?.getItem) {
      const verifier = await this.tokenStorage.getItem(`code_verifier_${providerId}`);
      // Clean up after use
      if (verifier && this.tokenStorage.removeItem) {
        await this.tokenStorage.removeItem(`code_verifier_${providerId}`);
      }
      return verifier;
    }
    return null;
  }

  private normalizeUserInfo(providerId: string, userData: any): OAuthUserInfo {
    // Normalize user data based on provider-specific response formats
    switch (providerId) {
      case 'google':
        return {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          locale: userData.locale
        };
      
      case 'microsoft':
        return {
          id: userData.id,
          email: userData.mail || userData.userPrincipalName,
          name: userData.displayName,
          picture: userData.photo?.url
        };
      
      case 'github':
        return {
          id: userData.id.toString(),
          email: userData.email,
          name: userData.name || userData.login,
          picture: userData.avatar_url,
          login: userData.login
        };
      
      case 'slack':
        return {
          id: userData.user?.id,
          email: userData.user?.profile?.email,
          name: userData.user?.real_name || userData.user?.name,
          picture: userData.user?.profile?.image_192
        };
      
      default:
        // Generic normalization
        return {
          id: userData.id || userData.sub,
          email: userData.email,
          name: userData.name || userData.displayName,
          picture: userData.picture || userData.avatar_url || userData.photo?.url,
          ...userData
        };
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Clear all auto-refresh intervals
    for (const interval of this.refreshIntervals.values()) {
      clearInterval(interval);
    }
    
    this.tokens.clear();
    this.refreshIntervals.clear();
  }
}

// Helper functions
export const createOAuthService = (tokenStorage?: any, isElectron?: boolean) => {
  return new OAuthService(tokenStorage, isElectron);
};

export const getAvailableProviders = (): OAuthProvider[] => {
  return Object.values(OAUTH_PROVIDERS);
};

export const getProviderById = (providerId: string): OAuthProvider | null => {
  return OAUTH_PROVIDERS[providerId] || null;
};