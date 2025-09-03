pub mod oauth_manager;
pub mod token_storage;

pub use oauth_manager::AuthManager;
pub use token_storage::TokenStorage;

use crate::mail::types::MailProvider;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Authentication credentials for mail accounts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthCredentials {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub scopes: Vec<String>,
    pub provider: MailProvider,
    pub account_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// OAuth2 authorization URL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationUrl {
    pub url: String,
    pub state: String,
    pub pkce_verifier: Option<String>,
}

/// OAuth2 provider abstraction
pub type OAuth2Provider = AuthManager;