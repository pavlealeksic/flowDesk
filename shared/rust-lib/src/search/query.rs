//! Query processing and execution for search operations

use crate::search::{
    SearchQuery, SearchResponse, SearchHighlight, SearchFacet, FacetValue, FacetType, 
    SearchDebugInfo, ParsingInfo, ExecutionInfo, IndexManager, ContentType, ProviderType, 
    DocumentMetadata, SearchOptions, FilterOperator,
    types::SearchResult as SearchResultItem,
    error::{SearchError, SearchResult as SearchResultType},
};
use std::sync::Arc;
use std::collections::HashMap;
use tantivy::{
    query::{QueryParser, Query, BooleanQuery, TermQuery, FuzzyTermQuery, RangeQuery, Occur, PhraseQuery},
    collector::{TopDocs, FacetCollector, Count},
    Searcher, Term, Score, TantivyError, Document, TantivyDocument,
    schema::{Field, Schema, IndexRecordOption},
    tokenizer::TokenizerManager,
};
use tracing::{debug, error, instrument};
use chrono::{DateTime, Utc};
use regex::Regex;

/// Query processor for executing search queries
pub struct QueryProcessor {
    /// Index manager reference
    index_manager: Arc<IndexManager>,
    
    /// Maximum response time in milliseconds
    max_response_time_ms: u64,
    
    /// Number of search threads
    num_threads: usize,
    
    /// Query parser for different fields
    query_parsers: HashMap<String, QueryParser>,
    
    /// Snippet generators for highlighting
    snippet_generators: HashMap<Field, String>,
}

impl QueryProcessor {
    /// Create a new query processor
    #[instrument(skip(index_manager))]
    pub fn new(
        index_manager: Arc<IndexManager>,
        max_response_time_ms: u64,
        num_threads: usize,
    ) -> SearchResultType<Self> {
        let schema = index_manager.get_schema();
        let fields = index_manager.get_fields();
        
        // Create query parsers for different search strategies
        let mut query_parsers = HashMap::new();
        
        // Main query parser for title and content
        let main_fields = vec![fields.title, fields.content, fields.summary];
        let main_parser = QueryParser::for_index(index_manager.get_main_index().as_ref(), main_fields);
        query_parsers.insert("main".to_string(), main_parser);
        
        // Author query parser
        let author_parser = QueryParser::for_index(index_manager.get_main_index().as_ref(), vec![fields.author]);
        query_parsers.insert("author".to_string(), author_parser);
        
        // Tags query parser
        let tags_parser = QueryParser::for_index(index_manager.get_main_index().as_ref(), vec![fields.tags]);
        query_parsers.insert("tags".to_string(), tags_parser);
        
        // Create snippet generators for highlighting
        let mut snippet_generators = HashMap::new();
        let tokenizer_manager = TokenizerManager::default();
        
        snippet_generators.insert(
            fields.title,
            "title_snippet".to_string(),
        );
        
        snippet_generators.insert(
            fields.content,
            "content_snippet".to_string(),
        );
        
        Ok(Self {
            index_manager,
            max_response_time_ms,
            num_threads,
            query_parsers,
            snippet_generators,
        })
    }
    
    /// Execute a search query
    #[instrument(skip(self, query), fields(query_text = %query.query))]
    pub async fn execute_query(&self, query: &SearchQuery) -> SearchResultType<SearchResponse> {
        debug!("Processing search query: {}", query.query);
        
        let start_time = std::time::Instant::now();
        let searcher = self.index_manager.get_searcher();
        
        // Parse and build the query
        let tantivy_query = self.build_tantivy_query(query)?;
        
        // Determine number of results to fetch
        let limit = query.limit.unwrap_or(50);
        let offset = query.offset.unwrap_or(0);
        let fetch_count = limit + offset;
        
        // Create collectors
        let mut collectors = Vec::new();
        
        // Top documents collector (store for later use)
        let top_docs_collector_for_multi = TopDocs::with_limit(fetch_count);
        collectors.push(Box::new(TopDocs::with_limit(fetch_count)));
        
        // Facet collector (if enabled)
        let facet_collector = if query.options.facets.unwrap_or(true) {
            Some(self.create_facet_collector()?)
        } else {
            None
        };
        
        // Count collector for total results
        let count_collector = Count;
        
        // Execute search
        let search_results = if let Some(fc) = facet_collector {
            let multi_collector = (top_docs_collector_for_multi, fc, count_collector);
            let results = searcher.search(&*tantivy_query, &multi_collector)?;
            (results.0, Some(results.1), results.2)
        } else {
            let multi_collector = (TopDocs::with_limit(fetch_count), count_collector);
            let results = searcher.search(&*tantivy_query, &multi_collector)?;
            (results.0, None, results.1)
        };
        
        let (top_docs, facet_counts, total_count) = search_results;
        
        // Process results
        let mut results = Vec::new();
        for (score, doc_address) in top_docs.into_iter().skip(offset).take(limit) {
            match self.create_search_result(&searcher, doc_address, score, query).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    error!("Failed to create search result: {}", e);
                }
            }
        }
        
        // Generate facets
        let facets = if let Some(_fc) = facet_counts {
            Some(self.generate_facets(&searcher)?)
        } else {
            None
        };
        
        // Generate suggestions (if enabled)
        let suggestions = if query.options.suggestions.unwrap_or(true) {
            self.generate_suggestions(&query.query, 5).await?
        } else {
            None
        };
        
        // Create debug info (if enabled)
        let debug_info = if query.options.debug.unwrap_or(false) {
            Some(self.create_debug_info(query, start_time)?)
        } else {
            None
        };
        
        let execution_time_ms = start_time.elapsed().as_millis() as u64;
        
        debug!("Query processed in {}ms with {} results", execution_time_ms, results.len());
        
        Ok(SearchResponse {
            query: query.clone(),
            results,
            total_count: total_count as usize,
            execution_time_ms,
            facets,
            suggestions,
            debug_info,
            next_page_token: None,
            provider_responses: None,
        })
    }
    
    /// Get search suggestions for a partial query
    #[instrument(skip(self))]
    pub async fn get_suggestions(&self, partial_query: &str, limit: usize) -> SearchResultType<Vec<String>> {
        debug!("Generating suggestions for: {}", partial_query);
        
        if partial_query.is_empty() {
            return Ok(Vec::new());
        }
        
        // For now, implement basic prefix-based suggestions
        // In a more sophisticated implementation, this would use n-gram analysis,
        // query logs, and machine learning models
        
        let searcher = self.index_manager.get_searcher();
        let fields = self.index_manager.get_fields();
        
        // Create a prefix query for the partial input
        let mut suggestions = Vec::new();
        
        // Get terms that start with the partial query
        let term_prefix = Term::from_field_text(fields.title, partial_query);
        
        // This is a simplified implementation
        // A real implementation would use Tantivy's term dictionary
        suggestions.push(format!("{} in emails", partial_query));
        suggestions.push(format!("{} documents", partial_query));
        suggestions.push(format!("recent {}", partial_query));
        
        // Limit results
        suggestions.truncate(limit);
        
        debug!("Generated {} suggestions", suggestions.len());
        Ok(suggestions)
    }
    
    /// Build Tantivy query from search query
    fn build_tantivy_query(&self, query: &SearchQuery) -> SearchResultType<Box<dyn Query>> {
        let fields = self.index_manager.get_fields();
        
        // Start with the main text query
        let main_query = if !query.query.is_empty() {
            self.parse_main_query(&query.query)?
        } else {
            // If no query text, match all documents
            Box::new(tantivy::query::AllQuery) as Box<dyn Query>
        };
        
        let mut boolean_query = BooleanQuery::from(vec![(Occur::Must, main_query)]);
        
        // Add content type filters
        if let Some(content_types) = &query.content_types {
            let mut content_type_clauses = Vec::new();
            for content_type in content_types {
                let term = Term::from_field_text(self.index_manager.get_fields().content_type, content_type.as_str());
                content_type_clauses.push((Occur::Should, Box::new(TermQuery::new(term, IndexRecordOption::Basic)) as Box<dyn Query>));
            }
            let content_type_query = BooleanQuery::from(content_type_clauses);
            boolean_query = BooleanQuery::from(vec![
                (Occur::Must, Box::new(boolean_query) as Box<dyn Query>),
                (Occur::Must, Box::new(content_type_query) as Box<dyn Query>)
            ]);
        }
        
        // Add provider filters
        if let Some(provider_ids) = &query.provider_ids {
            let mut provider_clauses = Vec::new();
            for provider_id in provider_ids {
                let term = Term::from_field_text(self.index_manager.get_fields().provider_id, provider_id);
                provider_clauses.push((Occur::Should, Box::new(TermQuery::new(term, IndexRecordOption::Basic)) as Box<dyn Query>));
            }
            let provider_query = BooleanQuery::from(provider_clauses);
            boolean_query = BooleanQuery::from(vec![
                (Occur::Must, Box::new(boolean_query) as Box<dyn Query>),
                (Occur::Must, Box::new(provider_query) as Box<dyn Query>)
            ]);
        }
        
        // Add custom filters
        if let Some(filters) = &query.filters {
            let mut current_clauses = vec![(Occur::Must, Box::new(boolean_query) as Box<dyn Query>)];
            for filter in filters {
                let filter_query = self.build_filter_query(filter)?;
                current_clauses.push((Occur::Must, filter_query));
            }
            boolean_query = BooleanQuery::from(current_clauses);
        }
        
        Ok(Box::new(boolean_query))
    }
    
    /// Parse the main text query with advanced syntax support
    fn parse_main_query(&self, query_text: &str) -> SearchResultType<Box<dyn Query>> {
        // Check for advanced query syntax
        if self.is_advanced_query(query_text) {
            self.parse_advanced_query(query_text)
        } else {
            // Use the main query parser for simple queries
            let parser = self.query_parsers.get("main").unwrap();
            let query = parser.parse_query(query_text).map_err(|e| 
                SearchError::QueryError(format!("Failed to parse query '{}': {}", query_text, e))
            )?;
            Ok(query)
        }
    }
    
    /// Check if query uses advanced syntax
    fn is_advanced_query(&self, query_text: &str) -> bool {
        // Look for advanced operators
        query_text.contains("AND ") || 
        query_text.contains("OR ") || 
        query_text.contains("NOT ") ||
        query_text.contains("\"") || // Phrase queries
        query_text.contains("title:") ||
        query_text.contains("author:") ||
        query_text.contains("content:") ||
        query_text.contains("tag:") ||
        query_text.contains("before:") ||
        query_text.contains("after:") ||
        query_text.contains("type:")
    }
    
    /// Parse advanced query syntax
    fn parse_advanced_query(&self, query_text: &str) -> SearchResultType<Box<dyn Query>> {
        let fields = self.index_manager.get_fields();
        
        // This is a simplified parser for advanced syntax
        // A production implementation would use a proper query language parser
        
        let mut clauses = Vec::new();
        
        // Handle field-specific queries
        let field_patterns = [
            ("title:", fields.title),
            ("author:", fields.author),
            ("content:", fields.content),
            ("tag:", fields.tags),
            ("type:", fields.content_type),
        ];
        
        let mut remaining_query = query_text.to_string();
        
        for (prefix, field) in field_patterns.iter() {
            if let Some(pos) = remaining_query.find(prefix) {
                let after_prefix = &remaining_query[pos + prefix.len()..];
                let field_value = if let Some(space_pos) = after_prefix.find(' ') {
                    &after_prefix[..space_pos]
                } else {
                    after_prefix
                };
                
                // Remove quotes if present
                let field_value = field_value.trim_matches('"');
                
                let term = Term::from_field_text(*field, field_value);
                let field_query = Box::new(TermQuery::new(term, IndexRecordOption::Basic)) as Box<dyn Query>;
                clauses.push((Occur::Must, field_query));
                
                // Remove this part from the remaining query
                remaining_query = remaining_query.replace(&format!("{}{}", prefix, field_value), "");
            }
        }
        
        // Parse the remaining query as a general text query
        let remaining_query = remaining_query.trim();
        if !remaining_query.is_empty() {
            let parser = self.query_parsers.get("main").unwrap();
            match parser.parse_query(remaining_query) {
                Ok(text_query) => clauses.push((Occur::Must, text_query)),
                Err(e) => return Err(SearchError::QueryError(format!("Query parsing error: {}", e))),
            }
        }
        
        if clauses.is_empty() {
            // If no clauses, return a match-all query
            Ok(Box::new(tantivy::query::AllQuery))
        } else {
            Ok(Box::new(BooleanQuery::from(clauses)))
        }
    }
    
    /// Build a filter query from a search filter
    fn build_filter_query(&self, filter: &crate::search::SearchFilter) -> SearchResultType<Box<dyn Query>> {
        let fields = self.index_manager.get_fields();
        
        let field = match filter.field.as_str() {
            "id" => fields.id,
            "title" => fields.title,
            "content" => fields.content,
            "author" => fields.author,
            "tags" => fields.tags,
            "content_type" => fields.content_type,
            "provider_id" => fields.provider_id,
            "provider_type" => fields.provider_type,
            _ => return Err(SearchError::query_error(format!("Unknown filter field: {}", filter.field))),
        };
        
        match filter.operator {
            FilterOperator::Equals => {
                if let Some(value) = filter.value.as_str() {
                    let term = Term::from_field_text(field, value);
                    Ok(Box::new(TermQuery::new(term, IndexRecordOption::Basic)))
                } else {
                    Err(SearchError::query_error("Equals filter requires string value"))
                }
            }
            FilterOperator::Contains => {
                if let Some(value) = filter.value.as_str() {
                    let parser = QueryParser::for_index(self.index_manager.get_main_index().as_ref(), vec![field]);
                    let query = parser.parse_query(value).map_err(|e| 
                        SearchError::QueryError(format!("Failed to parse query '{}': {}", value, e))
                    )?;
                    Ok(query)
                } else {
                    Err(SearchError::query_error("Contains filter requires string value"))
                }
            }
            FilterOperator::Fuzzy => {
                if let Some(value) = filter.value.as_str() {
                    let term = Term::from_field_text(field, value);
                    Ok(Box::new(FuzzyTermQuery::new(term, 2, true)))
                } else {
                    Err(SearchError::query_error("Fuzzy filter requires string value"))
                }
            }
            _ => {
                // Other operators would be implemented here
                Err(SearchError::query_error(format!("Unsupported filter operator: {:?}", filter.operator)))
            }
        }
    }
    
    /// Create a search result from a Tantivy document
    async fn create_search_result(
        &self,
        searcher: &Searcher,
        doc_address: tantivy::DocAddress,
        score: Score,
        query: &SearchQuery,
    ) -> SearchResultType<SearchResultItem> {
        let doc = searcher.doc(doc_address)?;
        let fields = self.index_manager.get_fields();
        
        // Extract basic fields
        let id = self.get_field_value(&doc, fields.id)?;
        let title = self.get_field_value(&doc, fields.title)?;
        let content = self.get_field_value(&doc, fields.content).unwrap_or_default();
        let summary = self.get_field_value(&doc, fields.summary);
        let content_type_str = self.get_field_value(&doc, fields.content_type)?;
        let provider_id = self.get_field_value(&doc, fields.provider_id)?;
        let provider_type_str = self.get_field_value(&doc, fields.provider_type)?;
        let url = self.get_field_value(&doc, fields.url);
        let author = self.get_field_value(&doc, fields.author);
        let created_at_str = self.get_field_value(&doc, fields.created_at)?;
        let last_modified_str = self.get_field_value(&doc, fields.last_modified)?;
        let metadata_json = self.get_field_value(&doc, fields.metadata).unwrap_or_default();
        
        // Parse content type and provider type
        let content_type = match content_type_str.as_str() {
            "email" => ContentType::Email,
            "calendar_event" => ContentType::CalendarEvent,
            "contact" => ContentType::Contact,
            "file" => ContentType::File,
            "document" => ContentType::Document,
            "message" => ContentType::Message,
            "task" => ContentType::Task,
            "note" => ContentType::Note,
            _ => ContentType::Custom(content_type_str),
        };
        
        let provider_type = match provider_type_str.as_str() {
            "gmail" => ProviderType::Gmail,
            "slack" => ProviderType::Slack,
            "notion" => ProviderType::Notion,
            "local_files" => ProviderType::LocalFiles,
            _ => ProviderType::Plugin(provider_type_str),
        };
        
        // Parse timestamps
        let created_at = DateTime::parse_from_rfc3339(&created_at_str)
            .map_err(|e| SearchError::query_error(format!("Invalid created_at timestamp: {}", e)))?
            .with_timezone(&Utc);
            
        let last_modified = DateTime::parse_from_rfc3339(&last_modified_str)
            .map_err(|e| SearchError::query_error(format!("Invalid last_modified timestamp: {}", e)))?
            .with_timezone(&Utc);
        
        // Parse metadata
        let metadata: DocumentMetadata = if metadata_json.is_empty() {
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
        } else {
            serde_json::from_str(&metadata_json)
                .map_err(|e| SearchError::SerializationError(e))?
        };
        
        // Generate highlights if enabled
        let highlights = if query.options.highlighting.unwrap_or(true) {
            self.generate_highlights(&doc, &query.query)?
        } else {
            None
        };
        
        Ok(SearchResultItem {
            id,
            title,
            description: summary.ok(),
            content: Some(content),
            url: url.ok(),
            icon: None,
            thumbnail: None,
            content_type,
            provider_id,
            provider_type,
            score: score as f32,
            metadata,
            highlights,
            actions: None,
            created_at,
            last_modified,
        })
    }
    
    /// Get field value from document
    fn get_field_value(&self, doc: &tantivy::TantivyDocument, field: Field) -> SearchResultType<String> {
        doc.get_first(field)
            .and_then(|value| {
                let text = format!("{:?}", value).trim_matches('"').to_string();
                if !text.is_empty() && text != "null" {
                    Some(text)
                } else {
                    None
                }
            })
            .ok_or_else(|| SearchError::query_error("Missing required field"))
    }
    
    /// Generate highlights for search results
    fn generate_highlights(&self, doc: &tantivy::TantivyDocument, query_text: &str) -> SearchResultType<Option<Vec<SearchHighlight>>> {
        let fields = self.index_manager.get_fields();
        let mut highlights = Vec::new();
        
        // Generate highlights for title and content
        for (field_name, field) in [("title", fields.title), ("content", fields.content)] {
            if let Some(field_value) = doc.get_first(field).and_then(|v| {
                let text = format!("{:?}", v).trim_matches('"').to_string();
                if !text.is_empty() && text != "null" {
                    Some(text)
                } else {
                    None
                }
            }) {
                // Simple highlight generation (in production, use Tantivy's snippet generator)
                let highlight_fragments = self.generate_simple_highlights(&field_value, query_text);
                
                if !highlight_fragments.is_empty() {
                    highlights.push(SearchHighlight {
                        field: field_name.to_string(),
                        fragments: highlight_fragments,
                        positions: None,
                    });
                }
            }
        }
        
        if highlights.is_empty() {
            Ok(None)
        } else {
            Ok(Some(highlights))
        }
    }
    
    /// Generate simple highlights (basic implementation)
    fn generate_simple_highlights(&self, text: &str, query_text: &str) -> Vec<String> {
        let mut fragments = Vec::new();
        let query_terms: Vec<&str> = query_text.split_whitespace().collect();
        
        for term in query_terms {
            if let Some(pos) = text.to_lowercase().find(&term.to_lowercase()) {
                let start = pos.saturating_sub(50);
                let end = std::cmp::min(pos + term.len() + 50, text.len());
                let fragment = &text[start..end];
                
                // Add highlighting markers
                let highlighted = fragment.replace(
                    &text[pos..pos + term.len()],
                    &format!("<mark>{}</mark>", &text[pos..pos + term.len()])
                );
                
                fragments.push(highlighted);
            }
        }
        
        fragments
    }
    
    /// Create facet collector for search
    fn create_facet_collector(&self) -> SearchResultType<FacetCollector> {
        // This is a placeholder - Tantivy's facet system would need proper setup
        // For now, we'll use a simple implementation
        Ok(FacetCollector::for_field("content_type"))
    }
    
    /// Generate search facets
    fn generate_facets(&self, _searcher: &Searcher) -> SearchResultType<Vec<SearchFacet>> {
        // Placeholder implementation for facets
        // In a real implementation, this would analyze the search results
        // and generate facets based on field values
        
        let content_type_facet = SearchFacet {
            name: "Content Type".to_string(),
            field: "content_type".to_string(),
            values: vec![
                FacetValue {
                    value: serde_json::Value::String("email".to_string()),
                    count: 10,
                    selected: false,
                },
                FacetValue {
                    value: serde_json::Value::String("document".to_string()),
                    count: 5,
                    selected: false,
                },
            ],
            facet_type: FacetType::Terms,
            value: None,
            count: None,
            selected: None,
        };
        
        Ok(vec![content_type_facet])
    }
    
    /// Generate search suggestions based on query analysis
    async fn generate_suggestions(&self, query_text: &str, _limit: usize) -> SearchResultType<Option<Vec<String>>> {
        if query_text.is_empty() {
            return Ok(None);
        }
        
        // Placeholder implementation for suggestions
        // In a real implementation, this would use query logs, popular searches, etc.
        
        let suggestions = vec![
            format!("{} in emails", query_text),
            format!("{} documents", query_text),
            format!("recent {}", query_text),
        ];
        
        Ok(Some(suggestions))
    }
    
    /// Create debug information for search queries
    fn create_debug_info(&self, query: &SearchQuery, start_time: std::time::Instant) -> SearchResultType<SearchDebugInfo> {
        let execution_time = start_time.elapsed().as_millis() as u64;
        
        Ok(SearchDebugInfo {
            parsing: Some(ParsingInfo {
                original_query: query.query.clone(),
                parsed_query: serde_json::json!({"parsed": true}),
                warnings: vec![],
            }),
            execution: Some(ExecutionInfo {
                total_time_ms: execution_time,
                index_time_ms: execution_time / 4,
                search_time_ms: execution_time / 2,
                merge_time_ms: execution_time / 4,
            }),
            providers: None,
        })
    }
}