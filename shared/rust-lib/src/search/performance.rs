//! Performance monitoring and optimization for the search engine

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use tracing::{debug, info, warn, error};
use dashmap::DashMap;

/// Performance metrics for search operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// Average response time in milliseconds
    pub avg_response_time_ms: f64,
    
    /// Target response time in milliseconds
    pub target_response_time_ms: u64,
    
    /// Performance compliance percentage (100% = meeting target)
    pub performance_compliance: f64,
    
    /// Total number of searches performed
    pub total_searches: u64,
    
    /// Cache hit rate (0.0 to 1.0)
    pub cache_hit_rate: f64,
    
    /// Current cache size
    pub cache_size: usize,
    
    /// Error rate (0.0 to 1.0)
    pub error_rate: f64,
    
    /// Overall health status
    pub is_healthy: bool,
    
    /// Last optimization timestamp
    pub last_optimization: Option<DateTime<Utc>>,
    
    /// Memory usage in MB
    pub memory_usage_mb: u64,
    
    /// Response time percentiles
    pub response_time_percentiles: ResponseTimePercentiles,
    
    /// Query performance breakdown
    pub query_performance: QueryPerformanceBreakdown,
}

/// Response time percentiles for detailed analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseTimePercentiles {
    pub p50: f64,
    pub p75: f64,
    pub p90: f64,
    pub p95: f64,
    pub p99: f64,
}

/// Query performance breakdown by stage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPerformanceBreakdown {
    /// Time spent on query parsing (ms)
    pub parsing_ms: f64,
    
    /// Time spent on index search (ms)
    pub index_search_ms: f64,
    
    /// Time spent on provider searches (ms)
    pub provider_search_ms: f64,
    
    /// Time spent on result merging (ms)
    pub result_merging_ms: f64,
    
    /// Time spent on caching (ms)
    pub caching_ms: f64,
}

/// Performance monitoring and optimization manager
pub struct PerformanceMonitor {
    /// Response time samples for statistical analysis
    response_times: Arc<RwLock<Vec<u64>>>,
    
    /// Query performance breakdowns
    query_breakdowns: Arc<DashMap<String, QueryPerformanceBreakdown>>,
    
    /// Performance alerts configuration
    alerts_config: PerformanceAlertsConfig,
    
    /// Last optimization timestamp
    last_optimization: Arc<RwLock<Option<DateTime<Utc>>>>,
    
    /// Performance targets
    targets: PerformanceTargets,
}

/// Performance alerts configuration
#[derive(Debug, Clone)]
pub struct PerformanceAlertsConfig {
    /// Response time threshold for warnings (ms)
    pub warning_threshold_ms: u64,
    
    /// Response time threshold for critical alerts (ms)
    pub critical_threshold_ms: u64,
    
    /// Number of consecutive slow queries to trigger optimization
    pub slow_query_threshold: usize,
    
    /// Maximum cache size before cleanup
    pub max_cache_size: usize,
    
    /// Maximum memory usage before optimization (MB)
    pub max_memory_usage_mb: u64,
}

/// Performance targets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceTargets {
    /// Target response time (ms)
    pub target_response_time_ms: u64,
    
    /// Target cache hit rate
    pub target_cache_hit_rate: f64,
    
    /// Target error rate (maximum allowed)
    pub max_error_rate: f64,
    
    /// Target memory usage (MB)
    pub target_memory_usage_mb: u64,
}

impl Default for PerformanceTargets {
    fn default() -> Self {
        Self {
            target_response_time_ms: 300, // Sub-300ms requirement
            target_cache_hit_rate: 0.7,   // 70% cache hit rate
            max_error_rate: 0.05,          // 5% maximum error rate
            target_memory_usage_mb: 512,   // 512MB target memory usage
        }
    }
}

impl PerformanceMonitor {
    /// Create a new performance monitor
    pub fn new(targets: Option<PerformanceTargets>) -> Self {
        let targets = targets.unwrap_or_default();
        
        let alerts_config = PerformanceAlertsConfig {
            warning_threshold_ms: targets.target_response_time_ms,
            critical_threshold_ms: targets.target_response_time_ms * 2,
            slow_query_threshold: 5,
            max_cache_size: 10000,
            max_memory_usage_mb: targets.target_memory_usage_mb * 2,
        };
        
        Self {
            response_times: Arc::new(RwLock::new(Vec::with_capacity(1000))),
            query_breakdowns: Arc::new(DashMap::new()),
            alerts_config,
            last_optimization: Arc::new(RwLock::new(None)),
            targets,
        }
    }
    
    /// Record a search query performance
    pub async fn record_query_performance(
        &self,
        query: &str,
        response_time_ms: u64,
        breakdown: QueryPerformanceBreakdown,
    ) {
        // Store response time sample
        {
            let mut response_times = self.response_times.write().await;
            response_times.push(response_time_ms);
            
            // Keep only the last 1000 samples for statistical analysis
            let len = response_times.len();
            if len > 1000 {
                response_times.drain(0..len - 1000);
            }
        }
        
        // Store query breakdown
        let query_key = format!("{}:{}", query, chrono::Utc::now().timestamp());
        self.query_breakdowns.insert(query_key, breakdown);
        
        // Clean old breakdowns (keep only last 100)
        if self.query_breakdowns.len() > 100 {
            let mut keys_to_remove = Vec::new();
            let mut count = 0;
            
            for entry in self.query_breakdowns.iter() {
                if count >= 100 {
                    keys_to_remove.push(entry.key().clone());
                }
                count += 1;
            }
            
            for key in keys_to_remove {
                self.query_breakdowns.remove(&key);
            }
        }
        
        // Check for performance alerts
        self.check_performance_alerts(response_time_ms).await;
        
        debug!("Recorded query performance: {}ms for '{}'", response_time_ms, query);
    }
    
    /// Get comprehensive performance metrics
    pub async fn get_metrics(&self, total_searches: u64, cache_hit_rate: f64, error_rate: f64) -> PerformanceMetrics {
        let response_times = self.response_times.read().await;
        
        let (avg_response_time_ms, percentiles) = if response_times.is_empty() {
            (0.0, ResponseTimePercentiles {
                p50: 0.0,
                p75: 0.0,
                p90: 0.0,
                p95: 0.0,
                p99: 0.0,
            })
        } else {
            let mut sorted_times = response_times.clone();
            sorted_times.sort();
            
            let avg = sorted_times.iter().sum::<u64>() as f64 / sorted_times.len() as f64;
            let len = sorted_times.len();
            
            let percentiles = ResponseTimePercentiles {
                p50: sorted_times[len * 50 / 100] as f64,
                p75: sorted_times[len * 75 / 100] as f64,
                p90: sorted_times[len * 90 / 100] as f64,
                p95: sorted_times[len * 95 / 100] as f64,
                p99: sorted_times[len * 99 / 100] as f64,
            };
            
            (avg, percentiles)
        };
        
        let performance_compliance = if avg_response_time_ms <= self.targets.target_response_time_ms as f64 {
            100.0
        } else {
            (self.targets.target_response_time_ms as f64 / avg_response_time_ms) * 100.0
        };
        
        // Calculate average query performance breakdown
        let query_performance = self.calculate_average_breakdown().await;
        
        PerformanceMetrics {
            avg_response_time_ms,
            target_response_time_ms: self.targets.target_response_time_ms,
            performance_compliance,
            total_searches,
            cache_hit_rate,
            cache_size: 0, // Would be provided by caller
            error_rate,
            is_healthy: performance_compliance >= 80.0 && error_rate <= self.targets.max_error_rate,
            last_optimization: *self.last_optimization.read().await,
            memory_usage_mb: 0, // Would be provided by caller
            response_time_percentiles: percentiles,
            query_performance,
        }
    }
    
    /// Check for performance alerts and triggers
    async fn check_performance_alerts(&self, response_time_ms: u64) {
        if response_time_ms > self.alerts_config.critical_threshold_ms {
            error!(
                "Critical performance alert: Query took {}ms (threshold: {}ms)", 
                response_time_ms, self.alerts_config.critical_threshold_ms
            );
        } else if response_time_ms > self.alerts_config.warning_threshold_ms {
            warn!(
                "Performance warning: Query took {}ms (threshold: {}ms)", 
                response_time_ms, self.alerts_config.warning_threshold_ms
            );
        }
        
        // Check for consecutive slow queries
        let response_times = self.response_times.read().await;
        if response_times.len() >= self.alerts_config.slow_query_threshold {
            let recent_slow_count = response_times
                .iter()
                .rev()
                .take(self.alerts_config.slow_query_threshold)
                .filter(|&&time| time > self.alerts_config.warning_threshold_ms)
                .count();
            
            if recent_slow_count == self.alerts_config.slow_query_threshold {
                warn!(
                    "Detected {} consecutive slow queries - optimization may be needed",
                    recent_slow_count
                );
            }
        }
    }
    
    /// Calculate average query performance breakdown
    async fn calculate_average_breakdown(&self) -> QueryPerformanceBreakdown {
        if self.query_breakdowns.is_empty() {
            return QueryPerformanceBreakdown {
                parsing_ms: 0.0,
                index_search_ms: 0.0,
                provider_search_ms: 0.0,
                result_merging_ms: 0.0,
                caching_ms: 0.0,
            };
        }
        
        let mut total_parsing = 0.0;
        let mut total_index_search = 0.0;
        let mut total_provider_search = 0.0;
        let mut total_result_merging = 0.0;
        let mut total_caching = 0.0;
        let count = self.query_breakdowns.len() as f64;
        
        for entry in self.query_breakdowns.iter() {
            let breakdown = entry.value();
            total_parsing += breakdown.parsing_ms;
            total_index_search += breakdown.index_search_ms;
            total_provider_search += breakdown.provider_search_ms;
            total_result_merging += breakdown.result_merging_ms;
            total_caching += breakdown.caching_ms;
        }
        
        QueryPerformanceBreakdown {
            parsing_ms: total_parsing / count,
            index_search_ms: total_index_search / count,
            provider_search_ms: total_provider_search / count,
            result_merging_ms: total_result_merging / count,
            caching_ms: total_caching / count,
        }
    }
    
    /// Record an optimization event
    pub async fn record_optimization(&self) {
        *self.last_optimization.write().await = Some(chrono::Utc::now());
        info!("Performance optimization completed");
    }
    
    /// Check if optimization is recommended
    pub async fn should_optimize(&self) -> bool {
        let response_times = self.response_times.read().await;
        
        if response_times.len() < 10 {
            return false; // Not enough data
        }
        
        let recent_avg = response_times
            .iter()
            .rev()
            .take(10)
            .sum::<u64>() as f64 / 10.0;
        
        // Recommend optimization if recent queries are consistently slow
        recent_avg > self.targets.target_response_time_ms as f64 * 1.5
    }
    
    /// Get performance health score (0-100)
    pub async fn get_health_score(&self, cache_hit_rate: f64, error_rate: f64) -> f64 {
        let response_times = self.response_times.read().await;
        
        if response_times.is_empty() {
            return 100.0; // Perfect score when no data
        }
        
        let avg_response_time = response_times.iter().sum::<u64>() as f64 / response_times.len() as f64;
        
        // Response time score (0-40 points)
        let response_time_score = if avg_response_time <= self.targets.target_response_time_ms as f64 {
            40.0
        } else {
            40.0 * (self.targets.target_response_time_ms as f64 / avg_response_time).min(1.0)
        };
        
        // Cache hit rate score (0-30 points)
        let cache_score = 30.0 * (cache_hit_rate / self.targets.target_cache_hit_rate).min(1.0);
        
        // Error rate score (0-30 points)
        let error_score = if error_rate <= self.targets.max_error_rate {
            30.0
        } else {
            30.0 * (1.0 - (error_rate - self.targets.max_error_rate) / self.targets.max_error_rate).max(0.0)
        };
        
        response_time_score + cache_score + error_score
    }
}

/// Performance optimization recommendations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceRecommendations {
    /// Whether index optimization is recommended
    pub optimize_index: bool,
    
    /// Whether cache cleanup is recommended
    pub cleanup_cache: bool,
    
    /// Whether memory optimization is recommended
    pub optimize_memory: bool,
    
    /// Specific recommendations
    pub recommendations: Vec<String>,
    
    /// Priority level (1-5, 5 being highest)
    pub priority: u8,
}

impl PerformanceMonitor {
    /// Generate performance optimization recommendations
    pub async fn get_recommendations(&self, metrics: &PerformanceMetrics) -> PerformanceRecommendations {
        let mut recommendations = Vec::new();
        let mut optimize_index = false;
        let mut cleanup_cache = false;
        let mut optimize_memory = false;
        let mut priority = 1;
        
        // Check response time performance
        if metrics.performance_compliance < 80.0 {
            optimize_index = true;
            priority = priority.max(4);
            recommendations.push(format!(
                "Response time {}ms exceeds target {}ms by {:.1}% - consider index optimization",
                metrics.avg_response_time_ms as u64,
                metrics.target_response_time_ms,
                (metrics.avg_response_time_ms / metrics.target_response_time_ms as f64 - 1.0) * 100.0
            ));
        }
        
        // Check cache performance
        if metrics.cache_hit_rate < self.targets.target_cache_hit_rate {
            cleanup_cache = true;
            priority = priority.max(2);
            recommendations.push(format!(
                "Cache hit rate {:.1}% is below target {:.1}% - consider cache tuning",
                metrics.cache_hit_rate * 100.0,
                self.targets.target_cache_hit_rate * 100.0
            ));
        }
        
        // Check memory usage
        if metrics.memory_usage_mb > self.targets.target_memory_usage_mb {
            optimize_memory = true;
            priority = priority.max(3);
            recommendations.push(format!(
                "Memory usage {}MB exceeds target {}MB - consider memory optimization",
                metrics.memory_usage_mb,
                self.targets.target_memory_usage_mb
            ));
        }
        
        // Check error rate
        if metrics.error_rate > self.targets.max_error_rate {
            priority = priority.max(5);
            recommendations.push(format!(
                "Error rate {:.1}% exceeds maximum {:.1}% - investigate failures",
                metrics.error_rate * 100.0,
                self.targets.max_error_rate * 100.0
            ));
        }
        
        // Check specific performance bottlenecks
        if metrics.query_performance.provider_search_ms > 100.0 {
            priority = priority.max(3);
            recommendations.push(format!(
                "Provider searches averaging {:.1}ms - consider provider optimization",
                metrics.query_performance.provider_search_ms
            ));
        }
        
        if recommendations.is_empty() {
            recommendations.push("Performance is within acceptable parameters".to_string());
        }
        
        PerformanceRecommendations {
            optimize_index,
            cleanup_cache,
            optimize_memory,
            recommendations,
            priority,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_performance_monitoring() {
        let monitor = PerformanceMonitor::new(None);
        
        // Record some performance data
        let breakdown = QueryPerformanceBreakdown {
            parsing_ms: 5.0,
            index_search_ms: 150.0,
            provider_search_ms: 50.0,
            result_merging_ms: 20.0,
            caching_ms: 5.0,
        };
        
        monitor.record_query_performance("test query", 230, breakdown).await;
        
        let metrics = monitor.get_metrics(1, 0.8, 0.02).await;
        assert_eq!(metrics.avg_response_time_ms, 230.0);
        assert!(metrics.performance_compliance > 90.0); // Within target
        assert!(metrics.is_healthy);
    }
    
    #[tokio::test]
    async fn test_performance_alerts() {
        let monitor = PerformanceMonitor::new(None);
        
        // Record slow queries
        let breakdown = QueryPerformanceBreakdown {
            parsing_ms: 10.0,
            index_search_ms: 500.0,
            provider_search_ms: 100.0,
            result_merging_ms: 50.0,
            caching_ms: 10.0,
        };
        
        for _ in 0..6 {
            monitor.record_query_performance("slow query", 670, breakdown.clone()).await;
        }
        
        assert!(monitor.should_optimize().await);
    }
    
    #[tokio::test]
    async fn test_health_score() {
        let monitor = PerformanceMonitor::new(None);
        
        // Record good performance
        let breakdown = QueryPerformanceBreakdown {
            parsing_ms: 2.0,
            index_search_ms: 80.0,
            provider_search_ms: 30.0,
            result_merging_ms: 10.0,
            caching_ms: 3.0,
        };
        
        monitor.record_query_performance("fast query", 125, breakdown).await;
        
        let health_score = monitor.get_health_score(0.85, 0.01).await;
        assert!(health_score > 90.0); // Should have high health score
    }
}