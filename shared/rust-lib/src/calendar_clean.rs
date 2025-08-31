//! Clean Calendar Engine for Flow Desk
//!
//! CalDAV-based calendar engine with predefined server configurations

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Calendar account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarAccount {
    pub id: String,
    pub email: String,
    pub provider: String,
    pub display_name: String,
    pub is_enabled: bool,
    pub server_config: CalDAVConfig,
    pub auth_config: CalendarAuthConfig,
}

/// CalDAV server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalDAVConfig {
    pub host: String,
    pub port: u16,
    pub use_ssl: bool,
    pub base_path: String,
}

/// Calendar authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CalendarAuthConfig {
    Basic { username: String, password: String },
    OAuth2 { access_token: String, refresh_token: String },
}

/// Calendar structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Calendar {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub is_primary: bool,
    pub is_writable: bool,
}

/// Calendar event structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub calendar_id: String,
    pub title: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub is_all_day: bool,
    pub organizer: String,
    pub attendees: Vec<String>,
    pub status: String,
    pub visibility: String,
    pub recurrence_rule: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Calendar sync status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarSyncStatus {
    pub account_id: String,
    pub is_syncing: bool,
    pub last_sync: Option<chrono::DateTime<chrono::Utc>>,
    pub total_calendars: u32,
    pub total_events: u32,
    pub error_message: Option<String>,
}

/// Clean calendar engine
pub struct CalendarEngine {
    accounts: RwLock<HashMap<String, CalendarAccount>>,
    calendars: RwLock<HashMap<String, Vec<Calendar>>>,
    events: RwLock<HashMap<String, Vec<CalendarEvent>>>,
}

impl CalendarEngine {
    /// Create new calendar engine
    pub fn new() -> Self {
        Self {
            accounts: RwLock::new(HashMap::new()),
            calendars: RwLock::new(HashMap::new()),
            events: RwLock::new(HashMap::new()),
        }
    }

    /// Add a calendar account
    pub async fn add_account(&self, account: CalendarAccount) -> Result<(), String> {
        let mut accounts = self.accounts.write().await;
        accounts.insert(account.id.clone(), account);
        Ok(())
    }

    /// Remove account
    pub async fn remove_account(&self, account_id: &str) -> Result<(), String> {
        let mut accounts = self.accounts.write().await;
        let mut calendars = self.calendars.write().await;
        let mut events = self.events.write().await;

        if accounts.remove(account_id).is_some() {
            calendars.remove(account_id);
            events.remove(account_id);
            Ok(())
        } else {
            Err(format!("Account not found: {}", account_id))
        }
    }

    /// Get all accounts
    pub async fn get_accounts(&self) -> Vec<CalendarAccount> {
        let accounts = self.accounts.read().await;
        accounts.values().cloned().collect()
    }

    /// Sync calendars and events for an account
    pub async fn sync_account(&self, account_id: &str) -> Result<CalendarSyncStatus, String> {
        let accounts = self.accounts.read().await;
        let _account = accounts.get(account_id)
            .ok_or_else(|| format!("Account not found: {}", account_id))?;

        // For now, create a simple response - will implement real CalDAV sync later
        Ok(CalendarSyncStatus {
            account_id: account_id.to_string(),
            is_syncing: false,
            last_sync: Some(chrono::Utc::now()),
            total_calendars: 1,
            total_events: 0,
            error_message: None,
        })
    }

    /// Create event
    pub async fn create_event(
        &self,
        calendar_id: &str,
        title: &str,
        start_time: &str,
        end_time: &str,
    ) -> Result<String, String> {
        let event_id = Uuid::new_v4().to_string();
        
        // Parse timestamps
        let start = chrono::DateTime::parse_from_rfc3339(start_time)
            .map_err(|e| format!("Invalid start time: {}", e))?
            .with_timezone(&chrono::Utc);
        let end = chrono::DateTime::parse_from_rfc3339(end_time)
            .map_err(|e| format!("Invalid end time: {}", e))?
            .with_timezone(&chrono::Utc);

        let event = CalendarEvent {
            id: event_id.clone(),
            calendar_id: calendar_id.to_string(),
            title: title.to_string(),
            description: None,
            location: None,
            start_time: start,
            end_time: end,
            is_all_day: false,
            organizer: "".to_string(),
            attendees: vec![],
            status: "confirmed".to_string(),
            visibility: "default".to_string(),
            recurrence_rule: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        // Store event (simplified - will use CalDAV later)
        let mut events = self.events.write().await;
        events.entry(calendar_id.to_string()).or_insert_with(Vec::new).push(event);

        Ok(event_id)
    }

    /// Get calendars for account
    pub async fn get_calendars(&self, account_id: &str) -> Vec<Calendar> {
        let calendars = self.calendars.read().await;
        calendars.get(account_id).cloned().unwrap_or_default()
    }

    /// Get events for calendar
    pub async fn get_events(&self, calendar_id: &str) -> Vec<CalendarEvent> {
        let events = self.events.read().await;
        events.get(calendar_id).cloned().unwrap_or_default()
    }
}

impl Default for CalendarEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Predefined CalDAV server configurations
pub fn get_calendar_server_configs() -> HashMap<String, CalDAVConfig> {
    let mut configs = HashMap::new();

    // Google Calendar CalDAV
    configs.insert("google".to_string(), CalDAVConfig {
        host: "apidata.googleusercontent.com".to_string(),
        port: 443,
        use_ssl: true,
        base_path: "/caldav/v2".to_string(),
    });

    // iCloud Calendar
    configs.insert("icloud".to_string(), CalDAVConfig {
        host: "caldav.icloud.com".to_string(),
        port: 443,
        use_ssl: true,
        base_path: "/".to_string(),
    });

    // FastMail Calendar
    configs.insert("fastmail".to_string(), CalDAVConfig {
        host: "caldav.fastmail.com".to_string(),
        port: 443,
        use_ssl: true,
        base_path: "/".to_string(),
    });

    configs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_calendar_engine_basic_operations() {
        let engine = CalendarEngine::new();

        // Add account
        let account = CalendarAccount {
            id: "test-account".to_string(),
            email: "test@example.com".to_string(),
            provider: "google".to_string(),
            display_name: "Test User".to_string(),
            is_enabled: true,
            server_config: CalDAVConfig {
                host: "test.example.com".to_string(),
                port: 443,
                use_ssl: true,
                base_path: "/caldav".to_string(),
            },
            auth_config: CalendarAuthConfig::Basic {
                username: "test@example.com".to_string(),
                password: "password".to_string(),
            },
        };

        engine.add_account(account.clone()).await.unwrap();
        
        let accounts = engine.get_accounts().await;
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].email, "test@example.com");
    }
}