import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { ThemeSettings as ThemeConfig } from '@flow-desk/shared'

type ThemeMode = 'light' | 'dark' | 'auto'

interface ThemeState {
  mode: ThemeMode
  isDarkMode: boolean
  isHighContrast: boolean
  accentColor: string
  fontSize: 'small' | 'medium' | 'large'
  fontFamily: string
  customCSS: string
  animations: boolean
  transparency: boolean
  colorBlindMode: boolean
}

const initialState: ThemeState = {
  mode: 'dark',
  isDarkMode: true,
  isHighContrast: false,
  accentColor: '#0ea5e9',
  fontSize: 'medium',
  fontFamily: 'system',
  customCSS: '',
  animations: true,
  transparency: true,
  colorBlindMode: false
}

// Async thunks
export const loadThemeSettings = createAsyncThunk(
  'theme/loadThemeSettings',
  async () => {
    const themeInfo = await (window.flowDesk as any)?.theme?.get()
    const settings = await (window.flowDesk as any)?.settings?.get()
    
    return {
      ...themeInfo,
      accentColor: settings.theme?.accentColor || '#0ea5e9',
      fontSize: settings.theme?.fontSize || 'medium',
      fontFamily: settings.theme?.fontFamily || 'system',
      customCSS: settings.theme?.customCSS || '',
      animations: settings.theme?.animations !== false,
      transparency: settings.theme?.transparency !== false,
      colorBlindMode: settings.theme?.colorBlindMode || false
    }
  }
)

export const setThemeMode = createAsyncThunk(
  'theme/setThemeMode',
  async (mode: ThemeMode) => {
    const themeConfig: ThemeConfig = {
      mode: mode,
      accentColor: '#007acc',
      fontSize: 'medium' as const,
      fontFamily: 'system',
      highContrast: false,
      colorBlindFriendly: false
    };
    await (window.flowDesk as any)?.theme?.set(themeConfig)
    return mode
  }
)

export const updateThemeSetting = createAsyncThunk(
  'theme/updateThemeSetting',
  async ({ key, value }: { key: string; value: unknown }) => {
    const success = await (window.flowDesk as any)?.settings?.set(`theme.${key}`, value)
    if (!success) {
      throw new Error(`Failed to update theme setting: ${key}`)
    }
    return { key, value }
  }
)

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setIsDarkMode: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload
      document.documentElement.classList.toggle('dark', action.payload)
    },
    setIsHighContrast: (state, action: PayloadAction<boolean>) => {
      state.isHighContrast = action.payload
      document.documentElement.classList.toggle('high-contrast', action.payload)
    },
    applyTheme: (state) => {
      // Apply theme to DOM
      document.documentElement.classList.toggle('dark', state.isDarkMode)
      document.documentElement.classList.toggle('high-contrast', state.isHighContrast)
      document.documentElement.classList.toggle('reduced-motion', !state.animations)
      document.documentElement.classList.toggle('color-blind', state.colorBlindMode)
      
      // Set CSS variables
      document.documentElement.style.setProperty('--accent-color', state.accentColor)
      document.documentElement.style.setProperty('--font-size-base', 
        state.fontSize === 'small' ? '14px' : state.fontSize === 'large' ? '18px' : '16px')
      
      // Apply font family
      if (state.fontFamily !== 'system') {
        document.documentElement.style.setProperty('--font-family-sans', state.fontFamily)
      }
      
      // Apply custom CSS
      let customStyleElement = document.getElementById('flow-desk-custom-css') as HTMLStyleElement
      if (!customStyleElement) {
        customStyleElement = document.createElement('style')
        customStyleElement.id = 'flow-desk-custom-css'
        document.head.appendChild(customStyleElement)
      }
      customStyleElement.textContent = state.customCSS
    },
    setAccentColor: (state, action: PayloadAction<string>) => {
      state.accentColor = action.payload
      document.documentElement.style.setProperty('--accent-color', action.payload)
    },
    setFontSize: (state, action: PayloadAction<'small' | 'medium' | 'large'>) => {
      state.fontSize = action.payload
      const sizeValue = action.payload === 'small' ? '14px' : action.payload === 'large' ? '18px' : '16px'
      document.documentElement.style.setProperty('--font-size-base', sizeValue)
    },
    setFontFamily: (state, action: PayloadAction<string>) => {
      state.fontFamily = action.payload
      if (action.payload !== 'system') {
        document.documentElement.style.setProperty('--font-family-sans', action.payload)
      } else {
        document.documentElement.style.removeProperty('--font-family-sans')
      }
    },
    setCustomCSS: (state, action: PayloadAction<string>) => {
      state.customCSS = action.payload
      let customStyleElement = document.getElementById('flow-desk-custom-css') as HTMLStyleElement
      if (!customStyleElement) {
        customStyleElement = document.createElement('style')
        customStyleElement.id = 'flow-desk-custom-css'
        document.head.appendChild(customStyleElement)
      }
      customStyleElement.textContent = action.payload
    },
    setAnimations: (state, action: PayloadAction<boolean>) => {
      state.animations = action.payload
      document.documentElement.classList.toggle('reduced-motion', !action.payload)
    },
    setTransparency: (state, action: PayloadAction<boolean>) => {
      state.transparency = action.payload
      document.documentElement.classList.toggle('no-transparency', !action.payload)
    },
    setColorBlindMode: (state, action: PayloadAction<boolean>) => {
      state.colorBlindMode = action.payload
      document.documentElement.classList.toggle('color-blind', action.payload)
    },
    handleSystemThemeChange: (state, action: PayloadAction<{
      shouldUseDarkColors: boolean
      shouldUseHighContrastColors: boolean
    }>) => {
      if (state.mode === 'auto') {
        state.isDarkMode = action.payload.shouldUseDarkColors
        document.documentElement.classList.toggle('dark', action.payload.shouldUseDarkColors)
      }
      state.isHighContrast = action.payload.shouldUseHighContrastColors
      document.documentElement.classList.toggle('high-contrast', action.payload.shouldUseHighContrastColors)
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadThemeSettings.fulfilled, (state, action) => {
        Object.assign(state, action.payload)
      })
      .addCase(setThemeMode.fulfilled, (state, action) => {
        state.mode = action.payload
      })
      .addCase(updateThemeSetting.fulfilled, (state, action) => {
        const { key, value } = action.payload
        ;(state as any)[key] = value
      })
  }
})

export const {
  setIsDarkMode,
  setIsHighContrast,
  applyTheme,
  setAccentColor,
  setFontSize,
  setFontFamily,
  setCustomCSS,
  setAnimations,
  setTransparency,
  setColorBlindMode,
  handleSystemThemeChange
} = themeSlice.actions

export { type ThemeState }
export default themeSlice.reducer