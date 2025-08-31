import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { PluginInstallation, PluginManifest } from '@flow-desk/shared'

interface PluginState {
  installed: PluginInstallation[]
  available: PluginManifest[]
  activePlugins: string[]
  pinnedPlugins: string[]
  pluginPanels: Record<string, {
    id: string
    pluginId: string
    title: string
    visible: boolean
    position: 'sidebar' | 'bottom' | 'floating'
    size: { width?: number; height?: number }
  }>
  isLoading: boolean
  error: string | null
  marketplace: {
    categories: string[]
    searchQuery: string
    selectedCategory: string | null
    searchResults: PluginManifest[]
  }
}

const initialState: PluginState = {
  installed: [],
  available: [],
  activePlugins: [],
  pinnedPlugins: [],
  pluginPanels: {},
  isLoading: false,
  error: null,
  marketplace: {
    categories: [],
    searchQuery: '',
    selectedCategory: null,
    searchResults: []
  }
}

const pluginSlice = createSlice({
  name: 'plugin',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setActivePlugins: (state, action: PayloadAction<string[]>) => {
      state.activePlugins = action.payload
    },
    activatePlugin: (state, action: PayloadAction<string>) => {
      const pluginId = action.payload
      if (!state.activePlugins.includes(pluginId)) {
        state.activePlugins.push(pluginId)
      }
    },
    deactivatePlugin: (state, action: PayloadAction<string>) => {
      const pluginId = action.payload
      const index = state.activePlugins.indexOf(pluginId)
      if (index > -1) {
        state.activePlugins.splice(index, 1)
      }
    },
    setPinnedPlugins: (state, action: PayloadAction<string[]>) => {
      state.pinnedPlugins = action.payload
    },
    togglePinPlugin: (state, action: PayloadAction<string>) => {
      const pluginId = action.payload
      const index = state.pinnedPlugins.indexOf(pluginId)
      if (index > -1) {
        state.pinnedPlugins.splice(index, 1)
      } else {
        state.pinnedPlugins.push(pluginId)
      }
    },
    setMarketplaceSearchQuery: (state, action: PayloadAction<string>) => {
      state.marketplace.searchQuery = action.payload
    },
    setMarketplaceCategory: (state, action: PayloadAction<string | null>) => {
      state.marketplace.selectedCategory = action.payload
    },
    clearError: (state) => {
      state.error = null
    }
  }
})

export const {
  setLoading,
  setError,
  setActivePlugins,
  activatePlugin,
  deactivatePlugin,
  setPinnedPlugins,
  togglePinPlugin,
  setMarketplaceSearchQuery,
  setMarketplaceCategory,
  clearError
} = pluginSlice.actions

export default pluginSlice.reducer