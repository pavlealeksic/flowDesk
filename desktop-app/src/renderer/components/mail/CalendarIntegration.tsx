import React, { useState, useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  Button,
  Card,
  cn,
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  X,
  AlertCircle,
  Info,
  ExternalLink,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp
} from '../ui'
import { type BaseComponentProps } from '../ui/types'
import {
  selectMeetingInvites,
  selectUnprocessedInvites,
  selectProductivitySettings,
  extractMeetingInvite,
  respondToMeetingInvite,
  createCalendarEvent
} from '../../store/slices/productivitySlice'
import type { MeetingInvite, CalendarEvent, EventAttendee } from '../../types/productivity'
import type { EmailMessage } from '@flow-desk/shared'

interface CalendarIntegrationProps extends BaseComponentProps {
  message: EmailMessage
  compact?: boolean
}

interface MeetingInviteCardProps {
  invite: MeetingInvite
  onRespond: (response: 'accepted' | 'declined' | 'tentative') => void
  onAddToCalendar: (invite: MeetingInvite) => void
  compact?: boolean
}

const MeetingInviteCard: React.FC<MeetingInviteCardProps> = ({
  invite,
  onRespond,
  onAddToCalendar,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const { event } = invite

  const formatDateTime = (date: Date, endDate?: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }

    if (event.isAllDay) {
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    }

    const start = date.toLocaleString([], options)
    if (endDate && date.toDateString() === endDate.toDateString()) {
      return `${start} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    
    return start
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50 border-green-200'
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getInviteTypeInfo = () => {
    switch (invite.type) {
      case 'invitation':
        return { icon: Calendar, text: 'Meeting Invitation', color: 'text-blue-600' }
      case 'update':
        return { icon: AlertCircle, text: 'Meeting Update', color: 'text-orange-600' }
      case 'cancellation':
        return { icon: X, text: 'Meeting Cancelled', color: 'text-red-600' }
      default:
        return { icon: Info, text: 'Meeting Info', color: 'text-gray-600' }
    }
  }

  const inviteTypeInfo = getInviteTypeInfo()
  const IconComponent = inviteTypeInfo.icon

  return (
    <Card className="border-l-4 border-l-blue-500 bg-blue-50/30">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2">
            <IconComponent className={cn("h-5 w-5 mt-0.5", inviteTypeInfo.color)} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{event.title}</h3>
                <span className={cn(
                  "px-2 py-1 text-xs rounded border",
                  getConfidenceColor(invite.extractedData.confidence)
                )}>
                  {Math.round(invite.extractedData.confidence * 100)}% confidence
                </span>
              </div>
              
              <p className={cn("text-sm", inviteTypeInfo.color)}>
                {inviteTypeInfo.text}
              </p>
            </div>
          </div>
          
          {compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Meeting Details */}
        {isExpanded && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatDateTime(event.startDate, event.endDate)}</span>
              </div>
              
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <IconComponent className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{event.status}</span>
              </div>
            </div>

            {event.description && (
              <div className="p-3 bg-muted/30 rounded text-sm">
                <p className="line-clamp-2">{event.description}</p>
              </div>
            )}

            {/* Attendees */}
            {event.attendees.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Attendees</h4>
                <div className="space-y-1">
                  {event.attendees.slice(0, 3).map((attendee, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        attendee.status === 'accepted' && 'bg-green-500',
                        attendee.status === 'declined' && 'bg-red-500',
                        attendee.status === 'tentative' && 'bg-yellow-500',
                        attendee.status === 'needs-action' && 'bg-gray-400'
                      )} />
                      <span className={cn(attendee.isOrganizer && 'font-medium')}>
                        {attendee.name || attendee.email}
                        {attendee.isOrganizer && ' (Organizer)'}
                      </span>
                    </div>
                  ))}
                  {event.attendees.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{event.attendees.length - 3} more attendees
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Extraction Info */}
            <div className="p-2 bg-muted/20 rounded text-xs text-muted-foreground">
              <p>
                <strong>Extracted fields:</strong> {invite.extractedData.extractedFields.join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
          {invite.type === 'invitation' && !invite.userResponse && (
            <>
              <Button
                size="sm"
                onClick={() => onRespond('accepted')}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRespond('tentative')}
                className="border-yellow-600 text-yellow-700 hover:bg-yellow-50"
              >
                <Clock className="h-4 w-4 mr-1" />
                Maybe
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRespond('declined')}
                className="border-red-600 text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </>
          )}

          {invite.userResponse && (
            <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded text-sm">
              <Check className="h-4 w-4" />
              <span>Responded: {invite.userResponse}</span>
            </div>
          )}

          <div className="flex-1" />

          {!invite.eventId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAddToCalendar(invite)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add to Calendar
            </Button>
          )}

          {invite.eventId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Added to calendar</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export const CalendarIntegration: React.FC<CalendarIntegrationProps> = ({
  message,
  compact = false,
  className
}) => {
  const dispatch = useAppDispatch()
  const meetingInvites = useAppSelector(selectMeetingInvites)
  const settings = useAppSelector(selectProductivitySettings)
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectedInvite, setDetectedInvite] = useState<MeetingInvite | null>(null)

  // Check if this message has meeting content
  const hasMeetingKeywords = useCallback((text: string) => {
    const keywords = [
      'meeting', 'call', 'conference', 'zoom', 'teams', 'skype',
      'appointment', 'schedule', 'calendar', 'invite', 'event',
      'agenda', 'when:', 'where:', 'time:', 'date:', 'location:'
    ]
    
    return keywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    )
  }, [])

  // Auto-detect meeting invites
  useEffect(() => {
    if (!settings.calendar.enableAutoDetection) return
    
    const messageText = (message.bodyText || message.bodyHtml || '').toLowerCase()
    const subject = message.subject.toLowerCase()
    
    const hasKeywords = hasMeetingKeywords(`${subject} ${messageText}`)
    const hasAttachments = message.attachments?.some(att => 
      att.filename.toLowerCase().endsWith('.ics') ||
      att.mimeType === 'text/calendar'
    )

    if (hasKeywords || hasAttachments) {
      // Check if already processed
      const existingInvite = meetingInvites.find(invite => invite.messageId === message.id)
      if (!existingInvite && !isProcessing) {
        setIsProcessing(true)
        dispatch(extractMeetingInvite(message.id))
          .unwrap()
          .then((invite) => {
            setDetectedInvite(invite)
          })
          .catch((error) => {
            console.error('Failed to extract meeting invite:', error)
          })
          .finally(() => {
            setIsProcessing(false)
          })
      }
    }
  }, [message, settings.calendar.enableAutoDetection, meetingInvites, isProcessing, dispatch, hasMeetingKeywords])

  const handleRespond = useCallback(async (response: 'accepted' | 'declined' | 'tentative') => {
    if (!detectedInvite) return
    
    try {
      await dispatch(respondToMeetingInvite({ 
        inviteId: detectedInvite.eventId || detectedInvite.messageId, 
        response 
      })).unwrap()
      
      setDetectedInvite(prev => prev ? { ...prev, userResponse: response } : null)
    } catch (error) {
      console.error('Failed to respond to meeting invite:', error)
    }
  }, [dispatch, detectedInvite])

  const handleAddToCalendar = useCallback(async (invite: MeetingInvite) => {
    try {
      await dispatch(createCalendarEvent(invite.event)).unwrap()
      
      setDetectedInvite(prev => prev ? { 
        ...prev, 
        eventId: invite.event.id,
        processed: true 
      } : null)
      
      if (settings.calendar.autoAddToCalendar) {
        // Would integrate with system calendar here
        console.log('Auto-added to system calendar')
      }
    } catch (error) {
      console.error('Failed to add to calendar:', error)
    }
  }, [dispatch, settings.calendar.autoAddToCalendar])

  // Find existing invite for this message
  const existingInvite = meetingInvites.find(invite => invite.messageId === message.id)
  const currentInvite = detectedInvite || existingInvite

  if (!currentInvite && !isProcessing) {
    return null
  }

  if (isProcessing) {
    return (
      <Card className={cn('border-l-4 border-l-blue-500 bg-blue-50/30', className)}>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">
              Detecting meeting invite...
            </span>
          </div>
        </div>
      </Card>
    )
  }

  if (!currentInvite) return null

  return (
    <div className={className}>
      <MeetingInviteCard
        invite={currentInvite}
        onRespond={handleRespond}
        onAddToCalendar={handleAddToCalendar}
        compact={compact}
      />
    </div>
  )
}

// Standalone component for managing all meeting invites
export const MeetingInvitesManager: React.FC<BaseComponentProps> = ({ className }) => {
  const unprocessedInvites = useAppSelector(selectUnprocessedInvites)
  const allInvites = useAppSelector(selectMeetingInvites)
  const dispatch = useAppDispatch()

  const handleRespond = useCallback(async (inviteId: string, response: 'accepted' | 'declined' | 'tentative') => {
    try {
      await dispatch(respondToMeetingInvite({ inviteId, response })).unwrap()
    } catch (error) {
      console.error('Failed to respond to meeting invite:', error)
    }
  }, [dispatch])

  const handleAddToCalendar = useCallback(async (invite: MeetingInvite) => {
    try {
      await dispatch(createCalendarEvent(invite.event)).unwrap()
    } catch (error) {
      console.error('Failed to add to calendar:', error)
    }
  }, [dispatch])

  if (allInvites.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No meeting invites detected</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {unprocessedInvites.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Pending Meeting Invites</h3>
          {unprocessedInvites.map(invite => (
            <MeetingInviteCard
              key={invite.messageId}
              invite={invite}
              onRespond={(response) => handleRespond(invite.eventId || invite.messageId, response)}
              onAddToCalendar={handleAddToCalendar}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-lg font-medium">All Meeting Invites</h3>
        {allInvites.map(invite => (
          <MeetingInviteCard
            key={invite.messageId}
            invite={invite}
            onRespond={(response) => handleRespond(invite.eventId || invite.messageId, response)}
            onAddToCalendar={handleAddToCalendar}
            compact={true}
          />
        ))}
      </div>
    </div>
  )
}