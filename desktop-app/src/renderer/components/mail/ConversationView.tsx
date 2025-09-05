import React, { useState, useCallback, useMemo } from 'react'
import { 
  Avatar,
  Button,
  Card,
  cn,
  ChevronDown,
  ChevronRight,
  Star,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Paperclip,
  MoreHorizontal
} from '../ui'
// import AttachmentList from './AttachmentList' // TODO: Create AttachmentList component
import type { EmailMessage } from '@flow-desk/shared'

interface ConversationThread {
  id: string
  subject: string
  participants: Array<{ name: string; address: string }>
  messages: EmailMessage[]
  unreadCount: number
  lastMessageDate: Date
  hasAttachments: boolean
  isStarred: boolean
}

interface ConversationViewProps {
  thread: ConversationThread
  onReply: (messageId: string) => void
  onReplyAll: (messageId: string) => void
  onForward: (messageId: string) => void
  onArchive: (threadId: string) => void
  onDelete: (threadId: string) => void
  onToggleStar: (threadId: string) => void
  onMarkRead: (messageId: string, isRead: boolean) => void
  onDownloadAttachment: (attachment: any) => void
  className?: string
}

const MessageHeader: React.FC<{
  message: EmailMessage
  isExpanded: boolean
  onToggleExpand: () => void
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onMarkRead: (isRead: boolean) => void
}> = ({ message, isExpanded, onToggleExpand, onReply, onReplyAll, onForward, onMarkRead }) => {
  const formatDate = (date: Date) => {
    return date.toLocaleString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="flex items-center gap-3 p-3 border-b border-border hover:bg-muted/50 transition-colors">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleExpand}
        className="p-1"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
      
      <Avatar
        size="sm"
        fallback={message.from.address?.charAt(0).toUpperCase() || '?'}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "font-medium text-sm",
            !message.flags?.isRead && "font-semibold"
          )}>
            {message.from.name || message.from.address}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(message.date)}
          </span>
        </div>
        
        {!isExpanded && (
          <div className="text-sm text-muted-foreground truncate mt-1">
            {message.snippet}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        {message.flags?.hasAttachments && (
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        )}
        
        {!message.flags?.isRead && (
          <div className="w-2 h-2 rounded-full bg-primary"></div>
        )}
        
        {isExpanded && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" onClick={onReply}>
              <Reply className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onReplyAll}>
              <ReplyAll className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onForward}>
              <Forward className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkRead(!message.flags?.isRead)}
            >
              {message.flags?.isRead ? 'Mark Unread' : 'Mark Read'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

const MessageContent: React.FC<{
  message: EmailMessage
  onDownloadAttachment: (attachment: any) => void
}> = ({ message, onDownloadAttachment }) => {
  return (
    <div className="p-4 space-y-4">
      {/* Message Headers */}
      <div className="text-sm space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">From:</span>
          <span>{message.from.name || message.from.address}</span>
        </div>
        {message.to && message.to.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground">To:</span>
            <span>{message.to.map(addr => addr.name || addr.address).join(', ')}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">Date:</span>
          <span>{message.date.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Message Body */}
      <div className="prose prose-sm max-w-none">
        {message.bodyHtml ? (
          <div 
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
            className="email-content"
          />
        ) : (
          <div className="whitespace-pre-wrap font-mono text-sm">
            {message.bodyText}
          </div>
        )}
      </div>
      
      {/* Attachments */}
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {message.attachments.map((attachment, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onDownloadAttachment?.(attachment)}
              className="text-xs"
            >
              <Paperclip className="h-3 w-3 mr-1" />
              {attachment.filename}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  thread,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onToggleStar,
  onMarkRead,
  onDownloadAttachment,
  className
}) => {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set([thread.messages[thread.messages.length - 1]?.id]))

  const toggleMessageExpanded = useCallback((messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }, [])

  const handleReply = useCallback((messageId: string) => {
    onReply(messageId)
  }, [onReply])

  const handleReplyAll = useCallback((messageId: string) => {
    onReplyAll(messageId)
  }, [onReplyAll])

  const handleForward = useCallback((messageId: string) => {
    onForward(messageId)
  }, [onForward])

  const handleMarkRead = useCallback((messageId: string, isRead: boolean) => {
    onMarkRead(messageId, isRead)
  }, [onMarkRead])

  const sortedMessages = useMemo(() => {
    return [...thread.messages].sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [thread.messages])

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Thread Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{thread.subject}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span>{thread.messages.length} messages</span>
              {thread.unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs">
                  {thread.unreadCount} unread
                </span>
              )}
              {thread.hasAttachments && (
                <Paperclip className="h-4 w-4" />
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleStar(thread.id)}
              className={cn(thread.isStarred && "text-yellow-500")}
            >
              <Star className={cn("h-4 w-4", thread.isStarred && "fill-current")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onArchive(thread.id)}>
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(thread.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {sortedMessages.map((message, index) => {
            const isExpanded = expandedMessages.has(message.id)
            const isLast = index === sortedMessages.length - 1
            
            return (
              <Card key={message.id} className={cn(
                "overflow-hidden transition-all",
                isExpanded && "ring-1 ring-border",
                !message.flags?.isRead && "bg-muted/30"
              )}>
                <div className="group">
                  <MessageHeader
                    message={message}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleMessageExpanded(message.id)}
                    onReply={() => handleReply(message.id)}
                    onReplyAll={() => handleReplyAll(message.id)}
                    onForward={() => handleForward(message.id)}
                    onMarkRead={(isRead) => handleMarkRead(message.id, isRead)}
                  />
                  
                  {isExpanded && (
                    <MessageContent
                      message={message}
                      onDownloadAttachment={onDownloadAttachment}
                    />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ConversationView