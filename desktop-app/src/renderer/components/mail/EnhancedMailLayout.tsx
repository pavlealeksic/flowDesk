import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import {
  selectMailAccounts,
  selectCurrentAccount,
  selectCurrentMessages,
  selectCurrentFolders,
  selectIsLoadingMail,
  selectMailError,
  fetchMailAccounts,
  fetchMessages,
  fetchFolders,
  markMessageRead,
  setCurrentAccount
} from '../../store/slices/mailSlice'
import { ResizableContainer, ResizablePanel, Card, Button, cn } from '../ui'
import VirtualizedMailList from './VirtualizedMailList'
import ConversationView from './ConversationView'
import UnifiedInboxView from './UnifiedInboxView'
import SmartMailboxes from './SmartMailboxes'
import AttachmentList from './AttachmentList'
import { ComposeModal } from './ComposeModal'
import type { EmailMessage, MailFolder, MailAccount } from '@flow-desk/shared'

interface EnhancedMailLayoutProps {
  className?: string
  'data-testid'?: string
}

type ViewMode = 'folders' | 'unified' | 'smart' | 'thread'

export const EnhancedMailLayout: React.FC<EnhancedMailLayoutProps> = ({
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
  
  // Layout state
  const [viewMode, setViewMode] = useState<ViewMode>('folders')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [selectedSmartMailbox, setSelectedSmartMailbox] = useState<string | null>(null)
  const [currentThread, setCurrentThread] = useState<any>(null)
  const [smartMailboxMessages, setSmartMailboxMessages] = useState<EmailMessage[]>([])
  
  // Panel sizes
  const [leftPanelSize, setLeftPanelSize] = useState(280)
  const [centerPanelSize, setCenterPanelSize] = useState(400)
  
  // Modal state
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [composeContext, setComposeContext] = useState<{
    replyTo?: EmailMessage
    replyType?: 'reply' | 'reply-all' | 'forward'
  } | null>(null)
  
  // Container height for virtualization
  const [containerHeight, setContainerHeight] = useState(600)
  const centerPanelRef = useRef<HTMLDivElement>(null)

  // Calculate container height for virtualized lists
  useEffect(() => {
    const updateHeight = () => {
      if (centerPanelRef.current) {
        const rect = centerPanelRef.current.getBoundingClientRect()
        setContainerHeight(rect.height || 600)
      }
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)
    
    return () => {
      window.removeEventListener('resize', updateHeight)
    }
  }, [centerPanelSize])

  // Load initial data
  useEffect(() => {
    dispatch(fetchMailAccounts())
  }, [dispatch])

  // Load folders and messages when account changes
  useEffect(() => {
    if (currentAccount) {
      dispatch(fetchFolders(currentAccount.id))
      dispatch(fetchMessages({ accountId: currentAccount.id, folderId: 'inbox' }))
    }
  }, [dispatch, currentAccount])

  const selectedMessage = selectedMessageId 
    ? messages.find(msg => msg.id === selectedMessageId) || null 
    : null

  // Handle view mode changes
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    setSelectedMessageId(null)
    setSelectedSmartMailbox(null)
    setCurrentThread(null)
  }, [])

  // Handle message selection
  const handleMessageSelect = useCallback((messageId: string) => {
    setSelectedMessageId(messageId)
    
    // Mark as read when selected
    const message = messages.find(m => m.id === messageId)
    if (message && !message.flags?.isRead) {
      dispatch(markMessageRead({ 
        accountId: currentAccount?.id || '', 
        messageId, 
        read: true 
      }))
    }
  }, [messages, dispatch, currentAccount])

  // Handle smart mailbox selection
  const handleSmartMailboxSelect = useCallback((mailboxId: string, filteredMessages: EmailMessage[]) => {
    setSelectedSmartMailbox(mailboxId)
    setSmartMailboxMessages(filteredMessages)
    setViewMode('smart')
    setSelectedMessageId(null)
  }, [])

  // Handle compose actions
  const handleCompose = useCallback(() => {
    setComposeContext(null)
    setShowComposeModal(true)
  }, [])

  const handleReply = useCallback((messageId?: string) => {
    const message = messageId ? messages.find(m => m.id === messageId) : selectedMessage
    if (message) {
      setComposeContext({ replyTo: message, replyType: 'reply' })
      setShowComposeModal(true)
    }
  }, [messages, selectedMessage])

  const handleReplyAll = useCallback((messageId?: string) => {
    const message = messageId ? messages.find(m => m.id === messageId) : selectedMessage
    if (message) {
      setComposeContext({ replyTo: message, replyType: 'reply-all' })
      setShowComposeModal(true)
    }
  }, [messages, selectedMessage])

  const handleForward = useCallback((messageId?: string) => {
    const message = messageId ? messages.find(m => m.id === messageId) : selectedMessage
    if (message) {
      setComposeContext({ replyTo: message, replyType: 'forward' })
      setShowComposeModal(true)
    }
  }, [messages, selectedMessage])

  // Handle attachment download
  const handleDownloadAttachment = useCallback(async (attachment: any) => {
    try {
      if (window.flowDesk?.mail) {
        const result = await window.flowDesk.mail.downloadAttachment(attachment)
        if (result.success) {
          console.log('Attachment downloaded to:', result.path)
        } else {
          console.error('Download failed:', result.error)
        }
      }
    } catch (error) {
      console.error('Failed to download attachment:', error)
    }
  }, [])

  // Get current message list based on view mode
  const currentMessages = useMemo(() => {
    switch (viewMode) {
      case 'smart':
        return smartMailboxMessages
      case 'unified':
        return messages // This would be enhanced to include all accounts
      case 'thread':
        return currentThread?.messages || []
      default:
        return messages
    }
  }, [viewMode, messages, smartMailboxMessages, currentThread])

  if (error) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)} data-testid={testId}>
        <Card className="p-6 text-center">
          <h3 className="text-lg font-medium mb-2">Error loading mail</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("h-full bg-background", className)} data-testid={testId}>
      <ResizableContainer direction="horizontal" className="h-full">
        
        {/* Left Panel: Navigation */}
        <ResizablePanel
          direction="horizontal"
          initialSize={leftPanelSize}
          minSize={220}
          maxSize={400}
          onResize={setLeftPanelSize}
          className="bg-card border-r border-border"
        >
          <div className="flex flex-col h-full">
            {/* View Mode Switcher */}
            <div className="p-3 border-b border-border">
              <div className="flex gap-1">
                {[
                  { mode: 'folders' as ViewMode, label: 'Folders' },
                  { mode: 'unified' as ViewMode, label: 'Unified' },
                  { mode: 'smart' as ViewMode, label: 'Smart' }
                ].map(({ mode, label }) => (
                  <Button
                    key={mode}
                    variant={viewMode === mode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange(mode)}
                    className="text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Navigation Content */}
            <div className="flex-1 overflow-y-auto p-2">
              {viewMode === 'smart' ? (
                <SmartMailboxes
                  onSelectMailbox={handleSmartMailboxSelect}
                  selectedMailboxId={selectedSmartMailbox}
                />
              ) : viewMode === 'unified' ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Unified inbox navigation</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Account Selector */}
                  {accounts.map((account) => (
                    <Button
                      key={account.id}
                      variant={currentAccount?.id === account.id ? "default" : "ghost"}
                      onClick={() => dispatch(setCurrentAccount(account.id))}
                      className="w-full justify-start text-left"
                      size="sm"
                    >
                      <div className="truncate">
                        <div className="font-medium text-sm">{account.name}</div>
                        <div className="text-xs text-muted-foreground">{account.email}</div>
                      </div>
                    </Button>
                  ))}
                  
                  {/* Folder List */}
                  {folders.map((folder) => (
                    <Button
                      key={folder.id}
                      variant="ghost"
                      className="w-full justify-between text-left"
                      size="sm"
                    >
                      <span>{folder.name}</span>
                      {folder.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs">
                          {folder.unreadCount}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Compose Button */}
            <div className="p-3 border-t border-border">
              <Button onClick={handleCompose} className="w-full">
                Compose
              </Button>
            </div>
          </div>
        </ResizablePanel>

        {/* Center Panel: Message List */}
        <ResizablePanel
          direction="horizontal"
          initialSize={centerPanelSize}
          minSize={300}
          maxSize={600}
          onResize={setCenterPanelSize}
          className="bg-background border-r border-border"
        >
          <div ref={centerPanelRef} className="h-full">
            {viewMode === 'unified' ? (
              <UnifiedInboxView
                onMessageSelect={handleMessageSelect}
                selectedMessageId={selectedMessageId}
                height={containerHeight}
              />
            ) : viewMode === 'thread' && currentThread ? (
              <ConversationView
                thread={currentThread}
                onReply={handleReply}
                onReplyAll={handleReplyAll}
                onForward={handleForward}
                onArchive={() => {}}
                onDelete={() => {}}
                onToggleStar={() => {}}
                onMarkRead={handleMessageSelect}
                onDownloadAttachment={handleDownloadAttachment}
              />
            ) : (
              <VirtualizedMailList
                messages={currentMessages}
                selectedMessageId={selectedMessageId}
                onMessageSelect={handleMessageSelect}
                height={containerHeight}
                className="h-full"
              />
            )}
          </div>
        </ResizablePanel>

        {/* Right Panel: Message Preview */}
        <div className="flex-1 bg-background">
          {selectedMessage ? (
            <div className="h-full flex flex-col">
              {/* Message Header */}
              <div className="p-4 border-b border-border bg-card">
                <h3 className="text-lg font-semibold mb-2">{selectedMessage.subject || '(No subject)'}</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {selectedMessage.from.name || selectedMessage.from.address}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedMessage.date.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleReply()}>
                      Reply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleReplyAll()}>
                      Reply All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleForward()}>
                      Forward
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="prose prose-sm max-w-none">
                  {selectedMessage.bodyHtml ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                      className="email-content"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap font-mono text-sm">
                      {selectedMessage.bodyText}
                    </div>
                  )}
                </div>
                
                {/* Attachments */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <AttachmentList
                      attachments={selectedMessage.attachments}
                      onDownload={handleDownloadAttachment}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <div className="text-6xl mb-4">📬</div>
                <h3 className="text-lg font-medium mb-2">Select an email</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a message from the list to read it here
                </p>
              </div>
            </div>
          )}
        </div>
      </ResizableContainer>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={showComposeModal}
        onClose={() => {
          setShowComposeModal(false)
          setComposeContext(null)
        }}
        replyTo={composeContext?.replyTo}
        replyType={composeContext?.replyType}
      />
    </div>
  )
}

export default EnhancedMailLayout