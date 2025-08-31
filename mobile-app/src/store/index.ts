/**
 * Core Store - Zustand-based state management for Flow Desk Mobile
 * 
 * This is the main store that coordinates all domain-specific stores
 * and provides app-wide state management capabilities.
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { immer } from 'zustand/middleware/immer';

// Import domain stores
import { createAuthStore, type AuthSlice } from './slices/authSlice';
import { createWorkspaceStore, type WorkspaceSlice } from './slices/workspaceSlice';
import { createMailStore, type MailSlice } from './slices/mailSlice';
import { createCalendarStore, type CalendarSlice } from './slices/calendarSlice';
import { createNotificationStore, type NotificationSlice } from './slices/notificationSlice';
import { createSearchStore, type SearchSlice } from './slices/searchSlice';
import { createPluginStore, type PluginSlice } from './slices/pluginSlice';
import { createThemeStore, type ThemeSlice } from './slices/themeSlice';
import { createSyncStore, type SyncSlice } from './slices/syncSlice';

// Core app state interface
export interface AppState {
  // App-level state
  isInitialized: boolean;
  isOffline: boolean;
  lastSyncTime: number | null;
  
  // Action creators
  initialize: () => Promise<void>;
  setOfflineStatus: (isOffline: boolean) => void;
  updateLastSyncTime: (timestamp: number) => void;
}

// Combined store type
export type StoreState = AppState & 
  AuthSlice & 
  WorkspaceSlice & 
  MailSlice & 
  CalendarSlice & 
  NotificationSlice & 
  SearchSlice & 
  PluginSlice & 
  ThemeSlice & 
  SyncSlice;

// Create the main store with all slices
export const useStore = create<StoreState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get, api) => ({
          // App-level state
          isInitialized: false,
          isOffline: false,
          lastSyncTime: null,

          // App-level actions
          initialize: async () => {
            set((state) => {
              state.isInitialized = true;
            });
            
            // Initialize all subsystems
            await Promise.all([
              get().initializeAuth(),
              get().initializeWorkspaces(),
              get().initializeTheme(),
              get().initializeSync(),
            ]);
          },

          setOfflineStatus: (isOffline: boolean) => {
            set((state) => {
              state.isOffline = isOffline;
            });
          },

          updateLastSyncTime: (timestamp: number) => {
            set((state) => {
              state.lastSyncTime = timestamp;
            });
          },

          // Domain slices
          ...createAuthStore(set, get, api),
          ...createWorkspaceStore(set, get, api),
          ...createMailStore(set, get, api),
          ...createCalendarStore(set, get, api),
          ...createNotificationStore(set, get, api),
          ...createSearchStore(set, get, api),
          ...createPluginStore(set, get, api),
          ...createThemeStore(set, get, api),
          ...createSyncStore(set, get, api),
        })),
        {
          name: 'flow-desk-storage',
          storage: {
            getItem: async (name: string) => {
              const value = await AsyncStorage.getItem(name);
              return value ? JSON.parse(value) : null;
            },
            setItem: async (name: string, value: any) => {
              await AsyncStorage.setItem(name, JSON.stringify(value));
            },
            removeItem: async (name: string) => {
              await AsyncStorage.removeItem(name);
            },
          },
          // Only persist non-sensitive app state
          partialize: (state) => ({
            isInitialized: state.isInitialized,
            lastSyncTime: state.lastSyncTime,
            theme: state.theme,
            workspaces: state.workspaces,
            activeWorkspace: state.activeWorkspace,
            // Auth state is handled separately with secure storage
            // Mail/Calendar data is handled by sync system
          }),
        }
      )
    ),
    {
      name: 'flow-desk-store',
    }
  )
);

// Selectors for common state patterns
export const useIsInitialized = () => useStore(state => state.isInitialized);
export const useIsOffline = () => useStore(state => state.isOffline);
export const useLastSyncTime = () => useStore(state => state.lastSyncTime);

// Store initialization hook
export const useStoreInitialization = () => {
  const initialize = useStore(state => state.initialize);
  const isInitialized = useStore(state => state.isInitialized);
  
  return { initialize, isInitialized };
};