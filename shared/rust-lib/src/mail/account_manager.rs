use crate::mail::{
    server_configs::{get_predefined_configs, get_config_by_domain, ServerConfig, AuthMethod},
    error::{MailError, MailResult},
    types::*,
    auth::AuthManager,
    providers::imap::ImapProvider,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MailAccountConfig {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub server_config: ServerConfig,
    pub auth_config: AccountAuthConfig,
    pub sync_settings: AccountSyncSettings,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub is_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccountAuthConfig {
    Password {
        username: String,
        password: String,
    },
    AppPassword {
        username: String,
        app_password: String,
    },
    OAuth2 {
        access_token: String,
        refresh_token: String,
        expires_at: chrono::DateTime<chrono::Utc>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSyncSettings {
    pub sync_enabled: bool,
    pub sync_interval_minutes: u32,
    pub folders_to_sync: Vec<String>, // Empty = all folders
    pub max_messages_per_sync: u32,
    pub download_attachments: bool,
    pub mark_as_read_on_other_devices: bool,
}

impl Default for AccountSyncSettings {
    fn default() -> Self {
        Self {
            sync_enabled: true,
            sync_interval_minutes: 5,
            folders_to_sync: vec![], // Sync all folders by default
            max_messages_per_sync: 100,
            download_attachments: false,
            mark_as_read_on_other_devices: true,
        }
    }
}

pub struct AccountManager {
    accounts: RwLock<HashMap<String, MailAccountConfig>>,
    providers: RwLock<HashMap<String, Box<dyn MailProvider>>>,
    auth_manager: Arc<AuthManager>,
}

impl AccountManager {
    pub fn new(auth_manager: Arc<AuthManager>) -> Self {
        Self {
            accounts: RwLock::new(HashMap::new()),
            providers: RwLock::new(HashMap::new()),
            auth_manager,
        }
    }

    /// Add account with auto-detected server configuration
    pub async fn add_account_auto(
        &self,
        email: String,
        password: String,
        display_name: Option<String>,
    ) -> MailResult<String> {
        // Auto-detect server configuration based on email domain
        let server_config = get_config_by_domain(&email)
            .ok_or_else(|| MailError::UnsupportedProvider(format!("No configuration found for domain in: {}", email)))?;

        let account_id = Uuid::new_v4().to_string();
        let auth_config = AccountAuthConfig::Password {
            username: email.clone(),
            password,
        };

        let account = MailAccountConfig {
            id: account_id.clone(),
            email: email.clone(),
            display_name: display_name.unwrap_or_else(|| email.clone()),
            server_config,
            auth_config,
            sync_settings: AccountSyncSettings::default(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            is_enabled: true,
        };

        // Test connection before adding
        self.test_account_connection(&account).await?;

        // Add account
        let mut accounts = self.accounts.write().await;
        accounts.insert(account_id.clone(), account);

        info!("Added mail account: {} ({})", email, account_id);
        Ok(account_id)
    }

    /// Add account with custom server configuration
    pub async fn add_account_custom(
        &self,
        email: String,
        display_name: String,
        server_config: ServerConfig,
        auth_config: AccountAuthConfig,
    ) -> MailResult<String> {
        let account_id = Uuid::new_v4().to_string();

        let account = MailAccountConfig {
            id: account_id.clone(),
            email: email.clone(),
            display_name,
            server_config,
            auth_config,
            sync_settings: AccountSyncSettings::default(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            is_enabled: true,
        };

        // Test connection before adding
        self.test_account_connection(&account).await?;

        // Add account
        let mut accounts = self.accounts.write().await;
        accounts.insert(account_id.clone(), account);

        info!("Added custom mail account: {} ({})", email, account_id);
        Ok(account_id)
    }

    /// Add Gmail account with OAuth2
    pub async fn add_gmail_oauth(
        &self,
        email: String,
        access_token: String,
        refresh_token: String,
        expires_at: chrono::DateTime<chrono::Utc>,
    ) -> MailResult<String> {
        let mut gmail_config = get_predefined_configs().get("gmail")
            .ok_or_else(|| MailError::ConfigurationError("Gmail config not found".to_string()))?
            .clone();

        let account_id = Uuid::new_v4().to_string();
        let auth_config = AccountAuthConfig::OAuth2 {
            access_token,
            refresh_token,
            expires_at,
        };

        let account = MailAccountConfig {
            id: account_id.clone(),
            email: email.clone(),
            display_name: email.clone(),
            server_config: gmail_config,
            auth_config,
            sync_settings: AccountSyncSettings::default(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            is_enabled: true,
        };

        // Test OAuth connection
        self.test_account_connection(&account).await?;

        // Add account
        let mut accounts = self.accounts.write().await;
        accounts.insert(account_id.clone(), account);

        info!("Added Gmail OAuth account: {} ({})", email, account_id);
        Ok(account_id)
    }

    /// Test account connection
    async fn test_account_connection(&self, account: &MailAccountConfig) -> MailResult<()> {
        // Create temporary IMAP provider for testing
        let imap_provider = ImapProvider::new(
            account.server_config.clone(),
            account.auth_config.clone(),
        ).await?;

        // Test connection
        imap_provider.test_connection().await?;
        
        info!("Account connection test successful: {}", account.email);
        Ok(())
    }

    /// Get all accounts
    pub async fn get_accounts(&self) -> Vec<MailAccountConfig> {
        let accounts = self.accounts.read().await;
        accounts.values().cloned().collect()
    }

    /// Get account by ID
    pub async fn get_account(&self, account_id: &str) -> Option<MailAccountConfig> {
        let accounts = self.accounts.read().await;
        accounts.get(account_id).cloned()
    }

    /// Get account by email
    pub async fn get_account_by_email(&self, email: &str) -> Option<MailAccountConfig> {
        let accounts = self.accounts.read().await;
        accounts.values().find(|acc| acc.email == email).cloned()
    }

    /// Remove account
    pub async fn remove_account(&self, account_id: &str) -> MailResult<()> {
        let mut accounts = self.accounts.write().await;
        let mut providers = self.providers.write().await;

        if accounts.remove(account_id).is_some() {
            providers.remove(account_id);
            info!("Removed mail account: {}", account_id);
            Ok(())
        } else {
            Err(MailError::AccountNotFound(account_id.to_string()))
        }
    }

    /// Update account settings
    pub async fn update_account_settings(
        &self,
        account_id: &str,
        sync_settings: AccountSyncSettings,
    ) -> MailResult<()> {
        let mut accounts = self.accounts.write().await;
        
        if let Some(account) = accounts.get_mut(account_id) {
            account.sync_settings = sync_settings;
            account.updated_at = chrono::Utc::now();
            info!("Updated account settings: {}", account_id);
            Ok(())
        } else {
            Err(MailError::AccountNotFound(account_id.to_string()))
        }
    }

    /// Enable/disable account
    pub async fn set_account_enabled(&self, account_id: &str, enabled: bool) -> MailResult<()> {
        let mut accounts = self.accounts.write().await;
        
        if let Some(account) = accounts.get_mut(account_id) {
            account.is_enabled = enabled;
            account.updated_at = chrono::Utc::now();
            info!("Set account {} enabled: {}", account_id, enabled);
            Ok(())
        } else {
            Err(MailError::AccountNotFound(account_id.to_string()))
        }
    }

    /// Get available server configurations
    pub fn get_available_configs(&self) -> HashMap<String, ServerConfig> {
        get_predefined_configs()
    }

    /// Refresh OAuth token for account
    pub async fn refresh_oauth_token(&self, account_id: &str) -> MailResult<()> {
        let mut accounts = self.accounts.write().await;
        
        if let Some(account) = accounts.get_mut(account_id) {
            match &account.auth_config {
                AccountAuthConfig::OAuth2 { refresh_token, .. } => {
                    // Use AuthManager to refresh token
                    let new_tokens = self.auth_manager.refresh_token(&account.server_config.name, refresh_token).await?;
                    
                    account.auth_config = AccountAuthConfig::OAuth2 {
                        access_token: new_tokens.access_token,
                        refresh_token: new_tokens.refresh_token.unwrap_or_else(|| refresh_token.clone()),
                        expires_at: chrono::Utc::now() + chrono::Duration::seconds(new_tokens.expires_in as i64),
                    };
                    account.updated_at = chrono::Utc::now();
                    
                    info!("Refreshed OAuth token for account: {}", account_id);
                    Ok(())
                }
                _ => Err(MailError::AuthenticationError("Account does not use OAuth2".to_string())),
            }
        } else {
            Err(MailError::AccountNotFound(account_id.to_string()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mail::auth::AuthConfig;

    #[tokio::test]
    async fn test_account_manager() {
        let auth_config = AuthConfig {
            google_client_id: "test".to_string(),
            google_client_secret: "test".to_string(),
            microsoft_client_id: "test".to_string(),
            microsoft_client_secret: "test".to_string(),
            redirect_uri: "http://localhost:8080".to_string(),
        };
        
        let auth_manager = Arc::new(AuthManager::new(&auth_config).await.unwrap());
        let account_manager = AccountManager::new(auth_manager);

        // Test getting available configs
        let configs = account_manager.get_available_configs();
        assert!(configs.contains_key("gmail"));
        assert!(configs.contains_key("outlook"));
        assert!(configs.contains_key("yahoo"));
    }
}