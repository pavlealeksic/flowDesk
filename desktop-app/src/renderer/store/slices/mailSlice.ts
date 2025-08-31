import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { MailAccount, EmailMessage, MailFolder, MailSyncStatus } from '@flow-desk/shared'


interface MailState {
  accounts: MailAccount[]
  folders: Record<string, MailFolder[]>
  messages: Record<string, EmailMessage[]>
  currentAccountId: string | null
  currentFolderId: string | null
  selectedMessageIds: string[]
  searchQuery: string
  searchResults: EmailMessage[]
  isLoading: boolean
  isLoadingMessages: boolean
  isLoadingAccounts: boolean
  isSyncing: boolean
  error: string | null
  syncStatus: Record<string, MailSyncStatus>
}

const initialState: MailState = {
  accounts: [],
  folders: {},
  messages: {},
  currentAccountId: null,
  currentFolderId: null,
  selectedMessageIds: [],
  searchQuery: '',
  searchResults: [],
  isLoading: false,
  isLoadingMessages: false,
  isLoadingAccounts: false,
  isSyncing: false,
  error: null,
  syncStatus: {}
}

// Async thunks for mail operations
export const fetchMailAccounts = createAsyncThunk(
  'mail/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const accounts = await window.flowDesk.mail.getAccounts()
      return accounts
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch accounts')
    }
  }
)

export const addMailAccount = createAsyncThunk(
  'mail/addAccount',
  async (account: any, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const newAccount = await window.flowDesk.mail.addAccount(account)
      return newAccount
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to add account')
    }
  }
)

export const syncMailAccount = createAsyncThunk(
  'mail/syncAccount',
  async (accountId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      await window.flowDesk.mail.syncAccount(accountId)
      return accountId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to sync account')
    }
  }
)

export const fetchMessages = createAsyncThunk(
  'mail/fetchMessages',
  async ({ accountId, folderId, options }: { 
    accountId: string
    folderId?: string
    options?: any 
  }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const messages = await window.flowDesk.mail.getMessages(accountId, folderId, options)
      return { accountId, folderId, messages }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch messages')
    }
  }
)

export const fetchFolders = createAsyncThunk(
  'mail/fetchFolders',
  async (accountId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const folders = await window.flowDesk.mail.getFolders(accountId)
      return { accountId, folders }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch folders')
    }
  }
)

export const sendMessage = createAsyncThunk(
  'mail/sendMessage',
  async ({ accountId, message }: { accountId: string, message: any }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const success = await window.flowDesk.mail.sendMessage(accountId, message)
      return success
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to send message')
    }
  }
)

export const searchMessages = createAsyncThunk(
  'mail/searchMessages',
  async ({ query, options }: { query: string, options?: any }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const results = await window.flowDesk.mail.searchMessages(query, options)
      return results
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to search messages')
    }
  }
)

export const markMessageRead = createAsyncThunk(
  'mail/markMessageRead',
  async ({ accountId, messageId, read }: { 
    accountId: string
    messageId: string
    read: boolean 
  }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      await window.flowDesk.mail.markMessageRead(accountId, messageId, read)
      return { messageId, read }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to mark message')
    }
  }
)

export const fetchSyncStatus = createAsyncThunk(
  'mail/fetchSyncStatus',
  async (_, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const syncStatus = await window.flowDesk.mail.getSyncStatus()
      return syncStatus
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch sync status')
    }
  }
)

const mailSlice = createSlice({
  name: 'mail',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setCurrentAccount: (state, action: PayloadAction<string>) => {
      state.currentAccountId = action.payload
    },
    setCurrentFolder: (state, action: PayloadAction<string>) => {
      state.currentFolderId = action.payload
    },
    setSelectedMessages: (state, action: PayloadAction<string[]>) => {
      state.selectedMessageIds = action.payload
    },
    toggleMessageSelection: (state, action: PayloadAction<string>) => {
      const messageId = action.payload
      const index = state.selectedMessageIds.indexOf(messageId)
      if (index > -1) {
        state.selectedMessageIds.splice(index, 1)
      } else {
        state.selectedMessageIds.push(messageId)
      }
    },
    clearSelection: (state) => {
      state.selectedMessageIds = []
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    updateMessageFlags: (state, action: PayloadAction<{ messageId: string, flags: Partial<EmailMessage['flags']> }>) => {
      const { messageId, flags } = action.payload
      // Update message flags in all message collections
      Object.keys(state.messages).forEach(key => {
        const messages = state.messages[key]
        const messageIndex = messages.findIndex(msg => msg.id === messageId)
        if (messageIndex !== -1) {
          state.messages[key][messageIndex].flags = {
            ...state.messages[key][messageIndex].flags,
            ...flags
          }
        }
      })
    }
  },
  extraReducers: (builder) => {
    // Fetch accounts
    builder
      .addCase(fetchMailAccounts.pending, (state) => {
        state.isLoadingAccounts = true
        state.error = null
      })
      .addCase(fetchMailAccounts.fulfilled, (state, action) => {
        state.isLoadingAccounts = false
        state.accounts = action.payload
        // Set first account as current if none selected
        if (!state.currentAccountId && action.payload.length > 0) {
          state.currentAccountId = action.payload[0].id
        }
      })
      .addCase(fetchMailAccounts.rejected, (state, action) => {
        state.isLoadingAccounts = false
        state.error = action.payload as string
      })

    // Add account
    builder
      .addCase(addMailAccount.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(addMailAccount.fulfilled, (state, action) => {
        state.isLoading = false
        state.accounts.push(action.payload)
      })
      .addCase(addMailAccount.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Sync account
    builder
      .addCase(syncMailAccount.pending, (state) => {
        state.isSyncing = true
        state.error = null
      })
      .addCase(syncMailAccount.fulfilled, (state) => {
        state.isSyncing = false
      })
      .addCase(syncMailAccount.rejected, (state, action) => {
        state.isSyncing = false
        state.error = action.payload as string
      })

    // Fetch messages
    builder
      .addCase(fetchMessages.pending, (state) => {
        state.isLoadingMessages = true
        state.error = null
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.isLoadingMessages = false
        const { accountId, folderId, messages } = action.payload
        const key = `${accountId}:${folderId || 'inbox'}`
        state.messages[key] = messages
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.isLoadingMessages = false
        state.error = action.payload as string
      })

    // Fetch folders
    builder
      .addCase(fetchFolders.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFolders.fulfilled, (state, action) => {
        state.isLoading = false
        const { accountId, folders } = action.payload
        state.folders[accountId] = folders
      })
      .addCase(fetchFolders.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Send message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(sendMessage.fulfilled, (state) => {
        state.isLoading = false
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Search messages
    builder
      .addCase(searchMessages.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(searchMessages.fulfilled, (state, action) => {
        state.isLoading = false
        state.searchResults = action.payload
      })
      .addCase(searchMessages.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Mark message read
    builder
      .addCase(markMessageRead.fulfilled, (state, action) => {
        const { messageId, read } = action.payload
        state.selectedMessageIds = state.selectedMessageIds.filter(id => id !== messageId)
        // Update message flags
        Object.keys(state.messages).forEach(key => {
          const messages = state.messages[key]
          const messageIndex = messages.findIndex(msg => msg.id === messageId)
          if (messageIndex !== -1) {
            state.messages[key][messageIndex].flags.isRead = read
          }
        })
      })

    // Fetch sync status
    builder
      .addCase(fetchSyncStatus.fulfilled, (state, action) => {
        state.syncStatus = action.payload
      })
  }
})

export const {
  setLoading,
  setError,
  setCurrentAccount,
  setCurrentFolder,
  setSelectedMessages,
  toggleMessageSelection,
  clearSelection,
  setSearchQuery,
  clearError,
  updateMessageFlags
} = mailSlice.actions

// Selectors
export const selectMailAccounts = (state: { mail: MailState }) => state.mail.accounts
export const selectCurrentAccount = (state: { mail: MailState }) => {
  const { accounts, currentAccountId } = state.mail
  return accounts.find(account => account.id === currentAccountId) || null
}
export const selectCurrentMessages = (state: { mail: MailState }) => {
  const { messages, currentAccountId, currentFolderId } = state.mail
  if (!currentAccountId) return []
  const key = `${currentAccountId}:${currentFolderId || 'inbox'}`
  return messages[key] || []
}
export const selectCurrentFolders = (state: { mail: MailState }) => {
  const { folders, currentAccountId } = state.mail
  return currentAccountId ? folders[currentAccountId] || [] : []
}
export const selectMailSyncStatus = (state: { mail: MailState }) => state.mail.syncStatus
export const selectIsLoadingMail = (state: { mail: MailState }) => 
  state.mail.isLoading || state.mail.isLoadingMessages || state.mail.isLoadingAccounts
export const selectMailError = (state: { mail: MailState }) => state.mail.error

export default mailSlice.reducer