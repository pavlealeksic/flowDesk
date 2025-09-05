import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  X, 
  Mail,
  Calendar,
  Settings,
  Upload,
  Download,
  RotateCcw as Sync
} from 'lucide-react'
import { cn } from './utils'
import { Button } from './Button'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'
export type NotificationCategory = 'mail' | 'calendar' | 'system' | 'sync' | 'general'

export interface NotificationAction {
  label: string
  action: () => void
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
}

export interface Notification {
  id: string
  type: NotificationType
  category: NotificationCategory
  title: string
  message?: string
  duration?: number // in milliseconds, undefined = persistent
  actions?: NotificationAction[]
  metadata?: any
  timestamp: Date
}

interface NotificationItemProps {
  notification: Notification
  onDismiss: (id: string) => void
  onAction: (id: string, action: NotificationAction) => void
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
  onAction
}) => {
  const { id, type, category, title, message, actions } = notification

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getCategoryIcon = () => {
    switch (category) {
      case 'mail':
        return <Mail className="h-4 w-4" />
      case 'calendar':
        return <Calendar className="h-4 w-4" />
      case 'system':
        return <Settings className="h-4 w-4" />
      case 'sync':
        return <Sync className="h-4 w-4" />
      default:
        return null
    }
  }

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-l-green-500'
      case 'error':
        return 'border-l-red-500'
      case 'warning':
        return 'border-l-yellow-500'
      case 'info':
        return 'border-l-blue-500'
    }
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-950/20'
      case 'error':
        return 'bg-red-50 dark:bg-red-950/20'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950/20'
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950/20'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'p-4 rounded-lg shadow-lg border-l-4',
        getBorderColor(),
        getBackgroundColor(),
        'max-w-md w-full'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getCategoryIcon()}
              <h4 className="text-sm font-semibold text-foreground truncate">
                {title}
              </h4>
            </div>
            {message && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {message}
              </p>
            )}
            
            {actions && actions.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                {actions.map((action, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={action.variant || 'secondary'}
                    onClick={() => onAction(id, action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDismiss(id)}
          className="h-6 w-6 p-0 ml-2 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
}

interface NotificationContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
  className?: string
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  position = 'top-right',
  className
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = {
      id,
      timestamp: new Date(),
      ...notification
    }

    setNotifications(prev => [newNotification, ...prev])

    // Auto-dismiss if duration is specified
    if (notification.duration) {
      setTimeout(() => {
        dismissNotification(id)
      }, notification.duration)
    }
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const handleAction = useCallback((id: string, action: NotificationAction) => {
    action.action()
    dismissNotification(id)
  }, [dismissNotification])

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4'
      case 'top-left':
        return 'top-4 left-4'
      case 'bottom-right':
        return 'bottom-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'top-center':
        return 'top-4 left-1/2 -translate-x-1/2'
    }
  }

  // Expose notification functions globally
  useEffect(() => {
    window.flowDeskNotifications = {
      show: addNotification,
      dismiss: dismissNotification,
      success: (title: string, message?: string, options?: Partial<Notification>) => 
        addNotification({ type: 'success', category: 'general', title, message, duration: 5000, ...options }),
      error: (title: string, message?: string, options?: Partial<Notification>) => 
        addNotification({ type: 'error', category: 'general', title, message, ...options }),
      warning: (title: string, message?: string, options?: Partial<Notification>) => 
        addNotification({ type: 'warning', category: 'general', title, message, duration: 8000, ...options }),
      info: (title: string, message?: string, options?: Partial<Notification>) => 
        addNotification({ type: 'info', category: 'general', title, message, duration: 5000, ...options }),
    }

    return () => {
      delete window.flowDeskNotifications
    }
  }, [addNotification, dismissNotification])

  return (
    <div className={cn(
      'fixed z-50 flex flex-col gap-2 max-h-screen overflow-hidden',
      getPositionClasses(),
      className
    )}>
      <AnimatePresence mode="popLayout">
        {notifications.slice(0, 5).map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onDismiss={dismissNotification}
            onAction={handleAction}
          />
        ))}
      </AnimatePresence>
      
      {notifications.length > 5 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-muted-foreground text-center py-2"
        >
          +{notifications.length - 5} more notifications
        </motion.div>
      )}
    </div>
  )
}

// Utility hooks for different types of notifications
export const useNotifications = () => {
  const show = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    window.flowDeskNotifications?.show(notification)
  }, [])

  const success = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    window.flowDeskNotifications?.success(title, message, options)
  }, [])

  const error = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    window.flowDeskNotifications?.error(title, message, options)
  }, [])

  const warning = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    window.flowDeskNotifications?.warning(title, message, options)
  }, [])

  const info = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    window.flowDeskNotifications?.info(title, message, options)
  }, [])

  const dismiss = useCallback((id: string) => {
    window.flowDeskNotifications?.dismiss(id)
  }, [])

  return { show, success, error, warning, info, dismiss }
}

// Specialized notification functions for different features
export const useMailNotifications = () => {
  const { show } = useNotifications()

  const newMail = useCallback((count: number, account: string) => {
    show({
      type: 'info',
      category: 'mail',
      title: `${count} new ${count === 1 ? 'message' : 'messages'}`,
      message: `in ${account}`,
      duration: 5000,
      actions: [
        {
          label: 'View',
          action: () => {
            // Navigate to mail view
            window.location.hash = '#/mail'
          }
        }
      ]
    })
  }, [show])

  const mailSent = useCallback((recipient: string) => {
    show({
      type: 'success',
      category: 'mail',
      title: 'Message sent',
      message: `to ${recipient}`,
      duration: 3000
    })
  }, [show])

  const syncComplete = useCallback((account: string, messageCount: number) => {
    show({
      type: 'success',
      category: 'mail',
      title: 'Mail synced',
      message: `${messageCount} messages from ${account}`,
      duration: 3000
    })
  }, [show])

  const syncError = useCallback((account: string, error: string) => {
    show({
      type: 'error',
      category: 'mail',
      title: 'Mail sync failed',
      message: `${account}: ${error}`,
      actions: [
        {
          label: 'Retry',
          action: () => {
            // Trigger mail sync retry
          }
        }
      ]
    })
  }, [show])

  return { newMail, mailSent, syncComplete, syncError }
}

export const useCalendarNotifications = () => {
  const { show } = useNotifications()

  const eventReminder = useCallback((title: string, timeUntil: string) => {
    show({
      type: 'warning',
      category: 'calendar',
      title: 'Upcoming event',
      message: `"${title}" starts ${timeUntil}`,
      actions: [
        {
          label: 'View',
          action: () => {
            window.location.hash = '#/calendar'
          }
        },
        {
          label: 'Snooze',
          variant: 'outline',
          action: () => {
            // Snooze reminder
          }
        }
      ]
    })
  }, [show])

  const eventCreated = useCallback((title: string) => {
    show({
      type: 'success',
      category: 'calendar',
      title: 'Event created',
      message: `"${title}"`,
      duration: 3000
    })
  }, [show])

  return { eventReminder, eventCreated }
}

// Global notification types for window object
declare global {
  interface Window {
    flowDeskNotifications?: {
      show: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
      dismiss: (id: string) => void
      success: (title: string, message?: string, options?: Partial<Notification>) => void
      error: (title: string, message?: string, options?: Partial<Notification>) => void
      warning: (title: string, message?: string, options?: Partial<Notification>) => void
      info: (title: string, message?: string, options?: Partial<Notification>) => void
    }
  }
}