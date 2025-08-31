//! Token lifecycle management and refresh handling

use crate::mail::{error::MailResult, types::MailProvider};
use chrono::{DateTime, Duration, Utc};
use governor::{
    clock::DefaultClock,
    state::{DirectStateStore, NotKeyed},
    Quota, RateLimiter,
};
use nonzero_ext::nonzero;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
};
use tokio::sync::{RwLock, Semaphore};
use uuid::Uuid;

/// Token refresh request
#[derive(Debug, Clone)]
pub struct TokenRefreshRequest {
    pub account_id: Uuid,
    pub provider: MailProvider,
    pub refresh_token: String,
    pub requested_at: DateTime<Utc>,
    pub priority: RefreshPriority,
}

/// Priority for token refresh
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RefreshPriority {
    Low,
    Normal,
    High,
    Critical, // Token expires very soon
}

/// Token refresh result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRefreshResult {
    pub account_id: Uuid,
    pub success: bool,
    pub new_access_token: Option<String>,
    pub new_refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub refreshed_at: DateTime<Utc>,
}

/// Token refresh statistics
#[derive(Debug, Clone, Default)]
pub struct RefreshStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time_ms: u64,
    pub last_refresh_at: Option<DateTime<Utc>>,
}

/// Rate limiter for token refresh operations
type RefreshRateLimiter = RateLimiter<NotKeyed, DirectStateStore, DefaultClock>;

/// Token manager for handling refresh operations and lifecycle
pub struct TokenManager {
    /// Rate limiters per provider
    rate_limiters: HashMap<MailProvider, RefreshRateLimiter>,
    /// Concurrent refresh semaphore
    refresh_semaphore: Semaphore,
    /// Active refresh operations
    active_refreshes: RwLock<HashMap<Uuid, tokio::task::JoinHandle<MailResult<TokenRefreshResult>>>>,
    /// Refresh statistics
    stats: RwLock<HashMap<MailProvider, RefreshStats>>,
    /// Refresh queue (priority queue)
    refresh_queue: RwLock<std::collections::BinaryHeap<PriorityRefreshRequest>>,
}

/// Priority wrapper for refresh requests
#[derive(Debug, Clone)]
struct PriorityRefreshRequest {
    request: TokenRefreshRequest,
    priority: RefreshPriority,
}

impl PartialEq for PriorityRefreshRequest {
    fn eq(&self, other: &Self) -> bool {
        self.priority == other.priority
    }
}

impl Eq for PriorityRefreshRequest {}

impl PartialOrd for PriorityRefreshRequest {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityRefreshRequest {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Higher priority comes first (reverse order)
        other.priority.cmp(&self.priority)
    }
}

impl TokenManager {
    /// Create new token manager
    pub fn new() -> Self {
        let mut rate_limiters = HashMap::new();
        
        // Configure rate limiters for different providers
        rate_limiters.insert(
            MailProvider::Gmail,
            RateLimiter::direct(Quota::per_second(nonzero!(5u32))), // 5 refresh requests per second
        );
        
        rate_limiters.insert(
            MailProvider::Outlook,
            RateLimiter::direct(Quota::per_second(nonzero!(10u32))), // 10 refresh requests per second
        );

        Self {
            rate_limiters,
            refresh_semaphore: Semaphore::new(10), // Max 10 concurrent refresh operations
            active_refreshes: RwLock::new(HashMap::new()),
            stats: RwLock::new(HashMap::new()),
            refresh_queue: RwLock::new(std::collections::BinaryHeap::new()),
        }
    }

    /// Check if token needs refresh
    pub fn should_refresh_token(
        &self,
        expires_at: Option<DateTime<Utc>>,
        buffer_minutes: i64,
    ) -> bool {
        if let Some(expires_at) = expires_at {
            let now = Utc::now();
            let buffer = Duration::minutes(buffer_minutes);
            now + buffer >= expires_at
        } else {
            // If no expiry time, assume it doesn't need refresh
            false
        }
    }

    /// Get refresh priority based on expiry time
    pub fn get_refresh_priority(&self, expires_at: Option<DateTime<Utc>>) -> RefreshPriority {
        if let Some(expires_at) = expires_at {
            let now = Utc::now();
            let time_to_expiry = expires_at - now;
            
            if time_to_expiry <= Duration::minutes(5) {
                RefreshPriority::Critical
            } else if time_to_expiry <= Duration::minutes(15) {
                RefreshPriority::High
            } else if time_to_expiry <= Duration::hours(1) {
                RefreshPriority::Normal
            } else {
                RefreshPriority::Low
            }
        } else {
            RefreshPriority::Normal
        }
    }

    /// Queue token refresh request
    pub async fn queue_refresh_request(&self, request: TokenRefreshRequest) -> MailResult<()> {
        // Check if already refreshing
        {
            let active = self.active_refreshes.read().await;
            if active.contains_key(&request.account_id) {
                tracing::debug!("Token refresh already in progress for account {}", request.account_id);
                return Ok(());
            }
        }

        let priority_request = PriorityRefreshRequest {
            priority: request.priority,
            request,
        };

        {
            let mut queue = self.refresh_queue.write().await;
            queue.push(priority_request);
        }

        tracing::debug!("Queued token refresh request for account {}", priority_request.request.account_id);
        Ok(())
    }

    /// Process next refresh request from queue
    pub async fn process_next_refresh(&self) -> MailResult<Option<TokenRefreshResult>> {
        let request = {
            let mut queue = self.refresh_queue.write().await;
            queue.pop().map(|pr| pr.request)
        };

        if let Some(request) = request {
            self.execute_refresh(request).await
        } else {
            Ok(None)
        }
    }

    /// Execute token refresh
    async fn execute_refresh(&self, request: TokenRefreshRequest) -> MailResult<Option<TokenRefreshResult>> {
        // Acquire semaphore permit
        let _permit = self.refresh_semaphore.acquire().await
            .map_err(|_| crate::mail::error::MailError::other("Failed to acquire refresh semaphore"))?;

        // Apply rate limiting
        if let Some(rate_limiter) = self.rate_limiters.get(&request.provider) {
            rate_limiter.until_ready().await;
        }

        let start_time = std::time::Instant::now();
        
        // Perform the actual refresh
        let result = self.refresh_token_with_provider(&request).await;
        
        let duration = start_time.elapsed();
        
        // Update statistics
        self.update_stats(&request.provider, &result, duration).await;
        
        // Remove from active refreshes
        {
            let mut active = self.active_refreshes.write().await;
            active.remove(&request.account_id);
        }

        match result {
            Ok(refresh_result) => {
                tracing::info!(
                    "Successfully refreshed token for account {} ({}ms)",
                    request.account_id,
                    duration.as_millis()
                );
                Ok(Some(refresh_result))
            }
            Err(e) => {
                tracing::error!(
                    "Failed to refresh token for account {}: {} ({}ms)",
                    request.account_id,
                    e,
                    duration.as_millis()
                );
                
                // Create failed result
                Ok(Some(TokenRefreshResult {
                    account_id: request.account_id,
                    success: false,
                    new_access_token: None,
                    new_refresh_token: None,
                    expires_at: None,
                    error_message: Some(e.to_string()),
                    refreshed_at: Utc::now(),
                }))
            }
        }
    }

    /// Refresh token with specific provider
    async fn refresh_token_with_provider(
        &self,
        request: &TokenRefreshRequest,
    ) -> MailResult<TokenRefreshResult> {
        let client = reqwest::Client::new();
        
        match request.provider {
            MailProvider::Gmail => {
                self.refresh_gmail_token(&client, request).await
            }
            MailProvider::Outlook => {
                self.refresh_outlook_token(&client, request).await
            }
            _ => {
                Err(crate::mail::error::MailError::not_supported(
                    "Token refresh",
                    request.provider.as_str(),
                ))
            }
        }
    }

    /// Refresh Gmail token
    async fn refresh_gmail_token(
        &self,
        client: &reqwest::Client,
        request: &TokenRefreshRequest,
    ) -> MailResult<TokenRefreshResult> {
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", &request.refresh_token),
        ];

        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(crate::mail::error::MailError::provider_api(
                "Gmail",
                "Token refresh failed",
                response.status().to_string(),
            ));
        }

        let token_response: serde_json::Value = response.json().await?;
        
        let access_token = token_response["access_token"]
            .as_str()
            .ok_or_else(|| crate::mail::error::MailError::other("Missing access_token in response"))?
            .to_string();

        let expires_in = token_response["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = Utc::now() + Duration::seconds(expires_in as i64);

        Ok(TokenRefreshResult {
            account_id: request.account_id,
            success: true,
            new_access_token: Some(access_token),
            new_refresh_token: token_response["refresh_token"].as_str().map(|s| s.to_string()),
            expires_at: Some(expires_at),
            error_message: None,
            refreshed_at: Utc::now(),
        })
    }

    /// Refresh Outlook token
    async fn refresh_outlook_token(
        &self,
        client: &reqwest::Client,
        request: &TokenRefreshRequest,
    ) -> MailResult<TokenRefreshResult> {
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", &request.refresh_token),
        ];

        let response = client
            .post("https://login.microsoftonline.com/common/oauth2/v2.0/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(crate::mail::error::MailError::provider_api(
                "Outlook",
                "Token refresh failed",
                response.status().to_string(),
            ));
        }

        let token_response: serde_json::Value = response.json().await?;
        
        let access_token = token_response["access_token"]
            .as_str()
            .ok_or_else(|| crate::mail::error::MailError::other("Missing access_token in response"))?
            .to_string();

        let expires_in = token_response["expires_in"].as_u64().unwrap_or(3600);
        let expires_at = Utc::now() + Duration::seconds(expires_in as i64);

        Ok(TokenRefreshResult {
            account_id: request.account_id,
            success: true,
            new_access_token: Some(access_token),
            new_refresh_token: token_response["refresh_token"].as_str().map(|s| s.to_string()),
            expires_at: Some(expires_at),
            error_message: None,
            refreshed_at: Utc::now(),
        })
    }

    /// Update refresh statistics
    async fn update_stats(
        &self,
        provider: &MailProvider,
        result: &MailResult<TokenRefreshResult>,
        duration: std::time::Duration,
    ) {
        let mut stats = self.stats.write().await;
        let provider_stats = stats.entry(*provider).or_default();
        
        provider_stats.total_requests += 1;
        provider_stats.last_refresh_at = Some(Utc::now());
        
        match result {
            Ok(_) => provider_stats.successful_requests += 1,
            Err(_) => provider_stats.failed_requests += 1,
        }
        
        // Update average response time (simple moving average)
        let current_avg = provider_stats.average_response_time_ms;
        let new_time = duration.as_millis() as u64;
        
        if current_avg == 0 {
            provider_stats.average_response_time_ms = new_time;
        } else {
            // Simple exponential moving average
            provider_stats.average_response_time_ms = 
                (current_avg * 9 + new_time) / 10;
        }
    }

    /// Get refresh statistics for a provider
    pub async fn get_stats(&self, provider: MailProvider) -> Option<RefreshStats> {
        let stats = self.stats.read().await;
        stats.get(&provider).cloned()
    }

    /// Get queue size
    pub async fn get_queue_size(&self) -> usize {
        let queue = self.refresh_queue.read().await;
        queue.len()
    }

    /// Get active refresh count
    pub async fn get_active_refresh_count(&self) -> usize {
        let active = self.active_refreshes.read().await;
        active.len()
    }

    /// Check if account is currently being refreshed
    pub async fn is_refreshing(&self, account_id: Uuid) -> bool {
        let active = self.active_refreshes.read().await;
        active.contains_key(&account_id)
    }

    /// Cancel refresh for account
    pub async fn cancel_refresh(&self, account_id: Uuid) -> bool {
        let mut active = self.active_refreshes.write().await;
        if let Some(handle) = active.remove(&account_id) {
            handle.abort();
            true
        } else {
            false
        }
    }

    /// Start background refresh processor
    pub async fn start_background_processor(self: Arc<Self>) {
        let manager = Arc::clone(&self);
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                // Process pending refresh requests
                while manager.get_queue_size().await > 0 {
                    if let Err(e) = manager.process_next_refresh().await {
                        tracing::error!("Error processing token refresh: {}", e);
                        break;
                    }
                }
            }
        });
    }
}

impl Default for TokenManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_refresh_priority_ordering() {
        assert!(RefreshPriority::Critical > RefreshPriority::High);
        assert!(RefreshPriority::High > RefreshPriority::Normal);
        assert!(RefreshPriority::Normal > RefreshPriority::Low);
    }

    #[test]
    fn test_should_refresh_token() {
        let manager = TokenManager::new();
        let now = Utc::now();
        
        // Token expires in 30 minutes - should refresh with 60 minute buffer
        assert!(manager.should_refresh_token(Some(now + Duration::minutes(30)), 60));
        
        // Token expires in 90 minutes - should not refresh with 60 minute buffer
        assert!(!manager.should_refresh_token(Some(now + Duration::minutes(90)), 60));
        
        // No expiry time - should not refresh
        assert!(!manager.should_refresh_token(None, 60));
    }

    #[test]
    fn test_get_refresh_priority() {
        let manager = TokenManager::new();
        let now = Utc::now();
        
        // Expires in 3 minutes - critical
        assert_eq!(
            manager.get_refresh_priority(Some(now + Duration::minutes(3))),
            RefreshPriority::Critical
        );
        
        // Expires in 10 minutes - high
        assert_eq!(
            manager.get_refresh_priority(Some(now + Duration::minutes(10))),
            RefreshPriority::High
        );
        
        // Expires in 30 minutes - normal
        assert_eq!(
            manager.get_refresh_priority(Some(now + Duration::minutes(30))),
            RefreshPriority::Normal
        );
        
        // Expires in 2 hours - low
        assert_eq!(
            manager.get_refresh_priority(Some(now + Duration::hours(2))),
            RefreshPriority::Low
        );
    }

    #[tokio::test]
    async fn test_queue_operations() {
        let manager = TokenManager::new();
        let account_id = Uuid::new_v4();
        
        let request = TokenRefreshRequest {
            account_id,
            provider: MailProvider::Gmail,
            refresh_token: "test_refresh_token".to_string(),
            requested_at: Utc::now(),
            priority: RefreshPriority::Normal,
        };
        
        assert_eq!(manager.get_queue_size().await, 0);
        
        manager.queue_refresh_request(request).await.unwrap();
        assert_eq!(manager.get_queue_size().await, 1);
        
        assert!(!manager.is_refreshing(account_id).await);
    }
}