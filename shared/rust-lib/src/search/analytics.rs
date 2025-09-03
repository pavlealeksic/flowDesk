//! Search analytics and performance monitoring

use crate::search::{
    SearchQuery, SearchResponse, SearchError, SearchResult as SearchResultType, ContentType,
};
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};
use tracing::{debug, info};

/// Search analytics manager for tracking search performance and usage
pub struct AnalyticsManager {
    /// Whether analytics are enabled
    enabled: bool,
    
    /// Search query history
    query_history: Vec<QueryRecord>,
    
    /// Performance metrics
    performance_metrics: PerformanceMetrics,
    
    /// Usage statistics
    usage_stats: UsageStats,
    
    /// Error tracking
    error_tracking: ErrorTracking,
    
    /// Popular queries cache
    popular_queries: Vec<PopularQuery>,
}

/// Individual query record
#[derive(Debug, Clone, Serialize, Deserialize)]
struct QueryRecord {
    /// Query text
    query: String,
    
    /// Query timestamp
    timestamp: DateTime<Utc>,
    
    /// Execution time in milliseconds
    execution_time_ms: u64,
    
    /// Number of results returned
    result_count: usize,
    
    /// Content types searched
    content_types: Vec<ContentType>,
    
    /// Providers used
    providers: Vec<String>,
    
    /// Whether query was successful
    success: bool,
    
    /// User clicked on results (if tracked)
    click_through: Option<ClickThroughData>,
}

/// Click-through tracking data
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClickThroughData {
    /// Which results were clicked
    clicked_results: Vec<usize>,
    
    /// Time to first click
    time_to_click_ms: Option<u64>,
    
    /// Total interaction time
    interaction_time_ms: u64,
}

/// Performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PerformanceMetrics {
    /// Average response time (ms)
    avg_response_time_ms: f64,
    
    /// 95th percentile response time (ms)
    p95_response_time_ms: f64,
    
    /// 99th percentile response time (ms)
    p99_response_time_ms: f64,
    
    /// Total queries processed
    total_queries: u64,
    
    /// Queries per second (recent)
    queries_per_second: f64,
    
    /// Cache hit rate
    cache_hit_rate: f64,
    
    /// Index efficiency metrics
    index_metrics: IndexMetrics,
}

/// Index performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IndexMetrics {
    /// Average time to add document (ms)
    avg_index_time_ms: f64,
    
    /// Total documents indexed
    total_documents: u64,
    
    /// Index size in bytes
    index_size_bytes: u64,
    
    /// Indexing rate (documents per second)
    indexing_rate: f64,
    
    /// Last optimization time
    last_optimization: Option<DateTime<Utc>>,
}

/// Usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
struct UsageStats {
    /// Most searched content types
    popular_content_types: HashMap<ContentType, u64>,
    
    /// Most used providers
    popular_providers: HashMap<String, u64>,
    
    /// Search patterns by time of day
    hourly_patterns: [u64; 24],
    
    /// Search patterns by day of week
    daily_patterns: [u64; 7],
    
    /// Average query length
    avg_query_length: f64,
    
    /// Zero-result queries count
    zero_result_queries: u64,
}

/// Error tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ErrorTracking {
    /// Total errors
    total_errors: u64,
    
    /// Error rate (0.0 to 1.0)
    error_rate: f64,
    
    /// Errors by category
    error_categories: HashMap<String, u64>,
    
    /// Recent errors
    recent_errors: Vec<ErrorRecord>,
}

/// Error record
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ErrorRecord {
    /// Error message
    message: String,
    
    /// Error category
    category: String,
    
    /// Query that caused the error
    query: Option<String>,
    
    /// Provider that caused the error
    provider: Option<String>,
    
    /// Error timestamp
    timestamp: DateTime<Utc>,
    
    /// Error count (if recurring)
    count: u64,
}

/// Popular query information
#[derive(Debug, Clone, Serialize, Deserialize)]
struct PopularQuery {
    /// Query text
    query: String,
    
    /// Number of times executed
    frequency: u64,
    
    /// Average result count
    avg_results: f32,
    
    /// Average execution time
    avg_execution_time_ms: f64,
    
    /// Last executed
    last_executed: DateTime<Utc>,
    
    /// Click-through rate
    click_through_rate: f64,
}

/// Public analytics data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchAnalytics {
    /// Time period for these analytics
    pub period: AnalyticsPeriod,
    
    /// Performance statistics
    pub performance: PublicPerformanceMetrics,
    
    /// Usage statistics
    pub usage: PublicUsageStats,
    
    /// Popular queries (top N)
    pub popular_queries: Vec<PopularQueryInfo>,
    
    /// Error statistics
    pub errors: PublicErrorStats,
    
    /// Trend data
    pub trends: TrendData,
}

/// Analytics time period
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsPeriod {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

/// Public performance metrics (no internal details)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicPerformanceMetrics {
    pub avg_response_time_ms: f64,
    pub total_queries: u64,
    pub queries_per_second: f64,
    pub cache_hit_rate: f64,
    pub success_rate: f64,
}

/// Public usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicUsageStats {
    pub top_content_types: Vec<ContentTypeUsage>,
    pub top_providers: Vec<ProviderUsage>,
    pub avg_query_length: f64,
    pub zero_result_rate: f64,
    pub peak_usage_hour: u8,
}

/// Content type usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentTypeUsage {
    pub content_type: ContentType,
    pub query_count: u64,
    pub percentage: f64,
}

/// Provider usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderUsage {
    pub provider_id: String,
    pub query_count: u64,
    pub avg_response_time_ms: f64,
    pub success_rate: f64,
}

/// Popular query information (public)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopularQueryInfo {
    pub query: String,
    pub frequency: u64,
    pub avg_results: f32,
    pub click_through_rate: f64,
}

/// Public error statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicErrorStats {
    pub total_errors: u64,
    pub error_rate: f64,
    pub top_error_categories: Vec<ErrorCategoryStats>,
}

/// Error category statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorCategoryStats {
    pub category: String,
    pub count: u64,
    pub percentage: f64,
}

/// Trend data for analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendData {
    /// Query volume trend (hourly over last week)
    pub query_volume: Vec<TrendPoint>,
    
    /// Response time trend
    pub response_time: Vec<TrendPoint>,
    
    /// Error rate trend
    pub error_rate: Vec<TrendPoint>,
}

/// Individual trend data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            avg_response_time_ms: 0.0,
            p95_response_time_ms: 0.0,
            p99_response_time_ms: 0.0,
            total_queries: 0,
            queries_per_second: 0.0,
            cache_hit_rate: 0.0,
            index_metrics: IndexMetrics::default(),
        }
    }
}

impl Default for IndexMetrics {
    fn default() -> Self {
        Self {
            avg_index_time_ms: 0.0,
            total_documents: 0,
            index_size_bytes: 0,
            indexing_rate: 0.0,
            last_optimization: None,
        }
    }
}

impl Default for UsageStats {
    fn default() -> Self {
        Self {
            popular_content_types: HashMap::new(),
            popular_providers: HashMap::new(),
            hourly_patterns: [0; 24],
            daily_patterns: [0; 7],
            avg_query_length: 0.0,
            zero_result_queries: 0,
        }
    }
}

impl Default for ErrorTracking {
    fn default() -> Self {
        Self {
            total_errors: 0,
            error_rate: 0.0,
            error_categories: HashMap::new(),
            recent_errors: Vec::new(),
        }
    }
}

impl AnalyticsManager {
    /// Create a new analytics manager
    pub fn new(enabled: bool) -> SearchResultType<Self> {
        Ok(Self {
            enabled,
            query_history: Vec::new(),
            performance_metrics: PerformanceMetrics::default(),
            usage_stats: UsageStats::default(),
            error_tracking: ErrorTracking::default(),
            popular_queries: Vec::new(),
        })
    }
    
    /// Record a search query execution
    pub async fn record_search(
        &mut self,
        query: &SearchQuery,
        response: &SearchResponse,
        execution_time_ms: u64,
    ) {
        if !self.enabled {
            return;
        }
        
        debug!("Recording search analytics for query: {}", query.query);
        
        // Create query record
        let record = QueryRecord {
            query: query.query.clone(),
            timestamp: Utc::now(),
            execution_time_ms,
            result_count: response.results.len(),
            content_types: query.content_types.clone().unwrap_or_default(),
            providers: query.provider_ids.clone().unwrap_or_default(),
            success: true,
            click_through: None,
        };
        
        // Add to history
        self.query_history.push(record);
        
        // Update performance metrics
        self.update_performance_metrics(execution_time_ms, true);
        
        // Update usage statistics
        self.update_usage_stats(query, response);
        
        // Update popular queries
        self.update_popular_queries(&query.query, response.results.len(), execution_time_ms);
        
        // Cleanup old records periodically
        if self.query_history.len() > 10000 {
            self.cleanup_old_records().await;
        }
    }
    
    /// Record a search error
    pub async fn record_error(&mut self, query: &SearchQuery, error: &SearchError) {
        if !self.enabled {
            return;
        }
        
        debug!("Recording search error: {}", error);
        
        // Create error record
        let error_record = ErrorRecord {
            message: error.to_string(),
            category: error.category().to_string(),
            query: Some(query.query.clone()),
            provider: None, // Would extract from error context in real implementation
            timestamp: Utc::now(),
            count: 1,
        };
        
        // Update error tracking
        self.error_tracking.total_errors += 1;
        *self.error_tracking.error_categories.entry(error.category().to_string()).or_insert(0) += 1;
        
        // Add to recent errors (keep last 100)
        self.error_tracking.recent_errors.push(error_record);
        if self.error_tracking.recent_errors.len() > 100 {
            self.error_tracking.recent_errors.remove(0);
        }
        
        // Update error rate
        let total_operations = self.performance_metrics.total_queries + self.error_tracking.total_errors;
        self.error_tracking.error_rate = self.error_tracking.total_errors as f64 / total_operations as f64;
        
        // Update performance metrics
        self.update_performance_metrics(0, false);
    }
    
    /// Get analytics for a specific time period
    pub async fn get_analytics(&self) -> SearchResultType<SearchAnalytics> {
        if !self.enabled {
            return Ok(SearchAnalytics {
                period: AnalyticsPeriod {
                    start: Utc::now() - Duration::days(1),
                    end: Utc::now(),
                },
                performance: PublicPerformanceMetrics {
                    avg_response_time_ms: 0.0,
                    total_queries: 0,
                    queries_per_second: 0.0,
                    cache_hit_rate: 0.0,
                    success_rate: 1.0,
                },
                usage: PublicUsageStats {
                    top_content_types: Vec::new(),
                    top_providers: Vec::new(),
                    avg_query_length: 0.0,
                    zero_result_rate: 0.0,
                    peak_usage_hour: 12,
                },
                popular_queries: Vec::new(),
                errors: PublicErrorStats {
                    total_errors: 0,
                    error_rate: 0.0,
                    top_error_categories: Vec::new(),
                },
                trends: TrendData {
                    query_volume: Vec::new(),
                    response_time: Vec::new(),
                    error_rate: Vec::new(),
                },
            });
        }
        
        info!("Generating search analytics report");
        
        let end_time = Utc::now();
        let start_time = end_time - Duration::days(7); // Last week
        
        // Filter records for the time period
        let period_records: Vec<&QueryRecord> = self.query_history
            .iter()
            .filter(|record| record.timestamp >= start_time && record.timestamp <= end_time)
            .collect();
        
        // Generate performance metrics
        let performance = self.generate_performance_metrics(&period_records);
        
        // Generate usage statistics
        let usage = self.generate_usage_stats(&period_records);
        
        // Generate popular queries
        let popular_queries = self.generate_popular_queries(&period_records);
        
        // Generate error statistics
        let errors = self.generate_error_stats();
        
        // Generate trend data
        let trends = self.generate_trend_data(&period_records, start_time, end_time);
        
        Ok(SearchAnalytics {
            period: AnalyticsPeriod {
                start: start_time,
                end: end_time,
            },
            performance,
            usage,
            popular_queries,
            errors,
            trends,
        })
    }
    
    /// Update performance metrics
    fn update_performance_metrics(&mut self, execution_time_ms: u64, success: bool) {
        if success {
            let total_queries = self.performance_metrics.total_queries + 1;
            let total_time = self.performance_metrics.avg_response_time_ms * self.performance_metrics.total_queries as f64;
            
            self.performance_metrics.avg_response_time_ms = 
                (total_time + execution_time_ms as f64) / total_queries as f64;
            
            self.performance_metrics.total_queries = total_queries;
        }
    }
    
    /// Update usage statistics
    fn update_usage_stats(&mut self, query: &SearchQuery, response: &SearchResponse) {
        // Update content type popularity
        if let Some(content_types) = &query.content_types {
            for content_type in content_types {
                *self.usage_stats.popular_content_types.entry(content_type.clone()).or_insert(0) += 1;
            }
        }
        
        // Update provider popularity
        if let Some(providers) = &query.provider_ids {
            for provider in providers {
                *self.usage_stats.popular_providers.entry(provider.clone()).or_insert(0) += 1;
            }
        }
        
        // Update hourly patterns
        let hour = Utc::now().format("%H").to_string().parse::<usize>().unwrap_or(0);
        if hour < 24 {
            self.usage_stats.hourly_patterns[hour] += 1;
        }
        
        // Update daily patterns
        let day = Utc::now().format("%w").to_string().parse::<usize>().unwrap_or(0);
        if day < 7 {
            self.usage_stats.daily_patterns[day] += 1;
        }
        
        // Update average query length
        let query_length = query.query.len() as f64;
        let total_queries = self.performance_metrics.total_queries as f64;
        self.usage_stats.avg_query_length = 
            (self.usage_stats.avg_query_length * (total_queries - 1.0) + query_length) / total_queries;
        
        // Update zero result queries
        if response.results.is_empty() {
            self.usage_stats.zero_result_queries += 1;
        }
    }
    
    /// Update popular queries
    fn update_popular_queries(&mut self, query_text: &str, result_count: usize, execution_time_ms: u64) {
        // Find existing query or create new one
        if let Some(popular_query) = self.popular_queries.iter_mut().find(|q| q.query == query_text) {
            popular_query.frequency += 1;
            popular_query.avg_results = 
                (popular_query.avg_results * (popular_query.frequency - 1) as f32 + result_count as f32) 
                / popular_query.frequency as f32;
            popular_query.avg_execution_time_ms = 
                (popular_query.avg_execution_time_ms * (popular_query.frequency - 1) as f64 + execution_time_ms as f64) 
                / popular_query.frequency as f64;
            popular_query.last_executed = Utc::now();
        } else {
            self.popular_queries.push(PopularQuery {
                query: query_text.to_string(),
                frequency: 1,
                avg_results: result_count as f32,
                avg_execution_time_ms: execution_time_ms as f64,
                last_executed: Utc::now(),
                click_through_rate: 0.0,
            });
        }
        
        // Sort and keep top 100
        self.popular_queries.sort_by(|a, b| b.frequency.cmp(&a.frequency));
        self.popular_queries.truncate(100);
    }
    
    /// Generate performance metrics for analytics
    fn generate_performance_metrics(&self, records: &[&QueryRecord]) -> PublicPerformanceMetrics {
        if records.is_empty() {
            return PublicPerformanceMetrics {
                avg_response_time_ms: 0.0,
                total_queries: 0,
                queries_per_second: 0.0,
                cache_hit_rate: 0.0,
                success_rate: 1.0,
            };
        }
        
        let successful_records: Vec<&&QueryRecord> = records.iter().filter(|r| r.success).collect();
        let total_time: u64 = successful_records.iter().map(|r| r.execution_time_ms).sum();
        let avg_response_time = total_time as f64 / successful_records.len() as f64;
        
        // Calculate queries per second (approximate)
        let time_span = records.last().unwrap().timestamp - records.first().unwrap().timestamp;
        let queries_per_second = records.len() as f64 / time_span.num_seconds() as f64;
        
        let success_rate = successful_records.len() as f64 / records.len() as f64;
        
        PublicPerformanceMetrics {
            avg_response_time_ms: avg_response_time,
            total_queries: records.len() as u64,
            queries_per_second,
            cache_hit_rate: self.performance_metrics.cache_hit_rate,
            success_rate,
        }
    }
    
    /// Generate usage statistics for analytics
    fn generate_usage_stats(&self, records: &[&QueryRecord]) -> PublicUsageStats {
        let mut content_type_counts = HashMap::new();
        let mut provider_counts = HashMap::new();
        let mut total_query_length = 0;
        let mut zero_result_count = 0;
        
        for record in records {
            // Count content types
            for content_type in &record.content_types {
                *content_type_counts.entry(content_type.clone()).or_insert(0) += 1;
            }
            
            // Count providers
            for provider in &record.providers {
                *provider_counts.entry(provider.clone()).or_insert(0) += 1;
            }
            
            // Track query length
            total_query_length += record.query.len();
            
            // Track zero results
            if record.result_count == 0 {
                zero_result_count += 1;
            }
        }
        
        // Convert to sorted vectors
        let mut top_content_types: Vec<ContentTypeUsage> = content_type_counts
            .into_iter()
            .map(|(content_type, count)| ContentTypeUsage {
                content_type,
                query_count: count,
                percentage: count as f64 / records.len() as f64 * 100.0,
            })
            .collect();
        top_content_types.sort_by(|a, b| b.query_count.cmp(&a.query_count));
        top_content_types.truncate(5);
        
        let top_providers: Vec<ProviderUsage> = provider_counts
            .into_iter()
            .map(|(provider_id, count)| ProviderUsage {
                provider_id,
                query_count: count,
                avg_response_time_ms: 0.0, // Would calculate from records
                success_rate: 1.0, // Would calculate from records
            })
            .collect();
        
        // Find peak usage hour
        let peak_usage_hour = self.usage_stats.hourly_patterns
            .iter()
            .enumerate()
            .max_by_key(|(_, &count)| count)
            .map(|(hour, _)| hour as u8)
            .unwrap_or(12);
        
        PublicUsageStats {
            top_content_types,
            top_providers,
            avg_query_length: if records.is_empty() { 0.0 } else { total_query_length as f64 / records.len() as f64 },
            zero_result_rate: zero_result_count as f64 / records.len() as f64,
            peak_usage_hour,
        }
    }
    
    /// Generate popular queries for analytics
    fn generate_popular_queries(&self, _records: &[&QueryRecord]) -> Vec<PopularQueryInfo> {
        self.popular_queries
            .iter()
            .take(10)
            .map(|q| PopularQueryInfo {
                query: q.query.clone(),
                frequency: q.frequency,
                avg_results: q.avg_results,
                click_through_rate: q.click_through_rate,
            })
            .collect()
    }
    
    /// Generate error statistics for analytics
    fn generate_error_stats(&self) -> PublicErrorStats {
        let total_categories: u64 = self.error_tracking.error_categories.values().sum();
        
        let mut top_error_categories: Vec<ErrorCategoryStats> = self.error_tracking.error_categories
            .iter()
            .map(|(category, count)| ErrorCategoryStats {
                category: category.clone(),
                count: *count,
                percentage: *count as f64 / total_categories as f64 * 100.0,
            })
            .collect();
        
        top_error_categories.sort_by(|a, b| b.count.cmp(&a.count));
        top_error_categories.truncate(5);
        
        PublicErrorStats {
            total_errors: self.error_tracking.total_errors,
            error_rate: self.error_tracking.error_rate,
            top_error_categories,
        }
    }
    
    /// Generate trend data for analytics
    fn generate_trend_data(
        &self,
        records: &[&QueryRecord],
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
    ) -> TrendData {
        // Create hourly buckets
        let duration = end_time - start_time;
        let hours = duration.num_hours() as usize;
        let mut query_volume = vec![0; hours];
        let mut response_times = vec![Vec::new(); hours];
        
        for record in records {
            let hour_index = ((record.timestamp - start_time).num_hours() as usize).min(hours - 1);
            query_volume[hour_index] += 1;
            if record.success {
                response_times[hour_index].push(record.execution_time_ms as f64);
            }
        }
        
        // Convert to trend points
        let query_volume_trend: Vec<TrendPoint> = query_volume
            .into_iter()
            .enumerate()
            .map(|(hour, count)| TrendPoint {
                timestamp: start_time + Duration::hours(hour as i64),
                value: count as f64,
            })
            .collect();
        
        let response_time_trend: Vec<TrendPoint> = response_times
            .into_iter()
            .enumerate()
            .map(|(hour, times)| {
                let avg_time = if times.is_empty() { 
                    0.0 
                } else { 
                    times.iter().sum::<f64>() / times.len() as f64 
                };
                TrendPoint {
                    timestamp: start_time + Duration::hours(hour as i64),
                    value: avg_time,
                }
            })
            .collect();
        
        TrendData {
            query_volume: query_volume_trend,
            response_time: response_time_trend,
            error_rate: Vec::new(), // Would implement error rate trend
        }
    }
    
    /// Clean up old records to prevent memory growth
    async fn cleanup_old_records(&mut self) {
        let cutoff_time = Utc::now() - Duration::days(30);
        
        // Remove old query records
        self.query_history.retain(|record| record.timestamp > cutoff_time);
        
        // Remove old error records
        self.error_tracking.recent_errors.retain(|error| error.timestamp > cutoff_time);
        
        debug!("Cleaned up old analytics records");
    }
}