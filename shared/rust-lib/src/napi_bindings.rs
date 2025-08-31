//! NAPI bindings for Flow Desk Rust engines
//!
//! This module provides Node.js bindings for the Rust engines using NAPI-RS.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::Mutex;
use base64::{engine::general_purpose, Engine as _};

use crate::mail_simple::{MailEngine, MailAccount, MailMessage, MailSyncStatus};
use crate::calendar_simple::{CalendarEngine, CalendarAccount, Calendar, CalendarEvent, CalendarSyncStatus};
use crate::search_simple::SearchEngine;
use crate::crypto::{encrypt_data, decrypt_data, generate_key_pair};

/// Shared mail engine instance
static MAIL_ENGINE: once_cell::sync::Lazy<Arc<Mutex<MailEngine>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(MailEngine::new())));

/// Shared calendar engine instance  
static CALENDAR_ENGINE: once_cell::sync::Lazy<Arc<Mutex<CalendarEngine>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(CalendarEngine::new())));

/// Shared search engine instance
static SEARCH_ENGINE: once_cell::sync::Lazy<Arc<Mutex<SearchEngine>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(SearchEngine::new())));

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
            id: account.id,
            email: account.email,
            provider: account.provider,
            display_name: account.display_name,
            is_enabled: account.is_enabled,
        }
    }
}

impl From<NapiMailAccount> for MailAccount {
    fn from(account: NapiMailAccount) -> Self {
        Self {
            id: account.id,
            email: account.email,
            provider: account.provider,
            display_name: account.display_name,
            is_enabled: account.is_enabled,
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

impl From<&MailMessage> for NapiMailMessage {
    fn from(message: &MailMessage) -> Self {
        Self {
            id: message.id.clone(),
            account_id: message.account_id.clone(),
            folder: message.folder.clone(),
            subject: message.subject.clone(),
            from_address: message.from_address.clone(),
            from_name: message.from_name.clone(),
            to_addresses: message.to_addresses.clone(),
            cc_addresses: message.cc_addresses.clone(),
            bcc_addresses: message.bcc_addresses.clone(),
            body_text: message.body_text.clone(),
            body_html: message.body_html.clone(),
            is_read: message.is_read,
            is_starred: message.is_starred,
            received_at: message.received_at.timestamp(),
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
            account_id: status.account_id,
            is_syncing: status.is_syncing,
            last_sync: status.last_sync.map(|dt| dt.timestamp()),
            total_messages: status.total_messages,
            unread_messages: status.unread_messages,
            error_message: status.error_message,
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
pub async fn add_mail_account(account: NapiMailAccount) -> Result<()> {
    let mut engine = MAIL_ENGINE.lock().await;
    engine.add_account(account.into()).await
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(())
}

/// Remove mail account
#[napi]
pub async fn remove_mail_account(account_id: String) -> Result<()> {
    let mut engine = MAIL_ENGINE.lock().await;
    engine.remove_account(&account_id).await
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(())
}

/// Get all mail accounts
#[napi]
pub async fn get_mail_accounts() -> Result<Vec<NapiMailAccount>> {
    let engine = MAIL_ENGINE.lock().await;
    let accounts = engine.get_accounts()
        .into_iter()
        .map(|account| account.clone().into())
        .collect();
    Ok(accounts)
}

/// Sync mail account
#[napi]
pub async fn sync_mail_account(account_id: String) -> Result<NapiMailSyncStatus> {
    let mut engine = MAIL_ENGINE.lock().await;
    let status = engine.sync_account(&account_id).await
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(status.into())
}

/// Get messages for account
#[napi]
pub async fn get_mail_messages(account_id: String) -> Result<Vec<NapiMailMessage>> {
    let engine = MAIL_ENGINE.lock().await;
    let messages = engine.get_messages(&account_id)
        .into_iter()
        .map(|message| message.into())
        .collect();
    Ok(messages)
}

/// Mark message as read
#[napi]
pub async fn mark_mail_message_read(account_id: String, message_id: String) -> Result<()> {
    let mut engine = MAIL_ENGINE.lock().await;
    engine.mark_message_read(&account_id, &message_id)
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(())
}

/// Search mail messages
#[napi]
pub async fn search_mail_messages(query: String) -> Result<Vec<NapiMailMessage>> {
    let engine = MAIL_ENGINE.lock().await;
    let messages = engine.search_messages(&query)
        .into_iter()
        .map(|message| message.into())
        .collect();
    Ok(messages)
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
            id: account.id,
            email: account.email,
            provider: account.provider,
            display_name: account.display_name,
            is_enabled: account.is_enabled,
        }
    }
}

impl From<NapiCalendarAccount> for CalendarAccount {
    fn from(account: NapiCalendarAccount) -> Self {
        Self {
            id: account.id,
            email: account.email,
            provider: account.provider,
            display_name: account.display_name,
            is_enabled: account.is_enabled,
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
            account_id: calendar.account_id.clone(),
            name: calendar.name.clone(),
            description: calendar.description.clone(),
            color: calendar.color.clone(),
            is_primary: calendar.is_primary,
            is_writable: calendar.is_writable,
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
            is_all_day: event.is_all_day,
            organizer: event.organizer.clone(),
            attendees: event.attendees.clone(),
            status: event.status.clone(),
            visibility: event.visibility.clone(),
            recurrence_rule: event.recurrence_rule.clone(),
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
    let mut engine = CALENDAR_ENGINE.lock().await;
    engine.add_account(account.into()).await
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(())
}

/// Remove calendar account
#[napi]
pub async fn remove_calendar_account(account_id: String) -> Result<()> {
    let mut engine = CALENDAR_ENGINE.lock().await;
    engine.remove_account(&account_id).await
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(())
}

/// Get all calendar accounts
#[napi]
pub async fn get_calendar_accounts() -> Result<Vec<NapiCalendarAccount>> {
    let engine = CALENDAR_ENGINE.lock().await;
    let accounts = engine.get_accounts()
        .into_iter()
        .map(|account| account.clone().into())
        .collect();
    Ok(accounts)
}

/// Sync calendar account
#[napi]
pub async fn sync_calendar_account(account_id: String) -> Result<NapiCalendarSyncStatus> {
    let mut engine = CALENDAR_ENGINE.lock().await;
    let status = engine.sync_account(&account_id).await
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(status.into())
}

/// Get calendars for account
#[napi]
pub async fn get_calendars(account_id: String) -> Result<Vec<NapiCalendar>> {
    let engine = CALENDAR_ENGINE.lock().await;
    let calendars = engine.get_calendars(&account_id)
        .into_iter()
        .map(|calendar| calendar.into())
        .collect();
    Ok(calendars)
}

/// Get events for account
#[napi]
pub async fn get_calendar_events(account_id: String) -> Result<Vec<NapiCalendarEvent>> {
    let engine = CALENDAR_ENGINE.lock().await;
    let events = engine.get_events(&account_id)
        .into_iter()
        .map(|event| event.into())
        .collect();
    Ok(events)
}

/// Create calendar event
#[napi]
pub async fn create_calendar_event(
    calendar_id: String,
    title: String,
    start_time: i64,
    end_time: i64,
) -> Result<String> {
    let mut engine = CALENDAR_ENGINE.lock().await;
    let start = chrono::DateTime::from_timestamp(start_time, 0)
        .ok_or_else(|| napi::Error::from_reason("Invalid start time"))?;
    let end = chrono::DateTime::from_timestamp(end_time, 0)
        .ok_or_else(|| napi::Error::from_reason("Invalid end time"))?;
    
    let event_id = engine.create_event(&calendar_id, title, start, end).await
        .map_err(|e| napi::Error::from_reason(e))?;
    Ok(event_id)
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
    let mut engine = SEARCH_ENGINE.lock().await;
    engine.initialize().await
        .map_err(|e| napi::Error::from_reason(format!("Search engine init error: {:?}", e)))?;
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
    let mut engine = SEARCH_ENGINE.lock().await;
    engine.index_document(&id, &title, &content, &source, &metadata).await
        .map_err(|e| napi::Error::from_reason(format!("Indexing error: {:?}", e)))?;
    Ok(())
}

/// Search documents
#[napi]
pub async fn search_documents(query: String, limit: Option<u32>) -> Result<Vec<NapiSearchResult>> {
    let mut engine = SEARCH_ENGINE.lock().await;
    let results = engine.search(&query, limit.unwrap_or(20)).await
        .map_err(|e| napi::Error::from_reason(format!("Search error: {:?}", e)))?;
    
    let napi_results = results
        .into_iter()
        .map(|result| NapiSearchResult {
            id: result.id,
            title: result.title,
            content: result.content,
            source: result.source,
            score: result.score,
            metadata: result.metadata,
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