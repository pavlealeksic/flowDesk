//! Comprehensive performance testing suite for the search system

use crate::search::{
    UnifiedSearchService, SearchIntegrationConfig, SearchQuery, SearchDocument,
    SearchOptions, ContentType, ProviderType, PerformanceMetrics, SearchError,
    SearchResult as SearchResultType,
};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Semaphore;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;
use tracing::{info, warn, error, debug, instrument};

/// Performance testing suite for search operations
pub struct SearchPerformanceTester {
    /// Search service under test
    search_service: Arc<UnifiedSearchService>,
    
    /// Test configuration
    config: PerformanceTestConfig,
    
    /// Test data generator
    data_generator: TestDataGenerator,
    
    /// Results collector
    results_collector: Arc<tokio::sync::Mutex<PerformanceResults>>,
}

/// Performance test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceTestConfig {
    /// Target response time (ms)
    pub target_response_time_ms: u64,
    
    /// Stress test configuration
    pub stress_test: StressTestConfig,
    
    /// Load test configuration
    pub load_test: LoadTestConfig,
    
    /// Benchmark test configuration
    pub benchmark_test: BenchmarkTestConfig,
    
    /// Data size tests
    pub data_size_tests: Vec<DataSizeTestConfig>,
    
    /// Concurrent query tests
    pub concurrency_tests: Vec<ConcurrencyTestConfig>,
    
    /// Memory usage limits
    pub memory_limits: MemoryTestConfig,
    
    /// Enable detailed profiling
    pub enable_profiling: bool,
    
    /// Test timeout (seconds)
    pub test_timeout_secs: u64,
}

/// Stress test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressTestConfig {
    /// Number of queries to execute
    pub total_queries: usize,
    
    /// Maximum concurrent queries
    pub max_concurrent: usize,
    
    /// Duration of stress test (seconds)
    pub duration_secs: u64,
    
    /// Query complexity levels to test
    pub complexity_levels: Vec<QueryComplexity>,
    
    /// Ramp-up period (seconds)
    pub ramp_up_secs: u64,
}

/// Load test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTestConfig {
    /// Queries per second to maintain
    pub target_qps: f64,
    
    /// Test duration (seconds)
    pub duration_secs: u64,
    
    /// Acceptable success rate (0.0 to 1.0)
    pub min_success_rate: f64,
    
    /// Query mix by complexity
    pub query_mix: HashMap<QueryComplexity, f64>,
}

/// Benchmark test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkTestConfig {
    /// Standard benchmark queries
    pub benchmark_queries: Vec<BenchmarkQuery>,
    
    /// Number of iterations per benchmark
    pub iterations_per_benchmark: usize,
    
    /// Warm-up iterations
    pub warmup_iterations: usize,
    
    /// Compare against baseline
    pub baseline_comparison: Option<String>,
}

/// Individual benchmark query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkQuery {
    /// Query name
    pub name: String,
    
    /// Query text
    pub query: String,
    
    /// Expected response time (ms)
    pub expected_response_time_ms: u64,
    
    /// Minimum expected results
    pub min_results: usize,
    
    /// Query complexity
    pub complexity: QueryComplexity,
}

/// Data size test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSizeTestConfig {
    /// Number of documents to index
    pub document_count: usize,
    
    /// Average document size (bytes)
    pub avg_document_size: usize,
    
    /// Document variety (different content types)
    pub content_type_variety: usize,
    
    /// Test search performance at this scale
    pub test_search_performance: bool,
}

/// Concurrency test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcurrencyTestConfig {
    /// Number of concurrent users
    pub concurrent_users: usize,
    
    /// Queries per user
    pub queries_per_user: usize,
    
    /// Think time between queries (ms)
    pub think_time_ms: u64,
    
    /// Test duration (seconds)
    pub duration_secs: u64,
}

/// Memory test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryTestConfig {
    /// Maximum memory usage (MB)
    pub max_memory_mb: u64,
    
    /// Memory leak detection enabled
    pub detect_memory_leaks: bool,
    
    /// Memory sampling interval (seconds)
    pub sampling_interval_secs: u64,
}

/// Query complexity levels
#[derive(Debug, Clone, Serialize, Deserialize, Hash, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum QueryComplexity {
    Simple,        // Single term
    Medium,        // 2-3 terms, basic filters
    Complex,       // Multiple terms, multiple filters, facets
    Advanced,      // Field queries, boolean logic, ranges
    Extreme,       // Everything enabled, complex expressions
}

/// Test data generator for creating realistic test datasets
pub struct TestDataGenerator {
    /// Sample content patterns
    content_patterns: Vec<ContentPattern>,
    
    /// Provider distributions
    provider_distribution: HashMap<ProviderType, f64>,
    
    /// Content type distributions
    content_type_distribution: HashMap<ContentType, f64>,
}

/// Content pattern for generating realistic documents
#[derive(Debug, Clone)]
pub struct ContentPattern {
    /// Pattern name
    pub name: String,
    
    /// Content type
    pub content_type: ContentType,
    
    /// Title templates
    pub title_templates: Vec<String>,
    
    /// Content templates
    pub content_templates: Vec<String>,
    
    /// Common keywords
    pub keywords: Vec<String>,
    
    /// Average content length
    pub avg_content_length: usize,
}

/// Performance test results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceResults {
    /// Test start time
    pub test_started_at: DateTime<Utc>,
    
    /// Test completion time
    pub test_completed_at: Option<DateTime<Utc>>,
    
    /// Overall test status
    pub status: TestStatus,
    
    /// Stress test results
    pub stress_test_results: Option<StressTestResults>,
    
    /// Load test results
    pub load_test_results: Option<LoadTestResults>,
    
    /// Benchmark results
    pub benchmark_results: Vec<BenchmarkResult>,
    
    /// Data size test results
    pub data_size_results: Vec<DataSizeResult>,
    
    /// Concurrency test results
    pub concurrency_results: Vec<ConcurrencyResult>,
    
    /// Memory usage results
    pub memory_results: Option<MemoryUsageResults>,
    
    /// Performance summary
    pub summary: PerformanceSummary,
}

/// Test execution status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TestStatus {
    Running,
    Completed,
    Failed,
    Timeout,
    Cancelled,
}

/// Stress test results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressTestResults {
    /// Total queries executed
    pub total_queries: usize,
    
    /// Successful queries
    pub successful_queries: usize,
    
    /// Failed queries
    pub failed_queries: usize,
    
    /// Average response time (ms)
    pub avg_response_time_ms: f64,
    
    /// Response time percentiles
    pub response_time_percentiles: ResponseTimePercentiles,
    
    /// Throughput (queries per second)
    pub throughput_qps: f64,
    
    /// Error rate
    pub error_rate: f64,
    
    /// Peak concurrent queries
    pub peak_concurrent_queries: usize,
    
    /// Memory usage during test
    pub memory_usage: MemoryUsageSnapshot,
}

/// Load test results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadTestResults {
    /// Target QPS
    pub target_qps: f64,
    
    /// Achieved QPS
    pub achieved_qps: f64,
    
    /// Success rate
    pub success_rate: f64,
    
    /// Average response time
    pub avg_response_time_ms: f64,
    
    /// Response time under load percentiles
    pub response_time_percentiles: ResponseTimePercentiles,
    
    /// Load sustainability (0.0 to 1.0)
    pub sustainability_score: f64,
    
    /// Performance degradation over time
    pub degradation_trend: Vec<PerformanceDataPoint>,
}

/// Benchmark test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    /// Benchmark name
    pub benchmark_name: String,
    
    /// Average response time (ms)
    pub avg_response_time_ms: f64,
    
    /// Standard deviation
    pub std_deviation_ms: f64,
    
    /// Minimum response time
    pub min_response_time_ms: u64,
    
    /// Maximum response time
    pub max_response_time_ms: u64,
    
    /// Target response time
    pub target_response_time_ms: u64,
    
    /// Whether target was met
    pub target_met: bool,
    
    /// Results count consistency
    pub results_consistency: f64,
    
    /// Baseline comparison (if available)
    pub baseline_comparison: Option<BaselineComparison>,
}

/// Data size test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSizeResult {
    /// Document count tested
    pub document_count: usize,
    
    /// Index size (MB)
    pub index_size_mb: f64,
    
    /// Indexing time (seconds)
    pub indexing_time_secs: f64,
    
    /// Search performance at this scale
    pub search_performance: SearchPerformanceAtScale,
    
    /// Memory usage
    pub memory_usage_mb: f64,
}

/// Concurrency test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcurrencyResult {
    /// Number of concurrent users
    pub concurrent_users: usize,
    
    /// Total queries executed
    pub total_queries: usize,
    
    /// Average response time under load
    pub avg_response_time_ms: f64,
    
    /// Throughput achieved
    pub throughput_qps: f64,
    
    /// Error rate
    pub error_rate: f64,
    
    /// Resource utilization
    pub resource_utilization: ResourceUtilization,
}

/// Memory usage test results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryUsageResults {
    /// Peak memory usage (MB)
    pub peak_memory_mb: f64,
    
    /// Average memory usage (MB)
    pub avg_memory_mb: f64,
    
    /// Memory usage over time
    pub memory_timeline: Vec<MemoryDataPoint>,
    
    /// Memory leaks detected
    pub memory_leaks_detected: bool,
    
    /// Garbage collection impact
    pub gc_impact: GCImpactAnalysis,
}

/// Response time percentiles
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseTimePercentiles {
    pub p50: f64,
    pub p75: f64,
    pub p90: f64,
    pub p95: f64,
    pub p99: f64,
    pub p99_9: f64,
}

/// Memory usage snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryUsageSnapshot {
    /// Total memory used (MB)
    pub total_mb: f64,
    
    /// Memory usage breakdown
    pub breakdown: MemoryBreakdown,
    
    /// Timestamp
    pub timestamp: DateTime<Utc>,
}

/// Memory usage breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryBreakdown {
    /// Index memory
    pub index_mb: f64,
    
    /// Cache memory
    pub cache_mb: f64,
    
    /// Provider memory
    pub provider_mb: f64,
    
    /// Other memory
    pub other_mb: f64,
}

/// Performance data point for trend analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceDataPoint {
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Response time (ms)
    pub response_time_ms: f64,
    
    /// Throughput (QPS)
    pub throughput_qps: f64,
    
    /// Error rate
    pub error_rate: f64,
    
    /// Memory usage (MB)
    pub memory_usage_mb: f64,
}

/// Search performance at different scales
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPerformanceAtScale {
    /// Simple query performance
    pub simple_query_ms: f64,
    
    /// Complex query performance
    pub complex_query_ms: f64,
    
    /// Faceted query performance
    pub faceted_query_ms: f64,
    
    /// Performance degradation factor
    pub degradation_factor: f64,
}

/// Resource utilization metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUtilization {
    /// CPU utilization (0.0 to 1.0)
    pub cpu_utilization: f64,
    
    /// Memory utilization (0.0 to 1.0)
    pub memory_utilization: f64,
    
    /// I/O utilization
    pub io_utilization: f64,
}

/// Memory data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryDataPoint {
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Memory usage (MB)
    pub memory_mb: f64,
    
    /// Memory growth rate (MB/min)
    pub growth_rate: f64,
}

/// Garbage collection impact analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCImpactAnalysis {
    /// GC pause time impact on search (ms)
    pub avg_gc_pause_impact_ms: f64,
    
    /// GC frequency during search
    pub gc_frequency_per_minute: f64,
    
    /// Memory reclaimed per GC (MB)
    pub avg_memory_reclaimed_mb: f64,
}

/// Baseline comparison results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineComparison {
    /// Baseline response time
    pub baseline_response_time_ms: f64,
    
    /// Current response time
    pub current_response_time_ms: f64,
    
    /// Performance change (positive = improvement)
    pub performance_change_percent: f64,
    
    /// Significant change detected
    pub significant_change: bool,
}

/// Performance test summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSummary {
    /// Overall performance grade (A-F)
    pub overall_grade: PerformanceGrade,
    
    /// Target response time achievement
    pub target_response_time_met: bool,
    
    /// Performance bottlenecks identified
    pub bottlenecks: Vec<PerformanceBottleneck>,
    
    /// Recommendations for improvement
    pub recommendations: Vec<String>,
    
    /// Critical issues found
    pub critical_issues: Vec<String>,
    
    /// Test conclusion
    pub conclusion: String,
}

/// Performance grade
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum PerformanceGrade {
    A, // Excellent (< 200ms avg)
    B, // Good (< 300ms avg)
    C, // Acceptable (< 500ms avg)
    D, // Poor (< 1000ms avg)
    F, // Failing (>= 1000ms avg)
}

/// Performance bottleneck identification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceBottleneck {
    /// Component affected
    pub component: String,
    
    /// Bottleneck type
    pub bottleneck_type: BottleneckType,
    
    /// Severity (1-5)
    pub severity: u8,
    
    /// Description
    pub description: String,
    
    /// Suggested remediation
    pub remediation: String,
}

/// Types of performance bottlenecks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BottleneckType {
    CPU,
    Memory,
    IO,
    Network,
    IndexSize,
    QueryComplexity,
    CacheEfficiency,
    Concurrency,
}

impl Default for PerformanceTestConfig {
    fn default() -> Self {
        Self {
            target_response_time_ms: 300,
            stress_test: StressTestConfig {
                total_queries: 10000,
                max_concurrent: 50,
                duration_secs: 300,
                complexity_levels: vec![
                    QueryComplexity::Simple,
                    QueryComplexity::Medium,
                    QueryComplexity::Complex,
                ],
                ramp_up_secs: 30,
            },
            load_test: LoadTestConfig {
                target_qps: 10.0,
                duration_secs: 300,
                min_success_rate: 0.99,
                query_mix: {
                    let mut mix = HashMap::new();
                    mix.insert(QueryComplexity::Simple, 0.4);
                    mix.insert(QueryComplexity::Medium, 0.4);
                    mix.insert(QueryComplexity::Complex, 0.2);
                    mix
                },
            },
            benchmark_test: BenchmarkTestConfig {
                benchmark_queries: vec![
                    BenchmarkQuery {
                        name: "simple_term".to_string(),
                        query: "meeting".to_string(),
                        expected_response_time_ms: 100,
                        min_results: 1,
                        complexity: QueryComplexity::Simple,
                    },
                    BenchmarkQuery {
                        name: "multi_term".to_string(),
                        query: "project status update".to_string(),
                        expected_response_time_ms: 150,
                        min_results: 1,
                        complexity: QueryComplexity::Medium,
                    },
                    BenchmarkQuery {
                        name: "complex_filtered".to_string(),
                        query: "urgent email from:john@company.com".to_string(),
                        expected_response_time_ms: 250,
                        min_results: 0,
                        complexity: QueryComplexity::Complex,
                    },
                ],
                iterations_per_benchmark: 100,
                warmup_iterations: 10,
                baseline_comparison: None,
            },
            data_size_tests: vec![
                DataSizeTestConfig {
                    document_count: 1000,
                    avg_document_size: 2048,
                    content_type_variety: 5,
                    test_search_performance: true,
                },
                DataSizeTestConfig {
                    document_count: 10000,
                    avg_document_size: 2048,
                    content_type_variety: 5,
                    test_search_performance: true,
                },
                DataSizeTestConfig {
                    document_count: 100000,
                    avg_document_size: 2048,
                    content_type_variety: 5,
                    test_search_performance: true,
                },
            ],
            concurrency_tests: vec![
                ConcurrencyTestConfig {
                    concurrent_users: 1,
                    queries_per_user: 100,
                    think_time_ms: 100,
                    duration_secs: 60,
                },
                ConcurrencyTestConfig {
                    concurrent_users: 10,
                    queries_per_user: 50,
                    think_time_ms: 200,
                    duration_secs: 60,
                },
                ConcurrencyTestConfig {
                    concurrent_users: 50,
                    queries_per_user: 20,
                    think_time_ms: 500,
                    duration_secs: 60,
                },
            ],
            memory_limits: MemoryTestConfig {
                max_memory_mb: 1024,
                detect_memory_leaks: true,
                sampling_interval_secs: 5,
            },
            enable_profiling: false,
            test_timeout_secs: 1800, // 30 minutes
        }
    }
}

impl SearchPerformanceTester {
    /// Create new performance tester
    pub async fn new(
        search_service: Arc<UnifiedSearchService>,
        config: PerformanceTestConfig,
    ) -> Self {
        let data_generator = TestDataGenerator::new();
        let results_collector = Arc::new(tokio::sync::Mutex::new(PerformanceResults {
            test_started_at: Utc::now(),
            test_completed_at: None,
            status: TestStatus::Running,
            stress_test_results: None,
            load_test_results: None,
            benchmark_results: Vec::new(),
            data_size_results: Vec::new(),
            concurrency_results: Vec::new(),
            memory_results: None,
            summary: PerformanceSummary {
                overall_grade: PerformanceGrade::C,
                target_response_time_met: false,
                bottlenecks: Vec::new(),
                recommendations: Vec::new(),
                critical_issues: Vec::new(),
                conclusion: "Test in progress".to_string(),
            },
        }));
        
        Self {
            search_service,
            config,
            data_generator,
            results_collector,
        }
    }
    
    /// Run complete performance test suite
    #[instrument(skip(self))]
    pub async fn run_complete_test_suite(&self) -> SearchResultType<PerformanceResults> {
        info!("Starting comprehensive performance test suite");
        
        let start_time = Instant::now();
        
        // Run benchmark tests first
        info!("Running benchmark tests...");
        self.run_benchmark_tests().await?;
        
        // Run data size scalability tests
        info!("Running data size scalability tests...");
        self.run_data_size_tests().await?;
        
        // Run concurrency tests
        info!("Running concurrency tests...");
        self.run_concurrency_tests().await?;
        
        // Run stress tests
        info!("Running stress tests...");
        self.run_stress_test().await?;
        
        // Run load tests
        info!("Running load tests...");
        self.run_load_test().await?;
        
        // Analyze results and generate summary
        info!("Analyzing results and generating summary...");
        self.analyze_and_summarize().await?;
        
        let total_duration = start_time.elapsed();
        info!("Performance test suite completed in {:.2}s", total_duration.as_secs_f64());
        
        // Finalize results
        {
            let mut results = self.results_collector.lock().await;
            results.test_completed_at = Some(Utc::now());
            results.status = TestStatus::Completed;
        }
        
        Ok(self.results_collector.lock().await.clone())
    }
    
    /// Run benchmark tests
    #[instrument(skip(self))]
    async fn run_benchmark_tests(&self) -> SearchResultType<()> {
        let benchmark_config = &self.config.benchmark_test;
        let mut benchmark_results = Vec::new();
        
        for benchmark in &benchmark_config.benchmark_queries {
            info!("Running benchmark: {}", benchmark.name);
            
            // Warmup iterations
            for _ in 0..benchmark_config.warmup_iterations {
                let query = self.create_test_query(&benchmark.query, &benchmark.complexity);
                let _ = self.search_service.unified_search(query, None).await;
            }
            
            // Actual benchmark iterations
            let mut response_times = Vec::new();
            let mut results_counts = Vec::new();
            
            for _ in 0..benchmark_config.iterations_per_benchmark {
                let query = self.create_test_query(&benchmark.query, &benchmark.complexity);
                let start = Instant::now();
                
                match self.search_service.unified_search(query, None).await {
                    Ok(response) => {
                        let response_time = start.elapsed().as_millis() as u64;
                        response_times.push(response_time);
                        results_counts.push(response.results.len());
                    }
                    Err(e) => {
                        error!("Benchmark query failed: {}", e);
                        response_times.push(u64::MAX); // Mark as failed
                        results_counts.push(0);
                    }
                }
            }
            
            // Calculate statistics
            let valid_times: Vec<u64> = response_times.iter().filter(|&&t| t != u64::MAX).copied().collect();
            let avg_response_time = if valid_times.is_empty() {
                0.0
            } else {
                valid_times.iter().sum::<u64>() as f64 / valid_times.len() as f64
            };
            
            let std_deviation = if valid_times.len() > 1 {
                let mean = avg_response_time;
                let variance = valid_times.iter()
                    .map(|&x| (x as f64 - mean).powi(2))
                    .sum::<f64>() / (valid_times.len() - 1) as f64;
                variance.sqrt()
            } else {
                0.0
            };
            
            let min_response_time = valid_times.iter().min().copied().unwrap_or(0);
            let max_response_time = valid_times.iter().max().copied().unwrap_or(0);
            let target_met = avg_response_time <= benchmark.expected_response_time_ms as f64;
            
            // Calculate results consistency
            let avg_results = results_counts.iter().sum::<usize>() as f64 / results_counts.len() as f64;
            let results_consistency = if avg_results > 0.0 {
                1.0 - (results_counts.iter().map(|&x| (x as f64 - avg_results).abs()).sum::<f64>() / (avg_results * results_counts.len() as f64))
            } else {
                0.0
            };
            
            benchmark_results.push(BenchmarkResult {
                benchmark_name: benchmark.name.clone(),
                avg_response_time_ms: avg_response_time,
                std_deviation_ms: std_deviation,
                min_response_time_ms: min_response_time,
                max_response_time_ms: max_response_time,
                target_response_time_ms: benchmark.expected_response_time_ms,
                target_met,
                results_consistency,
                baseline_comparison: None, // Would implement baseline comparison
            });
            
            info!("Benchmark {} completed: avg {:.1}ms, target {:.1}ms ({})", 
                  benchmark.name, avg_response_time, benchmark.expected_response_time_ms,
                  if target_met { "✓" } else { "✗" });
        }
        
        // Store results
        {
            let mut results = self.results_collector.lock().await;
            results.benchmark_results = benchmark_results;
        }
        
        Ok(())
    }
    
    /// Run data size scalability tests
    #[instrument(skip(self))]
    async fn run_data_size_tests(&self) -> SearchResultType<()> {
        let mut data_size_results = Vec::new();
        
        for data_config in &self.config.data_size_tests {
            info!("Testing with {} documents", data_config.document_count);
            
            // Generate test documents
            let test_documents = self.data_generator.generate_documents(
                data_config.document_count,
                data_config.avg_document_size,
                data_config.content_type_variety,
            );
            
            // Measure indexing performance
            let indexing_start = Instant::now();
            
            // In a real implementation, this would index the documents
            // For now, we'll simulate indexing time
            let simulated_indexing_time = data_config.document_count as f64 * 0.001; // 1ms per document
            tokio::time::sleep(Duration::from_millis((simulated_indexing_time * 1000.0) as u64)).await;
            
            let indexing_duration = indexing_start.elapsed();
            
            // Test search performance at this scale
            let search_performance = if data_config.test_search_performance {
                self.test_search_performance_at_scale(data_config.document_count).await?
            } else {
                SearchPerformanceAtScale {
                    simple_query_ms: 0.0,
                    complex_query_ms: 0.0,
                    faceted_query_ms: 0.0,
                    degradation_factor: 1.0,
                }
            };
            
            data_size_results.push(DataSizeResult {
                document_count: data_config.document_count,
                index_size_mb: (data_config.document_count * data_config.avg_document_size) as f64 / (1024.0 * 1024.0),
                indexing_time_secs: indexing_duration.as_secs_f64(),
                search_performance,
                memory_usage_mb: 0.0, // Would measure actual memory usage
            });
            
            info!("Data size test completed for {} documents: indexing {:.2}s, search performance degradation {:.2}x",
                  data_config.document_count, indexing_duration.as_secs_f64(), search_performance.degradation_factor);
        }
        
        // Store results
        {
            let mut results = self.results_collector.lock().await;
            results.data_size_results = data_size_results;
        }
        
        Ok(())
    }
    
    /// Test search performance at specific scale
    async fn test_search_performance_at_scale(&self, _document_count: usize) -> SearchResultType<SearchPerformanceAtScale> {
        // Test simple queries
        let simple_query = self.create_test_query("meeting", &QueryComplexity::Simple);
        let simple_start = Instant::now();
        let _ = self.search_service.unified_search(simple_query, None).await?;
        let simple_time = simple_start.elapsed().as_millis() as f64;
        
        // Test complex queries
        let complex_query = self.create_test_query("urgent project from:john", &QueryComplexity::Complex);
        let complex_start = Instant::now();
        let _ = self.search_service.unified_search(complex_query, None).await?;
        let complex_time = complex_start.elapsed().as_millis() as f64;
        
        // Test faceted queries
        let faceted_query = SearchQuery {
            query: "document".to_string(),
            options: SearchOptions {
                facets: Some(true),
                ..Default::default()
            },
            ..Default::default()
        };
        let faceted_start = Instant::now();
        let _ = self.search_service.unified_search(faceted_query, None).await?;
        let faceted_time = faceted_start.elapsed().as_millis() as f64;
        
        // Calculate degradation factor (compared to baseline)
        let baseline_simple_time = 50.0; // Mock baseline
        let degradation_factor = simple_time / baseline_simple_time;
        
        Ok(SearchPerformanceAtScale {
            simple_query_ms: simple_time,
            complex_query_ms: complex_time,
            faceted_query_ms: faceted_time,
            degradation_factor,
        })
    }
    
    /// Run concurrency tests
    #[instrument(skip(self))]
    async fn run_concurrency_tests(&self) -> SearchResultType<()> {
        let mut concurrency_results = Vec::new();
        
        for concurrency_config in &self.config.concurrency_tests {
            info!("Testing with {} concurrent users", concurrency_config.concurrent_users);
            
            let semaphore = Arc::new(Semaphore::new(concurrency_config.concurrent_users));
            let start_time = Instant::now();
            let mut tasks = Vec::new();
            
            let total_queries = concurrency_config.concurrent_users * concurrency_config.queries_per_user;
            let results = Arc::new(tokio::sync::Mutex::new(Vec::new()));
            
            // Spawn concurrent user tasks
            for user_id in 0..concurrency_config.concurrent_users {
                let service = self.search_service.clone();
                let semaphore = semaphore.clone();
                let results = results.clone();
                let queries_per_user = concurrency_config.queries_per_user;
                let think_time = concurrency_config.think_time_ms;
                
                let task = tokio::spawn(async move {
                    for query_id in 0..queries_per_user {
                        let _permit = semaphore.acquire().await.unwrap();
                        
                        let query = SearchQuery {
                            query: format!("user_{}_query_{}", user_id, query_id),
                            ..Default::default()
                        };
                        
                        let query_start = Instant::now();
                        match service.unified_search(query, None).await {
                            Ok(response) => {
                                let response_time = query_start.elapsed().as_millis() as f64;
                                results.lock().await.push((response_time, true, response.results.len()));
                            }
                            Err(_) => {
                                let response_time = query_start.elapsed().as_millis() as f64;
                                results.lock().await.push((response_time, false, 0));
                            }
                        }
                        
                        if think_time > 0 {
                            tokio::time::sleep(Duration::from_millis(think_time)).await;
                        }
                    }
                });
                
                tasks.push(task);
            }
            
            // Wait for all tasks or timeout
            let timeout = Duration::from_secs(concurrency_config.duration_secs);
            match tokio::time::timeout(timeout, futures::future::join_all(tasks)).await {
                Ok(_) => {
                    // All tasks completed
                }
                Err(_) => {
                    warn!("Concurrency test timed out for {} users", concurrency_config.concurrent_users);
                }
            }
            
            let test_duration = start_time.elapsed();
            let query_results = results.lock().await;
            
            // Calculate metrics
            let successful_queries = query_results.iter().filter(|(_, success, _)| *success).count();
            let total_queries_executed = query_results.len();
            let avg_response_time = if !query_results.is_empty() {
                query_results.iter().map(|(time, _, _)| time).sum::<f64>() / query_results.len() as f64
            } else {
                0.0
            };
            let throughput = total_queries_executed as f64 / test_duration.as_secs_f64();
            let error_rate = if total_queries_executed > 0 {
                (total_queries_executed - successful_queries) as f64 / total_queries_executed as f64
            } else {
                0.0
            };
            
            concurrency_results.push(ConcurrencyResult {
                concurrent_users: concurrency_config.concurrent_users,
                total_queries: total_queries_executed,
                avg_response_time_ms: avg_response_time,
                throughput_qps: throughput,
                error_rate,
                resource_utilization: ResourceUtilization {
                    cpu_utilization: 0.5, // Mock values
                    memory_utilization: 0.6,
                    io_utilization: 0.3,
                },
            });
            
            info!("Concurrency test completed: {} users, {:.1} QPS, {:.1}ms avg response time, {:.2}% error rate",
                  concurrency_config.concurrent_users, throughput, avg_response_time, error_rate * 100.0);
        }
        
        // Store results
        {
            let mut results = self.results_collector.lock().await;
            results.concurrency_results = concurrency_results;
        }
        
        Ok(())
    }
    
    /// Run stress test
    #[instrument(skip(self))]
    async fn run_stress_test(&self) -> SearchResultType<()> {
        let stress_config = &self.config.stress_test;
        
        info!("Starting stress test: {} queries over {}s with max {} concurrent",
              stress_config.total_queries, stress_config.duration_secs, stress_config.max_concurrent);
        
        let semaphore = Arc::new(Semaphore::new(stress_config.max_concurrent));
        let results = Arc::new(tokio::sync::Mutex::new(Vec::new()));
        let start_time = Instant::now();
        
        let mut query_tasks = Vec::new();
        
        for query_id in 0..stress_config.total_queries {
            let service = self.search_service.clone();
            let semaphore = semaphore.clone();
            let results = results.clone();
            let complexity = &stress_config.complexity_levels[query_id % stress_config.complexity_levels.len()];
            
            let query = self.data_generator.generate_query(complexity);
            
            let task = tokio::spawn(async move {
                let _permit = semaphore.acquire().await.unwrap();
                
                let query_start = Instant::now();
                match service.unified_search(query, None).await {
                    Ok(response) => {
                        let response_time = query_start.elapsed().as_millis() as u64;
                        results.lock().await.push((response_time, true, response.results.len()));
                    }
                    Err(_) => {
                        let response_time = query_start.elapsed().as_millis() as u64;
                        results.lock().await.push((response_time, false, 0));
                    }
                }
            });
            
            query_tasks.push(task);
            
            // Add some randomness to avoid thundering herd
            if query_id % 100 == 0 {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        }
        
        // Wait for completion or timeout
        let timeout = Duration::from_secs(stress_config.duration_secs + 60); // Extra buffer
        match tokio::time::timeout(timeout, futures::future::join_all(query_tasks)).await {
            Ok(_) => {
                info!("All stress test queries completed");
            }
            Err(_) => {
                warn!("Stress test timed out");
            }
        }
        
        let test_duration = start_time.elapsed();
        let query_results = results.lock().await;
        
        // Calculate metrics
        let total_queries = query_results.len();
        let successful_queries = query_results.iter().filter(|(_, success, _)| *success).count();
        let failed_queries = total_queries - successful_queries;
        
        let response_times: Vec<u64> = query_results.iter()
            .filter(|(_, success, _)| *success)
            .map(|(time, _, _)| *time)
            .collect();
        
        let avg_response_time = if !response_times.is_empty() {
            response_times.iter().sum::<u64>() as f64 / response_times.len() as f64
        } else {
            0.0
        };
        
        let percentiles = self.calculate_percentiles(&response_times);
        let throughput = total_queries as f64 / test_duration.as_secs_f64();
        let error_rate = failed_queries as f64 / total_queries as f64;
        
        let stress_results = StressTestResults {
            total_queries,
            successful_queries,
            failed_queries,
            avg_response_time_ms: avg_response_time,
            response_time_percentiles: percentiles,
            throughput_qps: throughput,
            error_rate,
            peak_concurrent_queries: stress_config.max_concurrent,
            memory_usage: MemoryUsageSnapshot {
                total_mb: 0.0, // Would measure actual memory
                breakdown: MemoryBreakdown {
                    index_mb: 0.0,
                    cache_mb: 0.0,
                    provider_mb: 0.0,
                    other_mb: 0.0,
                },
                timestamp: Utc::now(),
            },
        };
        
        // Store results
        {
            let mut results = self.results_collector.lock().await;
            results.stress_test_results = Some(stress_results);
        }
        
        info!("Stress test completed: {}/{} successful queries, {:.1} QPS, {:.1}ms avg response time",
              successful_queries, total_queries, throughput, avg_response_time);
        
        Ok(())
    }
    
    /// Run load test
    #[instrument(skip(self))]
    async fn run_load_test(&self) -> SearchResultType<()> {
        let load_config = &self.config.load_test;
        
        info!("Starting load test: {:.1} QPS for {}s", load_config.target_qps, load_config.duration_secs);
        
        let query_interval = Duration::from_secs_f64(1.0 / load_config.target_qps);
        let test_duration = Duration::from_secs(load_config.duration_secs);
        let start_time = Instant::now();
        
        let results = Arc::new(tokio::sync::Mutex::new(Vec::new()));
        let performance_timeline = Arc::new(tokio::sync::Mutex::new(Vec::new()));
        
        let mut query_tasks = Vec::new();
        let mut query_count = 0;
        
        while start_time.elapsed() < test_duration {
            let service = self.search_service.clone();
            let results = results.clone();
            let timeline = performance_timeline.clone();
            
            // Select query complexity based on configured mix
            let complexity = self.select_query_complexity_from_mix(&load_config.query_mix);
            let query = self.data_generator.generate_query(&complexity);
            let query_start_time = Instant::now();
            
            let task = tokio::spawn(async move {
                match service.unified_search(query, None).await {
                    Ok(response) => {
                        let response_time = query_start_time.elapsed().as_millis() as f64;
                        results.lock().await.push((response_time, true, response.results.len()));
                        
                        // Record performance data point every 10 seconds
                        if query_count % 100 == 0 {
                            timeline.lock().await.push(PerformanceDataPoint {
                                timestamp: Utc::now(),
                                response_time_ms: response_time,
                                throughput_qps: 0.0, // Would calculate actual throughput
                                error_rate: 0.0,
                                memory_usage_mb: 0.0,
                            });
                        }
                    }
                    Err(_) => {
                        let response_time = query_start_time.elapsed().as_millis() as f64;
                        results.lock().await.push((response_time, false, 0));
                    }
                }
            });
            
            query_tasks.push(task);
            query_count += 1;
            
            // Wait for next query interval
            tokio::time::sleep(query_interval).await;
        }
        
        // Wait for remaining queries to complete
        let _ = futures::future::join_all(query_tasks).await;
        
        let test_duration_actual = start_time.elapsed();
        let query_results = results.lock().await;
        
        // Calculate metrics
        let total_queries = query_results.len();
        let successful_queries = query_results.iter().filter(|(_, success, _)| *success).count();
        let achieved_qps = total_queries as f64 / test_duration_actual.as_secs_f64();
        let success_rate = successful_queries as f64 / total_queries as f64;
        
        let response_times: Vec<f64> = query_results.iter()
            .filter(|(_, success, _)| *success)
            .map(|(time, _, _)| *time)
            .collect();
        
        let avg_response_time = if !response_times.is_empty() {
            response_times.iter().sum::<f64>() / response_times.len() as f64
        } else {
            0.0
        };
        
        let percentiles = self.calculate_percentiles_f64(&response_times);
        
        // Calculate sustainability score
        let sustainability_score = (success_rate * (load_config.target_qps / achieved_qps.max(load_config.target_qps))).min(1.0);
        
        let load_results = LoadTestResults {
            target_qps: load_config.target_qps,
            achieved_qps,
            success_rate,
            avg_response_time_ms: avg_response_time,
            response_time_percentiles: percentiles,
            sustainability_score,
            degradation_trend: performance_timeline.lock().await.clone(),
        };
        
        // Store results
        {
            let mut results = self.results_collector.lock().await;
            results.load_test_results = Some(load_results);
        }
        
        info!("Load test completed: {:.1}/{:.1} QPS achieved, {:.1}% success rate, {:.1}ms avg response time",
              achieved_qps, load_config.target_qps, success_rate * 100.0, avg_response_time);
        
        Ok(())
    }
    
    /// Analyze results and generate summary
    async fn analyze_and_summarize(&self) -> SearchResultType<()> {
        let mut results = self.results_collector.lock().await;
        
        // Determine overall performance grade
        let avg_response_times: Vec<f64> = results.benchmark_results.iter()
            .map(|b| b.avg_response_time_ms)
            .collect();
        
        let overall_avg_response_time = if !avg_response_times.is_empty() {
            avg_response_times.iter().sum::<f64>() / avg_response_times.len() as f64
        } else {
            0.0
        };
        
        let grade = match overall_avg_response_time {
            t if t < 200.0 => PerformanceGrade::A,
            t if t < 300.0 => PerformanceGrade::B,
            t if t < 500.0 => PerformanceGrade::C,
            t if t < 1000.0 => PerformanceGrade::D,
            _ => PerformanceGrade::F,
        };
        
        let target_met = overall_avg_response_time <= self.config.target_response_time_ms as f64;
        
        // Identify bottlenecks
        let mut bottlenecks = Vec::new();
        let mut recommendations = Vec::new();
        let mut critical_issues = Vec::new();
        
        // Check for performance bottlenecks
        if overall_avg_response_time > self.config.target_response_time_ms as f64 * 2.0 {
            bottlenecks.push(PerformanceBottleneck {
                component: "Overall Performance".to_string(),
                bottleneck_type: BottleneckType::QueryComplexity,
                severity: 5,
                description: format!("Average response time {:.1}ms exceeds target {}ms by 2x", 
                                   overall_avg_response_time, self.config.target_response_time_ms),
                remediation: "Consider query optimization, index tuning, or hardware upgrades".to_string(),
            });
            critical_issues.push("Severe performance degradation detected".to_string());
        }
        
        // Check concurrency performance
        if let Some(concurrency_result) = results.concurrency_results.last() {
            if concurrency_result.error_rate > 0.05 {
                bottlenecks.push(PerformanceBottleneck {
                    component: "Concurrency Handling".to_string(),
                    bottleneck_type: BottleneckType::Concurrency,
                    severity: 4,
                    description: format!("High error rate {:.1}% under concurrent load", 
                                       concurrency_result.error_rate * 100.0),
                    remediation: "Improve concurrency handling and resource management".to_string(),
                });
            }
        }
        
        // Generate recommendations
        if overall_avg_response_time > self.config.target_response_time_ms as f64 {
            recommendations.push("Consider implementing more aggressive caching strategies".to_string());
            recommendations.push("Optimize index structure for common query patterns".to_string());
            recommendations.push("Review and optimize provider query performance".to_string());
        }
        
        if let Some(load_result) = &results.load_test_results {
            if load_result.sustainability_score < 0.8 {
                recommendations.push("Improve system sustainability under continuous load".to_string());
            }
        }
        
        // Generate conclusion
        let conclusion = match grade {
            PerformanceGrade::A => "Excellent performance - system meets all targets with room to spare".to_string(),
            PerformanceGrade::B => "Good performance - system meets targets with minor optimization opportunities".to_string(),
            PerformanceGrade::C => "Acceptable performance - system meets basic requirements but has room for improvement".to_string(),
            PerformanceGrade::D => "Poor performance - system requires significant optimization to meet targets".to_string(),
            PerformanceGrade::F => "Critical performance issues - immediate action required to meet minimum requirements".to_string(),
        };
        
        results.summary = PerformanceSummary {
            overall_grade: grade,
            target_response_time_met: target_met,
            bottlenecks,
            recommendations,
            critical_issues,
            conclusion,
        };
        
        Ok(())
    }
    
    /// Create test query based on complexity
    fn create_test_query(&self, query_text: &str, complexity: &QueryComplexity) -> SearchQuery {
        let mut query = SearchQuery {
            query: query_text.to_string(),
            ..Default::default()
        };
        
        match complexity {
            QueryComplexity::Simple => {
                // No additional options
            }
            QueryComplexity::Medium => {
                query.options.fuzzy = Some(true);
                query.content_types = Some(vec![ContentType::Email, ContentType::Document]);
            }
            QueryComplexity::Complex => {
                query.options.fuzzy = Some(true);
                query.options.highlighting = Some(true);
                query.content_types = Some(vec![ContentType::Email, ContentType::Document]);
                query.provider_ids = Some(vec!["gmail".to_string(), "slack".to_string()]);
            }
            QueryComplexity::Advanced => {
                query.options.fuzzy = Some(true);
                query.options.highlighting = Some(true);
                query.options.facets = Some(true);
                query.options.suggestions = Some(true);
                query.content_types = Some(vec![ContentType::Email, ContentType::Document, ContentType::CalendarEvent]);
                query.provider_ids = Some(vec!["gmail".to_string(), "slack".to_string(), "notion".to_string()]);
            }
            QueryComplexity::Extreme => {
                query.options.fuzzy = Some(true);
                query.options.highlighting = Some(true);
                query.options.facets = Some(true);
                query.options.suggestions = Some(true);
                query.options.semantic = Some(true);
                query.content_types = Some(vec![
                    ContentType::Email, ContentType::Document, ContentType::CalendarEvent,
                    ContentType::Contact, ContentType::Message,
                ]);
                query.provider_ids = Some(vec![
                    "gmail".to_string(), "slack".to_string(), "notion".to_string(), 
                    "github".to_string(), "teams".to_string()
                ]);
            }
        }
        
        query
    }
    
    /// Select query complexity from configured mix
    fn select_query_complexity_from_mix(&self, mix: &HashMap<QueryComplexity, f64>) -> QueryComplexity {
        let random_value: f64 = rand::random();
        let mut cumulative = 0.0;
        
        for (complexity, probability) in mix {
            cumulative += probability;
            if random_value <= cumulative {
                return complexity.clone();
            }
        }
        
        // Fallback to simple
        QueryComplexity::Simple
    }
    
    /// Calculate response time percentiles
    fn calculate_percentiles(&self, times: &[u64]) -> ResponseTimePercentiles {
        if times.is_empty() {
            return ResponseTimePercentiles {
                p50: 0.0, p75: 0.0, p90: 0.0, p95: 0.0, p99: 0.0, p99_9: 0.0,
            };
        }
        
        let mut sorted_times = times.to_vec();
        sorted_times.sort();
        let len = sorted_times.len();
        
        ResponseTimePercentiles {
            p50: sorted_times[len * 50 / 100] as f64,
            p75: sorted_times[len * 75 / 100] as f64,
            p90: sorted_times[len * 90 / 100] as f64,
            p95: sorted_times[len * 95 / 100] as f64,
            p99: sorted_times[len * 99 / 100] as f64,
            p99_9: sorted_times[len * 999 / 1000] as f64,
        }
    }
    
    /// Calculate response time percentiles for f64 values
    fn calculate_percentiles_f64(&self, times: &[f64]) -> ResponseTimePercentiles {
        if times.is_empty() {
            return ResponseTimePercentiles {
                p50: 0.0, p75: 0.0, p90: 0.0, p95: 0.0, p99: 0.0, p99_9: 0.0,
            };
        }
        
        let mut sorted_times = times.to_vec();
        sorted_times.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let len = sorted_times.len();
        
        ResponseTimePercentiles {
            p50: sorted_times[len * 50 / 100],
            p75: sorted_times[len * 75 / 100],
            p90: sorted_times[len * 90 / 100],
            p95: sorted_times[len * 95 / 100],
            p99: sorted_times[len * 99 / 100],
            p99_9: sorted_times[len * 999 / 1000],
        }
    }
}

impl TestDataGenerator {
    fn new() -> Self {
        let content_patterns = vec![
            ContentPattern {
                name: "Email".to_string(),
                content_type: ContentType::Email,
                title_templates: vec![
                    "Re: {subject}".to_string(),
                    "Meeting: {subject}".to_string(),
                    "Update on {subject}".to_string(),
                    "Question about {subject}".to_string(),
                ],
                content_templates: vec![
                    "Hi {name}, I wanted to follow up on {topic}. Please let me know your thoughts.".to_string(),
                    "The {project} project is progressing well. Here are the latest updates: {details}".to_string(),
                ],
                keywords: vec![
                    "meeting".to_string(), "project".to_string(), "update".to_string(),
                    "urgent".to_string(), "follow-up".to_string(), "schedule".to_string(),
                ],
                avg_content_length: 500,
            },
            ContentPattern {
                name: "Document".to_string(),
                content_type: ContentType::Document,
                title_templates: vec![
                    "{project} Requirements".to_string(),
                    "{team} Planning Document".to_string(),
                    "Meeting Notes - {date}".to_string(),
                ],
                content_templates: vec![
                    "This document outlines the requirements for {project}. Key points include: {points}".to_string(),
                    "Summary of the {meeting} meeting held on {date}. Action items: {actions}".to_string(),
                ],
                keywords: vec![
                    "requirements".to_string(), "planning".to_string(), "notes".to_string(),
                    "summary".to_string(), "action items".to_string(), "objectives".to_string(),
                ],
                avg_content_length: 1200,
            },
        ];
        
        let mut provider_distribution = HashMap::new();
        provider_distribution.insert(ProviderType::Gmail, 0.4);
        provider_distribution.insert(ProviderType::Slack, 0.3);
        provider_distribution.insert(ProviderType::Notion, 0.2);
        provider_distribution.insert(ProviderType::LocalFiles, 0.1);
        
        let mut content_type_distribution = HashMap::new();
        content_type_distribution.insert(ContentType::Email, 0.5);
        content_type_distribution.insert(ContentType::Document, 0.3);
        content_type_distribution.insert(ContentType::CalendarEvent, 0.1);
        content_type_distribution.insert(ContentType::Message, 0.1);
        
        Self {
            content_patterns,
            provider_distribution,
            content_type_distribution,
        }
    }
    
    fn generate_documents(&self, count: usize, avg_size: usize, _variety: usize) -> Vec<SearchDocument> {
        let mut documents = Vec::with_capacity(count);
        
        for i in 0..count {
            let pattern = &self.content_patterns[i % self.content_patterns.len()];
            
            documents.push(SearchDocument {
                id: Uuid::new_v4().to_string(),
                title: format!("Test Document {}", i),
                content: "This is test content for performance testing".repeat(avg_size / 50),
                summary: Some(format!("Summary of test document {}", i)),
                content_type: pattern.content_type.clone(),
                provider_id: "test_provider".to_string(),
                provider_type: ProviderType::LocalFiles,
                url: Some(format!("https://test.com/doc/{}", i)),
                icon: None,
                thumbnail: None,
                metadata: crate::search::DocumentMetadata {
                    size: Some(avg_size as u64),
                    file_type: Some("text".to_string()),
                    mime_type: Some("text/plain".to_string()),
                    language: Some("en".to_string()),
                    location: None,
                    collaboration: None,
                    activity: None,
                    priority: None,
                    status: None,
                    custom: HashMap::new(),
                },
                tags: vec![format!("tag_{}", i % 10)],
                categories: vec!["test".to_string()],
                author: Some("test_user".to_string()),
                created_at: Utc::now(),
                last_modified: Utc::now(),
                indexing_info: crate::search::IndexingInfo {
                    indexed_at: Utc::now(),
                    version: 1,
                    checksum: format!("checksum_{}", i),
                    index_type: crate::search::IndexType::Full,
                },
            });
        }
        
        documents
    }
    
    fn generate_query(&self, complexity: &QueryComplexity) -> SearchQuery {
        let base_queries = vec![
            "meeting", "project", "update", "urgent", "document", "email",
            "schedule", "presentation", "report", "analysis", "review",
        ];
        
        let query_text = match complexity {
            QueryComplexity::Simple => {
                base_queries[rand::random::<usize>() % base_queries.len()].to_string()
            }
            QueryComplexity::Medium => {
                format!("{} {}", 
                        base_queries[rand::random::<usize>() % base_queries.len()],
                        base_queries[rand::random::<usize>() % base_queries.len()])
            }
            QueryComplexity::Complex => {
                format!("{} {} from:user", 
                        base_queries[rand::random::<usize>() % base_queries.len()],
                        base_queries[rand::random::<usize>() % base_queries.len()])
            }
            _ => {
                format!("urgent {} AND {} NOT spam", 
                        base_queries[rand::random::<usize>() % base_queries.len()],
                        base_queries[rand::random::<usize>() % base_queries.len()])
            }
        };
        
        SearchQuery {
            query: query_text,
            ..Default::default()
        }
    }
}