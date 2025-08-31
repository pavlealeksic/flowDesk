//! Search index management using Tantivy

use crate::search::{SearchDocument, SearchError, SearchResult as SearchResultType, IndexingJob, IndexingJobType, JobStatus};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tantivy::{
    Index, IndexWriter, IndexReader, Document, Term, TantivyError,
    schema::{Schema, Field, TextFieldIndexing, TextOptions, IndexRecordOption, STORED, INDEXED, STRING},
    query::{Query, QueryParser, TermQuery, BooleanQuery, Occur},
    collector::{TopDocs, FacetCollector},
    fastfield::FastFieldReaders,
    Searcher, ReloadPolicy, SegmentReader,
};
use tokio::sync::{RwLock, Mutex};
use dashmap::DashMap;
use parking_lot::Mutex as ParkingMutex;
use tracing::{info, error, debug, warn, instrument};
use chrono::{DateTime, Utc};
use uuid::Uuid;

/// Index manager for all search operations
pub struct IndexManager {
    /// Base directory for indices
    index_dir: PathBuf,
    
    /// Main search index
    main_index: Arc<Index>,
    
    /// Index schema
    schema: Schema,
    
    /// Schema fields for efficient access
    fields: IndexFields,
    
    /// Index writer for adding/updating documents
    index_writer: Arc<Mutex<IndexWriter>>,
    
    /// Index reader for searching
    index_reader: Arc<IndexReader>,
    
    /// Document ID to Tantivy DocAddress mapping
    doc_id_map: Arc<DashMap<String, tantivy::DocAddress>>,
    
    /// Index statistics
    stats: Arc<RwLock<IndexStats>>,
    
    /// Background indexing jobs
    indexing_jobs: Arc<ParkingMutex<Vec<IndexingJob>>>,
}

/// Schema fields for efficient access
#[derive(Debug, Clone)]
struct IndexFields {
    id: Field,
    title: Field,
    content: Field,
    summary: Field,
    content_type: Field,
    provider_id: Field,
    provider_type: Field,
    url: Field,
    author: Field,
    tags: Field,
    categories: Field,
    created_at: Field,
    last_modified: Field,
    metadata: Field,
}

/// Index statistics
#[derive(Debug, Clone)]
struct IndexStats {
    total_documents: u64,
    index_size_bytes: u64,
    last_optimization: Option<DateTime<Utc>>,
    last_commit: Option<DateTime<Utc>>,
    commits_count: u64,
    segments_count: u64,
}

impl Default for IndexStats {
    fn default() -> Self {
        Self {
            total_documents: 0,
            index_size_bytes: 0,
            last_optimization: None,
            last_commit: None,
            commits_count: 0,
            segments_count: 0,
        }
    }
}

impl IndexManager {
    /// Create a new index manager
    #[instrument(skip(index_dir))]
    pub async fn new(index_dir: &Path, max_memory_mb: u64) -> SearchResultType<Self> {
        info!("Initializing index manager at: {:?}", index_dir);
        
        // Ensure index directory exists
        tokio::fs::create_dir_all(index_dir).await?;
        
        // Build schema
        let schema = Self::build_schema();
        let fields = Self::extract_fields(&schema);
        
        // Create or open index
        let main_index = match Index::open_in_dir(index_dir) {
            Ok(index) => {
                info!("Opened existing search index");
                index
            }
            Err(TantivyError::OpenDirectoryError(_)) => {
                info!("Creating new search index");
                Index::create_in_dir(index_dir, schema.clone())?
            }
            Err(e) => return Err(SearchError::from(e)),
        };
        
        // Create index writer with memory budget
        let memory_budget = max_memory_mb * 1024 * 1024; // Convert MB to bytes
        let index_writer = main_index.writer(memory_budget as usize)?;
        
        // Create index reader with reload policy
        let index_reader = main_index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommit)
            .try_into()?;
        
        let manager = Self {
            index_dir: index_dir.to_path_buf(),
            main_index: Arc::new(main_index),
            schema,
            fields,
            index_writer: Arc::new(Mutex::new(index_writer)),
            index_reader: Arc::new(index_reader),
            doc_id_map: Arc::new(DashMap::new()),
            stats: Arc::new(RwLock::new(IndexStats::default())),
            indexing_jobs: Arc::new(ParkingMutex::new(Vec::new())),
        };
        
        // Load existing documents into doc_id_map
        manager.rebuild_doc_id_map().await?;
        
        // Update initial stats
        manager.update_stats().await?;
        
        info!("Index manager initialized successfully");
        Ok(manager)
    }
    
    /// Add a single document to the index
    #[instrument(skip(self, document), fields(doc_id = %document.id))]
    pub async fn add_document(&self, document: SearchDocument) -> SearchResultType<()> {
        debug!("Adding document to index: {}", document.id);
        
        let tantivy_doc = self.create_tantivy_document(&document)?;
        let doc_id = document.id.clone();
        
        let mut writer = self.index_writer.lock().await;
        
        // Remove existing document if it exists
        if self.doc_id_map.contains_key(&doc_id) {
            let term = Term::from_field_text(self.fields.id, &doc_id);
            writer.delete_term(term);
        }
        
        // Add the new document
        let doc_address = writer.add_document(tantivy_doc)?;
        
        // Commit the changes
        writer.commit()?;
        drop(writer);
        
        // Update mappings and stats
        self.doc_id_map.insert(doc_id, doc_address);
        self.update_stats().await?;
        
        debug!("Document added successfully");
        Ok(())
    }
    
    /// Add multiple documents in batch
    #[instrument(skip(self, documents), fields(doc_count = documents.len()))]
    pub async fn add_documents(&self, documents: Vec<SearchDocument>) -> SearchResultType<usize> {
        if documents.is_empty() {
            return Ok(0);
        }
        
        info!("Batch adding {} documents to index", documents.len());
        
        let mut writer = self.index_writer.lock().await;
        let mut added_count = 0;
        
        for document in documents {
            match self.create_tantivy_document(&document) {
                Ok(tantivy_doc) => {
                    let doc_id = document.id.clone();
                    
                    // Remove existing document if it exists
                    if self.doc_id_map.contains_key(&doc_id) {
                        let term = Term::from_field_text(self.fields.id, &doc_id);
                        writer.delete_term(term);
                    }
                    
                    // Add the new document
                    match writer.add_document(tantivy_doc) {
                        Ok(doc_address) => {
                            self.doc_id_map.insert(doc_id, doc_address);
                            added_count += 1;
                        }
                        Err(e) => {
                            error!("Failed to add document {}: {}", document.id, e);
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to create Tantivy document for {}: {}", document.id, e);
                }
            }
        }
        
        // Commit all changes
        if added_count > 0 {
            writer.commit()?;
        }
        drop(writer);
        
        // Update stats
        self.update_stats().await?;
        
        info!("Batch added {} documents successfully", added_count);
        Ok(added_count)
    }
    
    /// Update an existing document
    #[instrument(skip(self, document), fields(doc_id = %document.id))]
    pub async fn update_document(&self, document: SearchDocument) -> SearchResultType<()> {
        debug!("Updating document in index: {}", document.id);
        
        // For Tantivy, update is effectively delete + add
        self.add_document(document).await
    }
    
    /// Delete a document from the index
    #[instrument(skip(self), fields(doc_id = %document_id))]
    pub async fn delete_document(&self, document_id: &str) -> SearchResultType<bool> {
        debug!("Deleting document from index: {}", document_id);
        
        if !self.doc_id_map.contains_key(document_id) {
            debug!("Document not found in index: {}", document_id);
            return Ok(false);
        }
        
        let mut writer = self.index_writer.lock().await;
        let term = Term::from_field_text(self.fields.id, document_id);
        writer.delete_term(term);
        writer.commit()?;
        drop(writer);
        
        // Remove from mapping
        self.doc_id_map.remove(document_id);
        
        // Update stats
        self.update_stats().await?;
        
        debug!("Document deleted successfully");
        Ok(true)
    }
    
    /// Get index statistics
    pub async fn get_stats(&self) -> SearchResultType<IndexStats> {
        let stats = self.stats.read().await;
        Ok(stats.clone())
    }
    
    /// Check if index is healthy
    pub async fn is_healthy(&self) -> SearchResultType<bool> {
        // Basic health checks
        let searcher = self.index_reader.searcher();
        let segment_readers = searcher.segment_readers();
        
        // Check if we can read from all segments
        for segment_reader in segment_readers {
            if segment_reader.num_docs() == 0 && segment_reader.max_doc() > 0 {
                // This might indicate corruption
                warn!("Segment with max_doc > 0 but num_docs = 0 detected");
                return Ok(false);
            }
        }
        
        Ok(true)
    }
    
    /// Optimize the index
    #[instrument(skip(self))]
    pub async fn optimize(&self) -> SearchResultType<()> {
        info!("Starting index optimization");
        
        let mut writer = self.index_writer.lock().await;
        
        // Wait for all merging threads to finish
        writer.wait_merging_threads()?;
        
        // Commit any pending changes
        writer.commit()?;
        drop(writer);
        
        // Update stats
        {
            let mut stats = self.stats.write().await;
            stats.last_optimization = Some(Utc::now());
        }
        
        info!("Index optimization completed");
        Ok(())
    }
    
    /// Get the Tantivy searcher
    pub fn get_searcher(&self) -> Searcher {
        self.index_reader.searcher()
    }
    
    /// Get the schema
    pub fn get_schema(&self) -> &Schema {
        &self.schema
    }
    
    /// Get the index fields
    pub fn get_fields(&self) -> &IndexFields {
        &self.fields
    }
    
    /// Create a Tantivy document from a SearchDocument
    fn create_tantivy_document(&self, doc: &SearchDocument) -> SearchResultType<Document> {
        let mut tantivy_doc = Document::default();
        
        // Add required fields
        tantivy_doc.add_text(self.fields.id, &doc.id);
        tantivy_doc.add_text(self.fields.title, &doc.title);
        tantivy_doc.add_text(self.fields.content, &doc.content);
        
        if let Some(summary) = &doc.summary {
            tantivy_doc.add_text(self.fields.summary, summary);
        }
        
        tantivy_doc.add_text(self.fields.content_type, doc.content_type.as_str());
        tantivy_doc.add_text(self.fields.provider_id, &doc.provider_id);
        tantivy_doc.add_text(self.fields.provider_type, doc.provider_type.as_str());
        
        if let Some(url) = &doc.url {
            tantivy_doc.add_text(self.fields.url, url);
        }
        
        if let Some(author) = &doc.author {
            tantivy_doc.add_text(self.fields.author, author);
        }
        
        // Add tags
        for tag in &doc.tags {
            tantivy_doc.add_text(self.fields.tags, tag);
        }
        
        // Add categories
        for category in &doc.categories {
            tantivy_doc.add_text(self.fields.categories, category);
        }
        
        // Add timestamps as strings (Tantivy doesn't have native date support in this version)
        tantivy_doc.add_text(self.fields.created_at, &doc.created_at.to_rfc3339());
        tantivy_doc.add_text(self.fields.last_modified, &doc.last_modified.to_rfc3339());
        
        // Add metadata as JSON
        let metadata_json = serde_json::to_string(&doc.metadata)
            .map_err(|e| SearchError::SerializationError(e))?;
        tantivy_doc.add_text(self.fields.metadata, &metadata_json);
        
        Ok(tantivy_doc)
    }
    
    /// Build the search schema
    fn build_schema() -> Schema {
        let mut schema_builder = Schema::builder();
        
        // Text fields with full-text search
        let text_indexing = TextFieldIndexing::default()
            .set_tokenizer("en_stem")
            .set_index_option(IndexRecordOption::WithFreqsAndPositions);
        let text_options = TextOptions::default()
            .set_indexing_options(text_indexing)
            .set_stored();
        
        // String fields for exact matching
        let string_options = TextOptions::default()
            .set_indexing_options(TextFieldIndexing::default().set_tokenizer("raw"))
            .set_stored();
        
        // Add fields
        schema_builder.add_text_field("id", string_options.clone());
        schema_builder.add_text_field("title", text_options.clone());
        schema_builder.add_text_field("content", text_options.clone());
        schema_builder.add_text_field("summary", text_options.clone());
        schema_builder.add_text_field("content_type", string_options.clone());
        schema_builder.add_text_field("provider_id", string_options.clone());
        schema_builder.add_text_field("provider_type", string_options.clone());
        schema_builder.add_text_field("url", string_options.clone());
        schema_builder.add_text_field("author", text_options.clone());
        schema_builder.add_text_field("tags", text_options.clone());
        schema_builder.add_text_field("categories", text_options.clone());
        schema_builder.add_text_field("created_at", string_options.clone());
        schema_builder.add_text_field("last_modified", string_options.clone());
        schema_builder.add_text_field("metadata", STORED);
        
        schema_builder.build()
    }
    
    /// Extract field references from schema
    fn extract_fields(schema: &Schema) -> IndexFields {
        IndexFields {
            id: schema.get_field("id").unwrap(),
            title: schema.get_field("title").unwrap(),
            content: schema.get_field("content").unwrap(),
            summary: schema.get_field("summary").unwrap(),
            content_type: schema.get_field("content_type").unwrap(),
            provider_id: schema.get_field("provider_id").unwrap(),
            provider_type: schema.get_field("provider_type").unwrap(),
            url: schema.get_field("url").unwrap(),
            author: schema.get_field("author").unwrap(),
            tags: schema.get_field("tags").unwrap(),
            categories: schema.get_field("categories").unwrap(),
            created_at: schema.get_field("created_at").unwrap(),
            last_modified: schema.get_field("last_modified").unwrap(),
            metadata: schema.get_field("metadata").unwrap(),
        }
    }
    
    /// Rebuild document ID mapping from existing index
    async fn rebuild_doc_id_map(&self) -> SearchResultType<()> {
        info!("Rebuilding document ID mapping");
        
        let searcher = self.index_reader.searcher();
        
        for segment_reader in searcher.segment_readers() {
            let fast_field_readers = segment_reader.fast_fields();
            
            for doc_id in 0..segment_reader.num_docs() {
                if let Ok(doc_address) = segment_reader.doc(doc_id) {
                    if let Some(id_values) = doc_address.get_all(self.fields.id).first() {
                        if let Some(id_text) = id_values.as_text() {
                            let doc_address = tantivy::DocAddress::new(segment_reader.segment_id(), doc_id);
                            self.doc_id_map.insert(id_text.to_string(), doc_address);
                        }
                    }
                }
            }
        }
        
        info!("Document ID mapping rebuilt with {} entries", self.doc_id_map.len());
        Ok(())
    }
    
    /// Update index statistics
    async fn update_stats(&self) -> SearchResultType<()> {
        let searcher = self.index_reader.searcher();
        let mut stats = self.stats.write().await;
        
        // Count total documents
        stats.total_documents = searcher.num_docs() as u64;
        
        // Count segments
        stats.segments_count = searcher.segment_readers().len() as u64;
        
        // Calculate approximate index size
        let mut total_size = 0;
        for segment_reader in searcher.segment_readers() {
            // This is an approximation - in reality we'd need to check file sizes
            total_size += segment_reader.num_docs() * 1024; // Rough estimate
        }
        stats.index_size_bytes = total_size as u64;
        
        stats.last_commit = Some(Utc::now());
        stats.commits_count += 1;
        
        Ok(())
    }
}

/// Background indexing job execution
pub struct IndexingJobExecutor {
    index_manager: Arc<IndexManager>,
}

impl IndexingJobExecutor {
    pub fn new(index_manager: Arc<IndexManager>) -> Self {
        Self { index_manager }
    }
    
    /// Execute an indexing job
    #[instrument(skip(self, job))]
    pub async fn execute_job(&self, mut job: IndexingJob) -> SearchResultType<IndexingJob> {
        info!("Executing indexing job: {:?}", job.job_type);
        
        job.status = JobStatus::Running;
        job.started_at = Some(Utc::now());
        
        let result = match job.job_type {
            IndexingJobType::OptimizeIndex => {
                self.index_manager.optimize().await
            }
            _ => {
                // Other job types would be implemented here
                Ok(())
            }
        };
        
        match result {
            Ok(()) => {
                job.status = JobStatus::Completed;
                job.progress = 1.0;
                info!("Indexing job completed successfully");
            }
            Err(e) => {
                job.status = JobStatus::Failed;
                error!("Indexing job failed: {}", e);
                job.errors.push(crate::search::JobError {
                    document_id: None,
                    error_message: e.to_string(),
                    timestamp: Utc::now(),
                });
            }
        }
        
        job.completed_at = Some(Utc::now());
        Ok(job)
    }
}