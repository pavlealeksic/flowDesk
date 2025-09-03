//! Unified Search System for Flow Desk
//!
//! This module provides a comprehensive, privacy-first search system using Tantivy
//! for local indexing with support for multiple content providers, real-time updates,
//! and advanced search features.
//!
//! ## Features
//! - Local-only indexing with Tantivy (no cloud processing)
//! - Multi-provider support (Gmail, Slack, Teams, Notion, etc.)
//! - Real-time incremental indexing
//! - Sub-300ms search response times
//! - Advanced query syntax with filters and facets
//! - Search suggestions and autocomplete
//! - Plugin-extensible provider system
//! - Comprehensive analytics and monitoring

pub mod engine;
pub mod index;
pub mod query;
pub mod providers;
pub mod analytics;
pub mod error;
pub mod types;
pub mod performance;
pub mod indexing;
pub mod advanced_query;
pub mod integration;

#[cfg(feature = "napi")]
pub mod napi;

// Re-export core types
pub use engine::SearchEngine;
pub use error::{SearchError, SearchResult, ErrorContext, SearchErrorContext};
pub use types::{
    SearchQuery, SearchResponse, ContentType, SearchDocument, SearchFacet, 
    ProviderResponse, ProviderType, SearchFilter, SortOrder, QueryPerformanceBreakdown,
    SearchResult as SearchResultStruct, DocumentMetadata, SearchHighlight,
    FacetValue, FacetType, SearchDebugInfo, ParsingInfo, ExecutionInfo,
    SearchOptions, LocationInfo, FilterOperator, JobStatus,
    IndexingInfo, IndexType, IndexingJobType, JobError, SortConfig, HighlightConfig
};
pub use providers::{SearchProvider, ProviderFactory, ProviderManager};
pub use analytics::{SearchAnalytics, AnalyticsManager};
pub use index::IndexManager;
pub use indexing::{IndexingJob, RealTimeIndexManager, IndexingStats, IndexingConfig};
pub use query::QueryProcessor;
pub use advanced_query::{QueryExpression, AdvancedFilters, AdvancedQueryBuilder};
pub use performance::{PerformanceMonitor, PerformanceTargets, PerformanceMetrics};

use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// Main configuration for the unified search system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    /// Base directory for search indices
    pub index_dir: PathBuf,
    
    /// Maximum memory usage for indexing (bytes)
    pub max_memory_mb: u64,
    
    /// Maximum response time target (ms)
    pub max_response_time_ms: u64,
    
    /// Number of search threads
    pub num_threads: usize,
    
    /// Enable search analytics
    pub enable_analytics: bool,
    
    /// Enable search suggestions
    pub enable_suggestions: bool,
    
    /// Enable real-time indexing
    pub enable_realtime: bool,
    
    /// Provider configurations
    pub providers: Vec<ProviderConfig>,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            index_dir: PathBuf::from("search_indices"),
            max_memory_mb: 512,
            max_response_time_ms: 300,
            num_threads: num_cpus::get(),
            enable_analytics: true,
            enable_suggestions: true,
            enable_realtime: true,
            providers: Vec::new(),
        }
    }
}

/// Provider-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub provider_type: String,
    pub enabled: bool,
    pub weight: f32,
    pub config: serde_json::Value,
}

/// Initialize the search system with configuration
pub async fn init_search_system(config: SearchConfig) -> Result<SearchEngine, SearchError> {
    tracing::info!("Initializing Flow Desk unified search system");
    SearchEngine::new(config).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_search_system_initialization() {
        let temp_dir = TempDir::new().unwrap();
        let config = SearchConfig {
            index_dir: temp_dir.path().to_path_buf(),
            ..Default::default()
        };
        
        let engine = init_search_system(config).await;
        assert!(engine.is_ok());
    }
}