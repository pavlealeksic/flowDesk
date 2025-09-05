//! Core types for the mail engine

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Email address with optional display name
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EmailAddress {
    pub address: String,
    pub name: Option<String>,
    pub email: String, // Alias for address for compatibility
}

impl Default for EmailAddress {
    fn default() -> Self {
        Self {
            name: None,
            address: "unknown@example.com".to_string(),
            email: "unknown@example.com".to_string(),
        }
    }
}

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
    pub config: ProviderAccountConfig,
    pub sync_status: Option<MailSyncStatus>,
    /// Display name for the account
    pub display_name: String,
    /// OAuth tokens for the account
    pub oauth_tokens: Option<OAuthTokens>,
    /// IMAP configuration
    pub imap_config: Option<ImapConfig>,
    /// SMTP configuration
    pub smtp_config: Option<SmtpConfig>,
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
    pub folder_id: Option<Uuid>,
    pub importance: MessageImportance,
    pub priority: MessagePriority,
    pub size: i64,
    pub attachments: Vec<EmailAttachment>,
    pub headers: HashMap<String, String>,
    pub message_id: String,
    pub message_id_header: Option<String>, // Alias for message_id for compatibility
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub encryption: Option<EmailEncryption>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub is_replied: bool,
    pub is_forwarded: bool,
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
    pub content_type: String, // Alias for mime_type for compatibility
    pub size: i64,
    pub content_id: Option<String>,
    pub is_inline: bool,
    pub inline: bool, // Alias for is_inline for compatibility
    pub download_url: Option<String>,
    pub local_path: Option<String>,
    pub data: Option<Vec<u8>>, // Attachment data when available
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
    pub messages: Vec<EmailMessage>,
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
    pub can_select: bool,
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
    // Additional direct filter fields for easier access
    pub subject_keywords: Vec<String>,
    pub from_addresses: Vec<String>,
    pub to_addresses: Vec<String>,
    pub body_keywords: Vec<String>,
    pub has_attachment: Option<bool>,
    pub target_folder_id: Option<Uuid>,
    pub mark_as_read: Option<bool>,
    pub mark_as_important: Option<bool>,
    pub apply_label: Option<String>,
    pub forward_to: Option<String>,
    pub delete_message: Option<bool>,
    pub mark_as_spam: Option<bool>,
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

/// Email template with enhanced features
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
    pub conditionals: Vec<TemplateConditional>,
    pub usage_count: i32,
    pub is_favorite: bool,
    pub is_shared: bool,
    pub is_public: bool,
    pub tags: Vec<String>,
    pub template_type: TemplateType,
    pub formatting_settings: TemplateFormatting,
    pub permissions: TemplatePermissions,
    pub version: i32,
    pub parent_id: Option<Uuid>, // For template versioning
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

/// Template variable definition with enhanced features
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVariable {
    pub key: String,
    pub label: String,
    pub variable_type: VariableType,
    pub default_value: Option<String>,
    pub is_required: bool,
    pub description: Option<String>,
    pub placeholder: Option<String>,
    pub validation_rules: Vec<ValidationRule>,
    pub options: Option<Vec<String>>, // For select/dropdown variables
    pub min_length: Option<i32>,
    pub max_length: Option<i32>,
    pub format_pattern: Option<String>, // Regex pattern for validation
    pub auto_complete_source: Option<AutoCompleteSource>,
}

/// Variable types for templates with enhanced options
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VariableType {
    Text,
    Email,
    Date,
    DateTime,
    Time,
    Number,
    Boolean,
    Select,
    MultiSelect,
    Url,
    Phone,
    Address,
    Currency,
    Percentage,
    RichText,
    Image,
    File,
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
    Archive,
    Spam,
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
            is_replied: false,
            is_forwarded: false,
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
    pub token_type: Option<String>,
    pub scope: Option<String>,
}

/// IMAP configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImapConfig {
    pub server: String,
    pub host: String,
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

// Add convenience methods to EmailMessage
impl EmailMessage {
    pub fn is_read(&self) -> bool {
        self.flags.is_read
    }

    pub fn is_starred(&self) -> bool {
        self.flags.is_starred
    }

    pub fn is_important(&self) -> bool {
        self.flags.is_important
    }

    pub fn has_attachments(&self) -> bool {
        self.flags.has_attachments
    }

    pub fn received_at(&self) -> DateTime<Utc> {
        self.date
    }
}

// Enhanced template and scheduling types

/// Template conditional logic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateConditional {
    pub id: String,
    pub condition_type: ConditionalType,
    pub condition_expression: String,
    pub true_content: String,
    pub false_content: Option<String>,
    pub variables_referenced: Vec<String>,
}

/// Template conditional types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConditionalType {
    IfElse,
    Switch,
    Loop,
    Show,
    Hide,
}

/// Template type classification
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateType {
    Email,
    Reply,
    Forward,
    Newsletter,
    Marketing,
    Transactional,
    Internal,
    Meeting,
    FollowUp,
    Custom,
}

/// Template formatting settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateFormatting {
    pub font_family: Option<String>,
    pub font_size: Option<i32>,
    pub line_height: Option<f32>,
    pub text_color: Option<String>,
    pub background_color: Option<String>,
    pub signature_position: SignaturePosition,
    pub include_signature: bool,
    pub auto_format: bool,
    pub preserve_formatting: bool,
}

/// Template permissions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplatePermissions {
    pub can_edit: Vec<Uuid>, // User IDs who can edit
    pub can_view: Vec<Uuid>, // User IDs who can view
    pub can_use: Vec<Uuid>,  // User IDs who can use
    pub is_organization_wide: bool,
    pub visibility: TemplateVisibility,
}

/// Template visibility levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TemplateVisibility {
    Private,
    Team,
    Organization,
    Public,
}

/// Signature positioning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SignaturePosition {
    Below,
    Above,
    None,
}

/// Validation rule for template variables
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRule {
    pub rule_type: ValidationType,
    pub parameters: HashMap<String, serde_json::Value>,
    pub error_message: String,
}

/// Validation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ValidationType {
    Required,
    MinLength,
    MaxLength,
    Regex,
    Email,
    Url,
    Number,
    Date,
    Custom,
}

/// Auto-completion source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCompleteSource {
    pub source_type: AutoCompleteType,
    pub endpoint: Option<String>,
    pub static_values: Option<Vec<String>>,
    pub query_parameter: Option<String>,
}

/// Auto-completion types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AutoCompleteType {
    Static,
    Dynamic,
    Contacts,
    Companies,
    Projects,
    Tags,
    Custom,
}

/// Enhanced scheduled email with timezone support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledEmail {
    pub id: Uuid,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub template_id: Option<Uuid>,
    pub to: Vec<EmailAddress>,
    pub cc: Vec<EmailAddress>,
    pub bcc: Vec<EmailAddress>,
    pub subject: String,
    pub body_html: String,
    pub body_text: String,
    pub attachments: Vec<EmailAttachment>,
    pub scheduled_time: DateTime<Utc>,
    pub timezone: String, // IANA timezone identifier
    pub status: ScheduleStatus,
    pub recurring: Option<RecurringSettings>,
    pub send_attempts: i32,
    pub max_attempts: i32,
    pub priority: SchedulePriority,
    pub metadata: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub last_attempt_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Schedule status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ScheduleStatus {
    Pending,
    Sending,
    Sent,
    Failed,
    Cancelled,
    Expired,
    Paused,
}

/// Schedule priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SchedulePriority {
    Low,
    Normal,
    High,
    Urgent,
}

/// Recurring email settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringSettings {
    pub pattern: RecurringPattern,
    pub interval: i32,
    pub end_type: RecurringEndType,
    pub end_date: Option<DateTime<Utc>>,
    pub occurrence_count: Option<i32>,
    pub days_of_week: Option<Vec<u8>>, // 0-6, Sunday = 0
    pub day_of_month: Option<i32>,
    pub month_of_year: Option<i32>,
    pub skip_weekends: bool,
    pub skip_holidays: bool,
    pub last_sent: Option<DateTime<Utc>>,
    pub next_scheduled: Option<DateTime<Utc>>,
}

/// Recurring pattern types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecurringPattern {
    Daily,
    Weekly,
    Monthly,
    Yearly,
    Weekdays,
    Custom,
}

/// Recurring end types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecurringEndType {
    Never,
    Date,
    Occurrences,
}

/// Template category with enhanced metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateCategory {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub parent_id: Option<Uuid>,
    pub sort_order: i32,
    pub is_system: bool,
    pub template_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Template usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateUsageStats {
    pub template_id: Uuid,
    pub total_uses: i32,
    pub uses_this_month: i32,
    pub uses_this_week: i32,
    pub last_used_at: Option<DateTime<Utc>>,
    pub average_rating: Option<f32>,
    pub user_ratings: HashMap<Uuid, i32>,
    pub conversion_rate: Option<f32>, // If tracking responses
}

/// Email template library
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateLibrary {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Uuid,
    pub is_public: bool,
    pub templates: Vec<Uuid>, // Template IDs
    pub categories: Vec<Uuid>, // Category IDs
    pub subscribers: Vec<Uuid>, // User IDs subscribed to this library
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Default implementations for new types
impl Default for TemplateFormatting {
    fn default() -> Self {
        Self {
            font_family: None,
            font_size: None,
            line_height: None,
            text_color: None,
            background_color: None,
            signature_position: SignaturePosition::Below,
            include_signature: true,
            auto_format: false,
            preserve_formatting: false,
        }
    }
}

impl Default for TemplatePermissions {
    fn default() -> Self {
        Self {
            can_edit: Vec::new(),
            can_view: Vec::new(),
            can_use: Vec::new(),
            is_organization_wide: false,
            visibility: TemplateVisibility::Private,
        }
    }
}

impl Default for SchedulePriority {
    fn default() -> Self {
        Self::Normal
    }
}

impl Default for TemplateType {
    fn default() -> Self {
        Self::Email
    }
}
