//! Real-time indexing and background processing for the search engine

use crate::search::{
    SearchDocument, SearchError, SearchResult as SearchResultType, 
    ErrorContext, SearchErrorContext, ProviderManager
};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc, Semaphore};
use tokio_util::task::TaskTracker;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use tracing::{info, error, debug, warn, instrument};
use std::collections::{HashMap, VecDeque};
use std::time::Duration;

/// Real-time indexing manager
pub struct RealTimeIndexManager {
    /// Document processing queue
    document_queue: Arc<RwLock<VecDeque<IndexingTask>>>,
    
    /// Active indexing jobs
    active_jobs: Arc<DashMap<String, IndexingJob>>,
    
    /// Task tracker for managing background tasks
    task_tracker: TaskTracker,
    
    /// Concurrency limiter
    semaphore: Arc<Semaphore>,
    
    /// Indexing statistics
    stats: Arc<RwLock<IndexingStats>>,
    
    /// Configuration
    config: IndexingConfig,
    
    /// Provider manager for source data
    provider_manager: Arc<ProviderManager>,
    
    /// Change detection system
    change_detector: Arc<ChangeDetector>,
}

/// Background indexing task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingTask {
    /// Task ID
    pub id: String,
    
    /// Task type
    pub task_type: IndexingTaskType,
    
    /// Priority (1-5, 5 being highest)
    pub priority: u8,
    
    /// Created timestamp
    pub created_at: DateTime<Utc>,
    
    /// Scheduled execution time
    pub scheduled_at: DateTime<Utc>,
    
    /// Provider ID
    pub provider_id: String,
    
    /// Documents to process
    pub documents: Vec<SearchDocument>,
    
    /// Retry count
    pub retry_count: u8,
    
    /// Maximum retries
    pub max_retries: u8,
    
    /// Task metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Types of indexing tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexingTaskType {
    /// Index new documents
    IndexDocuments,
    
    /// Update existing documents
    UpdateDocuments,
    
    /// Delete documents
    DeleteDocuments,
    
    /// Rebuild provider index
    RebuildProviderIndex,
    
    /// Optimize indices
    OptimizeIndices,
    
    /// Incremental sync from provider
    IncrementalSync,
    
    /// Full sync from provider
    FullSync,
}

/// Active indexing job
#[derive(Debug, Clone)]
pub struct IndexingJob {
    /// Job ID
    pub id: String,
    
    /// Associated task
    pub task: IndexingTask,
    
    /// Start time
    pub started_at: DateTime<Utc>,
    
    /// Current status
    pub status: IndexingJobStatus,
    
    /// Progress (0.0 to 1.0)
    pub progress: f64,
    
    /// Current operation description
    pub current_operation: String,
    
    /// Completion time
    pub completed_at: Option<DateTime<Utc>>,
    
    /// Processed document count
    pub processed_documents: usize,
    
    /// Total document count
    pub total_documents: usize,
    
    /// Error messages
    pub errors: Vec<String>,
}

/// Indexing job status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexingJobStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Indexing configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IndexingConfig {
    /// Maximum concurrent indexing jobs
    pub max_concurrent_jobs: usize,
    
    /// Maximum documents per batch
    pub max_batch_size: usize,
    
    /// Batch processing delay (ms)
    pub batch_delay_ms: u64,
    
    /// Queue size limit
    pub max_queue_size: usize,
    
    /// Enable automatic optimization
    pub auto_optimize: bool,
    
    /// Optimization interval (seconds)
    pub optimize_interval_secs: u64,
    
    /// Enable change detection
    pub enable_change_detection: bool,
    
    /// Change detection interval (seconds)
    pub change_detection_interval_secs: u64,
    
    /// Provider sync intervals
    pub provider_sync_intervals: HashMap<String, u64>,
    
    /// Priority queue enabled
    pub priority_queue: bool,
    
    /// Maximum retry attempts
    pub max_retry_attempts: u8,
    
    /// Retry backoff multiplier
    pub retry_backoff_multiplier: f64,
}

impl Default for IndexingConfig {
    fn default() -> Self {
        Self {
            max_concurrent_jobs: 4,
            max_batch_size: 100,
            batch_delay_ms: 1000,
            max_queue_size: 10000,
            auto_optimize: true,
            optimize_interval_secs: 3600, // 1 hour
            enable_change_detection: true,
            change_detection_interval_secs: 300, // 5 minutes
            provider_sync_intervals: HashMap::new(),
            priority_queue: true,
            max_retry_attempts: 3,
            retry_backoff_multiplier: 2.0,
        }
    }
}

/// Indexing statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingStats {
    /// Total tasks processed
    pub total_tasks: u64,
    
    /// Successful tasks
    pub successful_tasks: u64,
    
    /// Failed tasks
    pub failed_tasks: u64,
    
    /// Total documents indexed
    pub total_documents_indexed: u64,
    
    /// Average processing time per document (ms)
    pub avg_processing_time_ms: f64,
    
    /// Current queue size
    pub queue_size: usize,
    
    /// Active job count
    pub active_jobs: usize,
    
    /// Last optimization time
    pub last_optimization: Option<DateTime<Utc>>,
    
    /// Provider statistics
    pub provider_stats: HashMap<String, ProviderIndexingStats>,
}

/// Provider-specific indexing statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderIndexingStats {
    /// Provider ID
    pub provider_id: String,
    
    /// Total documents indexed
    pub documents_indexed: u64,
    
    /// Last successful sync
    pub last_successful_sync: Option<DateTime<Utc>>,
    
    /// Last failed sync
    pub last_failed_sync: Option<DateTime<Utc>>,
    
    /// Current sync status
    pub sync_status: SyncStatus,
    
    /// Error rate
    pub error_rate: f64,
    
    /// Average sync time (seconds)
    pub avg_sync_time_secs: f64,
}

/// Synchronization status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncStatus {
    Idle,
    Syncing,
    Failed,
    Paused,
}

/// Change detection system
pub struct ChangeDetector {
    /// Document checksums for change detection
    document_checksums: Arc<DashMap<String, String>>,
    
    /// Provider last sync times
    provider_sync_times: Arc<DashMap<String, DateTime<Utc>>>,
    
    /// Detected changes queue
    changes_queue: Arc<RwLock<VecDeque<ChangeEvent>>>,
}

/// Change event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeEvent {
    /// Event ID
    pub id: String,
    
    /// Event type
    pub event_type: ChangeEventType,
    
    /// Document ID
    pub document_id: String,
    
    /// Provider ID
    pub provider_id: String,
    
    /// Timestamp
    pub timestamp: DateTime<Utc>,
    
    /// Change metadata
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Types of change events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangeEventType {
    DocumentCreated,
    DocumentUpdated,
    DocumentDeleted,
    ProviderConnected,
    ProviderDisconnected,
    IndexCorrupted,
}

impl RealTimeIndexManager {
    /// Create a new real-time index manager
    #[instrument(skip(provider_manager))]
    pub async fn new(
        config: IndexingConfig,
        provider_manager: Arc<ProviderManager>,
    ) -> SearchResultType<Self> {
        info!("Initializing real-time index manager");
        
        let semaphore = Arc::new(Semaphore::new(config.max_concurrent_jobs));
        let change_detector = Arc::new(ChangeDetector::new());
        
        let manager = Self {
            document_queue: Arc::new(RwLock::new(VecDeque::new())),
            active_jobs: Arc::new(DashMap::new()),
            task_tracker: TaskTracker::new(),
            semaphore,
            stats: Arc::new(RwLock::new(IndexingStats {
                total_tasks: 0,
                successful_tasks: 0,
                failed_tasks: 0,
                total_documents_indexed: 0,
                avg_processing_time_ms: 0.0,
                queue_size: 0,
                active_jobs: 0,
                last_optimization: None,
                provider_stats: HashMap::new(),
            })),
            config,
            provider_manager,
            change_detector,
        };
        
        // Start background workers
        manager.start_background_workers().await;
        
        info!("Real-time index manager initialized successfully");
        Ok(manager)
    }
    
    /// Queue a document for indexing
    #[instrument(skip(self, document), fields(doc_id = %document.id))]
    pub async fn queue_document(&self, document: SearchDocument, priority: u8) -> SearchResultType<String> {
        let task_id = uuid::Uuid::new_v4().to_string();
        
        let task = IndexingTask {
            id: task_id.clone(),
            task_type: IndexingTaskType::IndexDocuments,
            priority,
            created_at: Utc::now(),
            scheduled_at: Utc::now(),
            provider_id: document.provider_id.clone(),
            documents: vec![document],
            retry_count: 0,
            max_retries: self.config.max_retry_attempts,
            metadata: HashMap::new(),
        };
        
        self.queue_task(task).await?;
        debug!("Document queued for indexing: {}", task_id);
        
        Ok(task_id)
    }
    
    /// Queue multiple documents for batch indexing
    #[instrument(skip(self, documents), fields(doc_count = documents.len()))]
    pub async fn queue_documents(&self, documents: Vec<SearchDocument>, priority: u8) -> SearchResultType<String> {
        if documents.is_empty() {
            return Err(SearchError::query_error("No documents provided"));
        }
        
        let task_id = uuid::Uuid::new_v4().to_string();
        let provider_id = documents[0].provider_id.clone();
        let doc_count = documents.len();
        
        let task = IndexingTask {
            id: task_id.clone(),
            task_type: IndexingTaskType::IndexDocuments,
            priority,
            created_at: Utc::now(),
            scheduled_at: Utc::now(),
            provider_id,
            documents,
            retry_count: 0,
            max_retries: self.config.max_retry_attempts,
            metadata: HashMap::new(),
        };
        
        self.queue_task(task).await?;
        debug!("Batch of {} documents queued for indexing: {}", doc_count, task_id);
        
        Ok(task_id)
    }
    
    /// Schedule a provider sync
    #[instrument(skip(self), fields(provider_id = %provider_id))]
    pub async fn schedule_provider_sync(&self, provider_id: &str, full_sync: bool) -> SearchResultType<String> {
        let task_id = uuid::Uuid::new_v4().to_string();
        
        let task = IndexingTask {
            id: task_id.clone(),
            task_type: if full_sync { IndexingTaskType::FullSync } else { IndexingTaskType::IncrementalSync },
            priority: if full_sync { 3 } else { 2 },
            created_at: Utc::now(),
            scheduled_at: Utc::now(),
            provider_id: provider_id.to_string(),
            documents: Vec::new(),
            retry_count: 0,
            max_retries: self.config.max_retry_attempts,
            metadata: HashMap::new(),
        };
        
        self.queue_task(task).await?;
        info!("Scheduled {} sync for provider: {}", if full_sync { "full" } else { "incremental" }, provider_id);
        
        Ok(task_id)
    }
    
    /// Get indexing statistics
    pub async fn get_stats(&self) -> IndexingStats {
        let mut stats = self.stats.read().await.clone();
        stats.queue_size = self.document_queue.read().await.len();
        stats.active_jobs = self.active_jobs.len();
        stats
    }
    
    /// Get active jobs
    pub async fn get_active_jobs(&self) -> Vec<IndexingJob> {
        self.active_jobs.iter().map(|entry| entry.value().clone()).collect()
    }
    
    /// Cancel a job
    #[instrument(skip(self), fields(job_id = %job_id))]
    pub async fn cancel_job(&self, job_id: &str) -> SearchResultType<bool> {
        if let Some(mut job_entry) = self.active_jobs.get_mut(job_id) {
            job_entry.status = IndexingJobStatus::Cancelled;
            info!("Job cancelled: {}", job_id);
            Ok(true)
        } else {
            Ok(false)
        }
    }
    
    /// Pause indexing
    pub async fn pause_indexing(&self) -> SearchResultType<()> {
        for mut entry in self.active_jobs.iter_mut() {
            if matches!(entry.status, IndexingJobStatus::Running) {
                entry.status = IndexingJobStatus::Paused;
            }
        }
        info!("Indexing paused");
        Ok(())
    }
    
    /// Resume indexing
    pub async fn resume_indexing(&self) -> SearchResultType<()> {
        for mut entry in self.active_jobs.iter_mut() {
            if matches!(entry.status, IndexingJobStatus::Paused) {
                entry.status = IndexingJobStatus::Running;
            }
        }
        info!("Indexing resumed");
        Ok(())
    }
    
    /// Queue a task with priority handling
    async fn queue_task(&self, task: IndexingTask) -> SearchResultType<()> {
        let mut queue = self.document_queue.write().await;
        
        // Check queue size limit
        if queue.len() >= self.config.max_queue_size {
            warn!("Index queue is full, dropping oldest tasks");
            // Remove oldest low-priority tasks
            while queue.len() >= self.config.max_queue_size && !queue.is_empty() {
                if let Some(old_task) = queue.pop_front() {
                    if old_task.priority <= 2 {
                        break;
                    }
                }
            }
        }
        
        // Insert with priority ordering
        if self.config.priority_queue {
            let insert_pos = queue
                .iter()
                .position(|t| t.priority < task.priority)
                .unwrap_or(queue.len());
            queue.insert(insert_pos, task);
        } else {
            queue.push_back(task);
        }
        
        // Update stats
        {
            let mut stats = self.stats.write().await;
            stats.total_tasks += 1;
        }
        
        Ok(())
    }
    
    /// Start background worker tasks
    async fn start_background_workers(&self) {
        // Task processing worker
        let manager_clone = self.clone();
        self.task_tracker.spawn(async move {
            manager_clone.task_processing_worker().await;
        });
        
        // Change detection worker
        if self.config.enable_change_detection {
            let manager_clone = self.clone();
            self.task_tracker.spawn(async move {
                manager_clone.change_detection_worker().await;
            });
        }
        
        // Optimization worker
        if self.config.auto_optimize {
            let manager_clone = self.clone();
            self.task_tracker.spawn(async move {
                manager_clone.optimization_worker().await;
            });
        }
        
        // Provider sync scheduler
        let manager_clone = self.clone();
        self.task_tracker.spawn(async move {
            manager_clone.sync_scheduler_worker().await;
        });
        
        info!("Background indexing workers started");
    }
    
    /// Main task processing worker
    async fn task_processing_worker(&self) {
        let mut interval = tokio::time::interval(Duration::from_millis(100));
        
        loop {
            interval.tick().await;
            
            // Get next task from queue
            let task = {
                let mut queue = self.document_queue.write().await;
                queue.pop_front()
            };
            
            if let Some(task) = task {
                // Acquire semaphore for concurrency control
                let permit = match self.semaphore.clone().acquire_owned().await {
                    Ok(permit) => permit,
                    Err(_) => continue, // Semaphore closed
                };
                
                // Process task
                let manager = self.clone();
                self.task_tracker.spawn(async move {
                    let _permit = permit; // Keep permit alive
                    manager.process_task(task).await;
                });
            } else {
                // No tasks available, brief sleep
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }
    
    /// Process an individual indexing task
    #[instrument(skip(self, task), fields(task_id = %task.id, task_type = ?task.task_type))]
    async fn process_task(&self, task: IndexingTask) {
        let job_id = task.id.clone();
        let start_time = Utc::now();
        
        // Create job entry
        let job = IndexingJob {
            id: job_id.clone(),
            task: task.clone(),
            started_at: start_time,
            status: IndexingJobStatus::Running,
            progress: 0.0,
            current_operation: "Starting...".to_string(),
            completed_at: None,
            processed_documents: 0,
            total_documents: task.documents.len(),
            errors: Vec::new(),
        };
        
        self.active_jobs.insert(job_id.clone(), job.clone());
        
        debug!("Starting task processing: {} ({:?})", job_id, task.task_type);
        
        let result = match task.task_type {
            IndexingTaskType::IndexDocuments => self.process_document_indexing(task.clone()).await,
            IndexingTaskType::UpdateDocuments => self.process_document_updates(task.clone()).await,
            IndexingTaskType::DeleteDocuments => self.process_document_deletions(task.clone()).await,
            IndexingTaskType::IncrementalSync => self.process_incremental_sync(task.clone()).await,
            IndexingTaskType::FullSync => self.process_full_sync(task.clone()).await,
            IndexingTaskType::RebuildProviderIndex => self.process_provider_rebuild(task.clone()).await,
            IndexingTaskType::OptimizeIndices => self.process_optimization(task.clone()).await,
        };
        
        // Update job status and stats
        match result {
            Ok(processed_count) => {
                if let Some(mut job) = self.active_jobs.get_mut(&job_id) {
                    job.status = IndexingJobStatus::Completed;
                    job.progress = 1.0;
                    job.processed_documents = processed_count;
                    job.current_operation = "Completed".to_string();
                }
                
                let mut stats = self.stats.write().await;
                stats.successful_tasks += 1;
                stats.total_documents_indexed += processed_count as u64;
                
                debug!("Task completed successfully: {} ({} documents)", job_id, processed_count);
            }
            Err(error) => {
                error!("Task failed: {} - {}", job_id, error);
                
                // Handle retry logic
                if task.retry_count < task.max_retries {
                    let mut retry_task = task.clone();
                    retry_task.retry_count += 1;
                    retry_task.scheduled_at = Utc::now() + chrono::Duration::seconds(
                        (self.config.retry_backoff_multiplier.powi(retry_task.retry_count as i32) * 60.0) as i64
                    );
                    
                    if let Err(e) = self.queue_task(retry_task).await {
                        error!("Failed to queue retry task: {}", e);
                    } else {
                        info!("Task {} queued for retry attempt {}", job_id, task.retry_count + 1);
                    }
                }
                
                if let Some(mut job) = self.active_jobs.get_mut(&job_id) {
                    job.status = IndexingJobStatus::Failed;
                    job.errors.push(error.to_string());
                }
                
                let mut stats = self.stats.write().await;
                stats.failed_tasks += 1;
            }
        }
        
        // Clean up completed job after delay
        let active_jobs = self.active_jobs.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(300)).await; // 5 minutes
            active_jobs.remove(&job_id);
        });
    }
    
    /// Process document indexing
    async fn process_document_indexing(&self, task: IndexingTask) -> SearchResultType<usize> {
        let mut processed = 0;
        let total = task.documents.len();
        
        // Process in batches
        for (i, chunk) in task.documents.chunks(self.config.max_batch_size).enumerate() {
            // Update progress
            if let Some(mut job) = self.active_jobs.get_mut(&task.id) {
                job.progress = (i * self.config.max_batch_size) as f64 / total as f64;
                job.current_operation = format!("Processing batch {}/{}", i + 1, (total + self.config.max_batch_size - 1) / self.config.max_batch_size);
            }
            
            // Index batch (would call actual index manager)
            for document in chunk {
                // Simulate indexing work
                tokio::time::sleep(Duration::from_millis(10)).await;
                processed += 1;
                
                // Update change detector
                let checksum = self.calculate_document_checksum(document);
                self.change_detector.document_checksums.insert(document.id.clone(), checksum);
            }
            
            // Brief delay between batches
            if i * self.config.max_batch_size + chunk.len() < total {
                tokio::time::sleep(Duration::from_millis(self.config.batch_delay_ms)).await;
            }
        }
        
        Ok(processed)
    }
    
    /// Process document updates
    async fn process_document_updates(&self, task: IndexingTask) -> SearchResultType<usize> {
        // Similar to indexing but with update logic
        self.process_document_indexing(task).await
    }
    
    /// Process document deletions
    async fn process_document_deletions(&self, task: IndexingTask) -> SearchResultType<usize> {
        let mut processed = 0;
        
        for document in &task.documents {
            // Delete from index (would call actual index manager)
            tokio::time::sleep(Duration::from_millis(5)).await;
            
            // Remove from change detector
            self.change_detector.document_checksums.remove(&document.id);
            
            processed += 1;
        }
        
        Ok(processed)
    }
    
    /// Process incremental sync
    async fn process_incremental_sync(&self, task: IndexingTask) -> SearchResultType<usize> {
        // Get provider and sync changes since last sync
        let last_sync = self.change_detector.provider_sync_times
            .get(&task.provider_id)
            .map(|entry| *entry.value())
            .unwrap_or_else(|| Utc::now() - chrono::Duration::hours(1));
        
        info!("Starting incremental sync for provider {} since {}", task.provider_id, last_sync);
        
        // Simulate fetching changes from provider
        tokio::time::sleep(Duration::from_secs(5)).await;
        
        // Update last sync time
        self.change_detector.provider_sync_times.insert(task.provider_id.clone(), Utc::now());
        
        // Return simulated document count
        Ok(50)
    }
    
    /// Process full sync
    async fn process_full_sync(&self, task: IndexingTask) -> SearchResultType<usize> {
        info!("Starting full sync for provider {}", task.provider_id);
        
        // Simulate full provider sync (would be much longer in reality)
        tokio::time::sleep(Duration::from_secs(30)).await;
        
        // Update last sync time
        self.change_detector.provider_sync_times.insert(task.provider_id.clone(), Utc::now());
        
        // Return simulated document count
        Ok(500)
    }
    
    /// Process provider rebuild
    async fn process_provider_rebuild(&self, task: IndexingTask) -> SearchResultType<usize> {
        info!("Rebuilding index for provider {}", task.provider_id);
        
        // Simulate index rebuild
        tokio::time::sleep(Duration::from_secs(60)).await;
        
        Ok(1000)
    }
    
    /// Process optimization
    async fn process_optimization(&self, _task: IndexingTask) -> SearchResultType<usize> {
        info!("Starting index optimization");
        
        // Simulate optimization work
        tokio::time::sleep(Duration::from_secs(30)).await;
        
        // Update optimization time
        let mut stats = self.stats.write().await;
        stats.last_optimization = Some(Utc::now());
        
        Ok(0)
    }
    
    /// Change detection worker
    async fn change_detection_worker(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(self.config.change_detection_interval_secs));
        
        loop {
            interval.tick().await;
            
            // Check for changes in each provider
            for provider_id in self.get_enabled_provider_ids().await {
                if let Err(e) = self.detect_provider_changes(&provider_id).await {
                    error!("Change detection failed for provider {}: {}", provider_id, e);
                }
            }
        }
    }
    
    /// Optimization worker
    async fn optimization_worker(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(self.config.optimize_interval_secs));
        
        loop {
            interval.tick().await;
            
            // Queue optimization task
            let task = IndexingTask {
                id: uuid::Uuid::new_v4().to_string(),
                task_type: IndexingTaskType::OptimizeIndices,
                priority: 1,
                created_at: Utc::now(),
                scheduled_at: Utc::now(),
                provider_id: "system".to_string(),
                documents: Vec::new(),
                retry_count: 0,
                max_retries: 1,
                metadata: HashMap::new(),
            };
            
            if let Err(e) = self.queue_task(task).await {
                error!("Failed to queue optimization task: {}", e);
            }
        }
    }
    
    /// Provider sync scheduler worker
    async fn sync_scheduler_worker(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(60)); // Check every minute
        
        loop {
            interval.tick().await;
            
            // Schedule syncs for each provider based on configured intervals
            for provider_id in self.get_enabled_provider_ids().await {
                if let Some(&sync_interval) = self.config.provider_sync_intervals.get(&provider_id) {
                    let last_sync = self.change_detector.provider_sync_times
                        .get(&provider_id)
                        .map(|entry| *entry.value())
                        .unwrap_or_else(|| Utc::now() - chrono::Duration::seconds(sync_interval as i64 + 1));
                    
                    let next_sync = last_sync + chrono::Duration::seconds(sync_interval as i64);
                    
                    if Utc::now() >= next_sync {
                        if let Err(e) = self.schedule_provider_sync(&provider_id, false).await {
                            error!("Failed to schedule sync for provider {}: {}", provider_id, e);
                        }
                    }
                }
            }
        }
    }
    
    /// Detect changes for a specific provider
    async fn detect_provider_changes(&self, provider_id: &str) -> SearchResultType<()> {
        // Simulate change detection (would query provider APIs)
        debug!("Detecting changes for provider: {}", provider_id);
        
        // Mock: Randomly detect some changes
        if rand::random::<f64>() < 0.3 {
            let change = ChangeEvent {
                id: uuid::Uuid::new_v4().to_string(),
                event_type: ChangeEventType::DocumentUpdated,
                document_id: format!("doc_{}_{}", provider_id, Utc::now().timestamp()),
                provider_id: provider_id.to_string(),
                timestamp: Utc::now(),
                metadata: HashMap::new(),
            };
            
            let mut changes_queue = self.change_detector.changes_queue.write().await;
            changes_queue.push_back(change);
            
            debug!("Change detected for provider: {}", provider_id);
        }
        
        Ok(())
    }
    
    /// Get list of enabled provider IDs
    async fn get_enabled_provider_ids(&self) -> Vec<String> {
        // Would get from provider manager
        vec!["gmail".to_string(), "slack".to_string(), "notion".to_string()]
    }
    
    /// Calculate document checksum for change detection
    fn calculate_document_checksum(&self, document: &SearchDocument) -> String {
        use sha2::{Sha256, Digest};
        
        let mut hasher = Sha256::new();
        hasher.update(document.title.as_bytes());
        hasher.update(document.content.as_bytes());
        hasher.update(document.last_modified.timestamp().to_string().as_bytes());
        
        format!("{:x}", hasher.finalize())
    }
}

impl ChangeDetector {
    fn new() -> Self {
        Self {
            document_checksums: Arc::new(DashMap::new()),
            provider_sync_times: Arc::new(DashMap::new()),
            changes_queue: Arc::new(RwLock::new(VecDeque::new())),
        }
    }
    
    /// Get pending changes
    pub async fn get_pending_changes(&self) -> Vec<ChangeEvent> {
        let mut queue = self.changes_queue.write().await;
        queue.drain(..).collect()
    }
}

impl Clone for RealTimeIndexManager {
    fn clone(&self) -> Self {
        Self {
            document_queue: Arc::clone(&self.document_queue),
            active_jobs: Arc::clone(&self.active_jobs),
            task_tracker: self.task_tracker.clone(),
            semaphore: Arc::clone(&self.semaphore),
            stats: Arc::clone(&self.stats),
            config: self.config.clone(),
            provider_manager: Arc::clone(&self.provider_manager),
            change_detector: Arc::clone(&self.change_detector),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_task_queuing() {
        // Test would require mock provider manager
        // let manager = RealTimeIndexManager::new(IndexingConfig::default(), mock_provider_manager).await.unwrap();
        // Test queuing and processing logic
    }
    
    #[tokio::test]
    async fn test_priority_queue() {
        // Test priority-based task ordering
    }
    
    #[tokio::test]
    async fn test_change_detection() {
        // Test change detection logic
    }
}