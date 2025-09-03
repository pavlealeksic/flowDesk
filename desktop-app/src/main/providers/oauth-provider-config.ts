/**
 * OAuth2 Provider Configuration Manager
 * 
 * Centralized configuration and management for all OAuth2 providers
 * including Gmail, Outlook, Google Calendar, and other supported services.
 */

import log from 'electron-log';

export interface OAuth2ProviderConfig {
  providerId: string;
  name: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  revokeUrl?: string;
  scopes: string[];
  redirectUri: string;
  supportsRefreshToken: boolean;
  requiresClientSecret: boolean;
}

export interface OAuth2ProviderSetup {
  providerId: string;
  name: string;
  setupUrl: string;
  instructions: string[];
  requiredScopes: string[];
  redirectUri: string;
}

/**
 * OAuth2 Provider Configuration Manager
 */
export class OAuth2ProviderConfigManager {
  private static instance: OAuth2ProviderConfigManager;
  private providers: Map<string, OAuth2ProviderConfig> = new Map();
  private setupInstructions: Map<string, OAuth2ProviderSetup> = new Map();

  private constructor() {
    this.initializeProviders();
    this.initializeSetupInstructions();
  }

  static getInstance(): OAuth2ProviderConfigManager {
    if (!OAuth2ProviderConfigManager.instance) {
      OAuth2ProviderConfigManager.instance = new OAuth2ProviderConfigManager();
    }
    return OAuth2ProviderConfigManager.instance;
  }

  /**
   * Initialize OAuth2 provider configurations
   */
  private initializeProviders(): void {
    // Gmail Configuration
    this.providers.set('gmail', {
      providerId: 'gmail',
      name: 'Gmail',
      clientId: this.getEnvironmentVariable(['GOOGLE_CLIENT_ID', 'GMAIL_CLIENT_ID']),
      clientSecret: this.getEnvironmentVariable(['GOOGLE_CLIENT_SECRET', 'GMAIL_CLIENT_SECRET']),
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      redirectUri: 'http://localhost:8080/oauth/callback',
      supportsRefreshToken: true,
      requiresClientSecret: true
    });

    // Microsoft Outlook Configuration
    this.providers.set('outlook', {
      providerId: 'outlook',
      name: 'Microsoft Outlook',
      clientId: this.getEnvironmentVariable(['MICROSOFT_CLIENT_ID', 'OUTLOOK_CLIENT_ID']),
      clientSecret: this.getEnvironmentVariable(['MICROSOFT_CLIENT_SECRET', 'OUTLOOK_CLIENT_SECRET']),
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scopes: [
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'https://outlook.office.com/SMTP.Send',
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/User.Read',
        'offline_access'
      ],
      redirectUri: 'http://localhost:8080/oauth/callback',
      supportsRefreshToken: true,
      requiresClientSecret: true
    });

    // Google Calendar Configuration
    this.providers.set('google-calendar', {
      providerId: 'google-calendar',
      name: 'Google Calendar',
      clientId: this.getEnvironmentVariable(['GOOGLE_CALENDAR_CLIENT_ID', 'GOOGLE_CLIENT_ID']),
      clientSecret: this.getEnvironmentVariable(['GOOGLE_CALENDAR_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET']),
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      redirectUri: 'http://localhost:8080/oauth/callback',
      supportsRefreshToken: true,
      requiresClientSecret: true
    });

    // Microsoft Calendar Configuration
    this.providers.set('outlook-calendar', {
      providerId: 'outlook-calendar',
      name: 'Microsoft Calendar',
      clientId: this.getEnvironmentVariable(['MICROSOFT_CLIENT_ID', 'OUTLOOK_CLIENT_ID']),
      clientSecret: this.getEnvironmentVariable(['MICROSOFT_CLIENT_SECRET', 'OUTLOOK_CLIENT_SECRET']),
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scopes: [
        'https://graph.microsoft.com/Calendars.ReadWrite',
        'https://graph.microsoft.com/User.Read',
        'offline_access'
      ],
      redirectUri: 'http://localhost:8080/oauth/callback',
      supportsRefreshToken: true,
      requiresClientSecret: true
    });

    // Yahoo Mail Configuration (optional)
    this.providers.set('yahoo', {
      providerId: 'yahoo',
      name: 'Yahoo Mail',
      clientId: this.getEnvironmentVariable(['YAHOO_CLIENT_ID']),
      clientSecret: this.getEnvironmentVariable(['YAHOO_CLIENT_SECRET']),
      authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
      tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
      userInfoUrl: 'https://api.login.yahoo.com/openid/v1/userinfo',
      scopes: ['mail-r', 'mail-w'],
      redirectUri: 'http://localhost:8080/oauth/callback',
      supportsRefreshToken: true,
      requiresClientSecret: true
    });

    log.info('OAuth2 providers initialized:', Array.from(this.providers.keys()));
  }

  /**
   * Initialize setup instructions for each provider
   */
  private initializeSetupInstructions(): void {
    // Gmail Setup Instructions
    this.setupInstructions.set('gmail', {
      providerId: 'gmail',
      name: 'Gmail',
      setupUrl: 'https://console.cloud.google.com/apis/credentials',
      redirectUri: 'http://localhost:8080/oauth/callback',
      requiredScopes: [
        'Gmail API',
        'Google+ API (for user info)'
      ],
      instructions: [
        '1. Go to Google Cloud Console (https://console.cloud.google.com/)',
        '2. Create a new project or select an existing one',
        '3. Enable the Gmail API and Google+ API',
        '4. Go to Credentials > Create Credentials > OAuth 2.0 Client IDs',
        '5. Choose "Desktop Application" as the application type',
        '6. Add authorized redirect URI: http://localhost:8080/oauth/callback',
        '7. Copy the Client ID and Client Secret',
        '8. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file',
        '9. Ensure your Google account has 2-factor authentication enabled',
        '10. Test the connection by adding a Gmail account in Flow Desk'
      ]
    });

    // Outlook Setup Instructions
    this.setupInstructions.set('outlook', {
      providerId: 'outlook',
      name: 'Microsoft Outlook',
      setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
      redirectUri: 'http://localhost:8080/oauth/callback',
      requiredScopes: [
        'IMAP.AccessAsUser.All',
        'SMTP.Send',
        'Mail.Read',
        'Mail.Send',
        'User.Read'
      ],
      instructions: [
        '1. Go to Azure Portal (https://portal.azure.com/)',
        '2. Navigate to Azure Active Directory > App registrations',
        '3. Click "New registration"',
        '4. Name your application (e.g., "Flow Desk Desktop")',
        '5. Choose "Accounts in any organizational directory and personal Microsoft accounts"',
        '6. Set redirect URI: http://localhost:8080/oauth/callback (Public client/native)',
        '7. After creation, go to "API permissions"',
        '8. Add Microsoft Graph permissions: Mail.Read, Mail.Send, IMAP.AccessAsUser.All, SMTP.Send, User.Read',
        '9. Add Office 365 Exchange Online permissions: IMAP.AccessAsUser.All, SMTP.Send',
        '10. Grant admin consent for the permissions',
        '11. Go to "Certificates & secrets" and create a new client secret',
        '12. Copy the Application (client) ID and client secret value',
        '13. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in your .env file',
        '14. Test the connection by adding an Outlook account in Flow Desk'
      ]
    });

    // Google Calendar Setup Instructions
    this.setupInstructions.set('google-calendar', {
      providerId: 'google-calendar',
      name: 'Google Calendar',
      setupUrl: 'https://console.cloud.google.com/apis/credentials',
      redirectUri: 'http://localhost:8080/oauth/callback',
      requiredScopes: [
        'Calendar API',
        'Google+ API (for user info)'
      ],
      instructions: [
        '1. Go to Google Cloud Console (https://console.cloud.google.com/)',
        '2. Use the same project as Gmail or create a new one',
        '3. Enable the Google Calendar API',
        '4. Use the same OAuth 2.0 credentials as Gmail or create new ones',
        '5. Ensure the redirect URI includes: http://localhost:8080/oauth/callback',
        '6. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in .env',
        '7. Test by connecting a Google Calendar account in Flow Desk'
      ]
    });

    log.info('OAuth2 setup instructions initialized');
  }

  /**
   * Get environment variable with fallback options
   */
  private getEnvironmentVariable(keys: string[]): string {
    for (const key of keys) {
      const value = process.env[key];
      if (value) {
        return value;
      }
    }
    return '';
  }

  /**
   * Get OAuth2 configuration for a provider
   */
  getProviderConfig(providerId: string): OAuth2ProviderConfig | null {
    return this.providers.get(providerId) || null;
  }

  /**
   * Get setup instructions for a provider
   */
  getSetupInstructions(providerId: string): OAuth2ProviderSetup | null {
    return this.setupInstructions.get(providerId) || null;
  }

  /**
   * Check if a provider is configured (has client ID)
   */
  isProviderConfigured(providerId: string): boolean {
    const config = this.providers.get(providerId);
    return !!(config && config.clientId);
  }

  /**
   * Get all configured providers
   */
  getConfiguredProviders(): OAuth2ProviderConfig[] {
    return Array.from(this.providers.values()).filter(config => config.clientId);
  }

  /**
   * Get all available providers (configured or not)
   */
  getAllProviders(): OAuth2ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that need setup
   */
  getProvidersNeedingSetup(): OAuth2ProviderSetup[] {
    return Array.from(this.providers.values())
      .filter(config => !config.clientId)
      .map(config => this.setupInstructions.get(config.providerId)!)
      .filter(setup => setup);
  }

  /**
   * Update provider configuration (runtime)
   */
  updateProviderConfig(providerId: string, updates: Partial<OAuth2ProviderConfig>): void {
    const existing = this.providers.get(providerId);
    if (existing) {
      this.providers.set(providerId, { ...existing, ...updates });
      log.info(`Updated configuration for provider: ${providerId}`);
    }
  }

  /**
   * Add custom provider configuration
   */
  addCustomProvider(config: OAuth2ProviderConfig): void {
    this.providers.set(config.providerId, config);
    log.info(`Added custom provider: ${config.providerId}`);
  }

  /**
   * Generate authorization URL for a provider
   */
  generateAuthorizationUrl(providerId: string, state: string, codeChallenge?: string): string {
    const config = this.providers.get(providerId);
    if (!config) {
      throw new Error(`Provider configuration not found: ${providerId}`);
    }

    if (!config.clientId) {
      throw new Error(`OAuth client ID not configured for ${providerId}. Please check your environment variables.`);
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline', // For refresh tokens
      prompt: 'consent' // Force consent screen
    });

    // Add PKCE challenge if provided
    if (codeChallenge) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${config.authUrl}?${params.toString()}`;
  }

  /**
   * Get provider configuration summary for logging
   */
  getConfigurationSummary(): Record<string, { configured: boolean; name: string }> {
    const summary: Record<string, { configured: boolean; name: string }> = {};
    
    for (const [providerId, config] of this.providers.entries()) {
      summary[providerId] = {
        configured: !!config.clientId,
        name: config.name
      };
    }

    return summary;
  }

  /**
   * Validate provider configuration
   */
  validateProviderConfig(providerId: string): { valid: boolean; errors: string[] } {
    const config = this.providers.get(providerId);
    if (!config) {
      return { valid: false, errors: [`Provider ${providerId} not found`] };
    }

    const errors: string[] = [];

    if (!config.clientId) errors.push('Client ID is required');
    if (config.requiresClientSecret && !config.clientSecret) errors.push('Client Secret is required');
    if (!config.authUrl) errors.push('Authorization URL is required');
    if (!config.tokenUrl) errors.push('Token URL is required');
    if (!config.scopes || config.scopes.length === 0) errors.push('At least one scope is required');

    return { valid: errors.length === 0, errors };
  }
}

// Export singleton instance
export const oAuth2ProviderConfig = OAuth2ProviderConfigManager.getInstance();
export default oAuth2ProviderConfig;