//! Test module for verifying search engine initialization fixes

#[cfg(test)]
mod tests {
    use super::super::*;
    use tempfile::TempDir;
    use std::path::PathBuf;

    #[tokio::test]
    async fn test_search_engine_init_new_index() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory for test");
        let config = SearchConfig {
            index_dir: temp_dir.path().to_path_buf(),
            max_memory_mb: 64, // Use small memory for test
            max_response_time_ms: 1000,
            num_threads: 1,
            enable_analytics: false,
            enable_suggestions: false,
            enable_realtime: false,
            providers: Vec::new(),
        };
        
        // This should successfully create a new index
        let engine = SearchEngine::new(config).await;
        assert!(engine.is_ok(), "Failed to create search engine: {:?}", engine.err());
        
        let engine = engine.unwrap();
        let status = engine.get_health_status().await;
        assert!(status.is_healthy, "Search engine is not healthy");
    }

    #[tokio::test]
    async fn test_index_manager_init_empty_directory() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory for test");
        
        // This should successfully create a new index in an empty directory
        let index_manager = IndexManager::new(temp_dir.path(), 64).await;
        assert!(index_manager.is_ok(), "Failed to create IndexManager: {:?}", index_manager.err());
        
        let index_manager = index_manager.unwrap();
        let stats = index_manager.get_stats().await;
        assert!(stats.is_ok(), "Failed to get index stats: {:?}", stats.err());
        
        let stats = stats.unwrap();
        assert_eq!(stats.total_documents, 0, "New index should have 0 documents");
    }

    #[tokio::test]
    async fn test_index_manager_recreate_corrupted_index() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory for test");
        let index_path = temp_dir.path();
        
        // Create a corrupted index directory with some files but no proper meta.json
        tokio::fs::create_dir_all(index_path).await.unwrap();
        tokio::fs::write(index_path.join("garbage.file"), b"invalid content").await.unwrap();
        tokio::fs::write(index_path.join("meta.json.backup"), b"not the real meta.json").await.unwrap();
        
        // This should detect the corruption and create a fresh index
        let index_manager = IndexManager::new(index_path, 64).await;
        assert!(index_manager.is_ok(), "Failed to handle corrupted index: {:?}", index_manager.err());
        
        let index_manager = index_manager.unwrap();
        let is_healthy = index_manager.is_healthy().await;
        assert!(is_healthy.is_ok() && is_healthy.unwrap(), "Recreated index should be healthy");
    }

    #[tokio::test]
    async fn test_search_document_indexing() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory for test");
        let config = SearchConfig {
            index_dir: temp_dir.path().to_path_buf(),
            max_memory_mb: 64,
            max_response_time_ms: 1000,
            num_threads: 1,
            enable_analytics: false,
            enable_suggestions: false,
            enable_realtime: false,
            providers: Vec::new(),
        };
        
        let engine = SearchEngine::new(config).await.expect("Failed to create search engine");
        
        // Create a test document
        let test_doc = SearchDocument {
            id: "test_doc_1".to_string(),
            title: "Test Document".to_string(),
            content: "This is a test document for verifying search functionality".to_string(),
            summary: Some("Test document summary".to_string()),
            content_type: ContentType::Document,
            provider_id: "test_provider".to_string(),
            provider_type: ProviderType::LocalFiles,
            account_id: None,
            file_path: None,
            url: None,
            icon: None,
            thumbnail: None,
            metadata: DocumentMetadata::default(),
            tags: vec!["test".to_string(), "document".to_string()],
            categories: vec!["testing".to_string()],
            author: Some("Test Author".to_string()),
            created_at: chrono::Utc::now(),
            last_modified: chrono::Utc::now(),
            indexing_info: IndexingInfo {
                indexed_at: chrono::Utc::now(),
                version: 1,
                checksum: "test_checksum".to_string(),
                index_type: IndexType::Full,
            },
        };
        
        // Index the document
        let result = engine.index_document(test_doc).await;
        assert!(result.is_ok(), "Failed to index document: {:?}", result.err());
        
        // Verify the document was indexed
        let health_status = engine.get_health_status().await;
        assert!(health_status.is_healthy, "Engine should be healthy after indexing");
        assert_eq!(health_status.total_documents, 1, "Should have 1 document indexed");
    }
}