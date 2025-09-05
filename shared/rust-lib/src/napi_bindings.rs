//! NAPI bindings for Flow Desk Rust engines
//!
//! This module provides Node.js bindings for the Rust engines using NAPI-RS.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::Mutex;
use base64::{engine::general_purpose, Engine as _};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use sqlx::{Row, FromRow};

use crate::mail::{MailEngine, MailAccount, EmailMessage, MailSyncStatus, ProductionEmailEngine};
use crate::calendar::{CalendarEngine, CalendarAccount, Calendar, CalendarEvent, CalendarSyncStatus};
use crate::search::{SearchEngine, SearchResult, ContentType};
use crate::crypto::{encrypt_data, decrypt_data, generate_key_pair};
use reqwest;

/// Shared engine instances will be initialized on demand
use once_cell::sync::OnceCell;

/// Shared mail engine instance
static MAIL_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<MailEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Shared production email engine instance
static PRODUCTION_EMAIL_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<ProductionEmailEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Shared calendar engine instance  
static CALENDAR_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<CalendarEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Shared search engine instance
static SEARCH_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<SearchEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Shared production calendar engine instance
static PRODUCTION_CALENDAR_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<CalendarEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Shared production search engine instance
static PRODUCTION_SEARCH_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<SearchEngine>>>> =
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
            is_read: message.flags.is_read,
            is_starred: message.flags.is_starred,
            received_at: message.date.timestamp(),
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

/// Get messages for account (with automatic search indexing)
#[napi]
pub async fn get_mail_messages(account_id: String) -> Result<Vec<NapiMailMessage>> {
    let engine_guard = MAIL_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Engine not initialized"))?;
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    let messages = engine.get_messages(account_uuid, None, Some(100), Some(0)).await
        .map_err(|e| Error::from_reason(e.to_string()))?;
    
    // Auto-index messages in search engine if initialized
    if let Ok(search_guard) = SEARCH_ENGINE.try_lock() {
        if let Some(_search_engine) = search_guard.as_ref() {
            for message in &messages {
                // Index each message for search in background
                let message_id = message.id.to_string();
                let account_id_clone = account_id.clone();
                let subject = message.subject.clone();
                let from_address = message.from.email.clone();
                let from_name = Some(message.from.name.clone().unwrap_or_default());
                let to_addresses = message.to.iter().map(|addr| addr.email.clone()).collect();
                let body_text = message.body_text.clone();
                let body_html = message.body_html.clone();
                let received_at = message.date;
                let folder = Some(message.folder.clone());
                
                tokio::spawn(async move {
                    let result = index_email_message(
                        message_id.clone(),
                        account_id_clone,
                        subject,
                        from_address,
                        from_name,
                        to_addresses,
                        body_text,
                        body_html,
                        received_at,
                        folder,
                    ).await;
                    
                    if let Err(e) = result {
                        tracing::warn!("Failed to auto-index email {}: {:?}", message_id, e);
                    }
                });
            }
            tracing::debug!("Auto-indexing {} email messages", messages.len());
        }
    }
    
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
                    oauth_tokens: None,
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
                oauth_tokens: None,
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

/// Get events for account (with automatic search indexing)
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
    
    // Auto-index events in search engine if initialized
    if let Ok(search_guard) = SEARCH_ENGINE.try_lock() {
        if let Some(_search_engine) = search_guard.as_ref() {
            for event in &events {
                // Index each event for search in background
                let event_id = event.id.clone();
                let calendar_id = account_id.clone();
                let title = event.title.clone();
                let description = event.description.clone();
                let location = event.location.clone();
                let start_time = event.start_time.timestamp();
                let end_time = event.end_time.timestamp();
                let is_all_day = event.is_all_day;
                let organizer = event.attendees.first().map(|a| a.email.clone());
                let attendees = event.attendees.clone();
                let status = event.status.clone();
                
                tokio::spawn(async move {
                    let result = index_calendar_event(
                        event_id.clone(),
                        calendar_id,
                        title,
                        description,
                        location,
                        start_time,
                        end_time,
                        is_all_day,
                        organizer,
                        attendees,
                        status,
                    ).await;
                    
                    if let Err(e) = result {
                        tracing::warn!("Failed to auto-index calendar event {}: {:?}", event_id, e);
                    }
                });
            }
            tracing::debug!("Auto-indexing {} calendar events", events.len());
        }
    }
    
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

/// Update calendar event
#[napi]
pub async fn update_calendar_event(
    calendar_id: String,
    event_id: String,
    title: Option<String>,
    start_time: Option<i64>,
    end_time: Option<i64>,
    description: Option<String>,
    location: Option<String>,
) -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    let updates = crate::calendar::types::UpdateCalendarEventInput {
        title,
        description,
        location,
        start_time: start_time.map(|t| DateTime::from_timestamp(t, 0).unwrap_or_default()),
        end_time: end_time.map(|t| DateTime::from_timestamp(t, 0).unwrap_or_default()),
        ..Default::default()
    };
    
    engine.update_event(&calendar_id, &event_id, &updates).await
        .map_err(|e| Error::from_reason(format!("Failed to update calendar event: {}", e)))?;
    
    tracing::info!("Calendar event updated: {}", event_id);
    Ok(())
}

/// Delete calendar event
#[napi]
pub async fn delete_calendar_event(calendar_id: String, event_id: String) -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    engine.delete_event(&calendar_id, &event_id).await
        .map_err(|e| Error::from_reason(format!("Failed to delete calendar event: {}", e)))?;
    
    tracing::info!("Calendar event deleted: {}", event_id);
    Ok(())
}

/// Get events in a date range
#[napi]
pub async fn get_calendar_events_in_range(
    account_id: String,
    start_time: i64,
    end_time: i64,
) -> Result<Vec<NapiCalendarEvent>> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    let start_dt = DateTime::from_timestamp(start_time, 0)
        .ok_or_else(|| Error::from_reason("Invalid start time"))?;
    let end_dt = DateTime::from_timestamp(end_time, 0)
        .ok_or_else(|| Error::from_reason("Invalid end time"))?;
    
    let events = engine.get_events_in_range(&account_id, start_dt, end_dt).await
        .map_err(|e| Error::from_reason(format!("Failed to get events: {}", e)))?;
    
    Ok(events.into_iter().map(|event| NapiCalendarEvent {
        id: event.id,
        calendar_id: event.calendar_id,
        title: event.title,
        description: event.description,
        location: event.location,
        start_time: event.start_time.timestamp(),
        end_time: event.end_time.timestamp(),
        is_all_day: event.all_day,
        organizer: event.organizer.unwrap_or_default(),
        attendees: event.attendees.unwrap_or_default(),
        status: event.status,
        visibility: event.visibility.unwrap_or_default(),
        recurrence_rule: event.recurrence_rule,
    }).collect())
}

/// Create a new calendar
#[napi]
pub async fn create_calendar(
    account_id: String,
    name: String,
    description: Option<String>,
    color: Option<String>,
) -> Result<String> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    let calendar = crate::calendar::types::Calendar {
        id: uuid::Uuid::new_v4().to_string(),
        account_id,
        name,
        description: description.unwrap_or_default(),
        color: color.unwrap_or_default(),
        ..Default::default()
    };
    
    let created_calendar = engine.create_calendar(&calendar).await
        .map_err(|e| Error::from_reason(format!("Failed to create calendar: {}", e)))?;
    
    Ok(created_calendar.id)
}

/// Update calendar properties
#[napi]
pub async fn update_calendar(
    calendar_id: String,
    name: Option<String>,
    description: Option<String>,
    color: Option<String>,
) -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    // Get existing calendar first
    let mut calendar = engine.get_calendar(&calendar_id).await
        .map_err(|e| Error::from_reason(format!("Failed to get calendar: {}", e)))?;
    
    // Update fields if provided
    if let Some(name) = name {
        calendar.name = name;
    }
    if let Some(description) = description {
        calendar.description = description;
    }
    if let Some(color) = color {
        calendar.color = color;
    }
    
    // This assumes there's an update_calendar method in the engine
    // If not, this would need to be implemented
    Err(Error::from_reason("Update calendar functionality not yet implemented in calendar engine"))
}

/// Delete a calendar
#[napi]
pub async fn delete_calendar(calendar_id: String) -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    // This assumes there's a delete_calendar method in the engine
    // If not, this would need to be implemented in the calendar engine
    Err(Error::from_reason("Delete calendar functionality not yet implemented in calendar engine"))
}

/// Get free/busy information for a calendar
#[napi]
pub async fn query_free_busy(
    account_id: String,
    start_time: i64,
    end_time: i64,
    calendars: Vec<String>,
) -> Result<String> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    let start_dt = DateTime::from_timestamp(start_time, 0)
        .ok_or_else(|| Error::from_reason("Invalid start time"))?;
    let end_dt = DateTime::from_timestamp(end_time, 0)
        .ok_or_else(|| Error::from_reason("Invalid end time"))?;
    
    let query = crate::calendar::types::FreeBusyQuery {
        time_min: start_dt,
        time_max: end_dt,
        items: calendars.into_iter().map(|id| crate::calendar::types::FreeBusyRequestItem {
            id,
        }).collect(),
    };
    
    let response = engine.query_free_busy(&query).await
        .map_err(|e| Error::from_reason(format!("Failed to query free/busy: {}", e)))?;
    
    let response_json = serde_json::to_string(&response)
        .map_err(|e| Error::from_reason(format!("Failed to serialize free/busy response: {}", e)))?;
    
    Ok(response_json)
}

/// Remove calendar account
#[napi]
pub async fn remove_calendar_account(account_id: String) -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    engine.delete_account(&account_id).await
        .map_err(|e| Error::from_reason(format!("Failed to remove calendar account: {}", e)))?;
    
    tracing::info!("Calendar account removed: {}", account_id);
    Ok(())
}

/// Get account calendars with details
#[napi]
pub async fn get_account_calendars_detailed(account_id: String) -> Result<String> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    let calendars = engine.list_calendars(&account_id).await
        .map_err(|e| Error::from_reason(format!("Failed to get calendars: {}", e)))?;
    
    let calendars_json = serde_json::to_string(&calendars)
        .map_err(|e| Error::from_reason(format!("Failed to serialize calendars: {}", e)))?;
    
    Ok(calendars_json)
}

/// Start calendar engine background sync
#[napi]
pub async fn start_calendar_sync() -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    engine.start().await
        .map_err(|e| Error::from_reason(format!("Failed to start calendar sync: {}", e)))?;
    
    tracing::info!("Calendar sync started");
    Ok(())
}

/// Stop calendar engine background sync
#[napi]
pub async fn stop_calendar_sync() -> Result<()> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    engine.stop().await
        .map_err(|e| Error::from_reason(format!("Failed to stop calendar sync: {}", e)))?;
    
    tracing::info!("Calendar sync stopped");
    Ok(())
}

/// Force sync calendar account with server
#[napi]
pub async fn force_sync_calendar_account(account_id: String) -> Result<NapiCalendarSyncStatus> {
    let engine_guard = CALENDAR_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Calendar engine not initialized"))?;
    
    let sync_result = engine.sync_account(&account_id, true).await
        .map_err(|e| Error::from_reason(format!("Failed to force sync calendar account: {}", e)))?;
    
    Ok(NapiCalendarSyncStatus {
        account_id: sync_result.account_id,
        last_sync: sync_result.last_sync.map(|dt| dt.timestamp()),
        is_syncing: sync_result.is_syncing,
        sync_errors: sync_result.sync_errors,
        calendars_synced: sync_result.calendars_synced,
        events_synced: sync_result.events_synced,
    })
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
    pub description: Option<String>,
    pub url: Option<String>,
    pub content_type: String,
    pub provider_id: String,
    pub provider_type: String,
    pub score: f64,
    pub highlights: Option<Vec<NapiSearchHighlight>>,
    pub metadata: String, // JSON string
    pub created_at: String,
    pub last_modified: String,
}

/// Search highlight for NAPI
#[napi(object)]
pub struct NapiSearchHighlight {
    pub field: String,
    pub fragments: Vec<String>,
}

/// Search query for NAPI
#[napi(object)]
pub struct NapiSearchQuery {
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

/// Search response for NAPI
#[napi(object)]
pub struct NapiSearchResponse {
    pub results: Vec<NapiSearchResult>,
    pub total_count: u32,
    pub execution_time_ms: u32,
    pub suggestions: Option<Vec<String>>,
}

/// Initialize search engine with configuration
#[napi]
pub async fn init_search_engine(index_dir: Option<String>) -> Result<String> {
    let mut engine_guard = SEARCH_ENGINE.lock().await;
    
    // Create a new search engine if not already initialized
    if engine_guard.is_none() {
        let config = if let Some(dir) = index_dir {
            crate::search::SearchConfig {
                index_dir: std::path::PathBuf::from(dir),
                max_memory_mb: 512,
                max_response_time_ms: 300,
                num_threads: num_cpus::get(),
                enable_analytics: true,
                enable_suggestions: true,
                enable_realtime: true,
                providers: vec![
                    crate::search::ProviderConfig {
                        id: "email".to_string(),
                        provider_type: "gmail".to_string(),
                        enabled: true,
                        weight: 1.0,
                        config: serde_json::json!({}),
                    },
                    crate::search::ProviderConfig {
                        id: "calendar".to_string(),
                        provider_type: "google".to_string(),
                        enabled: true,
                        weight: 1.0,
                        config: serde_json::json!({}),
                    },
                ],
            }
        } else {
            let mut config = crate::search::SearchConfig::default();
            config.providers = vec![
                crate::search::ProviderConfig {
                    id: "email".to_string(),
                    provider_type: "gmail".to_string(),
                    enabled: true,
                    weight: 1.0,
                    config: serde_json::json!({}),
                },
                crate::search::ProviderConfig {
                    id: "calendar".to_string(),
                    provider_type: "google".to_string(),
                    enabled: true,
                    weight: 1.0,
                    config: serde_json::json!({}),
                },
            ];
            config
        };
        
        let engine = crate::search::SearchEngine::new(config).await
            .map_err(|e| napi::Error::from_reason(format!("Search engine init error: {:?}", e)))?;
        *engine_guard = Some(engine);
        
        tracing::info!("Search engine initialized with Tantivy backend and multi-source indexing");
    }
    
    Ok("Search engine initialized with Tantivy backend and multi-source indexing".to_string())
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
        account_id: None,
        file_path: None,
        url: None,
        icon: None,
        thumbnail: None,
        metadata: crate::search::DocumentMetadata {
            author: None,
            created_at: Some(chrono::Utc::now()),
            modified_at: Some(chrono::Utc::now()),
            file_size: Some(content.len() as u64),
            size: Some(content.len() as u64),
            file_type: Some("text".to_string()),
            mime_type: Some("text/plain".to_string()),
            language: Some("en".to_string()),
            tags: Vec::new(),
            custom_fields: serde_json::from_str(&metadata).unwrap_or_default(),
            location: None,
            collaboration: None,
            activity: None,
            priority: None,
            status: None,
            custom: std::collections::HashMap::new(),
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

/// Search documents with advanced query
#[napi]
pub async fn search_documents(query: NapiSearchQuery) -> Result<NapiSearchResponse> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    // Convert content types
    let content_types = query.content_types.map(|types| {
        types.into_iter().map(|t| match t.as_str() {
            "email" => crate::search::ContentType::Email,
            "calendar_event" => crate::search::ContentType::CalendarEvent,
            "contact" => crate::search::ContentType::Contact,
            "file" => crate::search::ContentType::File,
            "document" => crate::search::ContentType::Document,
            "message" => crate::search::ContentType::Message,
            "task" => crate::search::ContentType::Task,
            _ => crate::search::ContentType::Document,
        }).collect()
    });
    
    let search_options = crate::search::SearchOptions {
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
        content_types: content_types.clone(),
        limit: query.limit.map(|l| l as usize),
        offset: query.offset.map(|o| o as usize),
        sort_by: None,
        sort_order: None,
        filters: None,
        highlight: query.highlighting,
    };
    
    let search_query = crate::search::SearchQuery {
        query: query.query,
        content_types,
        provider_ids: query.provider_ids,
        filters: None,
        sort: None,
        limit: Some(query.limit.unwrap_or(20) as usize),
        offset: Some(query.offset.unwrap_or(0) as usize),
        options: search_options,
    };
    
    let response = engine.search(search_query).await
        .map_err(|e| napi::Error::from_reason(format!("Search error: {:?}", e)))?;
    
    let napi_results = response.results
        .into_iter()
        .map(|result| NapiSearchResult {
            id: result.id,
            title: result.title,
            content: result.content.unwrap_or_default(),
            description: result.description,
            url: result.url,
            content_type: result.content_type.as_str().to_string(),
            provider_id: result.provider_id,
            provider_type: result.provider_type.as_str().to_string(),
            score: result.score as f64,
            highlights: result.highlights.map(|highlights| {
                highlights.into_iter().map(|h| NapiSearchHighlight {
                    field: h.field,
                    fragments: h.fragments,
                }).collect()
            }),
            metadata: serde_json::to_string(&result.metadata).unwrap_or_default(),
            created_at: result.created_at.to_rfc3339(),
            last_modified: result.last_modified.to_rfc3339(),
        })
        .collect();
    
    Ok(NapiSearchResponse {
        results: napi_results,
        total_count: response.total_count as u32,
        execution_time_ms: response.execution_time_ms as u32,
        suggestions: response.suggestions,
    })
}

/// Search documents with simple query string
#[napi]
pub async fn search_simple(query: String, limit: Option<u32>) -> Result<Vec<NapiSearchResult>> {
    let search_query = NapiSearchQuery {
        query,
        content_types: None,
        provider_ids: None,
        limit,
        offset: Some(0),
        fuzzy: Some(true),
        highlighting: Some(true),
        suggestions: Some(false),
        timeout: Some(5000),
    };
    
    let response = search_documents(search_query).await?;
    Ok(response.results)
}

/// Get search suggestions
#[napi]
pub async fn get_search_suggestions(partial_query: String, limit: Option<u32>) -> Result<Vec<String>> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let suggestions = engine.get_suggestions(&partial_query, limit.unwrap_or(10) as usize).await
        .map_err(|e| napi::Error::from_reason(format!("Suggestions error: {:?}", e)))?;
    
    Ok(suggestions)
}

/// Index email message for search
#[napi]
pub async fn index_email_message(
    message_id: String,
    account_id: String,
    subject: String,
    from_address: String,
    from_name: Option<String>,
    to_addresses: Vec<String>,
    body_text: Option<String>,
    body_html: Option<String>,
    received_at: i64,
    folder: Option<String>,
) -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let content = [
        subject.clone(),
        body_text.unwrap_or_default(),
        body_html.as_ref().map(|html| html2text::from_read(html.as_bytes(), 80)).unwrap_or_default()
    ].join(" ").trim().to_string();
    
    let checksum = format!("{:x}", md5::compute(format!("{}{}", subject, content).as_bytes()));
    
    let mut custom_metadata = std::collections::HashMap::new();
    custom_metadata.insert("from_address".to_string(), serde_json::Value::String(from_address.clone()));
    if let Some(name) = from_name.clone() {
        custom_metadata.insert("from_name".to_string(), serde_json::Value::String(name));
    }
    custom_metadata.insert("to_addresses".to_string(), serde_json::Value::Array(
        to_addresses.iter().map(|addr| serde_json::Value::String(addr.clone())).collect()
    ));
    custom_metadata.insert("received_at".to_string(), serde_json::Value::Number(received_at.into()));
    if let Some(f) = folder.clone() {
        custom_metadata.insert("folder".to_string(), serde_json::Value::String(f));
    }
    
    let document = crate::search::SearchDocument {
        id: format!("email_{}", message_id),
        title: subject,
        content,
        summary: body_text.as_ref().and_then(|text| {
            if text.len() > 200 {
                Some(format!("{}...", &text[..200]))
            } else {
                Some(text.clone())
            }
        }),
        content_type: crate::search::ContentType::Email,
        provider_id: account_id,
        provider_type: crate::search::ProviderType::Gmail,
        account_id: Some(account_id),
        file_path: None,
        url: Some(format!("email://{}", message_id)),
        icon: Some("mail".to_string()),
        thumbnail: None,
        metadata: crate::search::DocumentMetadata {
            author: from_name.clone().or(Some(from_address.clone())),
            created_at: chrono::DateTime::from_timestamp(received_at, 0),
            modified_at: chrono::DateTime::from_timestamp(received_at, 0),
            file_size: Some(content.len() as u64),
            size: Some(content.len() as u64),
            file_type: Some("email".to_string()),
            mime_type: Some("message/rfc822".to_string()),
            language: Some("en".to_string()),
            tags: vec!["email".to_string()],
            custom_fields: custom_metadata,
            location: None,
            collaboration: None,
            activity: None,
            priority: None,
            status: None,
            custom: std::collections::HashMap::new(),
        },
        tags: vec!["email".to_string()],
        categories: vec![folder.unwrap_or("inbox".to_string())],
        author: from_name.or(Some(from_address)),
        created_at: chrono::DateTime::from_timestamp(received_at, 0).unwrap_or(chrono::Utc::now()),
        last_modified: chrono::DateTime::from_timestamp(received_at, 0).unwrap_or(chrono::Utc::now()),
        indexing_info: crate::search::IndexingInfo {
            indexed_at: chrono::Utc::now(),
            version: 1,
            checksum,
            index_type: crate::search::IndexType::Full,
        },
    };
    
    engine.index_document(document).await
        .map_err(|e| napi::Error::from_reason(format!("Email indexing error: {:?}", e)))?;
    
    tracing::debug!("Indexed email message: {}", message_id);
    Ok(())
}

/// Index calendar event for search
#[napi]
pub async fn index_calendar_event(
    event_id: String,
    calendar_id: String,
    title: String,
    description: Option<String>,
    location: Option<String>,
    start_time: i64,
    end_time: i64,
    is_all_day: bool,
    organizer: Option<String>,
    attendees: Vec<String>,
    status: String,
) -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let content = [
        title.clone(),
        description.clone().unwrap_or_default(),
        location.clone().unwrap_or_default(),
        organizer.clone().unwrap_or_default(),
        attendees.join(", ")
    ].join(" ").trim().to_string();
    
    let checksum = format!("{:x}", md5::compute(format!("{}{}", title, content).as_bytes()));
    
    let mut custom_metadata = std::collections::HashMap::new();
    custom_metadata.insert("start_time".to_string(), serde_json::Value::Number(start_time.into()));
    custom_metadata.insert("end_time".to_string(), serde_json::Value::Number(end_time.into()));
    custom_metadata.insert("is_all_day".to_string(), serde_json::Value::Bool(is_all_day));
    custom_metadata.insert("status".to_string(), serde_json::Value::String(status.clone()));
    if let Some(org) = organizer.clone() {
        custom_metadata.insert("organizer".to_string(), serde_json::Value::String(org));
    }
    custom_metadata.insert("attendees".to_string(), serde_json::Value::Array(
        attendees.iter().map(|addr| serde_json::Value::String(addr.clone())).collect()
    ));
    
    let document = crate::search::SearchDocument {
        id: format!("event_{}", event_id),
        title: title.clone(),
        content,
        summary: description.clone(),
        content_type: crate::search::ContentType::CalendarEvent,
        provider_id: calendar_id,
        provider_type: crate::search::ProviderType::Gmail, // Assuming Google Calendar
        account_id: None,
        file_path: None,
        url: Some(format!("calendar://{}", event_id)),
        icon: Some("calendar".to_string()),
        thumbnail: None,
        metadata: crate::search::DocumentMetadata {
            author: organizer.clone(),
            created_at: Some(chrono::DateTime::from_timestamp(start_time, 0).unwrap_or(chrono::Utc::now())),
            modified_at: Some(chrono::Utc::now()),
            file_size: Some(content.len() as u64),
            size: Some(content.len() as u64),
            file_type: Some("calendar_event".to_string()),
            mime_type: Some("text/calendar".to_string()),
            language: Some("en".to_string()),
            tags: vec!["calendar".to_string(), "event".to_string()],
            custom_fields: std::collections::HashMap::new(),
            location: location.clone().map(|_loc| crate::search::types::LocationInfo {
                path: None,
                folder: None,
                workspace: None,
                project: None,
            }),
            collaboration: Some(crate::search::types::CollaborationInfo {
                shared: !attendees.is_empty(),
                collaborators: attendees.clone(),
                permissions: Some("read".to_string()),
            }),
            activity: None,
            priority: None,
            status: Some(status.clone()),
            custom: custom_metadata,
        },
        tags: vec!["calendar".to_string(), "event".to_string()],
        categories: vec!["calendar".to_string()],
        author: organizer,
        created_at: chrono::DateTime::from_timestamp(start_time, 0).unwrap_or(chrono::Utc::now()),
        last_modified: chrono::Utc::now(),
        indexing_info: crate::search::IndexingInfo {
            indexed_at: chrono::Utc::now(),
            version: 1,
            checksum,
            index_type: crate::search::IndexType::Full,
        },
    };
    
    engine.index_document(document).await
        .map_err(|e| napi::Error::from_reason(format!("Calendar event indexing error: {:?}", e)))?;
    
    tracing::debug!("Indexed calendar event: {}", event_id);
    Ok(())
}

/// Delete document from search index
#[napi]
pub async fn delete_document_from_index(document_id: String) -> Result<bool> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let deleted = engine.delete_document(&document_id).await
        .map_err(|e| napi::Error::from_reason(format!("Delete error: {:?}", e)))?;
    
    tracing::debug!("Document deletion result for {}: {}", document_id, deleted);
    Ok(deleted)
}

/// Optimize search index
#[napi]
pub async fn optimize_search_index() -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    engine.optimize_indices().await
        .map_err(|e| napi::Error::from_reason(format!("Optimization error: {:?}", e)))?;
    
    tracing::info!("Search index optimization completed");
    Ok(())
}

/// Get search analytics
#[napi(object)]
pub struct NapiSearchAnalytics {
    pub total_documents: u32,
    pub total_searches: u32,
    pub avg_response_time_ms: f64,
    pub success_rate: f64,
    pub error_rate: f64,
    pub popular_queries: Vec<String>,
}

#[napi]
pub async fn get_search_analytics() -> Result<NapiSearchAnalytics> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let analytics = engine.get_analytics().await
        .map_err(|e| napi::Error::from_reason(format!("Analytics error: {:?}", e)))?;
    
    Ok(NapiSearchAnalytics {
        total_documents: engine.get_health_status().await.total_documents as u32,
        total_searches: analytics.performance.total_queries as u32,
        avg_response_time_ms: analytics.performance.avg_response_time_ms,
        success_rate: analytics.performance.success_rate,
        error_rate: analytics.errors.error_rate,
        popular_queries: analytics.popular_queries.into_iter().map(|q| q.query).collect(),
    })
}

/// Clear search cache
#[napi]
pub async fn clear_search_cache() -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard.as_ref().ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    engine.clear_cache().await;
    tracing::info!("Search cache cleared");
    Ok(())
}

/// Rebuild search index from scratch
#[napi]
pub async fn rebuild_search_index() -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    engine.rebuild_index().await
        .map_err(|e| Error::from_reason(format!("Failed to rebuild search index: {}", e)))?;
    
    tracing::info!("Search index rebuilt successfully");
    Ok(())
}

/// Get search index statistics
#[napi]
pub async fn get_search_index_stats() -> Result<String> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let stats = engine.get_index_stats().await
        .map_err(|e| Error::from_reason(format!("Failed to get index stats: {}", e)))?;
    
    let stats_json = serde_json::to_string(&stats)
        .map_err(|e| Error::from_reason(format!("Failed to serialize stats: {}", e)))?;
    
    Ok(stats_json)
}

/// Convert NAPI advanced search filters to internal search filters
fn convert_napi_filters_to_internal(query: &NapiAdvancedSearchQuery) -> Vec<crate::search::types::SearchFilter> {
    let mut filters = Vec::new();
    
    if let Some(doc_type) = &query.document_type {
        filters.push(crate::search::types::SearchFilter::DocumentType(doc_type.clone()));
    }
    
    if let Some(sender) = &query.sender {
        filters.push(crate::search::types::SearchFilter::Field {
            field: "sender".to_string(),
            value: sender.clone(),
            operator: crate::search::types::FilterOperator::Equals,
        });
    }
    
    if let Some(folder) = &query.folder {
        filters.push(crate::search::types::SearchFilter::Field {
            field: "folder".to_string(),
            value: folder.clone(),
            operator: crate::search::types::FilterOperator::Equals,
        });
    }
    
    if let Some(date_from) = query.date_from {
        let from_date = chrono::DateTime::from_timestamp(date_from, 0)
            .unwrap_or_default();
        filters.push(crate::search::types::SearchFilter::DateRange {
            field: "date".to_string(),
            from: Some(from_date),
            to: None,
        });
    }
    
    if let Some(date_to) = query.date_to {
        let to_date = chrono::DateTime::from_timestamp(date_to, 0)
            .unwrap_or_default();
        filters.push(crate::search::types::SearchFilter::DateRange {
            field: "date".to_string(),
            from: None,
            to: Some(to_date),
        });
    }
    
    filters
}

/// Advanced search with multiple filters
#[napi(object)]
pub struct NapiAdvancedSearchQuery {
    pub query: String,
    pub document_type: Option<String>,
    pub date_from: Option<i64>,
    pub date_to: Option<i64>,
    pub sender: Option<String>,
    pub folder: Option<String>,
    pub has_attachments: Option<bool>,
    pub is_read: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[napi]
pub async fn advanced_search_documents(query: NapiAdvancedSearchQuery) -> Result<NapiSearchResponse> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let search_query = crate::search::types::SearchQuery {
        query: query.query,
        limit: query.limit.unwrap_or(50) as usize,
        offset: query.offset.unwrap_or(0) as usize,
        filters: convert_napi_filters_to_internal(&query), // Convert NAPI filters to internal search filters
        sort_by: None,
        highlight: true,
    };
    
    let results = engine.search(&search_query).await
        .map_err(|e| Error::from_reason(format!("Advanced search failed: {}", e)))?;
    
    Ok(NapiSearchResponse {
        results: results.results.into_iter().map(|r| NapiSearchResult {
            id: r.id,
            title: r.title,
            content: r.content,
            document_type: r.document_type,
            score: r.score,
            highlights: r.highlights.unwrap_or_default().into_iter().map(|h| NapiSearchHighlight {
                field: h.field,
                fragments: h.fragments,
            }).collect(),
            metadata: r.metadata,
            last_modified: r.last_modified,
        }).collect(),
        total_hits: results.total_hits as u32,
        query_time_ms: results.query_time.as_millis() as u32,
        has_more: results.has_more,
        suggestions: results.suggestions.unwrap_or_default(),
    })
}

/// Search within specific document types
#[napi]
pub async fn search_by_type(document_type: String, query: String, limit: Option<u32>) -> Result<Vec<NapiSearchResult>> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let search_query = crate::search::types::SearchQuery {
        query: format!("type:{} AND ({})", document_type, query),
        limit: limit.unwrap_or(50) as usize,
        offset: 0,
        filters: vec![],
        sort_by: None,
        highlight: true,
    };
    
    let results = engine.search(&search_query).await
        .map_err(|e| Error::from_reason(format!("Type search failed: {}", e)))?;
    
    Ok(results.results.into_iter().map(|r| NapiSearchResult {
        id: r.id,
        title: r.title,
        content: r.content,
        document_type: r.document_type,
        score: r.score,
        highlights: r.highlights.unwrap_or_default().into_iter().map(|h| NapiSearchHighlight {
            field: h.field,
            fragments: h.fragments,
        }).collect(),
        metadata: r.metadata,
        last_modified: r.last_modified,
    }).collect())
}

/// Get recently indexed documents
#[napi]
pub async fn get_recent_documents(limit: Option<u32>) -> Result<Vec<NapiSearchResult>> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let search_query = crate::search::types::SearchQuery {
        query: "*".to_string(),
        limit: limit.unwrap_or(20) as usize,
        offset: 0,
        filters: vec![],
        sort_by: Some(crate::search::types::SortBy::LastModified),
        highlight: false,
    };
    
    let results = engine.search(&search_query).await
        .map_err(|e| Error::from_reason(format!("Recent documents search failed: {}", e)))?;
    
    Ok(results.results.into_iter().map(|r| NapiSearchResult {
        id: r.id,
        title: r.title,
        content: r.content,
        document_type: r.document_type,
        score: r.score,
        highlights: vec![],
        metadata: r.metadata,
        last_modified: r.last_modified,
    }).collect())
}

/// Auto-index email thread with messages
#[napi]
pub async fn index_email_thread(
    thread_id: String,
    messages: Vec<serde_json::Value>,
) -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    // Index each message in the thread
    for (i, message_json) in messages.iter().enumerate() {
        let document = crate::search::types::Document {
            id: format!("{}_{}", thread_id, i),
            title: message_json.get("subject")
                .and_then(|v| v.as_str())
                .unwrap_or("No Subject")
                .to_string(),
            content: message_json.get("body")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            document_type: "email_thread".to_string(),
            metadata: message_json.clone(),
            last_modified: chrono::Utc::now(),
        };
        
        engine.index_document(document).await
            .map_err(|e| Error::from_reason(format!("Failed to index thread message: {}", e)))?;
    }
    
    tracing::info!("Email thread {} indexed with {} messages", thread_id, messages.len());
    Ok(())
}

/// Index calendar event with recurrence
#[napi]
pub async fn index_calendar_event_with_recurrence(
    event_id: String,
    event_data: serde_json::Value,
    recurrence_instances: Vec<serde_json::Value>,
) -> Result<()> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    // Index main event
    let main_document = crate::search::types::Document {
        id: event_id.clone(),
        title: event_data.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("No Title")
            .to_string(),
        content: format!(
            "{} {}",
            event_data.get("description")
                .and_then(|v| v.as_str())
                .unwrap_or(""),
            event_data.get("location")
                .and_then(|v| v.as_str())
                .unwrap_or("")
        ),
        document_type: "calendar_event".to_string(),
        metadata: event_data,
        last_modified: chrono::Utc::now(),
    };
    
    engine.index_document(main_document).await
        .map_err(|e| Error::from_reason(format!("Failed to index main event: {}", e)))?;
    
    // Index recurrence instances
    for (i, instance) in recurrence_instances.iter().enumerate() {
        let instance_document = crate::search::types::Document {
            id: format!("{}_instance_{}", event_id, i),
            title: format!("{} ({})", 
                instance.get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("No Title"),
                instance.get("start_time")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown Time")
            ),
            content: format!(
                "{} {}",
                instance.get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or(""),
                instance.get("location")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
            ),
            document_type: "calendar_event_instance".to_string(),
            metadata: instance.clone(),
            last_modified: chrono::Utc::now(),
        };
        
        engine.index_document(instance_document).await
            .map_err(|e| Error::from_reason(format!("Failed to index event instance: {}", e)))?;
    }
    
    tracing::info!("Calendar event {} indexed with {} recurrence instances", 
                   event_id, recurrence_instances.len());
    Ok(())
}

/// Full-text search with fuzzy matching
#[napi]
pub async fn fuzzy_search_documents(query: String, fuzziness: Option<u32>, limit: Option<u32>) -> Result<NapiSearchResponse> {
    let engine_guard = SEARCH_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Search engine not initialized"))?;
    
    let fuzzy_query = if let Some(fuzz) = fuzziness {
        format!("{}~{}", query, fuzz)
    } else {
        format!("{}~1", query) // Default fuzziness of 1
    };
    
    let search_query = crate::search::types::SearchQuery {
        query: fuzzy_query,
        limit: limit.unwrap_or(50) as usize,
        offset: 0,
        filters: vec![],
        sort_by: None,
        highlight: true,
    };
    
    let results = engine.search(&search_query).await
        .map_err(|e| Error::from_reason(format!("Fuzzy search failed: {}", e)))?;
    
    Ok(NapiSearchResponse {
        results: results.results.into_iter().map(|r| NapiSearchResult {
            id: r.id,
            title: r.title,
            content: r.content,
            document_type: r.document_type,
            score: r.score,
            highlights: r.highlights.unwrap_or_default().into_iter().map(|h| NapiSearchHighlight {
                field: h.field,
                fragments: h.fragments,
            }).collect(),
            metadata: r.metadata,
            last_modified: r.last_modified,
        }).collect(),
        total_hits: results.total_hits as u32,
        query_time_ms: results.query_time.as_millis() as u32,
        has_more: results.has_more,
        suggestions: results.suggestions.unwrap_or_default(),
    })
}

// ============================================================================
// OAuth2 Authentication NAPI Bindings
// ============================================================================

/// OAuth credentials for NAPI
#[napi(object)]
pub struct NapiOAuthCredentials {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub token_type: String,
    pub scope: String,
}

/// OAuth authorization URL response
#[napi(object)]
pub struct NapiOAuthAuthUrl {
    pub url: String,
    pub state: String,
    pub code_verifier: Option<String>,
    pub code_challenge: Option<String>,
}

/// OAuth token response from provider
#[napi(object)]
pub struct NapiOAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub id_token: Option<String>,
}

/// OAuth user info
#[napi(object)]
pub struct NapiOAuthUserInfo {
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub verified_email: Option<bool>,
}

/// OAuth callback result
#[napi(object)]
pub struct NapiOAuthCallbackResult {
    pub tokens: NapiOAuthTokens,
    pub user_info: NapiOAuthUserInfo,
}

/// OAuth provider configuration
#[napi(object)]
#[derive(Clone)]
pub struct NapiOAuthProviderConfig {
    pub provider: String,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub auth_url: Option<String>,
    pub token_url: Option<String>,
    pub user_info_url: Option<String>,
    pub requires_client_secret: bool,
    pub supports_pkce: bool,
}

/// OAuth flow options
#[napi(object)]
pub struct NapiOAuthFlowOptions {
    pub provider: String,
    pub interactive: Option<bool>,
    pub force_consent: Option<bool>,
    pub login_hint: Option<String>,
    pub use_pkce: Option<bool>,
    pub additional_scopes: Option<Vec<String>>,
}

use crate::mail::auth::{AuthManager, AuthCredentials};
use crate::mail::types::MailProvider;

/// Shared OAuth manager instance
static OAUTH_MANAGER: once_cell::sync::Lazy<Arc<Mutex<Option<AuthManager>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Initialize OAuth manager with storage path
#[napi]
pub async fn init_oauth_manager(storage_path: Option<String>) -> Result<()> {
    let mut manager_guard = OAUTH_MANAGER.lock().await;
    
    let auth_manager = if let Some(path) = storage_path {
        AuthManager::with_storage_file(path).await
            .map_err(|e| Error::from_reason(format!("OAuth manager initialization failed: {}", e)))?
    } else {
        AuthManager::new()
            .map_err(|e| Error::from_reason(format!("OAuth manager initialization failed: {:?}", e)))?
    };
    
    *manager_guard = Some(auth_manager);
    tracing::info!("OAuth manager initialized successfully");
    Ok(())
}

/// Register OAuth client credentials for a provider
#[napi]
pub async fn register_oauth_provider(
    provider: String,
    client_id: String,
    client_secret: String,
) -> Result<()> {
    let mut manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_mut()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let mail_provider = match provider.as_str() {
        "gmail" | "google" => MailProvider::Gmail,
        "outlook" | "microsoft" => MailProvider::Outlook,
        _ => return Err(Error::from_reason(format!("Unsupported provider: {}", provider))),
    };
    
    manager.register_oauth_client(mail_provider, client_id, client_secret)
        .map_err(|e| Error::from_reason(format!("Failed to register OAuth provider: {}", e)))?;
    
    tracing::info!("OAuth provider registered successfully: {}", provider);
    Ok(())
}

/// Get OAuth authorization URL for a provider
#[napi]
pub async fn get_oauth_auth_url(
    provider: String,
    client_id: String,
    redirect_uri: String,
) -> Result<NapiOAuthAuthUrl> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let mail_provider = match provider.as_str() {
        "gmail" | "google" => MailProvider::Gmail,
        "outlook" | "microsoft" => MailProvider::Outlook,
        _ => return Err(Error::from_reason(format!("Unsupported provider: {}", provider))),
    };
    
    let auth_url = manager.get_authorization_url(mail_provider, &client_id, &redirect_uri).await
        .map_err(|e| Error::from_reason(format!("Failed to get OAuth URL: {}", e)))?;
    
    // Extract state from URL (in a real implementation, we'd store and return the actual state)
    let state = format!("state_{}", chrono::Utc::now().timestamp_millis());
    
    Ok(NapiOAuthAuthUrl {
        url: auth_url,
        state,
        code_verifier: None,
        code_challenge: None,
    })
}

/// Handle OAuth authorization callback
#[napi]
pub async fn handle_oauth_callback(
    code: String,
    state: String,
    provider: String,
    redirect_uri: String,
) -> Result<NapiOAuthCallbackResult> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let mail_provider = match provider.as_str() {
        "gmail" | "google" => MailProvider::Gmail,
        "outlook" | "microsoft" => MailProvider::Outlook,
        _ => return Err(Error::from_reason(format!("Unsupported provider: {}", provider))),
    };
    
    let tokens = manager.handle_callback(&code, &state, mail_provider, &redirect_uri).await
        .map_err(|e| Error::from_reason(format!("OAuth callback failed: {}", e)))?;
    
    // Get user info using the access token
    let user_info = get_user_info_from_provider(&tokens.access_token, &provider).await
        .map_err(|e| Error::from_reason(format!("Failed to get user info: {}", e)))?;
    
    Ok(NapiOAuthCallbackResult {
        tokens: NapiOAuthTokens {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at.map(|dt| dt.timestamp()),
            token_type: tokens.token_type,
            scope: tokens.scope,
            id_token: None,
        },
        user_info: NapiOAuthUserInfo {
            email: user_info.email,
            name: user_info.name,
            picture: user_info.picture,
            verified_email: user_info.verified_email,
        },
    })
}

/// Store OAuth credentials for an account
#[napi]
pub async fn store_oauth_credentials(
    account_id: String,
    provider: String,
    tokens: NapiOAuthTokens,
    scopes: Vec<String>,
) -> Result<()> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let mail_provider = match provider.as_str() {
        "gmail" | "google" => MailProvider::Gmail,
        "outlook" | "microsoft" => MailProvider::Outlook,
        _ => return Err(Error::from_reason(format!("Unsupported provider: {}", provider))),
    };
    
    let oauth_tokens = crate::mail::OAuthTokens {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at.and_then(|ts| chrono::DateTime::from_timestamp(ts, 0)),
        token_type: tokens.token_type,
        scope: tokens.scope,
    };
    
    manager.store_credentials(account_uuid, mail_provider, &oauth_tokens, scopes).await
        .map_err(|e| Error::from_reason(format!("Failed to store OAuth credentials: {}", e)))?;
    
    tracing::info!("OAuth credentials stored successfully for account: {}", account_id);
    Ok(())
}

/// Get stored OAuth credentials for an account
#[napi]
pub async fn get_oauth_credentials(account_id: String) -> Result<Option<NapiOAuthCredentials>> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let credentials = manager.get_credentials(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to get OAuth credentials: {}", e)))?;
    
    if let Some(creds) = credentials {
        Ok(Some(NapiOAuthCredentials {
            access_token: creds.access_token,
            refresh_token: creds.refresh_token,
            expires_at: creds.expires_at.map(|dt| dt.timestamp()),
            token_type: creds.token_type,
            scope: creds.scopes.join(" "),
        }))
    } else {
        Ok(None)
    }
}

/// Refresh OAuth access token
#[napi]
pub async fn refresh_oauth_token(
    provider: String,
    refresh_token: String,
) -> Result<NapiOAuthTokens> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let mail_provider = match provider.as_str() {
        "gmail" | "google" => MailProvider::Gmail,
        "outlook" | "microsoft" => MailProvider::Outlook,
        _ => return Err(Error::from_reason(format!("Unsupported provider: {}", provider))),
    };
    
    let tokens = manager.refresh_access_token(mail_provider, &refresh_token).await
        .map_err(|e| Error::from_reason(format!("Token refresh failed: {}", e)))?;
    
    Ok(NapiOAuthTokens {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_at.map(|dt| dt.timestamp()),
        token_type: tokens.token_type,
        scope: tokens.scope,
        id_token: None,
    })
}

/// Get valid access token for an account (handles refresh if needed)
#[napi]
pub async fn get_valid_oauth_token(account_id: String) -> Result<String> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let token = manager.get_valid_token(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to get valid token: {}", e)))?;
    
    Ok(token)
}

/// Revoke OAuth credentials for an account
#[napi]
pub async fn revoke_oauth_credentials(account_id: String) -> Result<()> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    manager.revoke_credentials(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to revoke OAuth credentials: {}", e)))?;
    
    tracing::info!("OAuth credentials revoked successfully for account: {}", account_id);
    Ok(())
}

/// Check if OAuth token needs refresh
#[napi]
pub async fn needs_token_refresh(account_id: String) -> Result<bool> {
    let manager_guard = OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("OAuth manager not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    if let Some(credentials) = manager.get_credentials(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to get credentials: {}", e)))? {
        
        let needs_refresh = if let Some(expires_at) = credentials.expires_at {
            // Refresh if expires within 5 minutes
            let five_minutes_from_now = chrono::Utc::now() + chrono::Duration::minutes(5);
            expires_at <= five_minutes_from_now
        } else {
            false // No expiration time, assume it's valid
        };
        
        Ok(needs_refresh)
    } else {
        Ok(false) // No credentials found
    }
}

/// Helper function to get user info from OAuth provider
async fn get_user_info_from_provider(access_token: &str, provider: &str) -> std::result::Result<NapiOAuthUserInfo, Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    
    let (user_info_url, email_field, name_field) = match provider {
        "gmail" | "google" => (
            "https://www.googleapis.com/oauth2/v2/userinfo",
            "email",
            "name"
        ),
        "outlook" | "microsoft" => (
            "https://graph.microsoft.com/v1.0/me",
            "mail",
            "displayName"
        ),
        _ => return Err(format!("Unsupported provider: {}", provider).into()),
    };
    
    let response = client
        .get(user_info_url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to get user info: HTTP {}", response.status()).into());
    }
    
    let user_data: serde_json::Value = response.json().await?;
    
    let email = user_data.get(email_field)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            // Try alternative email field for Microsoft
            if provider == "outlook" || provider == "microsoft" {
                user_data.get("userPrincipalName")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            } else {
                None
            }
        })
        .ok_or("Email not found in user info")?;
    
    let name = user_data.get(name_field)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let picture = user_data.get("picture")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    
    let verified_email = user_data.get("verified_email")
        .and_then(|v| v.as_bool());
    
    Ok(NapiOAuthUserInfo { 
        email, 
        name, 
        picture,
        verified_email,
    })
}

// ============================================================================
// Enhanced OAuth2 Production NAPI Bindings
// ============================================================================

/// Enhanced OAuth2 manager with PKCE support and comprehensive provider handling
use crate::calendar::auth::CalendarOAuthManager;
use std::collections::HashMap;

/// Shared production OAuth manager for both mail and calendar
static PRODUCTION_OAUTH_MANAGER: once_cell::sync::Lazy<Arc<Mutex<Option<ProductionOAuthManager>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

pub struct ProductionOAuthManager {
    mail_auth_manager: AuthManager,
    calendar_oauth_manager: CalendarOAuthManager,
    provider_configs: HashMap<String, NapiOAuthProviderConfig>,
    active_pkce_sessions: Arc<Mutex<HashMap<String, PkceSession>>>,
}

struct PkceSession {
    code_verifier: String,
    code_challenge: String,
    provider: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl ProductionOAuthManager {
    pub async fn new(storage_path: Option<String>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let mail_auth_manager = if let Some(path) = storage_path {
            AuthManager::with_storage_file(path).await?
        } else {
            AuthManager::new()?
        };
        
        let calendar_oauth_manager = CalendarOAuthManager::new();
        
        Ok(Self {
            mail_auth_manager,
            calendar_oauth_manager,
            provider_configs: HashMap::new(),
            active_pkce_sessions: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn register_provider_config(&mut self, config: NapiOAuthProviderConfig) {
        self.provider_configs.insert(config.provider.clone(), config);
    }

    pub async fn generate_authorization_url(
        &mut self,
        options: &NapiOAuthFlowOptions
    ) -> Result<NapiOAuthAuthUrl, Box<dyn std::error::Error + Send + Sync>> {
        let provider_config = self.provider_configs.get(&options.provider)
            .ok_or_else(|| format!("Provider {} not configured", options.provider))?;

        let use_pkce = options.use_pkce.unwrap_or(provider_config.supports_pkce);
        let state = uuid::Uuid::new_v4().to_string();

        let (code_verifier, code_challenge) = if use_pkce {
            use oauth2::{PkceCodeChallenge};
            let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
            
            // Store PKCE session
            let session = PkceSession {
                code_verifier: verifier.secret().clone(),
                code_challenge: challenge.as_str().to_string(),
                provider: options.provider.clone(),
                created_at: chrono::Utc::now(),
            };
            
            {
                let mut sessions = self.active_pkce_sessions.lock().await;
                sessions.insert(state.clone(), session);
            }
            
            (Some(verifier.secret().clone()), Some(challenge.as_str().to_string()))
        } else {
            (None, None)
        };

        // Generate authorization URL based on provider type
        let auth_url = match options.provider.as_str() {
            "gmail" | "google" => {
                let mail_provider = MailProvider::Gmail;
                self.mail_auth_manager.register_oauth_client(
                    mail_provider, 
                    provider_config.client_id.clone(), 
                    provider_config.client_secret.clone().unwrap_or_default()
                )?;
                self.mail_auth_manager.get_authorization_url(
                    mail_provider, 
                    &provider_config.client_id, 
                    &provider_config.redirect_uri
                ).await?
            },
            "outlook" | "microsoft" => {
                let mail_provider = MailProvider::Outlook;
                self.mail_auth_manager.register_oauth_client(
                    mail_provider, 
                    provider_config.client_id.clone(), 
                    provider_config.client_secret.clone().unwrap_or_default()
                )?;
                self.mail_auth_manager.get_authorization_url(
                    mail_provider, 
                    &provider_config.client_id, 
                    &provider_config.redirect_uri
                ).await?
            },
            "google_calendar" => {
                let calendar_provider = crate::calendar::CalendarProvider::Google;
                self.calendar_oauth_manager.register_oauth_client(
                    calendar_provider, 
                    provider_config.client_id.clone(), 
                    provider_config.client_secret.clone().unwrap_or_default()
                ).map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                self.calendar_oauth_manager.get_authorization_url(
                    calendar_provider, 
                    &provider_config.client_id, 
                    &provider_config.redirect_uri
                ).await.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?
            },
            _ => return Err(format!("Unsupported provider: {}", options.provider).into()),
        };

        Ok(NapiOAuthAuthUrl {
            url: auth_url,
            state,
            code_verifier,
            code_challenge,
        })
    }

    pub async fn exchange_authorization_code(
        &self,
        provider: &str,
        code: &str,
        state: &str,
        redirect_uri: &str,
    ) -> Result<NapiOAuthTokens, Box<dyn std::error::Error + Send + Sync>> {
        let provider_config = self.provider_configs.get(provider)
            .ok_or_else(|| format!("Provider {} not configured", provider))?;

        // Get and remove PKCE session if it exists
        let pkce_verifier = {
            let mut sessions = self.active_pkce_sessions.lock().await;
            sessions.remove(state).map(|session| session.code_verifier)
        };

        let tokens = match provider {
            "gmail" | "google" => {
                let mail_provider = MailProvider::Gmail;
                let oauth_tokens = self.mail_auth_manager.exchange_oauth_code(
                    mail_provider,
                    code,
                    &provider_config.client_id,
                    &provider_config.client_secret.clone().unwrap_or_default(),
                    redirect_uri,
                ).await?;

                NapiOAuthTokens {
                    access_token: oauth_tokens.access_token,
                    refresh_token: oauth_tokens.refresh_token,
                    expires_at: oauth_tokens.expires_at.map(|dt| dt.timestamp()),
                    token_type: Some("Bearer".to_string()),
                    scope: Some("gmail".to_string()),
                    id_token: None,
                }
            },
            "outlook" | "microsoft" => {
                let mail_provider = MailProvider::Outlook;
                let oauth_tokens = self.mail_auth_manager.exchange_oauth_code(
                    mail_provider,
                    code,
                    &provider_config.client_id,
                    &provider_config.client_secret.clone().unwrap_or_default(),
                    redirect_uri,
                ).await?;

                NapiOAuthTokens {
                    access_token: oauth_tokens.access_token,
                    refresh_token: oauth_tokens.refresh_token,
                    expires_at: oauth_tokens.expires_at.map(|dt| dt.timestamp()),
                    token_type: Some("Bearer".to_string()),
                    scope: Some("outlook".to_string()),
                    id_token: None,
                }
            },
            "google_calendar" => {
                let calendar_provider = crate::calendar::CalendarProvider::Google;
                let oauth_creds = self.calendar_oauth_manager.handle_callback(
                    code,
                    state,
                    calendar_provider,
                    redirect_uri,
                    "temp_account_id", // This would normally come from user context
                ).await.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

                NapiOAuthTokens {
                    access_token: oauth_creds.access_token,
                    refresh_token: oauth_creds.refresh_token,
                    expires_at: oauth_creds.expires_at.map(|dt| dt.timestamp()),
                    token_type: Some(oauth_creds.token_type),
                    scope: Some(oauth_creds.scope.join(" ")),
                    id_token: None,
                }
            },
            _ => return Err(format!("Unsupported provider: {}", provider).into()),
        };

        Ok(tokens)
    }

    pub async fn refresh_token_for_provider(
        &self,
        provider: &str,
        refresh_token: &str,
    ) -> Result<NapiOAuthTokens, Box<dyn std::error::Error + Send + Sync>> {
        let tokens = match provider {
            "gmail" | "google" => {
                let mail_provider = MailProvider::Gmail;
                let oauth_tokens = self.mail_auth_manager.refresh_access_token(
                    mail_provider,
                    refresh_token,
                ).await?;

                NapiOAuthTokens {
                    access_token: oauth_tokens.access_token,
                    refresh_token: oauth_tokens.refresh_token,
                    expires_at: oauth_tokens.expires_at.map(|dt| dt.timestamp()),
                    token_type: Some("Bearer".to_string()),
                    scope: Some("gmail".to_string()),
                    id_token: None,
                }
            },
            "outlook" | "microsoft" => {
                let mail_provider = MailProvider::Outlook;
                let oauth_tokens = self.mail_auth_manager.refresh_access_token(
                    mail_provider,
                    refresh_token,
                ).await?;

                NapiOAuthTokens {
                    access_token: oauth_tokens.access_token,
                    refresh_token: oauth_tokens.refresh_token,
                    expires_at: oauth_tokens.expires_at.map(|dt| dt.timestamp()),
                    token_type: Some("Bearer".to_string()),
                    scope: Some("outlook".to_string()),
                    id_token: None,
                }
            },
            "google_calendar" => {
                let calendar_provider = crate::calendar::CalendarProvider::Google;
                let oauth_creds = self.calendar_oauth_manager.refresh_access_token(
                    calendar_provider,
                    refresh_token,
                    "temp_account_id", // This would normally come from user context
                ).await.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

                NapiOAuthTokens {
                    access_token: oauth_creds.access_token,
                    refresh_token: oauth_creds.refresh_token,
                    expires_at: oauth_creds.expires_at.map(|dt| dt.timestamp()),
                    token_type: Some(oauth_creds.token_type),
                    scope: Some(oauth_creds.scope.join(" ")),
                    id_token: None,
                }
            },
            _ => return Err(format!("Unsupported provider: {}", provider).into()),
        };

        Ok(tokens)
    }

    pub async fn revoke_token_for_provider(
        &self,
        provider: &str,
        access_token: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        match provider {
            "gmail" | "google" => {
                let client = reqwest::Client::new();
                let response = client
                    .post("https://oauth2.googleapis.com/revoke")
                    .form(&[("token", access_token)])
                    .send()
                    .await?;
                    
                if !response.status().is_success() {
                    return Err(format!("Failed to revoke Google token: {}", response.status()).into());
                }
            },
            "outlook" | "microsoft" => {
                // Microsoft token revocation is handled differently
                tracing::info!("Microsoft token revocation handled by removing app permissions");
            },
            "google_calendar" => {
                let calendar_provider = crate::calendar::CalendarProvider::Google;
                self.calendar_oauth_manager.revoke_token(calendar_provider, access_token)
                    .await.map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
            },
            _ => return Err(format!("Unsupported provider: {}", provider).into()),
        }

        Ok(())
    }
}

/// Initialize production OAuth manager
#[napi]
pub async fn init_production_oauth_manager(storage_path: Option<String>) -> Result<()> {
    let mut manager_guard = PRODUCTION_OAUTH_MANAGER.lock().await;
    
    let production_manager = ProductionOAuthManager::new(storage_path).await
        .map_err(|e| Error::from_reason(format!("Production OAuth manager initialization failed: {}", e)))?;
    
    *manager_guard = Some(production_manager);
    tracing::info!("Production OAuth manager initialized successfully");
    Ok(())
}

/// Configure OAuth provider for production use
#[napi]
pub async fn configure_oauth_provider(config: NapiOAuthProviderConfig) -> Result<()> {
    let mut manager_guard = PRODUCTION_OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_mut()
        .ok_or_else(|| Error::from_reason("Production OAuth manager not initialized"))?;
    
    manager.register_provider_config(config.clone());
    tracing::info!("OAuth provider configured: {}", config.provider);
    Ok(())
}

/// Start OAuth flow with enhanced options
#[napi]
pub async fn start_oauth_flow(options: NapiOAuthFlowOptions) -> Result<NapiOAuthAuthUrl> {
    let mut manager_guard = PRODUCTION_OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_mut()
        .ok_or_else(|| Error::from_reason("Production OAuth manager not initialized"))?;
    
    let auth_url = manager.generate_authorization_url(&options).await
        .map_err(|e| Error::from_reason(format!("Failed to generate authorization URL: {}", e)))?;
    
    Ok(auth_url)
}

/// Handle OAuth callback with code exchange
#[napi]
pub async fn handle_oauth_callback_exchange(
    provider: String,
    code: String,
    state: String,
    redirect_uri: String,
) -> Result<NapiOAuthCallbackResult> {
    let manager_guard = PRODUCTION_OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production OAuth manager not initialized"))?;
    
    let tokens = manager.exchange_authorization_code(&provider, &code, &state, &redirect_uri).await
        .map_err(|e| Error::from_reason(format!("OAuth callback failed: {}", e)))?;
    
    // Get user info using the access token
    let user_info = get_user_info_from_provider(&tokens.access_token, &provider).await
        .map_err(|e| Error::from_reason(format!("Failed to get user info: {}", e)))?;
    
    Ok(NapiOAuthCallbackResult {
        tokens,
        user_info,
    })
}

/// Refresh OAuth token for any provider
#[napi]
pub async fn refresh_oauth_token_production(
    provider: String,
    refresh_token: String,
) -> Result<NapiOAuthTokens> {
    let manager_guard = PRODUCTION_OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production OAuth manager not initialized"))?;
    
    let tokens = manager.refresh_token_for_provider(&provider, &refresh_token).await
        .map_err(|e| Error::from_reason(format!("Token refresh failed: {}", e)))?;
    
    Ok(tokens)
}

/// Revoke OAuth token for any provider
#[napi]
pub async fn revoke_oauth_token_production(
    provider: String,
    access_token: String,
) -> Result<()> {
    let manager_guard = PRODUCTION_OAUTH_MANAGER.lock().await;
    let manager = manager_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production OAuth manager not initialized"))?;
    
    manager.revoke_token_for_provider(&provider, &access_token).await
        .map_err(|e| Error::from_reason(format!("Token revocation failed: {}", e)))?;
    
    tracing::info!("OAuth token revoked successfully for provider: {}", provider);
    Ok(())
}

/// Check if OAuth token needs refresh (expires within 5 minutes)
#[napi]
pub fn needs_oauth_token_refresh(expires_at: Option<i64>) -> Result<bool> {
    if let Some(expires_timestamp) = expires_at {
        if let Some(expires_dt) = chrono::DateTime::from_timestamp(expires_timestamp, 0) {
            let five_minutes_from_now = chrono::Utc::now() + chrono::Duration::minutes(5);
            return Ok(expires_dt <= five_minutes_from_now);
        }
    }
    Ok(false) // No expiration time, assume it's valid
}

/// Validate OAuth token format and basic structure
#[napi]
pub fn validate_oauth_token(token: String) -> Result<bool> {
    // Basic validation - check if token is not empty and has reasonable length
    if token.is_empty() || token.len() < 10 {
        return Ok(false);
    }
    
    // Additional validation could be added here based on provider-specific token formats
    Ok(true)
}

/// Clean up expired PKCE sessions (should be called periodically)
#[napi]
pub async fn cleanup_expired_pkce_sessions() -> Result<u32> {
    let manager_guard = PRODUCTION_OAUTH_MANAGER.lock().await;
    if let Some(manager) = manager_guard.as_ref() {
        let mut sessions = manager.active_pkce_sessions.lock().await;
        let now = chrono::Utc::now();
        let expiry_threshold = now - chrono::Duration::minutes(30); // 30 minutes expiry
        
        let initial_count = sessions.len();
        sessions.retain(|_, session| session.created_at > expiry_threshold);
        let final_count = sessions.len();
        
        let cleaned_count = initial_count - final_count;
        if cleaned_count > 0 {
            tracing::info!("Cleaned up {} expired PKCE sessions", cleaned_count);
        }
        
        Ok(cleaned_count as u32)
    } else {
        Err(Error::from_reason("Production OAuth manager not initialized"))
    }
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

/// Initialize all engines and OAuth manager
#[napi]
pub async fn init_flow_desk_engines(config_json: Option<String>) -> Result<String> {
    crate::init();
    
    // Initialize OAuth manager
    init_oauth_manager(None).await?;
    
    // Initialize other engines
    init_mail_engine().await?;
    init_calendar_engine().await?;
    init_search_engine(None).await?;
    
    tracing::info!("All Flow Desk engines initialized successfully");
    Ok("All engines initialized successfully".to_string())
}

/// Setup OAuth providers from environment variables
#[napi]
pub async fn setup_oauth_providers_from_env() -> Result<String> {
    let mut providers_configured = Vec::new();
    
    // Gmail/Google OAuth setup
    if let (Ok(client_id), Ok(client_secret)) = (
        std::env::var("GOOGLE_CLIENT_ID").or_else(|_| std::env::var("GMAIL_CLIENT_ID")),
        std::env::var("GOOGLE_CLIENT_SECRET").or_else(|_| std::env::var("GMAIL_CLIENT_SECRET"))
    ) {
        register_oauth_provider("gmail".to_string(), client_id, client_secret).await?;
        providers_configured.push("Gmail");
    }
    
    // Outlook/Microsoft OAuth setup
    if let (Ok(client_id), Ok(client_secret)) = (
        std::env::var("MICROSOFT_CLIENT_ID").or_else(|_| std::env::var("OUTLOOK_CLIENT_ID")),
        std::env::var("MICROSOFT_CLIENT_SECRET").or_else(|_| std::env::var("OUTLOOK_CLIENT_SECRET"))
    ) {
        register_oauth_provider("outlook".to_string(), client_id, client_secret).await?;
        providers_configured.push("Outlook");
    }
    
    let result = if providers_configured.is_empty() {
        "No OAuth providers configured. Please set environment variables.".to_string()
    } else {
        format!("OAuth providers configured: {}", providers_configured.join(", "))
    };
    
    tracing::info!("OAuth provider setup result: {}", result);
    Ok(result)
}

// ============================================================================
// Production Email Engine NAPI Bindings (Pure Rust Email Operations)
// ============================================================================

/// Email credentials for setting up accounts
#[napi(object)]
pub struct NapiEmailCredentials {
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

/// Account setup result
#[napi(object)]
pub struct NapiAccountSetupResult {
    pub account_id: String,
    pub success: bool,
    pub error_message: Option<String>,
}

/// Email message for sending
#[napi(object)]
pub struct NapiNewMessage {
    pub to: Vec<String>,
    pub cc: Option<Vec<String>>,
    pub bcc: Option<Vec<String>>,
    pub subject: String,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
}

/// Folder information
#[napi(object)]
pub struct NapiFolder {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub folder_type: String,
    pub message_count: i32,
    pub unread_count: i32,
}

/// Email sync result
#[napi(object)]
pub struct NapiSyncResult {
    pub account_id: String,
    pub messages_synced: u32,
    pub messages_new: u32,
    pub messages_updated: u32,
    pub folders_synced: u32,
    pub errors: Vec<String>,
    pub sync_duration_ms: u32,
}

/// Initialize production email engine
#[napi]
pub async fn init_production_email_engine(app_name: String) -> Result<String> {
    let mut engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    
    if engine_guard.is_none() {
        let engine = crate::mail::ProductionEmailEngine::new(app_name).await
            .map_err(|e| Error::from_reason(format!("Failed to initialize production email engine: {}", e)))?;
        *engine_guard = Some(engine);
    }
    
    tracing::info!("Production email engine initialized successfully");
    Ok("Production email engine initialized successfully".to_string())
}

/// Initialize production calendar engine
#[napi]
pub async fn init_production_calendar_engine(app_name: String) -> Result<String> {
    let mut engine_guard = PRODUCTION_CALENDAR_ENGINE.lock().await;
    
    if engine_guard.is_none() {
        // For now, calendar engine uses the standard CalendarEngine implementation
        // since there's no separate production calendar engine implementation
        let config = crate::calendar::CalendarConfig::default();
        let engine = crate::calendar::CalendarEngine::new(config).await
            .map_err(|e| Error::from_reason(format!("Failed to initialize production calendar engine: {}", e)))?;
        *engine_guard = Some(engine);
    }
    
    tracing::info!("Production calendar engine initialized successfully for app: {}", app_name);
    Ok("Production calendar engine initialized successfully".to_string())
}

/// Initialize production search engine
#[napi]
pub async fn init_production_search_engine(app_name: String) -> Result<String> {
    let mut engine_guard = PRODUCTION_SEARCH_ENGINE.lock().await;
    
    if engine_guard.is_none() {
        // For now, search engine uses the standard SearchEngine implementation  
        // since there's no separate production search engine implementation
        let config = crate::search::SearchConfig::default();
        let engine = crate::search::SearchEngine::new(config).await
            .map_err(|e| Error::from_reason(format!("Failed to initialize production search engine: {}", e)))?;
        *engine_guard = Some(engine);
    }
    
    tracing::info!("Production search engine initialized successfully for app: {}", app_name);
    Ok("Production search engine initialized successfully".to_string())
}

/// Setup a new email account with credentials
#[napi]
pub async fn setup_email_account(
    user_id: String,
    credentials: NapiEmailCredentials,
) -> Result<NapiAccountSetupResult> {
    let mut engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_mut()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|e| Error::from_reason(format!("Invalid user ID: {}", e)))?;
    
    let email_credentials = crate::mail::production_account_manager::EmailCredentials {
        email: credentials.email,
        password: credentials.password,
        display_name: credentials.display_name,
        provider_override: None,
    };
    
    match engine.setup_account(user_uuid, email_credentials).await {
        Ok(setup_result) => {
            Ok(NapiAccountSetupResult {
                account_id: setup_result.account_id.to_string(),
                success: true,
                error_message: None,
            })
        },
        Err(e) => {
            Ok(NapiAccountSetupResult {
                account_id: String::new(),
                success: false,
                error_message: Some(e.to_string()),
            })
        }
    }
}

/// Test IMAP/SMTP connections for an account
#[napi]
pub async fn test_account_connections(account_id: String) -> Result<bool> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    match engine.test_account_connections(account_uuid).await {
        Ok(()) => Ok(true),
        Err(e) => {
            tracing::warn!("Connection test failed for account {}: {}", account_id, e);
            Ok(false)
        }
    }
}

/// Sync emails for an account
#[napi]
pub async fn sync_email_account(account_id: String) -> Result<NapiSyncResult> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let sync_result = engine.sync_account(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Sync failed: {}", e)))?;
    
    Ok(NapiSyncResult {
        account_id: sync_result.account_id.to_string(),
        messages_synced: sync_result.messages_synced as u32,
        messages_new: sync_result.messages_new as u32,
        messages_updated: sync_result.messages_updated as u32,
        folders_synced: sync_result.folders_synced as u32,
        errors: sync_result.errors,
        sync_duration_ms: sync_result.sync_duration.as_millis() as u32,
    })
}

/// Get folders for an account
#[napi]
pub async fn get_email_folders(account_id: String) -> Result<Vec<NapiFolder>> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let folders = engine.get_folders(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to get folders: {}", e)))?;
    
    Ok(folders.into_iter().map(|folder| NapiFolder {
        id: folder.id.to_string(),
        name: folder.name,
        display_name: folder.display_name,
        folder_type: format!("{:?}", folder.folder_type),
        message_count: folder.message_count,
        unread_count: folder.unread_count,
    }).collect())
}

/// Send an email
#[napi]
pub async fn send_email_message(
    account_id: String,
    message: NapiNewMessage,
) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let new_message = crate::mail::types::NewMessage {
        to: message.to,
        cc: message.cc.unwrap_or_default(),
        bcc: message.bcc.unwrap_or_default(),
        subject: message.subject,
        body_text: message.body_text,
        body_html: message.body_html,
        attachments: Vec::new(), // Attachments support pending - requires MIME parsing implementation
    };
    
    engine.send_email(account_uuid, new_message).await
        .map_err(|e| Error::from_reason(format!("Failed to send email: {}", e)))?;
    
    tracing::info!("Email sent successfully for account: {}", account_id);
    Ok(())
}

/// Get messages from a folder
#[napi]
pub async fn get_folder_messages(
    account_id: String,
    folder_name: String,
    limit: Option<u32>,
) -> Result<Vec<NapiMailMessage>> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let messages = engine.get_messages(
        account_uuid, 
        &folder_name, 
        limit.map(|l| l as usize)
    ).await
        .map_err(|e| Error::from_reason(format!("Failed to get messages: {}", e)))?;
    
    Ok(messages.into_iter().map(|msg| (&msg).into()).collect())
}

/// Mark a message as read/unread
#[napi]
pub async fn mark_email_message_read(
    account_id: String,
    folder_name: String,
    message_uid: u32,
    is_read: bool,
) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    engine.mark_message_read(account_uuid, &folder_name, message_uid, is_read).await
        .map_err(|e| Error::from_reason(format!("Failed to mark message as read: {}", e)))?;
    
    Ok(())
}

/// Delete a message
#[napi]
pub async fn delete_email_message(
    account_id: String,
    folder_name: String,
    message_uid: u32,
) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    engine.delete_message(account_uuid, &folder_name, message_uid).await
        .map_err(|e| Error::from_reason(format!("Failed to delete message: {}", e)))?;
    
    tracing::info!("Message {} deleted from folder {}", message_uid, folder_name);
    Ok(())
}

/// Close connections for an account
#[napi]
pub async fn close_email_account_connections(account_id: String) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    engine.close_connections(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to close connections: {}", e)))?;
    
    tracing::info!("Connections closed for account: {}", account_id);
    Ok(())
}

/// Get health status for all email accounts
#[napi]
pub async fn get_email_accounts_health() -> Result<String> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let health_status = engine.health_check().await;
    let health_json = serde_json::to_string(&health_status)
        .map_err(|e| Error::from_reason(format!("Failed to serialize health status: {}", e)))?;
    
    Ok(health_json)
}

/// Auto-detect server configuration from email address
#[napi]
pub fn detect_email_server_config(email: String) -> Result<Option<String>> {
    let config = crate::mail::server_configs::get_config_by_domain(&email);
    
    if let Some(server_config) = config {
        let config_json = serde_json::to_string(&server_config)
            .map_err(|e| Error::from_reason(format!("Failed to serialize server config: {}", e)))?;
        Ok(Some(config_json))
    } else {
        Ok(None)
    }
}

/// Get all predefined server configurations
#[napi]
pub fn get_predefined_server_configs() -> Result<String> {
    let configs = crate::mail::server_configs::get_predefined_configs();
    let configs_json = serde_json::to_string(&configs)
        .map_err(|e| Error::from_reason(format!("Failed to serialize server configs: {}", e)))?;
    
    Ok(configs_json)
}

/// Get all production email accounts
#[napi]
pub async fn get_production_email_accounts() -> Result<Vec<String>> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let accounts = engine.account_manager().get_all_accounts().await
        .map_err(|e| Error::from_reason(format!("Failed to get accounts: {}", e)))?;
    
    let account_ids: Vec<String> = accounts.into_iter()
        .map(|account| account.id.to_string())
        .collect();
    
    Ok(account_ids)
}

/// Get production email account by ID
#[napi]
pub async fn get_production_email_account(account_id: String) -> Result<Option<String>> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let account = engine.account_manager().get_account_by_id(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to get account: {}", e)))?;
    
    if let Some(account) = account {
        let account_json = serde_json::to_string(&account)
            .map_err(|e| Error::from_reason(format!("Failed to serialize account: {}", e)))?;
        Ok(Some(account_json))
    } else {
        Ok(None)
    }
}

/// Connect to IMAP server for an account
#[napi]
pub async fn connect_imap_account(account_id: String) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    engine.connect_imap(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to connect IMAP: {}", e)))?;
    
    tracing::info!("IMAP connected for account: {}", account_id);
    Ok(())
}

/// Connect to SMTP server for an account
#[napi]
pub async fn connect_smtp_account(account_id: String) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    engine.connect_smtp(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to connect SMTP: {}", e)))?;
    
    tracing::info!("SMTP connected for account: {}", account_id);
    Ok(())
}

/// Remove an email account from the production engine
#[napi]
pub async fn remove_production_email_account(account_id: String) -> Result<()> {
    let mut engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_mut()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    engine.account_manager_mut().remove_account(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to remove account: {}", e)))?;
    
    tracing::info!("Account removed: {}", account_id);
    Ok(())
}

/// Search emails across all accounts
#[napi]
pub async fn search_production_emails(query: String, limit: Option<u32>) -> Result<Vec<NapiMailMessage>> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    // Get all accounts and search through them
    let accounts = engine.account_manager().get_all_accounts().await
        .map_err(|e| Error::from_reason(format!("Failed to get accounts: {}", e)))?;
    
    let mut all_messages = Vec::new();
    let limit_per_account = limit.map(|l| l as usize / accounts.len().max(1)).unwrap_or(100);
    
    for account in accounts {
        match engine.get_messages(account.id, "INBOX", Some(limit_per_account)).await {
            Ok(messages) => {
                // Simple text search on messages
                let filtered: Vec<_> = messages.into_iter()
                    .filter(|msg| {
                        msg.subject.contains(&query) || 
                        msg.body_text.as_ref().map_or(false, |body| body.contains(&query)) ||
                        msg.body_html.as_ref().map_or(false, |body| body.contains(&query))
                    })
                    .map(|msg| (&msg).into())
                    .collect();
                all_messages.extend(filtered);
            },
            Err(e) => {
                tracing::warn!("Failed to search messages for account {}: {}", account.id, e);
                continue;
            }
        }
    }
    
    // Sort by received date and limit results
    all_messages.sort_by(|a, b| b.received_at.cmp(&a.received_at));
    if let Some(limit) = limit {
        all_messages.truncate(limit as usize);
    }
    
    Ok(all_messages)
}

/// Move email message to different folder
#[napi]
pub async fn move_email_message(
    account_id: String,
    from_folder: String,
    to_folder: String,
    message_uid: u32,
) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    // Move functionality would need to be implemented at the IMAP provider level
    // This is a complex operation that requires IMAP MOVE or COPY+EXPUNGE commands
    Err(Error::from_reason("Move message functionality requires IMAP provider implementation - use copy to target folder and delete from source as workaround"))
}

/// Get email account statistics
#[napi]
pub async fn get_email_account_stats(account_id: String) -> Result<String> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let account_uuid = uuid::Uuid::parse_str(&account_id)
        .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;
    
    let folders = engine.get_folders(account_uuid).await
        .map_err(|e| Error::from_reason(format!("Failed to get folders: {}", e)))?;
    
    let total_messages: u32 = folders.iter().map(|f| f.message_count).sum();
    let total_unread: u32 = folders.iter().map(|f| f.unread_count).sum();
    
    let stats = serde_json::json!({
        "account_id": account_id,
        "total_folders": folders.len(),
        "total_messages": total_messages,
        "total_unread": total_unread,
        "folders": folders.iter().map(|f| serde_json::json!({
            "name": f.name,
            "messages": f.message_count,
            "unread": f.unread_count
        })).collect::<Vec<_>>()
    });
    
    let stats_json = serde_json::to_string(&stats)
        .map_err(|e| Error::from_reason(format!("Failed to serialize stats: {}", e)))?;
    
    Ok(stats_json)
}

// ============================================================================
// Database NAPI Bindings - Pure Rust Database Operations
// ============================================================================

use crate::database::{FlowDeskDatabase, DatabaseConfig, DatabaseInitProgress, DatabaseHealth, MigrationStatus};

/// Shared database instance
static FLOW_DESK_DATABASE: once_cell::sync::Lazy<Arc<Mutex<Option<FlowDeskDatabase>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Database configuration for NAPI
#[napi(object)]
pub struct NapiDatabaseConfig {
    pub mail_db_path: String,
    pub calendar_db_path: String,
    pub search_index_path: String,
    pub user_data_path: String,
    pub schema_version: u32,
}

impl From<NapiDatabaseConfig> for DatabaseConfig {
    fn from(config: NapiDatabaseConfig) -> Self {
        Self {
            mail_db_path: config.mail_db_path,
            calendar_db_path: config.calendar_db_path,
            search_index_path: config.search_index_path,
            user_data_path: config.user_data_path,
            schema_version: config.schema_version,
        }
    }
}

/// Database initialization progress for NAPI
#[napi(object)]
pub struct NapiDatabaseInitProgress {
    pub stage: String,
    pub progress: u32,
    pub message: String,
    pub details: Option<String>,
}

impl From<DatabaseInitProgress> for NapiDatabaseInitProgress {
    fn from(progress: DatabaseInitProgress) -> Self {
        Self {
            stage: progress.stage,
            progress: progress.progress,
            message: progress.message,
            details: progress.details,
        }
    }
}

/// Database health status for NAPI
#[napi(object)]
pub struct NapiDatabaseHealth {
    pub healthy: bool,
    pub issues: Vec<String>,
    pub recommendations: Vec<String>,
}

impl From<DatabaseHealth> for NapiDatabaseHealth {
    fn from(health: DatabaseHealth) -> Self {
        Self {
            healthy: health.healthy,
            issues: health.issues,
            recommendations: health.recommendations,
        }
    }
}

/// Migration status for NAPI
#[napi(object)]
pub struct NapiMigrationStatus {
    pub id: String,
    pub applied: bool,
    pub applied_at: Option<i64>,
    pub error: Option<String>,
}

impl From<MigrationStatus> for NapiMigrationStatus {
    fn from(status: MigrationStatus) -> Self {
        Self {
            id: status.id,
            applied: status.applied,
            applied_at: status.applied_at.map(|dt| dt.timestamp()),
            error: status.error,
        }
    }
}

/// Initialize Flow Desk database with configuration
#[napi]
pub async fn init_flow_desk_database(config: NapiDatabaseConfig) -> Result<String> {
    let mut db_guard = FLOW_DESK_DATABASE.lock().await;
    
    let database = FlowDeskDatabase::new(config.into()).await
        .map_err(|e| Error::from_reason(format!("Failed to initialize database: {}", e)))?;
    
    *db_guard = Some(database);
    
    tracing::info!("Flow Desk database initialized successfully");
    Ok("Flow Desk database initialized successfully".to_string())
}

/// Initialize all databases with progress tracking
#[napi]
pub async fn initialize_all_databases() -> Result<Vec<NapiDatabaseInitProgress>> {
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let progress = database.initialize_databases().await
        .map_err(|e| Error::from_reason(format!("Database initialization failed: {}", e)))?;
    
    Ok(progress.into_iter().map(|p| p.into()).collect())
}

/// Check database health
#[napi]
pub async fn check_database_health() -> Result<Vec<NapiDatabaseHealth>> {
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let health_reports = database.validate_all_databases().await
        .map_err(|e| Error::from_reason(format!("Database health check failed: {}", e)))?;
    
    Ok(health_reports.into_iter().map(|h| h.into()).collect())
}

/// Repair corrupted databases
#[napi]
pub async fn repair_databases() -> Result<Vec<NapiDatabaseHealth>> {
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let repair_results = database.repair_databases().await
        .map_err(|e| Error::from_reason(format!("Database repair failed: {}", e)))?;
    
    Ok(repair_results.into_iter().map(|h| h.into()).collect())
}

/// Backup all databases
#[napi]
pub async fn backup_databases(backup_dir: String) -> Result<Vec<String>> {
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let backup_files = database.backup_databases(&backup_dir).await
        .map_err(|e| Error::from_reason(format!("Database backup failed: {}", e)))?;
    
    Ok(backup_files)
}

/// Run database migrations for a specific database
#[napi]
pub async fn run_database_migrations(database_type: String) -> Result<Vec<NapiMigrationStatus>> {
    use crate::database::migrations::MigrationManager;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let mut migration_manager = MigrationManager::new();
    migration_manager.connect(&database.config.mail_db_path, &database.config.calendar_db_path).await
        .map_err(|e| Error::from_reason(format!("Failed to connect migration manager: {}", e)))?;
    
    let statuses = migration_manager.apply_migrations(&database_type).await
        .map_err(|e| Error::from_reason(format!("Migration failed: {}", e)))?;
    
    Ok(statuses.into_iter().map(|s| s.into()).collect())
}

/// Get migration status for a database
#[napi]
pub async fn get_migration_status(database_type: String) -> Result<Vec<NapiMigrationStatus>> {
    use crate::database::migrations::MigrationManager;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let mut migration_manager = MigrationManager::new();
    migration_manager.connect(&database.config.mail_db_path, &database.config.calendar_db_path).await
        .map_err(|e| Error::from_reason(format!("Failed to connect migration manager: {}", e)))?;
    
    let statuses = migration_manager.get_migration_status(&database_type).await
        .map_err(|e| Error::from_reason(format!("Failed to get migration status: {}", e)))?;
    
    Ok(statuses.into_iter().map(|s| s.into()).collect())
}

/// Execute raw SQL query (for debugging/maintenance only)
#[napi]
pub async fn execute_raw_sql(database_type: String, sql: String) -> Result<String> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let db_path = match database_type.as_str() {
        "mail" => &database.config.mail_db_path,
        "calendar" => &database.config.calendar_db_path,
        _ => return Err(Error::from_reason(format!("Unknown database type: {}", database_type))),
    };
    
    let database_url = format!("sqlite:{}", db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    // For safety, only allow SELECT statements
    if !sql.trim().to_uppercase().starts_with("SELECT") {
        return Err(Error::from_reason("Only SELECT statements are allowed for security"));
    }
    
    let rows = sqlx::query(&sql).fetch_all(&pool).await
        .map_err(|e| Error::from_reason(format!("SQL execution failed: {}", e)))?;
    
    let result = serde_json::to_string(&rows)
        .map_err(|e| Error::from_reason(format!("Failed to serialize results: {}", e)))?;
    
    pool.close().await;
    Ok(result)
}

/// Get database schema information
#[napi]
pub async fn get_database_schema(database_type: String) -> Result<String> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let db_path = match database_type.as_str() {
        "mail" => &database.config.mail_db_path,
        "calendar" => &database.config.calendar_db_path,
        _ => return Err(Error::from_reason(format!("Unknown database type: {}", database_type))),
    };
    
    let database_url = format!("sqlite:{}", db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    let tables = sqlx::query("SELECT name, sql FROM sqlite_master WHERE type = 'table'")
        .fetch_all(&pool).await
        .map_err(|e| Error::from_reason(format!("Failed to get schema: {}", e)))?;
    
    let schema_info: Vec<serde_json::Value> = tables.iter().map(|row| {
        serde_json::json!({
            "name": row.get::<String, _>("name"),
            "sql": row.get::<String, _>("sql")
        })
    }).collect();
    
    let result = serde_json::to_string(&schema_info)
        .map_err(|e| Error::from_reason(format!("Failed to serialize schema: {}", e)))?;
    
    pool.close().await;
    Ok(result)
}

/// Get database statistics
#[napi]
pub async fn get_database_stats(database_type: String) -> Result<String> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let db_path = match database_type.as_str() {
        "mail" => &database.config.mail_db_path,
        "calendar" => &database.config.calendar_db_path,
        _ => return Err(Error::from_reason(format!("Unknown database type: {}", database_type))),
    };
    
    let database_url = format!("sqlite:{}", db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    // Get file size
    let file_size = tokio::fs::metadata(db_path).await
        .map(|m| m.len())
        .unwrap_or(0);
    
    // Get table counts
    let table_stats = match database_type.as_str() {
        "mail" => {
            let accounts_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM accounts").fetch_one(&pool).await.unwrap_or(0);
            let messages_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM messages").fetch_one(&pool).await.unwrap_or(0);
            let folders_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM folders").fetch_one(&pool).await.unwrap_or(0);
            let threads_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM threads").fetch_one(&pool).await.unwrap_or(0);
            
            serde_json::json!({
                "accounts": accounts_count,
                "messages": messages_count,
                "folders": folders_count,
                "threads": threads_count
            })
        },
        "calendar" => {
            let accounts_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM calendar_accounts").fetch_one(&pool).await.unwrap_or(0);
            let calendars_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM calendars").fetch_one(&pool).await.unwrap_or(0);
            let events_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM calendar_events").fetch_one(&pool).await.unwrap_or(0);
            
            serde_json::json!({
                "accounts": accounts_count,
                "calendars": calendars_count,
                "events": events_count
            })
        },
        _ => serde_json::json!({}),
    };
    
    let stats = serde_json::json!({
        "database_type": database_type,
        "file_size_bytes": file_size,
        "file_size_mb": file_size as f64 / 1024.0 / 1024.0,
        "table_counts": table_stats
    });
    
    let result = serde_json::to_string(&stats)
        .map_err(|e| Error::from_reason(format!("Failed to serialize stats: {}", e)))?;
    
    pool.close().await;
    Ok(result)
}

// ============================================================================
// Email Database Operations - Production Ready
// ============================================================================

/// Save email message to database
#[napi]
pub async fn save_email_message(message: serde_json::Value) -> Result<String> {
    use sqlx::SqlitePool;
    
    let mut db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_mut()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let mail_db = database.get_mail_db().await
        .map_err(|e| Error::from_reason(format!("Failed to get mail database: {}", e)))?;
    
    // Generate unique ID for the message
    let message_id = Uuid::new_v4().to_string();
    
    // Extract message data from JSON and save to database
    let subject = message.get("subject")
        .and_then(|v| v.as_str())
        .unwrap_or("No Subject")
        .to_string();
    let from_address = message.get("from")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let body = message.get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let account_id = message.get("account_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    // Insert message into database (this would need proper schema implementation)
    let database_url = format!("sqlite:{}", database.config.mail_db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    sqlx::query(
        "INSERT INTO messages (id, account_id, subject, from_address, body_text, received_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .bind(&message_id)
    .bind(&account_id)
    .bind(&subject)
    .bind(&from_address)
    .bind(&body)
    .execute(&pool).await
    .map_err(|e| Error::from_reason(format!("Failed to save message: {}", e)))?;
    
    pool.close().await;
    
    Ok(message_id)
}

/// Get email messages from database
#[napi(object)]
pub struct EmailQueryParams {
    pub account_id: String,
    pub folder: String,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[napi]
pub async fn get_email_messages(params: EmailQueryParams) -> Result<Vec<NapiMailMessage>> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let database_url = format!("sqlite:{}", database.config.mail_db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    let limit = params.limit.unwrap_or(100) as i64;
    let offset = params.offset.unwrap_or(0) as i64;
    
    let rows = sqlx::query(
        "SELECT * FROM messages WHERE account_id = ? AND folder = ? ORDER BY received_at DESC LIMIT ? OFFSET ?"
    )
    .bind(&params.account_id)
    .bind(&params.folder)
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool).await
    .map_err(|e| Error::from_reason(format!("Failed to fetch messages: {}", e)))?;
    
    let messages: Vec<NapiMailMessage> = rows.iter().map(|row| {
        NapiMailMessage {
            id: row.get("id"),
            account_id: row.get("account_id"),
            folder: row.get("folder"),
            subject: row.get("subject"),
            from_address: row.get("from_address"),
            from_name: row.get("from_name"),
            to_addresses: serde_json::from_str(row.get("to_addresses")).unwrap_or_default(),
            cc_addresses: serde_json::from_str(row.get("cc_addresses")).unwrap_or_default(),
            bcc_addresses: serde_json::from_str(row.get("bcc_addresses")).unwrap_or_default(),
            body_text: row.get("body_text"),
            body_html: row.get("body_html"),
            is_read: row.get("is_read"),
            is_starred: row.get("is_starred"),
            received_at: row.get::<DateTime<Utc>, _>("received_at").timestamp(),
        }
    }).collect();
    
    pool.close().await;
    Ok(messages)
}

/// Update email read status
#[napi(object)]
pub struct UpdateEmailStatusParams {
    pub message_id: String,
    pub is_read: bool,
}

#[napi]
pub async fn update_email_read_status(params: UpdateEmailStatusParams) -> Result<()> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let database_url = format!("sqlite:{}", database.config.mail_db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    sqlx::query("UPDATE messages SET is_read = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(params.is_read)
        .bind(&params.message_id)
        .execute(&pool).await
        .map_err(|e| Error::from_reason(format!("Failed to update message: {}", e)))?;
    
    pool.close().await;
    Ok(())
}

// ============================================================================
// Calendar Database Operations - Production Ready
// ============================================================================

/// Save calendar event to database
#[napi]
pub async fn save_calendar_event(event: serde_json::Value) -> Result<String> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let database_url = format!("sqlite:{}", database.config.calendar_db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    // Generate unique ID for the event
    let event_id = Uuid::new_v4().to_string();
    
    // Extract event data from JSON and save to database
    let title = event.get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("No Title")
        .to_string();
    let description = event.get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let location = event.get("location")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let calendar_id = event.get("calendar_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let start_time = event.get("start_time")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let end_time = event.get("end_time")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    // Insert event into database (this would need proper schema implementation)
    sqlx::query(
        "INSERT INTO calendar_events (id, calendar_id, title, description, location, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .bind(&event_id)
    .bind(&calendar_id)
    .bind(&title)
    .bind(&description)
    .bind(&location)
    .bind(&start_time)
    .bind(&end_time)
    .execute(&pool).await
    .map_err(|e| Error::from_reason(format!("Failed to save event: {}", e)))?;
    
    pool.close().await;
    Ok(event_id)
}

/// Get calendar events from database
#[napi(object)]
pub struct CalendarQueryParams {
    pub calendar_id: String,
    pub start_time: String,
    pub end_time: String,
}

#[napi]
pub async fn get_calendar_events_by_query(params: CalendarQueryParams) -> Result<Vec<NapiCalendarEvent>> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let database_url = format!("sqlite:{}", database.config.calendar_db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    let rows = sqlx::query(
        "SELECT * FROM calendar_events WHERE calendar_id = ? AND start_time >= ? AND end_time <= ? ORDER BY start_time"
    )
    .bind(&params.calendar_id)
    .bind(&params.start_time)
    .bind(&params.end_time)
    .fetch_all(&pool).await
    .map_err(|e| Error::from_reason(format!("Failed to fetch events: {}", e)))?;
    
    let events: Vec<NapiCalendarEvent> = rows.iter().map(|row| {
        NapiCalendarEvent {
            id: row.get("id"),
            calendar_id: row.get("calendar_id"),
            title: row.get("title"),
            description: row.get("description"),
            location: row.get("location"),
            start_time: row.get::<DateTime<Utc>, _>("start_time").timestamp(),
            end_time: row.get::<DateTime<Utc>, _>("end_time").timestamp(),
            is_all_day: row.get("is_all_day"),
            organizer: row.get::<String, _>("organizer").unwrap_or_default(),
            attendees: serde_json::from_str(row.get("attendees")).unwrap_or_default(),
            status: row.get("status"),
            visibility: row.get::<String, _>("visibility").unwrap_or_default(),
            recurrence_rule: row.get("recurrence_rule"),
        }
    }).collect();
    
    pool.close().await;
    Ok(events)
}

/// Update calendar event in database
#[napi]
pub async fn update_calendar_event(event: serde_json::Value) -> Result<()> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let database_url = format!("sqlite:{}", database.config.calendar_db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    // Extract updated event data from JSON and update in database
    let event_id = event.get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| Error::from_reason("Event ID is required for update"))?;
    
    let title = event.get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("No Title");
    let description = event.get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let location = event.get("location")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    // Update event in database
    sqlx::query(
        "UPDATE calendar_events SET title = ?, description = ?, location = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(title)
    .bind(description)
    .bind(location)
    .bind(event_id)
    .execute(&pool).await
    .map_err(|e| Error::from_reason(format!("Failed to update event: {}", e)))?;
    
    pool.close().await;
    Ok(())
}

/// Delete calendar event from database
#[napi]
pub async fn delete_calendar_event(event_id: String) -> Result<()> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let database_url = format!("sqlite:{}", database.config.calendar_db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    sqlx::query("DELETE FROM calendar_events WHERE id = ?")
        .bind(&event_id)
        .execute(&pool).await
        .map_err(|e| Error::from_reason(format!("Failed to delete event: {}", e)))?;
    
    pool.close().await;
    Ok(())
}

/// Execute database query (for migrations and advanced operations)
#[napi(object)]
pub struct DatabaseQueryParams {
    pub database: String,
    pub query: String,
    pub params: Vec<serde_json::Value>,
}

#[napi]
pub async fn execute_database_query(params: DatabaseQueryParams) -> Result<serde_json::Value> {
    use sqlx::SqlitePool;
    
    let db_guard = FLOW_DESK_DATABASE.lock().await;
    let database = db_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Database not initialized. Call init_flow_desk_database first"))?;
    
    let db_path = match params.database.as_str() {
        "mail" => &database.config.mail_db_path,
        "calendar" => &database.config.calendar_db_path,
        _ => return Err(Error::from_reason(format!("Unknown database: {}", params.database))),
    };
    
    let database_url = format!("sqlite:{}", db_path);
    let pool = SqlitePool::connect(&database_url).await
        .map_err(|e| Error::from_reason(format!("Failed to connect to database: {}", e)))?;
    
    // Execute the query based on the type (SELECT, INSERT, UPDATE, DELETE)
    let query_upper = params.query.trim().to_uppercase();
    let result = if query_upper.starts_with("SELECT") {
        let rows = sqlx::query(&params.query).fetch_all(&pool).await
            .map_err(|e| Error::from_reason(format!("Query execution failed: {}", e)))?;
        serde_json::json!({ "rows": rows.len(), "type": "select" })
    } else {
        let result = sqlx::query(&params.query).execute(&pool).await
            .map_err(|e| Error::from_reason(format!("Query execution failed: {}", e)))?;
        serde_json::json!({ 
            "rows_affected": result.rows_affected(),
            "type": if query_upper.starts_with("INSERT") { "insert" } 
                  else if query_upper.starts_with("UPDATE") { "update" }
                  else if query_upper.starts_with("DELETE") { "delete" }
                  else { "other" }
        })
    };
    
    pool.close().await;
    Ok(result)
}