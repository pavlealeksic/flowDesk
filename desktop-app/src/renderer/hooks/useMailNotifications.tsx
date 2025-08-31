import React, { useEffect, useCallback, useState } from 'react'
import { useAppDispatch } from '../store'

interface ToastNotification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationState {
  notifications: ToastNotification[]
}

export function useMailNotifications() {
  const dispatch = useAppDispatch()
  const [notifications, setNotifications] = useState<ToastNotification[]>([])

  const showNotification = useCallback((notification: Omit<ToastNotification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newNotification: ToastNotification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000
    }

    setNotifications(prev => [...prev, newNotification])

    // Auto remove notification after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }

    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Notification helper functions
  const showSuccess = useCallback((title: string, message?: string, options?: Partial<ToastNotification>) => {
    return showNotification({ ...options, type: 'success', title, message })
  }, [showNotification])

  const showError = useCallback((title: string, message?: string, options?: Partial<ToastNotification>) => {
    return showNotification({ ...options, type: 'error', title, message })
  }, [showNotification])

  const showInfo = useCallback((title: string, message?: string, options?: Partial<ToastNotification>) => {
    return showNotification({ ...options, type: 'info', title, message })
  }, [showNotification])

  const showWarning = useCallback((title: string, message?: string, options?: Partial<ToastNotification>) => {
    return showNotification({ ...options, type: 'warning', title, message })
  }, [showNotification])

  // Mail-specific notification handlers
  const handleNewMessages = useCallback((accountEmail: string, count: number) => {
    showInfo(
      'New Messages',
      `You have ${count} new message${count > 1 ? 's' : ''} in ${accountEmail}`,
      {
        duration: 7000,
        action: {
          label: 'View',
          onClick: () => {
            // TODO: Navigate to inbox or specific account
            console.log('Navigate to messages')
          }
        }
      }
    )
  }, [showInfo])

  const handleSyncError = useCallback((accountEmail: string, error: string) => {
    showError(
      'Sync Failed',
      `Failed to sync ${accountEmail}: ${error}`,
      {
        duration: 10000,
        action: {
          label: 'Retry',
          onClick: () => {
            // TODO: Retry sync for this account
            console.log('Retry sync')
          }
        }
      }
    )
  }, [showError])

  const handleSendSuccess = useCallback(() => {
    showSuccess('Message Sent', 'Your message has been sent successfully')
  }, [showSuccess])

  const handleSendError = useCallback((error: string) => {
    showError('Send Failed', `Failed to send message: ${error}`, { duration: 10000 })
  }, [showError])

  const handleAccountAdded = useCallback((accountEmail: string) => {
    showSuccess('Account Added', `${accountEmail} has been successfully connected`)
  }, [showSuccess])

  const handleAccountError = useCallback((accountEmail: string, error: string) => {
    showError('Account Error', `Problem with ${accountEmail}: ${error}`, { duration: 10000 })
  }, [showError])

  return {
    notifications,
    showNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    // Mail-specific handlers
    handleNewMessages,
    handleSyncError,
    handleSendSuccess,
    handleSendError,
    handleAccountAdded,
    handleAccountError
  }
}

// Toast container component
interface ToastContainerProps {
  notifications: ToastNotification[]
  onRemove: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ notifications, onRemove }) => {
  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

// Individual toast component
interface ToastProps {
  notification: ToastNotification
  onRemove: (id: string) => void
}

const Toast: React.FC<ToastProps> = ({ notification, onRemove }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '⚠'
      case 'info':
      default:
        return 'ℹ'
    }
  }

  const getColorClasses = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-500 text-white'
      case 'error':
        return 'bg-red-500 text-white'
      case 'warning':
        return 'bg-yellow-500 text-white'
      case 'info':
      default:
        return 'bg-blue-500 text-white'
    }
  }

  return (
    <div className={`
      rounded-lg shadow-lg p-4 ${getColorClasses()}
      animate-in slide-in-from-right-full duration-300
      flex items-start gap-3 max-w-md
    `}>
      <div className="text-lg font-semibold">{getIcon()}</div>
      
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{notification.title}</div>
        {notification.message && (
          <div className="text-xs opacity-90 mt-1">{notification.message}</div>
        )}
        
        {notification.action && (
          <button
            onClick={notification.action.onClick}
            className="text-xs underline mt-2 hover:no-underline"
          >
            {notification.action.label}
          </button>
        )}
      </div>
      
      <button
        onClick={() => onRemove(notification.id)}
        className="text-lg opacity-70 hover:opacity-100 ml-2"
      >
        ×
      </button>
    </div>
  )
}