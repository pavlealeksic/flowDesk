//! AI Error Handling

use serde::{Deserialize, Serialize};
use std::fmt;
use crate::ai::AIProvider;

/// Main AI error type
#[derive(Debug, thiserror::Error, Serialize, Deserialize)]
pub enum AIError {
    #[error("Configuration error: {0}")]
    Config(#[from] crate::ai::config::ConfigError),

    #[error("Provider error ({provider}): {message}")]
    Provider {
        provider: AIProvider,
        message: String,
        code: Option<String>,
        retryable: bool,
    },

    #[error("Authentication failed for provider {provider}: {message}")]
    Authentication {
        provider: AIProvider,
        message: String,
    },

    #[error("Rate limit exceeded for provider {provider}: {message}")]
    RateLimit {
        provider: AIProvider,
        message: String,
        reset_at: Option<chrono::DateTime<chrono::Utc>>,
        retry_after: Option<u64>,
    },

    #[error("Invalid request: {message}")]
    InvalidRequest {
        message: String,
        field: Option<String>,
    },

    #[error("Token limit exceeded: requested {requested}, maximum {maximum}")]
    TokenLimit {
        requested: u32,
        maximum: u32,
        provider: AIProvider,
    },

    #[error("Network error: {0}")]
    Network(#[from] NetworkError),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Provider not available: {0}")]
    ProviderNotAvailable(AIProvider),

    #[error("Model not found: {model} for provider {provider}")]
    ModelNotFound {
        model: String,
        provider: AIProvider,
    },

    #[error("Content filtered by provider: {reason}")]
    ContentFiltered {
        reason: String,
        provider: AIProvider,
    },

    #[error("Timeout error: operation took longer than {timeout_ms}ms")]
    Timeout {
        timeout_ms: u64,
        operation: String,
    },

    #[error("Privacy violation: {message}")]
    Privacy {
        message: String,
        violation_type: PrivacyViolationType,
    },

    #[error("Usage quota exceeded for provider {provider}: {message}")]
    QuotaExceeded {
        provider: AIProvider,
        message: String,
        quota_type: QuotaType,
    },

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("External service error: {service} - {message}")]
    ExternalService {
        service: String,
        message: String,
        status_code: Option<u16>,
    },
}

/// Network-related errors
#[derive(Debug, thiserror::Error, Serialize, Deserialize)]
pub enum NetworkError {
    #[error("Connection failed: {0}")]
    Connection(String),

    #[error("DNS resolution failed: {0}")]
    DnsResolution(String),

    #[error("TLS/SSL error: {0}")]
    Tls(String),

    #[error("HTTP error: {status} - {message}")]
    Http {
        status: u16,
        message: String,
    },

    #[error("Request timeout after {seconds}s")]
    Timeout { seconds: u64 },

    #[error("Connection pool exhausted")]
    PoolExhausted,
}

/// Privacy violation types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrivacyViolationType {
    PersonalDataExposure,
    UnauthorizedDataAccess,
    DataRetentionViolation,
    ConsentViolation,
    CrossBorderTransfer,
}

/// Quota types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QuotaType {
    Daily,
    Monthly,
    TokenCount,
    RequestCount,
    ConcurrentRequests,
}

impl AIError {
    /// Check if the error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Provider { retryable, .. } => *retryable,
            Self::Network(NetworkError::Timeout { .. }) => true,
            Self::Network(NetworkError::Connection(_)) => true,
            Self::Network(NetworkError::PoolExhausted) => true,
            Self::RateLimit { .. } => true,
            Self::Timeout { .. } => true,
            Self::ExternalService { status_code: Some(status), .. } => {
                // Retry on 5xx errors and some 4xx errors
                *status >= 500 || matches!(*status, 408 | 429)
            }
            _ => false,
        }
    }

    /// Get the suggested delay before retry
    pub fn retry_delay(&self) -> Option<std::time::Duration> {
        match self {
            Self::RateLimit { retry_after: Some(seconds), .. } => {
                Some(std::time::Duration::from_secs(*seconds))
            }
            Self::Network(NetworkError::Timeout { .. }) => {
                Some(std::time::Duration::from_secs(5))
            }
            Self::Provider { retryable: true, .. } => {
                Some(std::time::Duration::from_secs(1))
            }
            _ => None,
        }
    }

    /// Get the provider associated with the error (if any)
    pub fn provider(&self) -> Option<AIProvider> {
        match self {
            Self::Provider { provider, .. } => Some(*provider),
            Self::Authentication { provider, .. } => Some(*provider),
            Self::RateLimit { provider, .. } => Some(*provider),
            Self::TokenLimit { provider, .. } => Some(*provider),
            Self::ProviderNotAvailable(provider) => Some(*provider),
            Self::ModelNotFound { provider, .. } => Some(*provider),
            Self::ContentFiltered { provider, .. } => Some(*provider),
            Self::QuotaExceeded { provider, .. } => Some(*provider),
            _ => None,
        }
    }

    /// Create a provider error
    pub fn provider_error(
        provider: AIProvider,
        message: impl Into<String>,
        retryable: bool,
    ) -> Self {
        Self::Provider {
            provider,
            message: message.into(),
            code: None,
            retryable,
        }
    }

    /// Create an authentication error
    pub fn auth_error(provider: AIProvider, message: impl Into<String>) -> Self {
        Self::Authentication {
            provider,
            message: message.into(),
        }
    }

    /// Create a rate limit error
    pub fn rate_limit_error(
        provider: AIProvider,
        message: impl Into<String>,
        retry_after: Option<u64>,
    ) -> Self {
        Self::RateLimit {
            provider,
            message: message.into(),
            reset_at: None,
            retry_after,
        }
    }

    /// Create a token limit error
    pub fn token_limit_error(provider: AIProvider, requested: u32, maximum: u32) -> Self {
        Self::TokenLimit {
            requested,
            maximum,
            provider,
        }
    }

    /// Create a timeout error
    pub fn timeout_error(operation: impl Into<String>, timeout_ms: u64) -> Self {
        Self::Timeout {
            timeout_ms,
            operation: operation.into(),
        }
    }

    /// Create an internal error
    pub fn internal_error(message: impl Into<String>) -> Self {
        Self::Internal(message.into())
    }
}

impl From<reqwest::Error> for AIError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_timeout() {
            Self::Network(NetworkError::Timeout { seconds: 30 })
        } else if err.is_connect() {
            Self::Network(NetworkError::Connection(err.to_string()))
        } else if let Some(status) = err.status() {
            Self::Network(NetworkError::Http {
                status: status.as_u16(),
                message: err.to_string(),
            })
        } else {
            Self::Network(NetworkError::Connection(err.to_string()))
        }
    }
}

impl From<tokio::time::error::Elapsed> for AIError {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        Self::Timeout {
            timeout_ms: 30000,
            operation: "Request".to_string(),
        }
    }
}

/// Error context for better error handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorContext {
    pub operation: String,
    pub provider: Option<AIProvider>,
    pub model: Option<String>,
    pub session_id: Option<String>,
    pub user_id: Option<String>,
    pub request_id: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub metadata: std::collections::HashMap<String, serde_json::Value>,
}

impl ErrorContext {
    pub fn new(operation: impl Into<String>) -> Self {
        Self {
            operation: operation.into(),
            provider: None,
            model: None,
            session_id: None,
            user_id: None,
            request_id: None,
            timestamp: chrono::Utc::now(),
            metadata: std::collections::HashMap::new(),
        }
    }

    pub fn with_provider(mut self, provider: AIProvider) -> Self {
        self.provider = Some(provider);
        self
    }

    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = Some(model.into());
        self
    }

    pub fn with_session(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    pub fn with_user(mut self, user_id: impl Into<String>) -> Self {
        self.user_id = Some(user_id.into());
        self
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.metadata.insert(key.into(), value);
        self
    }
}

/// Enhanced error with context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextualError {
    pub error: AIError,
    pub context: ErrorContext,
    pub stack_trace: Option<String>,
}

impl fmt::Display for ContextualError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} (operation: {})", self.error, self.context.operation)?;
        if let Some(provider) = &self.context.provider {
            write!(f, " [provider: {}]", provider)?;
        }
        if let Some(model) = &self.context.model {
            write!(f, " [model: {}]", model)?;
        }
        Ok(())
    }
}

impl std::error::Error for ContextualError {}

/// Result type alias for AI operations
pub type AIResult<T> = Result<T, AIError>;

/// Contextual result type alias
pub type ContextualResult<T> = Result<T, ContextualError>;

/// Trait for adding context to errors
pub trait WithContext<T> {
    fn with_context(self, context: ErrorContext) -> ContextualResult<T>;
}

impl<T> WithContext<T> for AIResult<T> {
    fn with_context(self, context: ErrorContext) -> ContextualResult<T> {
        self.map_err(|error| ContextualError {
            error,
            context,
            stack_trace: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_retryable() {
        let retryable_error = AIError::provider_error(AIProvider::OpenAI, "test", true);
        assert!(retryable_error.is_retryable());

        let non_retryable_error = AIError::provider_error(AIProvider::OpenAI, "test", false);
        assert!(!non_retryable_error.is_retryable());
    }

    #[test]
    fn test_error_context() {
        let context = ErrorContext::new("test_operation")
            .with_provider(AIProvider::OpenAI)
            .with_model("gpt-4");

        assert_eq!(context.operation, "test_operation");
        assert_eq!(context.provider, Some(AIProvider::OpenAI));
        assert_eq!(context.model, Some("gpt-4".to_string()));
    }
}