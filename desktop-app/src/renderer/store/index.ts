import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'

// Import slices
import appSlice from './slices/appSlice'
import workspaceSlice from './slices/workspaceSlice'
import themeSlice from './slices/themeSlice'
import pluginSlice from './slices/pluginSlice'
import notificationSlice from './slices/notificationSlice'
import searchSlice from './slices/searchSlice'
// automationSlice removed to simplify the app
import productivitySlice from './slices/productivitySlice'
import performanceSlice from './slices/performanceSlice'

// Serialization helpers
const isSerializable = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') {
    return true
  }
  
  // Check for non-serializable objects
  if (
    value instanceof Date || 
    value instanceof RegExp || 
    value instanceof Error ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof Function ||
    (typeof value === 'object' && value.constructor && 
     value.constructor.name !== 'Object' && value.constructor.name !== 'Array')
  ) {
    return false
  }
  
  return true
}

export const store = configureStore({
  reducer: {
    app: appSlice,
    workspace: workspaceSlice,
    theme: themeSlice,
    plugin: pluginSlice,
    notification: notificationSlice,
    search: searchSlice,
    // automation: removed to simplify the app,
    productivity: productivitySlice,
    performance: performanceSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/REGISTER',
          'persist/PURGE',
          'persist/FLUSH',
          'persist/PAUSE',
        ],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp', 'payload.date'],
        // Ignore these paths in the state
        ignoredPaths: [
          'workspace.workspaces.*.created',
          'workspace.workspaces.*.lastAccessed',
          'workspace.workspaces.*.createdAt',
          'workspace.workspaces.*.updatedAt',
        ],
        // Custom serializable check
        isSerializable,
        // Additional options for production
        warnAfter: 128,
      },
      // Disable immutability check in production for performance
      immutableCheck: process.env.NODE_ENV !== 'production' ? {
        warnAfter: 128,
      } : false,
    }),
  devTools: process.env.NODE_ENV !== 'production' ? {
    maxAge: 50,
    trace: true,
    traceLimit: 25,
  } : false,
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector