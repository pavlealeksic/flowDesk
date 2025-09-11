import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

interface ProductivityState {
  // UI state only
  ui: {
    showProductivityPanel: boolean
  }
}

const initialState: ProductivityState = {
  ui: {
    showProductivityPanel: false
  }
}

// Productivity slice with minimal functionality
const productivitySlice = createSlice({
  name: 'productivity',
  initialState,
  reducers: {
    // UI actions
    toggleProductivityPanel: (state) => {
      state.ui.showProductivityPanel = !state.ui.showProductivityPanel
    },
    openProductivityPanel: (state) => {
      state.ui.showProductivityPanel = true
    },
    closeProductivityPanel: (state) => {
      state.ui.showProductivityPanel = false
    },
  }
})

// Actions
export const {
  toggleProductivityPanel,
  openProductivityPanel,
  closeProductivityPanel,
} = productivitySlice.actions

// Selectors
export const selectProductivityUI = (state: RootState) => state.productivity.ui
export const selectShowProductivityPanel = (state: RootState) => state.productivity.ui.showProductivityPanel

// Placeholder selectors for compatibility (empty implementations)
export const selectTemplates = (state: RootState) => []
export const selectTemplateCategories = (state: RootState) => []
export const selectIsLoadingTemplates = (state: RootState) => false
export const selectTemplatesError = (state: RootState) => null
export const selectSnippets = (state: RootState) => []
export const selectSnippetCategories = (state: RootState) => []
export const selectSnippetsByCategory = (state: RootState, category: string) => []
export const selectIsLoadingSnippets = (state: RootState) => false
export const selectSnippetsError = (state: RootState) => null
export const selectRules = (state: RootState) => []
export const selectIsLoadingRules = (state: RootState) => false
export const selectMeetingInvites = (state: RootState) => []
export const selectUnprocessedInvites = (state: RootState) => []
export const selectProductivitySettings = (state: RootState) => ({
  enableMeetingExtraction: false,
  enableCalendarIntegration: false,
  autoProcessInvites: false
})

// Default signature selector
export const selectDefaultSignature = (state: RootState) => {
  return {
    id: 'default',
    name: 'Default Signature',
    content: '',
    isDefault: true
  }
}

// Additional actions for compatibility (no-op implementations)
export const fetchTemplates = createAsyncThunk('productivity/fetchTemplates', async () => [])
export const saveTemplate = createAsyncThunk('productivity/saveTemplate', async (template: any) => template)
export const updateTemplate = createAsyncThunk('productivity/updateTemplate', async ({ id, updates }: { id: string; updates: any }) => ({ id, ...updates }))
export const deleteTemplate = createAsyncThunk('productivity/deleteTemplate', async (id: string) => id)
export const fetchSnippets = createAsyncThunk('productivity/fetchSnippets', async () => [])
export const saveSnippet = createAsyncThunk('productivity/saveSnippet', async (snippet: any) => ({ ...snippet, id: Date.now().toString() }))
export const updateSnippet = createAsyncThunk('productivity/updateSnippet', async ({ id, updates }: { id: string; updates: any }) => ({ id, ...updates }))
export const deleteSnippet = createAsyncThunk('productivity/deleteSnippet', async (id: string) => id)
export const incrementSnippetUsage = createAsyncThunk('productivity/incrementSnippetUsage', async (snippetId: string) => snippetId)
export const openTemplatesModal = createAsyncThunk('productivity/openTemplatesModal', async () => {})
export const closeTemplatesModal = createAsyncThunk('productivity/closeTemplatesModal', async () => {})
export const openRulesModal = createAsyncThunk('productivity/openRulesModal', async () => {})
export const closeRulesModal = createAsyncThunk('productivity/closeRulesModal', async () => {})
export const setSelectedTemplate = createAsyncThunk('productivity/setSelectedTemplate', async (template: string | null) => template)
export const incrementTemplateUsage = createAsyncThunk('productivity/incrementTemplateUsage', async (templateId: string) => templateId)
export const openSchedulerModal = createAsyncThunk('productivity/openSchedulerModal', async () => {})
export const extractMeetingInvite = createAsyncThunk('productivity/extractMeetingInvite', async (data: any) => data)
export const respondToMeetingInvite = createAsyncThunk('productivity/respondToMeetingInvite', async (data: any) => data)
export const createCalendarEvent = createAsyncThunk('productivity/createCalendarEvent', async (data: any) => data)

export { type ProductivityState }
export default productivitySlice.reducer