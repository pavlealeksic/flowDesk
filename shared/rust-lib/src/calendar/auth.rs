/*!
 * Calendar Authentication
 * 
 * OAuth2 and authentication helpers for calendar providers.
 */

use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl,
    Scope, TokenUrl, basic::BasicClient, reqwest::async_http_client,
    AuthorizationCode, TokenResponse, RefreshToken
};
use serde::{Deserialize, Serialize};
use crate::calendar::{CalendarResult, CalendarError, CalendarProvider};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthCredentials {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub token_type: String,
    pub scope: Vec<String>,
    pub provider: CalendarProvider,
    pub account_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// OAuth2 manager for calendar providers
pub struct CalendarOAuthManager {
    clients: HashMap<String, BasicClient>,
    pkce_verifiers: Arc<RwLock<HashMap<String, String>>>,
}

impl CalendarOAuthManager {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
            pkce_verifiers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn register_oauth_client(
        &mut self,
        provider: CalendarProvider,
        client_id: String,
        client_secret: String,
    ) -> CalendarResult<()> {
        let (auth_url, token_url) = match provider {
            CalendarProvider::Google => (
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
            ),
            CalendarProvider::Outlook => (
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            ),
            CalendarProvider::Exchange => (
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            ),
            CalendarProvider::CalDAV | CalendarProvider::CalDav | CalendarProvider::ICloud | CalendarProvider::Fastmail => {
                return Err(CalendarError::ConfigurationError {
                    message: format!("{:?} does not support OAuth2", provider),
                    config_field: Some("provider".to_string()),
                    config_value: Some(format!("{:?}", provider)),
                });
            }
        };

        let client = BasicClient::new(
            ClientId::new(client_id),
            Some(ClientSecret::new(client_secret)),
            AuthUrl::new(auth_url.to_string()).map_err(|e| CalendarError::InternalError {
                message: format!("Invalid auth URL: {}", e),
                operation: Some("register_oauth_client".to_string()),
                context: None,
            })?,
            Some(TokenUrl::new(token_url.to_string()).map_err(|e| CalendarError::InternalError {
                message: format!("Invalid token URL: {}", e),
                operation: Some("register_oauth_client".to_string()),
                context: None,
            })?)
        );

        let provider_key = format!("{:?}", provider);
        self.clients.insert(provider_key, client);
        
        Ok(())
    }

    pub async fn get_authorization_url(
        &self,
        provider: CalendarProvider,
        client_id: &str,
        redirect_uri: &str,
    ) -> CalendarResult<String> {
        let provider_key = format!("{:?}", provider);
        
        let client = self.clients.get(&provider_key)
            .ok_or_else(|| CalendarError::InternalError {
                message: "OAuth client not registered for provider".to_string(),
                operation: Some("get_authorization_url".to_string()),
                context: None,
            })?;

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
        let state = CsrfToken::new_random();

        let scopes = match provider {
            CalendarProvider::Google => vec![
                Scope::new("https://www.googleapis.com/auth/calendar".to_string()),
                Scope::new("https://www.googleapis.com/auth/calendar.readonly".to_string()),
            ],
            CalendarProvider::Outlook | CalendarProvider::Exchange => vec![
                Scope::new("https://graph.microsoft.com/Calendars.ReadWrite".to_string()),
                Scope::new("https://graph.microsoft.com/Calendars.Read".to_string()),
            ],
            CalendarProvider::CalDAV | CalendarProvider::CalDav | CalendarProvider::ICloud | CalendarProvider::Fastmail => {
                return Err(CalendarError::ConfigurationError {
                    message: format!("{:?} does not support OAuth2", provider),
                    config_field: Some("provider".to_string()),
                    config_value: Some(format!("{:?}", provider)),
                });
            }
        };

        let (auth_url, csrf_token) = client
            .authorize_url(|| state.clone())
            .add_scopes(scopes)
            .set_pkce_challenge(pkce_challenge)
            .set_redirect_uri(std::borrow::Cow::Owned(
                RedirectUrl::new(redirect_uri.to_string()).map_err(|e| CalendarError::InternalError {
                    message: format!("Invalid redirect URI: {}", e),
                    operation: Some("get_authorization_url".to_string()),
                    context: None,
                })?
            ))
            .url();

        // Store PKCE verifier for later use
        {
            let mut verifiers = self.pkce_verifiers.write().await;
            verifiers.insert(csrf_token.secret().clone(), pkce_verifier.secret().clone());
        }

        Ok(auth_url.to_string())
    }

    pub async fn handle_callback(
        &self,
        code: &str,
        state: &str,
        provider: CalendarProvider,
        redirect_uri: &str,
        account_id: &str,
    ) -> CalendarResult<OAuthCredentials> {
        let provider_key = format!("{:?}", provider);
        let client = self.clients.get(&provider_key)
            .ok_or_else(|| CalendarError::InternalError {
                message: "OAuth client not registered for provider".to_string(),
                operation: Some("handle_callback".to_string()),
                context: None,
            })?;

        // Get PKCE verifier for this state
        let pkce_verifier = {
            let mut verifiers = self.pkce_verifiers.write().await;
            verifiers.remove(state)
                .ok_or_else(|| CalendarError::InternalError {
                    message: "Invalid state or expired PKCE verifier".to_string(),
                    operation: Some("handle_callback".to_string()),
                    context: None,
                })?
        };

        let token_result = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .set_pkce_verifier(oauth2::PkceCodeVerifier::new(pkce_verifier))
            .set_redirect_uri(std::borrow::Cow::Owned(
                RedirectUrl::new(redirect_uri.to_string()).map_err(|e| CalendarError::InternalError {
                    message: format!("Invalid redirect URI: {}", e),
                    operation: Some("handle_callback".to_string()),
                    context: None,
                })?
            ))
            .request_async(async_http_client)
            .await
            .map_err(|e| CalendarError::InternalError {
                message: format!("OAuth token exchange failed: {}", e),
                operation: Some("handle_callback".to_string()),
                context: None,
            })?;

        let access_token = token_result.access_token().secret().clone();
        let refresh_token = token_result.refresh_token().map(|t| t.secret().clone());
        let expires_at = token_result.expires_in().map(|duration| {
            chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64)
        });

        let scopes = match provider {
            CalendarProvider::Google => vec![
                "https://www.googleapis.com/auth/calendar".to_string(),
                "https://www.googleapis.com/auth/calendar.readonly".to_string(),
            ],
            CalendarProvider::Outlook | CalendarProvider::Exchange => vec![
                "https://graph.microsoft.com/Calendars.ReadWrite".to_string(),
                "https://graph.microsoft.com/Calendars.Read".to_string(),
            ],
            CalendarProvider::CalDAV | CalendarProvider::CalDav | CalendarProvider::ICloud | CalendarProvider::Fastmail => vec![],
        };

        Ok(OAuthCredentials {
            access_token,
            refresh_token,
            expires_at,
            token_type: "Bearer".to_string(),
            scope: scopes,
            provider,
            account_id: account_id.to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    pub async fn refresh_access_token(
        &self,
        provider: CalendarProvider,
        refresh_token: &str,
        account_id: &str,
    ) -> CalendarResult<OAuthCredentials> {
        let provider_key = format!("{:?}", provider);
        
        let client = self.clients.get(&provider_key)
            .ok_or_else(|| CalendarError::InternalError {
                message: "OAuth client not registered for provider".to_string(),
                operation: Some("refresh_access_token".to_string()),
                context: None,
            })?;

        let token_result = client
            .exchange_refresh_token(&RefreshToken::new(refresh_token.to_string()))
            .request_async(async_http_client)
            .await
            .map_err(|e| CalendarError::InternalError {
                message: format!("Token refresh failed: {}", e),
                operation: Some("refresh_access_token".to_string()),
                context: None,
            })?;

        let access_token = token_result.access_token().secret().clone();
        let new_refresh_token = token_result.refresh_token()
            .map(|t| t.secret().clone())
            .unwrap_or_else(|| refresh_token.to_string()); // Keep old refresh token if not provided
        let expires_at = token_result.expires_in().map(|duration| {
            chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64)
        });

        let scopes = match provider {
            CalendarProvider::Google => vec![
                "https://www.googleapis.com/auth/calendar".to_string(),
                "https://www.googleapis.com/auth/calendar.readonly".to_string(),
            ],
            CalendarProvider::Outlook | CalendarProvider::Exchange => vec![
                "https://graph.microsoft.com/Calendars.ReadWrite".to_string(),
                "https://graph.microsoft.com/Calendars.Read".to_string(),
            ],
            CalendarProvider::CalDAV | CalendarProvider::CalDav | CalendarProvider::ICloud | CalendarProvider::Fastmail => vec![],
        };

        Ok(OAuthCredentials {
            access_token,
            refresh_token: Some(new_refresh_token),
            expires_at,
            token_type: "Bearer".to_string(),
            scope: scopes,
            provider,
            account_id: account_id.to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        })
    }

    pub fn is_token_expired(&self, credentials: &OAuthCredentials) -> bool {
        if let Some(expires_at) = credentials.expires_at {
            chrono::Utc::now() >= expires_at
        } else {
            false // If no expiration time, assume token is still valid
        }
    }

    pub async fn revoke_token(&self, provider: CalendarProvider, token: &str) -> CalendarResult<()> {
        let client = reqwest::Client::new();
        
        let revoke_url = match provider {
            CalendarProvider::Google => "https://oauth2.googleapis.com/revoke",
            CalendarProvider::Outlook | CalendarProvider::Exchange => {
                // Microsoft doesn't have a direct token revocation endpoint
                // The token becomes invalid when the user removes app permissions
                return Ok(());
            },
            CalendarProvider::CalDAV | CalendarProvider::CalDav | CalendarProvider::ICloud | CalendarProvider::Fastmail => {
                return Err(CalendarError::ConfigurationError {
                    message: format!("{:?} does not support OAuth2 token revocation", provider),
                    config_field: Some("provider".to_string()),
                    config_value: Some(format!("{:?}", provider)),
                });
            }
        };

        let response = client
            .post(revoke_url)
            .form(&[("token", token)])
            .send()
            .await
            .map_err(|e| CalendarError::InternalError {
                message: format!("Token revocation request failed: {}", e),
                operation: Some("revoke_token".to_string()),
                context: None,
            })?;

        if !response.status().is_success() {
            return Err(CalendarError::InternalError {
                message: format!("Token revocation failed: {}", response.status()),
                operation: Some("revoke_token".to_string()),
                context: None,
            });
        }

        tracing::info!("Successfully revoked OAuth2 token for {:?}", provider);
        Ok(())
    }
}

/// Deprecated - kept for backwards compatibility
pub struct OAuthManager;

impl OAuthManager {
    pub async fn exchange_code(
        _authorization_code: &str,
        _redirect_uri: &str,
        _client_id: &str,
        _client_secret: &str,
    ) -> CalendarResult<OAuthCredentials> {
        Err(CalendarError::InternalError {
            message: "Use CalendarOAuthManager instead".to_string(),
            operation: Some("exchange_code".to_string()),
            context: None,
        })
    }

    pub async fn refresh_token(
        _refresh_token: &str,
        _client_id: &str,
        _client_secret: &str,
    ) -> CalendarResult<OAuthCredentials> {
        Err(CalendarError::InternalError {
            message: "Use CalendarOAuthManager instead".to_string(),
            operation: Some("refresh_token".to_string()),
            context: None,
        })
    }
}