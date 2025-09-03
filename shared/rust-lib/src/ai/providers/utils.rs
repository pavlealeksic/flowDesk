//! Provider Utilities
//!
//! Shared utilities for AI providers including retry logic,
//! caching, and common transformations.

use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::time::sleep;
use tracing::{debug, warn, error};

use crate::ai::{
    error::{AIError, AIResult},
    types::{AIProvider, AIMessage, AIResponse, TokenUsage},
};

/// Retry configuration for AI requests
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub backoff_multiplier: f64,
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(1000),
            max_delay: Duration::from_secs(60),
            backoff_multiplier: 2.0,
            jitter: true,
        }
    }
}

/// Retry wrapper for AI operations
pub struct RetryWrapper;

impl RetryWrapper {
    /// Execute an async operation with retry logic
    pub async fn with_retry<T, F, Fut>(
        operation_name: &str,
        config: &RetryConfig,
        operation: F,
    ) -> AIResult<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = AIResult<T>>,
    {
        let mut attempt = 1;
        let mut delay = config.initial_delay;

        loop {
            debug!("Attempting {} (attempt {}/{})", operation_name, attempt, config.max_attempts);
            
            let start_time = Instant::now();
            let result = operation().await;
            let elapsed = start_time.elapsed();

            match result {
                Ok(value) => {
                    if attempt > 1 {
                        debug!("{} succeeded after {} attempts in {:?}", 
                            operation_name, attempt, elapsed);
                    }
                    return Ok(value);
                }
                Err(error) => {
                    if attempt >= config.max_attempts || !error.is_retryable() {
                        error!("{} failed after {} attempts: {}", 
                            operation_name, attempt, error);
                        return Err(error);
                    }

                    // Calculate actual delay with suggested delay from error
                    let actual_delay = if let Some(suggested_delay) = error.retry_delay() {
                        std::cmp::min(suggested_delay, config.max_delay)
                    } else {
                        std::cmp::min(delay, config.max_delay)
                    };

                    // Add jitter if enabled
                    let final_delay = if config.jitter {
                        let jitter_amount = actual_delay.as_millis() as f64 * 0.1;
                        let jitter = (rand::random::<f64>() - 0.5) * jitter_amount;
                        Duration::from_millis((actual_delay.as_millis() as f64 + jitter) as u64)
                    } else {
                        actual_delay
                    };

                    warn!("{} failed (attempt {}): {}. Retrying in {:?}", 
                        operation_name, attempt, error, final_delay);

                    sleep(final_delay).await;

                    // Update delay for next attempt
                    delay = Duration::from_millis(
                        (delay.as_millis() as f64 * config.backoff_multiplier) as u64
                    );
                    attempt += 1;
                }
            }
        }
    }

    /// Retry specifically for AI provider requests
    pub async fn retry_ai_request<T, F, Fut>(
        provider: AIProvider,
        operation_name: &str,
        operation: F,
    ) -> AIResult<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = AIResult<T>>,
    {
        let config = RetryConfig::default();
        Self::with_retry(
            &format!("{}:{}", provider, operation_name),
            &config,
            operation,
        ).await
    }
}

/// Response caching utilities
pub struct ResponseCache {
    cache: HashMap<String, CachedResponse>,
    max_size: usize,
    ttl: Duration,
}

#[derive(Debug, Clone)]
struct CachedResponse {
    response: AIResponse,
    cached_at: Instant,
}

impl ResponseCache {
    /// Create a new response cache
    pub fn new(max_size: usize, ttl: Duration) -> Self {
        Self {
            cache: HashMap::new(),
            max_size,
            ttl,
        }
    }

    /// Generate cache key for a request
    pub fn generate_key(&self, messages: &[AIMessage], model: &str, temperature: f32) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        
        // Hash the messages content
        for msg in messages {
            msg.role.hash(&mut hasher);
            msg.content.hash(&mut hasher);
        }
        
        // Include model and temperature in hash
        model.hash(&mut hasher);
        ((temperature * 1000.0) as u32).hash(&mut hasher);

        format!("ai_cache_{:x}", hasher.finish())
    }

    /// Get cached response if available and not expired
    pub fn get(&self, key: &str) -> Option<AIResponse> {
        if let Some(cached) = self.cache.get(key) {
            if cached.cached_at.elapsed() < self.ttl {
                debug!("Cache hit for key: {}", key);
                return Some(cached.response.clone());
            } else {
                debug!("Cache expired for key: {}", key);
            }
        }
        None
    }

    /// Store response in cache
    pub fn put(&mut self, key: String, response: AIResponse) {
        // Clean expired entries if at capacity
        if self.cache.len() >= self.max_size {
            self.cleanup_expired();
            
            // If still at capacity, remove oldest entry
            if self.cache.len() >= self.max_size {
                if let Some(oldest_key) = self.find_oldest_key() {
                    self.cache.remove(&oldest_key);
                }
            }
        }

        self.cache.insert(key.clone(), CachedResponse {
            response,
            cached_at: Instant::now(),
        });
        
        debug!("Cached response for key: {}", key);
    }

    /// Clean up expired cache entries
    fn cleanup_expired(&mut self) {
        let expired_keys: Vec<String> = self.cache.iter()
            .filter(|(_, cached)| cached.cached_at.elapsed() >= self.ttl)
            .map(|(key, _)| key.clone())
            .collect();

        for key in expired_keys {
            self.cache.remove(&key);
        }
    }

    /// Find the oldest cache entry key
    fn find_oldest_key(&self) -> Option<String> {
        self.cache.iter()
            .min_by_key(|(_, cached)| cached.cached_at)
            .map(|(key, _)| key.clone())
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        let now = Instant::now();
        let expired_count = self.cache.values()
            .filter(|cached| now.duration_since(cached.cached_at) >= self.ttl)
            .count();

        CacheStats {
            total_entries: self.cache.len(),
            expired_entries: expired_count,
            active_entries: self.cache.len() - expired_count,
            max_size: self.max_size,
            hit_rate: 0.0, // Would need to track hits/misses
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub total_entries: usize,
    pub expired_entries: usize,
    pub active_entries: usize,
    pub max_size: usize,
    pub hit_rate: f64,
}

/// Text preprocessing utilities
pub struct TextProcessor;

impl TextProcessor {
    /// Clean and normalize text for AI processing
    pub fn normalize_text(text: &str) -> String {
        text
            // Remove excessive whitespace
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            // Remove control characters but keep newlines
            .chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
            .collect::<String>()
            // Normalize quotes
            .replace('"', "\"")
            .replace('"', "\"")
            .replace('\'', "'")
            .replace('\'', "'")
    }

    /// Extract email content from HTML or plain text
    pub fn extract_email_content(content: &str, is_html: bool) -> String {
        if is_html {
            // Use scraper to extract text from HTML
            match scraper::Html::parse_fragment(content) {
                Ok(document) => {
                    // Get text content, preserving some structure
                    document.root_element()
                        .text()
                        .collect::<Vec<_>>()
                        .join(" ")
                }
                Err(_) => content.to_string(),
            }
        } else {
            Self::normalize_text(content)
        }
    }

    /// Truncate text to fit within token limits
    pub fn truncate_for_tokens(text: &str, max_tokens: u32) -> String {
        // Rough estimation: 4 characters per token
        let max_chars = (max_tokens * 4) as usize;
        
        if text.len() <= max_chars {
            text.to_string()
        } else {
            // Try to truncate at word boundary
            let truncated = &text[..max_chars];
            if let Some(last_space) = truncated.rfind(' ') {
                truncated[..last_space].to_string() + "..."
            } else {
                truncated.to_string() + "..."
            }
        }
    }

    /// Sanitize text for privacy (remove potential personal information)
    pub fn sanitize_for_privacy(text: &str, aggressive: bool) -> String {
        let mut sanitized = text.to_string();

        // Basic email pattern
        let email_regex = regex::Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap();
        sanitized = email_regex.replace_all(&sanitized, "[EMAIL]").to_string();

        // Basic phone number patterns
        let phone_regex = regex::Regex::new(r"\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b").unwrap();
        sanitized = phone_regex.replace_all(&sanitized, "[PHONE]").to_string();

        if aggressive {
            // Credit card patterns (basic)
            let cc_regex = regex::Regex::new(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b").unwrap();
            sanitized = cc_regex.replace_all(&sanitized, "[CARD]").to_string();

            // SSN patterns (US)
            let ssn_regex = regex::Regex::new(r"\b\d{3}-?\d{2}-?\d{4}\b").unwrap();
            sanitized = ssn_regex.replace_all(&sanitized, "[SSN]").to_string();

            // IP addresses
            let ip_regex = regex::Regex::new(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b").unwrap();
            sanitized = ip_regex.replace_all(&sanitized, "[IP]").to_string();
        }

        sanitized
    }
}

/// Rate limiting utilities
pub struct RateLimiter {
    requests_per_minute: u32,
    tokens_per_minute: u32,
    request_timestamps: Vec<Instant>,
    token_usage: Vec<(Instant, u32)>,
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new(requests_per_minute: u32, tokens_per_minute: u32) -> Self {
        Self {
            requests_per_minute,
            tokens_per_minute,
            request_timestamps: Vec::new(),
            token_usage: Vec::new(),
        }
    }

    /// Check if request is allowed and update counters
    pub async fn check_and_update(&mut self, estimated_tokens: u32) -> AIResult<()> {
        let now = Instant::now();
        let minute_ago = now - Duration::from_secs(60);

        // Clean old entries
        self.request_timestamps.retain(|&timestamp| timestamp > minute_ago);
        self.token_usage.retain(|(timestamp, _)| *timestamp > minute_ago);

        // Check request rate limit
        if self.request_timestamps.len() >= self.requests_per_minute as usize {
            let wait_time = Duration::from_secs(60) - now.duration_since(self.request_timestamps[0]);
            return Err(AIError::rate_limit_error(
                AIProvider::OpenAI, // Generic - would be passed in
                "Request rate limit exceeded".to_string(),
                Some(wait_time.as_secs()),
            ));
        }

        // Check token rate limit
        let current_tokens: u32 = self.token_usage.iter().map(|(_, tokens)| *tokens).sum();
        if current_tokens + estimated_tokens > self.tokens_per_minute {
            return Err(AIError::rate_limit_error(
                AIProvider::OpenAI, // Generic
                "Token rate limit exceeded".to_string(),
                Some(60),
            ));
        }

        // Update counters
        self.request_timestamps.push(now);
        self.token_usage.push((now, estimated_tokens));

        Ok(())
    }

    /// Get current usage statistics
    pub fn usage_stats(&self) -> (u32, u32) {
        let now = Instant::now();
        let minute_ago = now - Duration::from_secs(60);

        let recent_requests = self.request_timestamps.iter()
            .filter(|&&timestamp| timestamp > minute_ago)
            .count() as u32;

        let recent_tokens = self.token_usage.iter()
            .filter(|(timestamp, _)| *timestamp > minute_ago)
            .map(|(_, tokens)| *tokens)
            .sum::<u32>();

        (recent_requests, recent_tokens)
    }
}

/// Provider selection utilities
pub struct ProviderSelector;

impl ProviderSelector {
    /// Select best provider based on health and preferences
    pub fn select_best_provider(
        providers: &[AIProvider],
        health_status: &HashMap<AIProvider, crate::ai::ProviderHealth>,
        preferences: &crate::ai::UserAIPreferences,
    ) -> Option<AIProvider> {
        // Filter healthy providers
        let healthy_providers: Vec<AIProvider> = providers.iter()
            .filter(|&provider| {
                health_status.get(provider)
                    .map(|health| matches!(health.status, crate::ai::HealthStatus::Healthy))
                    .unwrap_or(false)
            })
            .cloned()
            .collect();

        if healthy_providers.is_empty() {
            return None;
        }

        // Apply selection logic based on preferences
        match preferences.privacy_mode {
            crate::ai::PrivacyMode::Strict => {
                // Prefer local providers for strict privacy
                healthy_providers.iter()
                    .find(|&&provider| provider == AIProvider::Local)
                    .or_else(|| healthy_providers.first())
                    .cloned()
            }
            crate::ai::PrivacyMode::Standard => {
                // Balanced selection - prefer performance
                healthy_providers.into_iter()
                    .min_by_key(|provider| {
                        health_status.get(provider)
                            .and_then(|health| health.response_time_ms)
                            .unwrap_or(u64::MAX)
                    })
            }
            crate::ai::PrivacyMode::Enhanced => {
                // Prefer cloud providers for enhanced features
                healthy_providers.iter()
                    .find(|&&provider| matches!(provider, AIProvider::OpenAI | AIProvider::DeepSeek))
                    .or_else(|| healthy_providers.first())
                    .cloned()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_retry_config_default() {
        let config = RetryConfig::default();
        assert_eq!(config.max_attempts, 3);
        assert!(config.jitter);
    }

    #[test]
    fn test_text_normalization() {
        let text = "  This   is   \n\n  test   text  ";
        let normalized = TextProcessor::normalize_text(text);
        assert_eq!(normalized, "This is test text");
    }

    #[test]
    fn test_email_sanitization() {
        let text = "Contact me at john@example.com or call 555-123-4567";
        let sanitized = TextProcessor::sanitize_for_privacy(text, false);
        assert!(sanitized.contains("[EMAIL]"));
        assert!(sanitized.contains("[PHONE]"));
        assert!(!sanitized.contains("john@example.com"));
    }

    #[test]
    fn test_token_truncation() {
        let text = "This is a long piece of text that should be truncated";
        let truncated = TextProcessor::truncate_for_tokens(text, 5); // Very small limit
        assert!(truncated.len() < text.len());
        assert!(truncated.ends_with("..."));
    }

    #[tokio::test]
    async fn test_rate_limiter() {
        let mut limiter = RateLimiter::new(2, 100);
        
        // First request should pass
        assert!(limiter.check_and_update(50).await.is_ok());
        
        // Second request should pass
        assert!(limiter.check_and_update(40).await.is_ok());
        
        // Third request should fail (exceeds rate limit)
        assert!(limiter.check_and_update(20).await.is_err());
    }

    #[test]
    fn test_cache_key_generation() {
        let cache = ResponseCache::new(100, Duration::from_secs(300));
        let messages = vec![
            AIMessage::system("System message".to_string()),
            AIMessage::user("User message".to_string()),
        ];
        
        let key1 = cache.generate_key(&messages, "gpt-4", 0.7);
        let key2 = cache.generate_key(&messages, "gpt-4", 0.7);
        let key3 = cache.generate_key(&messages, "gpt-3.5", 0.7);
        
        assert_eq!(key1, key2); // Same inputs should generate same key
        assert_ne!(key1, key3); // Different model should generate different key
    }
}