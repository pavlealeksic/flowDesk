//! AI Configuration Management

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::ai::{AIProvider, AIModel, UserAIPreferences, PrivacyMode};

/// Main AI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub primary_provider: AIProvider,
    pub fallback_providers: Vec<AIProvider>,
    pub openai: Option<OpenAIConfig>,
    pub deepseek: Option<DeepSeekConfig>,
    pub local: Option<LocalConfig>,
    pub claude: Option<ClaudeConfig>,
    pub gemini: Option<GeminiConfig>,
    pub rate_limits: RateLimitConfig,
    pub privacy: PrivacyConfig,
    pub caching: CacheConfig,
    pub analytics: AnalyticsConfig,
    pub user_preferences: UserAIPreferences,
    pub models: HashMap<AIProvider, Vec<AIModel>>,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            primary_provider: AIProvider::OpenAI,
            fallback_providers: vec![AIProvider::DeepSeek],
            openai: None,
            deepseek: None,
            local: None,
            claude: None,
            gemini: None,
            rate_limits: RateLimitConfig::default(),
            privacy: PrivacyConfig::default(),
            caching: CacheConfig::default(),
            analytics: AnalyticsConfig::default(),
            user_preferences: UserAIPreferences::default(),
            models: HashMap::new(),
        }
    }
}

impl AIConfig {
    /// Load configuration from environment variables and config files
    pub fn load() -> Result<Self, ConfigError> {
        let mut config = Self::default();

        // Load from environment variables
        if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
            config.openai = Some(OpenAIConfig {
                api_key: api_key.into(),
                base_url: std::env::var("OPENAI_BASE_URL")
                    .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
                organization_id: std::env::var("OPENAI_ORG_ID").ok(),
                default_model: std::env::var("OPENAI_DEFAULT_MODEL")
                    .unwrap_or_else(|_| "gpt-4".to_string()),
                max_tokens: std::env::var("OPENAI_MAX_TOKENS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(4000),
                temperature: std::env::var("OPENAI_TEMPERATURE")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.7),
                timeout_seconds: std::env::var("OPENAI_TIMEOUT")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(30),
            });
        }

        if let Ok(api_key) = std::env::var("DEEPSEEK_API_KEY") {
            config.deepseek = Some(DeepSeekConfig {
                api_key: api_key.into(),
                base_url: std::env::var("DEEPSEEK_BASE_URL")
                    .unwrap_or_else(|_| "https://api.deepseek.com/v1".to_string()),
                default_model: std::env::var("DEEPSEEK_DEFAULT_MODEL")
                    .unwrap_or_else(|_| "deepseek-chat".to_string()),
                max_tokens: std::env::var("DEEPSEEK_MAX_TOKENS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(8000),
                temperature: std::env::var("DEEPSEEK_TEMPERATURE")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.7),
                timeout_seconds: std::env::var("DEEPSEEK_TIMEOUT")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(30),
            });
        }

        // Set primary provider based on availability
        if config.openai.is_some() {
            config.primary_provider = AIProvider::OpenAI;
        } else if config.deepseek.is_some() {
            config.primary_provider = AIProvider::DeepSeek;
        }

        // Load model definitions
        config.models = Self::load_model_definitions();

        Ok(config)
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<(), ConfigError> {
        // Check that primary provider is configured
        match self.primary_provider {
            AIProvider::OpenAI => {
                if self.openai.is_none() {
                    return Err(ConfigError::MissingProvider(AIProvider::OpenAI));
                }
            }
            AIProvider::DeepSeek => {
                if self.deepseek.is_none() {
                    return Err(ConfigError::MissingProvider(AIProvider::DeepSeek));
                }
            }
            AIProvider::Local => {
                if self.local.is_none() {
                    return Err(ConfigError::MissingProvider(AIProvider::Local));
                }
            }
            _ => {
                return Err(ConfigError::UnsupportedProvider(self.primary_provider));
            }
        }

        // Validate rate limits
        if self.rate_limits.requests_per_minute == 0 {
            return Err(ConfigError::InvalidRateLimit);
        }

        Ok(())
    }

    /// Load predefined model definitions
    fn load_model_definitions() -> HashMap<AIProvider, Vec<AIModel>> {
        let mut models = HashMap::new();

        // OpenAI models
        models.insert(AIProvider::OpenAI, vec![
            AIModel {
                name: "gpt-4".to_string(),
                provider: AIProvider::OpenAI,
                max_tokens: 8192,
                context_window: 8192,
                cost_per_token: 0.00003,
                supports_function_calling: true,
                supports_vision: false,
                supports_code: true,
            },
            AIModel {
                name: "gpt-4-turbo".to_string(),
                provider: AIProvider::OpenAI,
                max_tokens: 4096,
                context_window: 128000,
                cost_per_token: 0.00001,
                supports_function_calling: true,
                supports_vision: true,
                supports_code: true,
            },
            AIModel {
                name: "gpt-3.5-turbo".to_string(),
                provider: AIProvider::OpenAI,
                max_tokens: 4096,
                context_window: 16385,
                cost_per_token: 0.0000015,
                supports_function_calling: true,
                supports_vision: false,
                supports_code: true,
            },
        ]);

        // DeepSeek models
        models.insert(AIProvider::DeepSeek, vec![
            AIModel {
                name: "deepseek-chat".to_string(),
                provider: AIProvider::DeepSeek,
                max_tokens: 8192,
                context_window: 32768,
                cost_per_token: 0.000002,
                supports_function_calling: true,
                supports_vision: false,
                supports_code: true,
            },
            AIModel {
                name: "deepseek-coder".to_string(),
                provider: AIProvider::DeepSeek,
                max_tokens: 8192,
                context_window: 32768,
                cost_per_token: 0.000002,
                supports_function_calling: false,
                supports_vision: false,
                supports_code: true,
            },
        ]);

        models
    }

    /// Get model by name and provider
    pub fn get_model(&self, provider: AIProvider, name: &str) -> Option<&AIModel> {
        self.models
            .get(&provider)?
            .iter()
            .find(|m| m.name == name)
    }

    /// Get default model for provider
    pub fn get_default_model(&self, provider: AIProvider) -> Option<&AIModel> {
        match provider {
            AIProvider::OpenAI => {
                let model_name = self.openai.as_ref()?.default_model.as_str();
                self.get_model(provider, model_name)
            }
            AIProvider::DeepSeek => {
                let model_name = self.deepseek.as_ref()?.default_model.as_str();
                self.get_model(provider, model_name)
            }
            _ => None,
        }
    }
}

/// OpenAI provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIConfig {
    pub api_key: secrecy::SecretString,
    pub base_url: String,
    pub organization_id: Option<String>,
    pub default_model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_seconds: u64,
}

/// DeepSeek provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepSeekConfig {
    pub api_key: secrecy::SecretString,
    pub base_url: String,
    pub default_model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_seconds: u64,
}

/// Local model configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalConfig {
    pub model_path: String,
    pub device: Device,
    pub max_tokens: u32,
    pub temperature: f32,
    pub context_window: u32,
    pub quantization: Option<Quantization>,
}

/// Compute device for local models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Device {
    CPU,
    CUDA(u32),
    Metal,
    Auto,
}

/// Model quantization settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Quantization {
    Q4_0,
    Q4_1,
    Q5_0,
    Q5_1,
    Q8_0,
    F16,
    F32,
}

/// Claude provider configuration (future)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeConfig {
    pub api_key: secrecy::SecretString,
    pub base_url: String,
    pub default_model: String,
    pub max_tokens: u32,
    pub timeout_seconds: u64,
}

/// Gemini provider configuration (future)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiConfig {
    pub api_key: secrecy::SecretString,
    pub base_url: String,
    pub default_model: String,
    pub max_tokens: u32,
    pub timeout_seconds: u64,
}

/// Rate limiting configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub tokens_per_minute: u32,
    pub concurrent_requests: u32,
    pub retry_attempts: u32,
    pub backoff_multiplier: f64,
    pub max_backoff_seconds: u64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_minute: 60,
            tokens_per_minute: 100000,
            concurrent_requests: 5,
            retry_attempts: 3,
            backoff_multiplier: 2.0,
            max_backoff_seconds: 60,
        }
    }
}

/// Privacy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyConfig {
    pub mode: PrivacyMode,
    pub anonymize_emails: bool,
    pub scrub_personal_info: bool,
    pub log_interactions: bool,
    pub data_retention_days: u32,
    pub allowed_domains: Vec<String>,
    pub blocked_domains: Vec<String>,
}

impl Default for PrivacyConfig {
    fn default() -> Self {
        Self {
            mode: PrivacyMode::Standard,
            anonymize_emails: true,
            scrub_personal_info: true,
            log_interactions: true,
            data_retention_days: 30,
            allowed_domains: vec![],
            blocked_domains: vec![],
        }
    }
}

/// Caching configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub max_entries: u32,
    pub ttl_seconds: u64,
    pub cache_embeddings: bool,
    pub cache_completions: bool,
    pub cache_path: Option<String>,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            max_entries: 1000,
            ttl_seconds: 3600, // 1 hour
            cache_embeddings: true,
            cache_completions: false, // Don't cache completions by default
            cache_path: None,
        }
    }
}

/// Analytics configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsConfig {
    pub enabled: bool,
    pub collect_usage_stats: bool,
    pub collect_performance_metrics: bool,
    pub collect_error_logs: bool,
    pub anonymous_telemetry: bool,
    pub retention_days: u32,
}

impl Default for AnalyticsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            collect_usage_stats: true,
            collect_performance_metrics: true,
            collect_error_logs: true,
            anonymous_telemetry: true,
            retention_days: 90,
        }
    }
}

/// Configuration errors
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing configuration for provider: {0}")]
    MissingProvider(AIProvider),
    
    #[error("Unsupported provider: {0}")]
    UnsupportedProvider(AIProvider),
    
    #[error("Invalid rate limit configuration")]
    InvalidRateLimit,
    
    #[error("Invalid model configuration: {0}")]
    InvalidModel(String),
    
    #[error("Configuration validation failed: {0}")]
    ValidationFailed(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AIConfig::default();
        assert_eq!(config.primary_provider, AIProvider::OpenAI);
        assert!(config.rate_limits.requests_per_minute > 0);
    }

    #[test]
    fn test_config_validation() {
        let config = AIConfig::default();
        // Should fail without any providers configured
        assert!(config.validate().is_err());
    }
}