//! Search index management using Tantivy

use crate::search::{SearchDocument, SearchError, SearchResult as SearchResultType, IndexingJob, indexing::{IndexingJobStatus, IndexingTaskType}};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tantivy::{
    Index, IndexWriter, IndexReader, TantivyDocument, Term, TantivyError,
    schema::{Schema, Field, TextFieldIndexing, TextOptions, IndexRecordOption, STORED},
    Searcher, ReloadPolicy,
};
use tokio::sync::{RwLock, Mutex};
use dashmap::DashMap;
use parking_lot::Mutex as ParkingMutex;
use tracing::{info, error, debug, warn, instrument};
use chrono::{DateTime, Utc};

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
pub struct IndexFields {
    pub id: Field,
    pub title: Field,
    pub content: Field,
    pub summary: Field,
    pub content_type: Field,
    pub provider_id: Field,
    pub provider_type: Field,
    pub url: Field,
    pub author: Field,
    pub tags: Field,
    pub categories: Field,
    pub created_at: Field,
    pub last_modified: Field,
    pub metadata: Field,
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
    /// Validate if a directory contains a valid Tantivy index
    async fn validate_index_directory(path: &Path) -> bool {
        // Check for essential Tantivy index files
        let meta_path = path.join("meta.json");
        let managed_path = path.join(".managed.json");
        
        // At minimum, we need meta.json to exist for a valid index
        tokio::fs::metadata(&meta_path).await.is_ok()
    }
    
    /// Check if the error indicates missing index files
    fn is_missing_index_file_error(error: &TantivyError) -> bool {
        let error_msg = error.to_string();
        error_msg.contains("meta.json") 
            || error_msg.contains("FileDoesNotExist")
            || error_msg.contains("No such file")
            || match error {
                TantivyError::IoError(io_err) => io_err.kind() == std::io::ErrorKind::NotFound,
                _ => false
            }
    }
    
    /// Check if schemas are compatible
    fn is_schema_compatible(existing: &Schema, required: &Schema) -> bool {
        // For now, do a simple field count comparison
        // In production, you'd want more sophisticated schema compatibility checking
        existing.fields().count() >= required.fields().count()
    }
    
    /// Clean up and recreate index directory
    async fn recreate_index_directory(path: &Path) -> SearchResultType<()> {
        if path.exists() {
            if let Err(e) = tokio::fs::remove_dir_all(path).await {
                warn!("Failed to clean up index directory: {}", e);
                // Try to continue anyway
            }
        }
        
        tokio::fs::create_dir_all(path).await
            .map_err(|e| SearchError::index_error(format!(
                "Failed to create index directory at {:?}: {}", path, e
            )))?;
            
        Ok(())
    }
    /// Create a new index manager
    #[instrument(skip(index_dir))]
    pub async fn new(index_dir: &Path, max_memory_mb: u64) -> SearchResultType<Self> {
        info!("Initializing index manager at: {:?}", index_dir);
        
        // Normalize the index directory path (create absolute path if needed)
        let index_path = if index_dir.is_absolute() {
            index_dir.to_path_buf()
        } else {
            std::env::current_dir()
                .map_err(|e| SearchError::index_error(format!("Cannot get current directory: {}", e)))?
                .join(index_dir)
        };
        
        // Ensure index directory exists with proper permissions
        if let Err(e) = tokio::fs::create_dir_all(&index_path).await {
            error!("Failed to create index directory: {}", e);
            return Err(SearchError::index_error(format!(
                "Cannot create index directory at {:?}: {}", index_path, e
            )));
        }
        
        // Build schema first - we need this for both creating and opening indices
        let schema = Self::build_schema();
        let fields = Self::extract_fields(&schema);
        
        // Always try to create a fresh index first, fallback to opening existing if needed
        let main_index = match Index::create_in_dir(&index_path, schema.clone()) {
            Ok(index) => {
                info!("Successfully created new search index at: {:?}", index_path);
                index
            }
            Err(TantivyError::IndexAlreadyExists) => {
                // Index already exists, try to open it
                info!("Index already exists, attempting to open existing index");
                match Index::open_in_dir(&index_path) {
                    Ok(index) => {
                        info!("Successfully opened existing search index");
                        
                        // Verify that the opened index has a compatible schema
                        let existing_schema = index.schema();
                        if Self::is_schema_compatible(&existing_schema, &schema) {
                            index
                        } else {
                            warn!("Index schema is incompatible, recreating index");
                            Self::recreate_index_directory(&index_path).await?;
                            Index::create_in_dir(&index_path, schema.clone())
                                .map_err(|e| SearchError::index_error(format!("Failed to recreate index after schema mismatch: {}", e)))?
                        }
                    }
                    Err(ref e) if Self::is_missing_index_file_error(e) => {
                        warn!("Index files corrupted or missing ({}), recreating index", e);
                        Self::recreate_index_directory(&index_path).await?;
                        Index::create_in_dir(&index_path, schema.clone())
                            .map_err(|e| SearchError::index_error(format!("Failed to recreate index after corruption: {}", e)))?
                    }
                    Err(e) => {
                        error!("Failed to open existing index: {}", e);
                        warn!("Attempting to recreate index as fallback");
                        
                        // Clean up and try to create a fresh index
                        Self::recreate_index_directory(&index_path).await?;
                        
                        Index::create_in_dir(&index_path, schema.clone())
                            .map_err(|create_err| SearchError::index_error(format!(
                                "Failed to open existing index ({}) and failed to create new index ({})", 
                                e, create_err
                            )))?
                    }
                }
            }
            Err(e) => {
                error!("Failed to create new index: {}", e);
                return Err(SearchError::index_error(format!(
                    "Cannot create new index at {:?}: {}", index_path, e
                )));
            }
        };
        
        // Create index writer with memory budget
        let memory_budget = max_memory_mb * 1024 * 1024; // Convert MB to bytes
        let index_writer = main_index.writer(memory_budget as usize)?;
        
        // Create index reader with reload policy
        let index_reader = main_index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;
        
        let manager = Self {
            index_dir: index_path.clone(),
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
        
        // Log initialization success and status
        info!(
            "Index manager initialized successfully at {:?} with {} MB memory budget", 
            manager.index_dir, 
            max_memory_mb
        );
        
        // Log index statistics for debugging
        if let Ok(stats) = manager.get_stats().await {
            info!(
                "Index initialized with {} documents across {} segments", 
                stats.total_documents, 
                stats.segments_count
            );
        }
        
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
        let doc_opstamp = writer.add_document(tantivy_doc)?;
        
        // Commit the changes
        writer.commit()?;
        drop(writer);
        
        // Note: In newer Tantivy versions, add_document returns an OpStamp, not DocAddress
        // We rebuild the mapping from the index to maintain doc_id_map accuracy
        self.refresh_doc_id_mapping_for_document(&doc_id).await?;
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
                        Ok(_doc_opstamp) => {
                            // Note: add_document returns OpStamp in newer Tantivy
                            // We don't store it directly in doc_id_map
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
        
        // Rebuild doc_id_map for better accuracy after batch operations
        if added_count > 10 {
            // For large batches, rebuild the entire mapping
            self.rebuild_doc_id_map().await?;
        } else if added_count > 0 {
            // For small batches, do selective refresh
            self.selective_doc_id_mapping_refresh().await?;
        }
        
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
    
    /// Get the main index
    pub fn get_main_index(&self) -> &Arc<Index> {
        &self.main_index
    }
    
    /// Create a Tantivy document from a SearchDocument
    fn create_tantivy_document(&self, doc: &SearchDocument) -> SearchResultType<tantivy::TantivyDocument> {
        let mut tantivy_doc = tantivy::TantivyDocument::default();
        
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
                let doc_address = tantivy::DocAddress::new(0u32, doc_id); // Use 0 as segment ord for now
                // Use searcher to get document instead of segment_reader directly
                if let Ok(document) = searcher.doc::<TantivyDocument>(doc_address) {
                    if let Some(id_values) = document.get_first(self.fields.id) {
                        // For tantivy 0.25, try to get string value
                        let text = format!("{:?}", id_values).trim_matches('"').to_string();
                        if !text.is_empty() && text != "null" {
                            self.doc_id_map.insert(text, doc_address);
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
    
    /// Refresh doc_id mapping for a specific document by searching the index
    #[instrument(skip(self), fields(doc_id = %document_id))]
    async fn refresh_doc_id_mapping_for_document(&self, document_id: &str) -> SearchResultType<()> {
        let searcher = self.index_reader.searcher();
        let term_query = tantivy::query::TermQuery::new(
            Term::from_field_text(self.fields.id, document_id),
            tantivy::schema::IndexRecordOption::Basic,
        );
        
        // Search for the document
        let top_docs = searcher.search(&term_query, &tantivy::collector::TopDocs::with_limit(1))?;
        
        if let Some((_, doc_address)) = top_docs.first() {
            // Update the mapping with the found document address
            self.doc_id_map.insert(document_id.to_string(), *doc_address);
            debug!("Updated doc_id mapping for document: {}", document_id);
        } else {
            // Document not found, remove from mapping if it exists
            self.doc_id_map.remove(document_id);
            debug!("Document not found in index, removed from mapping: {}", document_id);
        }
        
        Ok(())
    }
    
    /// Perform selective refresh of doc_id mapping for better performance
    /// This method only refreshes mappings that might be stale
    async fn selective_doc_id_mapping_refresh(&self) -> SearchResultType<()> {
        debug!("Performing selective doc_id mapping refresh");
        
        let searcher = self.index_reader.searcher();
        let current_mapping_size = self.doc_id_map.len();
        let actual_doc_count = searcher.num_docs() as usize;
        
        // If there's a significant discrepancy, do a full rebuild
        if current_mapping_size.abs_diff(actual_doc_count) > 10 {
            warn!(
                "Significant discrepancy in doc_id mapping (mapped: {}, actual: {}), performing full rebuild",
                current_mapping_size, actual_doc_count
            );
            return self.rebuild_doc_id_map().await;
        }
        
        // Otherwise, verify a sample of existing mappings
        let mut invalid_mappings = Vec::new();
        let mut checked_count = 0;
        
        for entry in self.doc_id_map.iter() {
            let doc_id = entry.key();
            let doc_address = *entry.value();
            
            // Verify if the document still exists at this address
            match searcher.doc::<TantivyDocument>(doc_address) {
                Ok(document) => {
                    // Check if this is still the correct document
                    if let Some(id_values) = document.get_first(self.fields.id) {
                        let text = format!("{:?}", id_values).trim_matches('"').to_string();
                        if text != *doc_id {
                            invalid_mappings.push(doc_id.clone());
                        }
                    } else {
                        invalid_mappings.push(doc_id.clone());
                    }
                }
                Err(_) => {
                    // Document no longer exists at this address
                    invalid_mappings.push(doc_id.clone());
                }
            }
            
            checked_count += 1;
            // Only check a sample to avoid performance issues
            if checked_count >= 100 {
                break;
            }
        }
        
        // Remove invalid mappings and refresh them
        for doc_id in invalid_mappings {
            debug!("Refreshing invalid mapping for document: {}", doc_id);
            self.refresh_doc_id_mapping_for_document(&doc_id).await?;
        }
        
        debug!("Selective doc_id mapping refresh completed (checked {} documents)", checked_count);
        Ok(())
    }
    
    /// Find document by ID using efficient search
    /// This provides a reliable way to locate documents without relying on doc_id_map
    pub async fn find_document_by_id(&self, document_id: &str) -> SearchResultType<Option<(tantivy::DocAddress, TantivyDocument)>> {
        let searcher = self.index_reader.searcher();
        let term_query = tantivy::query::TermQuery::new(
            Term::from_field_text(self.fields.id, document_id),
            tantivy::schema::IndexRecordOption::Basic,
        );
        
        // Search for the document
        let top_docs = searcher.search(&term_query, &tantivy::collector::TopDocs::with_limit(1))?;
        
        if let Some((_, doc_address)) = top_docs.first() {
            match searcher.doc::<TantivyDocument>(*doc_address) {
                Ok(document) => {
                    // Update the mapping while we have the information
                    self.doc_id_map.insert(document_id.to_string(), *doc_address);
                    Ok(Some((*doc_address, document)))
                }
                Err(e) => Err(SearchError::from(e))
            }
        } else {
            Ok(None)
        }
    }
    
    /// Get document count from mapping (with automatic refresh if needed)
    pub async fn get_mapped_document_count(&self) -> SearchResultType<usize> {
        let searcher = self.index_reader.searcher();
        let actual_count = searcher.num_docs() as usize;
        let mapped_count = self.doc_id_map.len();
        
        // If there's a significant discrepancy, refresh and return accurate count
        if mapped_count.abs_diff(actual_count) > 5 {
            debug!("Document count discrepancy detected, refreshing mapping");
            self.selective_doc_id_mapping_refresh().await?;
            Ok(self.doc_id_map.len())
        } else {
            Ok(mapped_count)
        }
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
        info!("Executing indexing job: {:?}", job.task.task_type);
        
        job.status = IndexingJobStatus::Running;
        job.started_at = Utc::now();
        
        let result = match job.task.task_type {
            IndexingTaskType::OptimizeIndices => {
                self.index_manager.optimize().await
            }
            _ => {
                // Other job types would be implemented here
                Ok(())
            }
        };
        
        match result {
            Ok(()) => {
                job.status = IndexingJobStatus::Completed;
                job.progress = 1.0;
                info!("Indexing job completed successfully");
            }
            Err(e) => {
                job.status = IndexingJobStatus::Failed;
                error!("Indexing job failed: {}", e);
                job.errors.push(format!("Indexing failed: {}", e));
            }
        }
        
        job.completed_at = Some(Utc::now());
        Ok(job)
    }
}