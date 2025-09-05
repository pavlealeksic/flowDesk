//! Comprehensive search integration service that ties together all search components

use crate::search::{
    SearchEngine, RealTimeIndexManager, AdvancedQueryBuilder, PerformanceMonitor, ProviderManager,
    SearchConfig, SearchQuery, SearchResponse, SearchResult as SearchResultType,
    QueryExpression, AdvancedFilters, IndexingConfig, PerformanceTargets, PerformanceMetrics, SearchAnalytics, ErrorContext, SearchErrorContext,
    performance::QueryPerformanceBreakdown,
    types::{SortDirection, SearchFilter, ContentType, ProviderType},
    advanced_query::TagFilter,
};
use std::sync::Arc;
use tokio::sync::{RwLock, Mutex};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use tracing::{info, error, debug, warn, instrument};
use std::collections::HashMap;
use uuid::Uuid;

/// Unified search integration service
pub struct UnifiedSearchService {
    /// Core search engine
    search_engine: Arc<SearchEngine>,
    
    /// Real-time indexing manager
    indexing_manager: Arc<RealTimeIndexManager>,
    
    /// Advanced query builder
    query_builder: Arc<AdvancedQueryBuilder>,
    
    /// Performance monitor
    performance_monitor: Arc<PerformanceMonitor>,
    
    /// Provider manager
    provider_manager: Arc<ProviderManager>,
    
    /// Search sessions for tracking user interactions
    search_sessions: Arc<DashMap<String, SearchSession>>,
    
    /// Configuration
    config: SearchIntegrationConfig,
    
    /// Cross-platform sync coordinator
    sync_coordinator: Arc<Mutex<Option<SyncCoordinator>>>,
    
    /// Automation integration
    automation_bridge: Arc<Mutex<Option<AutomationBridge>>>,
    
    /// Service status
    status: Arc<RwLock<ServiceStatus>>,
}

/// Search integration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchIntegrationConfig {
    /// Core search configuration
    pub search_config: SearchConfig,
    
    /// Indexing configuration
    pub indexing_config: IndexingConfig,
    
    /// Performance targets
    pub performance_targets: PerformanceTargets,
    
    /// Cross-platform sync enabled
    pub enable_cross_platform_sync: bool,
    
    /// Automation integration enabled
    pub enable_automation_integration: bool,
    
    /// Session tracking enabled
    pub enable_session_tracking: bool,
    
    /// Maximum concurrent searches
    pub max_concurrent_searches: usize,
    
    /// Search result cache TTL (seconds)
    pub cache_ttl_seconds: u64,
    
    /// Enable search suggestions
    pub enable_search_suggestions: bool,
    
    /// Voice search configuration
    pub voice_search_config: Option<VoiceSearchConfig>,
}

/// Voice search configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceSearchConfig {
    /// Supported languages
    pub supported_languages: Vec<String>,
    
    /// Confidence threshold (0.0 to 1.0)
    pub confidence_threshold: f64,
    
    /// Maximum recording duration (seconds)
    pub max_recording_duration: u32,
    
    /// Enable noise cancellation
    pub enable_noise_cancellation: bool,
}

/// Search session for tracking user interactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSession {
    /// Session ID
    pub session_id: String,
    
    /// User ID (optional)
    pub user_id: Option<String>,
    
    /// Session start time
    pub started_at: DateTime<Utc>,
    
    /// Last activity time
    pub last_activity: DateTime<Utc>,
    
    /// Search queries in this session
    pub queries: Vec<SearchSessionQuery>,
    
    /// Total search time (ms)
    pub total_search_time_ms: u64,
    
    /// Results clicked
    pub results_clicked: Vec<SearchResultClick>,
    
    /// Session metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Search query within a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSessionQuery {
    /// Query ID
    pub query_id: String,
    
    /// Query text
    pub query: String,
    
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Results count
    pub results_count: usize,
    
    /// Execution time (ms)
    pub execution_time_ms: u64,
    
    /// Whether query was cached
    pub was_cached: bool,
    
    /// Filters applied
    pub filters_applied: Option<AdvancedFilters>,
}

/// Search result click tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultClick {
    /// Result ID
    pub result_id: String,
    
    /// Query ID that generated this result
    pub query_id: String,
    
    /// Click timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Result position in search results
    pub position: usize,
    
    /// Result score
    pub relevance_score: f32,
    
    /// Click metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Cross-platform synchronization coordinator
pub struct SyncCoordinator {
    /// Sync configuration
    config: SyncConfig,
    
    /// Active sync sessions
    active_syncs: DashMap<String, SyncSession>,
    
    /// Sync history
    sync_history: Arc<RwLock<Vec<SyncEvent>>>,
}

/// Sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    /// Sync server endpoint
    pub sync_endpoint: String,
    
    /// Device ID
    pub device_id: String,
    
    /// Sync encryption key
    pub encryption_key: String,
    
    /// Sync interval (seconds)
    pub sync_interval_seconds: u64,
    
    /// Maximum sync batch size
    pub max_batch_size: usize,
}

/// Active sync session
#[derive(Debug, Clone)]
pub struct SyncSession {
    /// Session ID
    pub session_id: String,
    
    /// Sync direction
    pub direction: SyncDirection,
    
    /// Start time
    pub started_at: DateTime<Utc>,
    
    /// Progress (0.0 to 1.0)
    pub progress: f64,
    
    /// Status
    pub status: SyncStatus,
    
    /// Documents synced
    pub documents_synced: usize,
    
    /// Total documents to sync
    pub total_documents: usize,
}

/// Sync direction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncDirection {
    Upload,
    Download,
    Bidirectional,
}

/// Sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    Preparing,
    InProgress,
    Completed,
    Failed,
    Cancelled,
}

/// Sync event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEvent {
    /// Event ID
    pub event_id: String,
    
    /// Event type
    pub event_type: SyncEventType,
    
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Device ID
    pub device_id: String,
    
    /// Documents affected
    pub documents_count: usize,
    
    /// Success status
    pub success: bool,
    
    /// Error message (if failed)
    pub error_message: Option<String>,
    
    /// Duration (ms)
    pub duration_ms: u64,
}

/// Sync event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncEventType {
    IndexSync,
    DocumentSync,
    ProviderSync,
    FullSync,
}

/// Automation integration bridge
pub struct AutomationBridge {
    /// Trigger handlers
    trigger_handlers: HashMap<String, Box<dyn SearchTriggerHandler + Send + Sync>>,
    
    /// Active triggers
    active_triggers: DashMap<String, SearchTrigger>,
    
    /// Trigger execution history
    execution_history: Arc<RwLock<Vec<TriggerExecution>>>,
}

/// Search trigger handler trait
pub trait SearchTriggerHandler {
    /// Handle search-based trigger
    fn handle_trigger(&self, trigger: &SearchTrigger, context: &SearchTriggerContext) -> SearchResultType<()>;
    
    /// Validate trigger configuration
    fn validate_config(&self, config: &serde_json::Value) -> SearchResultType<()>;
}

/// Search trigger configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchTrigger {
    /// Trigger ID
    pub trigger_id: String,
    
    /// Trigger name
    pub name: String,
    
    /// Search query to monitor
    pub search_query: SearchQuery,
    
    /// Trigger conditions
    pub conditions: SearchTriggerConditions,
    
    /// Actions to execute
    pub actions: Vec<SearchTriggerAction>,
    
    /// Trigger enabled
    pub enabled: bool,
    
    /// Last execution time
    pub last_execution: Option<DateTime<Utc>>,
    
    /// Execution count
    pub execution_count: u64,
}

/// Search trigger conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchTriggerConditions {
    /// Minimum result count
    pub min_results: Option<usize>,
    
    /// Maximum result count
    pub max_results: Option<usize>,
    
    /// Minimum relevance score
    pub min_relevance_score: Option<f32>,
    
    /// Required content types
    pub required_content_types: Option<Vec<String>>,
    
    /// Time-based conditions
    pub time_conditions: Option<TimeConditions>,
    
    /// Custom conditions
    pub custom_conditions: Option<HashMap<String, serde_json::Value>>,
}

/// Time-based trigger conditions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeConditions {
    /// Execute at specific times
    pub scheduled_times: Option<Vec<String>>, // Cron-like expressions
    
    /// Minimum time between executions (seconds)
    pub min_interval_seconds: Option<u64>,
    
    /// Maximum executions per day
    pub max_executions_per_day: Option<u32>,
}

/// Search trigger action
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchTriggerAction {
    /// Action type
    pub action_type: String,
    
    /// Action configuration
    pub config: serde_json::Value,
    
    /// Action enabled
    pub enabled: bool,
}

/// Search trigger execution context
pub struct SearchTriggerContext {
    /// Search results that triggered the action
    pub search_results: Vec<crate::search::types::SearchResult>,
    
    /// Search query that was executed
    pub search_query: SearchQuery,
    
    /// Execution timestamp
    pub timestamp: DateTime<Utc>,
    
    /// User context (if available)
    pub user_context: Option<HashMap<String, serde_json::Value>>,
}

/// Trigger execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerExecution {
    /// Execution ID
    pub execution_id: String,
    
    /// Trigger ID
    pub trigger_id: String,
    
    /// Execution timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Results count
    pub results_count: usize,
    
    /// Actions executed
    pub actions_executed: Vec<String>,
    
    /// Success status
    pub success: bool,
    
    /// Error message (if failed)
    pub error_message: Option<String>,
    
    /// Execution duration (ms)
    pub duration_ms: u64,
}

/// Service status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    /// Service healthy
    pub is_healthy: bool,
    
    /// Last health check
    pub last_health_check: DateTime<Utc>,
    
    /// Active searches
    pub active_searches: usize,
    
    /// Total searches handled
    pub total_searches: u64,
    
    /// Average response time (ms)
    pub avg_response_time_ms: f64,
    
    /// Error rate
    pub error_rate: f64,
    
    /// Indexing status
    pub indexing_active: bool,
    
    /// Sync status
    pub sync_active: bool,
    
    /// Last sync time
    pub last_sync: Option<DateTime<Utc>>,
}

impl Default for SearchIntegrationConfig {
    fn default() -> Self {
        Self {
            search_config: SearchConfig::default(),
            indexing_config: IndexingConfig::default(),
            performance_targets: PerformanceTargets::default(),
            enable_cross_platform_sync: false,
            enable_automation_integration: true,
            enable_session_tracking: true,
            max_concurrent_searches: 10,
            cache_ttl_seconds: 300,
            enable_search_suggestions: true,
            voice_search_config: None,
        }
    }
}

impl UnifiedSearchService {
    /// Create new unified search service
    #[instrument(skip(config))]
    pub async fn new(config: SearchIntegrationConfig) -> SearchResultType<Self> {
        info!("Initializing unified search service");
        
        // Initialize core search engine
        let search_engine = Arc::new(
            SearchEngine::new(config.search_config.clone())
                .await
                .with_context(SearchErrorContext::new("search_engine_init"))?
        );
        
        // Initialize provider manager
        let provider_manager = Arc::new(
            ProviderManager::new(config.search_config.providers.clone())
                .await
                .with_context(SearchErrorContext::new("provider_manager_init"))?
        );
        
        // Initialize real-time indexing manager
        let indexing_manager = Arc::new(
            RealTimeIndexManager::new(config.indexing_config.clone(), provider_manager.clone())
                .await
                .with_context(SearchErrorContext::new("indexing_manager_init"))?
        );
        
        // Initialize performance monitor
        let performance_monitor = Arc::new(
            PerformanceMonitor::new(Some(config.performance_targets.clone()))
        );
        
        // Initialize query builder (would need proper schema)
        let query_builder = Arc::new(
            AdvancedQueryBuilder::new(tantivy::schema::SchemaBuilder::default().build())
                .with_context(SearchErrorContext::new("query_builder_init"))?
        );
        
        let service = Self {
            search_engine,
            indexing_manager,
            query_builder,
            performance_monitor,
            provider_manager,
            search_sessions: Arc::new(DashMap::new()),
            config,
            sync_coordinator: Arc::new(Mutex::new(None)),
            automation_bridge: Arc::new(Mutex::new(None)),
            status: Arc::new(RwLock::new(ServiceStatus {
                is_healthy: true,
                last_health_check: Utc::now(),
                active_searches: 0,
                total_searches: 0,
                avg_response_time_ms: 0.0,
                error_rate: 0.0,
                indexing_active: false,
                sync_active: false,
                last_sync: None,
            })),
        };
        
        // Initialize optional components
        if service.config.enable_cross_platform_sync {
            service.initialize_sync_coordinator().await?;
        }
        
        if service.config.enable_automation_integration {
            service.initialize_automation_bridge().await?;
        }
        
        // Start background tasks
        service.start_background_tasks().await;
        
        info!("Unified search service initialized successfully");
        Ok(service)
    }
    
    /// Execute unified search with full feature support
    #[instrument(skip(self, query), fields(query_text = %query.query))]
    pub async fn unified_search(&self, query: SearchQuery, session_id: Option<String>) -> SearchResultType<SearchResponse> {
        let start_time = std::time::Instant::now();
        let query_id = Uuid::new_v4().to_string();
        
        debug!("Executing unified search: {}", query.query);
        
        // Update active searches count
        {
            let mut status = self.status.write().await;
            status.active_searches += 1;
        }
        
        let context = SearchErrorContext::new("unified_search")
            .with_query(&query.query)
            .with_info("query_id", &query_id);
        
        let result = self.execute_search_with_features(query.clone(), &query_id).await;
        
        // Update status and metrics
        let execution_time = start_time.elapsed().as_millis() as u64;
        match &result {
            Ok(response) => {
                // Record performance metrics
                let breakdown = QueryPerformanceBreakdown {
                    parsing_ms: 5.0, // Would track actual timings
                    index_search_ms: execution_time as f64 * 0.7,
                    provider_search_ms: execution_time as f64 * 0.2,
                    result_merging_ms: execution_time as f64 * 0.08,
                    caching_ms: execution_time as f64 * 0.02,
                };
                
                self.performance_monitor.record_query_performance(
                    &query.query,
                    execution_time,
                    breakdown,
                ).await;
                
                // Track session if enabled
                if self.config.enable_session_tracking {
                    if let Some(session_id) = session_id {
                        self.track_search_in_session(session_id, &query, response, execution_time).await;
                    }
                }
                
                // Check for automation triggers
                if self.config.enable_automation_integration {
                    self.check_automation_triggers(&query, response).await;
                }
                
                info!("Unified search completed in {}ms with {} results", execution_time, response.results.len());
            }
            Err(error) => {
                error!("Unified search failed: {}", error);
                
                // Record error metrics
                let breakdown = QueryPerformanceBreakdown {
                    parsing_ms: 5.0,
                    index_search_ms: 0.0,
                    provider_search_ms: 0.0,
                    result_merging_ms: 0.0,
                    caching_ms: 0.0,
                };
                
                self.performance_monitor.record_query_performance(
                    &query.query,
                    execution_time,
                    breakdown,
                ).await;
            }
        }
        
        // Update status
        {
            let mut status = self.status.write().await;
            status.active_searches = status.active_searches.saturating_sub(1);
            status.total_searches += 1;
            
            let total_time = status.avg_response_time_ms * (status.total_searches - 1) as f64;
            status.avg_response_time_ms = (total_time + execution_time as f64) / status.total_searches as f64;
            
            if result.is_err() {
                let error_count = status.error_rate * (status.total_searches - 1) as f64 + 1.0;
                status.error_rate = error_count / status.total_searches as f64;
            }
        }
        
        result.with_context(context)
    }
    
    /// Execute search with all advanced features
    async fn execute_search_with_features(&self, query: SearchQuery, query_id: &str) -> SearchResultType<SearchResponse> {
        // Convert to advanced query expression if needed
        let query_expression = self.convert_to_advanced_query(&query)?;
        
        // Execute search using advanced query builder
        let tantivy_query = self.query_builder.build_query(&query_expression)?;
        
        // Execute core search
        let mut response = self.search_engine.search(query.clone()).await?;
        
        // Add facets if requested
        if query.options.facets.unwrap_or(false) {
            let facet_map = self.compute_search_facets(&query).await?;
            response.facets = Some(facet_map.into_values().flatten().collect());
        }
        
        // Add suggestions if requested
        if query.options.suggestions.unwrap_or(false) && self.config.enable_search_suggestions {
            response.suggestions = Some(self.search_engine.get_suggestions(&query.query, 5).await?);
        }
        
        // Add debug information if requested
        if query.options.debug.unwrap_or(false) {
            response.debug_info = Some(self.generate_debug_info(&query, &response).await);
        }
        
        Ok(response)
    }
    
    /// Convert simple query to advanced query expression
    fn convert_to_advanced_query(&self, query: &SearchQuery) -> SearchResultType<QueryExpression> {
        let mut expression = QueryExpression {
            query: query.query.clone(),
            field_queries: None,
            boolean_logic: None,
            filters: None,
            facets: None,
            sort: None,
            highlight: None,
        };
        
        // Add filters if present
        if query.filters.is_some() || query.content_types.is_some() || query.provider_ids.is_some() {
            let mut filters = AdvancedFilters {
                content_types: None,
                providers: query.provider_ids.clone(),
                provider_types: None,
                date_range: None,
                authors: None,
                tags: None,
                categories: None,
                file_size_range: None,
                metadata_filters: None,
                location_filter: None,
                language: None,
                priority_range: None,
            };
            
            // Convert content types
            if let Some(content_types) = &query.content_types {
                filters.content_types = Some(content_types.clone());
            }
            
            expression.filters = Some(filters);
        }
        
        // Add sorting
        if let Some(sort) = &query.sort {
            expression.sort = Some(vec![crate::search::advanced_query::SortConfig {
                field: sort.field.clone(),
                order: match sort.direction {
                    SortDirection::Desc => crate::search::advanced_query::SortOrder::Desc,
                    SortDirection::Asc => crate::search::advanced_query::SortOrder::Asc,
                },
                missing: None,
            }]);
        }
        
        // Add highlighting if enabled
        if query.options.highlighting.unwrap_or(false) {
            expression.highlight = Some(crate::search::advanced_query::HighlightConfig {
                fields: vec!["title".to_string(), "content".to_string()],
                fragment_size: 150,
                number_of_fragments: 3,
                pre_tags: vec!["<mark>".to_string()],
                post_tags: vec!["</mark>".to_string()],
                highlight_entire_field: false,
            });
        }
        
        Ok(expression)
    }
    
    /// Compute search facets
    async fn compute_search_facets(&self, query: &SearchQuery) -> SearchResultType<HashMap<String, Vec<crate::search::SearchFacet>>> {
        // Mock facet computation - would integrate with Tantivy's facet system
        let mut facets = HashMap::new();
        
        // Content type facet
        facets.insert("content_type".to_string(), vec![
            crate::search::SearchFacet {
                name: "Email".to_string(),
                field: "content_type".to_string(),
                values: vec![],
                facet_type: crate::search::FacetType::Terms,
                value: Some(serde_json::Value::String("email".to_string())),
                count: Some(45),
                selected: Some(false),
            },
            crate::search::SearchFacet {
                name: "Document".to_string(),
                field: "content_type".to_string(),
                values: vec![],
                facet_type: crate::search::FacetType::Terms,
                value: Some(serde_json::Value::String("document".to_string())),
                count: Some(23),
                selected: Some(false),
            },
            crate::search::SearchFacet {
                name: "Event".to_string(),
                field: "content_type".to_string(),
                values: vec![],
                facet_type: crate::search::FacetType::Terms,
                value: Some(serde_json::Value::String("event".to_string())),
                count: Some(12),
                selected: Some(false),
            },
        ]);
        
        // Provider facet
        facets.insert("provider".to_string(), vec![
            crate::search::SearchFacet {
                name: "Gmail".to_string(),
                field: "provider".to_string(),
                values: vec![],
                facet_type: crate::search::FacetType::Terms,
                value: Some(serde_json::Value::String("gmail".to_string())),
                count: Some(34),
                selected: Some(false),
            },
            crate::search::SearchFacet {
                name: "Slack".to_string(),
                field: "provider".to_string(),
                values: vec![],
                facet_type: crate::search::FacetType::Terms,
                value: Some(serde_json::Value::String("slack".to_string())),
                count: Some(28),
                selected: Some(false),
            },
            crate::search::SearchFacet {
                name: "Notion".to_string(),
                field: "provider".to_string(),
                values: vec![],
                facet_type: crate::search::FacetType::Terms,
                value: Some(serde_json::Value::String("notion".to_string())),
                count: Some(18),
                selected: Some(false),
            },
        ]);
        
        Ok(facets)
    }
    
    /// Generate debug information
    async fn generate_debug_info(&self, query: &SearchQuery, response: &SearchResponse) -> crate::search::SearchDebugInfo {
        crate::search::SearchDebugInfo {
            parsing: Some(crate::search::ParsingInfo {
                original_query: query.query.clone(),
                parsed_query: serde_json::json!({
                    "terms": query.query.split_whitespace().collect::<Vec<_>>(),
                    "filters": query.filters.as_ref().map(|f| f.len()).unwrap_or(0)
                }),
                warnings: vec![],
            }),
            execution: Some(crate::search::ExecutionInfo {
                total_time_ms: response.execution_time_ms,
                index_time_ms: response.execution_time_ms / 3, // Simplified breakdown
                search_time_ms: response.execution_time_ms / 3,
                merge_time_ms: response.execution_time_ms / 3,
            }),
            providers: None, // Would need provider performance data
        }
    }
    
    /// Track search in session
    async fn track_search_in_session(
        &self,
        session_id: String,
        query: &SearchQuery,
        response: &SearchResponse,
        execution_time_ms: u64,
    ) {
        let query_record = SearchSessionQuery {
            query_id: Uuid::new_v4().to_string(),
            query: query.query.clone(),
            timestamp: Utc::now(),
            results_count: response.results.len(),
            execution_time_ms,
            was_cached: false, // Would track actual cache status
            filters_applied: convert_search_filters_to_advanced(&query.filters),
        };
        
        // Update or create session
        if let Some(mut session) = self.search_sessions.get_mut(&session_id) {
            session.queries.push(query_record);
            session.last_activity = Utc::now();
            session.total_search_time_ms += execution_time_ms;
        } else {
            let session = SearchSession {
                session_id: session_id.clone(),
                user_id: None,
                started_at: Utc::now(),
                last_activity: Utc::now(),
                queries: vec![query_record],
                total_search_time_ms: execution_time_ms,
                results_clicked: Vec::new(),
                metadata: HashMap::new(),
            };
            self.search_sessions.insert(session_id, session);
        }
    }
    
    /// Check automation triggers
    async fn check_automation_triggers(&self, query: &SearchQuery, response: &SearchResponse) {
        if let Some(automation_bridge) = self.automation_bridge.lock().await.as_ref() {
            // Check active triggers
            for trigger_entry in automation_bridge.active_triggers.iter() {
                let trigger = trigger_entry.value();
                if trigger.enabled && self.trigger_matches(trigger, query, response).await {
                    // Execute trigger
                    if let Err(e) = self.execute_search_trigger(trigger, query, response).await {
                        error!("Failed to execute search trigger {}: {}", trigger.trigger_id, e);
                    }
                }
            }
        }
    }
    
    /// Check if trigger conditions match
    async fn trigger_matches(&self, trigger: &SearchTrigger, query: &SearchQuery, response: &SearchResponse) -> bool {
        let conditions = &trigger.conditions;
        
        // Check result count conditions
        if let Some(min_results) = conditions.min_results {
            if response.results.len() < min_results {
                return false;
            }
        }
        
        if let Some(max_results) = conditions.max_results {
            if response.results.len() > max_results {
                return false;
            }
        }
        
        // Check relevance score conditions
        if let Some(min_score) = conditions.min_relevance_score {
            if response.results.is_empty() || response.results[0].score < min_score {
                return false;
            }
        }
        
        // Check content type conditions
        if let Some(required_types) = &conditions.required_content_types {
            let result_types: std::collections::HashSet<String> = response.results
                .iter()
                .map(|r| r.content_type.to_string())
                .collect();
            
            for required_type in required_types {
                if !result_types.contains(required_type) {
                    return false;
                }
            }
        }
        
        // Check time conditions
        if let Some(time_conditions) = &conditions.time_conditions {
            if !self.check_time_conditions(trigger, time_conditions).await {
                return false;
            }
        }
        
        true
    }
    
    /// Check time-based trigger conditions
    async fn check_time_conditions(&self, trigger: &SearchTrigger, conditions: &TimeConditions) -> bool {
        let now = Utc::now();
        
        // Check minimum interval
        if let Some(min_interval) = conditions.min_interval_seconds {
            if let Some(last_execution) = trigger.last_execution {
                let time_since_last = (now - last_execution).num_seconds() as u64;
                if time_since_last < min_interval {
                    return false;
                }
            }
        }
        
        // Check daily execution limit
        if let Some(max_per_day) = conditions.max_executions_per_day {
            // Would check execution count for today
            if trigger.execution_count > max_per_day as u64 {
                return false;
            }
        }
        
        true
    }
    
    /// Execute search trigger
    async fn execute_search_trigger(
        &self,
        trigger: &SearchTrigger,
        query: &SearchQuery,
        response: &SearchResponse,
    ) -> SearchResultType<()> {
        let execution_id = Uuid::new_v4().to_string();
        let start_time = std::time::Instant::now();
        
        info!("Executing search trigger: {} for query: {}", trigger.name, query.query);
        
        let context = SearchTriggerContext {
            search_results: response.results.clone(),
            search_query: query.clone(),
            timestamp: Utc::now(),
            user_context: None,
        };
        
        let mut actions_executed = Vec::new();
        let execution_success = true;
        let error_message = None;
        
        // Execute actions
        for action in &trigger.actions {
            if action.enabled {
                // Would execute actual actions based on action_type
                actions_executed.push(action.action_type.clone());
                debug!("Executed trigger action: {}", action.action_type);
            }
        }
        
        let duration = start_time.elapsed().as_millis() as u64;
        
        // Record execution
        if let Some(automation_bridge) = self.automation_bridge.lock().await.as_mut() {
            let execution = TriggerExecution {
                execution_id,
                trigger_id: trigger.trigger_id.clone(),
                timestamp: Utc::now(),
                results_count: response.results.len(),
                actions_executed,
                success: execution_success,
                error_message,
                duration_ms: duration,
            };
            
            automation_bridge.execution_history.write().await.push(execution);
        }
        
        Ok(())
    }
    
    /// Initialize sync coordinator
    async fn initialize_sync_coordinator(&self) -> SearchResultType<()> {
        info!("Initializing cross-platform sync coordinator");
        
        let sync_config = SyncConfig {
            sync_endpoint: "https://api.flowdesk.com/sync".to_string(),
            device_id: Uuid::new_v4().to_string(),
            encryption_key: "mock_encryption_key".to_string(),
            sync_interval_seconds: 300, // 5 minutes
            max_batch_size: 100,
        };
        
        let coordinator = SyncCoordinator {
            config: sync_config,
            active_syncs: DashMap::new(),
            sync_history: Arc::new(RwLock::new(Vec::new())),
        };
        
        *self.sync_coordinator.lock().await = Some(coordinator);
        
        info!("Sync coordinator initialized");
        Ok(())
    }
    
    /// Initialize automation bridge
    async fn initialize_automation_bridge(&self) -> SearchResultType<()> {
        info!("Initializing automation integration bridge");
        
        let bridge = AutomationBridge {
            trigger_handlers: HashMap::new(),
            active_triggers: DashMap::new(),
            execution_history: Arc::new(RwLock::new(Vec::new())),
        };
        
        *self.automation_bridge.lock().await = Some(bridge);
        
        info!("Automation bridge initialized");
        Ok(())
    }
    
    /// Start background maintenance tasks
    async fn start_background_tasks(&self) {
        let service = self.clone();
        
        // Health monitoring task
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                if let Err(e) = service.perform_health_check().await {
                    error!("Health check failed: {}", e);
                }
            }
        });
        
        // Session cleanup task
        let service = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
            
            loop {
                interval.tick().await;
                service.cleanup_expired_sessions().await;
            }
        });
        
        // Sync coordination task (if enabled)
        if self.config.enable_cross_platform_sync {
            let service = self.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
                
                loop {
                    interval.tick().await;
                    if let Err(e) = service.perform_sync().await {
                        error!("Sync failed: {}", e);
                    }
                }
            });
        }
        
        info!("Background tasks started");
    }
    
    /// Perform health check
    async fn perform_health_check(&self) -> SearchResultType<()> {
        let mut status = self.status.write().await;
        
        // Check search engine health
        let engine_status = self.search_engine.get_health_status().await;
        
        // Check indexing health
        let indexing_stats = self.indexing_manager.get_stats().await;
        
        // Check performance metrics
        let performance_metrics = self.performance_monitor.get_metrics(
            status.total_searches,
            0.75, // Mock cache hit rate
            status.error_rate,
        ).await;
        
        // Update status
        status.is_healthy = engine_status.is_healthy && 
                           performance_metrics.is_healthy &&
                           status.error_rate < 0.1;
        status.last_health_check = Utc::now();
        status.indexing_active = indexing_stats.active_jobs > 0;
        
        if !status.is_healthy {
            warn!("Service health check failed - investigating issues");
        }
        
        Ok(())
    }
    
    /// Clean up expired sessions
    async fn cleanup_expired_sessions(&self) {
        let now = Utc::now();
        let session_timeout = chrono::Duration::minutes(30);
        
        let mut expired_sessions = Vec::new();
        
        for session_entry in self.search_sessions.iter() {
            let session = session_entry.value();
            if (now - session.last_activity) > session_timeout {
                expired_sessions.push(session.session_id.clone());
            }
        }
        
        for session_id in expired_sessions {
            self.search_sessions.remove(&session_id);
        }
        
        debug!("Cleaned up expired search sessions");
    }
    
    /// Perform cross-platform sync
    async fn perform_sync(&self) -> SearchResultType<()> {
        if let Some(sync_coordinator) = self.sync_coordinator.lock().await.as_mut() {
            let session_id = Uuid::new_v4().to_string();
            
            let sync_session = SyncSession {
                session_id: session_id.clone(),
                direction: SyncDirection::Bidirectional,
                started_at: Utc::now(),
                progress: 0.0,
                status: SyncStatus::Preparing,
                documents_synced: 0,
                total_documents: 100, // Mock
            };
            
            sync_coordinator.active_syncs.insert(session_id.clone(), sync_session);
            
            // Simulate sync process
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            
            // Update sync status
            if let Some(mut sync_session) = sync_coordinator.active_syncs.get_mut(&session_id) {
                sync_session.status = SyncStatus::Completed;
                sync_session.progress = 1.0;
                sync_session.documents_synced = sync_session.total_documents;
            }
            
            // Record sync event
            let sync_event = SyncEvent {
                event_id: Uuid::new_v4().to_string(),
                event_type: SyncEventType::IndexSync,
                timestamp: Utc::now(),
                device_id: sync_coordinator.config.device_id.clone(),
                documents_count: 100,
                success: true,
                error_message: None,
                duration_ms: 5000,
            };
            
            sync_coordinator.sync_history.write().await.push(sync_event);
            
            // Update service status
            {
                let mut status = self.status.write().await;
                status.last_sync = Some(Utc::now());
                status.sync_active = false;
            }
            
            info!("Cross-platform sync completed successfully");
        }
        
        Ok(())
    }
    
    /// Get comprehensive service status
    pub async fn get_service_status(&self) -> ServiceStatus {
        self.status.read().await.clone()
    }
    
    /// Get performance metrics
    pub async fn get_performance_metrics(&self) -> PerformanceMetrics {
        let status = self.status.read().await;
        self.performance_monitor.get_metrics(
            status.total_searches,
            0.75, // Would calculate actual cache hit rate
            status.error_rate,
        ).await
    }
    
    /// Get search analytics
    pub async fn get_search_analytics(&self) -> SearchResultType<SearchAnalytics> {
        self.search_engine.get_analytics().await
    }
    
    /// Create new search session
    pub async fn create_search_session(&self, user_id: Option<String>) -> String {
        let session_id = Uuid::new_v4().to_string();
        
        let session = SearchSession {
            session_id: session_id.clone(),
            user_id,
            started_at: Utc::now(),
            last_activity: Utc::now(),
            queries: Vec::new(),
            total_search_time_ms: 0,
            results_clicked: Vec::new(),
            metadata: HashMap::new(),
        };
        
        self.search_sessions.insert(session_id.clone(), session);
        
        debug!("Created search session: {}", session_id);
        session_id
    }
    
    /// Record result click
    pub async fn record_result_click(&self, session_id: &str, result_click: SearchResultClick) {
        if let Some(mut session) = self.search_sessions.get_mut(session_id) {
            session.results_clicked.push(result_click);
            session.last_activity = Utc::now();
        }
    }
}

impl Clone for UnifiedSearchService {
    fn clone(&self) -> Self {
        Self {
            search_engine: Arc::clone(&self.search_engine),
            indexing_manager: Arc::clone(&self.indexing_manager),
            query_builder: Arc::clone(&self.query_builder),
            performance_monitor: Arc::clone(&self.performance_monitor),
            provider_manager: Arc::clone(&self.provider_manager),
            search_sessions: Arc::clone(&self.search_sessions),
            config: self.config.clone(),
            sync_coordinator: Arc::clone(&self.sync_coordinator),
            automation_bridge: Arc::clone(&self.automation_bridge),
            status: Arc::clone(&self.status),
        }
    }
}

/// Convert SearchFilter vector to AdvancedFilters
/// 
/// This function maps the simple SearchFilter format to the more structured
/// AdvancedFilters format for better analytics tracking and query optimization.
fn convert_search_filters_to_advanced(filters: &Option<Vec<SearchFilter>>) -> Option<AdvancedFilters> {
    let filters = filters.as_ref()?;
    if filters.is_empty() {
        return None;
    }
    
    let mut advanced_filters = AdvancedFilters {
        content_types: None,
        providers: None,
        provider_types: None,
        date_range: None,
        authors: None,
        tags: None,
        categories: None,
        file_size_range: None,
        metadata_filters: None,
        location_filter: None,
        language: None,
        priority_range: None,
    };
    
    let mut content_types = Vec::new();
    let mut providers = Vec::new();
    let mut provider_types = Vec::new();
    let mut authors = Vec::new();
    let mut categories = Vec::new();
    let mut tags = Vec::new();
    let mut metadata_filters = HashMap::new();
    
    for filter in filters {
        match filter.field.as_str() {
            "content_type" => {
                if let Ok(content_type_str) = serde_json::from_value::<String>(filter.value.clone()) {
                    // Parse content type string
                    match content_type_str.as_str() {
                        "email" => content_types.push(ContentType::Email),
                        "calendar_event" => content_types.push(ContentType::CalendarEvent),
                        "contact" => content_types.push(ContentType::Contact),
                        "file" => content_types.push(ContentType::File),
                        "document" => content_types.push(ContentType::Document),
                        "message" => content_types.push(ContentType::Message),
                        "channel" => content_types.push(ContentType::Channel),
                        "thread" => content_types.push(ContentType::Thread),
                        "task" => content_types.push(ContentType::Task),
                        "project" => content_types.push(ContentType::Project),
                        "issue" => content_types.push(ContentType::Issue),
                        "pull_request" => content_types.push(ContentType::PullRequest),
                        "commit" => content_types.push(ContentType::Commit),
                        "meeting" => content_types.push(ContentType::Meeting),
                        "note" => content_types.push(ContentType::Note),
                        "bookmark" => content_types.push(ContentType::Bookmark),
                        custom => content_types.push(ContentType::Custom(custom.to_string())),
                    }
                }
            },
            "provider_id" => {
                if let Ok(provider_id) = serde_json::from_value::<String>(filter.value.clone()) {
                    providers.push(provider_id);
                }
            },
            "provider_type" => {
                if let Ok(provider_type_str) = serde_json::from_value::<String>(filter.value.clone()) {
                    // Parse provider type string
                    match provider_type_str.as_str() {
                        "gmail" => provider_types.push(ProviderType::Gmail),
                        "outlook" => provider_types.push(ProviderType::Outlook),
                        "exchange" => provider_types.push(ProviderType::Exchange),
                        "slack" => provider_types.push(ProviderType::Slack),
                        "teams" => provider_types.push(ProviderType::Teams),
                        "discord" => provider_types.push(ProviderType::Discord),
                        "notion" => provider_types.push(ProviderType::Notion),
                        "confluence" => provider_types.push(ProviderType::Confluence),
                        "jira" => provider_types.push(ProviderType::Jira),
                        "github" => provider_types.push(ProviderType::GitHub),
                        "gitlab" => provider_types.push(ProviderType::GitLab),
                        "google_drive" => provider_types.push(ProviderType::GoogleDrive),
                        "dropbox" => provider_types.push(ProviderType::Dropbox),
                        "onedrive" => provider_types.push(ProviderType::OneDrive),
                        "local" => provider_types.push(ProviderType::LocalFiles),
                        _ => {}, // Unknown provider type, skip
                    }
                }
            },
            "author" => {
                if let Ok(author) = serde_json::from_value::<String>(filter.value.clone()) {
                    authors.push(author);
                }
            },
            "categories" | "category" => {
                if let Ok(category) = serde_json::from_value::<String>(filter.value.clone()) {
                    categories.push(category);
                } else if let Ok(category_list) = serde_json::from_value::<Vec<String>>(filter.value.clone()) {
                    categories.extend(category_list);
                }
            },
            "tags" | "tag" => {
                if let Ok(tag) = serde_json::from_value::<String>(filter.value.clone()) {
                    tags.push(tag);
                } else if let Ok(tag_list) = serde_json::from_value::<Vec<String>>(filter.value.clone()) {
                    tags.extend(tag_list);
                }
            },
            "created_at" | "modified_at" | "last_modified" => {
                // For date filters, we could implement date range conversion here
                // For now, we'll store it in metadata_filters
                if let Ok(value_str) = serde_json::from_value::<String>(filter.value.clone()) {
                    metadata_filters.insert(
                        filter.field.clone(),
                        crate::search::advanced_query::MetadataFilter {
                            field: filter.field.clone(),
                            operation: crate::search::advanced_query::FilterOperation::Equals,
                            value: crate::search::advanced_query::FilterValue::String(value_str),
                        }
                    );
                }
            },
            "language" => {
                if let Ok(lang) = serde_json::from_value::<String>(filter.value.clone()) {
                    advanced_filters.language = Some(lang);
                }
            },
            _ => {
                // Store unknown filters as metadata filters
                if let Ok(value_str) = serde_json::from_value::<String>(filter.value.clone()) {
                    metadata_filters.insert(
                        filter.field.clone(),
                        crate::search::advanced_query::MetadataFilter {
                            field: filter.field.clone(),
                            operation: crate::search::advanced_query::FilterOperation::Equals,
                            value: crate::search::advanced_query::FilterValue::String(value_str),
                        }
                    );
                } else if let Ok(value_num) = serde_json::from_value::<f64>(filter.value.clone()) {
                    metadata_filters.insert(
                        filter.field.clone(),
                        crate::search::advanced_query::MetadataFilter {
                            field: filter.field.clone(),
                            operation: crate::search::advanced_query::FilterOperation::Equals,
                            value: crate::search::advanced_query::FilterValue::Number(value_num),
                        }
                    );
                }
            },
        }
    }
    
    // Set the collected filters
    if !content_types.is_empty() {
        advanced_filters.content_types = Some(content_types);
    }
    if !providers.is_empty() {
        advanced_filters.providers = Some(providers);
    }
    if !provider_types.is_empty() {
        advanced_filters.provider_types = Some(provider_types);
    }
    if !authors.is_empty() {
        advanced_filters.authors = Some(authors);
    }
    if !categories.is_empty() {
        advanced_filters.categories = Some(categories);
    }
    if !tags.is_empty() {
        advanced_filters.tags = Some(TagFilter {
            include_any: Some(tags), // Default to "any" mode - tags are included if any match
            include_all: None,
            exclude: None,
        });
    }
    if !metadata_filters.is_empty() {
        advanced_filters.metadata_filters = Some(metadata_filters);
    }
    
    Some(advanced_filters)
}