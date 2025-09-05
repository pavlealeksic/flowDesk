import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import {
  selectMailAccounts,
  selectCurrentMessages,
  selectIsLoadingMail,
  fetchMessages
} from '../../store/slices/mailSlice'
import VirtualizedMailList from './VirtualizedMailList'
import {
  Button,
  Card,
  Input,
  cn,
  Mail,
  Filter,
  SortDesc,
  RefreshCw,
  Loader2,
  Search
} from '../ui'
import type { EmailMessage, MailAccount } from '@flow-desk/shared'

interface UnifiedInboxViewProps {
  onMessageSelect: (messageId: string) => void
  selectedMessageId?: string
  height: number
  className?: string
}

interface UnifiedMessage extends EmailMessage {
  accountName: string
  accountEmail: string
  accountId: string
}

type SortOption = 'date-desc' | 'date-asc' | 'sender' | 'subject'
type FilterOption = 'all' | 'unread' | 'starred' | 'attachments'

export const UnifiedInboxView: React.FC<UnifiedInboxViewProps> = ({
  onMessageSelect,
  selectedMessageId,
  height,
  className
}) => {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectMailAccounts)
  const isLoading = useAppSelector(selectIsLoadingMail)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-desc')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [accountMessages, setAccountMessages] = useState<Record<string, EmailMessage[]>>({})

  // Load messages from all accounts
  useEffect(() => {
    const loadAllMessages = async () => {
      const messages: Record<string, EmailMessage[]> = {}
      
      for (const account of accounts) {
        if (account.isEnabled) {
          try {
            // This would normally dispatch fetchMessages for each account
            // For now, using mock data structure
            messages[account.id] = []
          } catch (error) {
            console.error(`Failed to load messages for ${account.email}:`, error)
          }
        }
      }
      
      setAccountMessages(messages)
    }

    if (accounts.length > 0) {
      loadAllMessages()
    }
  }, [accounts, dispatch])

  // Combine and process all messages
  const unifiedMessages = useMemo<UnifiedMessage[]>(() => {
    const allMessages: UnifiedMessage[] = []
    
    for (const account of accounts) {
      const messages = accountMessages[account.id] || []
      const accountUnifiedMessages: UnifiedMessage[] = messages.map(message => ({
        ...message,
        accountName: account.name,
        accountEmail: account.email,
        accountId: account.id
      }))
      allMessages.push(...accountUnifiedMessages)
    }

    // Apply filters
    let filteredMessages = allMessages
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredMessages = allMessages.filter(message =>
        message.subject?.toLowerCase().includes(query) ||
        message.from.name?.toLowerCase().includes(query) ||
        message.from.address?.toLowerCase().includes(query) ||
        message.snippet?.toLowerCase().includes(query)
      )
    }

    switch (filterBy) {
      case 'unread':
        filteredMessages = filteredMessages.filter(m => !m.flags?.isRead)
        break
      case 'starred':
        filteredMessages = filteredMessages.filter(m => m.flags?.isStarred)
        break
      case 'attachments':
        filteredMessages = filteredMessages.filter(m => m.flags?.hasAttachments)
        break
    }

    // Apply sorting
    switch (sortBy) {
      case 'date-desc':
        filteredMessages.sort((a, b) => b.date.getTime() - a.date.getTime())
        break
      case 'date-asc':
        filteredMessages.sort((a, b) => a.date.getTime() - b.date.getTime())
        break
      case 'sender':
        filteredMessages.sort((a, b) => 
          (a.from.name || a.from.address).localeCompare(b.from.name || b.from.address)
        )
        break
      case 'subject':
        filteredMessages.sort((a, b) => (a.subject || '').localeCompare(b.subject || ''))
        break
    }

    return filteredMessages
  }, [accountMessages, accounts, searchQuery, filterBy, sortBy])

  const handleRefresh = useCallback(() => {
    for (const account of accounts) {
      if (account.isEnabled) {
        dispatch(fetchMessages({ accountId: account.id, folderId: 'inbox' }))
      }
    }
  }, [dispatch, accounts])

  const getFilterCount = useCallback((filter: FilterOption): number => {
    const allMessages = Object.values(accountMessages).flat()
    switch (filter) {
      case 'unread':
        return allMessages.filter(m => !m.flags?.isRead).length
      case 'starred':
        return allMessages.filter(m => m.flags?.isStarred).length
      case 'attachments':
        return allMessages.filter(m => m.flags?.hasAttachments).length
      default:
        return allMessages.length
    }
  }, [accountMessages])

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">All Inboxes</h2>
            {unifiedMessages.length > 0 && (
              <span className="text-sm text-muted-foreground">
                ({unifiedMessages.length} messages)
              </span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
        
        {/* Search */}
        <div className="mb-3">
          <Input
            type="search"
            placeholder="Search all emails..."
            value={searchQuery}
            onChange={(value) => setSearchQuery(value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="w-full"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {(['all', 'unread', 'starred', 'attachments'] as FilterOption[]).map((filter) => (
              <Button
                key={filter}
                variant={filterBy === filter ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterBy(filter)}
                className="text-xs"
              >
                {filter === 'all' && 'All'}
                {filter === 'unread' && `Unread (${getFilterCount('unread')})`}
                {filter === 'starred' && `Starred (${getFilterCount('starred')})`}
                {filter === 'attachments' && `Files (${getFilterCount('attachments')})`}
              </Button>
            ))}
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const sortOptions: SortOption[] = ['date-desc', 'date-asc', 'sender', 'subject']
              const currentIndex = sortOptions.indexOf(sortBy)
              const nextIndex = (currentIndex + 1) % sortOptions.length
              setSortBy(sortOptions[nextIndex])
            }}
            className="text-xs"
          >
            <SortDesc className="h-4 w-4 mr-1" />
            {sortBy === 'date-desc' && 'Newest'}
            {sortBy === 'date-asc' && 'Oldest'}
            {sortBy === 'sender' && 'Sender'}
            {sortBy === 'subject' && 'Subject'}
          </Button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading messages...</span>
          </div>
        ) : unifiedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">📫</div>
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No matching emails' : 'No emails'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery 
                ? `No emails match "${searchQuery}"`
                : 'Your unified inbox is empty'
              }
            </p>
          </div>
        ) : (
          <VirtualizedMailList
            messages={unifiedMessages}
            selectedMessageId={selectedMessageId}
            onMessageSelect={onMessageSelect}
            height={height - 180} // Account for header height
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}

export default UnifiedInboxView