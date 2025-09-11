/**
 * Cross-Platform Notifications Hook
 * 
 * Provides a unified interface for push notifications across desktop and mobile
 */

import { useEffect, useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store'
import { addNotification } from '../store/slices/notificationSlice'
// Define NotificationData locally since import path issues
interface PreloadNotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  actions?: Array<{ label: string; action: string }>;
}

// Type for FlowDesk API with notifications support - simplified to match actual API
interface FlowDeskWithNotifications {
  system: {
    showNotification(options: { title: string; body?: string; icon?: string; silent?: boolean }): Promise<void>;
  };
  on?(channel: string, callback: (...args: unknown[]) => void): void;
  off?(channel: string, callback: (...args: unknown[]) => void): void;
}

// Logging stub for renderer process
const log = {
  error: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Notifications]', message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Notifications]', message, ...args);
    }
  },
  info: (_message?: string, ..._args: unknown[]) => {}, // No-op
  debug: (_message?: string, ..._args: unknown[]) => {}, // No-op
};

interface NotificationData {
  title: string
  body: string
  icon?: string
  actions?: Array<{ action: string; title: string }>
  requireInteraction?: boolean
  silent?: boolean
  data?: Record<string, unknown>
  source?: string
  importance?: 'low' | 'normal' | 'high' | 'critical'
}

interface NotificationPermission {
  permission: 'granted' | 'denied' | 'default'
  supported: boolean
  dndActive: boolean
}

export const useNotifications = () => {
  const dispatch = useAppDispatch()
  const notificationSettings = useAppSelector(state => state.notification.settings)
  
  const [permission, setPermission] = useState<NotificationPermission>({
    permission: 'default',
    supported: false,
    dndActive: false
  })

  // Initialize notification system
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        // Use browser's native notification API to check permissions
        if ('Notification' in window) {
          setPermission({
            permission: Notification.permission,
            supported: true,
            dndActive: false
          })
        } else {
          setPermission({
            permission: 'denied',
            supported: false,
            dndActive: false
          })
        }
      } catch (error) {
        log.error('Failed to check notification permissions:', error)
      }
    }

    checkPermissions()
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<'granted' | 'denied' | 'default'> => {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const result = await Notification.requestPermission()
        setPermission(prev => ({ ...prev, permission: result }))
        return result
      }
      return Notification.permission
    } catch (error) {
      log.error('Failed to request notification permission:', error)
    }
    return 'denied'
  }, [])

  // Send notification (cross-platform)
  const sendNotification = useCallback(async (data: NotificationData): Promise<string | null> => {
    try {
      // Check if notifications are enabled in settings
      if (!notificationSettings.enabled) {
        log.debug('Notifications disabled in settings')
        return null
      }

      // Check permission
      if (permission.permission !== 'granted') {
        const granted = await requestPermission()
        if (granted !== 'granted') {
          log.warn('Notification permission not granted')
          return null
        }
      }

      // Check DND status
      if (permission.dndActive && data.importance !== 'critical') {
        log.debug('Do not disturb is active, skipping notification')
        return null
      }

      // Send platform-specific notification
      if ((window as { flowDesk: FlowDeskWithNotifications }).flowDesk?.system) {
        await (window as { flowDesk: FlowDeskWithNotifications }).flowDesk.system.showNotification({
          title: data.title,
          body: data.body,
          icon: data.icon,
          silent: data.silent || !notificationSettings.sound
        })
        const notificationId = `notif-${Date.now()}`

        // Also add to internal notification store
        dispatch(addNotification({
          type: data.importance === 'critical' ? 'error' :
                data.importance === 'high' ? 'warning' :
                data.importance === 'low' ? 'info' : 'info',
          title: data.title,
          message: data.body,
          source: data.source || 'System',
          persistent: data.importance === 'critical' || data.requireInteraction === true,
          actions: data.actions?.map(a => ({
            id: a.action,
            label: a.title,
            action: a.action
          }))
        }))

        return notificationId
      }

      // Fallback for environments without flowDesk API
      if ('Notification' in window) {
        const notification = new Notification(data.title, {
          body: data.body,
          icon: data.icon,
          silent: data.silent || !notificationSettings.sound,
          requireInteraction: data.requireInteraction,
          data: data.data
        })

        return notification.tag || `notif-${Date.now()}`
      }

      log.warn('No notification system available')
      return null

    } catch (error) {
      log.error('Failed to send notification:', error)
      return null
    }
  }, [permission, notificationSettings, dispatch, requestPermission])

  // Clear notification
  const clearNotification = useCallback(async (notificationId?: string): Promise<void> => {
    try {
      // No specific API for clearing individual notifications in current implementation
      log.info('Clearing notification:', notificationId)
    } catch (error) {
      log.error('Failed to clear notification:', error)
    }
  }, [])

  // Clear all notifications
  const clearAllNotifications = useCallback(async (): Promise<void> => {
    try {
      // No specific API for clearing all notifications in current implementation
      log.info('Clearing all notifications')
    } catch (error) {
      log.error('Failed to clear all notifications:', error)
    }
  }, [])

  // Set DND status
  const setDoNotDisturb = useCallback(async (active: boolean, duration?: number): Promise<void> => {
    try {
      // No specific API for DND in current implementation - just update local state
      setPermission(prev => ({ ...prev, dndActive: active }))
      log.info('DND status set:', active, duration)
    } catch (error) {
      log.error('Failed to set DND status:', error)
    }
  }, [])

  // TODO: Add notification event listeners when they become available
  // The notification API doesn't currently support event listeners

  // Convenience methods for common notification types
  const notifyMail = useCallback((data: { sender: string; subject: string; preview: string }) => {
    return sendNotification({
      title: `New email from ${data.sender}`,
      body: data.subject,
      icon: '/assets/icons/mail.png',
      source: 'Mail',
      importance: 'normal',
      actions: [
        { action: 'reply', title: 'Reply' },
        { action: 'mark-read', title: 'Mark as Read' }
      ],
      data: { type: 'email', ...data }
    })
  }, [sendNotification])

  const notifyCalendar = useCallback((data: { title: string; start: Date; location?: string }) => {
    return sendNotification({
      title: 'Upcoming Event',
      body: `${data.title}${data.location ? ` at ${data.location}` : ''}`,
      icon: '/assets/icons/calendar.png',
      source: 'Calendar',
      importance: 'normal',
      actions: [
        { action: 'view', title: 'View' },
        { action: 'snooze', title: 'Snooze 5 min' }
      ],
      data: { type: 'calendar', ...data }
    })
  }, [sendNotification])

  const notifySystem = useCallback((data: { title: string; message: string; type?: 'info' | 'warning' | 'error' }) => {
    return sendNotification({
      title: data.title,
      body: data.message,
      icon: '/assets/icons/system.png',
      source: 'System',
      importance: data.type === 'error' ? 'high' : 'normal',
      data: { type: 'system', level: data.type }
    })
  }, [sendNotification])

  return {
    // Core functionality
    sendNotification,
    clearNotification,
    clearAllNotifications,
    requestPermission,
    setDoNotDisturb,
    
    // Status
    permission,
    isSupported: permission.supported,
    isDNDActive: permission.dndActive,
    isEnabled: notificationSettings.enabled,
    
    // Convenience methods
    notifyMail,
    notifyCalendar,
    notifySystem
  }
}