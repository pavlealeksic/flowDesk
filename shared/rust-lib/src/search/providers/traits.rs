//! Traits for search providers

use crate::search::{
    SearchQuery, SearchResult, SearchError, SearchDocument, 
    ProviderResponse, IndexingJob,
};
use super::{ProviderInfo, ProviderStats, ProviderHealth, ProviderAuth, AuthType};
use async_trait::async_trait;
use std::collections::HashMap;
use serde_json::Value;

/// Core trait for all search providers
#[async_trait]
pub trait SearchProvider: Send + Sync {
    /// Get provider information and capabilities
    fn get_info(&self) -> &ProviderInfo;
    
    /// Initialize the provider with configuration
    async fn initialize(&mut self, config: Value) -> SearchResult<()>;
    
    /// Check if the provider is properly configured and authenticated
    async fn is_ready(&self) -> bool;
    
    /// Perform a search query
    async fn search(&self, query: &SearchQuery) -> SearchResult<ProviderResponse>;
    
    /// Get documents for indexing (for providers that support local indexing)
    async fn get_documents(&self, last_sync: Option<chrono::DateTime<chrono::Utc>>) -> SearchResult<Vec<SearchDocument>>;
    
    /// Get provider statistics
    async fn get_stats(&self) -> SearchResult<ProviderStats>;
    
    /// Perform health check
    async fn health_check(&self) -> SearchResult<ProviderHealth>;
    
    /// Handle authentication (if required)
    async fn authenticate(&mut self, auth_data: HashMap<String, String>) -> SearchResult<ProviderAuth>;
    
    /// Refresh authentication tokens (if applicable)
    async fn refresh_auth(&mut self) -> SearchResult<()>;
    
    /// Shutdown the provider and cleanup resources
    async fn shutdown(&mut self) -> SearchResult<()>;
}

/// Trait for providers that support real-time indexing
#[async_trait]
pub trait RealtimeProvider: SearchProvider {
    /// Start real-time monitoring for changes
    async fn start_realtime_monitoring(&mut self) -> SearchResult<()>;
    
    /// Stop real-time monitoring
    async fn stop_realtime_monitoring(&mut self) -> SearchResult<()>;
    
    /// Get real-time changes since last check
    async fn get_realtime_changes(&self) -> SearchResult<Vec<RealtimeChange>>;
    
    /// Subscribe to real-time change notifications
    async fn subscribe_to_changes(&mut self, callback: Box<dyn RealtimeCallback>) -> SearchResult<()>;
}

/// Trait for providers that support batch operations
#[async_trait]
pub trait BatchProvider: SearchProvider {
    /// Perform batch indexing operation
    async fn batch_index(&self, batch_size: usize) -> SearchResult<IndexingJob>;
    
    /// Get batch processing status
    async fn get_batch_status(&self, job_id: &str) -> SearchResult<IndexingJob>;
    
    /// Cancel a batch operation
    async fn cancel_batch(&self, job_id: &str) -> SearchResult<()>;
}

/// Trait for providers that support advanced filtering
#[async_trait]
pub trait FilterableProvider: SearchProvider {
    /// Get available filter fields for this provider
    async fn get_filter_fields(&self) -> SearchResult<Vec<FilterField>>;
    
    /// Validate filter queries before execution
    async fn validate_filters(&self, filters: &[crate::search::SearchFilter]) -> SearchResult<Vec<FilterValidationResult>>;
}

/// Trait for providers that support faceted search
#[async_trait]
pub trait FacetProvider: SearchProvider {
    /// Get available facet fields
    async fn get_facet_fields(&self) -> SearchResult<Vec<FacetField>>;
    
    /// Get facet values for a field
    async fn get_facet_values(&self, field: &str, query: &SearchQuery) -> SearchResult<Vec<FacetValue>>;
}

/// Trait for providers that can provide search suggestions
#[async_trait]
pub trait SuggestionProvider: SearchProvider {
    /// Get search suggestions based on partial input
    async fn get_suggestions(&self, partial_query: &str, limit: usize) -> SearchResult<Vec<Suggestion>>;
    
    /// Get popular queries for this provider
    async fn get_popular_queries(&self, limit: usize) -> SearchResult<Vec<PopularQuery>>;
}

/// Real-time change notification
#[derive(Debug, Clone)]
pub struct RealtimeChange {
    /// Change ID
    pub id: String,
    
    /// Change type
    pub change_type: ChangeType,
    
    /// Changed document (if applicable)
    pub document: Option<SearchDocument>,
    
    /// Document ID (for deletions)
    pub document_id: Option<String>,
    
    /// Change timestamp
    pub timestamp: chrono::DateTime<chrono::Utc>,
    
    /// Additional change metadata
    pub metadata: HashMap<String, Value>,
}

/// Types of real-time changes
#[derive(Debug, Clone)]
pub enum ChangeType {
    Created,
    Updated,
    Deleted,
    Moved,
    PermissionChanged,
}

/// Callback trait for real-time change notifications
#[async_trait]
pub trait RealtimeCallback: Send + Sync {
    async fn on_change(&self, change: RealtimeChange) -> SearchResult<()>;
    async fn on_error(&self, error: SearchError) -> SearchResult<()>;
}

/// Filter field definition
#[derive(Debug, Clone)]
pub struct FilterField {
    /// Field name
    pub name: String,
    
    /// Field display name
    pub display_name: String,
    
    /// Field data type
    pub data_type: FilterFieldType,
    
    /// Supported operators for this field
    pub supported_operators: Vec<crate::search::FilterOperator>,
    
    /// Whether this field supports multiple values
    pub multi_value: bool,
    
    /// Example values (for UI assistance)
    pub example_values: Vec<String>,
}

/// Filter field data types
#[derive(Debug, Clone)]
pub enum FilterFieldType {
    String,
    Number,
    Date,
    Boolean,
    Enum(Vec<String>),
}

/// Filter validation result
#[derive(Debug, Clone)]
pub struct FilterValidationResult {
    /// Whether the filter is valid
    pub is_valid: bool,
    
    /// Error message if invalid
    pub error_message: Option<String>,
    
    /// Suggestions for fixing the filter
    pub suggestions: Vec<String>,
}

/// Facet field definition
#[derive(Debug, Clone)]
pub struct FacetField {
    /// Field name
    pub name: String,
    
    /// Field display name
    pub display_name: String,
    
    /// Facet type
    pub facet_type: crate::search::FacetType,
    
    /// Maximum number of values to show
    pub max_values: usize,
}

/// Facet value
#[derive(Debug, Clone)]
pub struct FacetValue {
    /// Facet value
    pub value: Value,
    
    /// Display label
    pub label: String,
    
    /// Number of documents with this value
    pub count: usize,
    
    /// Whether this value is currently selected
    pub selected: bool,
}

/// Search suggestion
#[derive(Debug, Clone)]
pub struct Suggestion {
    /// Suggestion text
    pub text: String,
    
    /// Suggestion type
    pub suggestion_type: SuggestionType,
    
    /// Relevance score
    pub score: f32,
    
    /// Additional metadata
    pub metadata: HashMap<String, Value>,
}

/// Types of search suggestions
#[derive(Debug, Clone)]
pub enum SuggestionType {
    QueryCompletion,
    QueryCorrection,
    EntitySuggestion,
    ContentSuggestion,
    HistorySuggestion,
}

/// Popular query information
#[derive(Debug, Clone)]
pub struct PopularQuery {
    /// Query text
    pub query: String,
    
    /// Number of times this query was executed
    pub frequency: u64,
    
    /// Last time this query was used
    pub last_used: chrono::DateTime<chrono::Utc>,
    
    /// Average number of results
    pub avg_results: f32,
}

/// Base provider implementation with common functionality
pub struct BaseProvider {
    /// Provider information
    pub info: ProviderInfo,
    
    /// Provider configuration
    pub config: Value,
    
    /// Authentication state
    pub auth: Option<ProviderAuth>,
    
    /// Provider statistics
    pub stats: ProviderStats,
    
    /// Is provider initialized
    pub initialized: bool,
}

impl BaseProvider {
    /// Create a new base provider
    pub fn new(info: ProviderInfo) -> Self {
        let stats = ProviderStats {
            provider_id: info.id.clone(),
            ..Default::default()
        };
        
        Self {
            info,
            config: Value::Null,
            auth: None,
            stats,
            initialized: false,
        }
    }
    
    /// Update provider statistics
    pub fn update_stats(&mut self, success: bool, response_time_ms: u64) {
        self.stats.total_queries += 1;
        
        if success {
            self.stats.successful_queries += 1;
        } else {
            self.stats.failed_queries += 1;
        }
        
        // Update average response time
        let total_time = self.stats.avg_response_time_ms * (self.stats.total_queries - 1) as f64;
        self.stats.avg_response_time_ms = (total_time + response_time_ms as f64) / self.stats.total_queries as f64;
        
        // Update error rate
        self.stats.error_rate = self.stats.failed_queries as f64 / self.stats.total_queries as f64;
        
        if success {
            self.stats.last_successful_query = Some(chrono::Utc::now());
        }
    }
    
    /// Check if authentication is valid and not expired
    pub fn is_authenticated(&self) -> bool {
        if let Some(auth) = &self.auth {
            match auth.status {
                super::AuthStatus::Authenticated => {
                    // Check if token is expired
                    if let Some(expires_at) = auth.expires_at {
                        chrono::Utc::now() < expires_at
                    } else {
                        true // No expiration
                    }
                }
                _ => false,
            }
        } else {
            false
        }
    }
    
    /// Get configuration value
    pub fn get_config_value<T>(&self, key: &str) -> SearchResult<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let value = self.config
            .get(key)
            .ok_or_else(|| SearchError::config_error(format!("Missing config key: {}", key)))?;
        
        serde_json::from_value(value.clone())
            .map_err(|_| SearchError::config_error(format!("Invalid config value for key: {}", key)))
    }
    
    /// Get configuration value with default
    pub fn get_config_value_or<T>(&self, key: &str, default: T) -> T
    where
        T: serde::de::DeserializeOwned + Clone,
    {
        self.get_config_value(key).unwrap_or(default)
    }
}

// Helper implementation for common provider functionality
// This should be implemented manually in each provider due to async_trait limitations