//! Authentication module for mail providers

use crate::mail::{config::AuthConfig, error::MailResult, types::MailProvider};
use chrono::{DateTime, Utc};
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, AuthorizationCode, ClientId,
    ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl, RefreshToken, Scope, TokenResponse,
    TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;

pub mod storage;
pub mod token_manager;

pub use storage::TokenStorage;
pub use token_manager::TokenManager;

/// OAuth2 provider configuration
#[derive(Debug, Clone)]
pub struct OAuth2Provider {
    pub client: BasicClient,
    pub scopes: Vec<String>,
    pub provider_type: MailProvider,
}

/// Stored authentication credentials
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

/// OAuth2 authorization URL and state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationUrl {
    pub url: String,
    pub state: String,
    pub pkce_verifier: Option<String>,
    pub provider: MailProvider,
}

/// Authentication manager
pub struct AuthManager {
    providers: HashMap<MailProvider, OAuth2Provider>,
    token_storage: TokenStorage,
    token_manager: TokenManager,
    pending_auth: RwLock<HashMap<String, (MailProvider, Option<String>)>>, // state -> (provider, pkce_verifier)
}

impl AuthManager {
    /// Create new authentication manager
    pub async fn new(config: &AuthConfig) -> MailResult<Self> {
        let mut providers = HashMap::new();

        // Setup Gmail OAuth2 client
        let gmail_client = BasicClient::new(
            ClientId::new(config.google_client_id.clone()),
            Some(ClientSecret::new(config.google_client_secret.clone())),
            AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
                .map_err(|e| crate::mail::error::MailError::other(format!("Invalid Gmail auth URL: {}", e)))?,
            Some(
                TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
                    .map_err(|e| crate::mail::error::MailError::other(format!("Invalid Gmail token URL: {}", e)))?,
            ),
        )
        .set_redirect_uri(
            RedirectUrl::new(config.redirect_uri.clone())
                .map_err(|e| crate::mail::error::MailError::other(format!("Invalid redirect URI: {}", e)))?,
        );

        providers.insert(
            MailProvider::Gmail,
            OAuth2Provider {
                client: gmail_client,
                scopes: vec![
                    "https://www.googleapis.com/auth/gmail.readonly".to_string(),
                    "https://www.googleapis.com/auth/gmail.send".to_string(),
                    "https://www.googleapis.com/auth/gmail.modify".to_string(),
                    "https://www.googleapis.com/auth/gmail.compose".to_string(),
                ],
                provider_type: MailProvider::Gmail,
            },
        );

        // Setup Microsoft Graph OAuth2 client
        let outlook_client = BasicClient::new(
            ClientId::new(config.microsoft_client_id.clone()),
            Some(ClientSecret::new(config.microsoft_client_secret.clone())),
            AuthUrl::new("https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string())
                .map_err(|e| crate::mail::error::MailError::other(format!("Invalid Outlook auth URL: {}", e)))?,
            Some(
                TokenUrl::new("https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string())
                    .map_err(|e| crate::mail::error::MailError::other(format!("Invalid Outlook token URL: {}", e)))?,
            ),
        )
        .set_redirect_uri(
            RedirectUrl::new(config.redirect_uri.clone())
                .map_err(|e| crate::mail::error::MailError::other(format!("Invalid redirect URI: {}", e)))?,
        );

        providers.insert(
            MailProvider::Outlook,
            OAuth2Provider {
                client: outlook_client,
                scopes: vec![
                    "https://graph.microsoft.com/Mail.ReadWrite".to_string(),
                    "https://graph.microsoft.com/Mail.Send".to_string(),
                    "https://graph.microsoft.com/MailboxSettings.ReadWrite".to_string(),
                ],
                provider_type: MailProvider::Outlook,
            },
        );

        let token_storage = TokenStorage::new().await?;
        let token_manager = TokenManager::new();

        Ok(Self {
            providers,
            token_storage,
            token_manager,
            pending_auth: RwLock::new(HashMap::new()),
        })
    }

    /// Generate OAuth2 authorization URL
    pub async fn get_authorization_url(&self, provider: MailProvider) -> MailResult<AuthorizationUrl> {
        let oauth_provider = self
            .providers
            .get(&provider)
            .ok_or_else(|| crate::mail::error::MailError::not_supported("OAuth2", provider.as_str()))?;

        // Generate PKCE challenge for security
        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let mut auth_request = oauth_provider.client.authorize_url(CsrfToken::new_random);

        // Add scopes
        for scope in &oauth_provider.scopes {
            auth_request = auth_request.add_scope(Scope::new(scope.clone()));
        }

        let (auth_url, csrf_token) = auth_request
            .set_pkce_challenge(pkce_challenge)
            .url();

        // Store pending authentication state
        {
            let mut pending = self.pending_auth.write().await;
            pending.insert(
                csrf_token.secret().clone(),
                (provider, Some(pkce_verifier.secret().clone())),
            );
        }

        Ok(AuthorizationUrl {
            url: auth_url.to_string(),
            state: csrf_token.secret().clone(),
            pkce_verifier: Some(pkce_verifier.secret().clone()),
            provider,
        })
    }

    /// Handle OAuth2 callback and exchange code for tokens
    pub async fn handle_callback(
        &self,
        code: &str,
        state: &str,
        account_id: Uuid,
    ) -> MailResult<AuthCredentials> {
        // Retrieve and remove pending authentication
        let (provider, pkce_verifier) = {
            let mut pending = self.pending_auth.write().await;
            pending.remove(state).ok_or_else(|| {
                crate::mail::error::MailError::authentication("Invalid or expired state parameter")
            })?
        };

        let oauth_provider = self
            .providers
            .get(&provider)
            .ok_or_else(|| crate::mail::error::MailError::not_supported("OAuth2", provider.as_str()))?;

        // Exchange authorization code for access token
        let mut token_request = oauth_provider
            .client
            .exchange_code(AuthorizationCode::new(code.to_string()));

        if let Some(verifier) = pkce_verifier {
            token_request = token_request.set_pkce_verifier(oauth2::PkceCodeVerifier::new(verifier));
        }

        let token_response = token_request
            .request_async(async_http_client)
            .await
            .map_err(|e| crate::mail::error::MailError::authentication(format!("Token exchange failed: {}", e)))?;

        // Create credentials
        let now = Utc::now();
        let expires_at = token_response
            .expires_in()
            .map(|duration| now + chrono::Duration::seconds(duration.as_secs() as i64));

        let credentials = AuthCredentials {
            access_token: token_response.access_token().secret().clone(),
            refresh_token: token_response.refresh_token().map(|t| t.secret().clone()),
            token_type: token_response.token_type().as_ref().to_string(),
            expires_at,
            scopes: oauth_provider.scopes.clone(),
            provider,
            account_id,
            created_at: now,
            updated_at: now,
        };

        // Store credentials securely
        self.token_storage.store_credentials(&credentials).await?;

        tracing::info!(
            "Successfully authenticated account {} with provider {}",
            account_id,
            provider.as_str()
        );

        Ok(credentials)
    }

    /// Get stored credentials for an account
    pub async fn get_credentials(&self, account_id: Uuid) -> MailResult<Option<AuthCredentials>> {
        self.token_storage.get_credentials(account_id).await
    }

    /// Get valid access token for an account (refreshing if necessary)
    pub async fn get_valid_token(&self, account_id: Uuid) -> MailResult<String> {
        let mut credentials = self
            .token_storage
            .get_credentials(account_id)
            .await?
            .ok_or_else(|| crate::mail::error::MailError::authentication("No credentials found for account"))?;

        // Check if token needs refresh
        if let Some(expires_at) = credentials.expires_at {
            if Utc::now() + chrono::Duration::minutes(5) >= expires_at {
                // Token expires in 5 minutes or less, refresh it
                credentials = self.refresh_token(account_id).await?;
            }
        }

        Ok(credentials.access_token)
    }

    /// Refresh access token using refresh token
    pub async fn refresh_token(&self, account_id: Uuid) -> MailResult<AuthCredentials> {
        let mut credentials = self
            .token_storage
            .get_credentials(account_id)
            .await?
            .ok_or_else(|| crate::mail::error::MailError::authentication("No credentials found for account"))?;

        let refresh_token = credentials
            .refresh_token
            .as_ref()
            .ok_or_else(|| crate::mail::error::MailError::authentication("No refresh token available"))?;

        let oauth_provider = self
            .providers
            .get(&credentials.provider)
            .ok_or_else(|| {
                crate::mail::error::MailError::not_supported("OAuth2", credentials.provider.as_str())
            })?;

        // Use refresh token to get new access token
        let token_response = oauth_provider
            .client
            .exchange_refresh_token(&RefreshToken::new(refresh_token.clone()))
            .request_async(async_http_client)
            .await
            .map_err(|e| {
                tracing::error!("Token refresh failed: {}", e);
                crate::mail::error::MailError::authorization("Token refresh failed - re-authentication required")
            })?;

        // Update credentials
        let now = Utc::now();
        credentials.access_token = token_response.access_token().secret().clone();
        credentials.expires_at = token_response
            .expires_in()
            .map(|duration| now + chrono::Duration::seconds(duration.as_secs() as i64));
        credentials.updated_at = now;

        // Update refresh token if provided
        if let Some(new_refresh_token) = token_response.refresh_token() {
            credentials.refresh_token = Some(new_refresh_token.secret().clone());
        }

        // Store updated credentials
        self.token_storage.store_credentials(&credentials).await?;

        tracing::info!("Successfully refreshed token for account {}", account_id);

        Ok(credentials)
    }

    /// Revoke stored credentials
    pub async fn revoke_credentials(&self, account_id: Uuid) -> MailResult<()> {
        if let Some(credentials) = self.token_storage.get_credentials(account_id).await? {
            // Revoke token at provider (best effort)
            if let Err(e) = self.revoke_token_at_provider(&credentials).await {
                tracing::warn!("Failed to revoke token at provider: {}", e);
            }
        }

        // Remove from local storage
        self.token_storage.remove_credentials(account_id).await?;

        tracing::info!("Revoked credentials for account {}", account_id);
        Ok(())
    }

    /// Check if credentials are valid and not expired
    pub async fn are_credentials_valid(&self, account_id: Uuid) -> MailResult<bool> {
        let credentials = match self.token_storage.get_credentials(account_id).await? {
            Some(creds) => creds,
            None => return Ok(false),
        };

        // Check expiration
        if let Some(expires_at) = credentials.expires_at {
            if Utc::now() >= expires_at {
                // Try to refresh if we have a refresh token
                if credentials.refresh_token.is_some() {
                    return match self.refresh_token(account_id).await {
                        Ok(_) => Ok(true),
                        Err(_) => Ok(false),
                    };
                } else {
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }

    /// Get supported OAuth2 providers
    pub fn get_supported_providers(&self) -> Vec<MailProvider> {
        self.providers.keys().cloned().collect()
    }

    /// Revoke token at the OAuth2 provider
    async fn revoke_token_at_provider(&self, credentials: &AuthCredentials) -> MailResult<()> {
        match credentials.provider {
            MailProvider::Gmail => {
                let revoke_url = format!(
                    "https://oauth2.googleapis.com/revoke?token={}",
                    credentials.access_token
                );
                
                let client = reqwest::Client::new();
                let response = client.post(&revoke_url).send().await?;
                
                if !response.status().is_success() {
                    return Err(crate::mail::error::MailError::provider_api(
                        "Gmail",
                        "Failed to revoke token",
                        response.status().to_string(),
                    ));
                }
            }
            MailProvider::Outlook => {
                // Microsoft doesn't have a revoke endpoint, tokens expire automatically
                tracing::debug!("Microsoft tokens cannot be explicitly revoked");
            }
            _ => {
                return Err(crate::mail::error::MailError::not_supported(
                    "Token revocation",
                    credentials.provider.as_str(),
                ));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mail::config::AuthConfig;

    #[tokio::test]
    async fn test_auth_manager_creation() {
        let config = AuthConfig {
            google_client_id: "test_google_client".to_string(),
            google_client_secret: "test_google_secret".to_string(),
            microsoft_client_id: "test_microsoft_client".to_string(),
            microsoft_client_secret: "test_microsoft_secret".to_string(),
            redirect_uri: "http://localhost:8080/callback".to_string(),
        };

        let auth_manager = AuthManager::new(&config).await.unwrap();
        let providers = auth_manager.get_supported_providers();
        
        assert!(providers.contains(&MailProvider::Gmail));
        assert!(providers.contains(&MailProvider::Outlook));
    }

    #[tokio::test]
    async fn test_authorization_url_generation() {
        let config = AuthConfig {
            google_client_id: "test_google_client".to_string(),
            google_client_secret: "test_google_secret".to_string(),
            microsoft_client_id: "test_microsoft_client".to_string(),
            microsoft_client_secret: "test_microsoft_secret".to_string(),
            redirect_uri: "http://localhost:8080/callback".to_string(),
        };

        let auth_manager = AuthManager::new(&config).await.unwrap();
        let auth_url = auth_manager
            .get_authorization_url(MailProvider::Gmail)
            .await
            .unwrap();

        assert!(auth_url.url.contains("accounts.google.com"));
        assert!(!auth_url.state.is_empty());
        assert!(auth_url.pkce_verifier.is_some());
    }
}