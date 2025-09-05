import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { List } from 'react-window'
import { motion } from 'framer-motion'
import { 
  Star, 
  Paperclip, 
  Archive, 
  Trash2, 
  MoreHorizontal,
  Mail,
  MailOpen,
  Flag,
  User
} from 'lucide-react'
import { cn } from '../ui/utils'
import { Avatar, Button } from '../ui'
import { ProgressiveLoading, MessageListSkeleton } from '../ui/LoadingStates'
import { useNotifications } from '../ui/NotificationSystem'
import type { EmailMessage } from '@flow-desk/shared'

interface VirtualizedMessageListProps {
  messages: EmailMessage[]
  selectedMessageId: string | null
  onMessageSelect: (messageId: string) => void
  onMessageAction: (messageId: string, action: 'archive' | 'delete' | 'star' | 'flag') => void
  isLoading: boolean
  height: number
  className?: string
  searchQuery?: string
  filterBy?: 'all' | 'unread' | 'starred' | 'flagged'
  sortBy?: 'date' | 'sender' | 'subject'
  sortOrder?: 'asc' | 'desc'
  showDensityControls?: boolean
}

type MessageDensity = 'comfortable' | 'compact' | 'spacious'

interface MessageItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: EmailMessage[]
    selectedMessageId: string | null
    onMessageSelect: (messageId: string) => void
    onMessageAction: (messageId: string, action: 'archive' | 'delete' | 'star' | 'flag') => void
    searchQuery?: string
    density: MessageDensity
  }
}

// Individual message item component
const MessageItem: React.FC<MessageItemProps> = ({ index, style, data }) => {
  const { messages, selectedMessageId, onMessageSelect, onMessageAction, searchQuery, density } = data
  const message = messages[index]
  const [showActions, setShowActions] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  if (!message) {
    return <div style={style} />
  }

  const isSelected = selectedMessageId === message.id
  const isUnread = !message.flags.isRead

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      })
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  const highlightText = (text: string, query?: string) => {
    if (!query || !text) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-1">
          {part}
        </mark>
      ) : part
    )
  }

  const handleAction = useCallback((action: 'archive' | 'delete' | 'star' | 'flag', event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsAnimating(true)
    onMessageAction(message.id, action)
    
    // Reset animation state after a delay
    setTimeout(() => setIsAnimating(false), 300)
  }, [message.id, onMessageAction])

  const getDensityStyles = () => {
    switch (density) {
      case 'compact':
        return {
          container: 'p-2',
          avatar: 'h-6 w-6 text-xs',
          title: 'text-sm',
          snippet: 'text-xs',
          meta: 'text-xs'
        }
      case 'spacious':
        return {
          container: 'p-6',
          avatar: 'h-12 w-12 text-base',
          title: 'text-base',
          snippet: 'text-sm',
          meta: 'text-sm'
        }
      default: // comfortable
        return {
          container: 'p-4',
          avatar: 'h-10 w-10 text-sm',
          title: 'text-sm',
          snippet: 'text-sm',
          meta: 'text-xs'
        }
    }
  }

  const styles = getDensityStyles()

  return (
    <motion.div
      style={style}
      animate={isAnimating ? { x: -10, opacity: 0.7 } : { x: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={cn(
          'border-b border-border cursor-pointer transition-all duration-150',
          'hover:bg-accent/50 focus:outline-none focus:bg-accent/50',
          isSelected && 'bg-accent border-l-4 border-l-flow-primary-500',
          isUnread && 'bg-muted/30',
          styles.container
        )}
        onClick={() => onMessageSelect(message.id)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        tabIndex={0}
        role="button"
        aria-label={`Email from ${message.from.name || message.from.address}: ${message.subject}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <Avatar
              size={density === 'compact' ? 'sm' : density === 'spacious' ? 'lg' : 'md'}
              fallback={message.from.address.charAt(0).toUpperCase()}
              className={cn(
                isUnread && 'ring-2 ring-flow-primary-500/30',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Message content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {/* Sender */}
                <span className={cn(
                  'font-medium truncate',
                  isUnread ? 'text-foreground font-semibold' : 'text-muted-foreground',
                  styles.title
                )}>
                  {highlightText(message.from.name || message.from.address, searchQuery)}
                </span>
                
                {/* Status indicators */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isUnread ? (
                    <Mail className="h-3 w-3 text-flow-primary-500" />
                  ) : (
                    <MailOpen className="h-3 w-3 text-muted-foreground" />
                  )}
                  
                  {message.flags.isStarred && (
                    <Star className="h-3 w-3 text-yellow-500 fill-current" />
                  )}
                  
                  {message.flags.isFlagged && (
                    <Flag className="h-3 w-3 text-red-500 fill-current" />
                  )}
                  
                  {message.flags.hasAttachments && (
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Actions and date */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Action buttons - shown on hover */}
                {showActions && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleAction('star', e)}
                      title={message.flags.isStarred ? 'Remove star' : 'Add star'}
                    >
                      <Star className={cn(
                        'h-3 w-3',
                        message.flags.isStarred ? 'text-yellow-500 fill-current' : 'text-muted-foreground'
                      )} />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleAction('archive', e)}
                      title="Archive"
                    >
                      <Archive className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleAction('delete', e)}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </motion.div>
                )}

                <span className={cn(
                  'text-muted-foreground tabular-nums',
                  styles.meta
                )}>
                  {formatDate(message.date)}
                </span>
              </div>
            </div>

            {/* Subject */}
            <div className={cn(
              'mb-1 truncate',
              isUnread ? 'font-medium text-foreground' : 'text-muted-foreground',
              styles.title
            )}>
              {highlightText(message.subject || '(No subject)', searchQuery)}
            </div>

            {/* Snippet */}
            <div className={cn(
              'truncate text-muted-foreground',
              styles.snippet
            )}>
              {highlightText(message.snippet || '', searchQuery)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Main virtualized message list component
export const VirtualizedMessageList: React.FC<VirtualizedMessageListProps> = ({
  messages,
  selectedMessageId,
  onMessageSelect,
  onMessageAction,
  isLoading,
  height,
  className,
  searchQuery,
  filterBy = 'all',
  sortBy = 'date',
  sortOrder = 'desc',
  showDensityControls = false
}) => {
  const [density, setDensity] = useState<MessageDensity>('comfortable')
  const listRef = useRef<List<any>>(null)
  const { info } = useNotifications()

  // Filter and sort messages
  const processedMessages = useMemo(() => {
    let filtered = [...messages]

    // Apply filters
    switch (filterBy) {
      case 'unread':
        filtered = filtered.filter(msg => !msg.flags.isRead)
        break
      case 'starred':
        filtered = filtered.filter(msg => msg.flags.isStarred)
        break
      case 'flagged':
        filtered = filtered.filter(msg => msg.flags.isFlagged)
        break
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(msg =>
        msg.subject?.toLowerCase().includes(query) ||
        msg.from.name?.toLowerCase().includes(query) ||
        msg.from.address.toLowerCase().includes(query) ||
        msg.snippet?.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = a.date.getTime() - b.date.getTime()
          break
        case 'sender':
          comparison = (a.from.name || a.from.address).localeCompare(b.from.name || b.from.address)
          break
        case 'subject':
          comparison = (a.subject || '').localeCompare(b.subject || '')
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [messages, filterBy, searchQuery, sortBy, sortOrder])

  // Calculate item height based on density
  const getItemHeight = () => {
    switch (density) {
      case 'compact': return 60
      case 'spacious': return 120
      default: return 80 // comfortable
    }
  }

  // Scroll to selected message
  useEffect(() => {
    if (selectedMessageId && listRef.current) {
      const index = processedMessages.findIndex(msg => msg.id === selectedMessageId)
      if (index >= 0) {
        listRef.current.scrollToItem(index, 'center')
      }
    }
  }, [selectedMessageId, processedMessages])

  const itemData = {
    messages: processedMessages,
    selectedMessageId,
    onMessageSelect,
    onMessageAction,
    searchQuery,
    density
  }

  if (isLoading && processedMessages.length === 0) {
    return (
      <div className={className} style={{ height }}>
        <MessageListSkeleton />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Controls */}
      {showDensityControls && (
        <div className="flex items-center justify-between p-3 border-b border-border bg-card">
          <div className="text-sm text-muted-foreground">
            {processedMessages.length} message{processedMessages.length !== 1 ? 's' : ''}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Density:</span>
            {(['compact', 'comfortable', 'spacious'] as MessageDensity[]).map((d) => (
              <Button
                key={d}
                variant={density === d ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setDensity(d)}
                className="text-xs capitalize"
              >
                {d}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Message list */}
      <div style={{ height: showDensityControls ? height - 60 : height }}>
        {processedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No matching messages' : 'No messages'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery 
                ? `No messages found for "${searchQuery}"`
                : 'This folder is empty'
              }
            </p>
          </div>
        ) : (
          <List
            ref={listRef}
            height={showDensityControls ? height - 60 : height}
            itemCount={processedMessages.length}
            itemSize={getItemHeight()}
            itemData={itemData}
            overscanCount={5}
            className="scrollbar-thin"
          >
            {MessageItem}
          </List>
        )}
      </div>
    </div>
  )
}