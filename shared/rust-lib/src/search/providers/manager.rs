//! Provider manager for coordinating multiple search providers

use crate::search::{
    SearchQuery, SearchResult as SearchResult, SearchError, ProviderResponse, 
    ProviderConfig, ErrorContext, SearchErrorContext,
};
use super::{SearchProvider, ProviderFactory, ProviderStats, ProviderHealth, HealthStatus};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use dashmap::DashMap;
use tracing::{info, error, debug, warn, instrument};
use futures::future::join_all;

/// Manager for coordinating multiple search providers
pub struct ProviderManager {
    /// Active providers
    providers: Arc<DashMap<String, Arc<RwLock<Box<dyn SearchProvider + Send + Sync>>>>>,
    
    /// Provider configurations
    configs: Arc<RwLock<HashMap<String, ProviderConfig>>>,
    
    /// Provider performance metrics
    metrics: Arc<DashMap<String, ProviderMetrics>>,
}

/// Performance metrics for providers
#[derive(Debug, Clone)]
struct ProviderMetrics {
    /// Total queries executed
    total_queries: u64,
    
    /// Successful queries
    successful_queries: u64,
    
    /// Failed queries
    failed_queries: u64,
    
    /// Average response time (ms)
    avg_response_time_ms: f64,
    
    /// Last health check result
    last_health_check: Option<ProviderHealth>,
    
    /// Provider weight for query distribution
    weight: f32,
    
    /// Whether provider is currently enabled
    enabled: bool,
}

impl Default for ProviderMetrics {
    fn default() -> Self {
        Self {
            total_queries: 0,
            successful_queries: 0,
            failed_queries: 0,
            avg_response_time_ms: 0.0,
            last_health_check: None,
            weight: 1.0,
            enabled: true,
        }
    }
}

impl ProviderManager {
    /// Create a new provider manager
    #[instrument]
    pub async fn new(configs: Vec<ProviderConfig>) -> SearchResult<Self> {
        info!("Initializing provider manager with {} providers", configs.len());
        
        let manager = Self {
            providers: Arc::new(DashMap::new()),
            configs: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(DashMap::new()),
        };
        
        // Initialize providers
        for config in configs {
            if let Err(e) = manager.add_provider(config).await {
                error!("Failed to add provider: {}", e);
            }
        }
        
        // Start background health checks
        manager.start_health_monitoring().await;
        
        info!("Provider manager initialized successfully");
        Ok(manager)
    }
    
    /// Add a new provider
    #[instrument(skip(self, config), fields(provider_id = %config.id))]
    pub async fn add_provider(&self, config: ProviderConfig) -> SearchResult<()> {
        info!("Adding provider: {}", config.id);
        
        let context = SearchErrorContext::new("add_provider")
            .with_provider(&config.id);
        
        // Create provider instance
        let mut provider = ProviderFactory::create_provider(&config)
            .await
            .with_context(context.clone())?;
        
        // Initialize the provider
        provider.initialize(config.config.clone())
            .await
            .with_context(context.clone())?;
        
        // Store provider and config
        let provider_id = config.id.clone();
        self.providers.insert(provider_id.clone(), Arc::new(RwLock::new(provider)));
        
        let (weight, enabled) = {
            let mut configs = self.configs.write().await;
            configs.insert(provider_id.clone(), config);
            let config_ref = configs.get(&provider_id).unwrap();
            (config_ref.weight, config_ref.enabled)
        };
        
        // Initialize metrics  
        self.metrics.insert(provider_id.clone(), ProviderMetrics {
            weight,
            enabled,
            ..Default::default()
        });
        
        info!("Provider added successfully: {}", provider_id);
        Ok(())
    }
    
    /// Remove a provider
    #[instrument(skip(self), fields(provider_id = %provider_id))]
    pub async fn remove_provider(&self, provider_id: &str) -> SearchResult<()> {
        info!("Removing provider: {}", provider_id);
        
        if let Some((_, provider_arc)) = self.providers.remove(provider_id) {
            // Shutdown the provider
            let mut provider = provider_arc.write().await;
            if let Err(e) = provider.shutdown().await {
                warn!("Error shutting down provider {}: {}", provider_id, e);
            }
        }
        
        // Remove config and metrics
        {
            let mut configs = self.configs.write().await;
            configs.remove(provider_id);
        }
        
        self.metrics.remove(provider_id);
        
        info!("Provider removed successfully: {}", provider_id);
        Ok(())
    }
    
    /// Search across specified providers
    #[instrument(skip(self, query), fields(query_text = %query.query))]
    pub async fn search_providers(
        &self,
        query: &SearchQuery,
        provider_ids: &[String],
    ) -> SearchResult<Vec<ProviderResponse>> {
        debug!("Searching {} providers", provider_ids.len());
        
        let mut search_futures = Vec::new();
        
        for provider_id in provider_ids {
            if let Some(provider_arc) = self.providers.get(provider_id) {
                // Check if provider is enabled and healthy
                if let Some(metrics) = self.metrics.get(provider_id) {
                    if !metrics.enabled {
                        debug!("Skipping disabled provider: {}", provider_id);
                        continue;
                    }
                    
                    if let Some(health) = &metrics.last_health_check {
                        if matches!(health.status, HealthStatus::Unhealthy) {
                            debug!("Skipping unhealthy provider: {}", provider_id);
                            continue;
                        }
                    }
                }
                
                let provider = provider_arc.clone();
                let query = query.clone();
                let provider_id = provider_id.clone();
                
                let future = async move {
                    let start_time = std::time::Instant::now();
                    let result = {
                        let provider = provider.read().await;
                        provider.search(&query).await
                    };
                    let response_time = start_time.elapsed().as_millis() as u64;
                    
                    (provider_id, result, response_time)
                };
                
                search_futures.push(future);
            } else {
                warn!("Provider not found: {}", provider_id);
            }
        }
        
        // Execute searches in parallel
        let results = join_all(search_futures).await;
        let mut responses = Vec::new();
        
        for (provider_id, result, response_time) in results {
            match result {
                Ok(response) => {
                    debug!("Provider {} returned {} results in {}ms", 
                           provider_id, response.results.len(), response_time);
                    
                    self.update_provider_metrics(&provider_id, true, response_time).await;
                    responses.push(response);
                }
                Err(e) => {
                    error!("Provider {} search failed: {}", provider_id, e);
                    self.update_provider_metrics(&provider_id, false, response_time).await;
                    
                    // Create error response
                    responses.push(ProviderResponse {
                        provider_id: provider_id.clone(),
                        provider_type: crate::search::ProviderType::Plugin(provider_id.clone()),
                        results: Vec::new(),
                        execution_time_ms: response_time,
                        errors: vec![e.to_string()],
                        warnings: Vec::new(),
                    });
                }
            }
        }
        
        debug!("Search completed across {} providers", responses.len());
        Ok(responses)
    }
    
    /// Get all provider statistics
    pub async fn get_all_provider_stats(&self) -> SearchResult<HashMap<String, ProviderStats>> {
        let mut all_stats = HashMap::new();
        
        for provider_entry in self.providers.iter() {
            let provider_id = provider_entry.key();
            let provider = provider_entry.value();
            
            match provider.read().await.get_stats().await {
                Ok(stats) => {
                    all_stats.insert(provider_id.clone(), stats);
                }
                Err(e) => {
                    error!("Failed to get stats for provider {}: {}", provider_id, e);
                }
            }
        }
        
        Ok(all_stats)
    }
    
    /// Check health of all providers
    #[instrument(skip(self))]
    pub async fn check_health(&self) -> SearchResult<bool> {
        debug!("Performing health check on all providers");
        
        let mut overall_healthy = true;
        let mut health_futures = Vec::new();
        
        for provider_entry in self.providers.iter() {
            let provider_id = provider_entry.key().clone();
            let provider = provider_entry.value().clone();
            
            let future = async move {
                let health_result = {
                    let provider = provider.read().await;
                    provider.health_check().await
                };
                (provider_id, health_result)
            };
            
            health_futures.push(future);
        }
        
        let health_results = join_all(health_futures).await;
        
        for (provider_id, health_result) in health_results {
            match health_result {
                Ok(health) => {
                    let is_healthy = matches!(health.status, HealthStatus::Healthy);
                    if !is_healthy {
                        overall_healthy = false;
                        warn!("Provider {} is unhealthy: {:?}", provider_id, health.status);
                    }
                    
                    // Update metrics with health check result
                    if let Some(mut metrics) = self.metrics.get_mut(&provider_id) {
                        metrics.last_health_check = Some(health);
                    }
                }
                Err(e) => {
                    overall_healthy = false;
                    error!("Health check failed for provider {}: {}", provider_id, e);
                }
            }
        }
        
        debug!("Health check completed. Overall healthy: {}", overall_healthy);
        Ok(overall_healthy)
    }
    
    /// Enable or disable a provider
    #[instrument(skip(self), fields(provider_id = %provider_id))]
    pub async fn set_provider_enabled(&self, provider_id: &str, enabled: bool) -> SearchResult<()> {
        if let Some(mut metrics) = self.metrics.get_mut(provider_id) {
            metrics.enabled = enabled;
            info!("Provider {} {}", provider_id, if enabled { "enabled" } else { "disabled" });
        } else {
            return Err(SearchError::provider_error(provider_id, "Provider not found"));
        }
        
        Ok(())
    }
    
    /// Update provider weight for query distribution
    #[instrument(skip(self), fields(provider_id = %provider_id))]
    pub async fn set_provider_weight(&self, provider_id: &str, weight: f32) -> SearchResult<()> {
        if let Some(mut metrics) = self.metrics.get_mut(provider_id) {
            metrics.weight = weight;
            debug!("Provider {} weight set to {}", provider_id, weight);
        } else {
            return Err(SearchError::provider_error(provider_id, "Provider not found"));
        }
        
        Ok(())
    }
    
    /// Get enabled providers, sorted by weight and health
    pub async fn get_enabled_providers(&self) -> Vec<String> {
        let mut enabled_providers: Vec<(String, f32, bool)> = Vec::new();
        
        for metrics_entry in self.metrics.iter() {
            let provider_id = metrics_entry.key();
            let metrics = metrics_entry.value();
            
            if metrics.enabled {
                let is_healthy = metrics.last_health_check
                    .as_ref()
                    .map(|h| matches!(h.status, HealthStatus::Healthy))
                    .unwrap_or(true);
                
                enabled_providers.push((provider_id.clone(), metrics.weight, is_healthy));
            }
        }
        
        // Sort by health first, then by weight (descending)
        enabled_providers.sort_by(|a, b| {
            match (a.2, b.2) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal),
            }
        });
        
        enabled_providers.into_iter().map(|(id, _, _)| id).collect()
    }
    
    /// Start background health monitoring
    async fn start_health_monitoring(&self) {
        let manager = self.clone();
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // 5 minutes
            
            loop {
                interval.tick().await;
                if let Err(e) = manager.check_health().await {
                    error!("Background health check failed: {}", e);
                }
            }
        });
    }
    
    /// Update provider performance metrics
    async fn update_provider_metrics(&self, provider_id: &str, success: bool, response_time_ms: u64) {
        if let Some(mut metrics) = self.metrics.get_mut(provider_id) {
            metrics.total_queries += 1;
            
            if success {
                metrics.successful_queries += 1;
            } else {
                metrics.failed_queries += 1;
            }
            
            // Update average response time
            let total_time = metrics.avg_response_time_ms * (metrics.total_queries - 1) as f64;
            metrics.avg_response_time_ms = (total_time + response_time_ms as f64) / metrics.total_queries as f64;
        }
    }
}

impl Clone for ProviderManager {
    fn clone(&self) -> Self {
        Self {
            providers: Arc::clone(&self.providers),
            configs: Arc::clone(&self.configs),
            metrics: Arc::clone(&self.metrics),
        }
    }
}