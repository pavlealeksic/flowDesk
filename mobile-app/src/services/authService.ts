/**
 * Mobile Authentication Service - OAuth2 flows with system browser
 * 
 * Handles secure OAuth2 authentication for Gmail, Outlook, and other providers
 * using the system browser with proper security measures and mobile-optimized UX.
 * Supports both mail and calendar authentication.
 */

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import type { MailProvider } from '@flow-desk/shared';
import type { CalendarProvider } from '@flow-desk/shared/types/calendar';

// OAuth2 configuration for different providers
const OAUTH_CONFIGS = {
  // Mail providers
  gmail: {
    discoveryDocument: 'https://accounts.google.com/.well-known/openid-configuration',
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    additionalParameters: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  },
  outlook: {
    discoveryDocument: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '',
    scopes: [
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/MailboxSettings.ReadWrite',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ],
    additionalParameters: {
      response_mode: 'query',
    },
  },
  
  // Calendar providers
  google: {
    discoveryDocument: 'https://accounts.google.com/.well-known/openid-configuration',
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    additionalParameters: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  },
  microsoft: {
    discoveryDocument: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '',
    scopes: [
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Calendars.ReadWrite.Shared',
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ],
    additionalParameters: {
      response_mode: 'query',
    },
  },
} as const;

interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
  userInfo?: {
    email: string;
    name?: string;
    picture?: string;
  };
}

interface StoredCredentials {
  provider: MailProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
  name?: string;
  accountId: string;
}

interface StoredCalendarCredentials {
  provider: CalendarProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email: string;
  name?: string;
  accountId: string;
}

export class MobileAuthService {
  private static instance: MobileAuthService | null = null;
  private authRequests: Map<string, AuthSession.AuthRequest> = new Map();

  static getInstance(): MobileAuthService {
    if (!MobileAuthService.instance) {
      MobileAuthService.instance = new MobileAuthService();
    }
    return MobileAuthService.instance;
  }

  constructor() {
    WebBrowser.maybeCompleteAuthSession();
  }

  /**
   * Start OAuth2 authentication flow for a mail provider
   */
  async authenticateAccount(provider: MailProvider): Promise<AuthResult> {
    if (!OAUTH_CONFIGS[provider as keyof typeof OAUTH_CONFIGS]) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const config = OAUTH_CONFIGS[provider as keyof typeof OAUTH_CONFIGS];

    try {
      // Create redirect URI
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'flowdesk',
        path: 'auth',
      });

      console.log('OAuth redirect URI:', redirectUri);

      // Create auth request
      const authRequest = new AuthSession.AuthRequest({
        clientId: config.clientId,
        scopes: config.scopes,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        additionalParameters: config.additionalParameters,
        usePKCE: true, // Use PKCE for security
      });

      // Load discovery document
      const discovery = await AuthSession.fetchDiscoveryAsync(config.discoveryDocument);

      // Prompt for authentication
      const authResult = await authRequest.promptAsync(discovery, {
        useProxy: false, // Use system browser for better security
        showInRecents: false,
        preferEphemeralSession: false, // Allow session reuse for better UX
      });

      if (authResult.type === 'success') {
        // Exchange code for tokens
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: config.clientId,
            code: authResult.params.code,
            redirectUri,
            extraParams: {
              code_verifier: authRequest.codeVerifier!,
            },
          },
          discovery
        );

        // Get user info
        const userInfo = await this.getUserInfo(provider, tokenResult.accessToken);

        const result: AuthResult = {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          idToken: tokenResult.idToken,
          tokenType: tokenResult.tokenType || 'Bearer',
          expiresIn: tokenResult.expiresIn || 3600,
          scope: tokenResult.scope || config.scopes.join(' '),
          userInfo,
        };

        return result;
      } else if (authResult.type === 'error') {
        throw new Error(`Authentication failed: ${authResult.error?.message || 'Unknown error'}`);
      } else {
        throw new Error('Authentication was cancelled by user');
      }
    } catch (error) {
      console.error('OAuth authentication error:', error);
      throw error;
    }
  }

  /**
   * Start OAuth2 authentication flow for a calendar provider
   */
  async authenticateCalendarAccount(provider: CalendarProvider): Promise<AuthResult> {
    // Map calendar provider to oauth config key
    let configKey: keyof typeof OAUTH_CONFIGS;
    switch (provider) {
      case 'google':
        configKey = 'google';
        break;
      case 'outlook':
        configKey = 'microsoft';
        break;
      default:
        throw new Error(`Unsupported calendar provider: ${provider}`);
    }

    const config = OAUTH_CONFIGS[configKey];

    try {
      // Create redirect URI
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'flowdesk',
        path: 'calendar-auth',
      });

      console.log('Calendar OAuth redirect URI:', redirectUri);

      // Create auth request
      const authRequest = new AuthSession.AuthRequest({
        clientId: config.clientId,
        scopes: config.scopes,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        additionalParameters: config.additionalParameters,
        usePKCE: true, // Use PKCE for security
      });

      // Load discovery document
      const discovery = await AuthSession.fetchDiscoveryAsync(config.discoveryDocument);

      // Prompt for authentication
      const authResult = await authRequest.promptAsync(discovery, {
        useProxy: false, // Use system browser for better security
        showInRecents: false,
        preferEphemeralSession: false, // Allow session reuse for better UX
      });

      if (authResult.type === 'success') {
        // Exchange code for tokens
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: config.clientId,
            code: authResult.params.code,
            redirectUri,
            extraParams: {
              code_verifier: authRequest.codeVerifier!,
            },
          },
          discovery
        );

        // Get user info
        const userInfo = await this.getCalendarUserInfo(provider, tokenResult.accessToken);

        const result: AuthResult = {
          accessToken: tokenResult.accessToken,
          refreshToken: tokenResult.refreshToken,
          idToken: tokenResult.idToken,
          tokenType: tokenResult.tokenType || 'Bearer',
          expiresIn: tokenResult.expiresIn || 3600,
          scope: tokenResult.scope || config.scopes.join(' '),
          userInfo,
        };

        return result;
      } else if (authResult.type === 'error') {
        throw new Error(`Calendar authentication failed: ${authResult.error?.message || 'Unknown error'}`);
      } else {
        throw new Error('Calendar authentication was cancelled by user');
      }
    } catch (error) {
      console.error('Calendar OAuth authentication error:', error);
      throw error;
    }
  }

  /**
   * Get calendar user information from the provider
   */
  private async getCalendarUserInfo(provider: CalendarProvider, accessToken: string): Promise<AuthResult['userInfo']> {
    try {
      let userInfoUrl: string;
      let headers: HeadersInit = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      };

      switch (provider) {
        case 'google':
          userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
          break;
        case 'outlook':
          userInfoUrl = 'https://graph.microsoft.com/v1.0/me';
          break;
        default:
          return undefined;
      }

      const response = await fetch(userInfoUrl, { headers });
      
      if (!response.ok) {
        console.warn('Failed to fetch calendar user info:', response.statusText);
        return undefined;
      }

      const data = await response.json();

      switch (provider) {
        case 'google':
          return {
            email: data.email,
            name: data.name,
            picture: data.picture,
          };
        case 'outlook':
          return {
            email: data.mail || data.userPrincipalName,
            name: data.displayName,
          };
        default:
          return undefined;
      }
    } catch (error) {
      console.warn('Error fetching calendar user info:', error);
      return undefined;
    }
  }

  /**
   * Get user information from the provider
   */
  private async getUserInfo(provider: MailProvider, accessToken: string): Promise<AuthResult['userInfo']> {
    try {
      let userInfoUrl: string;
      let headers: HeadersInit = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      };

      switch (provider) {
        case 'gmail':
          userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
          break;
        case 'outlook':
          userInfoUrl = 'https://graph.microsoft.com/v1.0/me';
          break;
        default:
          return undefined;
      }

      const response = await fetch(userInfoUrl, { headers });
      
      if (!response.ok) {
        console.warn('Failed to fetch user info:', response.statusText);
        return undefined;
      }

      const data = await response.json();

      switch (provider) {
        case 'gmail':
          return {
            email: data.email,
            name: data.name,
            picture: data.picture,
          };
        case 'outlook':
          return {
            email: data.mail || data.userPrincipalName,
            name: data.displayName,
          };
        default:
          return undefined;
      }
    } catch (error) {
      console.warn('Error fetching user info:', error);
      return undefined;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(provider: MailProvider, refreshToken: string): Promise<AuthResult> {
    const config = OAUTH_CONFIGS[provider as keyof typeof OAUTH_CONFIGS];
    
    if (!config) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    try {
      const discovery = await AuthSession.fetchDiscoveryAsync(config.discoveryDocument);

      const tokenResult = await AuthSession.refreshAsync(
        {
          clientId: config.clientId,
          refreshToken,
        },
        discovery
      );

      const result: AuthResult = {
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || refreshToken, // Keep original if not provided
        tokenType: tokenResult.tokenType || 'Bearer',
        expiresIn: tokenResult.expiresIn || 3600,
        scope: tokenResult.scope || config.scopes.join(' '),
      };

      return result;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Store credentials securely with biometric protection
   */
  async storeCredentials(accountId: string, provider: MailProvider, authResult: AuthResult): Promise<void> {
    const credentials: StoredCredentials = {
      provider,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: Date.now() + (authResult.expiresIn * 1000),
      email: authResult.userInfo?.email || '',
      name: authResult.userInfo?.name,
      accountId,
    };

    try {
      // Check if biometric authentication is available
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasBiometrics = biometricTypes.length > 0;

      const secureStoreOptions: SecureStore.SecureStoreOptions = {
        requireAuthentication: hasBiometrics,
        authenticationPrompt: 'Authenticate to access your mail accounts',
        keychainService: 'flowdesk-mail-credentials',
      };

      if (Platform.OS === 'android') {
        secureStoreOptions.encryptionCipher = SecureStore.ENCRYPTION_CIPHER.AES_GCM;
      }

      await SecureStore.setItemAsync(
        `mail_credentials_${accountId}`,
        JSON.stringify(credentials),
        secureStoreOptions
      );

      console.log('Credentials stored securely for account:', accountId);
    } catch (error) {
      console.error('Error storing credentials:', error);
      throw new Error('Failed to store credentials securely');
    }
  }

  /**
   * Store calendar credentials securely with biometric protection
   */
  async storeCalendarCredentials(accountId: string, provider: CalendarProvider, authResult: AuthResult): Promise<void> {
    const credentials: StoredCalendarCredentials = {
      provider,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: Date.now() + (authResult.expiresIn * 1000),
      email: authResult.userInfo?.email || '',
      name: authResult.userInfo?.name,
      accountId,
    };

    try {
      // Check if biometric authentication is available
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasBiometrics = biometricTypes.length > 0;

      const secureStoreOptions: SecureStore.SecureStoreOptions = {
        requireAuthentication: hasBiometrics,
        authenticationPrompt: 'Authenticate to access your calendar accounts',
        keychainService: 'flowdesk-calendar-credentials',
      };

      if (Platform.OS === 'android') {
        secureStoreOptions.encryptionCipher = SecureStore.ENCRYPTION_CIPHER.AES_GCM;
      }

      await SecureStore.setItemAsync(
        `calendar_credentials_${accountId}`,
        JSON.stringify(credentials),
        secureStoreOptions
      );

      console.log('Calendar credentials stored securely for account:', accountId);
    } catch (error) {
      console.error('Error storing calendar credentials:', error);
      throw new Error('Failed to store calendar credentials securely');
    }
  }

  /**
   * Retrieve stored calendar credentials with biometric authentication
   */
  async getStoredCalendarCredentials(accountId: string): Promise<StoredCalendarCredentials | null> {
    try {
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasBiometrics = biometricTypes.length > 0;

      const secureStoreOptions: SecureStore.SecureStoreOptions = {
        requireAuthentication: hasBiometrics,
        authenticationPrompt: 'Authenticate to access your calendar accounts',
        keychainService: 'flowdesk-calendar-credentials',
      };

      const credentialsJson = await SecureStore.getItemAsync(
        `calendar_credentials_${accountId}`,
        secureStoreOptions
      );

      if (!credentialsJson) {
        return null;
      }

      const credentials: StoredCalendarCredentials = JSON.parse(credentialsJson);

      // Check if token needs refresh
      if (credentials.expiresAt <= Date.now() + (5 * 60 * 1000)) { // 5 minutes buffer
        if (credentials.refreshToken) {
          try {
            const refreshedAuth = await this.refreshCalendarAccessToken(credentials.provider, credentials.refreshToken);
            
            // Update stored credentials
            const updatedCredentials: StoredCalendarCredentials = {
              ...credentials,
              accessToken: refreshedAuth.accessToken,
              refreshToken: refreshedAuth.refreshToken || credentials.refreshToken,
              expiresAt: Date.now() + (refreshedAuth.expiresIn * 1000),
            };

            await SecureStore.setItemAsync(
              `calendar_credentials_${accountId}`,
              JSON.stringify(updatedCredentials),
              secureStoreOptions
            );

            return updatedCredentials;
          } catch (error) {
            console.error('Calendar token refresh failed:', error);
            // Return expired credentials, let the calling code handle re-authentication
            return credentials;
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Error retrieving calendar credentials:', error);
      return null;
    }
  }

  /**
   * Remove stored calendar credentials
   */
  async removeStoredCalendarCredentials(accountId: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(`calendar_credentials_${accountId}`);
      console.log('Calendar credentials removed for account:', accountId);
    } catch (error) {
      console.error('Error removing calendar credentials:', error);
    }
  }

  /**
   * Refresh calendar access token using refresh token
   */
  async refreshCalendarAccessToken(provider: CalendarProvider, refreshToken: string): Promise<AuthResult> {
    // Map calendar provider to oauth config key
    let configKey: keyof typeof OAUTH_CONFIGS;
    switch (provider) {
      case 'google':
        configKey = 'google';
        break;
      case 'outlook':
        configKey = 'microsoft';
        break;
      default:
        throw new Error(`Unsupported calendar provider: ${provider}`);
    }

    const config = OAUTH_CONFIGS[configKey];
    
    if (!config) {
      throw new Error(`Unsupported calendar provider: ${provider}`);
    }

    try {
      const discovery = await AuthSession.fetchDiscoveryAsync(config.discoveryDocument);

      const tokenResult = await AuthSession.refreshAsync(
        {
          clientId: config.clientId,
          refreshToken,
        },
        discovery
      );

      const result: AuthResult = {
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken || refreshToken, // Keep original if not provided
        tokenType: tokenResult.tokenType || 'Bearer',
        expiresIn: tokenResult.expiresIn || 3600,
        scope: tokenResult.scope || config.scopes.join(' '),
      };

      return result;
    } catch (error) {
      console.error('Calendar token refresh error:', error);
      throw error;
    }
  }

  /**
   * Retrieve stored credentials with biometric authentication
   */
  async getStoredCredentials(accountId: string): Promise<StoredCredentials | null> {
    try {
      const biometricTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasBiometrics = biometricTypes.length > 0;

      const secureStoreOptions: SecureStore.SecureStoreOptions = {
        requireAuthentication: hasBiometrics,
        authenticationPrompt: 'Authenticate to access your mail accounts',
        keychainService: 'flowdesk-mail-credentials',
      };

      const credentialsJson = await SecureStore.getItemAsync(
        `mail_credentials_${accountId}`,
        secureStoreOptions
      );

      if (!credentialsJson) {
        return null;
      }

      const credentials: StoredCredentials = JSON.parse(credentialsJson);

      // Check if token needs refresh
      if (credentials.expiresAt <= Date.now() + (5 * 60 * 1000)) { // 5 minutes buffer
        if (credentials.refreshToken) {
          try {
            const refreshedAuth = await this.refreshAccessToken(credentials.provider, credentials.refreshToken);
            
            // Update stored credentials
            const updatedCredentials: StoredCredentials = {
              ...credentials,
              accessToken: refreshedAuth.accessToken,
              refreshToken: refreshedAuth.refreshToken || credentials.refreshToken,
              expiresAt: Date.now() + (refreshedAuth.expiresIn * 1000),
            };

            await SecureStore.setItemAsync(
              `mail_credentials_${accountId}`,
              JSON.stringify(updatedCredentials),
              secureStoreOptions
            );

            return updatedCredentials;
          } catch (error) {
            console.error('Token refresh failed:', error);
            // Return expired credentials, let the calling code handle re-authentication
            return credentials;
          }
        }
      }

      return credentials;
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      return null;
    }
  }

  /**
   * Remove stored credentials
   */
  async removeStoredCredentials(accountId: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(`mail_credentials_${accountId}`);
      console.log('Credentials removed for account:', accountId);
    } catch (error) {
      console.error('Error removing credentials:', error);
    }
  }

  /**
   * Check if biometric authentication is available
   */
  async isBiometricAuthenticationAvailable(): Promise<{
    available: boolean;
    types: LocalAuthentication.AuthenticationType[];
    enrolled: boolean;
  }> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      return {
        available: compatible && enrolled,
        types,
        enrolled,
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        available: false,
        types: [],
        enrolled: false,
      };
    }
  }

  /**
   * Authenticate using biometrics before accessing sensitive data
   */
  async authenticateWithBiometrics(reason: string = 'Authenticate to continue'): Promise<boolean> {
    try {
      const { available } = await this.isBiometricAuthenticationAvailable();
      
      if (!available) {
        return true; // Skip if not available
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }

  /**
   * Validate token and check if re-authentication is needed
   */
  async validateToken(provider: MailProvider, accessToken: string): Promise<boolean> {
    try {
      let validationUrl: string;
      
      switch (provider) {
        case 'gmail':
          validationUrl = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`;
          break;
        case 'outlook':
          validationUrl = 'https://graph.microsoft.com/v1.0/me';
          break;
        default:
          return false;
      }

      const response = await fetch(validationUrl, {
        headers: provider === 'outlook' ? {
          'Authorization': `Bearer ${accessToken}`,
        } : undefined,
      });

      return response.ok;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Get all stored account credentials
   */
  async getAllStoredCredentials(): Promise<StoredCredentials[]> {
    // This is a simplified implementation
    // In production, you'd maintain an index of account IDs
    try {
      const credentials: StoredCredentials[] = [];
      // Implementation would iterate through all stored credentials
      return credentials;
    } catch (error) {
      console.error('Error getting all credentials:', error);
      return [];
    }
  }

  /**
   * Handle deep link from OAuth redirect
   */
  async handleAuthRedirect(url: string): Promise<void> {
    try {
      WebBrowser.maybeCompleteAuthSession();
      // The auth session will handle the redirect automatically
    } catch (error) {
      console.error('Error handling auth redirect:', error);
    }
  }

  /**
   * Sign out and remove credentials for an account
   */
  async signOut(accountId: string): Promise<void> {
    try {
      await this.removeStoredCredentials(accountId);
      
      // Optionally revoke the token with the provider
      const credentials = await this.getStoredCredentials(accountId);
      if (credentials) {
        await this.revokeToken(credentials.provider, credentials.accessToken);
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  /**
   * Revoke token with the OAuth provider
   */
  private async revokeToken(provider: MailProvider, accessToken: string): Promise<void> {
    try {
      let revokeUrl: string;
      
      switch (provider) {
        case 'gmail':
          revokeUrl = `https://oauth2.googleapis.com/revoke?token=${accessToken}`;
          break;
        case 'outlook':
          // Microsoft doesn't have a simple revoke endpoint, tokens expire naturally
          return;
        default:
          return;
      }

      await fetch(revokeUrl, { method: 'POST' });
    } catch (error) {
      console.warn('Error revoking token:', error);
      // Not critical if this fails
    }
  }

  /**
   * Get OAuth redirect URI for the current app
   */
  getRedirectUri(): string {
    return AuthSession.makeRedirectUri({
      scheme: 'flowdesk',
      path: 'auth',
    });
  }

  /**
   * Check if provider is supported
   */
  isProviderSupported(provider: string): boolean {
    return provider in OAUTH_CONFIGS;
  }
}

// Singleton export
export const authService = MobileAuthService.getInstance();

// Helper functions
export const authenticateMailAccount = (provider: MailProvider) => 
  authService.authenticateAccount(provider);

export const getMailCredentials = (accountId: string) => 
  authService.getStoredCredentials(accountId);

export const removeMailCredentials = (accountId: string) => 
  authService.removeStoredCredentials(accountId);

export const isBiometricAvailable = () => 
  authService.isBiometricAuthenticationAvailable();

export const authenticateWithBiometrics = (reason?: string) => 
  authService.authenticateWithBiometrics(reason);

// Calendar-specific helper functions
export const authenticateCalendarAccount = (provider: CalendarProvider) => 
  authService.authenticateCalendarAccount(provider);

export const getCalendarCredentials = (accountId: string) => 
  authService.getStoredCalendarCredentials(accountId);

export const removeCalendarCredentials = (accountId: string) => 
  authService.removeStoredCalendarCredentials(accountId);

export const storeCalendarCredentials = (accountId: string, provider: CalendarProvider, authResult: AuthResult) =>
  authService.storeCalendarCredentials(accountId, provider, authResult);

export const refreshCalendarToken = (provider: CalendarProvider, refreshToken: string) =>
  authService.refreshCalendarAccessToken(provider, refreshToken);