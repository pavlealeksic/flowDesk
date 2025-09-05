import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  Button,
  Input,
  Card,
  cn,
  X,
  Send,
  Paperclip,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  Edit,
  Loader2,
  AlertCircle,
  Minimize2,
  Maximize2,
  File,
  Clock
} from '../ui'
import { type BaseComponentProps } from '../ui/types'
import { sendMessage, selectMailAccounts, selectCurrentAccount, selectIsLoadingMail } from '../../store/slices/mailSlice'
import { openTemplatesModal, selectShowTemplatesModal, closeTemplatesModal, openSchedulerModal, selectProductivityUI } from '../../store/slices/productivitySlice'
import { EmailTemplatesModal } from './EmailTemplatesModal'
import { EmailScheduler } from './EmailScheduler'
import { QuickSnippetsPanel } from './QuickSnippetsPanel'
import type { EmailMessage } from '@flow-desk/shared'

interface ComposeModalProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
  replyTo?: EmailMessage
  replyType?: 'reply' | 'reply-all' | 'forward'
  draft?: Partial<EmailMessage>
}

interface ComposeData {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  attachments: File[]
}

const initialComposeData: ComposeData = {
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  body: '',
  attachments: []
}

const EditorToolbar: React.FC<{
  onFormat: (command: string, value?: string) => void
}> = ({ onFormat }) => {
  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('underline')}
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('insertUnorderedList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('insertOrderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('justifyLeft')}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('justifyCenter')}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onFormat('justifyRight')}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-border mx-1" />

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const url = prompt('Enter URL:')
            if (url) onFormat('createLink', url)
          }}
          title="Insert Link"
        >
          <Link className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

const RichTextEditor: React.FC<{
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}> = ({ value, onChange, placeholder, className }) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const handleFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }, [])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault()
          handleFormat('bold')
          break
        case 'i':
          e.preventDefault()
          handleFormat('italic')
          break
        case 'u':
          e.preventDefault()
          handleFormat('underline')
          break
      }
    }
  }, [handleFormat])

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  return (
    <div className={cn('border border-border rounded-lg overflow-hidden', className)}>
      <EditorToolbar onFormat={handleFormat} />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          'min-h-[200px] p-3 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'prose prose-sm max-w-none',
          !value && !isFocused && 'text-muted-foreground'
        )}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{
          minHeight: '200px'
        }}
      />
    </div>
  )
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  replyTo,
  replyType,
  draft,
  className
}) => {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectMailAccounts)
  const currentAccount = useAppSelector(selectCurrentAccount)
  const isLoading = useAppSelector(selectIsLoadingMail)

  const [composeData, setComposeData] = useState<ComposeData>(initialComposeData)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Productivity features integration
  const showTemplatesModal = useAppSelector(selectShowTemplatesModal)
  const productivityUI = useAppSelector(selectProductivityUI)
  const [showScheduler, setShowScheduler] = useState(false)
  const [showSnippets, setShowSnippets] = useState(false)

  // Initialize compose data based on context
  useEffect(() => {
    if (!isOpen) return

    let initialData = { ...initialComposeData }

    if (replyTo && replyType) {
      switch (replyType) {
        case 'reply':
          initialData = {
            ...initialData,
            to: replyTo.from.name ? `${replyTo.from.name} <${replyTo.from.address}>` : replyTo.from.address,
            subject: replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`,
            body: `<br><br>On ${replyTo.date.toLocaleString()}, ${replyTo.from.name || replyTo.from.address} wrote:<br><blockquote style="margin-left: 1em; padding-left: 1em; border-left: 2px solid #ccc;">${replyTo.bodyHtml || replyTo.bodyText?.replace(/\n/g, '<br>') || ''}</blockquote>`
          }
          break
        case 'reply-all':
          const allRecipients = [replyTo.from, ...replyTo.to.filter(addr => addr.address !== currentAccount?.email)]
          initialData = {
            ...initialData,
            to: allRecipients.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', '),
            cc: replyTo.cc?.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ') || '',
            subject: replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`,
            body: `<br><br>On ${replyTo.date.toLocaleString()}, ${replyTo.from.name || replyTo.from.address} wrote:<br><blockquote style="margin-left: 1em; padding-left: 1em; border-left: 2px solid #ccc;">${replyTo.bodyHtml || replyTo.bodyText?.replace(/\n/g, '<br>') || ''}</blockquote>`
          }
          setShowCc(true)
          break
        case 'forward':
          initialData = {
            ...initialData,
            subject: replyTo.subject.startsWith('Fwd:') ? replyTo.subject : `Fwd: ${replyTo.subject}`,
            body: `<br><br>---------- Forwarded message ----------<br>From: ${replyTo.from.name || replyTo.from.address}<br>Date: ${replyTo.date.toLocaleString()}<br>Subject: ${replyTo.subject}<br>To: ${replyTo.to.map(addr => addr.name || addr.address).join(', ')}<br><br>${replyTo.bodyHtml || replyTo.bodyText?.replace(/\n/g, '<br>') || ''}`
          }
          break
      }
    }

    if (draft) {
      initialData = {
        ...initialData,
        to: draft.to?.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ') || '',
        cc: draft.cc?.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ') || '',
        bcc: draft.bcc?.map(addr => addr.name ? `${addr.name} <${addr.address}>` : addr.address).join(', ') || '',
        subject: draft.subject || '',
        body: draft.bodyHtml || draft.bodyText?.replace(/\n/g, '<br>') || ''
      }
    }

    setComposeData(initialData)
  }, [isOpen, replyTo, replyType, draft, currentAccount])

  const handleInputChange = useCallback((field: keyof ComposeData, value: string) => {
    setComposeData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }, [error])

  const handleAttachFiles = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setComposeData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }))
  }, [])

  const handleRemoveAttachment = useCallback((index: number) => {
    setComposeData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }, [])

  const handleSend = useCallback(async () => {
    if (!currentAccount) {
      setError('No account selected')
      return
    }

    // Basic validation
    if (!composeData.to.trim()) {
      setError('Please enter at least one recipient')
      return
    }

    if (!composeData.subject.trim()) {
      setError('Please enter a subject')
      return
    }

    try {
      const messageData = {
        to: composeData.to.split(',').map(addr => {
          const match = addr.trim().match(/^(.+?)\s*<(.+)>$/)
          return match ? { name: match[1].trim(), address: match[2].trim() } : { address: addr.trim() }
        }),
        cc: composeData.cc ? composeData.cc.split(',').map(addr => {
          const match = addr.trim().match(/^(.+?)\s*<(.+)>$/)
          return match ? { name: match[1].trim(), address: match[2].trim() } : { address: addr.trim() }
        }) : [],
        bcc: composeData.bcc ? composeData.bcc.split(',').map(addr => {
          const match = addr.trim().match(/^(.+?)\s*<(.+)>$/)
          return match ? { name: match[1].trim(), address: match[2].trim() } : { address: addr.trim() }
        }) : [],
        subject: composeData.subject,
        bodyHtml: composeData.body,
        bodyText: composeData.body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        attachments: composeData.attachments.map((file, index) => ({
          id: `attachment-${index}`,
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          isInline: false
        })),
        inReplyTo: replyTo?.messageId,
        references: replyTo ? [...(replyTo.references || []), replyTo.messageId] : []
      }

      await dispatch(sendMessage({ accountId: currentAccount.id, message: messageData })).unwrap()
      onClose()
      setComposeData(initialComposeData)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send message')
    }
  }, [dispatch, currentAccount, composeData, replyTo, onClose])

  const handleClose = useCallback(() => {
    setComposeData(initialComposeData)
    setError(null)
    setShowCc(false)
    setShowBcc(false)
    setIsMinimized(false)
    onClose()
  }, [onClose])
  
  const handleOpenTemplates = useCallback(() => {
    dispatch(openTemplatesModal())
  }, [dispatch])
  
  const handleTemplateSelect = useCallback((template: any) => {
    setComposeData(prev => ({
      ...prev,
      subject: template.subject,
      body: template.body
    }))
  }, [])

  // Add ESC key handling and prevent body scroll
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isMinimized) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, isMinimized, handleClose])

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isMinimized) {
      handleClose()
    }
  }, [handleClose, isMinimized])

  const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024
    if (kb < 1024) return `${Math.round(kb)} KB`
    const mb = kb / 1024
    return `${Math.round(mb * 10) / 10} MB`
  }

  if (!isOpen) return null

  const getTitle = () => {
    if (replyType === 'reply') return 'Reply'
    if (replyType === 'reply-all') return 'Reply All'
    if (replyType === 'forward') return 'Forward'
    if (draft) return 'Edit Draft'
    return 'New Message'
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-modal-title"
    >
      <Card 
        className={cn(
          'w-full max-w-4xl transition-all duration-200',
          isMinimized ? 'max-h-[60px]' : 'max-h-[90vh]',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 id="compose-modal-title" className="text-lg font-semibold">{getTitle()}</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Compose Fields */}
              <div className="p-4 space-y-3 border-b border-border">
                {/* From Account */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium w-12">From:</label>
                  <span className="text-sm text-muted-foreground">
                    {currentAccount?.name} &lt;{currentAccount?.email}&gt;
                  </span>
                </div>

                {/* To Field */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium w-12">To:</label>
                  <Input
                    value={composeData.to}
                    onChange={(value) => handleInputChange('to', value)}
                    placeholder="Recipients (separate with commas)"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    {!showCc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCc(true)}
                        className="text-xs"
                      >
                        Cc
                      </Button>
                    )}
                    {!showBcc && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBcc(true)}
                        className="text-xs"
                      >
                        Bcc
                      </Button>
                    )}
                  </div>
                </div>

                {/* Cc Field */}
                {showCc && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium w-12">Cc:</label>
                    <Input
                      value={composeData.cc}
                      onChange={(value) => handleInputChange('cc', value)}
                      placeholder="Cc recipients"
                      className="flex-1"
                    />
                  </div>
                )}

                {/* Bcc Field */}
                {showBcc && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium w-12">Bcc:</label>
                    <Input
                      value={composeData.bcc}
                      onChange={(value) => handleInputChange('bcc', value)}
                      placeholder="Bcc recipients"
                      className="flex-1"
                    />
                  </div>
                )}

                {/* Subject Field */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium w-12">Subject:</label>
                  <Input
                    value={composeData.subject}
                    onChange={(value) => handleInputChange('subject', value)}
                    placeholder="Subject"
                    className="flex-1"
                  />
                </div>

                {/* Attachments */}
                {composeData.attachments.length > 0 && (
                  <div className="flex items-start gap-3">
                    <label className="text-sm font-medium w-12 pt-2">Files:</label>
                    <div className="flex-1 flex flex-wrap gap-2">
                      {composeData.attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-2 py-1 bg-muted rounded text-sm"
                        >
                          <Paperclip className="h-3 w-3" />
                          <span>{file.name}</span>
                          <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAttachment(index)}
                            className="h-4 w-4 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Rich Text Editor with Optional Snippets Panel */}
              <div className="flex-1 p-4 min-h-0 flex gap-4">
                <div className={cn("flex-1", showSnippets && "pr-4")}>
                  <RichTextEditor
                    value={composeData.body}
                    onChange={(value) => handleInputChange('body', value)}
                    placeholder="Type your message here..."
                    className="h-full"
                  />
                </div>
                
                {/* Quick Snippets Panel */}
                {showSnippets && (
                  <div className="w-64 border-l border-border pl-4">
                    <QuickSnippetsPanel
                      onInsertSnippet={(snippet) => {
                        const currentBody = composeData.body
                        const newBody = currentBody + (currentBody ? '\n\n' : '') + snippet.content
                        handleInputChange('body', newBody)
                      }}
                      compact={true}
                    />
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="p-4 border-t border-border">
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Error</span>
                    </div>
                    <p className="text-sm text-destructive/80 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenTemplates}
                    title="Insert email template"
                  >
                    <File className="h-4 w-4 mr-2" />
                    Templates
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowScheduler(true)}
                    title="Schedule email"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSnippets(!showSnippets)}
                    title="Quick text snippets"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Snippets
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAttachFiles}
                  >
                    <Paperclip className="h-4 w-4 mr-2" />
                    Attach
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || !composeData.to.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
      
      {/* Email Templates Modal */}
      {showTemplatesModal && (
        <EmailTemplatesModal
          isOpen={showTemplatesModal}
          onClose={() => dispatch(closeTemplatesModal())}
          onSelectTemplate={handleTemplateSelect}
        />
      )}
      
      {/* Email Scheduler Modal */}
      {showScheduler && (
        <EmailScheduler
          isOpen={showScheduler}
          onClose={() => setShowScheduler(false)}
          onSchedule={async (emailData, scheduledTime) => {
            try {
              if (window.flowDesk?.mail) {
                await window.flowDesk.mail.scheduleEmail(emailData, scheduledTime)
                onClose() // Close compose modal after scheduling
              }
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Failed to schedule email')
            }
          }}
          initialEmail={{
            to: composeData.to,
            subject: composeData.subject,
            body: composeData.body
          }}
        />
      )}
    </div>
  )
}