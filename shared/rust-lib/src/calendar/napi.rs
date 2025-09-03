/*!
 * Calendar Engine Node.js Bindings
 * 
 * NAPI bindings to expose the Rust calendar engine to Node.js/TypeScript.
 * Provides a complete JavaScript API for all calendar operations including
 * account management, event CRUD, privacy sync, and real-time notifications.
 */

#[cfg(feature = "napi")]
use napi::bindgen_prelude::*;
#[cfg(feature = "napi")]
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
#[cfg(feature = "napi")]
use napi_derive::napi;
#[cfg(feature = "napi")]
use std::sync::Arc;
#[cfg(feature = "napi")]
use tokio::sync::RwLock;
#[cfg(feature = "napi")]
use serde_json;
#[cfg(feature = "napi")]
use chrono::{DateTime, Utc};
#[cfg(feature = "napi")]
use std::collections::HashMap;

#[cfg(feature = "napi")]
use crate::calendar::{
    CalendarEngine, CalendarConfig, CalendarAccount, Calendar, CalendarEvent,
    CreateCalendarAccountInput, UpdateCalendarAccountInput,
    CreateCalendarEventInput, UpdateCalendarEventInput,
    CalendarPrivacySync, FreeBusyQuery, FreeBusyResponse,
    CalendarProvider, CalendarMetrics, CalendarSyncStatus,
    CalendarResult as RustCalendarResult
};

#[cfg(feature = "napi")]
use crate::calendar::privacy_sync::PrivacySyncResult;

#[cfg(feature = "napi")]
type CalendarResult<T> = Result<T, napi::Error>;

/// Main calendar engine wrapper for Node.js
#[cfg(feature = "napi")]
#[napi]
pub struct CalendarEngineJs {
    engine: Arc<RwLock<Option<CalendarEngine>>>,
}

#[cfg(feature = "napi")]
#[napi]
impl CalendarEngineJs {
    /// Create new calendar engine instance
    #[napi(constructor)]
    pub fn new() -> napi::Result<Self> {
        Ok(Self {
            engine: Arc::new(RwLock::new(None)),
        })
    }

    /// Initialize calendar engine with configuration
    #[napi]
    pub async fn initialize(&self, config_json: String) -> napi::Result<()> {
        let config: CalendarConfig = serde_json::from_str(&config_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, 
                format!("Invalid config JSON: {}", e)))?;

        let engine = CalendarEngine::new(config).await
            .map_err(convert_calendar_error)?;

        *self.engine.write().await = Some(engine);
        Ok(())
    }

    /// Start the calendar engine services
    #[napi]
    pub async fn start(&self) -> napi::Result<()> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard.as_ref().ok_or_else(|| 
            napi::Error::new(napi::Status::InvalidArg, "Engine not initialized"))?;
        
        engine.start().await.map_err(convert_calendar_error)
    }

    /// Stop the calendar engine
    #[napi]
    pub async fn stop(&self) -> napi::Result<()> {
        let engine_guard = self.engine.read().await;
        if let Some(engine) = engine_guard.as_ref() {
            engine.stop().await.map_err(convert_calendar_error)?;
        }
        Ok(())
    }

    // === Account Management ===

    /// Create a new calendar account
    #[napi]
    pub async fn create_account(&self, account_json: String) -> napi::Result<String> {
        let account_input: CreateCalendarAccountInput = serde_json::from_str(&account_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid account JSON: {}", e)))?;

        let engine = self.get_engine().await?;
        let account = engine.create_account(account_input).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&account)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize account: {}", e)))
    }

    /// Get calendar account by ID
    #[napi]
    pub async fn get_account(&self, account_id: String) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let account = engine.get_account(&account_id).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&account)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize account: {}", e)))
    }

    /// Get all calendar accounts for a user
    #[napi]
    pub async fn get_user_accounts(&self, user_id: String) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let accounts = engine.get_user_accounts(&user_id).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&accounts)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize accounts: {}", e)))
    }

    /// Update calendar account
    #[napi]
    pub async fn update_account(&self, account_id: String, updates_json: String) -> napi::Result<String> {
        let updates: UpdateCalendarAccountInput = serde_json::from_str(&updates_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid updates JSON: {}", e)))?;

        let engine = self.get_engine().await?;
        let account = engine.update_account(&account_id, updates).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&account)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize account: {}", e)))
    }

    /// Delete calendar account
    #[napi]
    pub async fn delete_account(&self, account_id: String) -> napi::Result<()> {
        let engine = self.get_engine().await?;
        engine.delete_account(&account_id).await
            .map_err(convert_calendar_error)
    }

    // === Calendar Operations ===

    /// List calendars for an account
    #[napi]
    pub async fn list_calendars(&self, account_id: String) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let calendars = engine.list_calendars(&account_id).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&calendars)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize calendars: {}", e)))
    }

    /// Get calendar by ID
    #[napi]
    pub async fn get_calendar(&self, calendar_id: String) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let calendar = engine.get_calendar(&calendar_id).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&calendar)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize calendar: {}", e)))
    }

    /// Create calendar
    #[napi]
    pub async fn create_calendar(&self, calendar_json: String) -> napi::Result<String> {
        let calendar: Calendar = serde_json::from_str(&calendar_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid calendar JSON: {}", e)))?;

        let engine = self.get_engine().await?;
        let created_calendar = engine.create_calendar(&calendar).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&created_calendar)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize calendar: {}", e)))
    }

    // === Event Operations ===

    /// Create calendar event
    #[napi]
    pub async fn create_event(&self, event_json: String) -> napi::Result<String> {
        let event_input: CreateCalendarEventInput = serde_json::from_str(&event_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid event JSON: {}", e)))?;

        let engine = self.get_engine().await?;
        let event = engine.create_event(&event_input).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&event)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize event: {}", e)))
    }

    /// Update calendar event
    #[napi]
    pub async fn update_event(
        &self,
        calendar_id: String,
        event_id: String,
        updates_json: String,
    ) -> napi::Result<String> {
        let updates: UpdateCalendarEventInput = serde_json::from_str(&updates_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid updates JSON: {}", e)))?;

        let engine = self.get_engine().await?;
        let event = engine.update_event(&calendar_id, &event_id, &updates).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&event)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize event: {}", e)))
    }

    /// Delete calendar event
    #[napi]
    pub async fn delete_event(&self, calendar_id: String, event_id: String) -> napi::Result<()> {
        let engine = self.get_engine().await?;
        engine.delete_event(&calendar_id, &event_id).await
            .map_err(convert_calendar_error)
    }

    /// Get events in date range
    #[napi]
    pub async fn get_events_in_range(
        &self,
        calendar_ids_json: String,
        time_min_iso: String,
        time_max_iso: String,
    ) -> napi::Result<String> {
        let calendar_ids: Vec<String> = serde_json::from_str(&calendar_ids_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid calendar IDs JSON: {}", e)))?;

        let time_min = DateTime::parse_from_rfc3339(&time_min_iso)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid time_min format: {}", e)))?
            .with_timezone(&Utc);

        let time_max = DateTime::parse_from_rfc3339(&time_max_iso)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid time_max format: {}", e)))?
            .with_timezone(&Utc);

        let engine = self.get_engine().await?;
        let events = engine.get_events_in_range(&calendar_ids, time_min, time_max).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&events)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize events: {}", e)))
    }

    // === Free/Busy Operations ===

    /// Query free/busy information
    #[napi]
    pub async fn query_free_busy(&self, query_json: String) -> napi::Result<String> {
        let query: FreeBusyQuery = serde_json::from_str(&query_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid query JSON: {}", e)))?;

        let engine = self.get_engine().await?;
        let response = engine.query_free_busy(&query).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&response)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize free/busy response: {}", e)))
    }

    // === Sync Operations ===

    /// Trigger full sync for an account
    #[napi]
    pub async fn sync_account(&self, account_id: String, force: bool) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let status = engine.sync_account(&account_id, force).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&status)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize sync status: {}", e)))
    }

    /// Get sync status for all accounts
    #[napi]
    pub async fn get_all_sync_status(&self) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let status_map = engine.get_all_sync_status().await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&status_map)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize sync status map: {}", e)))
    }

    // === Privacy Sync Operations ===

    /// Create privacy sync rule
    #[napi]
    pub async fn create_privacy_sync_rule(&self, rule_json: String) -> napi::Result<String> {
        let rule: CalendarPrivacySync = serde_json::from_str(&rule_json)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid rule JSON: {}", e)))?;

        let engine = self.get_engine().await?;
        let rule_id = engine.create_privacy_sync_rule(&rule).await
            .map_err(convert_calendar_error)?;

        Ok(rule_id)
    }

    /// Execute privacy sync for all rules
    #[napi]
    pub async fn execute_privacy_sync(&self) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let results = engine.execute_privacy_sync().await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&results)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize privacy sync results: {}", e)))
    }

    /// Execute privacy sync for a specific rule
    #[napi]
    pub async fn execute_privacy_sync_rule(&self, rule_id: String) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let result = engine.execute_privacy_sync_rule(&rule_id).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&result)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize privacy sync result: {}", e)))
    }

    // === Search Operations ===

    /// Search calendar events
    #[napi]
    pub async fn search_events(&self, query: String, limit: Option<u32>) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let events = engine.search_events(&query, limit.map(|l| l as usize)).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&events)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize search results: {}", e)))
    }

    /// Search calendars
    #[napi]
    pub async fn search_calendars(&self, query: String) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let calendars = engine.search_calendars(&query).await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&calendars)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize search results: {}", e)))
    }

    // === Metrics and Monitoring ===

    /// Get calendar metrics
    #[napi]
    pub async fn get_metrics(&self) -> napi::Result<String> {
        let engine = self.get_engine().await?;
        let metrics = engine.get_metrics().await
            .map_err(convert_calendar_error)?;

        serde_json::to_string(&metrics)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize metrics: {}", e)))
    }

    // === Utility Methods ===

    /// Get supported calendar providers
    #[napi]
    pub fn get_supported_providers() -> napi::Result<String> {
        use crate::calendar::providers::CalendarProviderFactory;
        
        let providers = CalendarProviderFactory::supported_providers();
        serde_json::to_string(&providers)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize providers: {}", e)))
    }

    /// Get provider capabilities
    #[napi]
    pub fn get_provider_capabilities(provider: String) -> napi::Result<String> {
        use crate::calendar::providers::CalendarProviderFactory;
        
        let provider_enum: CalendarProvider = serde_json::from_str(&format!("\"{}\"", provider))
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid provider: {}", e)))?;

        let capabilities = CalendarProviderFactory::get_provider_capabilities(provider_enum);
        serde_json::to_string(&capabilities)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure,
                format!("Failed to serialize capabilities: {}", e)))
    }

    /// Helper method to get engine reference
    async fn get_engine(&self) -> napi::Result<CalendarEngine> {
        let engine_guard = self.engine.read().await;
        engine_guard.as_ref()
            .cloned()
            .ok_or_else(|| napi::Error::new(napi::Status::InvalidArg, "Engine not initialized"))
    }
}

/// Event listener interface for calendar notifications  
#[cfg(feature = "napi")]
pub struct CalendarEventListener {
    pub callback: ThreadsafeFunction<CalendarNotification, ErrorStrategy::Fatal>,
}

/// Calendar notification structure for JavaScript
#[cfg(feature = "napi")]
#[napi(object)]
pub struct CalendarNotification {
    pub notification_type: String,
    pub account_id: String,
    pub calendar_id: Option<String>,
    pub event_id: Option<String>,
    pub timestamp: String, // ISO string
    pub data: Option<String>, // JSON string
}

#[cfg(feature = "napi")]
impl CalendarEventListener {
    /// Send notification to JavaScript callback
    pub fn notify(&self, notification: CalendarNotification) -> napi::Result<()> {
        self.callback.call(notification, ThreadsafeFunctionCallMode::NonBlocking);
        Ok(())
    }
}

/// Calendar webhook handler for Node.js
#[cfg(feature = "napi")]
#[napi]
pub struct CalendarWebhookHandler {
    engine: Arc<RwLock<Option<CalendarEngine>>>,
    listeners: Arc<RwLock<Vec<CalendarEventListener>>>,
}

#[cfg(feature = "napi")]
#[napi]
impl CalendarWebhookHandler {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            engine: Arc::new(RwLock::new(None)),
            listeners: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Set the calendar engine reference
    #[napi]
    pub async fn set_engine(&self, engine_js: &CalendarEngineJs) -> napi::Result<()> {
        let engine = engine_js.get_engine().await?;
        *self.engine.write().await = Some(engine);
        Ok(())
    }

    /// Add event listener
    #[napi]
    pub fn add_listener(&self, callback: napi::JsFunction) -> napi::Result<()> {
        let tsfn: ThreadsafeFunction<CalendarNotification, ErrorStrategy::Fatal> = 
            callback.create_threadsafe_function(0, |ctx| {
                Ok(vec![ctx.value])
            })?;
        
        let listener = CalendarEventListener { callback: tsfn };
        // Use blocking write since this is now sync
        let listeners_clone = self.listeners.clone();
        tokio::spawn(async move {
            listeners_clone.write().await.push(listener);
        });
        Ok(())
    }

    /// Process incoming webhook
    #[napi]
    pub async fn process_webhook(
        &self,
        provider: String,
        payload: String,
        signature: Option<String>,
    ) -> napi::Result<()> {
        // Parse provider
        let provider_enum: CalendarProvider = serde_json::from_str(&format!("\"{}\"", provider))
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg,
                format!("Invalid provider: {}", e)))?;

        // Validate signature if provided
        if let Some(_sig) = signature {
            // TODO: Implement signature validation
        }

        // Process webhook through engine
        let engine_guard = self.engine.read().await;
        if let Some(engine) = engine_guard.as_ref() {
            // TODO: Process webhook and generate notifications
        }

        Ok(())
    }

    /// Notify all listeners
    async fn notify_listeners(&self, notification: CalendarNotification) -> napi::Result<()> {
        let listeners = self.listeners.read().await;
        for listener in listeners.iter() {
            listener.notify(notification.clone())?;
        }
        Ok(())
    }
}

// Helper function to convert Rust calendar errors to NAPI errors
#[cfg(feature = "napi")]
fn convert_calendar_error(error: crate::calendar::CalendarError) -> napi::Error {
    use crate::calendar::CalendarError;
    
    let (status, message) = match &error {
        CalendarError::AuthenticationError { message, .. } => {
            (napi::Status::GenericFailure, format!("Authentication error: {}", message))
        },
        CalendarError::NotFoundError { resource_type, resource_id, .. } => {
            (napi::Status::GenericFailure, format!("{} not found: {}", resource_type, resource_id))
        },
        CalendarError::ValidationError { message, .. } => {
            (napi::Status::InvalidArg, format!("Validation error: {}", message))
        },
        CalendarError::NetworkError { message, .. } => {
            (napi::Status::GenericFailure, format!("Network error: {}", message))
        },
        CalendarError::RateLimitError { message, .. } => {
            (napi::Status::GenericFailure, format!("Rate limit error: {}", message))
        },
        CalendarError::DatabaseError { message, .. } => {
            (napi::Status::GenericFailure, format!("Database error: {}", message))
        },
        CalendarError::SyncError { message, .. } => {
            (napi::Status::GenericFailure, format!("Sync error: {}", message))
        },
        CalendarError::PrivacySyncError { message, .. } => {
            (napi::Status::GenericFailure, format!("Privacy sync error: {}", message))
        },
        _ => (napi::Status::GenericFailure, error.to_string()),
    };

    napi::Error::new(status, message)
}

// Implementation for cloning notifications
#[cfg(feature = "napi")]
impl Clone for CalendarNotification {
    fn clone(&self) -> Self {
        Self {
            notification_type: self.notification_type.clone(),
            account_id: self.account_id.clone(),
            calendar_id: self.calendar_id.clone(),
            event_id: self.event_id.clone(),
            timestamp: self.timestamp.clone(),
            data: self.data.clone(),
        }
    }
}

#[cfg(test)]
#[cfg(feature = "napi")]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_calendar_engine_js_creation() {
        let engine_js = CalendarEngineJs::new().unwrap();
        
        // Test that engine starts as uninitialized
        assert!(engine_js.engine.read().await.is_none());
    }

    #[test]
    fn test_provider_utilities() {
        let providers = CalendarEngineJs::get_supported_providers().unwrap();
        assert!(!providers.is_empty());

        let capabilities = CalendarEngineJs::get_provider_capabilities("google".to_string()).unwrap();
        assert!(!capabilities.is_empty());
    }
}