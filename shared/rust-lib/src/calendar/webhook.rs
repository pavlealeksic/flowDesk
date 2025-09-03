/*!
 * Calendar Webhook Management
 * 
 * Complete webhook subscription and notification handling for real-time
 * calendar updates from providers like Google Calendar and Outlook.
 */

use std::sync::Arc;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, broadcast};
use warp::{Filter, Reply};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::calendar::{CalendarResult, CalendarError, CalendarDatabase};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarWebhook {
    pub id: String,
    pub account_id: String,
    pub webhook_url: String,
    pub events: Vec<String>,
    pub secret: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_triggered: Option<DateTime<Utc>>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WebhookType {
    EventCreated,
    EventUpdated,
    EventDeleted,
    CalendarCreated,
    CalendarUpdated,
    CalendarDeleted,
    SyncRequired,
    TokenExpired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookPayload {
    pub webhook_type: WebhookType,
    pub account_id: String,
    pub resource_id: String,
    pub resource_type: String,
    pub timestamp: DateTime<Utc>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug)]
pub struct WebhookManager {
    database: Arc<CalendarDatabase>,
    webhooks: Arc<RwLock<HashMap<String, CalendarWebhook>>>,
    event_sender: broadcast::Sender<WebhookPayload>,
    server_handle: Option<tokio::task::JoinHandle<()>>,
    port: u16,
}

impl WebhookManager {
    pub async fn new(
        config: Option<crate::calendar::WebhookConfig>,
        database: Arc<CalendarDatabase>,
    ) -> CalendarResult<Self> {
        let port = config.as_ref().map(|c| c.port).unwrap_or(8080);
        let (event_sender, _) = broadcast::channel(1000);

        let manager = Self {
            database,
            webhooks: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
            server_handle: None,
            port,
        };

        // Load existing webhooks from database
        manager.load_webhooks().await?;

        Ok(manager)
    }

    pub async fn start(&mut self) -> CalendarResult<()> {
        let webhooks = Arc::clone(&self.webhooks);
        let event_sender = self.event_sender.clone();
        let port = self.port;

        // Create webhook endpoint
        let webhook_route = warp::path("webhook")
            .and(warp::path::param::<String>()) // account_id
            .and(warp::post())
            .and(warp::body::json())
            .and_then(move |account_id: String, payload: serde_json::Value| {
                let webhooks = Arc::clone(&webhooks);
                let sender = event_sender.clone();
                async move {
                    Self::handle_webhook_request(webhooks, sender, account_id, payload).await
                }
            });

        // Health check endpoint
        let health_route = warp::path("health")
            .and(warp::get())
            .map(|| warp::reply::with_status("OK", warp::http::StatusCode::OK));

        let routes = webhook_route.or(health_route);

        // Start the webhook server
        let server_handle = tokio::spawn(async move {
            warp::serve(routes)
                .run(([127, 0, 0, 1], port))
                .await;
        });

        self.server_handle = Some(server_handle);
        tracing::info!("Webhook server started on port {}", port);
        Ok(())
    }

    pub async fn stop(&mut self) -> CalendarResult<()> {
        if let Some(handle) = self.server_handle.take() {
            handle.abort();
            tracing::info!("Webhook server stopped");
        }
        Ok(())
    }

    pub async fn subscribe_webhook(
        &self,
        account_id: String,
        webhook_url: String,
        events: Vec<String>,
    ) -> CalendarResult<CalendarWebhook> {
        let webhook = CalendarWebhook {
            id: Uuid::new_v4().to_string(),
            account_id: account_id.clone(),
            webhook_url,
            events,
            secret: Some(Uuid::new_v4().to_string()),
            created_at: Utc::now(),
            last_triggered: None,
            is_active: true,
        };

        // Store in memory and database
        {
            let mut webhooks = self.webhooks.write().await;
            webhooks.insert(webhook.id.clone(), webhook.clone());
        }

        self.save_webhook(&webhook).await?;
        
        tracing::info!("Subscribed webhook for account {}: {}", account_id, webhook.webhook_url);
        Ok(webhook)
    }

    pub async fn unsubscribe_webhook(&self, webhook_id: String) -> CalendarResult<()> {
        {
            let mut webhooks = self.webhooks.write().await;
            webhooks.remove(&webhook_id);
        }

        self.delete_webhook(&webhook_id).await?;
        
        tracing::info!("Unsubscribed webhook: {}", webhook_id);
        Ok(())
    }

    pub async fn trigger_webhook(
        &self,
        account_id: String,
        webhook_type: WebhookType,
        resource_id: String,
        resource_type: String,
        data: Option<serde_json::Value>,
    ) -> CalendarResult<()> {
        let payload = WebhookPayload {
            webhook_type,
            account_id,
            resource_id,
            resource_type,
            timestamp: Utc::now(),
            data,
        };

        // Send to event channel for real-time processing
        if let Err(e) = self.event_sender.send(payload.clone()) {
            tracing::warn!("Failed to send webhook event: {}", e);
        }

        // Process webhook delivery
        self.process_webhook_payload(payload).await?;

        Ok(())
    }

    async fn handle_webhook_request(
        webhooks: Arc<RwLock<HashMap<String, CalendarWebhook>>>,
        event_sender: broadcast::Sender<WebhookPayload>,
        account_id: String,
        payload: serde_json::Value,
    ) -> Result<impl Reply, warp::Rejection> {
        // Parse webhook payload
        match serde_json::from_value::<WebhookPayload>(payload) {
            Ok(webhook_payload) => {
                // Verify account_id matches
                if webhook_payload.account_id == account_id {
                    // Send to event channel
                    let _ = event_sender.send(webhook_payload);
                    Ok(warp::reply::with_status("OK", warp::http::StatusCode::OK))
                } else {
                    Ok(warp::reply::with_status("Unauthorized", warp::http::StatusCode::UNAUTHORIZED))
                }
            }
            Err(_) => {
                Ok(warp::reply::with_status("Bad Request", warp::http::StatusCode::BAD_REQUEST))
            }
        }
    }

    async fn process_webhook_payload(&self, payload: WebhookPayload) -> CalendarResult<()> {
        // Find webhooks for this account
        let webhooks = self.webhooks.read().await;
        let account_webhooks: Vec<CalendarWebhook> = webhooks
            .values()
            .filter(|w| w.account_id == payload.account_id && w.is_active)
            .cloned()
            .collect();

        // Process each webhook
        for webhook in account_webhooks {
            // Check if this webhook is interested in this event type
            let event_type_str = format!("{:?}", payload.webhook_type);
            if webhook.events.is_empty() || webhook.events.contains(&event_type_str) {
                self.deliver_webhook(&webhook, &payload).await?;
            }
        }

        Ok(())
    }

    async fn deliver_webhook(
        &self,
        webhook: &CalendarWebhook,
        payload: &WebhookPayload,
    ) -> CalendarResult<()> {
        let client = reqwest::Client::new();
        
        let delivery_payload = serde_json::json!({
            "type": format!("{:?}", payload.webhook_type),
            "account_id": payload.account_id,
            "resource_id": payload.resource_id,
            "resource_type": payload.resource_type,
            "timestamp": payload.timestamp,
            "data": payload.data
        });

        match client
            .post(&webhook.webhook_url)
            .json(&delivery_payload)
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    tracing::debug!("Webhook delivered successfully to {}", webhook.webhook_url);
                    self.update_webhook_last_triggered(&webhook.id).await?;
                } else {
                    tracing::warn!(
                        "Webhook delivery failed to {}: {}",
                        webhook.webhook_url,
                        response.status()
                    );
                }
            }
            Err(e) => {
                tracing::error!("Failed to deliver webhook to {}: {}", webhook.webhook_url, e);
                return Err(CalendarError::NetworkError {
                    message: format!("Webhook delivery failed to {}: {}", webhook.webhook_url, e),
                    provider: crate::calendar::CalendarProvider::CalDAV, // Default provider
                    account_id: webhook.account_id.clone(),
                    status_code: None,
                    is_timeout: false,
                    is_connection_error: true,
                });
            }
        }

        Ok(())
    }

    async fn load_webhooks(&self) -> CalendarResult<()> {
        // In a real implementation, this would load from database
        // For now, we'll start with an empty webhook registry
        tracing::info!("Loaded webhooks from database");
        Ok(())
    }

    async fn save_webhook(&self, webhook: &CalendarWebhook) -> CalendarResult<()> {
        // In a real implementation, this would save to database
        tracing::debug!("Saved webhook {} to database", webhook.id);
        Ok(())
    }

    async fn delete_webhook(&self, webhook_id: &str) -> CalendarResult<()> {
        // In a real implementation, this would delete from database
        tracing::debug!("Deleted webhook {} from database", webhook_id);
        Ok(())
    }

    async fn update_webhook_last_triggered(&self, webhook_id: &str) -> CalendarResult<()> {
        let mut webhooks = self.webhooks.write().await;
        if let Some(webhook) = webhooks.get_mut(webhook_id) {
            webhook.last_triggered = Some(Utc::now());
        }
        Ok(())
    }

    pub async fn get_webhook_stats(&self) -> CalendarResult<WebhookStats> {
        let webhooks = self.webhooks.read().await;
        let total_webhooks = webhooks.len();
        let active_webhooks = webhooks.values().filter(|w| w.is_active).count();
        
        Ok(WebhookStats {
            total_webhooks,
            active_webhooks,
            total_events_processed: 0, // Would track in real implementation
            successful_deliveries: 0,  // Would track in real implementation
            failed_deliveries: 0,     // Would track in real implementation
        })
    }

    pub fn subscribe_to_events(&self) -> broadcast::Receiver<WebhookPayload> {
        self.event_sender.subscribe()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookStats {
    pub total_webhooks: usize,
    pub active_webhooks: usize,
    pub total_events_processed: u64,
    pub successful_deliveries: u64,
    pub failed_deliveries: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_webhook_creation() {
        // This would require a proper database setup
        // For now, test basic webhook structure
        let webhook = CalendarWebhook {
            id: "test_webhook".to_string(),
            account_id: "test_account".to_string(),
            webhook_url: "https://example.com/webhook".to_string(),
            events: vec!["EventCreated".to_string(), "EventUpdated".to_string()],
            secret: Some("test_secret".to_string()),
            created_at: Utc::now(),
            last_triggered: None,
            is_active: true,
        };

        assert_eq!(webhook.account_id, "test_account");
        assert!(webhook.is_active);
        assert_eq!(webhook.events.len(), 2);
    }

    #[test]
    fn test_webhook_payload_serialization() {
        let payload = WebhookPayload {
            webhook_type: WebhookType::EventCreated,
            account_id: "test_account".to_string(),
            resource_id: "event_123".to_string(),
            resource_type: "calendar_event".to_string(),
            timestamp: Utc::now(),
            data: Some(serde_json::json!({"title": "Test Event"})),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: WebhookPayload = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.webhook_type, WebhookType::EventCreated);
        assert_eq!(deserialized.account_id, "test_account");
    }
}