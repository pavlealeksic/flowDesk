// Types for email productivity features

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'business' | 'personal' | 'follow-up' | 'meeting' | 'custom'
  variables: string[]
  isShared: boolean
  createdAt: Date
  updatedAt: Date
  usageCount: number
  accountId?: string
  tags: string[]
  isPublic?: boolean
}

export interface TemplateVariable {
  name: string
  placeholder: string
  defaultValue?: string
  required: boolean
  type: 'text' | 'email' | 'date' | 'number' | 'select'
  label?: string
  options?: string[]
}

export interface TextSnippet {
  id: string
  name: string
  shortcut: string
  content: string
  category: string
  isShared: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
  isHtml?: boolean
  variables?: SnippetVariable[]
}

export interface SnippetVariable {
  name: string
  placeholder: string
  defaultValue?: string
  required: boolean
  type: 'text' | 'email' | 'date' | 'number'
}

export interface EmailRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  accountId?: string
  conditions: RuleCondition[]
  conditionOperator: 'AND' | 'OR'
  actions: RuleAction[]
  createdAt: Date
  updatedAt: Date
  appliedCount: number
}

export interface RuleCondition {
  field: 'from' | 'to' | 'subject' | 'body' | 'size' | 'hasAttachments' | 'date'
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex' | 'greaterThan' | 'lessThan'
  value: string | number | boolean
  caseSensitive?: boolean
}

export interface RuleAction {
  type: 'move' | 'copy' | 'label' | 'forward' | 'autoReply' | 'markRead' | 'markStarred' | 'delete' | 'archive'
  parameters: Record<string, any>
}

export interface ScheduledEmail {
  id: string
  accountId: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  attachments?: any[]
  scheduledTime: Date
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  createdAt: Date
  sentAt?: Date
  errorMessage?: string
}

export interface SnoozedEmail {
  id: string
  originalMessageId: string
  accountId: string
  snoozeUntil: Date
  reason: string
  createdAt: Date
  status: 'snoozed' | 'unsnoozed' | 'deleted'
}

export interface EmailSignature {
  id: string
  name: string
  content: string
  isDefault: boolean
  accountId?: string
  createdAt: Date
  updatedAt: Date
}

export interface CalendarIntegrationData {
  meetingInvites: MeetingInvite[]
  extractedEvents: ExtractedEvent[]
  isProcessing: boolean
  lastProcessed: Date
}

export interface MeetingInvite {
  id: string
  messageId: string
  title: string
  organizer: string
  attendees: string[]
  startTime: Date
  endTime: Date
  location?: string
  description?: string
  icsData?: string
  status: 'pending' | 'accepted' | 'declined' | 'tentative'
  event?: any
  type?: string
  extractedData?: any
  userResponse?: string
  eventId?: string
}

export interface ExtractedEvent {
  id: string
  messageId: string
  title: string
  startTime: Date
  endTime: Date
  location?: string
  confidence: number
  extractedText: string
  status: 'suggested' | 'created' | 'ignored'
}

// Re-export calendar types for compatibility
export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  location?: string
  attendees: EventAttendee[]
  organizer?: EventAttendee
  isAllDay: boolean
  recurrence?: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  visibility?: 'private' | 'public' | 'confidential'
  reminders?: EventReminder[]
  createdAt?: Date
  updatedAt?: Date
}

export interface EventAttendee {
  email: string
  name?: string
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted'
  optional?: boolean
}

export interface EventReminder {
  method: 'email' | 'popup' | 'sms'
  minutesBefore: number
}