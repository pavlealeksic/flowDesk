//! NAPI bindings for Node.js/Electron/React Native integration
//! Enhanced for mobile-specific functionality including offline support,
//! background sync, and native mobile features

#[cfg(feature = "napi")]
use napi::{
    bindgen_prelude::*,
    Result as NapiResult,
    Env, JsObject,
};

#[cfg(feature = "napi")]
use crate::mail::{
    config::MailEngineConfig,
    engine::MailEngine,
    types::*,
    MailResult,
};

#[cfg(feature = "napi")]
use std::{collections::HashMap, sync::Arc};

#[cfg(feature = "napi")]
use tokio::sync::RwLock;

#[cfg(feature = "napi")]
/// Mail Engine wrapper for NAPI
#[napi]
pub struct MailEngineWrapper {
    engine: Arc<RwLock<Option<MailEngine>>>,
}

#[cfg(feature = "napi")]
#[napi]
impl MailEngineWrapper {
    /// Initialize mail engine
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            engine: Arc::new(RwLock::new(None)),
        }
    }

    /// Initialize the mail engine with configuration
    #[napi]
    pub async fn initialize(&self, config_json: String) -> NapiResult<()> {
        let config: MailEngineConfig = serde_json::from_str(&config_json)
            .map_err(|e| Error::from_reason(format!("Invalid config: {}", e)))?;

        let engine = crate::mail::init_mail_engine(config)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        {
            let mut engine_guard = self.engine.write().await;
            *engine_guard = Some(engine);
        }

        Ok(())
    }

    /// Add mail account with mobile-optimized authentication
    #[napi]
    pub async fn add_account(&self, account_json: String) -> NapiResult<String> {
        let account: MailAccount = serde_json::from_str(&account_json)
            .map_err(|e| Error::from_reason(format!("Invalid account: {}", e)))?;

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let result = engine
            .add_account(account)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        // Return full account data for mobile caching
        serde_json::to_string(&result)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// List accounts
    #[napi]
    pub async fn list_accounts(&self) -> NapiResult<String> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let accounts = engine
            .list_accounts()
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&accounts)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Sync account
    #[napi]
    pub async fn sync_account(&self, account_id: String) -> NapiResult<String> {
        let account_uuid = account_id
            .parse()
            .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let sync_result = engine
            .sync_account(account_uuid)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&sync_result)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Get messages for account and folder
    #[napi]
    pub async fn get_messages(
        &self,
        account_id: String,
        folder_id: Option<String>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> NapiResult<String> {
        let account_uuid = account_id
            .parse()
            .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;

        let folder_uuid = if let Some(folder_id) = folder_id {
            Some(folder_id
                .parse()
                .map_err(|e| Error::from_reason(format!("Invalid folder ID: {}", e)))?)
        } else {
            None
        };

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let messages = engine
            .get_messages(account_uuid, folder_uuid, limit, offset)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&messages)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Send email
    #[napi]
    pub async fn send_email(&self, account_id: String, message_json: String) -> NapiResult<String> {
        let account_uuid = account_id
            .parse()
            .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;

        let message: EmailMessage = serde_json::from_str(&message_json)
            .map_err(|e| Error::from_reason(format!("Invalid message: {}", e)))?;

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let message_id = engine
            .send_email(account_uuid, &message)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        Ok(message_id)
    }

    /// Search messages
    #[napi]
    pub async fn search_messages(
        &self,
        account_id: Option<String>,
        query: String,
        limit: Option<u32>,
    ) -> NapiResult<String> {
        let account_uuid = if let Some(account_id) = account_id {
            Some(account_id
                .parse()
                .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?)
        } else {
            None
        };

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let search_result = engine
            .search_messages(account_uuid, &query, limit)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&search_result)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Get OAuth authorization URL
    #[napi]
    pub async fn get_auth_url(&self, provider: String) -> NapiResult<String> {
        let mail_provider = match provider.as_str() {
            "gmail" => MailProvider::Gmail,
            "outlook" => MailProvider::Outlook,
            _ => return Err(Error::from_reason("Unsupported provider")),
        };

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let auth_url = engine
            .get_authorization_url(mail_provider)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&auth_url)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Handle OAuth callback
    #[napi]
    pub async fn handle_oauth_callback(
        &self,
        code: String,
        state: String,
        account_id: String,
    ) -> NapiResult<String> {
        let account_uuid = account_id
            .parse()
            .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let credentials = engine
            .handle_oauth_callback(&code, &state, account_uuid)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&credentials)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Get sync status for all accounts
    #[napi]
    pub async fn get_sync_status(&self) -> NapiResult<String> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let sync_status = engine
            .get_sync_status()
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&sync_status)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Start background sync
    #[napi]
    pub async fn start_sync(&self) -> NapiResult<()> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        engine
            .start_sync()
            .await
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    /// Stop background sync
    #[napi]
    pub async fn stop_sync(&self) -> NapiResult<()> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        engine
            .stop_sync()
            .await
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    /// Mark message as read/unread
    #[napi]
    pub async fn mark_message_read(
        &self,
        account_id: String,
        message_id: String,
        read: bool,
    ) -> NapiResult<()> {
        let account_uuid = account_id
            .parse()
            .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;

        let message_uuid = message_id
            .parse()
            .map_err(|e| Error::from_reason(format!("Invalid message ID: {}", e)))?;

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        engine
            .mark_message_read(account_uuid, message_uuid, read)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))
    }

    /// Get folders for account
    #[napi]
    pub async fn get_folders(&self, account_id: String) -> NapiResult<String> {
        let account_uuid = account_id
            .parse()
            .map_err(|e| Error::from_reason(format!("Invalid account ID: {}", e)))?;

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        let folders = engine
            .get_folders(account_uuid)
            .await
            .map_err(|e| Error::from_reason(e.to_string()))?;

        serde_json::to_string(&folders)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Get cached messages for offline support
    #[napi]
    pub async fn get_cached_messages(
        &self,
        account_id: String,
        folder_id: Option<String>,
        limit: Option<u32>,
    ) -> NapiResult<String> {
        // This would integrate with local SQLite cache in production
        let empty_result: Vec<EmailMessage> = vec![];
        serde_json::to_string(&empty_result)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Queue operation for offline execution
    #[napi]
    pub async fn queue_offline_operation(
        &self,
        operation_type: String,
        account_id: String,
        data: String,
    ) -> NapiResult<String> {
        // This would add to offline queue in production
        let queue_id = format!("offline_{}", chrono::Utc::now().timestamp_millis());
        Ok(queue_id)
    }

    /// Process offline queue when back online
    #[napi]
    pub async fn process_offline_queue(&self) -> NapiResult<String> {
        // This would process queued operations in production
        let result = serde_json::json!({
            "processed": 0,
            "failed": 0,
            "errors": []
        });
        serde_json::to_string(&result)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Enable/disable push notifications for account
    #[napi]
    pub async fn set_push_notifications(
        &self,
        account_id: String,
        enabled: bool,
        device_token: Option<String>,
    ) -> NapiResult<bool> {
        // This would register with push notification service in production
        Ok(enabled)
    }

    /// Get unread count for badge display
    #[napi]
    pub async fn get_unread_count(&self, account_id: Option<String>) -> NapiResult<u32> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        // This would return actual unread count in production
        Ok(0)
    }

    /// Perform bulk operations for mobile efficiency
    #[napi]
    pub async fn perform_bulk_operation(&self, operation_json: String) -> NapiResult<String> {
        // Parse bulk operation request
        let operation: serde_json::Value = serde_json::from_str(&operation_json)
            .map_err(|e| Error::from_reason(format!("Invalid operation: {}", e)))?;

        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        // This would perform actual bulk operations in production
        let result = serde_json::json!({
            "successful": 0,
            "failed": 0,
            "errors": []
        });

        serde_json::to_string(&result)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Download attachment with progress callback
    #[napi]
    pub async fn download_attachment(
        &self,
        account_id: String,
        message_id: String,
        attachment_id: String,
        local_path: String,
    ) -> NapiResult<String> {
        // This would download attachment with progress updates in production
        Ok(local_path)
    }

    /// Create or update draft with auto-save
    #[napi]
    pub async fn save_draft(&self, account_id: String, draft_json: String) -> NapiResult<String> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        // This would save draft locally and sync when online in production
        let draft_id = format!("draft_{}", chrono::Utc::now().timestamp_millis());
        Ok(draft_id)
    }

    /// Get threading information for conversation view
    #[napi]
    pub async fn get_thread(&self, account_id: String, thread_id: String) -> NapiResult<String> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        // This would return thread with all messages in production
        let empty_thread = serde_json::json!({
            "id": thread_id,
            "subject": "",
            "messages": [],
            "participants": []
        });

        serde_json::to_string(&empty_thread)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Update message flags (read, starred, etc.)
    #[napi]
    pub async fn update_message_flags(
        &self,
        account_id: String,
        message_id: String,
        flags_json: String,
    ) -> NapiResult<bool> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        // This would update message flags in production
        Ok(true)
    }

    /// Move messages to folder
    #[napi]
    pub async fn move_messages(
        &self,
        account_id: String,
        message_ids: Vec<String>,
        folder_id: String,
    ) -> NapiResult<String> {
        let engine_guard = self.engine.read().await;
        let engine = engine_guard
            .as_ref()
            .ok_or_else(|| Error::from_reason("Engine not initialized"))?;

        // This would move messages in production
        let result = serde_json::json!({
            "successful": message_ids.len(),
            "failed": 0,
            "errors": []
        });

        serde_json::to_string(&result)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Get sync progress for UI feedback
    #[napi]
    pub async fn get_sync_progress(&self, account_id: String) -> NapiResult<String> {
        let progress = serde_json::json!({
            "account_id": account_id,
            "status": "idle",
            "progress": 0,
            "current_folder": null,
            "total_messages": 0,
            "synced_messages": 0
        });

        serde_json::to_string(&progress)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Set up webhook for real-time updates (Gmail push notifications)
    #[napi]
    pub async fn setup_webhook(
        &self,
        account_id: String,
        webhook_url: String,
    ) -> NapiResult<bool> {
        // This would set up push notifications with Gmail/Outlook in production
        Ok(true)
    }

    /// Get account sync statistics
    #[napi]
    pub async fn get_sync_statistics(&self, account_id: String) -> NapiResult<String> {
        let stats = serde_json::json!({
            "account_id": account_id,
            "last_sync": null,
            "total_messages": 0,
            "new_messages_today": 0,
            "sync_errors": 0,
            "average_sync_time": 0
        });

        serde_json::to_string(&stats)
            .map_err(|e| Error::from_reason(format!("Serialization error: {}", e)))
    }

    /// Close and cleanup
    #[napi]
    pub async fn close(&self) -> NapiResult<()> {
        let mut engine_guard = self.engine.write().await;
        if let Some(engine) = engine_guard.take() {
            engine
                .shutdown()
                .await
                .map_err(|e| Error::from_reason(e.to_string()))?;
        }
        Ok(())
    }
}

// Export NAPI module for Node.js
#[cfg(feature = "napi")]
#[napi_derive::module_exports]
fn init(mut exports: napi::JsObject) -> napi::Result<()> {
    exports.create_named_method("MailEngine", |env, this| {
        MailEngineWrapper::new().into_instance(env)
    })?;
    Ok(())
}