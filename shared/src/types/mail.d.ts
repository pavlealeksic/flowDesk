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
export type MailProvider = 'gmail' | 'outlook' | 'exchange' | 'imap' | 'fastmail' | 'proton' | 'yahoo' | 'aol';
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
export type MailAccountStatus = 'active' | 'auth_error' | 'quota_exceeded' | 'suspended' | 'disabled' | 'error';
/**
 * Provider-specific account configuration
 */
export type MailAccountConfig = GmailAccountConfig | OutlookAccountConfig | ExchangeAccountConfig | ImapAccountConfig;
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
            pass?: string;
        };
    };
    /** SMTP server settings */
    smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass?: string;
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
export type MailFolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'archive' | 'custom' | 'system';
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
export type EmailFilterField = 'from' | 'to' | 'cc' | 'bcc' | 'subject' | 'body' | 'headers' | 'attachment_name' | 'size' | 'date';
/**
 * Email filter operators
 */
export type EmailFilterOperator = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than' | 'not_equals' | 'not_contains';
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
export type EmailFilterActionType = 'move_to_folder' | 'add_label' | 'remove_label' | 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'mark_important' | 'mark_unimportant' | 'delete' | 'forward' | 'auto_reply' | 'notify' | 'run_automation';
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
        progress: number;
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
export declare const EmailAddressSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    address: z.ZodString;
}, "strip", z.ZodTypeAny, {
    address: string;
    name?: string | undefined;
}, {
    address: string;
    name?: string | undefined;
}>;
export declare const EmailMessageSchema: z.ZodObject<{
    id: z.ZodString;
    accountId: z.ZodString;
    providerId: z.ZodString;
    threadId: z.ZodString;
    subject: z.ZodString;
    bodyHtml: z.ZodOptional<z.ZodString>;
    bodyText: z.ZodOptional<z.ZodString>;
    snippet: z.ZodString;
    from: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        address: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        address: string;
        name?: string | undefined;
    }, {
        address: string;
        name?: string | undefined;
    }>;
    to: z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        address: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        address: string;
        name?: string | undefined;
    }, {
        address: string;
        name?: string | undefined;
    }>, "many">;
    cc: z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        address: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        address: string;
        name?: string | undefined;
    }, {
        address: string;
        name?: string | undefined;
    }>, "many">;
    bcc: z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        address: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        address: string;
        name?: string | undefined;
    }, {
        address: string;
        name?: string | undefined;
    }>, "many">;
    replyTo: z.ZodArray<z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        address: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        address: string;
        name?: string | undefined;
    }, {
        address: string;
        name?: string | undefined;
    }>, "many">;
    date: z.ZodDate;
    flags: z.ZodObject<{
        isRead: z.ZodBoolean;
        isStarred: z.ZodBoolean;
        isTrashed: z.ZodBoolean;
        isSpam: z.ZodBoolean;
        isImportant: z.ZodBoolean;
        isArchived: z.ZodBoolean;
        isDraft: z.ZodBoolean;
        isSent: z.ZodBoolean;
        hasAttachments: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        isRead: boolean;
        isStarred: boolean;
        isTrashed: boolean;
        isSpam: boolean;
        isImportant: boolean;
        isArchived: boolean;
        isDraft: boolean;
        isSent: boolean;
        hasAttachments: boolean;
    }, {
        isRead: boolean;
        isStarred: boolean;
        isTrashed: boolean;
        isSpam: boolean;
        isImportant: boolean;
        isArchived: boolean;
        isDraft: boolean;
        isSent: boolean;
        hasAttachments: boolean;
    }>;
    labels: z.ZodArray<z.ZodString, "many">;
    folder: z.ZodString;
    importance: z.ZodEnum<["low", "normal", "high"]>;
    priority: z.ZodEnum<["low", "normal", "high"]>;
    size: z.ZodNumber;
    attachments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        filename: z.ZodString;
        mimeType: z.ZodString;
        size: z.ZodNumber;
        contentId: z.ZodOptional<z.ZodString>;
        isInline: z.ZodBoolean;
        downloadUrl: z.ZodOptional<z.ZodString>;
        localPath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        size: number;
        filename: string;
        mimeType: string;
        isInline: boolean;
        contentId?: string | undefined;
        downloadUrl?: string | undefined;
        localPath?: string | undefined;
    }, {
        id: string;
        size: number;
        filename: string;
        mimeType: string;
        isInline: boolean;
        contentId?: string | undefined;
        downloadUrl?: string | undefined;
        localPath?: string | undefined;
    }>, "many">;
    headers: z.ZodRecord<z.ZodString, z.ZodString>;
    messageId: z.ZodString;
    inReplyTo: z.ZodOptional<z.ZodString>;
    references: z.ZodArray<z.ZodString, "many">;
    encryption: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["smime", "pgp"]>;
        isEncrypted: z.ZodBoolean;
        isSigned: z.ZodBoolean;
        signatureValid: z.ZodOptional<z.ZodBoolean>;
        certificateInfo: z.ZodOptional<z.ZodObject<{
            issuer: z.ZodString;
            subject: z.ZodString;
            validFrom: z.ZodDate;
            validTo: z.ZodDate;
        }, "strip", z.ZodTypeAny, {
            subject: string;
            issuer: string;
            validFrom: Date;
            validTo: Date;
        }, {
            subject: string;
            issuer: string;
            validFrom: Date;
            validTo: Date;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "smime" | "pgp";
        isEncrypted: boolean;
        isSigned: boolean;
        signatureValid?: boolean | undefined;
        certificateInfo?: {
            subject: string;
            issuer: string;
            validFrom: Date;
            validTo: Date;
        } | undefined;
    }, {
        type: "smime" | "pgp";
        isEncrypted: boolean;
        isSigned: boolean;
        signatureValid?: boolean | undefined;
        certificateInfo?: {
            subject: string;
            issuer: string;
            validFrom: Date;
            validTo: Date;
        } | undefined;
    }>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    accountId: string;
    providerId: string;
    threadId: string;
    subject: string;
    snippet: string;
    from: {
        address: string;
        name?: string | undefined;
    };
    to: {
        address: string;
        name?: string | undefined;
    }[];
    date: Date;
    cc: {
        address: string;
        name?: string | undefined;
    }[];
    bcc: {
        address: string;
        name?: string | undefined;
    }[];
    replyTo: {
        address: string;
        name?: string | undefined;
    }[];
    flags: {
        isRead: boolean;
        isStarred: boolean;
        isTrashed: boolean;
        isSpam: boolean;
        isImportant: boolean;
        isArchived: boolean;
        isDraft: boolean;
        isSent: boolean;
        hasAttachments: boolean;
    };
    labels: string[];
    folder: string;
    importance: "normal" | "low" | "high";
    priority: "normal" | "low" | "high";
    size: number;
    attachments: {
        id: string;
        size: number;
        filename: string;
        mimeType: string;
        isInline: boolean;
        contentId?: string | undefined;
        downloadUrl?: string | undefined;
        localPath?: string | undefined;
    }[];
    headers: Record<string, string>;
    messageId: string;
    references: string[];
    createdAt: Date;
    updatedAt: Date;
    bodyHtml?: string | undefined;
    bodyText?: string | undefined;
    inReplyTo?: string | undefined;
    encryption?: {
        type: "smime" | "pgp";
        isEncrypted: boolean;
        isSigned: boolean;
        signatureValid?: boolean | undefined;
        certificateInfo?: {
            subject: string;
            issuer: string;
            validFrom: Date;
            validTo: Date;
        } | undefined;
    } | undefined;
}, {
    id: string;
    accountId: string;
    providerId: string;
    threadId: string;
    subject: string;
    snippet: string;
    from: {
        address: string;
        name?: string | undefined;
    };
    to: {
        address: string;
        name?: string | undefined;
    }[];
    date: Date;
    cc: {
        address: string;
        name?: string | undefined;
    }[];
    bcc: {
        address: string;
        name?: string | undefined;
    }[];
    replyTo: {
        address: string;
        name?: string | undefined;
    }[];
    flags: {
        isRead: boolean;
        isStarred: boolean;
        isTrashed: boolean;
        isSpam: boolean;
        isImportant: boolean;
        isArchived: boolean;
        isDraft: boolean;
        isSent: boolean;
        hasAttachments: boolean;
    };
    labels: string[];
    folder: string;
    importance: "normal" | "low" | "high";
    priority: "normal" | "low" | "high";
    size: number;
    attachments: {
        id: string;
        size: number;
        filename: string;
        mimeType: string;
        isInline: boolean;
        contentId?: string | undefined;
        downloadUrl?: string | undefined;
        localPath?: string | undefined;
    }[];
    headers: Record<string, string>;
    messageId: string;
    references: string[];
    createdAt: Date;
    updatedAt: Date;
    bodyHtml?: string | undefined;
    bodyText?: string | undefined;
    inReplyTo?: string | undefined;
    encryption?: {
        type: "smime" | "pgp";
        isEncrypted: boolean;
        isSigned: boolean;
        signatureValid?: boolean | undefined;
        certificateInfo?: {
            subject: string;
            issuer: string;
            validFrom: Date;
            validTo: Date;
        } | undefined;
    } | undefined;
}>;
export declare const MailAccountSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    provider: z.ZodEnum<["gmail", "outlook", "exchange", "imap", "fastmail", "proton", "yahoo", "aol"]>;
    config: z.ZodAny;
    credentials: z.ZodOptional<z.ZodObject<{
        accessToken: z.ZodOptional<z.ZodString>;
        refreshToken: z.ZodOptional<z.ZodString>;
        tokenExpiresAt: z.ZodOptional<z.ZodDate>;
        password: z.ZodOptional<z.ZodString>;
        additionalTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        password?: string | undefined;
        additionalTokens?: Record<string, string> | undefined;
    }, {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        password?: string | undefined;
        additionalTokens?: Record<string, string> | undefined;
    }>>;
    status: z.ZodEnum<["active", "auth_error", "quota_exceeded", "suspended", "disabled", "error"]>;
    lastSyncAt: z.ZodOptional<z.ZodDate>;
    nextSyncAt: z.ZodOptional<z.ZodDate>;
    syncIntervalMinutes: z.ZodNumber;
    isEnabled: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    status: "error" | "active" | "auth_error" | "quota_exceeded" | "suspended" | "disabled";
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    email: string;
    provider: "imap" | "gmail" | "outlook" | "exchange" | "fastmail" | "proton" | "yahoo" | "aol";
    syncIntervalMinutes: number;
    isEnabled: boolean;
    config?: any;
    credentials?: {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        password?: string | undefined;
        additionalTokens?: Record<string, string> | undefined;
    } | undefined;
    lastSyncAt?: Date | undefined;
    nextSyncAt?: Date | undefined;
}, {
    id: string;
    name: string;
    status: "error" | "active" | "auth_error" | "quota_exceeded" | "suspended" | "disabled";
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    email: string;
    provider: "imap" | "gmail" | "outlook" | "exchange" | "fastmail" | "proton" | "yahoo" | "aol";
    syncIntervalMinutes: number;
    isEnabled: boolean;
    config?: any;
    credentials?: {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        password?: string | undefined;
        additionalTokens?: Record<string, string> | undefined;
    } | undefined;
    lastSyncAt?: Date | undefined;
    nextSyncAt?: Date | undefined;
}>;
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
//# sourceMappingURL=mail.d.ts.map