//! Search system error types and handling

use std::fmt;
use thiserror::Error;
use tantivy::TantivyError;

/// Comprehensive error types for the search system
#[derive(Debug, Error)]
pub enum SearchError {
    /// Index-related errors
    #[error("Index error: {0}")]
    IndexError(String),
    
    /// Tantivy engine errors
    #[error("Tantivy error: {0}")]
    TantivyError(#[from] TantivyError),
    
    /// Query parsing or execution errors
    #[error("Query error: {0}")]
    QueryError(String),
    
    /// Provider-related errors
    #[error("Provider error: {provider_id} - {message}")]
    ProviderError {
        provider_id: String,
        message: String,
    },
    
    /// Configuration errors
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    /// I/O and file system errors
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    /// Serialization/deserialization errors
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    /// Authentication and permission errors
    #[error("Authentication error: {provider} - {message}")]
    AuthError {
        provider: String,
        message: String,
    },
    
    /// Rate limiting errors
    #[error("Rate limit exceeded for provider: {provider}")]
    RateLimitError {
        provider: String,
        retry_after: Option<u64>,
    },
    
    /// Network and connectivity errors
    #[error("Network error: {0}")]
    NetworkError(String),
    
    /// Timeout errors
    #[error("Operation timed out: {operation}")]
    TimeoutError {
        operation: String,
    },
    
    /// Resource exhaustion errors
    #[error("Resource exhausted: {resource} - {message}")]
    ResourceError {
        resource: String,
        message: String,
    },
    
    /// Search index corruption errors
    #[error("Index corruption detected: {index_name}")]
    CorruptionError {
        index_name: String,
    },
    
    /// Invalid search syntax errors
    #[error("Invalid search syntax: {query} - {reason}")]
    SyntaxError {
        query: String,
        reason: String,
    },
    
    /// Permission and security errors
    #[error("Access denied: {resource}")]
    AccessDeniedError {
        resource: String,
    },
    
    /// Plugin-related errors
    #[error("Plugin error: {plugin_id} - {message}")]
    PluginError {
        plugin_id: String,
        message: String,
    },
    
    /// Generic internal errors
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl SearchError {
    /// Create a new index error
    pub fn index_error(message: impl Into<String>) -> Self {
        Self::IndexError(message.into())
    }
    
    /// Create a new query error
    pub fn query_error(message: impl Into<String>) -> Self {
        Self::QueryError(message.into())
    }
    
    /// Create a new provider error
    pub fn provider_error(provider_id: impl Into<String>, message: impl Into<String>) -> Self {
        Self::ProviderError {
            provider_id: provider_id.into(),
            message: message.into(),
        }
    }
    
    /// Create a new configuration error
    pub fn config_error(message: impl Into<String>) -> Self {
        Self::ConfigError(message.into())
    }
    
    /// Create a new authentication error
    pub fn auth_error(provider: impl Into<String>, message: impl Into<String>) -> Self {
        Self::AuthError {
            provider: provider.into(),
            message: message.into(),
        }
    }
    
    /// Create a new rate limit error
    pub fn rate_limit_error(provider: impl Into<String>, retry_after: Option<u64>) -> Self {
        Self::RateLimitError {
            provider: provider.into(),
            retry_after,
        }
    }
    
    /// Create a new timeout error
    pub fn timeout_error(operation: impl Into<String>) -> Self {
        Self::TimeoutError {
            operation: operation.into(),
        }
    }
    
    /// Create a new resource error
    pub fn resource_error(resource: impl Into<String>, message: impl Into<String>) -> Self {
        Self::ResourceError {
            resource: resource.into(),
            message: message.into(),
        }
    }
    
    /// Create a new corruption error
    pub fn corruption_error(index_name: impl Into<String>) -> Self {
        Self::CorruptionError {
            index_name: index_name.into(),
        }
    }
    
    /// Create a new syntax error
    pub fn syntax_error(query: impl Into<String>, reason: impl Into<String>) -> Self {
        Self::SyntaxError {
            query: query.into(),
            reason: reason.into(),
        }
    }
    
    /// Create a new access denied error
    pub fn access_denied_error(resource: impl Into<String>) -> Self {
        Self::AccessDeniedError {
            resource: resource.into(),
        }
    }
    
    /// Create a new plugin error
    pub fn plugin_error(plugin_id: impl Into<String>, message: impl Into<String>) -> Self {
        Self::PluginError {
            plugin_id: plugin_id.into(),
            message: message.into(),
        }
    }
    
    /// Create a new internal error
    pub fn internal_error(message: impl Into<String>) -> Self {
        Self::InternalError(message.into())
    }
    
    /// Check if this error is recoverable
    pub fn is_recoverable(&self) -> bool {
        match self {
            Self::NetworkError(_) 
            | Self::TimeoutError { .. }
            | Self::RateLimitError { .. } => true,
            
            Self::CorruptionError { .. }
            | Self::AccessDeniedError { .. }
            | Self::ConfigError(_) => false,
            
            _ => false,
        }
    }
    
    /// Check if this error should trigger a retry
    pub fn should_retry(&self) -> bool {
        match self {
            Self::NetworkError(_) 
            | Self::TimeoutError { .. } => true,
            
            Self::RateLimitError { .. } => true,
            
            _ => false,
        }
    }
    
    /// Get retry delay in seconds
    pub fn retry_delay(&self) -> Option<u64> {
        match self {
            Self::RateLimitError { retry_after, .. } => *retry_after,
            Self::NetworkError(_) => Some(5),
            Self::TimeoutError { .. } => Some(2),
            _ => None,
        }
    }
    
    /// Get error category for analytics
    pub fn category(&self) -> &'static str {
        match self {
            Self::IndexError(_) | Self::TantivyError(_) => "index",
            Self::QueryError(_) | Self::SyntaxError { .. } => "query",
            Self::ProviderError { .. } => "provider",
            Self::ConfigError(_) => "config",
            Self::IoError(_) => "io",
            Self::SerializationError(_) => "serialization",
            Self::AuthError { .. } | Self::AccessDeniedError { .. } => "auth",
            Self::RateLimitError { .. } => "rate_limit",
            Self::NetworkError(_) => "network",
            Self::TimeoutError { .. } => "timeout",
            Self::ResourceError { .. } => "resource",
            Self::CorruptionError { .. } => "corruption",
            Self::PluginError { .. } => "plugin",
            Self::InternalError(_) => "internal",
        }
    }
}

/// Result type alias for search operations
pub type SearchResult<T> = std::result::Result<T, SearchError>;

/// Error context for search operations
#[derive(Debug, Clone)]
pub struct SearchErrorContext {
    pub operation: String,
    pub provider_id: Option<String>,
    pub query: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub additional_info: std::collections::HashMap<String, String>,
}

impl SearchErrorContext {
    pub fn new(operation: impl Into<String>) -> Self {
        Self {
            operation: operation.into(),
            provider_id: None,
            query: None,
            timestamp: chrono::Utc::now(),
            additional_info: std::collections::HashMap::new(),
        }
    }
    
    pub fn with_provider(mut self, provider_id: impl Into<String>) -> Self {
        self.provider_id = Some(provider_id.into());
        self
    }
    
    pub fn with_query(mut self, query: impl Into<String>) -> Self {
        self.query = Some(query.into());
        self
    }
    
    pub fn with_info(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.additional_info.insert(key.into(), value.into());
        self
    }
}

/// Helper trait for adding context to errors
pub trait ErrorContext<T> {
    fn with_context(self, context: SearchErrorContext) -> SearchResult<T>;
}

impl<T> ErrorContext<T> for SearchResult<T> {
    fn with_context(self, context: SearchErrorContext) -> SearchResult<T> {
        self.map_err(|mut error| {
            tracing::error!(
                operation = %context.operation,
                provider_id = ?context.provider_id,
                query = ?context.query,
                timestamp = %context.timestamp,
                additional_info = ?context.additional_info,
                error = %error,
                "Search operation failed with context"
            );
            error
        })
    }
}