import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { List } from 'react-window'
import { 
  Avatar,
  Button,
  cn,
  Star,
  Paperclip,
  Reply,
  Archive,
  Trash2,
  Mail,
} from '../ui'
import type { EmailMessage } from '@flow-desk/shared'

interface VirtualizedMailListProps {
  messages: EmailMessage[]
  selectedMessageId?: string
  onMessageSelect: (messageId: string) => void
  onToggleStar?: (messageId: string) => void
  onToggleRead?: (messageId: string, isRead: boolean) => void
  onReply?: (messageId: string) => void
  onArchive?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  height: number
  className?: string
  showQuickActions?: boolean
}

interface MessageItemData {
  messages: EmailMessage[]
  selectedMessageId?: string
  onMessageSelect: (messageId: string) => void
  onToggleStar?: (messageId: string) => void
  onToggleRead?: (messageId: string, isRead: boolean) => void
  onReply?: (messageId: string) => void
  onArchive?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  showQuickActions?: boolean
}

type MessageItemProps = {
  index: number;
  style: React.CSSProperties;
  data: MessageItemData;
}

const ITEM_HEIGHT = 80 // Height of each message item in pixels

const MessageItem: React.FC<MessageItemProps> = ({ index, style, data }) => {
  const { 
    messages, 
    selectedMessageId, 
    onMessageSelect, 
    onToggleStar, 
    onToggleRead, 
    onReply, 
    onArchive, 
    onDelete,
    showQuickActions = false
  } = data
  const message = messages[index]
  const [isHovered, setIsHovered] = useState(false)
  
  if (!message) return null

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div style={style}>
      <div
        className={cn(
          'border-b border-border p-4 cursor-pointer hover:bg-accent/50 transition-colors mx-2 group relative',
          selectedMessageId === message.id && 'bg-accent',
          !message.flags?.isRead && 'bg-muted/30'
        )}
        onClick={() => onMessageSelect(message.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-start gap-3">
          <Avatar
            size="sm"
            fallback={message.from.address?.charAt(0).toUpperCase() || '?'}
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'font-medium text-sm truncate',
                !message.flags?.isRead && 'font-semibold'
              )}>
                {message.from.name || message.from.address}
              </span>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                {message.flags?.isStarred && (
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                )}
                {message.flags?.hasAttachments && (
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            
            <div className={cn(
              'text-sm mb-1 truncate',
              !message.flags?.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'
            )}>
              {message.subject || '(No subject)'}
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate flex-1">
                {message.snippet}
              </span>
              <span className="ml-2 flex-shrink-0">
                {formatDate(message.date)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Quick Actions Overlay */}
        {showQuickActions && isHovered && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-card border border-border rounded-lg shadow-lg p-1">
            {onToggleStar && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStar(message.id)
                }}
                className={cn(
                  "h-7 w-7 p-0",
                  message.flags?.isStarred && "text-yellow-500"
                )}
                title={message.flags?.isStarred ? "Unstar" : "Star"}
              >
                <Star className={cn("h-3 w-3", message.flags?.isStarred && "fill-current")} />
              </Button>
            )}
            
            {onToggleRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleRead(message.id, !message.flags?.isRead)
                }}
                className="h-7 w-7 p-0"
                title={message.flags?.isRead ? "Mark as unread" : "Mark as read"}
              >
                {message.flags?.isRead ? (
                  <Mail className="h-3 w-3" />
                ) : (
                  <Mail className="h-3 w-3" />
                )}
              </Button>
            )}
            
            {onReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onReply(message.id)
                }}
                className="h-7 w-7 p-0"
                title="Reply"
              >
                <Reply className="h-3 w-3" />
              </Button>
            )}
            
            {onArchive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onArchive(message.id)
                }}
                className="h-7 w-7 p-0"
                title="Archive"
              >
                <Archive className="h-3 w-3" />
              </Button>
            )}
            
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(message.id)
                }}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const VirtualizedMailList: React.FC<VirtualizedMailListProps> = ({
  messages,
  selectedMessageId,
  onMessageSelect,
  onToggleStar,
  onToggleRead,
  onReply,
  onArchive,
  onDelete,
  height,
  className,
  showQuickActions = false
}) => {
  const listRef = useRef<any>(null)

  // Scroll to selected message when selection changes
  useEffect(() => {
    if (selectedMessageId && listRef.current) {
      const messageIndex = messages.findIndex(m => m.id === selectedMessageId)
      if (messageIndex !== -1) {
        listRef.current.scrollToItem(messageIndex, 'smart')
      }
    }
  }, [selectedMessageId, messages])

  // Memoize the data object to prevent unnecessary re-renders
  const itemData = useMemo<MessageItemData>(() => ({
    messages,
    selectedMessageId,
    onMessageSelect,
    onToggleStar,
    onToggleRead,
    onReply,
    onArchive,
    onDelete,
    showQuickActions
  }), [messages, selectedMessageId, onMessageSelect, onToggleStar, onToggleRead, onReply, onArchive, onDelete, showQuickActions])

  if (messages.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-center", className)}>
        <div className="text-6xl mb-4">📭</div>
        <h3 className="text-lg font-medium mb-2">No messages</h3>
        <p className="text-sm text-muted-foreground">
          Your mailbox is empty
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <List
        ref={listRef}
        height={height}
        itemCount={messages.length}
        itemSize={ITEM_HEIGHT}
        itemData={itemData}
        overscanCount={5}
      >
        {MessageItem}
      </List>
    </div>
  )
}

export default VirtualizedMailList