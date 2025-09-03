use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl,
    Scope, TokenUrl, basic::BasicClient, reqwest::async_http_client,
    AuthorizationCode, TokenResponse, RefreshToken
};
use crate::mail::{types::MailProvider, OAuthTokens};
use super::AuthCredentials;
use std::collections::HashMap;
use std::sync::Arc;
use super::token_storage::TokenStorage;
use tokio::sync::RwLock;

pub struct AuthManager {
    clients: HashMap<String, BasicClient>,
    token_storage: Arc<TokenStorage>,
    pkce_verifiers: Arc<RwLock<HashMap<String, String>>>,
}

impl AuthManager {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let token_storage = Arc::new(TokenStorage::new().await?);
        Ok(Self {
            clients: HashMap::new(),
            token_storage,
            pkce_verifiers: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub async fn with_storage_file<P: AsRef<std::path::Path>>(
        storage_path: P,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let token_storage = Arc::new(TokenStorage::with_file(storage_path, None).await?);
        Ok(Self {
            clients: HashMap::new(),
            token_storage,
            pkce_verifiers: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    pub fn register_oauth_client(
        &mut self,
        provider: MailProvider,
        client_id: String,
        client_secret: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (auth_url, token_url, scopes) = match &provider {
            MailProvider::Gmail => (
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
                vec![
                    "https://www.googleapis.com/auth/gmail.readonly",
                    "https://www.googleapis.com/auth/gmail.send",
                    "https://www.googleapis.com/auth/gmail.modify"
                ]
            ),
            MailProvider::Outlook => (
                "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                vec![
                    "https://graph.microsoft.com/Mail.Read",
                    "https://graph.microsoft.com/Mail.Send",
                    "https://graph.microsoft.com/Mail.ReadWrite"
                ]
            ),
            _ => return Err("Unsupported OAuth provider".into()),
        };

        let client = BasicClient::new(
            ClientId::new(client_id),
            Some(ClientSecret::new(client_secret)),
            AuthUrl::new(auth_url.to_string())?,
            Some(TokenUrl::new(token_url.to_string())?)
        );

        let provider_key = format!("{:?}", provider);
        self.clients.insert(provider_key, client);
        
        Ok(())
    }

    pub async fn get_oauth_url(
        &self,
        provider: MailProvider,
        client_id: &str,
        redirect_uri: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let provider_key = format!("{:?}", provider);
        
        let client = self.clients.get(&provider_key)
            .ok_or("OAuth client not registered for provider")?;

        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
        let state = CsrfToken::new_random();

        let scopes = match &provider {
            MailProvider::Gmail => vec![
                Scope::new("https://www.googleapis.com/auth/gmail.readonly".to_string()),
                Scope::new("https://www.googleapis.com/auth/gmail.send".to_string()),
                Scope::new("https://www.googleapis.com/auth/gmail.modify".to_string()),
            ],
            MailProvider::Outlook => vec![
                Scope::new("https://graph.microsoft.com/Mail.Read".to_string()),
                Scope::new("https://graph.microsoft.com/Mail.Send".to_string()),
                Scope::new("https://graph.microsoft.com/Mail.ReadWrite".to_string()),
            ],
            _ => return Err("Unsupported provider".into()),
        };

        let (auth_url, csrf_token) = client
            .authorize_url(|| state.clone())
            .add_scopes(scopes)
            .set_pkce_challenge(pkce_challenge)
            .set_redirect_uri(std::borrow::Cow::Owned(RedirectUrl::new(redirect_uri.to_string())?))
            .url();

        // Store PKCE verifier for later use
        {
            let mut verifiers = self.pkce_verifiers.write().await;
            verifiers.insert(csrf_token.secret().clone(), pkce_verifier.secret().clone());
        }

        Ok(auth_url.to_string())
    }

    pub async fn exchange_oauth_code(
        &self,
        provider: MailProvider,
        code: &str,
        client_id: &str,
        client_secret: &str,
        redirect_uri: &str,
    ) -> Result<OAuthTokens, Box<dyn std::error::Error + Send + Sync>> {
        let provider_key = format!("{:?}", provider);
        
        let client = self.clients.get(&provider_key)
            .ok_or("OAuth client not registered for provider")?;

        let token_result = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .set_redirect_uri(std::borrow::Cow::Owned(RedirectUrl::new(redirect_uri.to_string())?))
            .request_async(async_http_client)
            .await?;

        let access_token = token_result.access_token().secret().clone();
        let refresh_token = token_result.refresh_token().map(|t| t.secret().clone());
        let expires_at = token_result.expires_in().map(|duration| {
            chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64)
        });

        Ok(OAuthTokens {
            access_token,
            refresh_token,
            expires_at,
        })
    }

    pub async fn refresh_access_token(
        &self,
        provider: MailProvider,
        refresh_token: &str,
    ) -> Result<OAuthTokens, Box<dyn std::error::Error + Send + Sync>> {
        let provider_key = format!("{:?}", provider);
        
        let client = self.clients.get(&provider_key)
            .ok_or("OAuth client not registered for provider")?;

        let token_result = client
            .exchange_refresh_token(&RefreshToken::new(refresh_token.to_string()))
            .request_async(async_http_client)
            .await?;

        let access_token = token_result.access_token().secret().clone();
        let new_refresh_token = token_result.refresh_token()
            .map(|t| t.secret().clone())
            .unwrap_or_else(|| refresh_token.to_string()); // Keep old refresh token if not provided
        let expires_at = token_result.expires_in().map(|duration| {
            chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64)
        });

        Ok(OAuthTokens {
            access_token,
            refresh_token: Some(new_refresh_token),
            expires_at,
        })
    }

    pub fn is_token_expired(&self, tokens: &OAuthTokens) -> bool {
        if let Some(expires_at) = tokens.expires_at {
            chrono::Utc::now() >= expires_at
        } else {
            false // If no expiration time, assume token is still valid
        }
    }

    pub async fn get_credentials(&self, account_id: uuid::Uuid) -> Result<Option<crate::mail::auth::AuthCredentials>, Box<dyn std::error::Error + Send + Sync>> {
        self.token_storage.get_credentials(account_id).await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }

    pub async fn revoke_credentials(&self, account_id: uuid::Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Get credentials to check provider and get tokens
        if let Some(credentials) = self.get_credentials(account_id).await? {
            // Revoke tokens with provider
            match credentials.provider {
                MailProvider::Gmail => {
                    self.revoke_google_token(&credentials.access_token).await?;
                }
                MailProvider::Outlook => {
                    self.revoke_microsoft_token(&credentials.access_token).await?;
                }
                _ => {
                    // For other providers, just remove from local storage
                }
            }
        }
        
        // Remove from local storage
        self.token_storage.remove_credentials(account_id).await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }

    pub async fn get_authorization_url(&self, provider: MailProvider, client_id: &str, redirect_uri: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        self.get_oauth_url(provider, client_id, redirect_uri).await
    }

    pub async fn handle_callback(&self, code: &str, state: &str, provider: MailProvider, redirect_uri: &str) -> Result<OAuthTokens, Box<dyn std::error::Error + Send + Sync>> {
        let provider_key = format!("{:?}", provider);
        let client = self.clients.get(&provider_key)
            .ok_or("OAuth client not registered for provider")?;

        // Get PKCE verifier for this state
        let pkce_verifier = {
            let mut verifiers = self.pkce_verifiers.write().await;
            verifiers.remove(state)
                .ok_or("Invalid state or expired PKCE verifier")?
        };

        let token_result = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .set_pkce_verifier(oauth2::PkceCodeVerifier::new(pkce_verifier))
            .set_redirect_uri(std::borrow::Cow::Owned(RedirectUrl::new(redirect_uri.to_string())?))
            .request_async(async_http_client)
            .await?;

        let access_token = token_result.access_token().secret().clone();
        let refresh_token = token_result.refresh_token().map(|t| t.secret().clone());
        let expires_at = token_result.expires_in().map(|duration| {
            chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64)
        });

        Ok(OAuthTokens {
            access_token,
            refresh_token,
            expires_at,
        })
    }

    pub async fn get_valid_token(&self, account_id: uuid::Uuid) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Get stored credentials for the account
        if let Some(credentials) = self.get_credentials(account_id).await? {
            // Check if token is valid
            if !self.is_token_expired_credentials(&credentials) {
                return Ok(credentials.access_token.clone());
            }
            
            // If token is expired but we have a refresh token, refresh it
            if let Some(ref refresh_token) = credentials.refresh_token {
                let refreshed_tokens = self.refresh_access_token(credentials.provider, refresh_token).await?;
                
                // Update stored credentials with new tokens
                let updated_credentials = AuthCredentials {
                    access_token: refreshed_tokens.access_token.clone(),
                    refresh_token: refreshed_tokens.refresh_token.clone().or(credentials.refresh_token.clone()),
                    expires_at: refreshed_tokens.expires_at,
                    ..credentials
                };
                
                self.token_storage.store_credentials(&updated_credentials).await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                    
                return Ok(refreshed_tokens.access_token);
            }
        }
        
        Err("No valid token available for account".into())
    }

    /// Check if credentials are expired
    fn is_token_expired_credentials(&self, credentials: &AuthCredentials) -> bool {
        if let Some(expires_at) = credentials.expires_at {
            expires_at <= chrono::Utc::now()
        } else {
            false // If no expiration time, assume it's valid
        }
    }

    /// Store OAuth tokens as credentials
    pub async fn store_credentials(&self, account_id: uuid::Uuid, provider: MailProvider, tokens: &OAuthTokens, scopes: Vec<String>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let credentials = AuthCredentials {
            access_token: tokens.access_token.clone(),
            refresh_token: tokens.refresh_token.clone(),
            token_type: "Bearer".to_string(),
            expires_at: tokens.expires_at,
            scopes,
            provider,
            account_id,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        
        self.token_storage.store_credentials(&credentials).await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }

    /// Revoke Google OAuth2 token
    async fn revoke_google_token(&self, token: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let response = client
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", token)])
            .send()
            .await?;
            
        if !response.status().is_success() {
            return Err(format!("Failed to revoke Google token: {}", response.status()).into());
        }
        
        tracing::info!("Successfully revoked Google OAuth2 token");
        Ok(())
    }

    /// Revoke Microsoft OAuth2 token
    async fn revoke_microsoft_token(&self, token: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::new();
        let response = client
            .post("https://login.microsoftonline.com/common/oauth2/v2.0/logout")
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;
            
        if !response.status().is_success() {
            tracing::warn!("Failed to revoke Microsoft token: {}", response.status());
        } else {
            tracing::info!("Successfully revoked Microsoft OAuth2 token");
        }
        
        Ok(())
    }

    /// List all accounts with stored credentials
    pub async fn list_credential_accounts(&self) -> Vec<uuid::Uuid> {
        self.token_storage.list_accounts().await
    }

    /// Clear all stored credentials
    pub async fn clear_all_credentials(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.token_storage.clear_all().await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
    }
}