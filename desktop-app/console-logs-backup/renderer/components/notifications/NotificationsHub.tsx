import React, { useState, useCallback, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import {
  Card,
  Button,
  Avatar,
  cn,
  Bell,
  X,
  Check,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Mail,
  Calendar,
  Users,
  Settings,
  Filter,
  MoreHorizontal,
  Archive
} from '../ui'
import { type BaseComponentProps, type NotificationData } from '../ui/types'

// Mock notification data
const mockNotifications: NotificationData[] = [
  {
    id: '1',
    type: 'info',
    title: 'New message from John Doe',
    message: 'Hey, can we schedule a call for tomorrow?',
    timestamp: new Date('2024-01-15T10:30:00'),
    source: 'Mail',
    icon: <Mail className="h-4 w-4" />,
    action: {
      label: 'Reply',
      onClick: () => console.log('Reply clicked')
    }
  },
  {
    id: '2',
    type: 'success',
    title: 'Meeting scheduled successfully',
    message: 'Q4 Planning Meeting has been added to your calendar',
    timestamp: new Date('2024-01-15T09:15:00'),
    source: 'Calendar',
    icon: <Calendar className="h-4 w-4" />
  },
  {
    id: '3',
    type: 'warning',
    title: 'Storage space running low',
    message: 'You have used 85% of your available storage',
    timestamp: new Date('2024-01-15T08:45:00'),
    source: 'System',
    persistent: true,
    action: {
      label: 'Manage Storage',
      onClick: () => console.log('Manage storage clicked')
    }
  },
  {
    id: '4',
    type: 'error',
    title: 'Failed to sync with server',
    message: 'Unable to connect to the server. Please check your internet connection.',
    timestamp: new Date('2024-01-15T07:20:00'),
    source: 'System',
    persistent: true,
    action: {
      label: 'Retry',
      onClick: () => console.log('Retry clicked')
    }
  },
  {
    id: '5',
    type: 'info',
    title: 'Team invitation received',
    message: 'Sarah Johnson invited you to join the Design Team workspace',
    timestamp: new Date('2024-01-14T16:30:00'),
    source: 'Workspace',
    icon: <Users className="h-4 w-4" />,
    action: {
      label: 'Accept',
      onClick: () => console.log('Accept invitation clicked')
    }
  }
]

interface NotificationItemProps {
  notification: NotificationData
  onDismiss: (id: string) => void
  onAction: (id: string, action: () => void) => void
  compact?: boolean
}

const NotificationItem: React.FC<NotificationItemProps> = React.memo(({
  notification,
  onDismiss,
  onAction,
  compact = false
}) => {
  const getTypeIcon = (type: NotificationData['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getTypeColors = (type: NotificationData['type']) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20'
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
    }
  }

  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 border-l-4 hover:bg-accent/50 transition-colors cursor-pointer',
        getTypeColors(notification.type)
      )}>
        <div className="flex-shrink-0">
          {notification.icon || getTypeIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{notification.title}</div>
          {notification.message && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {notification.message}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 text-xs text-muted-foreground">
          {formatRelativeTime(notification.timestamp)}
        </div>

        {!notification.persistent && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss(notification.id)
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card
      variant="outlined"
      padding="none"
      className={cn(
        'border-l-4 group hover:shadow-md transition-all',
        getTypeColors(notification.type)
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {notification.icon || getTypeIcon(notification.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-sm">{notification.title}</h4>
                {notification.source && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {notification.source}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(notification.timestamp)}
                </span>
                {!notification.persistent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onDismiss(notification.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {notification.message && (
              <p className="text-sm text-muted-foreground mb-3">
                {notification.message}
              </p>
            )}

            {notification.action && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(notification.id, notification.action!.onClick)}
              >
                {notification.action.label}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
})

interface NotificationFilterProps {
  selectedFilter: string
  onFilterChange: (filter: string) => void
  counts: { [key: string]: number }
}

const NotificationFilter: React.FC<NotificationFilterProps> = ({
  selectedFilter,
  onFilterChange,
  counts
}) => {
  const filters = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'unread', label: 'Unread', count: counts.unread },
    { id: 'important', label: 'Important', count: counts.important },
    { id: 'mail', label: 'Mail', count: counts.mail },
    { id: 'calendar', label: 'Calendar', count: counts.calendar },
    { id: 'system', label: 'System', count: counts.system }
  ]

  return (
    <div className="flex flex-wrap gap-1 p-4 border-b border-border bg-muted/30">
      {filters.map(filter => (
        <Button
          key={filter.id}
          size="sm"
          variant={selectedFilter === filter.id ? 'secondary' : 'ghost'}
          className={cn(
            'h-8 px-3 text-xs font-medium',
            selectedFilter === filter.id && 'shadow-sm'
          )}
          onClick={() => onFilterChange(filter.id)}
        >
          {filter.label}
          {filter.count > 0 && (
            <span className={cn(
              'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
              selectedFilter === filter.id 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            )}>
              {filter.count}
            </span>
          )}
        </Button>
      ))}
    </div>
  )
}

export interface NotificationsHubProps extends BaseComponentProps {
  compact?: boolean
  maxHeight?: number
  onNotificationAction?: (id: string, action: () => void) => void
  onNotificationDismiss?: (id: string) => void
  onMarkAllRead?: () => void
  onClearAll?: () => void
}

export const NotificationsHub: React.FC<NotificationsHubProps> = ({
  compact = false,
  maxHeight = 600,
  onNotificationAction,
  onNotificationDismiss,
  onMarkAllRead,
  onClearAll,
  className,
  'data-testid': testId
}) => {
  const [notifications, setNotifications] = useState(mockNotifications)
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set())

  const handleDismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    onNotificationDismiss?.(id)
  }, [onNotificationDismiss])

  const handleAction = useCallback((id: string, action: () => void) => {
    action()
    setReadNotifications(prev => new Set([...Array.from(prev), id]))
    onNotificationAction?.(id, action)
  }, [onNotificationAction])

  const handleMarkAllRead = useCallback(() => {
    setReadNotifications(new Set(notifications.map(n => n.id)))
    onMarkAllRead?.()
  }, [notifications, onMarkAllRead])

  const handleClearAll = useCallback(() => {
    setNotifications([])
    setReadNotifications(new Set())
    onClearAll?.()
  }, [onClearAll])

  const filteredNotifications = notifications.filter(notification => {
    switch (selectedFilter) {
      case 'unread':
        return !readNotifications.has(notification.id)
      case 'important':
        return notification.persistent || notification.type === 'error'
      case 'mail':
        return notification.source?.toLowerCase() === 'mail'
      case 'calendar':
        return notification.source?.toLowerCase() === 'calendar'
      case 'system':
        return notification.source?.toLowerCase() === 'system'
      default:
        return true
    }
  })

  const counts = {
    all: notifications.length,
    unread: notifications.filter(n => !readNotifications.has(n.id)).length,
    important: notifications.filter(n => n.persistent || n.type === 'error').length,
    mail: notifications.filter(n => n.source?.toLowerCase() === 'mail').length,
    calendar: notifications.filter(n => n.source?.toLowerCase() === 'calendar').length,
    system: notifications.filter(n => n.source?.toLowerCase() === 'system').length
  }

  return (
    <div className={cn('flex flex-col bg-card border border-border rounded-lg shadow-lg overflow-hidden', className)} data-testid={testId}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5" />
          <div>
            <h2 className="font-semibold text-lg">Notifications</h2>
            {counts.unread > 0 && (
              <p className="text-sm text-muted-foreground">
                {counts.unread} unread
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {counts.unread > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMarkAllRead}
              leftIcon={<Check className="h-4 w-4" />}
            >
              Mark all read
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearAll}
            leftIcon={<Archive className="h-4 w-4" />}
          >
            Clear all
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {!compact && (
        <NotificationFilter
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
          counts={counts}
        />
      )}

      {/* Notifications List */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: compact ? 400 : maxHeight }}
      >
        {filteredNotifications.length > 0 ? (
          <div className={cn(
            compact ? 'divide-y divide-border' : 'p-4 space-y-3'
          )}>
            {filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onDismiss={handleDismiss}
                onAction={handleAction}
                compact={compact}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              {selectedFilter === 'all' 
                ? "You're all caught up!" 
                : `No ${selectedFilter} notifications`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}