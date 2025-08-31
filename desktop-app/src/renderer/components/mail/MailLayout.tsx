import React, { useState, useCallback, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import { 
  ResizableContainer,
  ResizablePanel,
  Card,
  Button,
  Input,
  Avatar,
  cn,
  Search,
  Plus,
  Filter,
  Star,
  Paperclip,
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Archive,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  RefreshCw
} from '../ui'
import { type BaseComponentProps } from '../ui/types'
import type { EmailMessage, MailFolder } from '@flow-desk/shared'
import {
  fetchMailAccounts,
  fetchMessages,
  fetchFolders,
  markMessageRead,
  syncMailAccount,
  setCurrentAccount,
  setCurrentFolder,
  selectMailAccounts,
  selectCurrentAccount,
  selectCurrentMessages,
  selectCurrentFolders,
  selectIsLoadingMail,
  selectMailError
} from '../../store/slices/mailSlice'
import SimpleMailAccountModal from './SimpleMailAccountModal'
import { ComposeModal } from './ComposeModal'
import { MailErrorBoundary } from './MailErrorBoundary'
import { useMailSync } from '../../hooks/useMailSync'
import { useMailNotifications, ToastContainer } from '../../hooks/useMailNotifications'

interface FolderListProps {
  folders: MailFolder[]
  selectedFolder: string
  onFolderSelect: (folderId: string) => void
  onCompose: () => void
  isLoading: boolean
}

const FolderList: React.FC<FolderListProps> = ({
  folders,
  selectedFolder,
  onFolderSelect,
  onCompose,
  isLoading
}) => {

  // Default folders with icons
  const getFolderIcon = (folderType: string) => {
    switch (folderType) {
      case 'inbox': return '📥'
      case 'sent': return '📤'
      case 'drafts': return '📝'
      case 'spam': return '🚫'
      case 'trash': return '🗑️'
      case 'archive': return '📦'
      default: return '📁'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Mail</h2>
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={onCompose}>
            Compose
          </Button>
        </div>
        
        <Input
          type="search"
          placeholder="Search mail..."
          leftIcon={<Search className="h-4 w-4" />}
          className="w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Loading folders...</span>
          </div>
        ) : (
          <div className="space-y-1">
            {folders.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No folders found
              </p>
            ) : (
              folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant={selectedFolder === folder.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-3 h-10 px-3"
                  onClick={() => onFolderSelect(folder.id)}
                >
                  <span className="text-lg">{getFolderIcon(folder.type)}</span>
                  <span className="flex-1 text-left font-medium">{folder.displayName}</span>
                  {folder.unreadCount > 0 && (
                    <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full min-w-[1.5rem] text-center">
                      {folder.unreadCount}
                    </span>
                  )}
                </Button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface MessageListProps {
  messages: EmailMessage[]
  selectedMessageId: string | null
  onMessageSelect: (messageId: string) => void
  currentFolder: string
  isLoading: boolean
  onRefresh: () => void
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  selectedMessageId,
  onMessageSelect,
  currentFolder,
  isLoading,
  onRefresh
}) => {
  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    
    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      })
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const folderDisplayName = currentFolder.charAt(0).toUpperCase() + currentFolder.slice(1)

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">{folderDisplayName}</h3>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowAddAccountModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button size="sm" variant="ghost">
              <Filter className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-medium mb-2">No messages</h3>
            <p className="text-sm text-muted-foreground">
              {currentFolder === 'inbox' ? 'Your inbox is empty' : `No messages in ${folderDisplayName}`}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'border-b border-border p-4 cursor-pointer hover:bg-accent/50 transition-colors',
                selectedMessageId === message.id && 'bg-accent',
                !message.flags.isRead && 'bg-muted/30'
              )}
              onClick={() => onMessageSelect(message.id)}
            >
              <div className="flex items-start gap-3">
                <Avatar
                  size="sm"
                  fallback={message.from.address.charAt(0).toUpperCase()}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'font-medium text-sm truncate',
                      !message.flags.isRead && 'font-semibold'
                    )}>
                      {message.from.name || message.from.address}
                    </span>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {message.flags.isStarred && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                      {message.flags.hasAttachments && (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  <div className={cn(
                    'text-sm mb-1 truncate',
                    !message.flags.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'
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
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface MessageViewProps {
  message: EmailMessage | null
  onReply: () => void
  onReplyAll: () => void
  onForward: () => void
  onDelete: () => void
  onArchive: () => void
  onMarkRead: (read: boolean) => void
}

const MessageView: React.FC<MessageViewProps> = ({
  message,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onArchive,
  onMarkRead
}) => {
  if (!message) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <div className="text-6xl mb-4">📧</div>
          <h3 className="text-lg font-medium mb-2">No message selected</h3>
          <p className="text-sm">Choose a message from the list to view it here</p>
        </div>
      </div>
    )
  }

  const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    const mb = kb / 1024
    return `${Math.round(mb * 10) / 10} MB`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="font-semibold text-lg mb-2">{message.subject || '(No subject)'}</h2>
            
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar
                  size="xs"
                  fallback={message.from.address.charAt(0).toUpperCase()}
                />
                <span>
                  <strong className="text-foreground">{message.from.name || message.from.address}</strong> 
                  {' to '}
                  <strong className="text-foreground">
                    {message.to.map(addr => addr.name || addr.address).join(', ')}
                  </strong>
                </span>
              </div>
              
              <span>•</span>
              
              <span>{message.date.toLocaleString()}</span>
            </div>

            {message.cc && message.cc.length > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                CC: {message.cc.map(addr => addr.name || addr.address).join(', ')}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onMarkRead(!message.flags.isRead)}
              title={message.flags.isRead ? 'Mark as unread' : 'Mark as read'}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                message.flags.isRead ? "bg-muted-foreground" : "bg-flow-primary-500"
              )} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onReply}>
              <Reply className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onReplyAll}>
              <ReplyAll className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onForward}>
              <Forward className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Attachments ({message.attachments.length})</div>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 cursor-pointer"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="text-sm font-medium">{attachment.filename}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="prose prose-sm max-w-none">
          {message.bodyHtml ? (
            <div dangerouslySetInnerHTML={{ __html: message.bodyHtml }} />
          ) : (
            message.bodyText?.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4 last:mb-0 whitespace-pre-wrap">
                {paragraph || '\u00A0'}
              </p>
            )) || (
              <p className="text-muted-foreground">No content available</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export interface MailLayoutProps extends BaseComponentProps {
  onComposeNew?: () => void
}

export const MailLayout: React.FC<MailLayoutProps> = ({
  onComposeNew,
  className,
  'data-testid': testId
}) => {
  const dispatch = useAppDispatch()
  
  // Redux selectors
  const accounts = useAppSelector(selectMailAccounts)
  const currentAccount = useAppSelector(selectCurrentAccount)
  const messages = useAppSelector(selectCurrentMessages)
  const folders = useAppSelector(selectCurrentFolders)
  const isLoading = useAppSelector(selectIsLoadingMail)
  const error = useAppSelector(selectMailError)
  
  // Local state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [folderPanelSize, setFolderPanelSize] = useState(250)
  const [messageListSize, setMessageListSize] = useState(400)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [composeContext, setComposeContext] = useState<{
    replyTo?: EmailMessage
    replyType?: 'reply' | 'reply-all' | 'forward'
  } | null>(null)

  const selectedMessage = selectedMessageId 
    ? messages.find(msg => msg.id === selectedMessageId) || null 
    : null

  // Notification system
  const {
    notifications,
    removeNotification,
    handleNewMessages,
    handleSyncError,
    showError
  } = useMailNotifications()

  // Real-time mail sync
  useMailSync({
    currentAccountId: currentAccount?.id || null,
    currentFolderId: 'inbox', // TODO: get from Redux state
    onNewMessages: (accountId, count) => {
      const account = accounts.find(acc => acc.id === accountId)
      if (account) {
        handleNewMessages(account.email, count)
      }
    },
    onSyncError: (accountId, error) => {
      const account = accounts.find(acc => acc.id === accountId)
      if (account) {
        handleSyncError(account.email, error)
      }
    }
  })

  // Load initial data
  useEffect(() => {
    dispatch(fetchMailAccounts())
  }, [dispatch])

  // Load folders when current account changes
  useEffect(() => {
    if (currentAccount) {
      dispatch(fetchFolders(currentAccount.id))
    }
  }, [dispatch, currentAccount])

  // Load messages when account or folder changes
  useEffect(() => {
    if (currentAccount) {
      const currentFolder = 'inbox' // Default folder
      dispatch(fetchMessages({ 
        accountId: currentAccount.id, 
        folderId: currentFolder 
      }))
    }
  }, [dispatch, currentAccount])

  const handleFolderResize = useCallback((size: number) => {
    setFolderPanelSize(size)
  }, [])

  const handleMessageListResize = useCallback((size: number) => {
    setMessageListSize(size)
  }, [])

  const handleFolderSelect = useCallback((folderId: string) => {
    dispatch(setCurrentFolder(folderId))
    if (currentAccount) {
      dispatch(fetchMessages({ 
        accountId: currentAccount.id, 
        folderId 
      }))
    }
    setSelectedMessageId(null)
  }, [dispatch, currentAccount])

  const handleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageId(messageId)
    
    // Mark message as read if it's unread
    const message = messages.find(msg => msg.id === messageId)
    if (message && !message.flags.isRead && currentAccount) {
      dispatch(markMessageRead({ 
        accountId: currentAccount.id, 
        messageId, 
        read: true 
      }))
    }
  }, [dispatch, messages, currentAccount])

  const handleRefresh = useCallback(() => {
    if (currentAccount) {
      dispatch(syncMailAccount(currentAccount.id))
    }
  }, [dispatch, currentAccount])

  const handleMarkRead = useCallback((read: boolean) => {
    if (selectedMessage && currentAccount) {
      dispatch(markMessageRead({ 
        accountId: currentAccount.id, 
        messageId: selectedMessage.id, 
        read 
      }))
    }
  }, [dispatch, selectedMessage, currentAccount])

  const handleCompose = useCallback(() => {
    setComposeContext(null)
    setShowComposeModal(true)
  }, [])

  const handleReply = useCallback(() => {
    if (selectedMessage) {
      setComposeContext({ replyTo: selectedMessage, replyType: 'reply' })
      setShowComposeModal(true)
    }
  }, [selectedMessage])

  const handleReplyAll = useCallback(() => {
    if (selectedMessage) {
      setComposeContext({ replyTo: selectedMessage, replyType: 'reply-all' })
      setShowComposeModal(true)
    }
  }, [selectedMessage])

  const handleForward = useCallback(() => {
    if (selectedMessage) {
      setComposeContext({ replyTo: selectedMessage, replyType: 'forward' })
      setShowComposeModal(true)
    }
  }, [selectedMessage])

  // Show error if any
  if (error) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)} data-testid={testId}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Error loading mail</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => dispatch(fetchMailAccounts())}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  // Show message if no accounts
  if (!isLoading && accounts.length === 0) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)} data-testid={testId}>
        <div className="text-center">
          <div className="text-6xl mb-4">📧</div>
          <h3 className="text-lg font-medium mb-2">No mail accounts</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add a mail account to get started with Flow Desk Mail
          </p>
          <Button onClick={() => setShowAddAccountModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>
    )
  }

  return (
    <MailErrorBoundary>
      <div className={cn('h-full', className)} data-testid={testId}>
        <ResizableContainer direction="horizontal">
        {/* Folder Panel */}
        <ResizablePanel
          direction="horizontal"
          initialSize={folderPanelSize}
          minSize={200}
          maxSize={350}
          onResize={handleFolderResize}
          className="bg-card border-r border-border"
        >
          <FolderList
            folders={folders}
            selectedFolder="inbox"
            onFolderSelect={handleFolderSelect}
            onCompose={handleCompose}
            isLoading={isLoading}
          />
        </ResizablePanel>

        {/* Message List Panel */}
        <ResizablePanel
          direction="horizontal"
          initialSize={messageListSize}
          minSize={300}
          maxSize={600}
          onResize={handleMessageListResize}
          className="bg-background border-r border-border"
        >
          <MessageList
            messages={messages}
            selectedMessageId={selectedMessageId}
            onMessageSelect={handleMessageSelect}
            currentFolder="inbox"
            isLoading={isLoading}
            onRefresh={handleRefresh}
          />
        </ResizablePanel>

        {/* Message View Panel */}
        <div className="flex-1 bg-background">
          <MessageView
            message={selectedMessage}
            onReply={handleReply}
            onReplyAll={handleReplyAll}
            onForward={handleForward}
            onDelete={() => console.log('Delete')}
            onArchive={() => console.log('Archive')}
            onMarkRead={handleMarkRead}
          />
        </div>
        </ResizableContainer>
      </div>

      <SimpleMailAccountModal
        isOpen={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSuccess={(account) => {
          console.log('Mail account added successfully:', account);
          // TODO: Refresh mail accounts
        }}
      />

      <ComposeModal
        isOpen={showComposeModal}
        onClose={() => {
          setShowComposeModal(false)
          setComposeContext(null)
        }}
        replyTo={composeContext?.replyTo}
        replyType={composeContext?.replyType}
      />

      <ToastContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
    </MailErrorBoundary>
  )
}