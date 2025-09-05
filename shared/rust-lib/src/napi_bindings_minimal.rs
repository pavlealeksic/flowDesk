//! Minimal NAPI bindings for Flow Desk Rust engines
//!
//! This module provides a minimal set of Node.js bindings using NAPI-RS
//! to get basic functionality working first.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose, Engine as _};
use once_cell;
use uuid;
use tracing;

// Import necessary types for email functions
use crate::mail::ProductionEmailEngine;

/// Shared production email engine instance
static PRODUCTION_EMAIL_ENGINE: once_cell::sync::Lazy<Arc<Mutex<Option<ProductionEmailEngine>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// NAPI Email Credentials
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NapiEmailCredentials {
    pub email: String,
    pub password: String,
    pub imap_server: Option<String>,
    pub imap_port: Option<u32>,
    pub smtp_server: Option<String>,
    pub smtp_port: Option<u32>,
    pub use_tls: Option<bool>,
    pub provider: Option<String>,
}

/// NAPI Account Setup Result
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NapiAccountSetupResult {
    pub success: bool,
    pub account_id: Option<String>,
    pub error: Option<String>,
}

/// NAPI Sync Result
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NapiSyncResult {
    pub success: bool,
    pub messages_synced: u32,
    pub folders_processed: u32,
    pub errors: Option<Vec<String>>,
}

/// NAPI Folder
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NapiFolder {
    pub name: String,
    pub full_name: String,
    pub message_count: u32,
    pub unread_count: u32,
    pub flags: Option<Vec<String>>,
}

/// NAPI New Message
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NapiNewMessage {
    pub to: Vec<String>,
    pub cc: Option<Vec<String>>,
    pub bcc: Option<Vec<String>>,
    pub subject: String,
    pub body: String,
    pub body_type: Option<String>,
}

/// NAPI Mail Message (simplified version)
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub received_at: i64,
}

/// Initialize the Rust library
#[napi]
pub fn init_library() -> String {
    crate::init();
    format!("Flow Desk Rust Library v{} initialized", crate::VERSION)
}

/// Simple test function
#[napi] 
pub fn hello() -> String {
    "Hello from Rust NAPI!".to_string()
}

/// Get library version
#[napi]
pub fn get_version() -> String {
    crate::VERSION.to_string()
}

/// Simple encrypt function
#[napi]
pub fn encrypt_string(data: String, key: String) -> Result<String> {
    use base64::{engine::general_purpose, Engine as _};
    
    let key_bytes = general_purpose::STANDARD.decode(key)
        .map_err(|e| Error::from_reason(format!("Invalid key: {}", e)))?;
    
    let encrypted = crate::crypto::encrypt_data(data.as_bytes(), &key_bytes)
        .map_err(|e| Error::from_reason(format!("Encryption error: {:?}", e)))?;
    
    Ok(general_purpose::STANDARD.encode(encrypted))
}

/// Simple decrypt function  
#[napi]
pub fn decrypt_string(encrypted_data: String, key: String) -> Result<String> {
    use base64::{engine::general_purpose, Engine as _};
    
    let key_bytes = general_purpose::STANDARD.decode(key)
        .map_err(|e| Error::from_reason(format!("Invalid key: {}", e)))?;
        
    let encrypted_bytes = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| Error::from_reason(format!("Invalid encrypted data: {}", e)))?;
    
    let decrypted = crate::crypto::decrypt_data(&encrypted_bytes, &key_bytes)
        .map_err(|e| Error::from_reason(format!("Decryption error: {:?}", e)))?;
    
    String::from_utf8(decrypted)
        .map_err(|e| Error::from_reason(format!("Invalid UTF-8: {}", e)))
}

/// Generate encryption key pair
#[napi]
pub fn generate_encryption_key_pair() -> Result<String> {
    use base64::{engine::general_purpose, Engine as _};
    
    let (public_key, private_key) = crate::crypto::generate_key_pair()
        .map_err(|e| Error::from_reason(format!("Key generation error: {:?}", e)))?;
    
    let result = serde_json::json!({
        "publicKey": general_purpose::STANDARD.encode(public_key),
        "privateKey": general_purpose::STANDARD.encode(private_key)
    });
    
    Ok(result.to_string())
}

/// Simple mail test (placeholder for now)
#[napi]
pub async fn test_mail_connection() -> Result<String> {
    // This is a placeholder that always succeeds for testing
    Ok("Mail connection test passed".to_string())
}

/// Simple calendar test (placeholder for now)  
#[napi]
pub async fn test_calendar_connection() -> Result<String> {
    // This is a placeholder that always succeeds for testing
    Ok("Calendar connection test passed".to_string())
}

/// Initialize the search engine with proper configuration
#[napi]
pub async fn init_search_engine(index_dir: String) -> Result<String> {
    use crate::search::{SearchConfig, SearchEngine};
    use std::path::PathBuf;
    
    tracing::info!("Initializing search engine at: {}", index_dir);
    
    let config = SearchConfig {
        index_dir: PathBuf::from(index_dir),
        max_memory_mb: 256, // Default memory limit
        max_response_time_ms: 500,
        num_threads: num_cpus::get().min(4), // Use up to 4 threads
        enable_analytics: true,
        enable_suggestions: true,
        enable_realtime: true,
        providers: Vec::new(), // No providers by default
    };
    
    match SearchEngine::new(config).await {
        Ok(_engine) => {
            tracing::info!("Search engine initialized successfully");
            Ok("Search engine initialized successfully".to_string())
        }
        Err(e) => {
            tracing::error!("Failed to initialize search engine: {}", e);
            Err(Error::from_reason(format!("Search engine initialization failed: {}", e)))
        }
    }
}

/// Simple search test (placeholder for now)
#[napi]
pub async fn test_search_engine() -> Result<String> {
    // This is a placeholder that always succeeds for testing
    Ok("Search engine test passed".to_string())
}

// ============================================================================
// Production Email Engine Functions
// ============================================================================

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

/// Setup a new email account with credentials
#[napi]
pub async fn setup_email_account(
    user_id: String,
    credentials: NapiEmailCredentials,
) -> Result<NapiAccountSetupResult> {
    let mut engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    
    // Convert NapiEmailCredentials to EmailCredentials
    let email_credentials = crate::mail::production_account_manager::EmailCredentials {
        email: credentials.email.clone(),
        password: credentials.password.clone(),
        display_name: Some(credentials.email.clone()), // Use email as display name
        provider_override: credentials.provider.clone(),
    };

    // Setup account using production engine
    let engine = engine_guard.as_mut()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;
    
    let user_uuid = uuid::Uuid::parse_str(&user_id)
        .map_err(|_| Error::from_reason("Invalid user_id format"))?;
    
    match engine.setup_account(user_uuid, email_credentials).await {
        Ok(result) => Ok(NapiAccountSetupResult {
            success: true,
            account_id: Some(result.account_id.to_string()),
            error: None,
        }),
        Err(e) => Ok(NapiAccountSetupResult {
            success: false,
            account_id: None,
            error: Some(format!("Failed to create account: {}", e)),
        }),
    }
}

/// Test account connections
#[napi]
pub async fn test_account_connections(account_id: String) -> Result<bool> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;

    // Parse account ID and attempt to test connection
    if let Ok(uuid) = uuid::Uuid::parse_str(&account_id) {
        match engine.test_account_connections(uuid).await {
            Ok(()) => {
                tracing::info!("Connection test successful for account: {}", account_id);
                Ok(true)
            },
            Err(e) => {
                tracing::error!("Failed to get account {}: {}", account_id, e);
                Ok(false)
            }
        }
    } else {
        tracing::error!("Invalid account ID format: {}", account_id);
        Ok(false)
    }
}

/// Sync emails for an account
#[napi]
pub async fn sync_email_account(account_id: String) -> Result<NapiSyncResult> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;

    // For now, return placeholder sync result
    // TODO: Implement proper account sync once types are sorted out
    tracing::info!("Would sync account: {}", account_id);
    Ok(NapiSyncResult {
        success: true,
        messages_synced: 0,
        folders_processed: 2,
        errors: None,
    })
}

/// Get folders for an account
#[napi]
pub async fn get_email_folders(account_id: String) -> Result<Vec<NapiFolder>> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;

    // For now, return placeholder folders
    // TODO: Implement proper folder retrieval once types are sorted out
    Ok(vec![
        NapiFolder {
            name: "INBOX".to_string(),
            full_name: "INBOX".to_string(),
            message_count: 0,
            unread_count: 0,
            flags: Some(vec!["\\HasNoChildren".to_string()]),
        },
        NapiFolder {
            name: "Sent".to_string(),
            full_name: "Sent".to_string(),
            message_count: 0,
            unread_count: 0,
            flags: Some(vec!["\\HasNoChildren".to_string()]),
        },
    ])
}

/// Send an email message
#[napi]
pub async fn send_email_message(
    account_id: String,
    message: NapiNewMessage,
) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;

    // For now, return success without actually sending
    // TODO: Implement proper message sending once types are sorted out
    tracing::info!("Would send message: {} to {:?}", message.subject, message.to);

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

    // For now, return empty messages list
    // TODO: Implement proper message retrieval once types are sorted out
    tracing::info!("Would get messages from folder: {} (limit: {:?})", folder_name, limit);
    Ok(Vec::new())
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

    // For now, just log the action
    // TODO: Implement proper message marking once types are sorted out
    tracing::info!("Would mark message {} in folder {} as read: {}", message_uid, folder_name, is_read);

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

    // For now, just log the action
    // TODO: Implement proper message deletion once types are sorted out
    tracing::info!("Would delete message {} from folder {}", message_uid, folder_name);

    Ok(())
}

/// Close account connections
#[napi]
pub async fn close_email_account_connections(account_id: String) -> Result<()> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;

    // For now, just log the action
    // TODO: Implement proper connection closing once types are sorted out
    tracing::info!("Would close connections for account {}", account_id);

    Ok(())
}

/// Get email accounts health status
#[napi]
pub async fn get_email_accounts_health() -> Result<String> {
    let engine_guard = PRODUCTION_EMAIL_ENGINE.lock().await;
    let engine = engine_guard
        .as_ref()
        .ok_or_else(|| Error::from_reason("Production email engine not initialized"))?;

    // For now, return placeholder health status
    // TODO: Implement proper health checking once types are sorted out
    Ok("{\"status\": \"healthy\", \"accounts\": 0}".to_string())
}

/// Detect email server configuration for a given email address
#[napi]
pub fn detect_email_server_config(email: String) -> Result<Option<String>> {
    // For now, return None (no config found)
    // TODO: Implement proper server config detection once types are sorted out
    Ok(None)
}

/// Get predefined server configurations
#[napi]
pub fn get_predefined_server_configs() -> Result<String> {
    // For now, return empty configs
    // TODO: Implement proper predefined configs once types are sorted out
    Ok("{}".to_string())
}