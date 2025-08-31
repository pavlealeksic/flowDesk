/**
 * Authentication Store Slice - Manages user authentication and session
 */

import { StateCreator } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@flow-desk/shared';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface ProviderToken {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
}

export interface AuthUser extends User {
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified?: boolean;
  createdAt: Date;
  lastSignInAt?: Date;
}

export interface AuthSlice {
  // State
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  authError: string | null;
  providerTokens: ProviderToken[];
  
  // Actions
  initializeAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuthToken: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setAuthError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  
  // Provider token management
  addProviderToken: (token: ProviderToken) => Promise<void>;
  getProviderToken: (provider: string) => ProviderToken | null;
  refreshProviderToken: (provider: string) => Promise<void>;
  removeProviderToken: (provider: string) => Promise<void>;
  clearProviderTokens: () => Promise<void>;
}

// Secure storage keys
const AUTH_TOKEN_KEY = 'flow_desk_auth_token';
const REFRESH_TOKEN_KEY = 'flow_desk_refresh_token';
const PROVIDER_TOKENS_KEY = 'flow_desk_provider_tokens';

// Mock auth service - in production, this would connect to Clerk
class AuthService {
  static async signIn(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    // Mock implementation - replace with actual Clerk integration
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser: AuthUser = {
      id: 'user_123',
      email,
      firstName: 'John',
      lastName: 'Doe',
      name: 'John Doe',
      avatar: undefined,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastSignInAt: new Date(),
    };
    
    const mockTokens: AuthTokens = {
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    };
    
    return { user: mockUser, tokens: mockTokens };
  }
  
  static async signUp(email: string, password: string, firstName: string, lastName: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockUser: AuthUser = {
      id: 'user_' + Date.now(),
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      avatar: undefined,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };
    
    const mockTokens: AuthTokens = {
      accessToken: 'mock_access_token_new',
      refreshToken: 'mock_refresh_token_new',
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
    
    return { user: mockUser, tokens: mockTokens };
  }
  
  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      accessToken: 'refreshed_access_token',
      refreshToken: refreshToken, // In reality, this might change
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }
  
  static async validateToken(accessToken: string): Promise<AuthUser | null> {
    // Mock implementation
    if (accessToken.startsWith('mock_') || accessToken.startsWith('refreshed_')) {
      return {
        id: 'user_123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        avatar: undefined,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        lastSignInAt: new Date(),
      };
    }
    return null;
  }
}

export const createAuthStore: StateCreator<
  any,
  [],
  [],
  AuthSlice
> = (set, get) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  isLoading: false,
  authError: null,
  providerTokens: [],
  
  initializeAuth: async () => {
    set((state: any) => {
      state.isLoading = true;
      state.authError = null;
    });
    
    try {
      // Try to load stored auth token
      const storedAccessToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      
      if (storedAccessToken) {
        // Validate the stored token
        const user = await AuthService.validateToken(storedAccessToken);
        
        if (user) {
          set((state: any) => {
            state.isAuthenticated = true;
            state.user = user;
            state.isLoading = false;
          });
          
          // Load provider tokens
          const storedProviderTokens = await SecureStore.getItemAsync(PROVIDER_TOKENS_KEY);
          if (storedProviderTokens) {
            const providerTokens = JSON.parse(storedProviderTokens);
            set((state: any) => {
              state.providerTokens = providerTokens;
            });
          }
        } else if (storedRefreshToken) {
          // Try to refresh the token
          try {
            await get().refreshAuthToken();
          } catch (error) {
            // Refresh failed, sign out
            await get().signOut();
          }
        } else {
          // No valid token, sign out
          await get().signOut();
        }
      } else {
        set((state: any) => {
          state.isLoading = false;
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set((state: any) => {
        state.isLoading = false;
        state.authError = 'Failed to initialize authentication';
      });
    }
  },
  
  signIn: async (email: string, password: string) => {
    set((state: any) => {
      state.isLoading = true;
      state.authError = null;
    });
    
    try {
      const { user, tokens } = await AuthService.signIn(email, password);
      
      // Store tokens securely
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
      
      set((state: any) => {
        state.isAuthenticated = true;
        state.user = user;
        state.isLoading = false;
        state.authError = null;
      });
    } catch (error) {
      console.error('Sign in error:', error);
      set((state: any) => {
        state.isLoading = false;
        state.authError = error instanceof Error ? error.message : 'Sign in failed';
      });
    }
  },
  
  signUp: async (email: string, password: string, firstName: string, lastName: string) => {
    set((state: any) => {
      state.isLoading = true;
      state.authError = null;
    });
    
    try {
      const { user, tokens } = await AuthService.signUp(email, password, firstName, lastName);
      
      // Store tokens securely
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
      
      set((state: any) => {
        state.isAuthenticated = true;
        state.user = user;
        state.isLoading = false;
        state.authError = null;
      });
    } catch (error) {
      console.error('Sign up error:', error);
      set((state: any) => {
        state.isLoading = false;
        state.authError = error instanceof Error ? error.message : 'Sign up failed';
      });
    }
  },
  
  signOut: async () => {
    // Clear secure storage
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await get().clearProviderTokens();
    
    set((state: any) => {
      state.isAuthenticated = false;
      state.user = null;
      state.isLoading = false;
      state.authError = null;
      state.providerTokens = [];
    });
  },
  
  refreshAuthToken: async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const tokens = await AuthService.refreshToken(refreshToken);
      
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, tokens.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
      
      // Validate the new token to get updated user info
      const user = await AuthService.validateToken(tokens.accessToken);
      if (user) {
        set((state: any) => {
          state.user = user;
        });
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await get().signOut();
      throw error;
    }
  },
  
  setUser: (user: AuthUser | null) => {
    set((state: any) => {
      state.user = user;
    });
  },
  
  setAuthError: (error: string | null) => {
    set((state: any) => {
      state.authError = error;
    });
  },
  
  setLoading: (loading: boolean) => {
    set((state: any) => {
      state.isLoading = loading;
    });
  },
  
  addProviderToken: async (token: ProviderToken) => {
    set((state: any) => {
      const existingIndex = state.providerTokens.findIndex(
        (t: ProviderToken) => t.provider === token.provider
      );
      
      if (existingIndex >= 0) {
        state.providerTokens[existingIndex] = token;
      } else {
        state.providerTokens.push(token);
      }
    });
    
    // Persist to secure storage
    const currentTokens = get().providerTokens;
    await SecureStore.setItemAsync(PROVIDER_TOKENS_KEY, JSON.stringify(currentTokens));
  },
  
  getProviderToken: (provider: string) => {
    const tokens = get().providerTokens;
    return tokens.find(t => t.provider === provider) || null;
  },
  
  refreshProviderToken: async (provider: string) => {
    // This would be implemented based on the specific provider's refresh mechanism
    throw new Error('Provider token refresh not implemented');
  },
  
  removeProviderToken: async (provider: string) => {
    set((state: any) => {
      state.providerTokens = state.providerTokens.filter(
        (t: ProviderToken) => t.provider !== provider
      );
    });
    
    // Persist to secure storage
    const currentTokens = get().providerTokens;
    await SecureStore.setItemAsync(PROVIDER_TOKENS_KEY, JSON.stringify(currentTokens));
  },
  
  clearProviderTokens: async () => {
    set((state: any) => {
      state.providerTokens = [];
    });
    
    await SecureStore.deleteItemAsync(PROVIDER_TOKENS_KEY);
  },
});