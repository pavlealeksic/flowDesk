import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  source: string
  timestamp: number
  read: boolean
  persistent: boolean
  actions?: Array<{
    id: string
    label: string
    action: string
  }>
  metadata?: Record<string, any>
}

interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  conditions: Array<{
    field: string
    operator: string
    value: any
  }>
  actions: Array<{
    type: string
    config: Record<string, any>
  }>
}

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  rules: NotificationRule[]
  settings: {
    enabled: boolean
    sound: boolean
    desktop: boolean
    doNotDisturb: {
      enabled: boolean
      startTime: string
      endTime: string
      days: number[]
    }
    filters: {
      sources: string[]
      types: string[]
      keywords: string[]
    }
  }
  isLoading: boolean
  error: string | null
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  rules: [],
  settings: {
    enabled: true,
    sound: true,
    desktop: true,
    doNotDisturb: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      days: [0, 1, 2, 3, 4, 5, 6]
    },
    filters: {
      sources: [],
      types: [],
      keywords: []
    }
  },
  isLoading: false,
  error: null
}

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Omit<NotificationItem, 'id' | 'timestamp' | 'read'>>) => {
      const notification: NotificationItem = {
        ...action.payload,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false
      }
      
      state.notifications.unshift(notification)
      if (!notification.read) {
        state.unreadCount += 1
      }
      
      // Keep only last 1000 notifications
      if (state.notifications.length > 1000) {
        const removed = state.notifications.splice(1000)
        // Adjust unread count
        const removedUnread = removed.filter(n => !n.read).length
        state.unreadCount = Math.max(0, state.unreadCount - removedUnread)
      }
    },
    
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification && !notification.read) {
        notification.read = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
      }
    },
    
    markAllAsRead: (state) => {
      state.notifications.forEach(n => {
        n.read = true
      })
      state.unreadCount = 0
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload)
      if (index > -1) {
        const notification = state.notifications[index]
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1)
        }
        state.notifications.splice(index, 1)
      }
    },
    
    clearAllNotifications: (state) => {
      state.notifications = []
      state.unreadCount = 0
    },
    
    updateSettings: (state, action: PayloadAction<Partial<NotificationState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload }
    },
    
    addRule: (state, action: PayloadAction<Omit<NotificationRule, 'id'>>) => {
      const rule: NotificationRule = {
        ...action.payload,
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
      state.rules.push(rule)
    },
    
    updateRule: (state, action: PayloadAction<{ id: string; updates: Partial<NotificationRule> }>) => {
      const { id, updates } = action.payload
      const rule = state.rules.find(r => r.id === id)
      if (rule) {
        Object.assign(rule, updates)
      }
    },
    
    removeRule: (state, action: PayloadAction<string>) => {
      const index = state.rules.findIndex(r => r.id === action.payload)
      if (index > -1) {
        state.rules.splice(index, 1)
      }
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    }
  }
})

export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearAllNotifications,
  updateSettings,
  addRule,
  updateRule,
  removeRule,
  setLoading,
  setError,
  clearError
} = notificationSlice.actions

export default notificationSlice.reducer