//! NAPI bindings for Flow Desk Rust engines
//!
//! This module provides Node.js bindings for the Rust engines using NAPI-RS.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::Mutex;
use base64::{engine::general_purpose, Engine as _};

use crate::mail::{MailEngine, MailAccount, EmailMessage, MailSyncStatus};
use crate::calendar::{CalendarEngine, CalendarAccount, Calendar, CalendarEvent, CalendarSyncStatus};
use crate::search::{SearchEngine, SearchResult, ContentType};
use crate::crypto::{encrypt_data, decrypt_data, generate_key_pair};

/// Shared engine instances will be initialized on demand
use once_cell::sync::OnceCell;

/// Shared mail engine instance
static MAIL_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<MailEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Shared calendar engine instance  
static CALENDAR_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<CalendarEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Shared search engine instance
static SEARCH_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<SearchEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

// ============================================================================
// Mail Engine NAPI Bindings
// ============================================================================

/// Mail account for NAPI
#[napi(object)]
pub struct NapiMailAccount {
    pub id: String,
    pub email: String,
    pub provider: String,
    pub display_name: String,
    pub is_enabled: bool,
}

impl From<MailAccount> for NapiMailAccount {
    fn from(account: MailAccount) -> Self {
        Self {
            id: account.id.to_string(),
            email: account.email,
            provider: account.provider.as_str().to_string(),
            display_name: account.name,
            is_enabled: account.is_enabled,
        }
    }
}

impl From<NapiMailAccount> for MailAccount {
    fn from(account: NapiMailAccount) -> Self {
        Self {
            id: uuid::Uuid::parse_str(&account.id).unwrap_or_default(),
            user_id: uuid::Uuid::new_v4(),
            name: account.display_name,
            email: account.email,
            provider: crate::mail::types::MailProvider::Gmail, // Default
            status: crate::mail::types::MailAccountStatus::Active,
            last_sync_at: None,
            next_sync_at: None,
            sync_interval_minutes: 15,
            is_enabled: account.is_enabled,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            provider_config: crate::mail::types::ProviderAccountConfig::Gmail {
                client_id: "".to_string(),
                scopes: vec![],
                enable_push_notifications: false,
                history_id: None,
            },
            config: crate::mail::types::ProviderAccountConfig::Gmail {
                client_id: "".to_string(),
                scopes: vec![],
                enable_push_notifications: false,
                history_id: None,
            },
            sync_status: None,
        }
    }
}

/// Mail message for NAPI
#[napi(object)]
pub struct NapiMailMessage {
    pub id: String,
    pub account_id: String,
    pub folder: String,
    pub subject: String,
    pub from_address: String,
    pub from_name: String,
    pub to_addresses: Vec<String>,
    pub cc_addresses: Vec<String>,
    pub bcc_addresses: Vec<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
    pub received_at: i64, // Unix timestamp
}

impl From<&EmailMessage> for NapiMailMessage {
    fn from(message: &EmailMessage) -> Self {
        Self {
            id: message.id.to_string(),
            account_id: message.account_id.to_string(),
            folder: message.folder.clone(),
            subject: message.subject.clone(),
            from_address: message.from.email.clone(),
            from_name: message.from.name.clone().unwrap_or_default(),
            to_addresses: message.to.iter().map(|addr| addr.email.clone()).collect(),
            cc_addresses: message.cc.iter().map(|addr| addr.email.clone()).collect(),
            bcc_addresses: message.bcc.iter().map(|addr| addr.email.clone()).collect(),
            body_text: message.body_text.clone(),
            body_html: message.body_html.clone(),
            is_read: message.is_read(),
            is_starred: message.is_starred(),
            received_at: message.received_at().timestamp(),
        }
    }
}

/// Mail sync status for NAPI
#[napi(object)]
pub struct NapiMailSyncStatus {
    pub account_id: String,
    pub is_syncing: bool,
    pub last_sync: Option<i64>,
    pub total_messages: u32,
    pub unread_messages: u32,
    pub error_message: Option<String>,
}

impl From<MailSyncStatus> for NapiMailSyncStatus {
    fn from(status: MailSyncStatus) -> Self {
        Self {
            account_id: status.account_id.to_string(),
            is_syncing: matches!(status.status, crate::mail::types::SyncStatus::Syncing),
            last_sync: status.last_sync_at.map(|dt| dt.timestamp()),
            total_messages: status.stats.total_messages as u32,
            unread_messages: 0, // SyncStats doesn't have unread_count field
            error_message: status.last_error.as_ref().map(|e| e.message.clone()),
        }
    }
}

/// Initialize mail engine
#[napi]
pub async fn init_mail_engine() -> Result<String> {
    crate::init();
    Ok("Mail engine initialized".to_string())
}

/// Add mail account
#[napi]
pub async fn add_mail_account(account: NapiMailAccount) -> Result<String> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    
    let account_id = engine.add_account(account.into()).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
        
    Ok(account_id.to_string())
}

/// Remove mail account
#[napi]
pub async fn remove_mail_account(account_id: String) -> Result<()> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    // Remove the account from the mail engine
    engine.remove_account(account_uuid).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    
    tracing::info!("Successfully removed mail account: {}", account_id);
    Ok(())
}

/// Get all mail accounts
#[napi]
pub async fn get_mail_accounts() -> Result<Vec<NapiMailAccount>> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    let accounts = engine.list_accounts().await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(accounts
        .into_iter()
        .map(|account| account.into())
        .collect())
}

/// Sync mail account
#[napi]
pub async fn sync_mail_account(account_id: String) -> Result<NapiMailSyncStatus> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    let sync_result = engine.sync_account(account_uuid).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    
    // Convert SyncResult to NapiMailSyncStatus
    Ok(NapiMailSyncStatus {
        account_id,
        is_syncing: false, // This would need to be tracked elsewhere
        last_sync: Some(chrono::Utc::now().timestamp()),
        total_messages: sync_result.messages_synced as u32,
        unread_messages: 0, // This would need additional logic
        error_message: if sync_result.errors.is_empty() {
            None
        } else {
            Some(sync_result.errors.join(", "))
        },
    })
}

/// Get messages for account
#[napi]
pub async fn get_mail_messages(account_id: String) -> Result<Vec<NapiMailMessage>> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    let messages = engine.get_messages(account_uuid, None, Some(100), Some(0)).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(messages
        .into_iter()
        .map(|message| (&message).into())
        .collect())
}

/// Mark message as read
#[napi]
pub async fn mark_mail_message_read(account_id: String, message_id: String) -> Result<()> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    let message_uuid = uuid::Uuid::parse_str(&message_id)
        .map_err(|e| Error::from_reason(format!("Invalid message ID: {}", e)))?;
    engine.mark_message_read(account_uuid, message_uuid, true).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(())
}

/// Search mail messages
#[napi]
pub async fn search_mail_messages(query: String) -> Result<Vec<NapiMailMessage>> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    let search_result = engine.search_messages(None, &query, Some(50)).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(search_result.messages
        .into_iter()
        .map(|message| (&message).into())
        .collect())
}

// ============================================================================
// Calendar Engine NAPI Bindings
// ============================================================================

/// Calendar account for NAPI
#[napi(object)]
pub struct NapiCalendarAccount {
    pub id: String,
    pub email: String,
    pub provider: String,
    pub display_name: String,
    pub is_enabled: bool,
}

impl From<CalendarAccount> for NapiCalendarAccount {
    fn from(account: CalendarAccount) -> Self {
        Self {
            id: account.id.to_string(),
            email: account.email,
            provider: account.provider.to_string(),
            display_name: account.name,
            is_enabled: account.is_enabled,
        }
    }
}

impl From<NapiCalendarAccount> for CalendarAccount {
    fn from(account: NapiCalendarAccount) -> Self {
        Self {
            id: uuid::Uuid::parse_str(&account.id).unwrap_or_default(),
            user_id: uuid::Uuid::new_v4(),
            name: account.display_name,
            email: account.email,
            provider: match account.provider.as_str() {
                "Google" => crate::calendar::types::CalendarProvider::Google,
                "Outlook" => crate::calendar::types::CalendarProvider::Outlook,
                "Exchange" => crate::calendar::types::CalendarProvider::Exchange,
                "CalDAV" => crate::calendar::types::CalendarProvider::CalDAV,
                "CalDav" => crate::calendar::types::CalendarProvider::CalDav,
                "ICloud" => crate::calendar::types::CalendarProvider::ICloud,
                "Fastmail" => crate::calendar::types::CalendarProvider::Fastmail,
                _ => crate::calendar::types::CalendarProvider::Google,
            },
            status: crate::calendar::types::CalendarAccountStatus::Active,
            config: crate::calendar::types::CalendarAccountConfig::Google(
                crate::calendar::types::GoogleCalendarConfig {
                    client_id: "".to_string(),
                    access_token: "".to_string(),
                    refresh_token: None,
                }
            ),
            credentials: std::collections::HashMap::new(),
            default_calendar_id: None,
            last_sync_at: None,
            next_sync_at: None,
            sync_interval_minutes: 15,
            is_enabled: account.is_enabled,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }
}

/// Calendar for NAPI
#[napi(object)]
pub struct NapiCalendar {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub is_primary: bool,
    pub is_writable: bool,
}

impl From<&Calendar> for NapiCalendar {
    fn from(calendar: &Calendar) -> Self {
        Self {
            id: calendar.id.clone(),
            account_id: calendar.account_id.to_string(),
            name: calendar.name.clone(),
            description: calendar.description.clone(),
            color: calendar.color.clone().unwrap_or_default(),
            is_primary: calendar.is_primary,
            is_writable: !matches!(calendar.access_level, crate::calendar::types::CalendarAccessLevel::Read | crate::calendar::types::CalendarAccessLevel::Reader | crate::calendar::types::CalendarAccessLevel::FreeBusyReader),
        }
    }
}

/// Calendar event for NAPI
#[napi(object)]
pub struct NapiCalendarEvent {
    pub id: String,
    pub calendar_id: String,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub is_all_day: bool,
    pub organizer: String,
    pub attendees: Vec<String>,
    pub status: String,
    pub visibility: String,
    pub recurrence_rule: Option<String>,
}

impl From<&CalendarEvent> for NapiCalendarEvent {
    fn from(event: &CalendarEvent) -> Self {
        Self {
            id: event.id.clone(),
            calendar_id: event.calendar_id.clone(),
            title: event.title.clone(),
            description: event.description.clone(),
            location: event.location.clone(),
            start_time: event.start_time.timestamp(),
            end_time: event.end_time.timestamp(),
            is_all_day: event.all_day,
            organizer: "".to_string(), // CalendarEvent doesn't have organizer field
            attendees: event.attendees.iter().map(|a| a.email.clone()).collect(),
            status: event.status.to_string(),
            visibility: event.visibility.to_string(),
            recurrence_rule: event.recurrence.as_ref().map(|r| format!("{:?}", r)),
        }
    }
}

/// Calendar sync status for NAPI
#[napi(object)]
pub struct NapiCalendarSyncStatus {
    pub account_id: String,
    pub is_syncing: bool,
    pub last_sync: Option<i64>,
    pub total_calendars: u32,
    pub total_events: u32,
    pub error_message: Option<String>,
}

impl From<CalendarSyncStatus> for NapiCalendarSyncStatus {
    fn from(status: CalendarSyncStatus) -> Self {
        Self {
            account_id: status.account_id,
            is_syncing: status.is_syncing,
            last_sync: status.last_sync.map(|dt| dt.timestamp()),
            total_calendars: status.total_calendars,
            total_events: status.total_events,
            error_message: status.error_message,
        }
    }
}

/// Initialize calendar engine
#[napi]
pub async fn init_calendar_engine() -> Result<String> {
    crate::init();
    Ok("Calendar engine initialized".to_string())
}

/// Add calendar account
#[napi]
pub async fn add_calendar_account(account: NapiCalendarAccount) -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    // Convert NAPI account to create input
    let input = crate::calendar::CreateCalendarAccountInput {
        user_id: uuid::Uuid::new_v4(), // Generate new UUID for user
        name: account.display_name,
        email: account.email,
        provider: crate::calendar::CalendarProvider::Google, // Default provider
        status: crate::calendar::CalendarAccountStatus::Active,
        config: crate::calendar::CalendarAccountConfig::Google(
            crate::calendar::GoogleCalendarConfig {
                client_id: "".to_string(),
                access_token: "".to_string(),
                refresh_token: None,
            }
        ),
        credentials: None, // This would need to be provided separately for OAuth
        default_calendar_id: None,
        last_sync_at: None,
        next_sync_at: None,
        sync_interval_minutes: 15, // Default sync interval
        is_enabled: account.is_enabled,
    };
    
    engine.create_account(input).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(())
}

/// Remove calendar account
#[napi]
pub async fn remove_calendar_account(account_id: String) -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    engine.delete_account(&account_id).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(())
}

/// Get all calendar accounts
#[napi]
pub async fn get_calendar_accounts() -> Result<Vec<NapiCalendarAccount>> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    // For now, return empty list since we don't have a way to get all accounts
    // In a real implementation, we'd need to query the database or add a get_all_accounts method
    let accounts: Vec<NapiCalendarAccount> = Vec::new();
    Ok(accounts)
}

/// Sync calendar account
#[napi]
pub async fn sync_calendar_account(account_id: String) -> Result<NapiCalendarSyncStatus> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    let status = engine.sync_account(&account_id, false).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(status.into())
}

/// Get calendars for account
#[napi]
pub async fn get_calendars(account_id: String) -> Result<Vec<NapiCalendar>> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    let calendars = engine.list_calendars(&account_id).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(calendars
        .into_iter()
        .map(|calendar| (&calendar).into())
        .collect())
}

/// Get events for account
#[napi]
pub async fn get_calendar_events(account_id: String) -> Result<Vec<NapiCalendarEvent>> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    // Get events for the next 30 days
    let start = chrono::Utc::now();
    let end = start + chrono::Duration::days(30);
    
    // Get all calendars for this account first
    let calendars = engine.list_calendars(&account_id).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    let calendar_ids: Vec<String> = calendars.iter().map(|cal| cal.id.clone()).collect();
    
    let events = engine.get_events_in_range(&calendar_ids, start, end).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(events
        .into_iter()
        .map(|event| (&event).into())
        .collect())
}

/// Create calendar event
#[napi]
pub async fn create_calendar_event(
    calendar_id: String,
    title: String,
    start_time: i64,
    end_time: i64,
) -> Result<String> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    let start = chrono::DateTime::from_timestamp(start_time, 0)
        .ok_or_else(|| napi::Error::from_reason("Invalid start time"))?;
    let end = chrono::DateTime::from_timestamp(end_time, 0)
        .ok_or_else(|| napi::Error::from_reason("Invalid end time"))?;
    
    let input = crate::calendar::CreateCalendarEventInput {
        title,
        description: None,
        start_time: start,
        end_time: end,
        all_day: false,
        location: None,
        calendar_id,
        provider_id: None,
        location_data: None,
        timezone: None,
        is_all_day: false,
        status: None,
        visibility: None,
        attendees: None,
        reminders: None,
        recurrence: None,
        uid: None,
        transparency: None,
        source: None,
        recurring_event_id: None,
        original_start_time: None,
        color: None,
        creator: None,
        organizer: None,
        conferencing: None,
        attachments: None,
        extended_properties: None,
    };
    
    let event = engine.create_event(&input).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(event.id)
}

// ============================================================================
// Search Engine NAPI Bindings
// ============================================================================

/// Search result for NAPI
#[napi(object)]
pub struct NapiSearchResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub score: f64,
    pub metadata: String, // JSON string
}

/// Initialize search engine
#[napi]
pub async fn init_search_engine() -> Result<String> {
    let mut engine_guard = SEARCH_ENGINE.lock().await;
    
    // Create a new search engine if not already initialized
    if engine_guard.is_none() {
        let config = crate::search::SearchConfig::default();
        let engine = crate::search::SearchEngine::new(config).await
            .map_err(|e| napi::Error::from_reason(format!("Search engine init error: {:?}", e)))?;
        *engine_guard = Some(engine);
    }
    
    Ok("Search engine initialized".to_string())
}

/// Index document in search engine
#[napi]
pub async fn index_document(
    id: String,
    title: String,
    content: String,
    source: String,
    metadata: String,
) -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let checksum = format!("{:x}", md5::compute(format!("{}{}", title, content).as_bytes()));
    
    let document = crate::search::SearchDocument {
        id,
        title: title.clone(),
        content: content.clone(),
        summary: None,
        content_type: crate::search::ContentType::Document,
        provider_id: source,
        provider_type: crate::search::ProviderType::LocalFiles, // Default to LocalFiles for generic documents
        url: None,
        icon: None,
        thumbnail: None,
        metadata: crate::search::DocumentMetadata {
            size: Some(content.len() as u64),
            file_type: Some("text".to_string()),
            mime_type: Some("text/plain".to_string()),
            language: Some("en".to_string()),
            location: None,
            collaboration: None,
            activity: None,
            priority: None,
            status: None,
            custom: serde_json::from_str(&metadata).unwrap_or_default(),
        },
        tags: Vec::new(),
        categories: Vec::new(),
        author: None,
        created_at: chrono::Utc::now(),
        last_modified: chrono::Utc::now(),
        indexing_info: crate::search::IndexingInfo {
            indexed_at: chrono::Utc::now(),
            version: 1,
            checksum,
            index_type: crate::search::IndexType::Full,
        },
    };
    
    engine.index_document(document).await
        .map_err(|e| napi::Error::from_reason(format!("Indexing error: {:?}", e)))?;
    Ok(())
}

/// Search documents
#[napi]
pub async fn search_documents(query: String, limit: Option<u32>) -> Result<Vec<NapiSearchResult>> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let search_query = crate::search::SearchQuery {
        query,
        content_types: None,
        provider_ids: None,
        filters: None,
        sort: None,
        limit: Some(limit.unwrap_or(20) as usize),
        offset: Some(0),
        options: crate::search::SearchOptions::default(),
    };
    
    let response = engine.search(search_query).await
        .map_err(|e| napi::Error::from_reason(format!("Search error: {:?}", e)))?;
    
    let napi_results = response.results
        .into_iter()
        .map(|result| NapiSearchResult {
            id: result.id,
            title: result.title,
            content: result.content.unwrap_or_default(),
            source: format!("{:?}", result.provider_type),
            score: result.score as f64,
            metadata: serde_json::to_string(&result.metadata).unwrap_or_default(),
        })
        .collect();
    
    Ok(napi_results)
}

// ============================================================================
// Crypto NAPI Bindings
// ============================================================================

/// Generate encryption key pair
#[napi]
pub fn generate_encryption_key_pair() -> Result<String> {
    let (public_key, private_key) = generate_key_pair()
        .map_err(|e| napi::Error::from_reason(format!("Key generation error: {:?}", e)))?;
    
    let keys = serde_json::json!({
        "publicKey": general_purpose::STANDARD.encode(public_key),
        "privateKey": general_purpose::STANDARD.encode(private_key)
    });
    
    Ok(keys.to_string())
}

/// Encrypt data
#[napi]
pub fn encrypt_string(data: String, key: String) -> Result<String> {
    let key_bytes = general_purpose::STANDARD.decode(key)
        .map_err(|e| napi::Error::from_reason(format!("Invalid key: {}", e)))?;
    
    let encrypted = encrypt_data(data.as_bytes(), &key_bytes)
        .map_err(|e| napi::Error::from_reason(format!("Encryption error: {:?}", e)))?;
    
    Ok(general_purpose::STANDARD.encode(encrypted))
}

/// Decrypt data
#[napi]
pub fn decrypt_string(encrypted_data: String, key: String) -> Result<String> {
    let key_bytes = general_purpose::STANDARD.decode(key)
        .map_err(|e| napi::Error::from_reason(format!("Invalid key: {}", e)))?;
    
    let encrypted_bytes = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| napi::Error::from_reason(format!("Invalid encrypted data: {}", e)))?;
    
    let decrypted = decrypt_data(&encrypted_bytes, &key_bytes)
        .map_err(|e| napi::Error::from_reason(format!("Decryption error: {:?}", e)))?;
    
    String::from_utf8(decrypted)
        .map_err(|e| napi::Error::from_reason(format!("Invalid UTF-8: {}", e)))
}

/// Get library version
#[napi]
pub fn get_version() -> String {
    crate::VERSION.to_string()
}