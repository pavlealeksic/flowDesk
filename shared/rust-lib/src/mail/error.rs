//! Error handling for the mail engine


/// Result type alias for mail operations
pub type MailResult<T> = Result<T, MailError>;

/// Comprehensive error type for mail engine operations
#[derive(Debug, thiserror::Error)]
pub enum MailError {
    /// Database-related errors
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    /// HTTP client errors
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// OAuth2 authentication errors
    #[error("OAuth2 error: {0}")]
    OAuth2(String),

    /// IMAP protocol errors
    #[error("IMAP error: {0}")]
    Imap(String),

    /// SMTP sending errors
    #[error("SMTP error: {0}")]
    Smtp(#[from] lettre::transport::smtp::Error),

    /// Email parsing errors
    #[error("Email parsing error: {0}")]
    EmailParsing(String),

    /// Parse errors for various formats
    #[error("Parse error: {0}")]
    ParseError(String),

    /// JSON serialization/deserialization errors
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// IO errors
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// Authentication errors
    #[error("Authentication error: {message}")]
    Authentication { message: String },

    /// Authorization errors (expired tokens, insufficient permissions)
    #[error("Authorization error: {message}")]
    Authorization { message: String },

    /// Rate limiting errors
    #[error("Rate limited: {message}, retry after {retry_after_seconds}s")]
    RateLimit {
        message: String,
        retry_after_seconds: u64,
    },

    /// Quota exceeded errors
    #[error("Quota exceeded: {message}")]
    QuotaExceeded { message: String },

    /// Provider-specific API errors
    #[error("Provider API error: {provider} - {message} (code: {code})")]
    ProviderApi {
        provider: String,
        message: String,
        code: String,
    },

    /// Generic API error
    #[error("API error: {0}")]
    Api(String),

    /// Account configuration errors
    #[error("Account configuration error: {message}")]
    AccountConfig { message: String },

    /// Sync errors
    #[error("Sync error: {message}")]
    Sync { message: String },

    /// Threading errors
    #[error("Threading error: {message}")]
    Threading { message: String },

    /// Attachment handling errors
    #[error("Attachment error: {message}")]
    Attachment { message: String },

    /// Search errors
    #[error("Search error: {message}")]
    Search { message: String },

    /// Filter processing errors
    #[error("Filter error: {message}")]
    Filter { message: String },

    /// Encryption/decryption errors
    #[error("Encryption error: {message}")]
    Encryption { message: String },

    /// Validation errors
    #[error("Validation error: {field} - {message}")]
    Validation { field: String, message: String },

    /// Network connectivity errors
    #[error("Network error: {message}")]
    Network { message: String },

    /// Timeout errors
    #[error("Timeout: {operation} took longer than {timeout_seconds}s")]
    Timeout {
        operation: String,
        timeout_seconds: u64,
    },

    /// Resource not found errors
    #[error("Not found: {resource} with ID {id}")]
    NotFound { resource: String, id: String },

    /// Conflict errors (e.g., duplicate resources)
    #[error("Conflict: {message}")]
    Conflict { message: String },

    /// Unsupported provider error
    #[error("Unsupported provider: {provider}")]
    UnsupportedProvider { provider: String },

    /// Configuration error
    #[error("Configuration error: {message}")]
    ConfigurationError { message: String },

    /// Account not found error
    #[error("Account not found: {account_id}")]
    AccountNotFound { account_id: String },

    /// Authentication error
    #[error("Authentication failed: {message}")]
    AuthenticationError { message: String },

    /// Internal server errors
    #[error("Internal error: {message}")]
    Internal { message: String },

    /// Feature not supported by provider
    #[error("Feature not supported: {feature} is not supported by {provider}")]
    NotSupported { feature: String, provider: String },

    /// Generic error with context
    #[error("Error: {message}")]
    Other { message: String },
}

impl MailError {
    /// Create an authentication error
    pub fn authentication(message: impl Into<String>) -> Self {
        Self::Authentication {
            message: message.into(),
        }
    }

    /// Create an authorization error
    pub fn authorization(message: impl Into<String>) -> Self {
        Self::Authorization {
            message: message.into(),
        }
    }

    /// Create a rate limit error
    pub fn rate_limit(message: impl Into<String>, retry_after_seconds: u64) -> Self {
        Self::RateLimit {
            message: message.into(),
            retry_after_seconds,
        }
    }

    /// Create a provider API error
    pub fn provider_api(
        provider: impl Into<String>,
        message: impl Into<String>,
        code: impl Into<String>,
    ) -> Self {
        Self::ProviderApi {
            provider: provider.into(),
            message: message.into(),
            code: code.into(),
        }
    }

    /// Create an account configuration error
    pub fn account_config(message: impl Into<String>) -> Self {
        Self::AccountConfig {
            message: message.into(),
        }
    }

    /// Create a sync error
    pub fn sync(message: impl Into<String>) -> Self {
        Self::Sync {
            message: message.into(),
        }
    }

    /// Create a database error from string
    pub fn database(message: impl Into<String>) -> Self {
        Self::Other {
            message: format!("Database error: {}", message.into()),
        }
    }

    /// Create a network connection error
    pub fn connection(message: impl Into<String>) -> Self {
        Self::Network {
            message: message.into(),
        }
    }

    /// Create a validation error
    pub fn validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Validation {
            field: field.into(),
            message: message.into(),
        }
    }

    /// Create a timeout error
    pub fn timeout(operation: impl Into<String>, timeout_seconds: u64) -> Self {
        Self::Timeout {
            operation: operation.into(),
            timeout_seconds,
        }
    }

    /// Create a configuration error
    pub fn configuration(message: impl Into<String>) -> Self {
        MailError::Other {
            message: format!("Configuration error: {}", message.into()),
        }
    }

    /// Create a parsing error
    pub fn parsing(message: impl Into<String>) -> Self {
        MailError::EmailParsing(message.into())
    }

    /// Create a not found error
    pub fn not_found(resource: impl Into<String>, id: impl Into<String>) -> Self {
        Self::NotFound {
            resource: resource.into(),
            id: id.into(),
        }
    }

    /// Create a not supported error
    pub fn not_supported(feature: impl Into<String>, provider: impl Into<String>) -> Self {
        Self::NotSupported {
            feature: feature.into(),
            provider: provider.into(),
        }
    }

    /// Create a generic error
    pub fn other(message: impl Into<String>) -> Self {
        Self::Other {
            message: message.into(),
        }
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            MailError::Http(_)
                | MailError::Network { .. }
                | MailError::Timeout { .. }
                | MailError::RateLimit { .. }
                | MailError::ProviderApi { .. }
                | MailError::Io(_)
        )
    }

    /// Check if this error requires re-authentication
    pub fn requires_reauth(&self) -> bool {
        matches!(
            self,
            MailError::Authentication { .. }
                | MailError::Authorization { .. }
                | MailError::OAuth2(_)
        )
    }

    /// Get suggested retry delay in seconds
    pub fn retry_after_seconds(&self) -> Option<u64> {
        match self {
            MailError::RateLimit {
                retry_after_seconds,
                ..
            } => Some(*retry_after_seconds),
            MailError::Http(_) => Some(5), // 5 second delay for HTTP errors
            MailError::Network { .. } => Some(10), // 10 second delay for network errors
            MailError::Timeout { .. } => Some(2), // 2 second delay for timeouts
            _ => None,
        }
    }

    /// Get the error category for metrics/logging
    pub fn category(&self) -> &'static str {
        match self {
            MailError::Database(_) => "database",
            MailError::Http(_) => "http",
            MailError::OAuth2(_) => "oauth2",
            MailError::Imap(_) => "imap",
            MailError::Smtp(_) => "smtp",
            MailError::EmailParsing(_) => "parsing",
            MailError::Json(_) => "json",
            MailError::Io(_) => "io",
            MailError::Authentication { .. } => "auth",
            MailError::Authorization { .. } => "auth",
            MailError::RateLimit { .. } => "rate_limit",
            MailError::QuotaExceeded { .. } => "quota",
            MailError::ProviderApi { .. } => "provider_api",
            MailError::Api(_) => "api",
            MailError::AccountConfig { .. } => "config",
            MailError::Sync { .. } => "sync",
            MailError::Threading { .. } => "threading",
            MailError::Attachment { .. } => "attachment",
            MailError::Search { .. } => "search",
            MailError::Filter { .. } => "filter",
            MailError::Encryption { .. } => "encryption",
            MailError::Validation { .. } => "validation",
            MailError::Network { .. } => "network",
            MailError::Timeout { .. } => "timeout",
            MailError::NotFound { .. } => "not_found",
            MailError::Conflict { .. } => "conflict",
            MailError::Internal { .. } => "internal",
            MailError::NotSupported { .. } => "not_supported",
            MailError::UnsupportedProvider { .. } => "unsupported_provider",
            MailError::ConfigurationError { .. } => "configuration",
            MailError::AccountNotFound { .. } => "account_not_found",
            MailError::AuthenticationError { .. } => "authentication_error",
            MailError::Other { .. } => "other",
            MailError::ParseError(_) => "parse",
        }
    }

    /// Create an invalid input error
    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::Validation {
            field: "input".to_string(),
            message: message.into(),
        }
    }

    /// Create a not implemented error
    pub fn not_implemented(feature: impl Into<String>) -> Self {
        Self::Internal {
            message: format!("Not implemented: {}", feature.into()),
        }
    }

    /// Create an authentication error
    pub fn authentication_error(message: impl Into<String>) -> Self {
        Self::AuthenticationError {
            message: message.into(),
        }
    }

    /// Create a rate limit error
    pub fn rate_limited(message: impl Into<String>) -> Self {
        Self::Internal {
            message: format!("Rate limited: {}", message.into()),
        }
    }

    /// Create an encryption error
    pub fn encryption(message: impl Into<String>) -> Self {
        Self::Encryption {
            message: message.into(),
        }
    }

    /// Create an invalid input error (alias for validation)
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::Validation {
            field: "input".to_string(),
            message: message.into(),
        }
    }
}

// Convert from IMAP errors
impl From<async_imap::error::Error> for MailError {
    fn from(error: async_imap::error::Error) -> Self {
        MailError::Imap(error.to_string())
    }
}

// Convert from mailparse errors
impl From<mailparse::MailParseError> for MailError {
    fn from(error: mailparse::MailParseError) -> Self {
        MailError::EmailParsing(error.to_string())
    }
}

// Convert from URL parsing errors
impl From<url::ParseError> for MailError {
    fn from(error: url::ParseError) -> Self {
        MailError::Other {
            message: format!("URL parsing error: {}", error),
        }
    }
}

// Convert from boxed errors (common for database initialization)
impl From<Box<dyn std::error::Error + Send + Sync>> for MailError {
    fn from(error: Box<dyn std::error::Error + Send + Sync>) -> Self {
        MailError::Other {
            message: error.to_string(),
        }
    }
}

// Convert from OAuth2 basic error response
impl From<oauth2::basic::BasicErrorResponse> for MailError {
    fn from(error: oauth2::basic::BasicErrorResponse) -> Self {
        MailError::OAuth2(format!("{:?}", error))
    }
}