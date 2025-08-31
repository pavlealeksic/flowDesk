/**
 * Mail System Types for Flow Desk
 * 
 * Defines comprehensive types for email accounts, messages, folders, filters,
 * signatures, and mail provider integrations following Blueprint.md requirements.
 */

import { z } from 'zod';

/**
 * Mail provider types
 */
export type MailProvider = 
  | 'gmail'           // Gmail via API
  | 'outlook'         // Microsoft Graph
  | 'exchange'        // Exchange Web Services
  | 'imap'            // Generic IMAP/SMTP
  | 'fastmail'        // Fastmail (IMAP/SMTP preset)
  | 'proton'          // Proton Mail (via bridge)
  | 'yahoo'           // Yahoo Mail (IMAP preset)
  | 'aol';            // AOL Mail (IMAP preset)

/**
 * Mail account configuration
 */
export interface MailAccount {
  /** Unique identifier */
  id: string;
  /** User ID who owns this account */
  userId: string;
  /** Display name for the account */
  name: string;
  /** Primary email address */
  email: string;
  /** Mail provider type */
  provider: MailProvider;
  /** Provider-specific configuration */
  config: MailAccountConfig;
  /** OAuth credentials (encrypted) */
  credentials?: MailAccountCredentials;
  /** Account status */
  status: MailAccountStatus;
  /** Last successful sync timestamp */
  lastSyncAt?: Date;
  /** Next scheduled sync timestamp */
  nextSyncAt?: Date;
  /** Sync interval in minutes */
  syncIntervalMinutes: number;
  /** Whether account is enabled for syncing */
  isEnabled: boolean;
  /** Account creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Mail account status
 */
export type MailAccountStatus = 
  | 'active'          // Account is working normally
  | 'auth_error'      // Authentication failed, needs re-auth
  | 'quota_exceeded'  // API quota exceeded
  | 'suspended'       // Account suspended by provider
  | 'disabled'        // Manually disabled by user
  | 'error';          // General error state

/**
 * Provider-specific account configuration
 */
export type MailAccountConfig = 
  | GmailAccountConfig
  | OutlookAccountConfig
  | ExchangeAccountConfig
  | ImapAccountConfig;

/**
 * Gmail account configuration
 */
export interface GmailAccountConfig {
  provider: 'gmail';
  /** Gmail API client ID */
  clientId: string;
  /** Enabled Gmail API scopes */
  scopes: string[];
  /** Whether to use Gmail push notifications */
  enablePushNotifications: boolean;
  /** History ID for incremental sync */
  historyId?: string;
}

/**
 * Outlook/Graph account configuration
 */
export interface OutlookAccountConfig {
  provider: 'outlook';
  /** Microsoft Graph client ID */
  clientId: string;
  /** Tenant ID for enterprise accounts */
  tenantId?: string;
  /** Enabled Graph API scopes */
  scopes: string[];
  /** Whether to use Graph webhooks */
  enableWebhooks: boolean;
  /** Delta token for incremental sync */
  deltaToken?: string;
}

/**
 * Exchange Web Services configuration
 */
export interface ExchangeAccountConfig {
  provider: 'exchange';
  /** Exchange server URL */
  serverUrl: string;
  /** Exchange version */
  version: string;
  /** Domain for authentication */
  domain?: string;
  /** Whether to use autodiscovery */
  useAutodiscovery: boolean;
}

/**
 * Generic IMAP/SMTP configuration
 */
export interface ImapAccountConfig {
  provider: 'imap' | 'fastmail' | 'proton' | 'yahoo' | 'aol';
  /** IMAP server settings */
  imap: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass?: string; // Encrypted
    };
  };
  /** SMTP server settings */
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass?: string; // Encrypted
    };
  };
  /** Special folder mappings */
  folderMappings?: Record<string, string>;
}

/**
 * Encrypted credentials storage
 */
export interface MailAccountCredentials {
  /** OAuth access token (encrypted) */
  accessToken?: string;
  /** OAuth refresh token (encrypted) */
  refreshToken?: string;
  /** Token expiry timestamp */
  tokenExpiresAt?: Date;
  /** Password for IMAP/SMTP (encrypted) */
  password?: string;
  /** Additional provider-specific tokens */
  additionalTokens?: Record<string, string>;
}

/**
 * Email message entity
 */
export interface EmailMessage {
  /** Unique identifier */
  id: string;
  /** Mail account ID */
  accountId: string;
  /** Provider-specific message ID */
  providerId: string;
  /** Thread ID for conversation grouping */
  threadId: string;
  /** Message subject */
  subject: string;
  /** Message body (HTML) */
  bodyHtml?: string;
  /** Message body (plain text) */
  bodyText?: string;
  /** Message snippet/preview */
  snippet: string;
  /** From address */
  from: EmailAddress;
  /** To addresses */
  to: EmailAddress[];
  /** CC addresses */
  cc: EmailAddress[];
  /** BCC addresses */
  bcc: EmailAddress[];
  /** Reply-To addresses */
  replyTo: EmailAddress[];
  /** Message date */
  date: Date;
  /** Message flags */
  flags: EmailFlags;
  /** Message labels/folders */
  labels: string[];
  /** Folder name */
  folder: string;
  /** Message importance */
  importance: 'low' | 'normal' | 'high';
  /** Message priority */
  priority: 'low' | 'normal' | 'high';
  /** Message size in bytes */
  size: number;
  /** Attachments */
  attachments: EmailAttachment[];
  /** Raw message headers */
  headers: Record<string, string>;
  /** Message-ID header */
  messageId: string;
  /** In-Reply-To header */
  inReplyTo?: string;
  /** References header */
  references: string[];
  /** S/MIME or PGP encryption info */
  encryption?: EmailEncryption;
  /** Creation timestamp in local DB */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Email address representation
 */
export interface EmailAddress {
  /** Display name */
  name?: string;
  /** Email address */
  address: string;
}

/**
 * Email message flags
 */
export interface EmailFlags {
  /** Message has been read */
  isRead: boolean;
  /** Message is starred/flagged */
  isStarred: boolean;
  /** Message is in trash */
  isTrashed: boolean;
  /** Message is spam */
  isSpam: boolean;
  /** Message is important (Gmail) */
  isImportant: boolean;
  /** Message is archived */
  isArchived: boolean;
  /** Message is a draft */
  isDraft: boolean;
  /** Message is sent */
  isSent: boolean;
  /** Message has attachments */
  hasAttachments: boolean;
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  /** Attachment ID */
  id: string;
  /** Filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  size: number;
  /** Content ID for inline attachments */
  contentId?: string;
  /** Whether attachment is inline */
  isInline: boolean;
  /** Download URL (temporary) */
  downloadUrl?: string;
  /** Local file path if downloaded */
  localPath?: string;
}

/**
 * Email encryption information
 */
export interface EmailEncryption {
  /** Encryption type */
  type: 'smime' | 'pgp';
  /** Whether message is encrypted */
  isEncrypted: boolean;
  /** Whether message is signed */
  isSigned: boolean;
  /** Signature verification status */
  signatureValid?: boolean;
  /** Certificate/key information */
  certificateInfo?: {
    issuer: string;
    subject: string;
    validFrom: Date;
    validTo: Date;
  };
}

/**
 * Email thread/conversation
 */
export interface EmailThread {
  /** Unique thread identifier */
  id: string;
  /** Account ID */
  accountId: string;
  /** Thread subject (usually from first message) */
  subject: string;
  /** Message IDs in thread (ordered by date) */
  messageIds: string[];
  /** Participant email addresses */
  participants: EmailAddress[];
  /** Thread labels */
  labels: string[];
  /** Thread flags */
  flags: {
    hasUnread: boolean;
    hasStarred: boolean;
    hasImportant: boolean;
    hasAttachments: boolean;
  };
  /** Last message date */
  lastMessageAt: Date;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Mail folder/label
 */
export interface MailFolder {
  /** Unique identifier */
  id: string;
  /** Account ID */
  accountId: string;
  /** Folder name */
  name: string;
  /** Display name */
  displayName: string;
  /** Folder type */
  type: MailFolderType;
  /** Parent folder ID */
  parentId?: string;
  /** Folder path */
  path: string;
  /** Folder attributes */
  attributes: string[];
  /** Message count */
  messageCount: number;
  /** Unread message count */
  unreadCount: number;
  /** Whether folder is selectable */
  isSelectable: boolean;
  /** Sync status */
  syncStatus: {
    lastSyncAt?: Date;
    isBeingSynced: boolean;
    syncProgress?: number;
    syncError?: string;
  };
}

/**
 * Mail folder types
 */
export type MailFolderType = 
  | 'inbox'
  | 'sent'
  | 'drafts'
  | 'trash'
  | 'spam'
  | 'archive'
  | 'custom'
  | 'system';

/**
 * Email filter/rule
 */
export interface EmailFilter {
  /** Unique identifier */
  id: string;
  /** Account ID (or null for global filters) */
  accountId?: string;
  /** User ID who owns this filter */
  userId: string;
  /** Filter name */
  name: string;
  /** Filter description */
  description?: string;
  /** Whether filter is enabled */
  isEnabled: boolean;
  /** Filter conditions (AND logic) */
  conditions: EmailFilterCondition[];
  /** Actions to perform when filter matches */
  actions: EmailFilterAction[];
  /** Filter priority (lower number = higher priority) */
  priority: number;
  /** Stop processing other filters if this matches */
  stopProcessing: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Email filter condition
 */
export interface EmailFilterCondition {
  /** Field to check */
  field: EmailFilterField;
  /** Comparison operator */
  operator: EmailFilterOperator;
  /** Value to compare against */
  value: string;
  /** Case-sensitive comparison */
  caseSensitive: boolean;
}

/**
 * Email filter fields
 */
export type EmailFilterField = 
  | 'from'
  | 'to'
  | 'cc'
  | 'bcc'
  | 'subject'
  | 'body'
  | 'headers'
  | 'attachment_name'
  | 'size'
  | 'date';

/**
 * Email filter operators
 */
export type EmailFilterOperator = 
  | 'equals'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'greater_than'
  | 'less_than'
  | 'not_equals'
  | 'not_contains';

/**
 * Email filter action
 */
export interface EmailFilterAction {
  /** Action type */
  type: EmailFilterActionType;
  /** Action parameters */
  params: Record<string, any>;
}

/**
 * Email filter action types
 */
export type EmailFilterActionType = 
  | 'move_to_folder'
  | 'add_label'
  | 'remove_label'
  | 'mark_read'
  | 'mark_unread'
  | 'star'
  | 'unstar'
  | 'mark_important'
  | 'mark_unimportant'
  | 'delete'
  | 'forward'
  | 'auto_reply'
  | 'notify'
  | 'run_automation';

/**
 * Email signature
 */
export interface EmailSignature {
  /** Unique identifier */
  id: string;
  /** Account ID (or null for global signature) */
  accountId?: string;
  /** User ID who owns this signature */
  userId: string;
  /** Signature name */
  name: string;
  /** Signature content (HTML) */
  contentHtml: string;
  /** Signature content (plain text) */
  contentText: string;
  /** Whether signature is default */
  isDefault: boolean;
  /** When to use this signature */
  usage: SignatureUsage;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Signature usage settings
 */
export interface SignatureUsage {
  /** Use for new messages */
  newMessages: boolean;
  /** Use for replies */
  replies: boolean;
  /** Use for forwards */
  forwards: boolean;
  /** Conditions for automatic selection */
  conditions?: EmailFilterCondition[];
}

/**
 * Email template
 */
export interface EmailTemplate {
  /** Unique identifier */
  id: string;
  /** User ID who owns this template */
  userId: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Template category */
  category: string;
  /** Template subject */
  subject: string;
  /** Template body (HTML) */
  bodyHtml: string;
  /** Template body (plain text) */
  bodyText: string;
  /** Template variables */
  variables: TemplateVariable[];
  /** Usage count */
  usageCount: number;
  /** Whether template is favorite */
  isFavorite: boolean;
  /** Tags for organization */
  tags: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last used timestamp */
  lastUsedAt?: Date;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable key */
  key: string;
  /** Display label */
  label: string;
  /** Variable type */
  type: 'text' | 'email' | 'date' | 'number' | 'boolean';
  /** Default value */
  defaultValue?: string;
  /** Whether variable is required */
  isRequired: boolean;
  /** Help text */
  description?: string;
}

/**
 * Mail sync status
 */
export interface MailSyncStatus {
  /** Account ID */
  accountId: string;
  /** Overall sync status */
  status: 'idle' | 'syncing' | 'error' | 'paused';
  /** Last successful sync */
  lastSyncAt?: Date;
  /** Current sync operation */
  currentOperation?: {
    type: 'full_sync' | 'incremental_sync' | 'folder_sync';
    folder?: string;
    progress: number; // 0-100
    startedAt: Date;
  };
  /** Sync statistics */
  stats: {
    totalMessages: number;
    newMessages: number;
    updatedMessages: number;
    deletedMessages: number;
    syncErrors: number;
  };
  /** Last sync error */
  lastError?: {
    message: string;
    code: string;
    timestamp: Date;
    details?: Record<string, any>;
  };
}

// Zod schemas for runtime validation
export const EmailAddressSchema = z.object({
  name: z.string().optional(),
  address: z.string().email()
});

export const EmailMessageSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  threadId: z.string(),
  subject: z.string(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  snippet: z.string(),
  from: EmailAddressSchema,
  to: z.array(EmailAddressSchema),
  cc: z.array(EmailAddressSchema),
  bcc: z.array(EmailAddressSchema),
  replyTo: z.array(EmailAddressSchema),
  date: z.date(),
  flags: z.object({
    isRead: z.boolean(),
    isStarred: z.boolean(),
    isTrashed: z.boolean(),
    isSpam: z.boolean(),
    isImportant: z.boolean(),
    isArchived: z.boolean(),
    isDraft: z.boolean(),
    isSent: z.boolean(),
    hasAttachments: z.boolean()
  }),
  labels: z.array(z.string()),
  folder: z.string(),
  importance: z.enum(['low', 'normal', 'high']),
  priority: z.enum(['low', 'normal', 'high']),
  size: z.number().nonnegative(),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number().nonnegative(),
    contentId: z.string().optional(),
    isInline: z.boolean(),
    downloadUrl: z.string().url().optional(),
    localPath: z.string().optional()
  })),
  headers: z.record(z.string()),
  messageId: z.string(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()),
  encryption: z.object({
    type: z.enum(['smime', 'pgp']),
    isEncrypted: z.boolean(),
    isSigned: z.boolean(),
    signatureValid: z.boolean().optional(),
    certificateInfo: z.object({
      issuer: z.string(),
      subject: z.string(),
      validFrom: z.date(),
      validTo: z.date()
    }).optional()
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const MailAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  provider: z.enum(['gmail', 'outlook', 'exchange', 'imap', 'fastmail', 'proton', 'yahoo', 'aol']),
  config: z.any(), // Union type too complex for Zod
  credentials: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    tokenExpiresAt: z.date().optional(),
    password: z.string().optional(),
    additionalTokens: z.record(z.string()).optional()
  }).optional(),
  status: z.enum(['active', 'auth_error', 'quota_exceeded', 'suspended', 'disabled', 'error']),
  lastSyncAt: z.date().optional(),
  nextSyncAt: z.date().optional(),
  syncIntervalMinutes: z.number().positive(),
  isEnabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Utility types for mail operations
 */
export type CreateMailAccountInput = Omit<MailAccount, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncAt' | 'nextSyncAt'>;
export type UpdateMailAccountInput = Partial<Pick<MailAccount, 'name' | 'config' | 'syncIntervalMinutes' | 'isEnabled'>>;

export type CreateEmailFilterInput = Omit<EmailFilter, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEmailFilterInput = Partial<Pick<EmailFilter, 'name' | 'description' | 'isEnabled' | 'conditions' | 'actions' | 'priority' | 'stopProcessing'>>;

export type CreateEmailSignatureInput = Omit<EmailSignature, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEmailSignatureInput = Partial<Pick<EmailSignature, 'name' | 'contentHtml' | 'contentText' | 'isDefault' | 'usage'>>;

export type CreateEmailTemplateInput = Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>;
export type UpdateEmailTemplateInput = Partial<Pick<EmailTemplate, 'name' | 'description' | 'category' | 'subject' | 'bodyHtml' | 'bodyText' | 'variables' | 'isFavorite' | 'tags'>>;

/**
 * Search result for email messages
 */
export interface EmailSearchResult {
  /** Search query */
  query: string;
  /** Total number of results */
  totalCount: number;
  /** Current page results */
  messages: EmailMessage[];
  /** Search took this many milliseconds */
  took: number;
  /** Faceted search results */
  facets?: {
    accounts: Record<string, number>;
    folders: Record<string, number>;
    senders: Record<string, number>;
    dateRanges: Record<string, number>;
  };
  /** Suggested corrections */
  suggestions?: string[];
}

/**
 * Bulk operation types
 */
export interface BulkEmailOperation {
  /** Operation type */
  type: 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'delete' | 'move' | 'add_label' | 'remove_label';
  /** Message IDs to operate on */
  messageIds: string[];
  /** Operation parameters */
  params?: Record<string, any>;
}

export interface BulkEmailOperationResult {
  /** Number of successful operations */
  successful: number;
  /** Number of failed operations */
  failed: number;
  /** Failed message IDs with errors */
  errors: Array<{
    messageId: string;
    error: string;
  }>;
}