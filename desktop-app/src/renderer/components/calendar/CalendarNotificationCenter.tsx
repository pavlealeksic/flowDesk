import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  markNotificationRead,
  clearNotifications,
  addNotification
} from '../../store/slices/calendarSlice'
import {
  Button,
  Card,
  Badge,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui'
import {
  Bell,
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Settings,
  Mail,
  Video,
  MapPin,
  MoreVertical,
  Trash2,
  MarkAsUnread
} from 'lucide-react'
import dayjs from 'dayjs'
import type { CalendarNotification } from '../../../store/slices/calendarSlice'

interface CalendarNotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export const CalendarNotificationCenter: React.FC<CalendarNotificationCenterProps> = ({
  isOpen,
  onClose
}) => {
  const dispatch = useAppDispatch()
  const { notifications, events, accounts } = useAppSelector(state => state.calendar)
  const [selectedTab, setSelectedTab] = useState('all')

  // Filter notifications by type
  const filteredNotifications = notifications.filter(notification => {
    if (selectedTab === 'all') return true
    if (selectedTab === 'unread') return !notification.read
    if (selectedTab === 'reminders') return notification.type === 'event_reminder'
    if (selectedTab === 'invitations') return notification.type === 'meeting_invitation'
    return false
  })

  // Get notification icon
  const getNotificationIcon = (notification: CalendarNotification) => {
    switch (notification.type) {
      case 'event_reminder':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'meeting_invitation':
        return <Users className="h-4 w-4 text-green-500" />
      case 'event_update':
        return <Calendar className="h-4 w-4 text-orange-500" />
      case 'conflict_detected':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  // Get priority color
  const getPriorityColor = (priority: CalendarNotification['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 border-red-300'
      case 'high': return 'bg-orange-100 border-orange-300'
      case 'normal': return 'bg-blue-100 border-blue-300'
      case 'low': return 'bg-gray-100 border-gray-300'
    }
  }

  // Handle notification action
  const handleNotificationAction = useCallback((notification: CalendarNotification, actionType: string) => {
    switch (actionType) {
      case 'mark_read':
        if (!notification.read) {
          dispatch(markNotificationRead(notification.id))
        }
        break
      case 'dismiss':
        // Remove notification (in real app, would call API)
        break
      case 'snooze':
        // Snooze notification (would reschedule)
        break
      case 'accept_invitation':
        // Accept meeting invitation
        break
      case 'decline_invitation':
        // Decline meeting invitation
        break
      case 'view_event':
        // Navigate to event details
        if (notification.eventId) {
          // Would navigate to event
          onClose()
        }
        break
    }
  }, [dispatch, onClose])

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    notifications
      .filter(n => !n.read)
      .forEach(n => dispatch(markNotificationRead(n.id)))
  }, [notifications, dispatch])

  const unreadCount = notifications.filter(n => !n.read).length

  if (!isOpen) return null

  return (
    <Card className="fixed top-16 right-4 w-96 max-h-[600px] z-50 shadow-lg border bg-background">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={markAllAsRead} disabled={unreadCount === 0}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark all as read
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => dispatch(clearNotifications())}
                disabled={notifications.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear all notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="h-4 w-4 mr-2" />
                Notification settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 p-1 m-4 mb-0">
          <TabsTrigger value="all" className="text-xs">
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread" className="text-xs">
            Unread ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="reminders" className="text-xs">
            Reminders
          </TabsTrigger>
          <TabsTrigger value="invitations" className="text-xs">
            Invites
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-0">
          <ScrollArea className="h-96">
            <div className="p-2">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotifications.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onAction={handleNotificationAction}
                      getPriorityColor={getPriorityColor}
                      getNotificationIcon={getNotificationIcon}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  )
}

interface NotificationCardProps {
  notification: CalendarNotification
  onAction: (notification: CalendarNotification, actionType: string) => void
  getPriorityColor: (priority: CalendarNotification['priority']) => string
  getNotificationIcon: (notification: CalendarNotification) => React.ReactNode
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onAction,
  getPriorityColor,
  getNotificationIcon
}) => {
  const isUrgent = notification.priority === 'urgent'
  const timeAgo = dayjs(notification.timestamp).fromNow()

  return (
    <Card
      className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
        !notification.read ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
      } ${isUrgent ? 'animate-pulse' : ''}`}
      onClick={() => {
        if (!notification.read) {
          onAction(notification, 'mark_read')
        }
        if (notification.eventId) {
          onAction(notification, 'view_event')
        }
      }}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 mt-0.5">
          <AvatarFallback className={getPriorityColor(notification.priority)}>
            {getNotificationIcon(notification)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
              {notification.title}
            </h4>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isUrgent && (
                <Badge variant="destructive" className="text-xs">
                  Urgent
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {timeAgo}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>

          {/* Action buttons for actionable notifications */}
          {notification.actionable && notification.actions && (
            <div className="flex gap-1 mt-2">
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.type === 'accept' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction(notification, action.type)
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// Hook to manage calendar notifications
export const useCalendarNotifications = () => {
  const dispatch = useAppDispatch()

  // Create different types of notifications
  const createEventReminder = useCallback((eventTitle: string, eventId: string, minutesUntil: number) => {
    dispatch(addNotification({
      id: `reminder-${eventId}-${Date.now()}`,
      type: 'event_reminder',
      title: 'Upcoming Event',
      message: `${eventTitle} starts in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`,
      eventId,
      priority: minutesUntil <= 5 ? 'urgent' : minutesUntil <= 15 ? 'high' : 'normal',
      timestamp: new Date(),
      read: false,
      actionable: true,
      actions: [
        { type: 'view_event', label: 'View Event', handler: 'viewEvent' },
        { type: 'snooze', label: 'Snooze 5m', handler: 'snoozeReminder' }
      ]
    }))
  }, [dispatch])

  const createMeetingInvitation = useCallback((organizerName: string, eventTitle: string, eventId: string) => {
    dispatch(addNotification({
      id: `invitation-${eventId}-${Date.now()}`,
      type: 'meeting_invitation',
      title: 'Meeting Invitation',
      message: `${organizerName} invited you to "${eventTitle}"`,
      eventId,
      priority: 'high',
      timestamp: new Date(),
      read: false,
      actionable: true,
      actions: [
        { type: 'accept_invitation', label: 'Accept', handler: 'acceptInvitation' },
        { type: 'decline_invitation', label: 'Decline', handler: 'declineInvitation' },
        { type: 'view_event', label: 'View Details', handler: 'viewEvent' }
      ]
    }))
  }, [dispatch])

  const createEventUpdate = useCallback((eventTitle: string, eventId: string, changes: string[]) => {
    dispatch(addNotification({
      id: `update-${eventId}-${Date.now()}`,
      type: 'event_update',
      title: 'Event Updated',
      message: `"${eventTitle}" has been updated: ${changes.join(', ')}`,
      eventId,
      priority: 'normal',
      timestamp: new Date(),
      read: false,
      actionable: true,
      actions: [
        { type: 'view_event', label: 'View Changes', handler: 'viewEvent' }
      ]
    }))
  }, [dispatch])

  const createConflictDetected = useCallback((eventTitle: string, conflictingEvent: string) => {
    dispatch(addNotification({
      id: `conflict-${Date.now()}`,
      type: 'conflict_detected',
      title: 'Scheduling Conflict',
      message: `"${eventTitle}" conflicts with "${conflictingEvent}"`,
      priority: 'high',
      timestamp: new Date(),
      read: false,
      actionable: true,
      actions: [
        { type: 'resolve_conflict', label: 'Resolve', handler: 'resolveConflict' },
        { type: 'ignore_conflict', label: 'Ignore', handler: 'ignoreConflict' }
      ]
    }))
  }, [dispatch])

  return {
    createEventReminder,
    createMeetingInvitation,
    createEventUpdate,
    createConflictDetected
  }
}