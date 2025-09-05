import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../index'

// Types for email productivity features
interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'business' | 'personal' | 'follow-up' | 'meeting' | 'custom'
  variables: string[]
  isShared: boolean
  createdAt: Date
  updatedAt: Date
  usageCount: number
  accountId?: string
}

interface ProductivityState {
  // Email templates
  templates: EmailTemplate[]
  templateCategories: string[]
  isLoadingTemplates: boolean
  templatesError: string | null
  
  // Text snippets
  snippets: any[]
  snippetCategories: string[]
  isLoadingSnippets: boolean
  snippetsError: string | null
  
  // Email rules
  rules: any[]
  isLoadingRules: boolean
  rulesError: string | null
  
  // UI state
  ui: {
    showTemplatesModal: boolean
    showRulesModal: boolean
    showSnippetsPanel: boolean
    showSchedulerModal: boolean
    selectedTemplate: string | null
    templateSearchQuery: string
  }
}

const initialState: ProductivityState = {
  templates: [],
  templateCategories: ['business', 'personal', 'follow-up', 'meeting', 'custom'],
  isLoadingTemplates: false,
  templatesError: null,
  
  snippets: [],
  snippetCategories: ['common', 'signatures', 'closings', 'greetings'],
  isLoadingSnippets: false,
  snippetsError: null,
  
  rules: [],
  isLoadingRules: false,
  rulesError: null,
  
  ui: {
    showTemplatesModal: false,
    showRulesModal: false,
    showSnippetsPanel: false,
    showSchedulerModal: false,
    selectedTemplate: null,
    templateSearchQuery: ''
  }
}

// Async thunks
export const fetchTemplates = createAsyncThunk(
  'productivity/fetchTemplates',
  async (_, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.getAllTemplates) {
        throw new Error('Template API not available')
      }
      const templates = await window.flowDesk.mail.getAllTemplates()
      return templates
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch templates')
    }
  }
)

export const saveTemplate = createAsyncThunk(
  'productivity/saveTemplate',
  async (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.saveTemplate) {
        throw new Error('Template API not available')
      }
      const templateId = await window.flowDesk.mail.saveTemplate(template)
      const savedTemplate = await window.flowDesk.mail.getTemplate(templateId)
      return savedTemplate
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save template')
    }
  }
)

export const updateTemplate = createAsyncThunk(
  'productivity/updateTemplate',
  async ({ templateId, updates }: { templateId: string; updates: Partial<EmailTemplate> }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.updateTemplate) {
        throw new Error('Template API not available')
      }
      await window.flowDesk.mail.updateTemplate(templateId, updates)
      const updatedTemplate = await window.flowDesk.mail.getTemplate(templateId)
      return updatedTemplate
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update template')
    }
  }
)

export const deleteTemplate = createAsyncThunk(
  'productivity/deleteTemplate',
  async (templateId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.deleteTemplate) {
        throw new Error('Template API not available')
      }
      await window.flowDesk.mail.deleteTemplate(templateId)
      return templateId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete template')
    }
  }
)

// Real snippet async thunks - using actual backend
export const fetchSnippets = createAsyncThunk(
  'productivity/fetchSnippets',
  async (_, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.getAllSnippets) {
        throw new Error('Snippet API not available')
      }
      const snippets = await window.flowDesk.mail.getAllSnippets()
      return snippets
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch snippets')
    }
  }
)

export const saveSnippet = createAsyncThunk(
  'productivity/saveSnippet',
  async (snippet: any, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.saveSnippet) {
        throw new Error('Snippet API not available')
      }
      const snippetId = await window.flowDesk.mail.saveSnippet(snippet)
      // Return snippet data from save operation instead of calling getSnippet
      const savedSnippet = { ...snippet, id: snippetId }
      return savedSnippet
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save snippet')
    }
  }
)

export const updateSnippet = createAsyncThunk(
  'productivity/updateSnippet',
  async ({ snippetId, updates }: { snippetId: string; updates: any }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.updateSnippet) {
        throw new Error('Snippet API not available')
      }
      await window.flowDesk.mail.updateSnippet(snippetId, updates)
      // Return updated snippet data instead of calling getSnippet
      const updatedSnippet = { id: snippetId, ...updates }
      return updatedSnippet
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update snippet')
    }
  }
)

export const deleteSnippet = createAsyncThunk(
  'productivity/deleteSnippet',
  async (snippetId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.deleteSnippet) {
        throw new Error('Snippet API not available')
      }
      await window.flowDesk.mail.deleteSnippet(snippetId)
      return snippetId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete snippet')
    }
  }
)

export const incrementSnippetUsage = createAsyncThunk(
  'productivity/incrementSnippetUsage',
  async (snippetId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail?.useSnippet) {
        throw new Error('Snippet API not available')
      }
      await window.flowDesk.mail.useSnippet(snippetId)
      return snippetId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to increment snippet usage')
    }
  }
)

// Productivity slice
const productivitySlice = createSlice({
  name: 'productivity',
  initialState,
  reducers: {
    // UI actions
    openTemplatesModal: (state) => {
      state.ui.showTemplatesModal = true
    },
    closeTemplatesModal: (state) => {
      state.ui.showTemplatesModal = false
      state.ui.selectedTemplate = null
    },
    openRulesModal: (state) => {
      state.ui.showRulesModal = true
    },
    closeRulesModal: (state) => {
      state.ui.showRulesModal = false
    },
    toggleSnippetsPanel: (state) => {
      state.ui.showSnippetsPanel = !state.ui.showSnippetsPanel
    },
    setSelectedTemplate: (state, action: PayloadAction<string | null>) => {
      state.ui.selectedTemplate = action.payload
    },
    setTemplateSearchQuery: (state, action: PayloadAction<string>) => {
      state.ui.templateSearchQuery = action.payload
    },
    incrementTemplateUsage: (state, action: PayloadAction<string>) => {
      const template = state.templates.find(t => t.id === action.payload)
      if (template) {
        template.usageCount++
        template.updatedAt = new Date()
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.isLoadingTemplates = true
        state.templatesError = null
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.isLoadingTemplates = false
        state.templates = action.payload
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.isLoadingTemplates = false
        state.templatesError = action.payload as string
      })
      .addCase(saveTemplate.fulfilled, (state, action) => {
        if (action.payload) {
          state.templates.push(action.payload)
        }
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        if (action.payload) {
          const index = state.templates.findIndex(t => t.id === action.payload.id)
          if (index !== -1) {
            state.templates[index] = action.payload
          }
        }
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.templates = state.templates.filter(t => t.id !== action.payload)
      })
  }
})

// Actions
export const {
  openTemplatesModal,
  closeTemplatesModal,
  openRulesModal,
  closeRulesModal,
  toggleSnippetsPanel,
  setSelectedTemplate,
  setTemplateSearchQuery,
  incrementTemplateUsage
} = productivitySlice.actions

// Additional actions for compatibility
export const openSchedulerModal = openTemplatesModal
export const extractMeetingInvite = createAsyncThunk('productivity/extractMeetingInvite', async (data: any) => data)
export const respondToMeetingInvite = createAsyncThunk('productivity/respondToMeetingInvite', async (data: any) => data)
export const createCalendarEvent = createAsyncThunk('productivity/createCalendarEvent', async (data: any) => data)

// Selectors
export const selectTemplates = (state: RootState) => state.productivity.templates
export const selectTemplateCategories = (state: RootState) => state.productivity.templateCategories
export const selectIsLoadingTemplates = (state: RootState) => state.productivity.isLoadingTemplates
export const selectTemplatesError = (state: RootState) => state.productivity.templatesError

// Snippet selectors
export const selectSnippets = (state: RootState) => state.productivity.snippets
export const selectSnippetCategories = (state: RootState) => state.productivity.snippetCategories
export const selectSnippetsByCategory = (state: RootState, category: string) => 
  state.productivity.snippets.filter((s: any) => s.category === category)
export const selectIsLoadingSnippets = (state: RootState) => state.productivity.isLoadingSnippets

// Rules selectors
export const selectRules = (state: RootState) => state.productivity.rules
export const selectIsLoadingRules = (state: RootState) => state.productivity.isLoadingRules

// UI selectors
export const selectProductivityUI = (state: RootState) => state.productivity.ui
export const selectShowTemplatesModal = (state: RootState) => state.productivity.ui.showTemplatesModal
export const selectSelectedTemplate = (state: RootState) => state.productivity.ui.selectedTemplate
export const selectTemplateSearchQuery = (state: RootState) => state.productivity.ui.templateSearchQuery

// Default signature selector (placeholder)
export const selectDefaultSignature = (state: RootState) => {
  return {
    id: 'default',
    name: 'Default Signature',
    content: 'Best regards,\n{{senderName}}',
    isDefault: true
  }
}

// Missing selectors for compatibility
export const selectMeetingInvites = (state: RootState) => []
export const selectUnprocessedInvites = (state: RootState) => []
export const selectProductivitySettings = (state: RootState) => ({
  enableMeetingExtraction: true,
  enableCalendarIntegration: true,
  autoProcessInvites: false
})

export default productivitySlice.reducer