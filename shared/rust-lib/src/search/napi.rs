//! Node.js API bindings for the search engine

#[cfg(feature = "napi")]
pub mod bindings {
    use crate::search::{
        SearchEngine, SearchConfig, SearchQuery, SearchDocument, SearchResponse,
        SearchOptions, ContentType, ProviderType, ProviderConfig,
    };
    use napi::bindgen_prelude::*;
    use napi_derive::napi;
    use std::path::PathBuf;
    use std::collections::HashMap;
    use serde_json::Value;
    use tokio::sync::RwLock;
    use std::sync::Arc;

    /// JavaScript-friendly search engine wrapper
    #[napi]
    pub struct JsSearchEngine {
        engine: Arc<RwLock<Option<SearchEngine>>>,
    }

    /// JavaScript-friendly search configuration
    #[napi(object)]
    pub struct JsSearchConfig {
        pub index_dir: String,
        pub max_memory_mb: Option<u32>,
        pub max_response_time_ms: Option<u32>,
        pub num_threads: Option<u32>,
        pub enable_analytics: Option<bool>,
        pub enable_suggestions: Option<bool>,
        pub enable_realtime: Option<bool>,
        pub providers: Option<Vec<JsProviderConfig>>,
    }

    /// JavaScript-friendly provider configuration
    #[napi(object)]
    pub struct JsProviderConfig {
        pub id: String,
        pub provider_type: String,
        pub enabled: bool,
        pub weight: Option<f64>,
        pub config: Option<String>,
    }

    /// JavaScript-friendly search query
    #[napi(object)]
    pub struct JsSearchQuery {
        pub query: String,
        pub content_types: Option<Vec<String>>,
        pub provider_ids: Option<Vec<String>>,
        pub limit: Option<u32>,
        pub offset: Option<u32>,
        pub fuzzy: Option<bool>,
        pub highlighting: Option<bool>,
        pub suggestions: Option<bool>,
        pub timeout: Option<u32>,
    }

    /// JavaScript-friendly search document
    #[napi(object)]
    pub struct JsSearchDocument {
        pub id: String,
        pub title: String,
        pub content: String,
        pub summary: Option<String>,
        pub content_type: String,
        pub provider_id: String,
        pub provider_type: String,
        pub url: Option<String>,
        pub author: Option<String>,
        pub tags: Option<Vec<String>>,
        pub categories: Option<Vec<String>>,
        pub metadata: Option<String>,
    }

    /// JavaScript-friendly search result
    #[napi(object)]
    pub struct JsSearchResult {
        pub id: String,
        pub title: String,
        pub description: Option<String>,
        pub content: Option<String>,
        pub url: Option<String>,
        pub content_type: String,
        pub provider_id: String,
        pub provider_type: String,
        pub score: f64,
        pub highlights: Option<Vec<JsSearchHighlight>>,
        pub created_at: String,
        pub last_modified: String,
    }

    /// JavaScript-friendly search highlight
    #[napi(object)]
    pub struct JsSearchHighlight {
        pub field: String,
        pub fragments: Vec<String>,
    }

    /// JavaScript-friendly search response
    #[napi(object)]
    pub struct JsSearchResponse {
        pub results: Vec<JsSearchResult>,
        pub total_count: u32,
        pub execution_time_ms: u32,
        pub suggestions: Option<Vec<String>>,
    }

    /// JavaScript-friendly search analytics
    #[napi(object)]
    pub struct JsSearchAnalytics {
        pub total_queries: u32,
        pub avg_response_time_ms: f64,
        pub success_rate: f64,
        pub popular_queries: Vec<String>,
        pub error_rate: f64,
    }

    #[napi]
    impl JsSearchEngine {
        /// Create a new search engine instance
        #[napi(constructor)]
        pub fn new() -> Self {
            Self {
                engine: Arc::new(RwLock::new(None)),
            }
        }

        /// Initialize the search engine with configuration
        #[napi]
        pub async fn initialize(&self, config: JsSearchConfig) -> napi::Result<()> {
            let rust_config = self.convert_config(config)?;
            
            match crate::search::init_search_system(rust_config).await {
                Ok(engine) => {
                    let mut engine_guard = self.engine.write().await;
                    *engine_guard = Some(engine);
                    Ok(())
                }
                Err(e) => Err(napi::Error::from_reason(format!("Failed to initialize search engine: {}", e))),
            }
        }

        /// Execute a search query
        #[napi]
        pub async fn search(&self, query: JsSearchQuery) -> napi::Result<JsSearchResponse> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            let rust_query = self.convert_query(query)?;

            match engine.search(rust_query).await {
                Ok(response) => Ok(self.convert_response(response)),
                Err(e) => Err(napi::Error::from_reason(format!("Search failed: {}", e))),
            }
        }

        /// Index a single document
        #[napi]
        pub async fn index_document(&self, document: JsSearchDocument) -> napi::Result<()> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            let rust_document = self.convert_document(document)?;

            match engine.index_document(rust_document).await {
                Ok(()) => Ok(()),
                Err(e) => Err(napi::Error::from_reason(format!("Indexing failed: {}", e))),
            }
        }

        /// Index multiple documents
        #[napi]
        pub async fn index_documents(&self, documents: Vec<JsSearchDocument>) -> napi::Result<u32> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            let rust_documents: Result<Vec<_>, _> = documents
                .into_iter()
                .map(|doc| self.convert_document(doc))
                .collect();

            let rust_documents = rust_documents?;

            match engine.index_documents(rust_documents).await {
                Ok(count) => Ok(count as u32),
                Err(e) => Err(napi::Error::from_reason(format!("Batch indexing failed: {}", e))),
            }
        }

        /// Delete a document from the index
        #[napi]
        pub async fn delete_document(&self, document_id: String) -> napi::Result<bool> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            match engine.delete_document(&document_id).await {
                Ok(deleted) => Ok(deleted),
                Err(e) => Err(napi::Error::from_reason(format!("Delete failed: {}", e))),
            }
        }

        /// Get search suggestions
        #[napi]
        pub async fn get_suggestions(&self, partial_query: String, limit: Option<u32>) -> napi::Result<Vec<String>> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            let limit = limit.unwrap_or(10) as usize;

            match engine.get_suggestions(&partial_query, limit).await {
                Ok(suggestions) => Ok(suggestions),
                Err(e) => Err(napi::Error::from_reason(format!("Suggestions failed: {}", e))),
            }
        }

        /// Get search analytics
        #[napi]
        pub async fn get_analytics(&self) -> napi::Result<JsSearchAnalytics> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            match engine.get_analytics().await {
                Ok(analytics) => Ok(self.convert_analytics(analytics)),
                Err(e) => Err(napi::Error::from_reason(format!("Analytics failed: {}", e))),
            }
        }

        /// Optimize search indices
        #[napi]
        pub async fn optimize_indices(&self) -> napi::Result<()> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            match engine.optimize_indices().await {
                Ok(()) => Ok(()),
                Err(e) => Err(napi::Error::from_reason(format!("Optimization failed: {}", e))),
            }
        }

        /// Clear search cache
        #[napi]
        pub async fn clear_cache(&self) -> napi::Result<()> {
            let engine_guard = self.engine.read().await;
            let engine = engine_guard
                .as_ref()
                .ok_or_else(|| napi::Error::from_reason("Search engine not initialized"))?;

            engine.clear_cache().await;
            Ok(())
        }

        // Helper methods for conversion
        fn convert_config(&self, config: JsSearchConfig) -> napi::Result<SearchConfig> {
            let providers = if let Some(js_providers) = config.providers {
                js_providers
                    .into_iter()
                    .map(|p| ProviderConfig {
                        id: p.id,
                        provider_type: p.provider_type,
                        enabled: p.enabled,
                        weight: p.weight.unwrap_or(1.0) as f32,
                        config: serde_json::from_str(&p.config.unwrap_or_default()).unwrap_or(Value::Null),
                    })
                    .collect()
            } else {
                Vec::new()
            };

            Ok(SearchConfig {
                index_dir: PathBuf::from(config.index_dir),
                max_memory_mb: config.max_memory_mb.unwrap_or(512) as u64,
                max_response_time_ms: config.max_response_time_ms.unwrap_or(300) as u64,
                num_threads: config.num_threads.unwrap_or(num_cpus::get() as u32) as usize,
                enable_analytics: config.enable_analytics.unwrap_or(true),
                enable_suggestions: config.enable_suggestions.unwrap_or(true),
                enable_realtime: config.enable_realtime.unwrap_or(true),
                providers,
            })
        }

        fn convert_query(&self, query: JsSearchQuery) -> napi::Result<SearchQuery> {
            let content_types = query.content_types.map(|types| {
                types
                    .into_iter()
                    .map(|t| self.parse_content_type(&t))
                    .collect()
            });

            let options = SearchOptions {
                fuzzy: query.fuzzy,
                fuzzy_threshold: Some(0.8),
                semantic: Some(false),
                facets: Some(true),
                highlighting: query.highlighting,
                suggestions: query.suggestions,
                timeout: query.timeout.map(|t| t as u64),
                debug: Some(false),
                use_cache: Some(true),
                cache_ttl: Some(300),
            };

            Ok(SearchQuery {
                query: query.query,
                content_types,
                provider_ids: query.provider_ids,
                filters: None,
                sort: None,
                limit: query.limit.map(|l| l as usize),
                offset: query.offset.map(|o| o as usize),
                options,
            })
        }

        fn convert_document(&self, document: JsSearchDocument) -> napi::Result<SearchDocument> {
            use chrono::Utc;
            use crate::search::{DocumentMetadata, IndexingInfo, IndexType};

            let content_type = self.parse_content_type(&document.content_type);
            let provider_type = self.parse_provider_type(&document.provider_type);

            let metadata = if let Some(meta) = document.metadata {
                serde_json::from_str(&meta).map_err(|e| {
                    napi::Error::from_reason(format!("Invalid metadata: {}", e))
                })?
            } else {
                DocumentMetadata {
                    size: None,
                    file_type: None,
                    mime_type: None,
                    language: None,
                    location: None,
                    collaboration: None,
                    activity: None,
                    priority: None,
                    status: None,
                    custom: HashMap::new(),
                }
            };

            Ok(SearchDocument {
                id: document.id,
                title: document.title,
                content: document.content,
                summary: document.summary,
                content_type,
                provider_id: document.provider_id,
                provider_type,
                url: document.url,
                icon: None,
                thumbnail: None,
                metadata,
                tags: document.tags.unwrap_or_default(),
                categories: document.categories.unwrap_or_default(),
                author: document.author,
                created_at: Utc::now(),
                last_modified: Utc::now(),
                indexing_info: IndexingInfo {
                    indexed_at: Utc::now(),
                    version: 1,
                    checksum: "".to_string(),
                    index_type: IndexType::Full,
                },
            })
        }

        fn convert_response(&self, response: SearchResponse) -> JsSearchResponse {
            let results = response
                .results
                .into_iter()
                .map(|result| JsSearchResult {
                    id: result.id,
                    title: result.title,
                    description: result.description,
                    content: result.content,
                    url: result.url,
                    content_type: result.content_type.as_str().to_string(),
                    provider_id: result.provider_id,
                    provider_type: result.provider_type.as_str().to_string(),
                    score: result.score as f64,
                    highlights: result.highlights.map(|highlights| {
                        highlights
                            .into_iter()
                            .map(|h| JsSearchHighlight {
                                field: h.field,
                                fragments: h.fragments,
                            })
                            .collect()
                    }),
                    created_at: result.created_at.to_rfc3339(),
                    last_modified: result.last_modified.to_rfc3339(),
                })
                .collect();

            JsSearchResponse {
                results,
                total_count: response.total_count as u32,
                execution_time_ms: response.execution_time_ms as u32,
                suggestions: response.suggestions,
            }
        }

        fn convert_analytics(&self, analytics: crate::search::SearchAnalytics) -> JsSearchAnalytics {
            let popular_queries = analytics
                .popular_queries
                .into_iter()
                .map(|q| q.query)
                .collect();

            JsSearchAnalytics {
                total_queries: analytics.performance.total_queries as u32,
                avg_response_time_ms: analytics.performance.avg_response_time_ms,
                success_rate: analytics.performance.success_rate,
                popular_queries,
                error_rate: analytics.errors.error_rate,
            }
        }

        fn parse_content_type(&self, type_str: &str) -> ContentType {
            match type_str {
                "email" => ContentType::Email,
                "calendar_event" => ContentType::CalendarEvent,
                "contact" => ContentType::Contact,
                "file" => ContentType::File,
                "document" => ContentType::Document,
                "message" => ContentType::Message,
                "channel" => ContentType::Channel,
                "thread" => ContentType::Thread,
                "task" => ContentType::Task,
                "project" => ContentType::Project,
                "issue" => ContentType::Issue,
                "pull_request" => ContentType::PullRequest,
                "commit" => ContentType::Commit,
                "meeting" => ContentType::Meeting,
                "note" => ContentType::Note,
                "bookmark" => ContentType::Bookmark,
                _ => ContentType::Custom(type_str.to_string()),
            }
        }

        fn parse_provider_type(&self, type_str: &str) -> ProviderType {
            match type_str {
                "gmail" => ProviderType::Gmail,
                "outlook" => ProviderType::Outlook,
                "slack" => ProviderType::Slack,
                "teams" => ProviderType::Teams,
                "notion" => ProviderType::Notion,
                "github" => ProviderType::GitHub,
                "local_files" => ProviderType::LocalFiles,
                _ => ProviderType::Plugin(type_str.to_string()),
            }
        }
    }

    /// Initialize logging for the native module
    #[napi]
    pub fn init_logging(level: Option<String>) -> napi::Result<()> {
        let level = level.unwrap_or_else(|| "info".to_string());
        
        match tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::new(&level))
            .try_init()
        {
            Ok(()) => Ok(()),
            Err(_) => Ok(()), // Already initialized
        }
    }

    /// Get version information
    #[napi]
    pub fn get_version() -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}