use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge, RedirectUrl,
    Scope, TokenUrl, basic::BasicClient, reqwest::async_http_client,
    AuthorizationCode, TokenResponse, RefreshToken, AccessToken
};
use crate::mail::{MailProvider, OAuthTokens};
use std::collections::HashMap;

pub struct AuthManager {
    clients: HashMap<String, BasicClient>,
}

impl AuthManager {
    pub fn new() -> Self {
        Self {
            clients: HashMap::new(),
        }
    }

    pub fn register_oauth_client(
        &mut self,
        provider: &MailProvider,
        client_id: String,
        client_secret: String,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (auth_url, token_url, scopes) = match provider {
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

    pub fn get_oauth_url(
        &self,
        provider: &MailProvider,
        client_id: &str,
        redirect_uri: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let provider_key = format!("{:?}", provider);
        
        let client = self.clients.get(&provider_key)
            .ok_or("OAuth client not registered for provider")?;

        let (pkce_challenge, _pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let scopes = match provider {
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

        let (auth_url, _csrf_token) = client
            .authorize_url(CsrfToken::new_random)
            .add_scopes(scopes)
            .set_pkce_challenge(pkce_challenge)
            .set_redirect_uri(std::borrow::Cow::Owned(RedirectUrl::new(redirect_uri.to_string())?))
            .url();

        Ok(auth_url.to_string())
    }

    pub async fn exchange_oauth_code(
        &self,
        provider: &MailProvider,
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
        provider: &MailProvider,
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
}