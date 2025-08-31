//! Local files search provider

use crate::search::{
    SearchQuery, SearchResult as SearchResultType, SearchError, SearchDocument, ProviderResponse,
    ContentType, ProviderType, DocumentMetadata, LocationInfo, SearchResult as SearchResultItem,
};
use super::{
    SearchProvider, ProviderInfo, ProviderCapabilities, AuthRequirements, AuthType, ProviderStats,
    ProviderHealth, HealthStatus, ProviderAuth, BaseProvider,
};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use serde_json::Value;
use tokio::fs;
use tracing::{debug, error, info, instrument};
use chrono::{DateTime, Utc};
use walkdir::WalkDir;
use sha2::{Sha256, Digest};

/// Local files search provider
pub struct LocalFilesProvider {
    /// Base provider functionality
    base: BaseProvider,
    
    /// Directories to index
    index_directories: Vec<PathBuf>,
    
    /// File extensions to index
    allowed_extensions: Vec<String>,
    
    /// Maximum file size to index (bytes)
    max_file_size: u64,
    
    /// Whether to follow symbolic links
    follow_symlinks: bool,
    
    /// Excluded directories/files
    exclusions: Vec<String>,
}

impl LocalFilesProvider {
    /// Create a new local files provider
    pub async fn new(config: Value) -> SearchResultType<Self> {
        let info = Self::get_provider_info();
        let base = BaseProvider::new(info);
        
        let provider = Self {
            base,
            index_directories: Vec::new(),
            allowed_extensions: Self::default_extensions(),
            max_file_size: 50 * 1024 * 1024, // 50MB
            follow_symlinks: false,
            exclusions: Self::default_exclusions(),
        };
        
        Ok(provider)
    }
    
    /// Get provider information
    pub fn get_provider_info() -> ProviderInfo {
        ProviderInfo {
            id: "local_files".to_string(),
            name: "Local Files".to_string(),
            description: "Search local files and documents".to_string(),
            provider_type: ProviderType::LocalFiles,
            version: "1.0.0".to_string(),
            supported_content_types: vec![
                ContentType::File,
                ContentType::Document,
                ContentType::Note,
            ],
            capabilities: ProviderCapabilities {
                real_time_search: false,
                incremental_indexing: true,
                full_text_search: true,
                metadata_search: true,
                faceted_search: true,
                max_results_per_query: 1000,
                rate_limit_rpm: None,
                pagination: true,
                sorting: true,
                filtering: true,
            },
            config_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "directories": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Directories to index"
                    },
                    "extensions": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "File extensions to include"
                    },
                    "max_file_size": {
                        "type": "number",
                        "description": "Maximum file size in bytes"
                    },
                    "follow_symlinks": {
                        "type": "boolean",
                        "description": "Follow symbolic links"
                    },
                    "exclusions": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Patterns to exclude"
                    }
                },
                "required": ["directories"]
            }),
            auth_requirements: AuthRequirements {
                auth_type: AuthType::None,
                required_scopes: Vec::new(),
                oauth_config: None,
                api_key_config: None,
            },
        }
    }
    
    /// Default file extensions to index
    fn default_extensions() -> Vec<String> {
        vec![
            "txt", "md", "rst", "doc", "docx", "pdf", "rtf",
            "html", "htm", "xml", "json", "yaml", "yml",
            "js", "ts", "py", "rs", "go", "java", "c", "cpp", "h",
            "css", "scss", "less", "sql",
        ].into_iter().map(|s| s.to_string()).collect()
    }
    
    /// Default exclusions
    fn default_exclusions() -> Vec<String> {
        vec![
            ".git", ".svn", ".hg", "node_modules", "target", "dist", "build",
            "*.tmp", "*.log", "*.cache", ".DS_Store", "Thumbs.db",
        ].into_iter().map(|s| s.to_string()).collect()
    }
    
    /// Check if file should be indexed
    fn should_index_file(&self, path: &Path) -> bool {
        // Check file extension
        if let Some(extension) = path.extension() {
            let ext_str = extension.to_string_lossy().to_lowercase();
            if !self.allowed_extensions.contains(&ext_str) {
                return false;
            }
        } else {
            // No extension - only index if it's a known text file
            return self.is_text_file(path);
        }
        
        // Check exclusions
        let path_str = path.to_string_lossy();
        for exclusion in &self.exclusions {
            if path_str.contains(exclusion) {
                return false;
            }
        }
        
        // Check file size
        if let Ok(metadata) = std::fs::metadata(path) {
            if metadata.len() > self.max_file_size {
                return false;
            }
        }
        
        true
    }
    
    /// Check if file is likely a text file (for files without extensions)
    fn is_text_file(&self, path: &Path) -> bool {
        // Read first few bytes to check if it's text
        if let Ok(bytes) = std::fs::read(path.to_path_buf()) {
            let sample_size = std::cmp::min(512, bytes.len());
            let sample = &bytes[..sample_size];
            
            // Check for binary content
            for &byte in sample {
                if byte == 0 || (byte < 32 && byte != 9 && byte != 10 && byte != 13) {
                    return false;
                }
            }
            
            // Try to decode as UTF-8
            std::str::from_utf8(sample).is_ok()
        } else {
            false
        }
    }
    
    /// Extract text content from file
    async fn extract_file_content(&self, path: &Path) -> SearchResultType<String> {
        match path.extension().and_then(|ext| ext.to_str()) {
            Some("pdf") => {
                // For PDF files, we'd use a PDF text extraction library
                // For now, return placeholder
                Ok("[PDF content extraction not implemented]".to_string())
            }
            Some("doc") | Some("docx") => {
                // For Word documents, we'd use a DOC/DOCX parser
                // For now, return placeholder
                Ok("[Word document content extraction not implemented]".to_string())
            }
            _ => {
                // For text files, read directly
                match fs::read_to_string(path).await {
                    Ok(content) => Ok(content),
                    Err(e) => {
                        debug!("Failed to read file {}: {}", path.display(), e);
                        Ok(String::new())
                    }
                }
            }
        }
    }
    
    /// Create search document from file
    async fn create_document_from_file(&self, path: &Path) -> SearchResultType<SearchDocument> {
        let metadata = fs::metadata(path).await?;
        let content = self.extract_file_content(path).await?;
        
        // Generate document ID based on file path and modification time
        let mut hasher = Sha256::new();
        hasher.update(path.to_string_lossy().as_bytes());
        hasher.update(metadata.modified()?.duration_since(std::time::UNIX_EPOCH)?.as_secs().to_le_bytes());
        let doc_id = format!("local_file_{:x}", hasher.finalize());
        
        // Extract file information
        let file_name = path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Unknown")
            .to_string();
        
        let file_extension = path.extension()
            .and_then(|ext| ext.to_str())
            .map(|s| s.to_string());
        
        // Create summary from first few lines
        let summary = content
            .lines()
            .take(3)
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(200)
            .collect::<String>();
        
        // Convert system time to DateTime<Utc>
        let created_at = DateTime::from(metadata.created().unwrap_or(metadata.modified()?));
        let last_modified = DateTime::from(metadata.modified()?);
        
        let doc_metadata = DocumentMetadata {
            size: Some(metadata.len()),
            file_type: file_extension.clone(),
            mime_type: self.get_mime_type(path),
            language: None,
            location: Some(LocationInfo {
                path: Some(path.to_string_lossy().to_string()),
                folder: path.parent().map(|p| p.to_string_lossy().to_string()),
                workspace: None,
                project: None,
            }),
            collaboration: None,
            activity: None,
            priority: None,
            status: None,
            custom: HashMap::new(),
        };
        
        // Determine content type based on file extension
        let content_type = match file_extension.as_deref() {
            Some("md") | Some("rst") | Some("txt") => ContentType::Note,
            Some("pdf") | Some("doc") | Some("docx") => ContentType::Document,
            _ => ContentType::File,
        };
        
        Ok(SearchDocument {
            id: doc_id,
            title: file_name,
            content,
            summary: if summary.is_empty() { None } else { Some(summary) },
            content_type,
            provider_id: self.base.info.id.clone(),
            provider_type: ProviderType::LocalFiles,
            url: Some(format!("file://{}", path.display())),
            icon: None,
            thumbnail: None,
            metadata: doc_metadata,
            tags: Vec::new(),
            categories: Vec::new(),
            author: None,
            created_at,
            last_modified,
            indexing_info: crate::search::IndexingInfo {
                indexed_at: Utc::now(),
                version: 1,
                checksum: format!("{:x}", hasher.finalize()),
                index_type: crate::search::IndexType::Full,
            },
        })
    }
    
    /// Get MIME type for file
    fn get_mime_type(&self, path: &Path) -> Option<String> {
        match path.extension().and_then(|ext| ext.to_str()) {
            Some("txt") => Some("text/plain".to_string()),
            Some("md") => Some("text/markdown".to_string()),
            Some("html") | Some("htm") => Some("text/html".to_string()),
            Some("json") => Some("application/json".to_string()),
            Some("xml") => Some("application/xml".to_string()),
            Some("pdf") => Some("application/pdf".to_string()),
            Some("doc") => Some("application/msword".to_string()),
            Some("docx") => Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string()),
            _ => None,
        }
    }
}

#[async_trait]
impl SearchProvider for LocalFilesProvider {
    fn get_info(&self) -> &ProviderInfo {
        &self.base.info
    }
    
    #[instrument(skip(self, config))]
    async fn initialize(&mut self, config: Value) -> SearchResultType<()> {
        info!("Initializing local files provider");
        
        self.base.config = config.clone();
        
        // Parse configuration
        if let Some(directories) = config.get("directories").and_then(|v| v.as_array()) {
            self.index_directories.clear();
            for dir in directories {
                if let Some(dir_str) = dir.as_str() {
                    self.index_directories.push(PathBuf::from(dir_str));
                }
            }
        }
        
        if let Some(extensions) = config.get("extensions").and_then(|v| v.as_array()) {
            self.allowed_extensions.clear();
            for ext in extensions {
                if let Some(ext_str) = ext.as_str() {
                    self.allowed_extensions.push(ext_str.to_string());
                }
            }
        }
        
        if let Some(max_size) = config.get("max_file_size").and_then(|v| v.as_u64()) {
            self.max_file_size = max_size;
        }
        
        if let Some(follow_links) = config.get("follow_symlinks").and_then(|v| v.as_bool()) {
            self.follow_symlinks = follow_links;
        }
        
        if let Some(exclusions) = config.get("exclusions").and_then(|v| v.as_array()) {
            self.exclusions.clear();
            for exclusion in exclusions {
                if let Some(exclusion_str) = exclusion.as_str() {
                    self.exclusions.push(exclusion_str.to_string());
                }
            }
        }
        
        // Validate that directories exist
        for dir in &self.index_directories {
            if !dir.exists() {
                return Err(SearchError::config_error(
                    format!("Directory does not exist: {}", dir.display())
                ));
            }
        }
        
        self.base.initialized = true;
        info!("Local files provider initialized with {} directories", self.index_directories.len());
        Ok(())
    }
    
    async fn is_ready(&self) -> bool {
        self.base.initialized && !self.index_directories.is_empty()
    }
    
    #[instrument(skip(self, query))]
    async fn search(&self, query: &SearchQuery) -> SearchResultType<ProviderResponse> {
        debug!("Searching local files for: {}", query.query);
        
        let start_time = std::time::Instant::now();
        
        // For local files, we don't have a separate search index
        // In a real implementation, we'd either:
        // 1. Use the main Tantivy index filtered by provider
        // 2. Maintain a separate local search index
        // 3. Do real-time file system search (for demo purposes)
        
        // For this example, we'll return a placeholder response
        let mut results = Vec::new();
        
        // Search through indexed files (simplified implementation)
        for dir in &self.index_directories {
            if results.len() >= query.limit.unwrap_or(50) {
                break;
            }
            
            for entry in WalkDir::new(dir)
                .follow_links(self.follow_symlinks)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter(|e| self.should_index_file(e.path()))
                .take(10) // Limit for demo
            {
                if let Ok(document) = self.create_document_from_file(entry.path()).await {
                    // Simple text matching for demo
                    if document.title.to_lowercase().contains(&query.query.to_lowercase()) ||
                       document.content.to_lowercase().contains(&query.query.to_lowercase()) {
                        
                        results.push(SearchResultItem {
                            id: document.id.clone(),
                            title: document.title.clone(),
                            description: document.summary.clone(),
                            content: Some(document.content.chars().take(500).collect()),
                            url: document.url.clone(),
                            icon: None,
                            thumbnail: None,
                            content_type: document.content_type.clone(),
                            provider_id: document.provider_id.clone(),
                            provider_type: document.provider_type.clone(),
                            score: 0.8, // Fixed score for demo
                            metadata: document.metadata.clone(),
                            highlights: None,
                            actions: None,
                            created_at: document.created_at,
                            last_modified: document.last_modified,
                        });
                        
                        if results.len() >= query.limit.unwrap_or(50) {
                            break;
                        }
                    }
                }
            }
        }
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        
        debug!("Local files search completed with {} results in {}ms", results.len(), execution_time);
        
        Ok(ProviderResponse {
            provider_id: self.base.info.id.clone(),
            provider_type: ProviderType::LocalFiles,
            results,
            execution_time_ms: execution_time,
            errors: Vec::new(),
            warnings: Vec::new(),
        })
    }
    
    #[instrument(skip(self))]
    async fn get_documents(&self, _last_sync: Option<DateTime<Utc>>) -> SearchResultType<Vec<SearchDocument>> {
        debug!("Getting documents from local files");
        
        let mut documents = Vec::new();
        
        for dir in &self.index_directories {
            for entry in WalkDir::new(dir)
                .follow_links(self.follow_symlinks)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter(|e| self.should_index_file(e.path()))
            {
                match self.create_document_from_file(entry.path()).await {
                    Ok(document) => documents.push(document),
                    Err(e) => {
                        error!("Failed to create document from {}: {}", entry.path().display(), e);
                    }
                }
            }
        }
        
        info!("Retrieved {} documents from local files", documents.len());
        Ok(documents)
    }
    
    async fn get_stats(&self) -> SearchResultType<ProviderStats> {
        Ok(self.base.stats.clone())
    }
    
    #[instrument(skip(self))]
    async fn health_check(&self) -> SearchResultType<ProviderHealth> {
        debug!("Performing health check for local files provider");
        
        let start_time = std::time::Instant::now();
        let mut issues = Vec::new();
        let mut details = HashMap::new();
        
        // Check if directories are accessible
        let mut accessible_dirs = 0;
        for dir in &self.index_directories {
            if dir.exists() && dir.is_dir() {
                accessible_dirs += 1;
            } else {
                issues.push(super::HealthIssue {
                    severity: super::IssueSeverity::Error,
                    message: format!("Directory not accessible: {}", dir.display()),
                    timestamp: Utc::now(),
                    context: None,
                });
            }
        }
        
        details.insert("total_directories".to_string(), 
                      Value::Number(self.index_directories.len().into()));
        details.insert("accessible_directories".to_string(), 
                      Value::Number(accessible_dirs.into()));
        
        let status = if accessible_dirs == self.index_directories.len() {
            HealthStatus::Healthy
        } else if accessible_dirs > 0 {
            HealthStatus::Degraded
        } else {
            HealthStatus::Unhealthy
        };
        
        let response_time = start_time.elapsed().as_millis() as u64;
        
        Ok(ProviderHealth {
            provider_id: self.base.info.id.clone(),
            status,
            last_check: Utc::now(),
            response_time_ms: response_time,
            details,
            issues,
        })
    }
    
    async fn authenticate(&mut self, _auth_data: HashMap<String, String>) -> SearchResultType<ProviderAuth> {
        // Local files provider doesn't require authentication
        Ok(ProviderAuth {
            provider_id: self.base.info.id.clone(),
            status: super::AuthStatus::Authenticated,
            access_token: None,
            refresh_token: None,
            expires_at: None,
            granted_scopes: Vec::new(),
            user_info: None,
        })
    }
    
    async fn refresh_auth(&mut self) -> SearchResultType<()> {
        // No authentication to refresh
        Ok(())
    }
    
    async fn shutdown(&mut self) -> SearchResultType<()> {
        info!("Shutting down local files provider");
        self.base.initialized = false;
        Ok(())
    }
}