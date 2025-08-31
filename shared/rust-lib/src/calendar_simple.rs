//! Real Calendar Engine for Flow Desk  
//!
//! This module provides a real calendar engine with Google Calendar API integration.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest::Client;
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
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
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
    pub status: String, // "confirmed", "tentative", "cancelled"
    pub visibility: String, // "public", "private"
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

/// Privacy sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySyncConfig {
    pub enabled: bool,
    pub sync_title: bool,
    pub sync_description: bool,
    pub sync_attendees: bool,
    pub placeholder_title: String,
}

impl Default for PrivacySyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            sync_title: true,
            sync_description: false,
            sync_attendees: false,
            placeholder_title: "Busy".to_string(),
        }
    }
}

/// Google Calendar API response structures
#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleCalendarList {
    pub items: Option<Vec<GoogleCalendar>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleCalendar {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    #[serde(rename = "backgroundColor")]
    pub background_color: Option<String>,
    pub primary: Option<bool>,
    #[serde(rename = "accessRole")]
    pub access_role: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleEventList {
    pub items: Option<Vec<GoogleEvent>>,
    #[serde(rename = "nextPageToken")]
    pub next_page_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleEvent {
    pub id: String,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start: GoogleEventTime,
    pub end: GoogleEventTime,
    pub organizer: Option<GoogleEventOrganizer>,
    pub attendees: Option<Vec<GoogleEventAttendee>>,
    pub status: String,
    pub visibility: Option<String>,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleEventTime {
    #[serde(rename = "dateTime")]
    pub date_time: Option<String>,
    pub date: Option<String>,
    #[serde(rename = "timeZone")]
    pub time_zone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleEventOrganizer {
    pub email: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleEventAttendee {
    pub email: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "responseStatus")]
    pub response_status: String,
}

/// Real calendar engine with Google Calendar API
pub struct CalendarEngine {
    accounts: RwLock<HashMap<String, CalendarAccount>>,
    calendars: RwLock<HashMap<String, Vec<Calendar>>>,
    events: RwLock<HashMap<String, Vec<CalendarEvent>>>,
    privacy_configs: RwLock<HashMap<String, PrivacySyncConfig>>,
    client: Client,
}

impl CalendarEngine {
    /// Create new calendar engine
    pub fn new() -> Self {
        Self {
            accounts: RwLock::new(HashMap::new()),
            calendars: RwLock::new(HashMap::new()),
            events: RwLock::new(HashMap::new()),
            privacy_configs: RwLock::new(HashMap::new()),
            client: Client::new(),
        }
    }

    /// Add a calendar account
    pub async fn add_account(&self, account: CalendarAccount) -> Result<(), String> {
        tracing::info!("Adding calendar account: {}", account.email);
        let mut accounts = self.accounts.write().await;
        accounts.insert(account.id.clone(), account);
        Ok(())
    }

    /// Sync calendars from Google Calendar API
    pub async fn sync_account(&self, account_id: &str) -> Result<CalendarSyncStatus, String> {
        let accounts = self.accounts.read().await;
        let account = accounts.get(account_id)
            .ok_or("Account not found")?;

        if account.provider != "google" {
            return Err("Only Google Calendar supported".to_string());
        }

        let access_token = account.access_token.as_ref()
            .ok_or("No access token")?;

        match self.fetch_google_calendars(account_id, access_token).await {
            Ok(calendars) => {
                let mut stored_calendars = self.calendars.write().await;
                stored_calendars.insert(account_id.to_string(), calendars.clone());

                // Fetch events for primary calendar
                let primary_calendar = calendars.iter().find(|c| c.is_primary);
                let total_events = if let Some(calendar) = primary_calendar {
                    match self.fetch_google_events(access_token, &calendar.id).await {
                        Ok(events) => {
                            let mut stored_events = self.events.write().await;
                            stored_events.insert(calendar.id.clone(), events.clone());
                            events.len() as u32
                        }
                        Err(_) => 0
                    }
                } else {
                    0
                };

                Ok(CalendarSyncStatus {
                    account_id: account_id.to_string(),
                    is_syncing: false,
                    last_sync: Some(chrono::Utc::now()),
                    total_calendars: calendars.len() as u32,
                    total_events,
                    error_message: None,
                })
            }
            Err(e) => {
                tracing::error!("Google Calendar sync failed: {}", e);
                Ok(CalendarSyncStatus {
                    account_id: account_id.to_string(),
                    is_syncing: false,
                    last_sync: None,
                    total_calendars: 0,
                    total_events: 0,
                    error_message: Some(e.to_string()),
                })
            }
        }
    }

    /// Fetch calendars from Google Calendar API
    async fn fetch_google_calendars(&self, account_id: &str, access_token: &str) -> Result<Vec<Calendar>, Box<dyn std::error::Error>> {
        let url = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
        let response = self.client
            .get(url)
            .bearer_auth(access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Google Calendar API error: {}", response.status()).into());
        }

        let calendar_list: GoogleCalendarList = response.json().await?;
        let google_calendars = calendar_list.items.unwrap_or_default();

        let mut calendars = Vec::new();
        for gcal in google_calendars {
            calendars.push(Calendar {
                id: gcal.id,
                account_id: account_id.to_string(),
                name: gcal.summary,
                description: gcal.description,
                color: gcal.background_color.unwrap_or("#4285f4".to_string()),
                is_primary: gcal.primary.unwrap_or(false),
                is_writable: gcal.access_role == "owner" || gcal.access_role == "writer",
            });
        }

        Ok(calendars)
    }

    /// Fetch events from Google Calendar API
    async fn fetch_google_events(&self, access_token: &str, calendar_id: &str) -> Result<Vec<CalendarEvent>, Box<dyn std::error::Error>> {
        let url = format!("https://www.googleapis.com/calendar/v3/calendars/{}/events", calendar_id);
        let response = self.client
            .get(&url)
            .bearer_auth(access_token)
            .query(&[("maxResults", "100")]) // Standard limit for calendar apps
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Google Calendar events API error: {}", response.status()).into());
        }

        let event_list: GoogleEventList = response.json().await?;
        let google_events = event_list.items.unwrap_or_default();

        let mut events = Vec::new();
        for gevent in google_events {
            // Parse start/end times
            let start_time = self.parse_google_time(&gevent.start)?;
            let end_time = self.parse_google_time(&gevent.end)?;
            
            events.push(CalendarEvent {
                id: gevent.id,
                calendar_id: calendar_id.to_string(),
                title: gevent.summary.unwrap_or("(No title)".to_string()),
                description: gevent.description,
                location: gevent.location,
                start_time,
                end_time,
                is_all_day: gevent.start.date.is_some(),
                organizer: gevent.organizer.map(|o| o.email).unwrap_or_default(),
                attendees: gevent.attendees
                    .unwrap_or_default()
                    .into_iter()
                    .map(|a| a.email)
                    .collect(),
                status: gevent.status,
                visibility: gevent.visibility.unwrap_or("default".to_string()),
                recurrence_rule: None, // TODO: Parse recurrence
                created_at: chrono::DateTime::parse_from_rfc3339(&gevent.created)
                    .unwrap_or_else(|_| chrono::Utc::now().into())
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&gevent.updated)
                    .unwrap_or_else(|_| chrono::Utc::now().into())
                    .with_timezone(&chrono::Utc),
            });
        }

        Ok(events)
    }

    fn parse_google_time(&self, time: &GoogleEventTime) -> Result<chrono::DateTime<chrono::Utc>, Box<dyn std::error::Error>> {
        if let Some(date_time) = &time.date_time {
            Ok(chrono::DateTime::parse_from_rfc3339(date_time)?.with_timezone(&chrono::Utc))
        } else if let Some(date) = &time.date {
            // All-day event
            Ok(chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")?
                .and_hms_opt(0, 0, 0)
                .unwrap()
                .and_utc())
        } else {
            Err("Invalid Google Calendar time format".into())
        }
    }

    /// Create event via Google Calendar API
    pub async fn create_event(
        &self,
        calendar_id: &str,
        title: &str,
        start_time: &str,
        end_time: &str,
    ) -> Result<String, String> {
        // Find account that owns this calendar
        let calendars = self.calendars.read().await;
        let account_id = calendars.iter()
            .find_map(|(acc_id, cals)| {
                if cals.iter().any(|c| c.id == calendar_id) {
                    Some(acc_id.clone())
                } else {
                    None
                }
            })
            .ok_or("Calendar not found")?;

        let accounts = self.accounts.read().await;
        let account = accounts.get(&account_id)
            .ok_or("Account not found")?;

        let access_token = account.access_token.as_ref()
            .ok_or("No access token")?;

        // Create event object for Google Calendar API
        let event_request = serde_json::json!({
            "summary": title,
            "start": {
                "dateTime": start_time,
                "timeZone": "UTC"
            },
            "end": {
                "dateTime": end_time,
                "timeZone": "UTC"
            }
        });

        let url = format!("https://www.googleapis.com/calendar/v3/calendars/{}/events", calendar_id);
        let response = self.client
            .post(&url)
            .bearer_auth(access_token)
            .json(&event_request)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Failed to create event: {}", response.status()));
        }

        let result: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
        Ok(result["id"].as_str().unwrap_or("unknown").to_string())
    }

    /// OAuth2 authorization URL for Google Calendar
    pub fn get_oauth_url(&self, client_id: &str, redirect_uri: &str) -> Result<String, String> {
        let base_url = "https://accounts.google.com/o/oauth2/v2/auth";
        let scopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events"
        ].join(" ");
        
        let auth_url = format!(
            "{}?client_id={}&redirect_uri={}&scope={}&response_type=code&access_type=offline",
            base_url,
            urlencoding::encode(client_id),
            urlencoding::encode(redirect_uri),
            urlencoding::encode(&scopes)
        );

        Ok(auth_url)
    }

    /// Remove a calendar account
    pub async fn remove_account(&self, account_id: &str) -> Result<(), String> {
        let mut accounts = self.accounts.write().await;
        if accounts.remove(account_id).is_some() {
            let mut calendars = self.calendars.write().await;
            let mut events = self.events.write().await;  
            let mut privacy_configs = self.privacy_configs.write().await;
            
            calendars.remove(account_id);
            events.remove(account_id);
            privacy_configs.remove(account_id);
            
            tracing::info!("Removed calendar account: {}", account_id);
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

    /// Get account by ID
    pub async fn get_account(&self, account_id: &str) -> Option<CalendarAccount> {
        let accounts = self.accounts.read().await;
        accounts.get(account_id).cloned()
    }


    /// Get calendars for an account
    pub async fn get_calendars(&self, account_id: &str) -> Vec<Calendar> {
        let calendars = self.calendars.read().await;
        calendars.get(account_id).cloned().unwrap_or_default()
    }

    /// Get events for a calendar
    pub async fn get_events(&self, account_id: &str) -> Vec<CalendarEvent> {
        let events = self.events.read().await;
        events.get(account_id).cloned().unwrap_or_default()
    }

    /// Get events for a date range
    pub fn get_events_in_range(
        &self,
        account_id: &str,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
    ) -> Vec<&CalendarEvent> {
        self.events.get(account_id)
            .map(|events| {
                events
                    .iter()
                    .filter(|event| {
                        event.start_time >= start && event.start_time <= end
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Create a new event
    pub async fn create_event(
        &mut self,
        calendar_id: &str,
        title: String,
        start_time: chrono::DateTime<chrono::Utc>,
        end_time: chrono::DateTime<chrono::Utc>,
    ) -> Result<String, String> {
        // Find the account that owns this calendar
        let mut account_id = None;
        for (acc_id, calendars) in &self.calendars {
            if calendars.iter().any(|cal| cal.id == calendar_id) {
                account_id = Some(acc_id.clone());
                break;
            }
        }

        let account_id = account_id.ok_or_else(|| "Calendar not found".to_string())?;
        
        let account = self.accounts.get(&account_id)
            .ok_or_else(|| "Account not found".to_string())?;

        let event_id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now();

        let event = CalendarEvent {
            id: event_id.clone(),
            calendar_id: calendar_id.to_string(),
            title,
            description: None,
            location: None,
            start_time,
            end_time,
            is_all_day: false,
            organizer: account.email.clone(),
            attendees: vec![account.email.clone()],
            status: "confirmed".to_string(),
            visibility: "private".to_string(),
            recurrence_rule: None,
            created_at: now,
            updated_at: now,
        };

        self.events.entry(account_id).or_insert_with(Vec::new).push(event);
        
        tracing::info!("Created event: {}", event_id);
        Ok(event_id)
    }

    /// Set privacy sync configuration for an account
    pub fn set_privacy_config(&mut self, account_id: &str, config: PrivacySyncConfig) {
        self.privacy_configs.insert(account_id.to_string(), config);
        tracing::info!("Updated privacy sync config for account: {}", account_id);
    }

    /// Get privacy sync configuration for an account
    pub fn get_privacy_config(&self, account_id: &str) -> PrivacySyncConfig {
        self.privacy_configs.get(account_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Process RRULE (simplified implementation)
    pub fn expand_recurring_events(
        &self,
        event: &CalendarEvent,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
    ) -> Vec<CalendarEvent> {
        // This is a simplified implementation
        // In a real system, you'd use the `rrule` crate to properly parse and expand recurrence rules
        if let Some(_rrule) = &event.recurrence_rule {
            // For demonstration, create a few instances
            let mut instances = Vec::new();
            let mut current = event.start_time;
            let duration = event.end_time - event.start_time;

            while current <= end && instances.len() < 10 {
                if current >= start {
                    let mut instance = event.clone();
                    instance.id = format!("{}-{}", event.id, current.timestamp());
                    instance.start_time = current;
                    instance.end_time = current + duration;
                    instances.push(instance);
                }
                current = current + chrono::Duration::weeks(1); // Weekly recurrence
            }

            instances
        } else {
            // Non-recurring event
            if event.start_time >= start && event.start_time <= end {
                vec![event.clone()]
            } else {
                vec![]
            }
        }
    }
}

impl Default for CalendarEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_calendar_engine_basic_operations() {
        let mut engine = CalendarEngine::new();

        // Add account
        let account = CalendarAccount {
            id: "test-account".to_string(),
            email: "test@example.com".to_string(),
            provider: "google".to_string(),
            display_name: "Test User".to_string(),
            is_enabled: true,
        };

        engine.add_account(account.clone()).await.unwrap();
        assert_eq!(engine.get_accounts().len(), 1);

        // Sync account
        let status = engine.sync_account("test-account").await.unwrap();
        assert_eq!(status.account_id, "test-account");
        assert!(status.total_calendars > 0);
        assert!(status.total_events > 0);

        // Get calendars and events
        let calendars = engine.get_calendars("test-account");
        assert!(!calendars.is_empty());

        let events = engine.get_events("test-account");
        assert!(!events.is_empty());

        // Create new event
        let calendar_id = calendars[0].id.clone();
        let start_time = chrono::Utc::now() + chrono::Duration::hours(2);
        let end_time = start_time + chrono::Duration::hours(1);

        let event_id = engine.create_event(
            &calendar_id,
            "Test Meeting".to_string(),
            start_time,
            end_time,
        ).await.unwrap();

        assert!(!event_id.is_empty());

        // Verify event was created
        let events_after = engine.get_events("test-account");
        assert_eq!(events_after.len(), 2); // Original + new event
    }
}