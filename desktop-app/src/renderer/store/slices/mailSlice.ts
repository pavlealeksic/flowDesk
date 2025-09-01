import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { MailAccount, EmailMessage, MailFolder, MailSyncStatus, CreateMailAccountInput, UpdateMailAccountInput } from '@flow-desk/shared'
import type { MailMessageOptions, ComposeMessageInput } from '../../types/preload'


interface SmartMailbox {
  id: string
  name: string
  criteria: string
  icon: string
  color: string
  count: number
}

interface MessageThread {
  threadId: string
  messages: EmailMessage[]
  subject: string
  participants: string[]
  lastMessageDate: Date
  unreadCount: number
}

interface ScheduledMessage {
  id: string
  accountId: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  scheduledDate: Date
  status: 'pending' | 'sent' | 'failed'
  createdAt: Date
}

interface EmailAlias {
  id: string
  accountId: string
  address: string
  name: string
  isDefault: boolean
  isVerified: boolean
}

interface MailState {
  accounts: MailAccount[]
  folders: Record<string, MailFolder[]>
  messages: Record<string, EmailMessage[]>
  threads: Record<string, MessageThread>
  unifiedMessages: EmailMessage[]
  smartMailboxes: SmartMailbox[]
  scheduledMessages: ScheduledMessage[]
  aliases: Record<string, EmailAlias[]>
  currentAccountId: string | null
  currentFolderId: string | null
  currentThreadId: string | null
  selectedMessageIds: string[]
  searchQuery: string
  searchResults: EmailMessage[]
  viewMode: 'messages' | 'threads' | 'unified'
  previewPane: 'right' | 'bottom' | 'hidden'
  isLoading: boolean
  isLoadingMessages: boolean
  isLoadingAccounts: boolean
  isLoadingThreads: boolean
  isSyncing: boolean
  isIdleActive: Record<string, boolean>
  error: string | null
  syncStatus: Record<string, MailSyncStatus>
}

const initialState: MailState = {
  accounts: [],
  folders: {},
  messages: {},
  threads: {},
  unifiedMessages: [],
  smartMailboxes: [
    { id: 'today', name: 'Today', criteria: 'today', icon: '📅', color: 'blue', count: 0 },
    { id: 'flagged', name: 'Flagged', criteria: 'flagged', icon: '⭐', color: 'yellow', count: 0 },
    { id: 'unread', name: 'Unread', criteria: 'unread', icon: '🔵', color: 'blue', count: 0 },
    { id: 'attachments', name: 'Attachments', criteria: 'with_attachments', icon: '📎', color: 'gray', count: 0 },
  ],
  scheduledMessages: [],
  aliases: {},
  currentAccountId: null,
  currentFolderId: null,
  currentThreadId: null,
  selectedMessageIds: [],
  searchQuery: '',
  searchResults: [],
  viewMode: 'messages',
  previewPane: 'right',
  isLoading: false,
  isLoadingMessages: false,
  isLoadingAccounts: false,
  isLoadingThreads: false,
  isSyncing: false,
  isIdleActive: {},
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
  async (account: CreateMailAccountInput, { rejectWithValue }) => {
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
    options?: MailMessageOptions 
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
  async ({ accountId, message }: { accountId: string, message: ComposeMessageInput }, { rejectWithValue }) => {
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
  async ({ query, options }: { query: string, options?: { accountId?: string; folderId?: string } }, { rejectWithValue }) => {
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

export const markMessageStarred = createAsyncThunk(
  'mail/markMessageStarred',
  async ({ accountId, messageId, starred }: { 
    accountId: string
    messageId: string
    starred: boolean 
  }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      await window.flowDesk.mail.markMessageStarred(accountId, messageId, starred)
      return { messageId, starred }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to mark message starred')
    }
  }
)

export const fetchUnifiedMessages = createAsyncThunk(
  'mail/fetchUnifiedMessages', 
  async (limit?: number, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const messages = await window.flowDesk.mail.getUnifiedMessages(limit)
      return messages
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch unified messages')
    }
  }
)

export const fetchSmartMailboxMessages = createAsyncThunk(
  'mail/fetchSmartMailboxMessages',
  async (criteria: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const messages = await window.flowDesk.mail.getSmartMailboxMessages(criteria)
      return { criteria, messages }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch smart mailbox messages')
    }
  }
)

export const fetchMessageThread = createAsyncThunk(
  'mail/fetchMessageThread',
  async ({ accountId, threadId }: { accountId: string, threadId: string }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const messages = await window.flowDesk.mail.getMessageThread(accountId, threadId)
      return { threadId, messages }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch thread')
    }
  }
)

export const scheduleMessage = createAsyncThunk(
  'mail/scheduleMessage',
  async ({ 
    accountId, 
    message, 
    scheduledDate 
  }: { 
    accountId: string
    message: ComposeMessageInput
    scheduledDate: Date
  }, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const scheduledId = await window.flowDesk.mail.scheduleMessage(accountId, message, scheduledDate)
      return { accountId, message, scheduledDate, scheduledId }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to schedule message')
    }
  }
)

export const fetchEmailAliases = createAsyncThunk(
  'mail/fetchEmailAliases',
  async (accountId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      const aliases = await window.flowDesk.mail.getEmailAliases(accountId)
      return { accountId, aliases }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch aliases')
    }
  }
)

export const startIdleSync = createAsyncThunk(
  'mail/startIdleSync',
  async (accountId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      await window.flowDesk.mail.startIdle(accountId)
      return accountId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to start IDLE sync')
    }
  }
)

export const stopIdleSync = createAsyncThunk(
  'mail/stopIdleSync',
  async (accountId: string, { rejectWithValue }) => {
    try {
      if (!window.flowDesk?.mail) {
        throw new Error('Mail API not available')
      }
      await window.flowDesk.mail.stopIdle(accountId)
      return accountId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to stop IDLE sync')
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
      // Update unified messages
      const unifiedIndex = state.unifiedMessages.findIndex(msg => msg.id === messageId)
      if (unifiedIndex !== -1) {
        state.unifiedMessages[unifiedIndex].flags = {
          ...state.unifiedMessages[unifiedIndex].flags,
          ...flags
        }
      }
    },
    setViewMode: (state, action: PayloadAction<'messages' | 'threads' | 'unified'>) => {
      state.viewMode = action.payload
    },
    setPreviewPane: (state, action: PayloadAction<'right' | 'bottom' | 'hidden'>) => {
      state.previewPane = action.payload
    },
    setCurrentThread: (state, action: PayloadAction<string | null>) => {
      state.currentThreadId = action.payload
    },
    updateSmartMailboxCounts: (state, action: PayloadAction<Record<string, number>>) => {
      const counts = action.payload
      state.smartMailboxes = state.smartMailboxes.map(mailbox => ({
        ...mailbox,
        count: counts[mailbox.criteria] || 0
      }))
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

    // Mark message starred
    builder
      .addCase(markMessageStarred.fulfilled, (state, action) => {
        const { messageId, starred } = action.payload
        // Update message flags in all collections
        Object.keys(state.messages).forEach(key => {
          const messages = state.messages[key]
          const messageIndex = messages.findIndex(msg => msg.id === messageId)
          if (messageIndex !== -1) {
            state.messages[key][messageIndex].flags.isStarred = starred
          }
        })
        const unifiedIndex = state.unifiedMessages.findIndex(msg => msg.id === messageId)
        if (unifiedIndex !== -1) {
          state.unifiedMessages[unifiedIndex].flags.isStarred = starred
        }
      })

    // Fetch unified messages
    builder
      .addCase(fetchUnifiedMessages.pending, (state) => {
        state.isLoadingMessages = true
      })
      .addCase(fetchUnifiedMessages.fulfilled, (state, action) => {
        state.isLoadingMessages = false
        state.unifiedMessages = action.payload
      })
      .addCase(fetchUnifiedMessages.rejected, (state, action) => {
        state.isLoadingMessages = false
        state.error = action.payload as string
      })

    // Fetch smart mailbox messages
    builder
      .addCase(fetchSmartMailboxMessages.fulfilled, (state, action) => {
        const { criteria, messages } = action.payload
        // Update smart mailbox count
        const mailboxIndex = state.smartMailboxes.findIndex(mb => mb.criteria === criteria)
        if (mailboxIndex !== -1) {
          state.smartMailboxes[mailboxIndex].count = messages.length
        }
        // Store messages with special key
        state.messages[`smart:${criteria}`] = messages
      })

    // Fetch message thread
    builder
      .addCase(fetchMessageThread.pending, (state) => {
        state.isLoadingThreads = true
      })
      .addCase(fetchMessageThread.fulfilled, (state, action) => {
        state.isLoadingThreads = false
        const { threadId, messages } = action.payload
        state.threads[threadId] = {
          threadId,
          messages,
          subject: messages[0]?.subject || '',
          participants: [...new Set(messages.flatMap(m => [m.from.address, ...m.to.map(t => t.address)]))],
          lastMessageDate: messages[messages.length - 1]?.date || new Date(),
          unreadCount: messages.filter(m => !m.flags.isRead).length
        }
      })
      .addCase(fetchMessageThread.rejected, (state, action) => {
        state.isLoadingThreads = false
        state.error = action.payload as string
      })

    // Schedule message
    builder
      .addCase(scheduleMessage.fulfilled, (state, action) => {
        const { accountId, message, scheduledDate, scheduledId } = action.payload
        state.scheduledMessages.push({
          id: scheduledId,
          accountId,
          to: message.to || [],
          cc: message.cc,
          bcc: message.bcc,
          subject: message.subject || '',
          body: message.body || '',
          scheduledDate,
          status: 'pending',
          createdAt: new Date()
        })
      })

    // Fetch email aliases
    builder
      .addCase(fetchEmailAliases.fulfilled, (state, action) => {
        const { accountId, aliases } = action.payload
        state.aliases[accountId] = aliases
      })

    // Start IDLE sync
    builder
      .addCase(startIdleSync.fulfilled, (state, action) => {
        state.isIdleActive[action.payload] = true
      })
      .addCase(startIdleSync.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Stop IDLE sync
    builder
      .addCase(stopIdleSync.fulfilled, (state, action) => {
        state.isIdleActive[action.payload] = false
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
  updateMessageFlags,
  setViewMode,
  setPreviewPane,
  setCurrentThread,
  updateSmartMailboxCounts
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
  state.mail.isLoading || state.mail.isLoadingMessages || state.mail.isLoadingAccounts || state.mail.isLoadingThreads
export const selectMailError = (state: { mail: MailState }) => state.mail.error

// New selectors for advanced features
export const selectUnifiedMessages = (state: { mail: MailState }) => state.mail.unifiedMessages
export const selectSmartMailboxes = (state: { mail: MailState }) => state.mail.smartMailboxes
export const selectMessageThreads = (state: { mail: MailState }) => state.mail.threads
export const selectCurrentThread = (state: { mail: MailState }) => {
  const { threads, currentThreadId } = state.mail
  return currentThreadId ? threads[currentThreadId] : null
}
export const selectScheduledMessages = (state: { mail: MailState }) => state.mail.scheduledMessages
export const selectEmailAliases = (state: { mail: MailState }) => {
  const { aliases, currentAccountId } = state.mail
  return currentAccountId ? aliases[currentAccountId] || [] : []
}
export const selectViewMode = (state: { mail: MailState }) => state.mail.viewMode
export const selectPreviewPane = (state: { mail: MailState }) => state.mail.previewPane
export const selectIdleStatus = (state: { mail: MailState }) => state.mail.isIdleActive
export const selectSmartMailboxMessages = (criteria: string) => (state: { mail: MailState }) => {
  return state.mail.messages[`smart:${criteria}`] || []
}

export default mailSlice.reducer