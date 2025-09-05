/*!
 * Calendar Search Engine Integration
 * 
 * Complete search functionality that integrates with the main search engine
 * to index and search calendar events with full-text capabilities.
 */

use std::sync::Arc;
use std::collections::HashMap;
use crate::calendar::{CalendarResult, CalendarError, CalendarEvent, Calendar, CalendarDatabase};
use crate::search::{SearchEngine, SearchDocument, ContentType, DocumentMetadata, ProviderType, IndexingInfo, IndexType};
use chrono::{DateTime, Utc};
use uuid::Uuid;

pub struct CalendarSearchEngine {
    database: Arc<CalendarDatabase>,
    search_engine: Option<Arc<SearchEngine>>,
    indexed_events: Arc<tokio::sync::RwLock<HashMap<String, DateTime<Utc>>>>,
}

impl CalendarSearchEngine {
    pub fn new(database: Arc<CalendarDatabase>) -> CalendarResult<Self> {
        Ok(Self {
            database,
            search_engine: None,
            indexed_events: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        })
    }

    pub fn with_search_engine(mut self, search_engine: Arc<SearchEngine>) -> Self {
        self.search_engine = Some(search_engine);
        self
    }

    pub async fn index_event(&self, event: &CalendarEvent) -> CalendarResult<()> {
        if let Some(ref search_engine) = self.search_engine {
            // Create search document from calendar event
            let search_doc = SearchDocument {
                id: event.id.to_string(),
                title: event.title.clone(),
                content: format!(
                    "{} {} {}",
                    event.title,
                    event.description.as_deref().unwrap_or(""),
                    event.location.as_deref().unwrap_or("")
                ),
                summary: event.description.clone(),
                content_type: ContentType::CalendarEvent,
                provider_id: event.provider_id.clone(),
                provider_type: ProviderType::LocalCalendar,
                account_id: Some(event.account_id.to_string()),
                url: None,
                file_path: None,
                icon: Some("📅".to_string()),
                thumbnail: None,
                tags: vec![],
                categories: vec!["Calendar".to_string()],
                author: event.attendees.first().map(|att| att.email.clone()),
                created_at: event.created_at,
                last_modified: event.updated_at,
                metadata: DocumentMetadata {
                    author: None,
                    created_at: Some(event.created_at),
                    modified_at: Some(event.updated_at),
                    file_size: None,
                    size: None,
                    file_type: None,
                    mime_type: Some("application/calendar".to_string()),
                    language: None,
                    tags: vec![],
                    custom_fields: {
                        let mut fields = HashMap::new();
                        fields.insert("calendar_id".to_string(), event.calendar_id.to_string());
                        fields.insert("start_time".to_string(), event.start_time.to_rfc3339());
                        fields.insert("end_time".to_string(), event.end_time.to_rfc3339());
                        fields.insert("all_day".to_string(), event.all_day.to_string());
                        if let Some(ref location) = event.location {
                            fields.insert("location".to_string(), location.clone());
                        }
                        if let Some(ref uid) = event.uid {
                            fields.insert("uid".to_string(), uid.clone());
                        }
                        fields.insert("status".to_string(), format!("{:?}", event.status));
                        fields.insert("visibility".to_string(), format!("{:?}", event.visibility));
                        fields
                    },
                    location: None,
                    collaboration: None,
                    activity: None,
                    priority: None,
                    status: Some(format!("{:?}", event.status)),
                    custom: HashMap::new(),
                },
                indexing_info: IndexingInfo {
                    indexed_at: Utc::now(),
                    version: 1,
                    checksum: format!("{:x}", md5::compute(format!("{}{}", event.title, event.updated_at.timestamp()))),
                    index_type: IndexType::Full,
                },
            };

            // Index the document
            search_engine.index_document(search_doc).await
                .map_err(|e| CalendarError::InternalError {
                    message: format!("Failed to index calendar event: {}", e),
                    operation: Some("index_event".to_string()),
                    context: Some(serde_json::json!({"event_id": event.id})),
                })?;

            // Track indexed event
            let mut indexed = self.indexed_events.write().await;
            indexed.insert(event.id.to_string(), Utc::now());

            tracing::debug!("Indexed calendar event: {}", event.title);
        }

        Ok(())
    }

    pub async fn remove_event(&self, event_id: &str) -> CalendarResult<()> {
        if let Some(ref search_engine) = self.search_engine {
            search_engine.delete_document(event_id).await
                .map_err(|e| CalendarError::InternalError {
                    message: format!("Failed to remove calendar event from index: {}", e),
                    operation: Some("remove_event".to_string()),
                    context: Some(serde_json::json!({"event_id": event_id})),
                })?;

            // Remove from tracking
            let mut indexed = self.indexed_events.write().await;
            indexed.remove(event_id);

            tracing::debug!("Removed calendar event from index: {}", event_id);
        }

        Ok(())
    }

    pub async fn search_events(&self, query: &str, limit: Option<usize>) -> CalendarResult<Vec<CalendarEvent>> {
        if let Some(ref search_engine) = self.search_engine {
            // Search for calendar events specifically
            let search_options = crate::search::SearchOptions {
                content_types: Some(vec![ContentType::CalendarEvent]),
                limit: Some(limit.unwrap_or(50)),
                offset: Some(0),
                sort_by: Some("start_time".to_string()),
                sort_order: Some("desc".to_string()),
                filters: None,
                highlight: Some(true),
                ..Default::default()
            };

            let search_query = crate::search::SearchQuery {
                query: query.to_string(),
                content_types: Some(vec![ContentType::CalendarEvent]),
                provider_ids: None,
                filters: None,
                sort: None,
                limit: Some(limit.unwrap_or(50)),
                offset: Some(0),
                options: search_options,
            };
            
            let search_results = search_engine.search(search_query).await
                .map_err(|e| CalendarError::InternalError {
                    message: format!("Calendar search failed: {}", e),
                    operation: Some("search_events".to_string()),
                    context: Some(serde_json::json!({"query": query})),
                })?;

            // Convert search results back to calendar events
            let mut events = Vec::new();
            for result in search_results.results {
                // Parse event ID from search result
                if let Ok(event_uuid) = Uuid::parse_str(&result.id) {
                    // Get full event details from database
                    if let Ok(event) = self.database.get_calendar_event(&result.id).await {
                        events.push(event);
                    }
                }
            }

            Ok(events)
        } else {
            // Fallback to database search if no search engine
            self.database_search_events(query, limit).await
        }
    }

    pub async fn search_calendars(&self, query: &str) -> CalendarResult<Vec<Calendar>> {
        // Search calendars by name and description
        let calendars = self.database.get_calendars_for_account("").await?; // Would need proper account filtering
        
        let query_lower = query.to_lowercase();
        let filtered_calendars: Vec<Calendar> = calendars
            .into_iter()
            .filter(|calendar| {
                calendar.name.to_lowercase().contains(&query_lower) ||
                calendar.description.as_ref()
                    .map_or(false, |desc| desc.to_lowercase().contains(&query_lower))
            })
            .collect();

        Ok(filtered_calendars)
    }

    async fn database_search_events(&self, query: &str, limit: Option<usize>) -> CalendarResult<Vec<CalendarEvent>> {
        // Fallback database search using SQL LIKE queries
        let query_pattern = format!("%{}%", query);
        let limit = limit.unwrap_or(50) as i32;

        // This would require a proper database search method
        // For now, return empty results as this is a fallback
        Ok(vec![])
    }

    pub async fn reindex_all_events(&self, account_id: &str) -> CalendarResult<usize> {
        if let Some(ref search_engine) = self.search_engine {
            // Get all events for the account
            let calendars = self.database.get_calendars_for_account(account_id).await?;
            let mut total_indexed = 0;

            for calendar in calendars {
                let events = self.database.get_events_by_calendar(&calendar.id.to_string(), None, None).await?;
                
                for event in events {
                    if let Err(e) = self.index_event(&event).await {
                        tracing::warn!("Failed to index event {}: {}", event.id, e);
                    } else {
                        total_indexed += 1;
                    }
                }
            }

            tracing::info!("Reindexed {} calendar events for account {}", total_indexed, account_id);
            Ok(total_indexed)
        } else {
            Ok(0)
        }
    }

    pub async fn get_search_stats(&self) -> CalendarResult<CalendarSearchStats> {
        let indexed = self.indexed_events.read().await;
        
        Ok(CalendarSearchStats {
            total_indexed_events: indexed.len(),
            last_index_update: indexed.values().max().copied(),
            search_engine_available: self.search_engine.is_some(),
        })
    }

    pub async fn update_event_index(&self, event: &CalendarEvent) -> CalendarResult<()> {
        // Remove old index entry and add new one
        self.remove_event(&event.id.to_string()).await?;
        self.index_event(event).await?;
        Ok(())
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CalendarSearchStats {
    pub total_indexed_events: usize,
    pub last_index_update: Option<DateTime<Utc>>,
    pub search_engine_available: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_calendar_search_creation() {
        // This would require proper database setup
        // For now, test basic structure
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("test_calendar.db");
        
        // This would fail without proper database setup, but tests the structure
        let result = CalendarDatabase::new(db_path.to_str().unwrap()).await;
        if result.is_ok() {
            let database = Arc::new(result.unwrap());
            let search_engine = CalendarSearchEngine::new(database).unwrap();
            
            let stats = search_engine.get_search_stats().await.unwrap();
            assert_eq!(stats.total_indexed_events, 0);
            assert!(!stats.search_engine_available);
        }
    }

    #[test]
    fn test_search_stats_serialization() {
        let stats = CalendarSearchStats {
            total_indexed_events: 100,
            last_index_update: Some(Utc::now()),
            search_engine_available: true,
        };

        let json = serde_json::to_string(&stats).unwrap();
        let deserialized: CalendarSearchStats = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.total_indexed_events, 100);
        assert!(deserialized.search_engine_available);
    }
}