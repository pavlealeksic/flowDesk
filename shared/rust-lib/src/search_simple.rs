//! Simplified Search Engine for Flow Desk
//!
//! This module provides a simplified search engine with NAPI bindings for Node.js integration.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tantivy::schema::*;
use tantivy::{doc, Index, ReloadPolicy};
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
// Removed unused import

/// Search document structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchDocument {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub metadata: String, // JSON string
    pub indexed_at: chrono::DateTime<chrono::Utc>,
}

/// Search result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub score: f64,
    pub metadata: String,
}

/// Simplified search engine using Tantivy
pub struct SearchEngine {
    index: Index,
    schema: Schema,
    id_field: Field,
    title_field: Field,
    content_field: Field,
    source_field: Field,
    metadata_field: Field,
    writer: tantivy::IndexWriter,
    documents: HashMap<String, SearchDocument>,
}

impl SearchEngine {
    /// Create new search engine
    pub fn new() -> Self {
        // Build schema
        let mut schema_builder = Schema::builder();
        
        let id_field = schema_builder.add_text_field("id", STRING | STORED);
        let title_field = schema_builder.add_text_field("title", TEXT | STORED);
        let content_field = schema_builder.add_text_field("content", TEXT);
        let source_field = schema_builder.add_text_field("source", STRING | STORED);
        let metadata_field = schema_builder.add_text_field("metadata", STORED);
        
        let schema = schema_builder.build();
        
        // Create in-memory index
        let index = Index::create_in_ram(schema.clone());
        let writer = index.writer(50_000_000).unwrap(); // 50MB buffer
        
        Self {
            index,
            schema,
            id_field,
            title_field,
            content_field,
            source_field,
            metadata_field,
            writer,
            documents: HashMap::new(),
        }
    }

    /// Initialize the search engine
    pub async fn initialize(&mut self) -> Result<(), String> {
        tracing::info!("Initializing simplified search engine");
        
        // Commit any pending changes
        self.writer.commit().map_err(|e| format!("Failed to initialize index: {}", e))?;
        
        Ok(())
    }

    /// Index a document
    pub async fn index_document(
        &mut self,
        id: &str,
        title: &str,
        content: &str,
        source: &str,
        metadata: &str,
    ) -> Result<(), String> {
        tracing::debug!("Indexing document: {} from {}", id, source);

        // Create Tantivy document
        let doc = doc!(
            self.id_field => id,
            self.title_field => title,
            self.content_field => content,
            self.source_field => source,
            self.metadata_field => metadata,
        );

        // Add to Tantivy index
        self.writer.add_document(doc)
            .map_err(|e| format!("Failed to add document to index: {}", e))?;

        // Store in local cache
        let search_doc = SearchDocument {
            id: id.to_string(),
            title: title.to_string(),
            content: content.to_string(),
            source: source.to_string(),
            metadata: metadata.to_string(),
            indexed_at: chrono::Utc::now(),
        };
        self.documents.insert(id.to_string(), search_doc);

        // Commit changes periodically (every 100 documents for performance)
        if self.documents.len() % 100 == 0 {
            self.writer.commit()
                .map_err(|e| format!("Failed to commit index: {}", e))?;
        }

        tracing::debug!("Successfully indexed document: {}", id);
        Ok(())
    }

    /// Search documents
    pub async fn search(&mut self, query: &str, limit: u32) -> Result<Vec<SearchResult>, String> {
        tracing::debug!("Searching for: '{}' with limit {}", query, limit);

        // Commit any pending changes first
        self.writer.commit()
            .map_err(|e| format!("Failed to commit before search: {}", e))?;

        // Get reader
        let reader = self.index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommit)
            .try_into()
            .map_err(|e| format!("Failed to create index reader: {}", e))?;

        let searcher = reader.searcher();

        // Create query parser
        let query_parser = QueryParser::for_index(&self.index, vec![self.title_field, self.content_field]);
        
        // Parse query
        let query = query_parser.parse_query(query)
            .map_err(|e| format!("Failed to parse query: {}", e))?;

        // Execute search
        let top_docs = searcher.search(&query, &TopDocs::with_limit(limit as usize))
            .map_err(|e| format!("Search execution failed: {}", e))?;

        // Convert results
        let mut results = Vec::new();
        for (score, doc_address) in top_docs {
            let retrieved_doc = searcher.doc(doc_address)
                .map_err(|e| format!("Failed to retrieve document: {}", e))?;

            let id = retrieved_doc
                .get_first(self.id_field)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();

            let title = retrieved_doc
                .get_first(self.title_field)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();

            let source = retrieved_doc
                .get_first(self.source_field)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();

            let metadata = retrieved_doc
                .get_first(self.metadata_field)
                .and_then(|v| v.as_text())
                .unwrap_or("")
                .to_string();

            // Get content from our cache since it's not stored in Tantivy
            let content = self.documents.get(&id)
                .map(|doc| doc.content.clone())
                .unwrap_or_default();

            results.push(SearchResult {
                id,
                title,
                content,
                source,
                score: score as f64,
                metadata,
            });
        }

        tracing::debug!("Found {} results for search query", results.len());
        Ok(results)
    }

    /// Remove a document from the index
    pub async fn remove_document(&mut self, id: &str) -> Result<(), String> {
        // Remove from Tantivy index
        let id_term = tantivy::Term::from_field_text(self.id_field, id);
        self.writer.delete_term(id_term);
        
        // Remove from local cache
        self.documents.remove(id);
        
        // Commit deletion
        self.writer.commit()
            .map_err(|e| format!("Failed to commit deletion: {}", e))?;
        
        tracing::debug!("Removed document: {}", id);
        Ok(())
    }

    /// Clear all documents from the index
    pub async fn clear_index(&mut self) -> Result<(), String> {
        // Delete all documents
        self.writer.delete_all_documents()
            .map_err(|e| format!("Failed to clear index: {}", e))?;
        
        // Clear local cache
        self.documents.clear();
        
        // Commit changes
        self.writer.commit()
            .map_err(|e| format!("Failed to commit clear operation: {}", e))?;
        
        tracing::info!("Cleared all documents from search index");
        Ok(())
    }

    /// Get statistics about the search engine
    pub fn get_stats(&self) -> HashMap<String, u64> {
        let mut stats = HashMap::new();
        stats.insert("total_documents".to_string(), self.documents.len() as u64);
        stats.insert("sources".to_string(), 
            self.documents.values()
                .map(|doc| doc.source.clone())
                .collect::<std::collections::HashSet<_>>()
                .len() as u64
        );
        stats
    }

    /// Index sample data for testing
    pub async fn index_sample_data(&mut self) -> Result<(), String> {
        tracing::info!("Indexing sample data");

        let samples = vec![
            ("1", "Getting Started with Flow Desk", "Welcome to Flow Desk! This guide will help you get started with your productivity workflow.", "docs", r#"{"type": "guide", "category": "getting-started"}"#),
            ("2", "Mail Integration Setup", "Learn how to connect your email accounts to Flow Desk for unified inbox management.", "docs", r#"{"type": "tutorial", "category": "mail"}"#),
            ("3", "Calendar Sync Configuration", "Configure calendar synchronization across multiple providers with privacy controls.", "docs", r#"{"type": "tutorial", "category": "calendar"}"#),
            ("4", "Search and Discovery", "Use powerful search features to find information across all your connected services.", "docs", r#"{"type": "feature", "category": "search"}"#),
            ("5", "Plugin Development", "Develop custom plugins to extend Flow Desk functionality for your specific needs.", "docs", r#"{"type": "development", "category": "plugins"}"#),
        ];

        let sample_count = samples.len();
        for (id, title, content, source, metadata) in samples {
            self.index_document(id, title, content, source, metadata).await?;
        }

        // Commit all sample data
        self.writer.commit()
            .map_err(|e| format!("Failed to commit sample data: {}", e))?;

        tracing::info!("Successfully indexed {} sample documents", sample_count);
        Ok(())
    }
}

impl Default for SearchEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_search_engine_basic_operations() {
        let mut engine = SearchEngine::new();
        engine.initialize().await.unwrap();

        // Index a document
        engine.index_document(
            "test-1",
            "Test Document",
            "This is a test document for search functionality",
            "test",
            r#"{"category": "test"}"#
        ).await.unwrap();

        // Search for the document
        let results = engine.search("test", 10).await.unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].id, "test-1");
        assert_eq!(results[0].title, "Test Document");

        // Get stats
        let stats = engine.get_stats();
        assert_eq!(stats.get("total_documents").unwrap(), &1);
    }

    #[tokio::test]
    async fn test_search_engine_sample_data() {
        let mut engine = SearchEngine::new();
        engine.initialize().await.unwrap();
        engine.index_sample_data().await.unwrap();

        // Search for mail-related content
        let results = engine.search("mail", 10).await.unwrap();
        assert!(!results.is_empty());
        
        // Search for calendar-related content
        let results = engine.search("calendar", 10).await.unwrap();
        assert!(!results.is_empty());

        // Get stats
        let stats = engine.get_stats();
        assert_eq!(stats.get("total_documents").unwrap(), &5);
    }
}