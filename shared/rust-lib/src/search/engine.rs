//! Main search engine implementation using Tantivy

use crate::search::{
    SearchConfig, SearchDocument, SearchQuery, SearchResponse, SearchError, SearchResult as SearchResultType,
    IndexManager, QueryProcessor, ProviderManager, AnalyticsManager, ErrorContext, SearchErrorContext,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, debug, instrument};
use dashmap::DashMap;
use tokio::sync::Mutex as AsyncMutex;

/// Main search engine coordinating all search operations
#[derive(Clone)]
pub struct SearchEngine {
    /// Search configuration
    config: SearchConfig,
    
    /// Index manager for Tantivy operations
    index_manager: Arc<IndexManager>,
    
    /// Query processor for search execution
    query_processor: Arc<QueryProcessor>,
    
    /// Provider manager for external search sources
    provider_manager: Arc<ProviderManager>,
    
    /// Analytics manager for search metrics
    analytics_manager: Arc<AsyncMutex<AnalyticsManager>>,
    
    /// Search cache for performance
    search_cache: Arc<DashMap<String, (SearchResponse, chrono::DateTime<chrono::Utc>)>>,
    
    /// Active indexing jobs
    active_jobs: Arc<DashMap<String, crate::search::IndexingJob>>,
    
    /// Search engine status
    status: Arc<RwLock<EngineStatus>>,
}

/// Search engine status
#[derive(Debug, Clone)]
pub struct EngineStatus {
    pub is_healthy: bool,
    pub last_health_check: chrono::DateTime<chrono::Utc>,
    pub total_documents: u64,
    pub total_searches: u64,
    pub avg_response_time_ms: f64,
    pub error_rate: f64,
}

impl Default for EngineStatus {
    fn default() -> Self {
        Self {
            is_healthy: true,
            last_health_check: chrono::Utc::now(),
            total_documents: 0,
            total_searches: 0,
            avg_response_time_ms: 0.0,
            error_rate: 0.0,
        }
    }
}

impl SearchEngine {
    /// Create a new search engine instance
    #[instrument(skip(config))]
    pub async fn new(config: SearchConfig) -> SearchResultType<Self> {
        info!("Initializing Flow Desk search engine");
        
        // Initialize index manager
        let index_manager = Arc::new(
            IndexManager::new(&config.index_dir, config.max_memory_mb)
                .await
                .with_context(SearchErrorContext::new("index_manager_init"))?
        );
        
        // Initialize query processor
        let query_processor = Arc::new(
            QueryProcessor::new(
                index_manager.clone(),
                config.max_response_time_ms,
                config.num_threads,
            )
                .with_context(SearchErrorContext::new("query_processor_init"))?
        );
        
        // Initialize provider manager
        let provider_manager = Arc::new(
            ProviderManager::new(config.providers.clone())
                .await
                .with_context(SearchErrorContext::new("provider_manager_init"))?
        );
        
        // Initialize analytics manager
        let analytics_manager = Arc::new(AsyncMutex::new(
            AnalyticsManager::new(config.enable_analytics)
                .with_context(SearchErrorContext::new("analytics_manager_init"))?
        ));
        
        let engine = Self {
            config,
            index_manager,
            query_processor,
            provider_manager,
            analytics_manager,
            search_cache: Arc::new(DashMap::new()),
            active_jobs: Arc::new(DashMap::new()),
            status: Arc::new(RwLock::new(EngineStatus::default())),
        };
        
        // Start background tasks
        engine.start_background_tasks().await;
        
        info!("Search engine initialized successfully");
        Ok(engine)
    }
    
    /// Execute a search query
    #[instrument(skip(self, query), fields(query_text = %query.query))]
    pub async fn search(&self, query: SearchQuery) -> SearchResultType<SearchResponse> {
        let start_time = std::time::Instant::now();
        let context = SearchErrorContext::new("search")
            .with_query(&query.query);
        
        debug!("Executing search query: {}", query.query);
        
        // Check cache first if enabled
        if query.options.use_cache.unwrap_or(true) {
            let cache_key = self.generate_cache_key(&query);
            if let Some(cached_entry) = self.search_cache.get(&cache_key) {
                let (cached_response, cached_at) = cached_entry.value();
                let cache_ttl = query.options.cache_ttl.unwrap_or(300);
                if chrono::Utc::now().timestamp() - cached_at.timestamp() < cache_ttl as i64 {
                    debug!("Returning cached search result");
                    return Ok(cached_response.clone());
                }
                // Remove expired cache entry
                self.search_cache.remove(&cache_key);
            }
        }
        
        // Execute search across providers
        let mut response = match self.execute_search_query(&query).await {
            Ok(response) => response,
            Err(e) => {
                error!("Search execution failed: {}", e);
                self.record_search_error(&query, &e).await;
                return Err(e).with_context(context);
            }
        };
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        response.execution_time_ms = execution_time;
        
        // Cache the response if enabled
        if query.options.use_cache.unwrap_or(true) {
            let cache_key = self.generate_cache_key(&query);
            self.search_cache.insert(cache_key, (response.clone(), chrono::Utc::now()));
        }
        
        // Record analytics
        self.record_search_success(&query, &response, execution_time).await;
        
        debug!("Search completed in {}ms with {} results", execution_time, response.results.len());
        Ok(response)
    }
    
    /// Index a single document
    #[instrument(skip(self, document), fields(doc_id = %document.id))]
    pub async fn index_document(&self, document: SearchDocument) -> SearchResultType<()> {
        let context = SearchErrorContext::new("index_document")
            .with_info("document_id", &document.id)
            .with_provider(&document.provider_id);
        
        debug!("Indexing document: {}", document.id);
        
        self.index_manager
            .add_document(document)
            .await
            .with_context(context)?;
        
        // Update status
        {
            let mut status = self.status.write().await;
            status.total_documents += 1;
        }
        
        debug!("Document indexed successfully");
        Ok(())
    }
    
    /// Index multiple documents in batch
    #[instrument(skip(self, documents), fields(doc_count = documents.len()))]
    pub async fn index_documents(&self, documents: Vec<SearchDocument>) -> SearchResultType<usize> {
        let context = SearchErrorContext::new("index_documents")
            .with_info("document_count", &documents.len().to_string());
        
        info!("Batch indexing {} documents", documents.len());
        
        let indexed_count = self.index_manager
            .add_documents(documents)
            .await
            .with_context(context)?;
        
        // Update status
        {
            let mut status = self.status.write().await;
            status.total_documents += indexed_count as u64;
        }
        
        info!("Batch indexed {} documents successfully", indexed_count);
        Ok(indexed_count)
    }
    
    /// Delete a document from the index
    #[instrument(skip(self), fields(doc_id = %document_id))]
    pub async fn delete_document(&self, document_id: &str) -> SearchResultType<bool> {
        let context = SearchErrorContext::new("delete_document")
            .with_info("document_id", document_id);
        
        debug!("Deleting document: {}", document_id);
        
        let deleted = self.index_manager
            .delete_document(document_id)
            .await
            .with_context(context)?;
        
        if deleted {
            // Update status
            let mut status = self.status.write().await;
            status.total_documents = status.total_documents.saturating_sub(1);
            
            debug!("Document deleted successfully");
        } else {
            debug!("Document not found for deletion");
        }
        
        Ok(deleted)
    }
    
    /// Update an existing document
    #[instrument(skip(self, document), fields(doc_id = %document.id))]
    pub async fn update_document(&self, document: SearchDocument) -> SearchResultType<()> {
        let context = SearchErrorContext::new("update_document")
            .with_info("document_id", &document.id)
            .with_provider(&document.provider_id);
        
        debug!("Updating document: {}", document.id);
        
        self.index_manager
            .update_document(document)
            .await
            .with_context(context)?;
        
        debug!("Document updated successfully");
        Ok(())
    }
    
    /// Get search suggestions for a partial query
    #[instrument(skip(self))]
    pub async fn get_suggestions(&self, partial_query: &str, limit: usize) -> SearchResultType<Vec<String>> {
        let context = SearchErrorContext::new("get_suggestions")
            .with_query(partial_query);
        
        if !self.config.enable_suggestions {
            return Ok(Vec::new());
        }
        
        debug!("Getting suggestions for: {}", partial_query);
        
        let suggestions = self.query_processor
            .get_suggestions(partial_query, limit)
            .await
            .with_context(context)?;
        
        debug!("Generated {} suggestions", suggestions.len());
        Ok(suggestions)
    }
    
    /// Get search analytics
    pub async fn get_analytics(&self) -> SearchResultType<crate::search::SearchAnalytics> {
        let analytics = self.analytics_manager.lock().await.get_analytics().await?;
        Ok(analytics)
    }
    
    /// Get search engine health status
    pub async fn get_health_status(&self) -> EngineStatus {
        let status = self.status.read().await;
        status.clone()
    }
    
    /// Optimize search indices
    #[instrument(skip(self))]
    pub async fn optimize_indices(&self) -> SearchResultType<()> {
        info!("Starting index optimization");
        
        let context = SearchErrorContext::new("optimize_indices");
        
        self.index_manager
            .optimize()
            .await
            .with_context(context)?;
        
        info!("Index optimization completed");
        Ok(())
    }
    
    /// Clear search cache
    pub async fn clear_cache(&self) {
        info!("Clearing search cache");
        self.search_cache.clear();
    }
    
    /// Start background maintenance tasks
    async fn start_background_tasks(&self) {
        let engine = self.clone();
        
        // Health check task
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                if let Err(e) = engine.perform_health_check().await {
                    error!("Health check failed: {}", e);
                }
            }
        });
        
        // Cache cleanup task
        let engine = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
            
            loop {
                interval.tick().await;
                engine.cleanup_cache().await;
            }
        });
        
        // Index optimization task
        let engine = self.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));
            
            loop {
                interval.tick().await;
                if let Err(e) = engine.optimize_indices().await {
                    error!("Automatic index optimization failed: {}", e);
                }
            }
        });
    }
    
    /// Execute search query across all providers
    async fn execute_search_query(&self, query: &SearchQuery) -> SearchResultType<SearchResponse> {
        // Execute local search
        let local_response = self.query_processor
            .execute_query(query)
            .await?;
        
        // Execute provider searches in parallel
        let provider_responses = if let Some(provider_ids) = &query.provider_ids {
            self.provider_manager
                .search_providers(query, provider_ids)
                .await?
        } else {
            Vec::new()
        };
        
        // Merge results
        let merged_response = self.merge_search_responses(
            query,
            local_response,
            provider_responses,
        ).await?;
        
        Ok(merged_response)
    }
    
    /// Merge search responses from different sources
    async fn merge_search_responses(
        &self,
        query: &SearchQuery,
        local_response: SearchResponse,
        provider_responses: Vec<crate::search::ProviderResponse>,
    ) -> SearchResultType<SearchResponse> {
        let mut all_results = local_response.results;
        let mut total_count = local_response.total_count;
        
        // Add provider results
        for provider_response in &provider_responses {
            all_results.extend(provider_response.results.clone());
            total_count += provider_response.results.len();
        }
        
        // Sort by relevance score
        all_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        
        // Apply pagination
        let limit = query.limit.unwrap_or(50);
        let offset = query.offset.unwrap_or(0);
        let paginated_results = all_results
            .into_iter()
            .skip(offset)
            .take(limit)
            .collect();
        
        Ok(SearchResponse {
            query: query.clone(),
            results: paginated_results,
            total_count,
            execution_time_ms: 0, // Will be set by caller
            facets: local_response.facets,
            suggestions: local_response.suggestions,
            debug_info: local_response.debug_info,
            next_page_token: None,
            provider_responses: Some(provider_responses),
        })
    }
    
    /// Generate cache key for search query
    fn generate_cache_key(&self, query: &SearchQuery) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        query.hash(&mut hasher);
        format!("search:{:x}", hasher.finish())
    }
    
    /// Record successful search for analytics
    async fn record_search_success(
        &self,
        query: &SearchQuery,
        response: &SearchResponse,
        execution_time_ms: u64,
    ) {
        if self.config.enable_analytics {
            let mut analytics = self.analytics_manager.lock().await;
            analytics.record_search(query, response, execution_time_ms).await;
        }
        
        // Update status
        let mut status = self.status.write().await;
        status.total_searches += 1;
        status.avg_response_time_ms = (status.avg_response_time_ms * (status.total_searches - 1) as f64 + execution_time_ms as f64) / status.total_searches as f64;
    }
    
    /// Record search error for analytics
    async fn record_search_error(&self, query: &SearchQuery, error: &SearchError) {
        if self.config.enable_analytics {
            let mut analytics = self.analytics_manager.lock().await;
            analytics.record_error(query, error).await;
        }
        
        // Update error rate
        let mut status = self.status.write().await;
        status.total_searches += 1;
        let error_count = (status.error_rate * (status.total_searches - 1) as f64) + 1.0;
        status.error_rate = error_count / status.total_searches as f64;
    }
    
    /// Perform health check
    async fn perform_health_check(&self) -> SearchResultType<()> {
        let mut status = self.status.write().await;
        
        // Check index health
        let index_healthy = self.index_manager.is_healthy().await?;
        
        // Check provider health
        let providers_healthy = self.provider_manager.check_health().await?;
        
        status.is_healthy = index_healthy && providers_healthy;
        status.last_health_check = chrono::Utc::now();
        
        Ok(())
    }
    
    /// Clean up expired cache entries
    async fn cleanup_cache(&self) {
        let now = chrono::Utc::now();
        let mut expired_keys = Vec::new();
        
        // Find expired entries
        for entry in self.search_cache.iter() {
            let (_, cached_at) = entry.value();
            if (now - *cached_at).num_seconds() > 300 {
                expired_keys.push(entry.key().clone());
            }
        }
        
        // Remove expired entries
        for key in expired_keys {
            self.search_cache.remove(&key);
        }
        
        debug!("Cache cleanup completed");
    }
}

// Add Hash implementation for SearchQuery to enable caching
impl std::hash::Hash for SearchQuery {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.query.hash(state);
        
        if let Some(content_types) = &self.content_types {
            for ct in content_types {
                ct.as_str().hash(state);
            }
        }
        
        if let Some(provider_ids) = &self.provider_ids {
            for pid in provider_ids {
                pid.hash(state);
            }
        }
        
        self.limit.hash(state);
        self.offset.hash(state);
    }
}