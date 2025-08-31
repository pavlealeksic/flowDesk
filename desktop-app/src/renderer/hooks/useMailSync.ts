import { useEffect } from 'react'
import { useAppDispatch } from '../store'
import { fetchMessages, fetchSyncStatus } from '../store/slices/mailSlice'
// Import the FlowDeskAPI type from preload script
import type { FlowDeskAPI } from '../../preload/preload';

declare global {
  interface Window {
    flowDesk: FlowDeskAPI;
  }
}

interface MailSyncHookOptions {
  currentAccountId?: string | null
  currentFolderId?: string | null
  onNewMessages?: (accountId: string, count: number) => void
  onSyncError?: (accountId: string, error: string) => void
}

export function useMailSync(options: MailSyncHookOptions = {}) {
  const { currentAccountId, currentFolderId, onNewMessages, onSyncError } = options
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!window.flowDesk?.mail) return

    const unsubscribers: (() => void)[] = []

    // Listen for sync start events
    unsubscribers.push(
      window.flowDesk.mail.onSyncStarted((data) => {
        console.log('Mail sync started:', data.accountId)
        dispatch(fetchSyncStatus())
      })
    )

    // Listen for sync completion events
    unsubscribers.push(
      window.flowDesk.mail.onSyncCompleted((data) => {
        console.log('Mail sync completed:', data.accountId, data.syncResult)
        
        // Refresh messages for current account/folder if it matches
        if (currentAccountId === data.accountId && currentFolderId) {
          dispatch(fetchMessages({
            accountId: data.accountId,
            folderId: currentFolderId
          }))
        }
        
        // Update sync status
        dispatch(fetchSyncStatus())
      })
    )

    // Listen for sync error events
    unsubscribers.push(
      window.flowDesk.mail.onSyncError((data) => {
        console.error('Mail sync error:', data.accountId, data.error)
        onSyncError?.(data.accountId, data.error)
        dispatch(fetchSyncStatus())
      })
    )

    // Listen for new message events
    unsubscribers.push(
      window.flowDesk.mail.onNewMessages((data) => {
        console.log('New messages received:', data.accountId, data.count)
        
        // Show notification or trigger callback
        onNewMessages?.(data.accountId, data.count)
        
        // Refresh messages for current account/folder if it matches
        if (currentAccountId === data.accountId && currentFolderId) {
          dispatch(fetchMessages({
            accountId: data.accountId,
            folderId: currentFolderId
          }))
        }
        
        // Show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`New Mail - ${data.count} message${data.count > 1 ? 's' : ''}`, {
            body: 'You have new messages in Flow Desk',
            icon: '/favicon.ico',
            tag: 'mail-notification'
          })
        }
      })
    )

    // Cleanup listeners on unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [dispatch, currentAccountId, currentFolderId, onNewMessages, onSyncError])

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission)
      })
    }
  }, [])
}