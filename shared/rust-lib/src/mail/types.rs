//! Core types for the mail engine

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Mail provider types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MailProvider {
    Gmail,
    Outlook,
    Exchange,
    Imap,
    Fastmail,
    Proton,
    Yahoo,
    Aol,
}

impl MailProvider {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Gmail => "gmail",
            Self::Outlook => "outlook",
            Self::Exchange => "exchange",
            Self::Imap => "imap",
            Self::Fastmail => "fastmail",
            Self::Proton => "proton",
            Self::Yahoo => "yahoo",
            Self::Aol => "aol",
        }
    }

    pub fn supports_oauth(&self) -> bool {
        matches!(self, Self::Gmail | Self::Outlook | Self::Exchange)
    }

    pub fn supports_push_notifications(&self) -> bool {
        matches!(self, Self::Gmail | Self::Outlook)
    }

    pub fn requires_app_password(&self) -> bool {
        matches!(self, Self::Yahoo | Self::Aol)
    }
}

/// Mail account status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MailAccountStatus {
    Active,
    AuthError,
    QuotaExceeded,
    Suspended,
    Disabled,
    Error,
}

/// Mail account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailAccount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub provider: MailProvider,
    pub status: MailAccountStatus,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub next_sync_at: Option<DateTime<Utc>>,
    pub sync_interval_minutes: i32,
    pub is_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub provider_config: ProviderAccountConfig,
}

/// Provider-specific account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "provider", content = "config")]
pub enum ProviderAccountConfig {
    Gmail {
        client_id: String,
        scopes: Vec<String>,
        enable_push_notifications: bool,
        history_id: Option<String>,
    },
    Outlook {
        client_id: String,
        tenant_id: Option<String>,
        scopes: Vec<String>,
        enable_webhooks: bool,
        delta_token: Option<String>,
    },
    Exchange {
        server_url: String,
        version: String,
        domain: Option<String>,
        use_autodiscovery: bool,
    },
    Imap {
        imap_host: String,
        imap_port: u16,
        imap_tls: bool,
        smtp_host: String,
        smtp_port: u16,
        smtp_tls: bool,
        folder_mappings: HashMap<String, String>,
    },
}

/// Email message representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailMessage {
    pub id: Uuid,
    pub account_id: Uuid,
    pub provider_id: String,
    pub thread_id: Uuid,
    pub subject: String,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub snippet: String,
    pub from: EmailAddress,
    pub to: Vec<EmailAddress>,
    pub cc: Vec<EmailAddress>,
    pub bcc: Vec<EmailAddress>,
    pub reply_to: Vec<EmailAddress>,
    pub date: DateTime<Utc>,
    pub flags: EmailFlags,
    pub labels: Vec<String>,
    pub folder: String,
    pub importance: MessageImportance,
    pub priority: MessagePriority,
    pub size: i64,
    pub attachments: Vec<EmailAttachment>,
    pub headers: HashMap<String, String>,
    pub message_id: String,
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub encryption: Option<EmailEncryption>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Email address representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailAddress {
    pub name: Option<String>,
    pub address: String,
}

/// Email message flags
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailFlags {
    pub is_read: bool,
    pub is_starred: bool,
    pub is_trashed: bool,
    pub is_spam: bool,
    pub is_important: bool,
    pub is_archived: bool,
    pub is_draft: bool,
    pub is_sent: bool,
    pub has_attachments: bool,
}

/// Message importance level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MessageImportance {
    Low,
    Normal,
    High,
}

/// Message priority level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MessagePriority {
    Low,
    Normal,
    High,
}

/// Email attachment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailAttachment {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub size: i64,
    pub content_id: Option<String>,
    pub is_inline: bool,
    pub download_url: Option<String>,
    pub local_path: Option<String>,
}

/// Email encryption information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailEncryption {
    pub encryption_type: EncryptionType,
    pub is_encrypted: bool,
    pub is_signed: bool,
    pub signature_valid: Option<bool>,
    pub certificate_info: Option<CertificateInfo>,
}

/// Encryption type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EncryptionType {
    SMime,
    Pgp,
}

/// Certificate information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateInfo {
    pub issuer: String,
    pub subject: String,
    pub valid_from: DateTime<Utc>,
    pub valid_to: DateTime<Utc>,
}

/// Email thread/conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailThread {
    pub id: Uuid,
    pub account_id: Uuid,
    pub subject: String,
    pub message_ids: Vec<Uuid>,
    pub participants: Vec<EmailAddress>,
    pub labels: Vec<String>,
    pub flags: ThreadFlags,
    pub last_message_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Thread flags
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadFlags {
    pub has_unread: bool,
    pub has_starred: bool,
    pub has_important: bool,
    pub has_attachments: bool,
}

/// Mail folder/label
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailFolder {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub display_name: String,
    pub folder_type: MailFolderType,
    pub parent_id: Option<Uuid>,
    pub path: String,
    pub attributes: Vec<String>,
    pub message_count: i32,
    pub unread_count: i32,
    pub is_selectable: bool,
    pub sync_status: FolderSyncStatus,
}

/// Mail folder types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MailFolderType {
    Inbox,
    Sent,
    Drafts,
    Trash,
    Spam,
    Archive,
    Custom,
    System,
}

/// Folder synchronization status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderSyncStatus {
    pub last_sync_at: Option<DateTime<Utc>>,
    pub is_being_synced: bool,
    pub sync_progress: Option<f64>,
    pub sync_error: Option<String>,
}

/// Email filter/rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailFilter {
    pub id: Uuid,
    pub account_id: Option<Uuid>,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_enabled: bool,
    pub conditions: Vec<FilterCondition>,
    pub actions: Vec<FilterAction>,
    pub priority: i32,
    pub stop_processing: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Filter condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCondition {
    pub field: FilterField,
    pub operator: FilterOperator,
    pub value: String,
    pub case_sensitive: bool,
}

/// Filter fields
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FilterField {
    From,
    To,
    Cc,
    Bcc,
    Subject,
    Body,
    Headers,
    AttachmentName,
    Size,
    Date,
}

/// Filter operators
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FilterOperator {
    Equals,
    Contains,
    StartsWith,
    EndsWith,
    Regex,
    GreaterThan,
    LessThan,
    NotEquals,
    NotContains,
}

/// Filter action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterAction {
    pub action_type: FilterActionType,
    pub params: HashMap<String, serde_json::Value>,
}

/// Filter action types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FilterActionType {
    MoveToFolder,
    AddLabel,
    RemoveLabel,
    MarkRead,
    MarkUnread,
    Star,
    Unstar,
    MarkImportant,
    MarkUnimportant,
    Delete,
    Forward,
    AutoReply,
    Notify,
    RunAutomation,
}

/// Email signature
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSignature {
    pub id: Uuid,
    pub account_id: Option<Uuid>,
    pub user_id: Uuid,
    pub name: String,
    pub content_html: String,
    pub content_text: String,
    pub is_default: bool,
    pub usage: SignatureUsage,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Signature usage settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureUsage {
    pub new_messages: bool,
    pub replies: bool,
    pub forwards: bool,
    pub conditions: Option<Vec<FilterCondition>>,
}

/// Email template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplate {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub subject: String,
    pub body_html: String,
    pub body_text: String,
    pub variables: Vec<TemplateVariable>,
    pub usage_count: i32,
    pub is_favorite: bool,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

/// Template variable definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVariable {
    pub key: String,
    pub label: String,
    pub variable_type: VariableType,
    pub default_value: Option<String>,
    pub is_required: bool,
    pub description: Option<String>,
}

/// Variable types for templates
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VariableType {
    Text,
    Email,
    Date,
    Number,
    Boolean,
}

/// Mail sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailSyncStatus {
    pub account_id: Uuid,
    pub status: SyncStatus,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub current_operation: Option<SyncOperation>,
    pub stats: SyncStats,
    pub last_error: Option<SyncError>,
}

/// Sync status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncStatus {
    Idle,
    Syncing,
    Error,
    Paused,
}

/// Current sync operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    pub operation_type: SyncOperationType,
    pub folder: Option<String>,
    pub progress: f64,
    pub started_at: DateTime<Utc>,
}

/// Sync operation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncOperationType {
    FullSync,
    IncrementalSync,
    FolderSync,
}

/// Synchronization statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    pub total_messages: i32,
    pub new_messages: i32,
    pub updated_messages: i32,
    pub deleted_messages: i32,
    pub sync_errors: i32,
}

/// Sync error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncError {
    pub message: String,
    pub code: String,
    pub timestamp: DateTime<Utc>,
    pub details: Option<HashMap<String, serde_json::Value>>,
}

/// Search result for email messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSearchResult {
    pub query: String,
    pub total_count: i32,
    pub messages: Vec<EmailMessage>,
    pub took: u64,
    pub facets: Option<SearchFacets>,
    pub suggestions: Option<Vec<String>>,
}

/// Search facets for filtering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFacets {
    pub accounts: HashMap<String, i32>,
    pub folders: HashMap<String, i32>,
    pub senders: HashMap<String, i32>,
    pub date_ranges: HashMap<String, i32>,
}

/// Bulk operation on email messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkEmailOperation {
    pub operation_type: BulkOperationType,
    pub message_ids: Vec<Uuid>,
    pub params: Option<HashMap<String, serde_json::Value>>,
}

/// Bulk operation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BulkOperationType {
    MarkRead,
    MarkUnread,
    Star,
    Unstar,
    Delete,
    Move,
    AddLabel,
    RemoveLabel,
}

/// Bulk operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkOperationResult {
    pub successful: i32,
    pub failed: i32,
    pub errors: Vec<BulkOperationError>,
}

/// Bulk operation error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkOperationError {
    pub message_id: Uuid,
    pub error: String,
}

/// Bulk operation item result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkOperationItemResult {
    pub message_id: Uuid,
    pub success: bool,
    pub error: Option<String>,
}

// Default implementations
impl Default for EmailFlags {
    fn default() -> Self {
        Self {
            is_read: false,
            is_starred: false,
            is_trashed: false,
            is_spam: false,
            is_important: false,
            is_archived: false,
            is_draft: false,
            is_sent: false,
            has_attachments: false,
        }
    }
}

impl Default for MessageImportance {
    fn default() -> Self {
        Self::Normal
    }
}

impl Default for MessagePriority {
    fn default() -> Self {
        Self::Normal
    }
}

impl Default for ThreadFlags {
    fn default() -> Self {
        Self {
            has_unread: false,
            has_starred: false,
            has_important: false,
            has_attachments: false,
        }
    }
}

impl Default for FolderSyncStatus {
    fn default() -> Self {
        Self {
            last_sync_at: None,
            is_being_synced: false,
            sync_progress: None,
            sync_error: None,
        }
    }
}

impl Default for SyncStats {
    fn default() -> Self {
        Self {
            total_messages: 0,
            new_messages: 0,
            updated_messages: 0,
            deleted_messages: 0,
            sync_errors: 0,
        }
    }
}

impl Default for SignatureUsage {
    fn default() -> Self {
        Self {
            new_messages: true,
            replies: true,
            forwards: true,
            conditions: None,
        }
    }
}
/// OAuth2 tokens for authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// IMAP configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapConfig {
    pub server: String,
    pub port: u16,
    pub use_tls: bool,
    pub username: String,
    pub password: Option<String>,
}

/// SMTP configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmtpConfig {
    pub server: String,
    pub port: u16,
    pub use_tls: bool,
    pub username: String,
    pub password: Option<String>,
}

/// New message for sending
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewMessage {
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub bcc: Vec<String>,
    pub subject: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub attachments: Vec<String>, // File paths
}

/// Message flags for operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageFlags {
    pub is_seen: bool,
    pub is_answered: bool,
    pub is_flagged: bool,
    pub is_deleted: bool,
    pub is_draft: bool,
    pub is_recent: bool,
}

impl Default for MessageFlags {
    fn default() -> Self {
        Self {
            is_seen: false,
            is_answered: false,
            is_flagged: false,
            is_deleted: false,
            is_draft: false,
            is_recent: false,
        }
    }
}

// Type aliases for compatibility
pub type MailMessage = EmailMessage;
pub type MailAttachment = EmailAttachment;
pub type FolderType = MailFolderType;
