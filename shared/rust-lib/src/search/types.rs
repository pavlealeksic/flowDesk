//! Core types for the unified search system

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Content types that can be indexed and searched
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContentType {
    Email,
    CalendarEvent,
    Contact,
    File,
    Document,
    Message,     // Chat message
    Channel,
    Thread,
    Task,
    Project,
    Issue,
    PullRequest,
    Commit,
    Meeting,
    Note,
    Bookmark,
    Custom(String),
}

impl std::fmt::Display for ContentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ContentType::Email => write!(f, "email"),
            ContentType::CalendarEvent => write!(f, "calendar_event"),
            ContentType::Contact => write!(f, "contact"),
            ContentType::File => write!(f, "file"),
            ContentType::Document => write!(f, "document"),
            ContentType::Message => write!(f, "message"),
            ContentType::Channel => write!(f, "channel"),
            ContentType::Thread => write!(f, "thread"),
            ContentType::Task => write!(f, "task"),
            ContentType::Project => write!(f, "project"),
            ContentType::Issue => write!(f, "issue"),
            ContentType::PullRequest => write!(f, "pull_request"),
            ContentType::Commit => write!(f, "commit"),
            ContentType::Meeting => write!(f, "meeting"),
            ContentType::Note => write!(f, "note"),
            ContentType::Bookmark => write!(f, "bookmark"),
            ContentType::Custom(s) => write!(f, "{}", s),
        }
    }
}

impl ContentType {
    /// Get the string representation of the content type
    pub fn as_str(&self) -> &str {
        match self {
            Self::Email => "email",
            Self::CalendarEvent => "calendar_event",
            Self::Contact => "contact",
            Self::File => "file",
            Self::Document => "document",
            Self::Message => "message",
            Self::Channel => "channel",
            Self::Thread => "thread",
            Self::Task => "task",
            Self::Project => "project",
            Self::Issue => "issue",
            Self::PullRequest => "pull_request",
            Self::Commit => "commit",
            Self::Meeting => "meeting",
            Self::Note => "note",
            Self::Bookmark => "bookmark",
            Self::Custom(s) => s,
        }
    }
}

/// Search provider types
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    // Email providers
    Gmail,
    Outlook,
    Exchange,
    Imap,
    
    // Communication providers
    Slack,
    Teams,
    Discord,
    Telegram,
    WhatsApp,
    Signal,
    
    // Productivity providers
    Notion,
    Confluence,
    Asana,
    Trello,
    Jira,
    Linear,
    Monday,
    
    // File storage providers
    GoogleDrive,
    OneDrive,
    Dropbox,
    Box,
    
    // Development providers
    GitHub,
    GitLab,
    Bitbucket,
    
    // Meeting providers
    Zoom,
    Meet,
    Webex,
    
    // Local providers
    LocalFiles,
    LocalMail,
    LocalCalendar,
    LocalContacts,
    
    // Plugin providers
    Plugin(String),
}

impl ProviderType {
    /// Get the string representation of the provider type
    pub fn as_str(&self) -> &str {
        match self {
            Self::Gmail => "gmail",
            Self::Outlook => "outlook",
            Self::Exchange => "exchange",
            Self::Imap => "imap",
            Self::Slack => "slack",
            Self::Teams => "teams",
            Self::Discord => "discord",
            Self::Telegram => "telegram",
            Self::WhatsApp => "whatsapp",
            Self::Signal => "signal",
            Self::Notion => "notion",
            Self::Confluence => "confluence",
            Self::Asana => "asana",
            Self::Trello => "trello",
            Self::Jira => "jira",
            Self::Linear => "linear",
            Self::Monday => "monday",
            Self::GoogleDrive => "googledrive",
            Self::OneDrive => "onedrive",
            Self::Dropbox => "dropbox",
            Self::Box => "box",
            Self::GitHub => "github",
            Self::GitLab => "gitlab",
            Self::Bitbucket => "bitbucket",
            Self::Zoom => "zoom",
            Self::Meet => "meet",
            Self::Webex => "webex",
            Self::LocalFiles => "local_files",
            Self::LocalMail => "local_mail",
            Self::LocalCalendar => "local_calendar",
            Self::LocalContacts => "local_contacts",
            Self::Plugin(name) => name,
        }
    }
}

/// Document to be indexed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchDocument {
    /// Unique document identifier
    pub id: String,
    
    /// Document title
    pub title: String,
    
    /// Document content/body
    pub content: String,
    
    /// Brief summary or snippet
    pub summary: Option<String>,
    
    /// Content type
    pub content_type: ContentType,
    
    /// Source provider ID
    pub provider_id: String,
    
    /// Provider type
    pub provider_type: ProviderType,
    
    /// Account ID for the source
    pub account_id: Option<String>,
    
    /// File path (for local files)
    pub file_path: Option<String>,
    
    /// Document URL or deep link
    pub url: Option<String>,
    
    /// Document icon
    pub icon: Option<String>,
    
    /// Document thumbnail
    pub thumbnail: Option<String>,
    
    /// Document metadata
    pub metadata: DocumentMetadata,
    
    /// Document tags
    pub tags: Vec<String>,
    
    /// Document categories
    pub categories: Vec<String>,
    
    /// Document author/creator
    pub author: Option<String>,
    
    /// Document creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last modification timestamp
    pub last_modified: DateTime<Utc>,
    
    /// Indexing information
    pub indexing_info: IndexingInfo,
}

/// Document metadata for additional information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    /// Document author/creator
    pub author: Option<String>,
    
    /// Document creation timestamp
    pub created_at: Option<DateTime<Utc>>,
    
    /// Last modification timestamp
    pub modified_at: Option<DateTime<Utc>>,
    
    /// File size (for files)
    pub file_size: Option<u64>,
    
    /// File size (for files) - alias for backwards compatibility
    pub size: Option<u64>,
    
    /// File type (for files)
    pub file_type: Option<String>,
    
    /// MIME type (for files)
    pub mime_type: Option<String>,
    
    /// Language code
    pub language: Option<String>,
    
    /// Document tags
    pub tags: Vec<String>,
    
    /// Custom metadata fields
    pub custom_fields: HashMap<String, String>,
    
    /// Location information
    pub location: Option<LocationInfo>,
    
    /// Collaboration information
    pub collaboration: Option<CollaborationInfo>,
    
    /// Activity information
    pub activity: Option<ActivityInfo>,
    
    /// Priority or importance level
    pub priority: Option<String>,
    
    /// Status information
    pub status: Option<String>,
    
    /// Custom metadata fields
    pub custom: HashMap<String, serde_json::Value>,
}

/// Location information for documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationInfo {
    pub path: Option<String>,
    pub folder: Option<String>,
    pub workspace: Option<String>,
    pub project: Option<String>,
}

/// Collaboration information for documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollaborationInfo {
    pub shared: bool,
    pub collaborators: Vec<String>,
    pub permissions: Option<String>,
}

/// Activity information for documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityInfo {
    pub views: u32,
    pub edits: u32,
    pub comments: u32,
    pub last_activity: Option<DateTime<Utc>>,
}

/// Indexing information for documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingInfo {
    /// When the document was indexed
    pub indexed_at: DateTime<Utc>,
    
    /// Document version for change tracking
    pub version: u64,
    
    /// Content checksum for change detection
    pub checksum: String,
    
    /// Whether this is a full or incremental index
    pub index_type: IndexType,
}

/// Type of indexing operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexType {
    Full,
    Incremental,
    Delete,
}

/// Search query structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    /// Search query string
    pub query: String,
    
    /// Content types to search
    pub content_types: Option<Vec<ContentType>>,
    
    /// Provider IDs to search
    pub provider_ids: Option<Vec<String>>,
    
    /// Search filters
    pub filters: Option<Vec<SearchFilter>>,
    
    /// Search sorting
    pub sort: Option<SearchSort>,
    
    /// Maximum results to return
    pub limit: Option<usize>,
    
    /// Result offset for pagination
    pub offset: Option<usize>,
    
    /// Search options
    pub options: SearchOptions,
}

/// Search filter for refining results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilter {
    /// Field to filter on
    pub field: String,
    
    /// Filter operator
    pub operator: FilterOperator,
    
    /// Filter value
    pub value: serde_json::Value,
    
    /// Boost factor for relevance
    pub boost: Option<f32>,
}

/// Filter operators for search queries
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperator {
    Equals,
    NotEquals,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    In,
    NotIn,
    Exists,
    NotExists,
    Range,
    Regex,
    Fuzzy,
}

/// Search sorting configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSort {
    /// Field to sort by
    pub field: String,
    
    /// Sort direction
    pub direction: SortDirection,
    
    /// Sort boost factor
    pub boost: Option<f32>,
}

/// Sort direction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortDirection {
    Asc,
    Desc,
}

/// Search options for controlling search behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    /// Enable fuzzy matching
    pub fuzzy: Option<bool>,
    
    /// Fuzzy matching threshold (0.0 to 1.0)
    pub fuzzy_threshold: Option<f32>,
    
    /// Enable semantic search
    pub semantic: Option<bool>,
    
    /// Enable faceted search
    pub facets: Option<bool>,
    
    /// Enable result highlighting
    pub highlighting: Option<bool>,
    
    /// Enable search suggestions
    pub suggestions: Option<bool>,
    
    /// Search timeout in milliseconds
    pub timeout: Option<u64>,
    
    /// Include debug information
    pub debug: Option<bool>,
    
    /// Use cached results if available
    pub use_cache: Option<bool>,
    
    /// Cache TTL in seconds
    pub cache_ttl: Option<u64>,
    
    /// Content types to search
    pub content_types: Option<Vec<ContentType>>,
    
    /// Maximum number of results to return
    pub limit: Option<usize>,
    
    /// Offset for pagination
    pub offset: Option<usize>,
    
    /// Sort field
    pub sort_by: Option<String>,
    
    /// Sort order
    pub sort_order: Option<String>,
    
    /// Search filters
    pub filters: Option<HashMap<String, String>>,
    
    /// Enable highlighting (alternative to highlighting field)
    pub highlight: Option<bool>,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            fuzzy: Some(true),
            fuzzy_threshold: Some(0.8),
            semantic: Some(false),
            facets: Some(true),
            highlighting: Some(true),
            suggestions: Some(true),
            timeout: Some(5000), // 5 seconds
            debug: Some(false),
            use_cache: Some(true),
            cache_ttl: Some(300), // 5 minutes
            content_types: None,
            limit: Some(50),
            offset: Some(0),
            sort_by: None,
            sort_order: None,
            filters: None,
            highlight: Some(true),
        }
    }
}

/// Search result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// Result document ID
    pub id: String,
    
    /// Result title
    pub title: String,
    
    /// Result description/snippet
    pub description: Option<String>,
    
    /// Result content (may be truncated)
    pub content: Option<String>,
    
    /// Result URL or deep link
    pub url: Option<String>,
    
    /// Result icon
    pub icon: Option<String>,
    
    /// Result thumbnail
    pub thumbnail: Option<String>,
    
    /// Content type
    pub content_type: ContentType,
    
    /// Source provider ID
    pub provider_id: String,
    
    /// Provider type
    pub provider_type: ProviderType,
    
    /// Search relevance score (0.0 to 1.0)
    pub score: f32,
    
    /// Result metadata
    pub metadata: DocumentMetadata,
    
    /// Highlighted text segments
    pub highlights: Option<Vec<SearchHighlight>>,
    
    /// Available actions for this result
    pub actions: Option<Vec<SearchAction>>,
    
    /// Document creation timestamp
    pub created_at: DateTime<Utc>,
    
    /// Last modification timestamp
    pub last_modified: DateTime<Utc>,
}

/// Search highlighting information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHighlight {
    /// Field that was highlighted
    pub field: String,
    
    /// Highlighted text fragments
    pub fragments: Vec<String>,
    
    /// Character positions in original text
    pub positions: Option<Vec<HighlightPosition>>,
}

/// Character position for highlighting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightPosition {
    pub start: usize,
    pub end: usize,
}

/// Available actions for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchAction {
    /// Action ID
    pub id: String,
    
    /// Action label
    pub label: String,
    
    /// Action icon
    pub icon: Option<String>,
    
    /// Action type
    pub action_type: ActionType,
    
    /// Action URL
    pub url: Option<String>,
    
    /// Custom action handler
    pub handler: Option<String>,
    
    /// Action parameters
    pub params: Option<HashMap<String, serde_json::Value>>,
}

/// Action types for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    Open,
    Download,
    Share,
    Edit,
    Delete,
    Custom,
}

/// Search response containing results and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    /// Original search query
    pub query: SearchQuery,
    
    /// Search results
    pub results: Vec<SearchResult>,
    
    /// Total number of results (before pagination)
    pub total_count: usize,
    
    /// Search execution time in milliseconds
    pub execution_time_ms: u64,
    
    /// Search facets (if enabled)
    pub facets: Option<Vec<SearchFacet>>,
    
    /// Search suggestions (if enabled)
    pub suggestions: Option<Vec<String>>,
    
    /// Debug information (if enabled)
    pub debug_info: Option<SearchDebugInfo>,
    
    /// Next page token for pagination
    pub next_page_token: Option<String>,
    
    /// Provider-specific responses
    pub provider_responses: Option<Vec<ProviderResponse>>,
}

/// Search facet for filtering results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFacet {
    /// Facet name
    pub name: String,
    
    /// Field this facet is based on
    pub field: String,
    
    /// Facet values
    pub values: Vec<FacetValue>,
    
    /// Facet type
    pub facet_type: FacetType,
    
    /// Facet value (for individual facet items)
    pub value: Option<serde_json::Value>,
    
    /// Count of documents with this facet value
    pub count: Option<i64>,
    
    /// Whether this facet is selected
    pub selected: Option<bool>,
}

/// Individual facet value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacetValue {
    /// Facet value
    pub value: serde_json::Value,
    
    /// Number of documents with this value
    pub count: usize,
    
    /// Whether this value is currently selected
    pub selected: bool,
}

/// Types of search facets
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FacetType {
    Terms,
    Range,
    Date,
    Numeric,
}

/// Debug information for search queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchDebugInfo {
    /// Query parsing information
    pub parsing: Option<ParsingInfo>,
    
    /// Execution timing information
    pub execution: Option<ExecutionInfo>,
    
    /// Provider performance information
    pub providers: Option<Vec<ProviderPerformance>>,
}

/// Query parsing debug information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsingInfo {
    pub original_query: String,
    pub parsed_query: serde_json::Value,
    pub warnings: Vec<String>,
}

/// Execution timing debug information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionInfo {
    pub total_time_ms: u64,
    pub index_time_ms: u64,
    pub search_time_ms: u64,
    pub merge_time_ms: u64,
}

/// Provider performance debug information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPerformance {
    pub provider_id: String,
    pub execution_time_ms: u64,
    pub result_count: usize,
    pub errors: Vec<String>,
}

/// Provider-specific search response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderResponse {
    /// Provider ID
    pub provider_id: String,
    
    /// Provider type
    pub provider_type: ProviderType,
    
    /// Provider results
    pub results: Vec<SearchResult>,
    
    /// Execution time for this provider
    pub execution_time_ms: u64,
    
    /// Provider errors
    pub errors: Vec<String>,
    
    /// Provider warnings
    pub warnings: Vec<String>,
}

/// Indexing job for background operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingJob {
    /// Job ID
    pub id: Uuid,
    
    /// Job type
    pub job_type: IndexingJobType,
    
    /// Provider ID
    pub provider_id: String,
    
    /// Job status
    pub status: JobStatus,
    
    /// Job progress (0.0 to 1.0)
    pub progress: f32,
    
    /// Job configuration
    pub config: IndexingJobConfig,
    
    /// Job statistics
    pub stats: JobStats,
    
    /// Job errors
    pub errors: Vec<JobError>,
    
    /// Job start time
    pub started_at: Option<DateTime<Utc>>,
    
    /// Job completion time
    pub completed_at: Option<DateTime<Utc>>,
    
    /// Job creation time
    pub created_at: DateTime<Utc>,
}

/// Types of indexing jobs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexingJobType {
    FullIndex,
    IncrementalIndex,
    DeleteIndex,
    OptimizeIndex,
}

/// Job status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Indexing job configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingJobConfig {
    pub batch_size: usize,
    pub timeout_ms: u64,
    pub max_retries: u32,
}

/// Job execution statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStats {
    pub total_documents: usize,
    pub processed_documents: usize,
    pub indexed_documents: usize,
    pub skipped_documents: usize,
    pub error_documents: usize,
}

/// Job error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobError {
    pub document_id: Option<String>,
    pub error_message: String,
    pub timestamp: DateTime<Utc>,
}
/// Sort order for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortOrder {
    Relevance,
    DateAscending, 
    DateDescending,
    Alphabetical,
}

/// Query performance breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPerformanceBreakdown {
    pub parsing_time_ms: u64,
    pub execution_time_ms: u64,
    pub total_time_ms: u64,
}

/// Sort configuration for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortConfig {
    pub field: String,
    pub direction: SortDirection,
    pub boost: Option<f32>,
}

/// Highlight configuration for search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightConfig {
    pub enabled: bool,
    pub max_fragments: usize,
    pub fragment_length: usize,
    pub pre_tag: String,
    pub post_tag: String,
}
