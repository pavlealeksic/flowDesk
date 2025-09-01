import React, { useState, useCallback, useMemo } from 'react'
import { useAppSelector } from '../../store'
import { selectMailAccounts, selectCurrentMessages } from '../../store/slices/mailSlice'
import {
  Button,
  Card,
  cn,
  Mail,
  Star,
  Clock,
  Paperclip,
  Users,
  AlertCircle,
  Filter,
  Plus
} from '../ui'
import type { EmailMessage, MailAccount } from '@flow-desk/shared'

interface SmartMailbox {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  filter: (messages: EmailMessage[], accounts: MailAccount[]) => EmailMessage[]
  color: string
}

interface SmartMailboxesProps {
  onSelectMailbox: (mailboxId: string, messages: EmailMessage[]) => void
  selectedMailboxId?: string
  className?: string
}

const SMART_MAILBOXES: SmartMailbox[] = [
  {
    id: 'today',
    name: 'Today',
    icon: <Clock className="h-4 w-4" />,
    description: 'Messages received today',
    color: 'text-blue-500',
    filter: (messages) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return messages.filter(msg => msg.date >= today)
    }
  },
  {
    id: 'unread',
    name: 'Unread',
    icon: <Mail className="h-4 w-4" />,
    description: 'All unread messages',
    color: 'text-primary',
    filter: (messages) => messages.filter(msg => !msg.flags?.isRead)
  },
  {
    id: 'starred',
    name: 'Starred',
    icon: <Star className="h-4 w-4" />,
    description: 'Starred and important messages',
    color: 'text-yellow-500',
    filter: (messages) => messages.filter(msg => msg.flags?.isStarred)
  },
  {
    id: 'attachments',
    name: 'Attachments',
    icon: <Paperclip className="h-4 w-4" />,
    description: 'Messages with attachments',
    color: 'text-green-500',
    filter: (messages) => messages.filter(msg => msg.flags?.hasAttachments)
  },
  {
    id: 'recent',
    name: 'Recent',
    icon: <Clock className="h-4 w-4" />,
    description: 'Messages from the last 7 days',
    color: 'text-purple-500',
    filter: (messages) => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return messages.filter(msg => msg.date >= weekAgo)
    }
  },
  {
    id: 'vip',
    name: 'VIP',
    icon: <Users className="h-4 w-4" />,
    description: 'Messages from important contacts',
    color: 'text-orange-500',
    filter: (messages, accounts) => {
      // For now, VIP is defined as messages from account owners (self-sent)
      const accountEmails = accounts.map(acc => acc.email.toLowerCase())
      return messages.filter(msg => 
        accountEmails.includes(msg.from.address?.toLowerCase())
      )
    }
  },
  {
    id: 'flagged',
    name: 'Flagged',
    icon: <AlertCircle className="h-4 w-4" />,
    description: 'Flagged messages requiring attention',
    color: 'text-red-500',
    filter: (messages) => messages.filter(msg => msg.flags?.isStarred) // Using starred as flagged for now
  }
]

export const SmartMailboxes: React.FC<SmartMailboxesProps> = ({
  onSelectMailbox,
  selectedMailboxId,
  className
}) => {
  const accounts = useAppSelector(selectMailAccounts)
  const currentMessages = useAppSelector(selectCurrentMessages)
  
  // Get message counts for each smart mailbox
  const mailboxCounts = useMemo(() => {
    const allMessages = currentMessages // In reality, would aggregate from all accounts
    const counts: Record<string, number> = {}
    
    for (const mailbox of SMART_MAILBOXES) {
      counts[mailbox.id] = mailbox.filter(allMessages, accounts).length
    }
    
    return counts
  }, [currentMessages, accounts])

  const handleMailboxSelect = useCallback((mailbox: SmartMailbox) => {
    const filteredMessages = mailbox.filter(currentMessages, accounts)
    onSelectMailbox(mailbox.id, filteredMessages)
  }, [currentMessages, accounts, onSelectMailbox])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between px-2 mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Smart Mailboxes
        </h3>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-1">
        {SMART_MAILBOXES.map((mailbox) => {
          const count = mailboxCounts[mailbox.id] || 0
          const isSelected = selectedMailboxId === mailbox.id
          
          return (
            <Button
              key={mailbox.id}
              variant="ghost"
              onClick={() => handleMailboxSelect(mailbox)}
              className={cn(
                "w-full justify-start h-auto p-2 hover:bg-accent/50",
                isSelected && "bg-accent"
              )}
            >
              <div className="flex items-center gap-3 w-full">
                <div className={cn("flex-shrink-0", mailbox.color)}>
                  {mailbox.icon}
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{mailbox.name}</span>
                    {count > 0 && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        count > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {mailbox.description}
                  </p>
                </div>
              </div>
            </Button>
          )
        })}
      </div>

      {/* Custom Smart Mailboxes */}
      <div className="mt-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground"
        >
          <Plus className="h-3 w-3 mr-2" />
          Create Smart Mailbox...
        </Button>
      </div>
    </div>
  )
}

export default SmartMailboxes