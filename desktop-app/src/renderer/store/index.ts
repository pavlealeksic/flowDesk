import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'

// Import slices
import appSlice from './slices/appSlice'
import workspaceSlice from './slices/workspaceSlice'
import themeSlice from './slices/themeSlice'
import mailSlice from './slices/mailSlice'
import calendarSlice from './slices/calendarSlice'
import pluginSlice from './slices/pluginSlice'
import notificationSlice from './slices/notificationSlice'
import searchSlice from './slices/searchSlice'
import automationSlice from './slices/automationSlice'
import productivitySlice from './slices/productivitySlice'

export const store = configureStore({
  reducer: {
    app: appSlice,
    workspace: workspaceSlice,
    theme: themeSlice,
    mail: mailSlice,
    calendar: calendarSlice,
    plugin: pluginSlice,
    notification: notificationSlice,
    search: searchSlice,
    automation: automationSlice,
    productivity: productivitySlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector