/**
 * Email Type Definitions for Production Email System
 */

export interface EmailCredentials {
  email: string
  password: string
  displayName?: string
  providerOverride?: string
}

export interface AccountSetupResult {
  accountId: string
  email: string
  provider: string
  displayName: string
  serverConfig: ServerConfig
  imapConfig: ImapConfig
  smtpConfig: SmtpConfig
  authMethodUsed: string
  requiresAppPassword: boolean
  oauthAvailable: boolean
}

export interface ServerConfig {
  name: string
  displayName: string
  imapHost: string
  imapPort: number
  imapSecurity: 'None' | 'Tls' | 'StartTls'
  smtpHost: string
  smtpPort: number
  smtpSecurity: 'None' | 'Tls' | 'StartTls'
  authMethods: string[]
  oauthConfig?: OAuthConfig
}

export interface OAuthConfig {
  clientId: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
}

export interface ImapConfig {
  server: string
  host: string
  port: number
  useTls: boolean
  username: string
}

export interface SmtpConfig {
  server: string
  port: number
  useTls: boolean
  username: string
}

export interface ValidationResult {
  isValid: boolean
  imapAccessible: boolean
  smtpAccessible: boolean
  authMethod: string
  errorMessage?: string
  serverSuggestions?: string[]
}

export interface SyncResult {
  accountId: string
  messagesSynced: number
  messagesNew: number
  messagesUpdated: number
  foldersSynced: number
  errors: string[]
  syncDuration: number
}

export interface EmailMessage {
  id: string
  accountId: string
  folder: string
  subject: string
  fromAddress: string
  fromName: string
  toAddresses: string[]
  ccAddresses: string[]
  bccAddresses: string[]
  bodyText?: string
  bodyHtml?: string
  isRead: boolean
  isStarred: boolean
  isImportant?: boolean
  hasAttachments?: boolean
  receivedAt: number
  size?: number
  messageId?: string
  inReplyTo?: string
  references?: string[]
  attachments?: EmailAttachment[]
  labels?: string[]
  flags?: EmailFlags
}

export interface EmailAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  contentId?: string
  isInline: boolean
  downloadUrl?: string
}

export interface EmailFlags {
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
  isArchived: boolean
  isDeleted: boolean
  isDraft: boolean
  isSpam: boolean
}

export interface NewMessage {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  bodyText?: string
  bodyHtml?: string
  attachments: string[]
  replyTo?: string[]
  priority?: 'low' | 'normal' | 'high'
  requestReadReceipt?: boolean
}

export interface MailFolder {
  id: string
  accountId: string
  name: string
  displayName: string
  folderType: MailFolderType
  messageCount: number
  unreadCount: number
  parentId?: string
  path: string
  isSelectable: boolean
  canSelect: boolean
  attributes?: string[]
  syncStatus?: FolderSyncStatus
}

export type MailFolderType = 
  | 'Inbox'
  | 'Sent'
  | 'Drafts' 
  | 'Trash'
  | 'Spam'
  | 'Archive'
  | 'Custom'
  | 'System'

export interface FolderSyncStatus {
  lastSyncAt?: number
  isBeingSynced: boolean
  syncProgress?: number
  syncError?: string
}

export interface EmailAccount {
  id: string
  userId: string
  name: string
  email: string
  provider: EmailProvider
  status: AccountStatus
  displayName: string
  isEnabled: boolean
  lastSyncAt?: number
  nextSyncAt?: number
  syncIntervalMinutes: number
  createdAt: number
  updatedAt: number
  requiresAppPassword: boolean
  oauthAvailable: boolean
  serverConfig: ServerConfig
}

export type EmailProvider =
  | 'Gmail'
  | 'Outlook'
  | 'Exchange'
  | 'Yahoo'
  | 'FastMail'
  | 'ProtonMail'
  | 'iCloud'
  | 'Custom'

export type AccountStatus =
  | 'Active'
  | 'AuthError'
  | 'QuotaExceeded'
  | 'Suspended'
  | 'Disabled'
  | 'Error'

export interface EmailSearchQuery {
  query: string
  accountIds?: string[]
  folders?: string[]
  dateFrom?: number
  dateTo?: number
  hasAttachments?: boolean
  isUnread?: boolean
  isStarred?: boolean
  sender?: string
  recipient?: string
  subject?: string
  limit?: number
  offset?: number
}

export interface EmailSearchResult {
  query: string
  totalCount: number
  messages: EmailMessage[]
  took: number
  facets?: SearchFacets
  suggestions?: string[]
}

export interface SearchFacets {
  accounts: Record<string, number>
  folders: Record<string, number>
  senders: Record<string, number>
  dateRanges: Record<string, number>
}

export interface EmailFilter {
  id: string
  accountId?: string
  userId: string
  name: string
  description?: string
  isEnabled: boolean
  conditions: FilterCondition[]
  actions: FilterAction[]
  priority: number
  stopProcessing: boolean
}

export interface FilterCondition {
  field: FilterField
  operator: FilterOperator
  value: string
  caseSensitive: boolean
}

export type FilterField =
  | 'From'
  | 'To'
  | 'Cc'
  | 'Bcc'
  | 'Subject'
  | 'Body'
  | 'Headers'
  | 'AttachmentName'
  | 'Size'
  | 'Date'

export type FilterOperator =
  | 'Equals'
  | 'Contains'
  | 'StartsWith'
  | 'EndsWith'
  | 'Regex'
  | 'GreaterThan'
  | 'LessThan'
  | 'NotEquals'
  | 'NotContains'

export interface FilterAction {
  actionType: FilterActionType
  params: Record<string, any>
}

export type FilterActionType =
  | 'MoveToFolder'
  | 'AddLabel'
  | 'RemoveLabel'
  | 'MarkRead'
  | 'MarkUnread'
  | 'Star'
  | 'Unstar'
  | 'MarkImportant'
  | 'MarkUnimportant'
  | 'Delete'
  | 'Forward'
  | 'AutoReply'
  | 'Notify'

export interface EmailTemplate {
  id: string
  userId: string
  name: string
  description?: string
  category: string
  subject: string
  bodyHtml: string
  bodyText: string
  variables: TemplateVariable[]
  usageCount: number
  isFavorite: boolean
  isShared: boolean
  tags: string[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
}

export interface TemplateVariable {
  key: string
  label: string
  variableType: VariableType
  defaultValue?: string
  isRequired: boolean
  description?: string
  placeholder?: string
  options?: string[]
}

export type VariableType =
  | 'Text'
  | 'Email'
  | 'Date'
  | 'DateTime'
  | 'Number'
  | 'Boolean'
  | 'Select'
  | 'MultiSelect'
  | 'Url'
  | 'Phone'

export interface EmailSignature {
  id: string
  accountId?: string
  userId: string
  name: string
  contentHtml: string
  contentText: string
  isDefault: boolean
  usage: SignatureUsage
  createdAt: number
  updatedAt: number
}

export interface SignatureUsage {
  newMessages: boolean
  replies: boolean
  forwards: boolean
}

export interface EmailNotificationSettings {
  enabled: boolean
  showDesktopNotifications: boolean
  playSound: boolean
  badgeCount: boolean
  vipOnly: boolean
  quietHours: {
    enabled: boolean
    startTime: string
    endTime: string
  }
  keywords: string[]
}

export interface EmailSecuritySettings {
  blockExternalImages: boolean
  warnUnsafeLinks: boolean
  requireEncryption: boolean
  autoDeleteSpam: boolean
  quarantineSuspicious: boolean
}

// Connection and sync status types
export type ConnectionStatus = 'Connected' | 'Disconnected' | 'Error'

export interface AccountConnectionStatus {
  accountId: string
  imapStatus: ConnectionStatus
  smtpStatus: ConnectionStatus
  lastConnected?: number
  lastError?: string
}

export interface SyncProgress {
  accountId: string
  currentFolder?: string
  totalFolders: number
  foldersCompleted: number
  currentMessages: number
  totalMessages: number
  progress: number
  status: 'idle' | 'syncing' | 'error' | 'paused'
  startedAt?: number
  estimatedCompletion?: number
  errorMessage?: string
}

// UI State types
export interface EmailUIState {
  selectedAccountId?: string
  selectedFolderId?: string
  selectedMessageIds: string[]
  viewMode: 'list' | 'conversation' | 'compact'
  sortBy: 'date' | 'sender' | 'subject' | 'size'
  sortOrder: 'asc' | 'desc'
  searchQuery: string
  showPreview: boolean
  previewPosition: 'right' | 'bottom'
}

export interface AccountSetupState {
  step: 'credentials' | 'validation' | 'testing' | 'complete' | 'error'
  email: string
  provider?: string
  serverConfig?: ServerConfig
  validationResult?: ValidationResult
  setupResult?: AccountSetupResult
  error?: string
  isLoading: boolean
}

// Event types for real-time updates
export interface EmailEvent {
  type: EmailEventType
  accountId: string
  data: any
  timestamp: number
}

export type EmailEventType =
  | 'message-received'
  | 'message-sent'
  | 'message-deleted'
  | 'message-read'
  | 'folder-updated'
  | 'sync-started'
  | 'sync-completed'
  | 'sync-error'
  | 'connection-status-changed'
  | 'account-added'
  | 'account-removed'
  | 'account-updated'