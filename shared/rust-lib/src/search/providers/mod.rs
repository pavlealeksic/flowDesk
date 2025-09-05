//! Search provider system for external data sources

pub mod manager;
pub mod traits;
pub mod local;
pub mod gmail;
pub mod slack;
pub mod notion;
pub mod github;

pub use manager::*;
pub use traits::*;
pub use local::*;
pub use gmail::*;
pub use slack::*;
pub use notion::*;
pub use github::*;

use crate::search::{SearchError, SearchResult, ProviderType, ProviderConfig};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

/// Provider capabilities and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    /// Provider unique ID
    pub id: String,
    
    /// Provider name
    pub name: String,
    
    /// Provider description
    pub description: String,
    
    /// Provider type
    pub provider_type: ProviderType,
    
    /// Provider version
    pub version: String,
    
    /// Supported content types
    pub supported_content_types: Vec<crate::search::ContentType>,
    
    /// Provider capabilities
    pub capabilities: ProviderCapabilities,
    
    /// Configuration schema
    pub config_schema: serde_json::Value,
    
    /// Authentication requirements
    pub auth_requirements: AuthRequirements,
}

/// Provider capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    /// Can perform real-time search
    pub real_time_search: bool,
    
    /// Can provide incremental indexing
    pub incremental_indexing: bool,
    
    /// Can provide full-text search
    pub full_text_search: bool,
    
    /// Can provide metadata search
    pub metadata_search: bool,
    
    /// Can provide faceted search
    pub faceted_search: bool,
    
    /// Maximum results per query
    pub max_results_per_query: usize,
    
    /// Rate limits (requests per minute)
    pub rate_limit_rpm: Option<u32>,
    
    /// Supports pagination
    pub pagination: bool,
    
    /// Supports sorting
    pub sorting: bool,
    
    /// Supports filtering
    pub filtering: bool,
}

/// Authentication requirements for providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthRequirements {
    /// Authentication type
    pub auth_type: AuthType,
    
    /// Required scopes/permissions
    pub required_scopes: Vec<String>,
    
    /// OAuth configuration (if applicable)
    pub oauth_config: Option<OAuthConfig>,
    
    /// API key configuration (if applicable)
    pub api_key_config: Option<ApiKeyConfig>,
}

/// Authentication types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthType {
    None,
    ApiKey,
    OAuth2,
    Basic,
    Custom,
}

/// OAuth configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub auth_url: String,
    pub token_url: String,
    pub client_id: Option<String>,
    pub scopes: Vec<String>,
}

/// API key configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyConfig {
    pub header_name: String,
    pub key_format: String,
    pub description: String,
}

/// Provider factory for creating provider instances
pub struct ProviderFactory;

impl ProviderFactory {
    /// Create a provider instance from configuration
    pub async fn create_provider(
        config: &ProviderConfig,
    ) -> SearchResult<Box<dyn SearchProvider + Send + Sync>> {
        match config.provider_type.as_str() {
            "local_files" => {
                let provider = LocalFilesProvider::new(config.config.clone()).await?;
                Ok(Box::new(provider))
            }
            "gmail" => {
                let provider = GmailProvider::new(config.config.clone()).await?;
                Ok(Box::new(provider))
            }
            "slack" => {
                let provider = SlackProvider::new(config.config.clone()).await?;
                Ok(Box::new(provider))
            }
            "notion" => {
                let provider = NotionProvider::new(config.config.clone()).await?;
                Ok(Box::new(provider))
            }
            "github" => {
                let provider = GitHubProvider::new(config.config.clone()).await?;
                Ok(Box::new(provider))
            }
            _ => {
                // Try to load as plugin provider
                Err(SearchError::provider_error(
                    &config.id,
                    format!("Unknown provider type: {}", config.provider_type)
                ))
            }
        }
    }
    
    /// Get available provider types
    pub fn get_available_providers() -> Vec<ProviderInfo> {
        vec![
            LocalFilesProvider::get_provider_info(),
            GmailProvider::get_provider_info(),
            SlackProvider::get_provider_info(),
            NotionProvider::get_provider_info(),
            GitHubProvider::get_provider_info(),
        ]
    }
}

/// Provider authentication state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAuth {
    /// Provider ID
    pub provider_id: String,
    
    /// Authentication status
    pub status: AuthStatus,
    
    /// Access token (encrypted)
    pub access_token: Option<String>,
    
    /// Refresh token (encrypted)
    pub refresh_token: Option<String>,
    
    /// Token expiry
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    
    /// Scopes granted
    pub granted_scopes: Vec<String>,
    
    /// User information
    pub user_info: Option<HashMap<String, serde_json::Value>>,
}

/// Authentication status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthStatus {
    NotAuthenticated,
    Authenticated,
    TokenExpired,
    AuthenticationError,
}

/// Provider statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStats {
    /// Provider ID
    pub provider_id: String,
    
    /// Total queries executed
    pub total_queries: u64,
    
    /// Successful queries
    pub successful_queries: u64,
    
    /// Failed queries
    pub failed_queries: u64,
    
    /// Average response time in milliseconds
    pub avg_response_time_ms: f64,
    
    /// Total documents indexed
    pub total_documents_indexed: u64,
    
    /// Last successful query
    pub last_successful_query: Option<chrono::DateTime<chrono::Utc>>,
    
    /// Last indexing operation
    pub last_indexing: Option<chrono::DateTime<chrono::Utc>>,
    
    /// Current error rate (0.0 to 1.0)
    pub error_rate: f64,
    
    /// Rate limit status
    pub rate_limit_status: RateLimitStatus,
}

/// Rate limit status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitStatus {
    /// Requests remaining in current window
    pub requests_remaining: u32,
    
    /// Window reset time
    pub window_reset: chrono::DateTime<chrono::Utc>,
    
    /// Whether we're currently rate limited
    pub is_rate_limited: bool,
}

impl Default for ProviderStats {
    fn default() -> Self {
        Self {
            provider_id: String::new(),
            total_queries: 0,
            successful_queries: 0,
            failed_queries: 0,
            avg_response_time_ms: 0.0,
            total_documents_indexed: 0,
            last_successful_query: None,
            last_indexing: None,
            error_rate: 0.0,
            rate_limit_status: RateLimitStatus {
                requests_remaining: 100,
                window_reset: chrono::Utc::now() + chrono::Duration::minutes(1),
                is_rate_limited: false,
            },
        }
    }
}

/// Provider health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    /// Provider ID
    pub provider_id: String,
    
    /// Overall health status
    pub status: HealthStatus,
    
    /// Health check timestamp
    pub last_check: chrono::DateTime<chrono::Utc>,
    
    /// Response time for health check
    pub response_time_ms: u64,
    
    /// Health check details
    pub details: HashMap<String, serde_json::Value>,
    
    /// Any errors or warnings
    pub issues: Vec<HealthIssue>,
}

/// Health status levels
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Health check issues
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthIssue {
    /// Issue severity
    pub severity: IssueSeverity,
    
    /// Issue message
    pub message: String,
    
    /// Issue timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
    
    /// Additional context
    pub context: Option<HashMap<String, serde_json::Value>>,
}

/// Issue severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
    Critical,
}