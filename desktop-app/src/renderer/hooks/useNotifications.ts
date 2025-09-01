/**
 * Cross-Platform Notifications Hook
 * 
 * Provides a unified interface for push notifications across desktop and mobile
 */

import { useEffect, useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store'
import { addNotification } from '../store/slices/notificationSlice'
import type { NotificationData as PreloadNotificationData } from '../types/preload'

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
        if (window.flowDesk?.notifications) {
          const status = await window.flowDesk.notifications.getStatus()
          setPermission(status)
        }
      } catch (error) {
        console.error('Failed to check notification permissions:', error)
      }
    }

    checkPermissions()
  }, [])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<'granted' | 'denied' | 'default'> => {
    try {
      if (window.flowDesk?.notifications) {
        const result = await window.flowDesk.notifications.requestPermission()
        setPermission(prev => ({ ...prev, permission: result }))
        return result
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error)
    }
    return 'denied'
  }, [])

  // Send notification (cross-platform)
  const sendNotification = useCallback(async (data: NotificationData): Promise<string | null> => {
    try {
      // Check if notifications are enabled in settings
      if (!notificationSettings.enabled) {
        console.log('Notifications disabled in settings')
        return null
      }

      // Check permission
      if (permission.permission !== 'granted') {
        const granted = await requestPermission()
        if (granted !== 'granted') {
          console.log('Notification permission not granted')
          return null
        }
      }

      // Check DND status
      if (permission.dndActive && data.importance !== 'critical') {
        console.log('Do not disturb is active, skipping notification')
        return null
      }

      // Send platform-specific notification
      if (window.flowDesk?.notifications) {
        const notificationId = await window.flowDesk.notifications.send({
          title: data.title,
          body: data.body,
          icon: data.icon,
          actions: data.actions,
          requireInteraction: data.requireInteraction,
          silent: data.silent || !notificationSettings.sound,
          data: { ...data.data, source: data.source, importance: data.importance }
        })

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

      console.warn('No notification system available')
      return null

    } catch (error) {
      console.error('Failed to send notification:', error)
      return null
    }
  }, [permission, notificationSettings, dispatch, requestPermission])

  // Clear notification
  const clearNotification = useCallback(async (notificationId?: string): Promise<void> => {
    try {
      if (window.flowDesk?.notifications) {
        await window.flowDesk.notifications.clear(notificationId)
      }
    } catch (error) {
      console.error('Failed to clear notification:', error)
    }
  }, [])

  // Clear all notifications
  const clearAllNotifications = useCallback(async (): Promise<void> => {
    try {
      if (window.flowDesk?.notifications) {
        await window.flowDesk.notifications.clearAll()
      }
    } catch (error) {
      console.error('Failed to clear all notifications:', error)
    }
  }, [])

  // Set DND status
  const setDoNotDisturb = useCallback(async (active: boolean, duration?: number): Promise<void> => {
    try {
      if (window.flowDesk?.notifications) {
        await window.flowDesk.notifications.setDND(active, duration)
        setPermission(prev => ({ ...prev, dndActive: active }))
      }
    } catch (error) {
      console.error('Failed to set DND status:', error)
    }
  }, [])

  // Listen for notification events
  useEffect(() => {
    if (!window.flowDesk?.notifications) return

    const unsubscribeClick = window.flowDesk.notifications.onNotificationClick((data) => {
      console.log('Notification clicked:', data)
      // Handle notification click (e.g., navigate to relevant view)
    })

    const unsubscribeAction = window.flowDesk.notifications.onNotificationAction((data) => {
      console.log('Notification action:', data)
      // Handle notification action
    })

    const unsubscribeClose = window.flowDesk.notifications.onNotificationClose((data) => {
      console.log('Notification closed:', data)
    })

    return () => {
      unsubscribeClick()
      unsubscribeAction()
      unsubscribeClose()
    }
  }, [])

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