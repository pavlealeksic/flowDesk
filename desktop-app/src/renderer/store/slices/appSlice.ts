import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { AppSettings } from '../../types/preload'
// FlowDeskAPI type is defined globally in preload script

interface SystemInfo {
  platform: string
  arch: string
  version: string
  deviceId: string
  isDarkMode: boolean
  isHighContrast: boolean
}

interface AppState {
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  systemInfo: SystemInfo | null
  settings: Partial<AppSettings>
  windowFocused: boolean
  onlineStatus: boolean
  keyboardShortcuts: Record<string, string>
  menuActions: Array<{ action: string; timestamp: number }>
  protocolUrls: Array<{ url: string; timestamp: number }>
  updateInfo: {
    available: boolean
    downloading: boolean
    downloadProgress: number
    downloaded: boolean
    info: Record<string, unknown> | null
  }
}

const initialState: AppState = {
  isInitialized: false,
  isLoading: false,
  error: null,
  systemInfo: null,
  settings: {},
  windowFocused: true,
  onlineStatus: true,
  keyboardShortcuts: {},
  menuActions: [],
  protocolUrls: [],
  updateInfo: {
    available: false,
    downloading: false,
    downloadProgress: 0,
    downloaded: false,
    info: null
  }
}

// Async thunks
export const initializeApp = createAsyncThunk(
  'app/initialize',
  async () => {
    const [systemInfo, settings] = await Promise.all([
      window.flowDesk.system.getInfo(),
      window.flowDesk.settings.get()
    ])
    
    return { systemInfo, settings }
  }
)

export const updateSetting = createAsyncThunk(
  'app/updateSetting',
  async ({ key, value }: { key: string; value: unknown }) => {
    const success = await window.flowDesk.settings.set(key, value)
    if (!success) {
      throw new Error(`Failed to update setting: ${key}`)
    }
    return { key, value }
  }
)

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setWindowFocused: (state, action: PayloadAction<boolean>) => {
      state.windowFocused = action.payload
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.onlineStatus = action.payload
    },
    addMenuAction: (state, action: PayloadAction<{ action: string }>) => {
      state.menuActions.unshift({
        ...action.payload,
        timestamp: Date.now()
      })
      // Keep only last 100 menu actions
      if (state.menuActions.length > 100) {
        state.menuActions = state.menuActions.slice(0, 100)
      }
    },
    addProtocolUrl: (state, action: PayloadAction<{ url: string }>) => {
      state.protocolUrls.unshift({
        ...action.payload,
        timestamp: Date.now()
      })
      // Keep only last 50 protocol URLs
      if (state.protocolUrls.length > 50) {
        state.protocolUrls = state.protocolUrls.slice(0, 50)
      }
    },
    setUpdateAvailable: (state, action: PayloadAction<any>) => {
      state.updateInfo.available = true
      state.updateInfo.info = action.payload
    },
    setUpdateDownloadProgress: (state, action: PayloadAction<number>) => {
      state.updateInfo.downloading = true
      state.updateInfo.downloadProgress = action.payload
    },
    setUpdateDownloaded: (state, action: PayloadAction<any>) => {
      state.updateInfo.downloaded = true
      state.updateInfo.downloading = false
      state.updateInfo.info = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    setKeyboardShortcuts: (state, action: PayloadAction<Record<string, string>>) => {
      state.keyboardShortcuts = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeApp.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(initializeApp.fulfilled, (state, action) => {
        state.isLoading = false
        state.isInitialized = true
        state.systemInfo = action.payload.systemInfo
        state.settings = action.payload.settings
      })
      .addCase(initializeApp.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to initialize app'
      })
      .addCase(updateSetting.fulfilled, (state, action) => {
        state.settings[action.payload.key] = action.payload.value
      })
      .addCase(updateSetting.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update setting'
      })
  }
})

export const {
  setLoading,
  setError,
  setWindowFocused,
  setOnlineStatus,
  addMenuAction,
  addProtocolUrl,
  setUpdateAvailable,
  setUpdateDownloadProgress,
  setUpdateDownloaded,
  clearError,
  setKeyboardShortcuts
} = appSlice.actions

export default appSlice.reducer