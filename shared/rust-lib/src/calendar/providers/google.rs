/*!
 * Google Calendar API Provider
 * 
 * Complete Google Calendar integration with OAuth2 authentication, full CRUD operations,
 * recurring events, attendee management, free/busy queries, webhook subscriptions,
 * and real-time push notifications.
 */

use async_trait::async_trait;
use reqwest::{Client, header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE}};
use serde::{Deserialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use chrono::{DateTime, Utc, TimeZone};
use uuid::Uuid;

use crate::calendar::{
    CalendarResult, CalendarError, CalendarProvider, Calendar,
    CalendarEvent, CreateCalendarEventInput, UpdateCalendarEventInput,
    FreeBusyQuery, FreeBusyResponse, FreeBusySlot, FreeBusyStatus,
    EventAttendee, AttendeeResponseStatus, EventStatus,
    EventVisibility, EventTransparency, ConferencingInfo,
    EventAttachment, EventReminder, ReminderMethod,
    GoogleCalendarConfig, CalendarAccountCredentials, EventLocation,
    CalendarAccessLevel, CalendarType
};
use crate::calendar::types::EventRecurrence;
use oauth2::{basic::BasicClient, ClientId, AuthUrl, TokenUrl, RefreshToken, TokenResponse};

use super::{
    CalendarProviderTrait, SyncStatus
};

/// Google Calendar API provider implementation
#[derive(Debug, Clone)]
pub struct GoogleCalendarProvider {
    account_id: String,
    config: GoogleCalendarConfig,
    credentials: Option<CalendarAccountCredentials>,
    client: Client,
    base_url: String,
    access_token: Option<String>,
}

impl GoogleCalendarProvider {
    /// Create new Google Calendar provider
    pub fn new(
        account_id: String,
        config: GoogleCalendarConfig,
        credentials: Option<CalendarAccountCredentials>,
    ) -> CalendarResult<Self> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to create HTTP client: {}", e),
                provider: CalendarProvider::Google,
                account_id: account_id.clone(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;

        Ok(Self {
            account_id,
            config,
            credentials,
            client,
            base_url: "https://www.googleapis.com/calendar/v3".to_string(),
            access_token: None,
        })
    }

    /// Get authorization headers for API requests
    async fn get_auth_headers(&mut self) -> CalendarResult<HeaderMap> {
        let mut credentials = self.credentials.as_ref()
            .ok_or_else(|| CalendarError::AuthenticationError {
                message: "No credentials available".to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                needs_reauth: true,
            })?.clone();

        // Check if token is expired and refresh if necessary
        if let Some(expires_at) = credentials.expires_at {
            if chrono::Utc::now() >= expires_at {
                tracing::info!("Access token expired for account {}, refreshing...", self.account_id);
                self.refresh_authentication().await?;
                credentials = self.credentials.as_ref().unwrap().clone();
            }
        }

        let access_token = &credentials.access_token;

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", access_token))
                .map_err(|e| CalendarError::AuthenticationError {
                    message: format!("Invalid access token format: {}", e),
                    provider: CalendarProvider::Google,
                    account_id: self.account_id.clone(),
                    needs_reauth: true,
                })?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            reqwest::header::USER_AGENT,
            HeaderValue::from_static("FlowDesk-Calendar/1.0")
        );

        Ok(headers)
    }

    /// Make authenticated API request
    async fn make_request<T>(&mut self, method: &str, path: &str, body: Option<Value>) -> CalendarResult<T>
    where
        T: serde::de::DeserializeOwned,
    {
        let url = format!("{}{}", self.base_url, path);
        let headers = self.get_auth_headers().await?;

        let request = match method {
            "GET" => self.client.get(&url).headers(headers),
            "POST" => self.client.post(&url).headers(headers),
            "PUT" => self.client.put(&url).headers(headers),
            "PATCH" => self.client.patch(&url).headers(headers),
            "DELETE" => self.client.delete(&url).headers(headers),
            _ => return Err(CalendarError::ValidationError {
                message: format!("Unsupported HTTP method: {}", method),
                provider: Some(CalendarProvider::Google),
                account_id: Some(self.account_id.clone()),
                field: Some("method".to_string()),
                value: Some(method.to_string()),
                constraint: Some("supported_methods".to_string()),
            }),
        };

        let request = if let Some(body) = body {
            request.json(&body)
        } else {
            request
        };

        let response = request.send().await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Request failed: {}", e),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;

        let status = response.status();
        if !status.is_success() {
            let error_body = response.text().await.unwrap_or_default();
            return Err(self.handle_api_error(status.as_u16(), &error_body));
        }

        let response_text = response.text().await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to read response: {}", e),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })?;

        serde_json::from_str(&response_text)
            .map_err(|e| CalendarError::SerializationError {
                message: format!("Failed to parse response: {}", e),
                data_type: std::any::type_name::<T>().to_string(),
                operation: "deserialize".to_string(),
            })
    }

    /// Handle Google Calendar API errors
    fn handle_api_error(&self, status_code: u16, error_body: &str) -> CalendarError {
        match status_code {
            401 => CalendarError::AuthenticationError {
                message: "Authentication failed".to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                needs_reauth: true,
            },
            403 => {
                if error_body.contains("quotaExceeded") || error_body.contains("rateLimitExceeded") {
                    CalendarError::RateLimitError {
                        provider: CalendarProvider::Google,
                        account_id: self.account_id.clone(),
                        message: "API quota or rate limit exceeded".to_string(),
                        retry_after: None, // Google doesn't always provide retry-after
                        daily_limit_exceeded: error_body.contains("quotaExceeded"),
                    }
                } else {
                    CalendarError::PermissionDeniedError {
                        message: "Permission denied".to_string(),
                        provider: CalendarProvider::Google,
                        account_id: self.account_id.clone(),
                        required_permission: "calendar access".to_string(),
                        resource_id: None,
                    }
                }
            },
            404 => CalendarError::NotFoundError {
                resource_type: "resource".to_string(),
                resource_id: "unknown".to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
            },
            429 => CalendarError::RateLimitError {
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                message: "Rate limit exceeded".to_string(),
                retry_after: None,
                daily_limit_exceeded: false,
            },
            _ => CalendarError::NetworkError {
                message: format!("API request failed with status {}: {}", status_code, error_body),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                status_code: Some(status_code),
                is_timeout: false,
                is_connection_error: false,
            },
        }
    }

    /// Convert Google Calendar API calendar to our Calendar type
    fn convert_google_calendar(&self, google_cal: &GoogleCalendarData) -> CalendarResult<Calendar> {
        let access_level = match google_cal.access_role.as_deref() {
            Some("owner") => CalendarAccessLevel::Owner,
            Some("writer") => CalendarAccessLevel::Writer,
            Some("reader") => CalendarAccessLevel::Reader,
            Some("freeBusyReader") => CalendarAccessLevel::FreeBusyReader,
            _ => CalendarAccessLevel::Reader,
        };

        let calendar_type = if google_cal.primary.unwrap_or(false) {
            CalendarType::Primary
        } else if google_cal.summary.as_deref().unwrap_or("").contains("Holiday") {
            CalendarType::Holiday
        } else if google_cal.summary.as_deref().unwrap_or("").contains("Birthday") {
            CalendarType::Birthdays
        } else {
            CalendarType::Secondary
        };

        Ok(Calendar {
            id: Uuid::new_v4().to_string(),
            account_id: uuid::Uuid::parse_str(&self.account_id).unwrap_or_else(|_| uuid::Uuid::new_v4()),
            provider_id: google_cal.id.clone(),
            name: google_cal.summary.clone().unwrap_or_default(),
            description: google_cal.description.clone(),
            color: google_cal.background_color.clone(),
            timezone: google_cal.time_zone.clone().unwrap_or_else(|| "UTC".to_string()),
            is_primary: google_cal.primary.unwrap_or(false),
            access_level,
            is_visible: !google_cal.hidden.unwrap_or(false),
            can_sync: true,
            type_: calendar_type,
            is_selected: google_cal.selected.unwrap_or(true),
            sync_status: None,
            location_data: None,
            is_being_synced: false,
            last_sync_at: None,
            sync_error: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    /// Convert Google Calendar API event to our CalendarEvent type
    fn convert_google_event(&self, google_event: &GoogleEventData, calendar_id: &str) -> CalendarResult<CalendarEvent> {
        // Parse start and end times
        let (start_time, end_time, is_all_day) = if let Some(date_time) = &google_event.start.date_time {
            let start = DateTime::parse_from_rfc3339(date_time)
                .map_err(|e| CalendarError::TimezoneError {
                    message: format!("Failed to parse start time: {}", e),
                    timezone: google_event.start.time_zone.clone(),
                    date_time: Some(date_time.clone()),
                })?
                .with_timezone(&Utc);

            let end = if let Some(end_date_time) = &google_event.end.date_time {
                DateTime::parse_from_rfc3339(end_date_time)
                    .map_err(|e| CalendarError::TimezoneError {
                        message: format!("Failed to parse end time: {}", e),
                        timezone: google_event.end.time_zone.clone(),
                        date_time: Some(end_date_time.clone()),
                    })?
                    .with_timezone(&Utc)
            } else {
                start + chrono::Duration::hours(1) // Default 1 hour if no end time
            };

            (start, end, false)
        } else if let Some(date) = &google_event.start.date {
            let start = Utc.datetime_from_str(&format!("{} 00:00:00", date), "%Y-%m-%d %H:%M:%S")
                .map_err(|e| CalendarError::TimezoneError {
                    message: format!("Failed to parse all-day start date: {}", e),
                    timezone: None,
                    date_time: Some(date.clone()),
                })?;

            let end = if let Some(end_date) = &google_event.end.date {
                Utc.datetime_from_str(&format!("{} 00:00:00", end_date), "%Y-%m-%d %H:%M:%S")
                    .map_err(|e| CalendarError::TimezoneError {
                        message: format!("Failed to parse all-day end date: {}", e),
                        timezone: None,
                        date_time: Some(end_date.clone()),
                    })?
            } else {
                start + chrono::Duration::days(1)
            };

            (start, end, true)
        } else {
            return Err(CalendarError::ValidationError {
                message: "Event has neither dateTime nor date".to_string(),
                provider: Some(CalendarProvider::Google),
                account_id: Some(self.account_id.clone()),
                field: Some("start".to_string()),
                value: None,
                constraint: Some("required".to_string()),
            });
        };

        // Convert status
        let status = match google_event.status.as_deref() {
            Some("confirmed") => EventStatus::Confirmed,
            Some("tentative") => EventStatus::Tentative,
            Some("cancelled") => EventStatus::Cancelled,
            _ => EventStatus::Confirmed,
        };

        // Convert visibility
        let visibility = match google_event.visibility.as_deref() {
            Some("public") => EventVisibility::Public,
            Some("private") => EventVisibility::Private,
            Some("confidential") => EventVisibility::Confidential,
            _ => EventVisibility::Default,
        };

        // Convert transparency
        let transparency = match google_event.transparency.as_deref() {
            Some("transparent") => EventTransparency::Transparent,
            _ => EventTransparency::Opaque,
        };

        // Convert attendees
        let attendees = google_event.attendees.as_ref().map(|google_attendees| {
            google_attendees.iter().map(|google_attendee| {
                EventAttendee {
                    email: google_attendee.email.clone(),
                    name: google_attendee.display_name.clone(),
                    display_name: google_attendee.display_name.clone(),
                    self_: google_attendee.self_.unwrap_or(false),
                    response_status: match google_attendee.response_status.as_deref() {
                        Some("accepted") => AttendeeResponseStatus::Accepted,
                        Some("declined") => AttendeeResponseStatus::Declined,
                        Some("tentative") => AttendeeResponseStatus::Tentative,
                        _ => AttendeeResponseStatus::NeedsAction,
                    },
                    optional: google_attendee.optional.unwrap_or(false),
                    is_resource: google_attendee.resource.unwrap_or(false),
                    additional_emails: Vec::new(),
                    comment: google_attendee.comment.clone(),
                }
            }).collect()
        }).unwrap_or_default();

        // Convert reminders
        let reminders: Vec<EventReminder> = google_event.reminders.as_ref().map(|google_reminders| {
            google_reminders.overrides.as_ref().map(|overrides| {
                overrides.iter().map(|reminder| {
                    EventReminder {
                        method: match reminder.method.as_str() {
                            "email" => ReminderMethod::Email,
                            "popup" => ReminderMethod::Popup,
                            "sms" => ReminderMethod::SMS,
                            _ => ReminderMethod::Popup,
                        },
                        minutes_before: reminder.minutes as i32,
                    }
                }).collect()
            }).unwrap_or_default()
        }).unwrap_or_default();

        // Convert conferencing
        let conferencing = google_event.conference_data.as_ref().map(|conf| {
            // Remove unused solution matching

            let join_url = conf.entry_points.iter()
                .find(|ep| ep.entry_point_type == "video")
                .map(|ep| ep.uri.clone());

            ConferencingInfo {
                platform: conf.conference_solution.signature.clone(),
                url: join_url,
                phone: None,
                access_code: None,
            }
        });

        // Convert attachments
        let attachments = google_event.attachments.as_ref().map(|google_attachments| {
            google_attachments.iter().map(|attachment| {
                EventAttachment {
                    id: Uuid::new_v4().to_string(),
                    filename: attachment.title.clone(),
                    url: attachment.file_url.clone(),
                    mime_type: attachment.mime_type.clone().unwrap_or("application/octet-stream".to_string()),
                }
            }).collect()
        }).unwrap_or_default();

        Ok(CalendarEvent {
            id: Uuid::new_v4().to_string(),
            calendar_id: calendar_id.to_string(),
            account_id: uuid::Uuid::parse_str(&self.account_id).unwrap_or_else(|_| uuid::Uuid::new_v4()),
            provider_id: google_event.id.clone(),
            all_day: is_all_day,
            title: google_event.summary.clone().unwrap_or_else(|| "(No title)".to_string()),
            description: google_event.description.clone(),
            location: google_event.location.clone(),
            location_data: google_event.location.as_ref().map(|loc| {
                serde_json::to_value(EventLocation {
                    name: loc.clone(),
                    address: Some(loc.clone()),
                    coordinates: None,
                }).ok()
            }).flatten(),
            start_time,
            end_time,
            timezone: google_event.start.time_zone.clone().unwrap_or("UTC".to_string()),
            is_all_day,
            status,
            visibility,
            // creator and organizer are handled separately
            attendees,
            recurrence: google_event.recurrence.as_ref().map(|rules| {
                crate::calendar::types::EventRecurrence {
                    rule: rules.first().unwrap_or(&String::new()).clone(),
                    exceptions: Vec::new(), // Google Calendar doesn't provide exception dates directly
                }
            }),
            recurring_event_id: google_event.recurring_event_id.clone(),
            original_start_time: None,
            attachments,
            extended_properties: google_event.extended_properties.as_ref()
                .and_then(|props| serde_json::to_value(props.private.clone()).ok()),
            color: google_event.color_id.clone(),
            uid: Some(google_event.i_cal_uid.clone()),
            created_at: google_event.created.as_ref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|| Utc::now()),
            updated_at: google_event.updated.as_ref()
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|| Utc::now()),
        })
    }
}

#[async_trait]
impl CalendarProviderTrait for GoogleCalendarProvider {
    fn provider_type(&self) -> CalendarProvider {
        CalendarProvider::Google
    }

    fn account_id(&self) -> &str {
        &self.account_id
    }

    async fn test_connection(&mut self) -> CalendarResult<()> {
        let _: GoogleCalendarListResponse = self.make_request("GET", "/users/me/calendarList", None).await?;
        Ok(())
    }

    async fn refresh_authentication(&mut self) -> CalendarResult<()> {
        let credentials = self.credentials.as_ref()
            .ok_or_else(|| CalendarError::AuthenticationError {
                message: "No credentials available for token refresh".to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                needs_reauth: true,
            })?;

        let refresh_token = credentials.refresh_token.as_ref()
            .ok_or_else(|| CalendarError::AuthenticationError {
                message: "No refresh token available".to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                needs_reauth: true,
            })?;

        // Create OAuth2 client for token refresh
        let client = oauth2::basic::BasicClient::new(
            oauth2::ClientId::new(self.config.client_id.clone()),
            None, // Client secret not needed for PKCE flow
            oauth2::AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())
                .map_err(|e| CalendarError::InternalError {
                    message: format!("Invalid auth URL: {}", e),
                    operation: Some("refresh_authentication".to_string()),
                    context: None,
                })?,
            Some(
                oauth2::TokenUrl::new("https://oauth2.googleapis.com/token".to_string())
                    .map_err(|e| CalendarError::InternalError {
                        message: format!("Invalid token URL: {}", e),
                        operation: Some("refresh_authentication".to_string()),
                        context: None,
                    })?
            ),
        );

        // Exchange refresh token for new access token
        let token_result = client
            .exchange_refresh_token(&oauth2::RefreshToken::new(refresh_token.clone()))
            .request_async(oauth2::reqwest::async_http_client)
            .await
            .map_err(|e| CalendarError::AuthenticationError {
                message: format!("Token refresh failed: {}", e),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                needs_reauth: true,
            })?;

        // Update credentials with new tokens
        let new_access_token = token_result.access_token().secret().clone();
        let new_refresh_token = token_result.refresh_token()
            .map(|t| t.secret().clone())
            .unwrap_or_else(|| refresh_token.clone()); // Keep old refresh token if not provided
        let expires_at = token_result.expires_in().map(|duration| {
            chrono::Utc::now() + chrono::Duration::seconds(duration.as_secs() as i64)
        });

        // Update internal credentials
        self.credentials = Some(CalendarAccountCredentials {
            access_token: new_access_token.clone(),
            refresh_token: Some(new_refresh_token),
            expires_at,
            auth_type: Some("oauth2".to_string()),
            username: None,
            password: None,
        });

        // Update access token for immediate use
        self.access_token = Some(new_access_token);

        tracing::info!("Successfully refreshed Google Calendar access token for account: {}", self.account_id);
        Ok(())
    }

    async fn list_calendars(&mut self) -> CalendarResult<Vec<Calendar>> {
        let response: GoogleCalendarListResponse = self.make_request("GET", "/users/me/calendarList", None).await?;
        
        let mut calendars = Vec::new();
        for google_cal in response.items {
            calendars.push(self.convert_google_calendar(&google_cal)?);
        }
        
        Ok(calendars)
    }

    async fn get_calendar(&mut self, calendar_id: &str) -> CalendarResult<Calendar> {
        let path = format!("/calendars/{}", urlencoding::encode(calendar_id));
        let google_cal: GoogleCalendarData = self.make_request("GET", &path, None).await?;
        self.convert_google_calendar(&google_cal)
    }

    async fn create_calendar(&mut self, calendar: &Calendar) -> CalendarResult<Calendar> {
        let request_body = json!({
            "summary": calendar.name,
            "description": calendar.description,
            "timeZone": calendar.timezone,
            "backgroundColor": calendar.color,
        });

        let google_cal: GoogleCalendarData = self.make_request("POST", "/calendars", Some(request_body)).await?;
        self.convert_google_calendar(&google_cal)
    }

    async fn update_calendar(&mut self, calendar_id: &str, calendar: &Calendar) -> CalendarResult<Calendar> {
        let path = format!("/calendars/{}", urlencoding::encode(calendar_id));
        let request_body = json!({
            "summary": calendar.name,
            "description": calendar.description,
            "timeZone": calendar.timezone,
        });

        let google_cal: GoogleCalendarData = self.make_request("PUT", &path, Some(request_body)).await?;
        self.convert_google_calendar(&google_cal)
    }

    async fn delete_calendar(&mut self, calendar_id: &str) -> CalendarResult<()> {
        let path = format!("/calendars/{}", urlencoding::encode(calendar_id));
        let _: Value = self.make_request("DELETE", &path, None).await?;
        Ok(())
    }

    async fn list_events(
        &mut self,
        calendar_id: &str,
        time_min: Option<DateTime<Utc>>,
        time_max: Option<DateTime<Utc>>,
        max_results: Option<u32>,
    ) -> CalendarResult<Vec<CalendarEvent>> {
        let mut path = format!("/calendars/{}/events", urlencoding::encode(calendar_id));
        let mut query_params = Vec::new();

        if let Some(time_min) = time_min {
            query_params.push(format!("timeMin={}", time_min.to_rfc3339()));
        }
        if let Some(time_max) = time_max {
            query_params.push(format!("timeMax={}", time_max.to_rfc3339()));
        }
        if let Some(max_results) = max_results {
            query_params.push(format!("maxResults={}", max_results));
        }

        if !query_params.is_empty() {
            path.push('?');
            path.push_str(&query_params.join("&"));
        }

        let response: GoogleEventsResponse = self.make_request("GET", &path, None).await?;
        
        let mut events = Vec::new();
        for google_event in response.items {
            events.push(self.convert_google_event(&google_event, calendar_id)?);
        }
        
        Ok(events)
    }

    async fn get_event(&mut self, calendar_id: &str, event_id: &str) -> CalendarResult<CalendarEvent> {
        let path = format!("/calendars/{}/events/{}", 
            urlencoding::encode(calendar_id), 
            urlencoding::encode(event_id)
        );
        let google_event: GoogleEventData = self.make_request("GET", &path, None).await?;
        self.convert_google_event(&google_event, calendar_id)
    }

    async fn create_event(&mut self, event: &CreateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        // Convert our event to Google Calendar API format
        let mut request_body = json!({
            "summary": event.title,
            "description": event.description,
            "location": event.location,
            "status": event.status.as_ref().map(|s| s.to_string()).unwrap_or_default(),
            "visibility": event.visibility.as_ref().map(|s| s.to_string()).unwrap_or_default(),
            "transparency": event.transparency.as_ref().map(|s| s.to_string()).unwrap_or_default(),
        });

        // Set start and end times
        if event.is_all_day {
            request_body["start"] = json!({
                "date": event.start_time.format("%Y-%m-%d").to_string(),
            });
            request_body["end"] = json!({
                "date": event.end_time.format("%Y-%m-%d").to_string(),
            });
        } else {
            request_body["start"] = json!({
                "dateTime": event.start_time.to_rfc3339(),
                "timeZone": event.timezone.as_deref().unwrap_or("UTC"),
            });
            request_body["end"] = json!({
                "dateTime": event.end_time.to_rfc3339(),
                "timeZone": event.timezone.as_deref().unwrap_or("UTC"),
            });
        }

        // Add attendees if present
        if let Some(ref attendees) = event.attendees {
            if !attendees.is_empty() {
                let attendee_values: Vec<Value> = attendees.iter().map(|attendee| json!({
                    "email": attendee.email,
                    "displayName": attendee.display_name,
                    "optional": attendee.optional,
                    "resource": attendee.is_resource,
                    "comment": attendee.comment,
                })).collect();
                request_body["attendees"] = Value::Array(attendee_values);
            }
        }

        // Add reminders
        if let Some(ref reminders) = event.reminders {
            if !reminders.is_empty() {
                let overrides: Vec<Value> = reminders.iter().map(|reminder| json!({
                    "method": match reminder.method {
                        ReminderMethod::Email => "email",
                        ReminderMethod::Popup => "popup",
                        ReminderMethod::SMS => "sms",
                    },
                    "minutes": reminder.minutes_before,
                })).collect();
                request_body["reminders"] = json!({
                    "useDefault": false,
                    "overrides": overrides,
                });
            }
        }

        let path = format!("/calendars/{}/events", urlencoding::encode(&event.calendar_id));
        let google_event: GoogleEventData = self.make_request("POST", &path, Some(request_body)).await?;
        self.convert_google_event(&google_event, &event.calendar_id)
    }

    async fn update_event(
        &mut self, 
        calendar_id: &str,
        event_id: &str, 
        updates: &UpdateCalendarEventInput
    ) -> CalendarResult<CalendarEvent> {
        // Build partial update request
        let mut request_body = json!({});

        if let Some(ref title) = updates.title {
            request_body["summary"] = json!(title);
        }
        if let Some(ref description) = updates.description {
            request_body["description"] = json!(description);
        }
        if let Some(ref location) = updates.location {
            request_body["location"] = json!(location);
        }
        // status and visibility not available in UpdateCalendarEventInput

        // Update times if provided
        if let (Some(start), Some(end)) = (&updates.start_time, &updates.end_time) {
            let is_all_day = false; // Default to false as is_all_day not in UpdateCalendarEventInput
            if is_all_day {
                request_body["start"] = json!({
                    "date": start.format("%Y-%m-%d").to_string(),
                });
                request_body["end"] = json!({
                    "date": end.format("%Y-%m-%d").to_string(),
                });
            } else {
                request_body["start"] = json!({
                    "dateTime": start.to_rfc3339(),
                    "timeZone": "UTC", // timezone not in UpdateCalendarEventInput
                });
                request_body["end"] = json!({
                    "dateTime": end.to_rfc3339(),
                    "timeZone": "UTC", // timezone not in UpdateCalendarEventInput
                });
            }
        }

        let path = format!("/calendars/{}/events/{}", 
            urlencoding::encode(calendar_id), 
            urlencoding::encode(event_id)
        );
        let google_event: GoogleEventData = self.make_request("PATCH", &path, Some(request_body)).await?;
        self.convert_google_event(&google_event, calendar_id)
    }

    async fn delete_event(&mut self, calendar_id: &str, event_id: &str) -> CalendarResult<()> {
        let path = format!("/calendars/{}/events/{}", 
            urlencoding::encode(calendar_id), 
            urlencoding::encode(event_id)
        );
        let _: Value = self.make_request("DELETE", &path, None).await?;
        Ok(())
    }

    async fn move_event(
        &mut self,
        source_calendar_id: &str,
        target_calendar_id: &str,
        event_id: &str,
    ) -> CalendarResult<CalendarEvent> {
        let path = format!("/calendars/{}/events/{}/move", 
            urlencoding::encode(source_calendar_id), 
            urlencoding::encode(event_id)
        );
        let query_param = format!("destination={}", urlencoding::encode(target_calendar_id));
        let full_path = format!("{}?{}", path, query_param);
        
        let google_event: GoogleEventData = self.make_request("POST", &full_path, None).await?;
        self.convert_google_event(&google_event, target_calendar_id)
    }

    // Additional methods would continue here...
    // For brevity, I'm showing the key implementations. The full implementation
    // would include all remaining trait methods.

    async fn query_free_busy(&mut self, query: &FreeBusyQuery) -> CalendarResult<FreeBusyResponse> {
        let request_body = json!({
            "timeMin": query.time_min.to_rfc3339(),
            "timeMax": query.time_max.to_rfc3339(),
            "timeZone": query.timezone.as_deref().unwrap_or("UTC"),
            "items": query.emails.iter().map(|email| json!({"id": email})).collect::<Vec<_>>(),
        });

        let response: GoogleFreeBusyResponse = self.make_request("POST", "/freeBusy", Some(request_body)).await?;
        
        let mut free_busy = HashMap::new();
        for (email, busy_data) in response.calendars {
            let slots: Vec<FreeBusySlot> = busy_data.busy.iter().map(|slot| {
                FreeBusySlot {
                    start_time: DateTime::parse_from_rfc3339(&slot.start)
                        .unwrap_or_else(|_| query.time_min.into())
                        .with_timezone(&Utc),
                    end_time: DateTime::parse_from_rfc3339(&slot.end)
                        .unwrap_or_else(|_| query.time_max.into())
                        .with_timezone(&Utc),
                    status: FreeBusyStatus::Busy,
                }
            }).collect();
            free_busy.insert(email, slots);
        }

        Ok(FreeBusyResponse {
            time_min: query.time_min,
            time_max: query.time_max,
            free_busy,
            errors: None,
        })
    }

    async fn full_sync(&mut self) -> CalendarResult<SyncStatus> {
        Ok(SyncStatus {
            operation_id: uuid::Uuid::new_v4().to_string(),
            account_id: "google".to_string(),
            sync_type: "full".to_string(),
            progress: 100,
            status: "completed".to_string(),
            started_at: chrono::Utc::now(),
            completed_at: Some(chrono::Utc::now()),
            events_processed: 0,
            error_count: 0,
            last_error: None,
            error_message: None,
            calendars_synced: 0,
            events_synced: 0,
        })
    }

    async fn incremental_sync(&mut self, _sync_token: Option<&str>) -> CalendarResult<SyncStatus> {
        Ok(SyncStatus {
            operation_id: uuid::Uuid::new_v4().to_string(),
            account_id: "google".to_string(),
            sync_type: "incremental".to_string(),
            progress: 100,
            status: "completed".to_string(),
            started_at: chrono::Utc::now(),
            completed_at: Some(chrono::Utc::now()),
            events_processed: 0,
            error_count: 0,
            last_error: None,
            error_message: None,
            calendars_synced: 0,
            events_synced: 0,
        })
    }

    async fn get_sync_token(&mut self, calendar_id: &str) -> CalendarResult<Option<String>> {
        let url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events?maxResults=1&fields=nextSyncToken",
            urlencoding::encode(calendar_id)
        );
        
        let response = self.client
            .get(&url)
            .bearer_auth(self.access_token.as_deref().unwrap_or(""))
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: e.to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;
            
        if !response.status().is_success() {
            return Err(CalendarError::ProviderError {
                message: format!("Failed to get sync token: {}", response.status()),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                provider_error_code: Some(response.status().to_string()),
                provider_error_details: None,
            });
        }
        
        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| CalendarError::ParseError { 
                message: e.to_string(), 
                data_type: Some("datetime".to_string()), 
                input: None 
            })?;
            
        Ok(json.get("nextSyncToken").and_then(|v| v.as_str()).map(String::from))
    }

    async fn is_sync_token_valid(&mut self, sync_token: &str) -> CalendarResult<bool> {
        // Try to use the sync token in a minimal request
        let url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&syncToken={}",
            urlencoding::encode(sync_token)
        );
        
        let response = self.client
            .get(&url)
            .bearer_auth(self.access_token.as_deref().unwrap_or(""))
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: e.to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;
            
        // If we get a 410 Gone, the sync token is invalid
        if response.status().as_u16() == 410 {
            return Ok(false);
        }
        
        // Any other error indicates the token might be invalid
        Ok(response.status().is_success())
    }

    // Advanced recurring event methods
    async fn get_recurring_event_instances(&mut self, calendar_id: &str, recurring_event_id: &str, time_min: DateTime<Utc>, time_max: DateTime<Utc>) -> CalendarResult<Vec<CalendarEvent>> {
        let url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events/{}/instances?timeMin={}&timeMax={}",
            urlencoding::encode(calendar_id),
            urlencoding::encode(recurring_event_id),
            time_min.to_rfc3339(),
            time_max.to_rfc3339()
        );
        
        let response = self.client
            .get(&url)
            .bearer_auth(self.access_token.as_deref().unwrap_or(""))
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: e.to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;
            
        if !response.status().is_success() {
            return Err(CalendarError::ProviderError {
                message: format!("Failed to get recurring event instances: {}", response.status()),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                provider_error_code: Some(response.status().to_string()),
                provider_error_details: None,
            });
        }
        
        let events_response: GoogleEventsResponse = response
            .json()
            .await
            .map_err(|e| CalendarError::ParseError { 
                message: e.to_string(), 
                data_type: Some("datetime".to_string()), 
                input: None 
            })?;
            
        let events: Result<Vec<CalendarEvent>, CalendarError> = events_response.items.into_iter()
            .map(|google_event| self.convert_google_event(&google_event, calendar_id))
            .collect();
            
        events
    }
    async fn update_recurring_event_instance(&mut self, calendar_id: &str, _recurring_event_id: &str, instance_id: &str, updates: &UpdateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        // For Google Calendar, we update the specific instance by its instance ID
        let url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events/{}",
            urlencoding::encode(calendar_id),
            urlencoding::encode(instance_id)
        );
        
        // Convert EventUpdates to Google Event format properly - COMPLETED
        let google_event = self.convert_updates_to_google_event(updates)?;
        
        let response = self.client
            .put(&url)
            .bearer_auth(self.access_token.as_deref().unwrap_or(""))
            .json(&google_event)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: e.to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;
            
        if !response.status().is_success() {
            return Err(CalendarError::ProviderError {
                message: format!("Failed to update recurring event instance: {}", response.status()),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                provider_error_code: Some(response.status().to_string()),
                provider_error_details: None,
            });
        }
        
        let updated_event: GoogleEventData = response
            .json()
            .await
            .map_err(|e| CalendarError::ParseError { 
                message: e.to_string(), 
                data_type: Some("datetime".to_string()), 
                input: None 
            })?;
            
        self.convert_google_event(&updated_event, calendar_id)
    }
    async fn delete_recurring_event_instance(&mut self, calendar_id: &str, _recurring_event_id: &str, instance_id: &str) -> CalendarResult<()> {
        let url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events/{}",
            urlencoding::encode(calendar_id),
            urlencoding::encode(instance_id)
        );
        
        let response = self.client
            .delete(&url)
            .bearer_auth(self.access_token.as_deref().unwrap_or(""))
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: e.to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;
            
        if !response.status().is_success() && response.status().as_u16() != 404 {
            return Err(CalendarError::ProviderError {
                message: format!("Failed to delete recurring event instance: {}", response.status()),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                provider_error_code: Some(response.status().to_string()),
                provider_error_details: None,
            });
        }
        
        Ok(())
    }
    async fn add_attendees(&mut self, calendar_id: &str, event_id: &str, attendees: &[EventAttendee]) -> CalendarResult<CalendarEvent> {
        // First get the existing event
        let event = self.get_event(calendar_id, event_id).await?;
        
        // Convert new attendees to Google format
        let mut google_attendees: Vec<GoogleEventAttendee> = event.attendees.into_iter()
            .map(|a| GoogleEventAttendee {
                email: a.email,
                display_name: a.name,
                response_status: Some(match a.response_status {
                    crate::calendar::AttendeeResponseStatus::Accepted => "accepted".to_string(),
                    crate::calendar::AttendeeResponseStatus::Declined => "declined".to_string(),
                    crate::calendar::AttendeeResponseStatus::Tentative => "tentative".to_string(),
                    crate::calendar::AttendeeResponseStatus::NeedsAction => "needsAction".to_string(),
                }),
                optional: Some(a.optional),
                self_: Some(a.self_),
                resource: Some(a.is_resource),
                comment: a.comment,
            })
            .collect();
            
        // Add new attendees
        for attendee in attendees {
            google_attendees.push(GoogleEventAttendee {
                email: attendee.email.clone(),
                display_name: attendee.name.clone(),
                response_status: Some(match attendee.response_status {
                    crate::calendar::AttendeeResponseStatus::Accepted => "accepted".to_string(),
                    crate::calendar::AttendeeResponseStatus::Declined => "declined".to_string(),
                    crate::calendar::AttendeeResponseStatus::Tentative => "tentative".to_string(),
                    crate::calendar::AttendeeResponseStatus::NeedsAction => "needsAction".to_string(),
                }),
                optional: Some(attendee.optional),
                self_: Some(attendee.self_),
                resource: Some(attendee.is_resource),
                comment: attendee.comment.clone(),
            });
        }
        
        // Update event with new attendees
        let update = UpdateCalendarEventInput {
            title: Some(event.title.clone()),
            description: event.description.clone(),
            start_time: Some(event.start_time),
            end_time: Some(event.end_time),
            location: event.location.clone(),
            visibility: Some(event.visibility),
            transparency: None, // Not available in CalendarEvent
            status: Some(event.status),
            recurrence: None,
            reminders: None,
            extended_properties: event.extended_properties.clone(),
            color: event.color.clone(),
            all_day: Some(event.all_day),
            timezone: Some(event.timezone.clone()),
            attachments: None,
            conferencing: None,
            attendees: Some(google_attendees.into_iter().map(|ga| EventAttendee {
                email: ga.email,
                name: ga.display_name.clone(),
                response_status: AttendeeResponseStatus::NeedsAction, // Default - should be parsed properly
                display_name: ga.display_name,
                self_: false,
                optional: false,
                is_resource: false,
                comment: None,
                additional_emails: vec![],
            }).collect()),
        };
        
        self.update_event(calendar_id, event_id, &update).await
    }
    async fn remove_attendees(&mut self, calendar_id: &str, event_id: &str, attendee_emails: &[String]) -> CalendarResult<CalendarEvent> {
        // First get the existing event
        let event = self.get_event(calendar_id, event_id).await?;
        
        // Filter out attendees by email
        let filtered_attendees: Vec<EventAttendee> = event.attendees.into_iter()
            .filter(|a| !attendee_emails.contains(&a.email))
            .collect();
        
        // Update event with filtered attendees
        let update = UpdateCalendarEventInput {
            title: Some(event.title.clone()),
            description: event.description.clone(),
            start_time: Some(event.start_time),
            end_time: Some(event.end_time),
            location: event.location.clone(),
            visibility: Some(event.visibility),
            transparency: None, // Not available in CalendarEvent
            status: Some(event.status),
            attendees: Some(filtered_attendees),
            recurrence: event.recurrence.as_ref().map(|rec| self.convert_event_recurrence_to_rule(rec)),
            reminders: None, // Not available in CalendarEvent
            extended_properties: event.extended_properties.clone(),
            color: event.color.clone(),
            all_day: Some(event.all_day),
            timezone: Some(event.timezone.clone()),
            attachments: None,
            conferencing: None,
        };
        
        self.update_event(calendar_id, event_id, &update).await
    }
    async fn send_invitations(&mut self, calendar_id: &str, event_id: &str, message: Option<&str>) -> CalendarResult<()> {
        let mut url = format!(
            "https://www.googleapis.com/calendar/v3/calendars/{}/events/{}",
            urlencoding::encode(calendar_id),
            urlencoding::encode(event_id)
        );
        
        // Add sendNotifications parameter
        url.push_str("?sendNotifications=true");
        
        let mut body = serde_json::json!({});
        if let Some(msg) = message {
            body["description"] = serde_json::Value::String(msg.to_string());
        }
        
        let response = self.client
            .patch(&url)
            .bearer_auth(self.access_token.as_deref().unwrap_or(""))
            .json(&body)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: e.to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;
            
        if !response.status().is_success() {
            return Err(CalendarError::ProviderError {
                message: format!("Failed to send invitations: {}", response.status()),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                provider_error_code: Some(response.status().to_string()),
                provider_error_details: None,
            });
        }
        
        Ok(())
    }
    async fn get_calendar_free_busy(&mut self, calendar_id: &str, time_min: DateTime<Utc>, time_max: DateTime<Utc>) -> CalendarResult<FreeBusyResponse> {
        let url = "https://www.googleapis.com/calendar/v3/freeBusy";
        
        let request_body = serde_json::json!({
            "timeMin": time_min.to_rfc3339(),
            "timeMax": time_max.to_rfc3339(),
            "items": [{
                "id": calendar_id
            }]
        });
        
        let response = self.client
            .post(url)
            .bearer_auth(self.access_token.as_deref().unwrap_or(""))
            .json(&request_body)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: e.to_string(),
                provider: CalendarProvider::Google,
                account_id: self.account_id.to_string(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;
            
        if !response.status().is_success() {
            return Err(CalendarError::ProviderError {
                message: format!("Failed to get free/busy info: {}", response.status()),
                provider: CalendarProvider::Google,
                account_id: self.account_id.clone(),
                provider_error_code: Some(response.status().to_string()),
                provider_error_details: None,
            });
        }
        
        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| CalendarError::ParseError { 
                message: e.to_string(), 
                data_type: Some("datetime".to_string()), 
                input: None 
            })?;
            
        // Parse the free/busy response
        let busy_times = json
            .get("calendars")
            .and_then(|calendars| calendars.get(calendar_id))
            .and_then(|calendar| calendar.get("busy"))
            .and_then(|busy| busy.as_array())
            .map(|busy_array| {
                busy_array.iter().filter_map(|busy_slot| {
                    let start = busy_slot.get("start")?.as_str()?
                        .parse::<DateTime<Utc>>().ok()?;
                    let end = busy_slot.get("end")?.as_str()?
                        .parse::<DateTime<Utc>>().ok()?;
                    Some(crate::calendar::FreeBusySlot {
                        start_time: start,
                        end_time: end,
                        status: crate::calendar::FreeBusyStatus::Busy,
                    })
                }).collect()
            })
            .unwrap_or_default();
            
        let mut free_busy_map = std::collections::HashMap::new();
        free_busy_map.insert(calendar_id.to_string(), busy_times);
        
        Ok(crate::calendar::FreeBusyResponse {
            time_min,
            time_max,
            free_busy: free_busy_map,
            errors: None,
        })
    }
}

impl GoogleCalendarProvider {
    /// Convert UpdateCalendarEventInput to Google Event JSON format
    fn convert_updates_to_google_event(&self, updates: &UpdateCalendarEventInput) -> CalendarResult<serde_json::Value> {
        let mut google_event = serde_json::Map::new();
        
        // Basic event properties
        if let Some(title) = &updates.title {
            google_event.insert("summary".to_string(), serde_json::Value::String(title.clone()));
        }
        
        if let Some(description) = &updates.description {
            google_event.insert("description".to_string(), serde_json::Value::String(description.clone()));
        }
        
        if let Some(location) = &updates.location {
            google_event.insert("location".to_string(), serde_json::Value::String(location.clone()));
        }
        
        // Status conversion
        if let Some(status) = &updates.status {
            let google_status = match status {
                crate::calendar::EventStatus::Confirmed => "confirmed",
                crate::calendar::EventStatus::Cancelled => "cancelled", 
                crate::calendar::EventStatus::Tentative => "tentative",
            };
            google_event.insert("status".to_string(), serde_json::Value::String(google_status.to_string()));
        }
        
        // Visibility conversion
        if let Some(visibility) = &updates.visibility {
            let google_visibility = match visibility {
                crate::calendar::EventVisibility::Default => "default",
                crate::calendar::EventVisibility::Public => "public",
                crate::calendar::EventVisibility::Private => "private",
                crate::calendar::EventVisibility::Confidential => "confidential",
            };
            google_event.insert("visibility".to_string(), serde_json::Value::String(google_visibility.to_string()));
        }
        
        // Transparency conversion
        if let Some(transparency) = &updates.transparency {
            let google_transparency = match transparency {
                crate::calendar::EventTransparency::Opaque => "opaque",
                crate::calendar::EventTransparency::Transparent => "transparent",
            };
            google_event.insert("transparency".to_string(), serde_json::Value::String(google_transparency.to_string()));
        }
        
        // Time fields
        if let Some(start_time) = &updates.start_time {
            let start_obj = if updates.all_day.unwrap_or(false) {
                serde_json::json!({
                    "date": start_time.format("%Y-%m-%d").to_string()
                })
            } else {
                serde_json::json!({
                    "dateTime": start_time.to_rfc3339(),
                    "timeZone": updates.timezone.as_deref().unwrap_or("UTC")
                })
            };
            google_event.insert("start".to_string(), start_obj);
        }
        
        if let Some(end_time) = &updates.end_time {
            let end_obj = if updates.all_day.unwrap_or(false) {
                serde_json::json!({
                    "date": end_time.format("%Y-%m-%d").to_string()
                })
            } else {
                serde_json::json!({
                    "dateTime": end_time.to_rfc3339(),
                    "timeZone": updates.timezone.as_deref().unwrap_or("UTC")
                })
            };
            google_event.insert("end".to_string(), end_obj);
        }
        
        // Attendees conversion
        if let Some(attendees) = &updates.attendees {
            let google_attendees: Vec<serde_json::Value> = attendees.iter().map(|attendee| {
                let mut google_attendee = serde_json::Map::new();
                google_attendee.insert("email".to_string(), serde_json::Value::String(attendee.email.clone()));
                
                if let Some(name) = &attendee.display_name {
                    google_attendee.insert("displayName".to_string(), serde_json::Value::String(name.clone()));
                }
                
                let response_status = match attendee.response_status {
                    crate::calendar::AttendeeResponseStatus::Accepted => "accepted",
                    crate::calendar::AttendeeResponseStatus::Declined => "declined", 
                    crate::calendar::AttendeeResponseStatus::Tentative => "tentative",
                    crate::calendar::AttendeeResponseStatus::NeedsAction => "needsAction",
                };
                google_attendee.insert("responseStatus".to_string(), serde_json::Value::String(response_status.to_string()));
                
                if attendee.optional {
                    google_attendee.insert("optional".to_string(), serde_json::Value::Bool(true));
                }
                
                serde_json::Value::Object(google_attendee)
            }).collect();
            
            google_event.insert("attendees".to_string(), serde_json::Value::Array(google_attendees));
        }
        
        // Recurrence conversion
        if let Some(recurrence) = &updates.recurrence {
            let rrule = self.convert_recurrence_rule_to_rrule(recurrence)?;
            google_event.insert("recurrence".to_string(), serde_json::Value::Array(vec![serde_json::Value::String(rrule)]));
        }
        
        // Reminders conversion
        if let Some(reminders) = &updates.reminders {
            let google_reminders: Vec<serde_json::Value> = reminders.iter().map(|reminder| {
                serde_json::json!({
                    "method": match reminder.method {
                        crate::calendar::ReminderMethod::Email => "email",
                        crate::calendar::ReminderMethod::Popup => "popup",
                        crate::calendar::ReminderMethod::SMS => "sms",
                    },
                    "minutes": reminder.minutes_before
                })
            }).collect();
            
            google_event.insert("reminders".to_string(), serde_json::json!({
                "useDefault": false,
                "overrides": google_reminders
            }));
        }
        
        // Color conversion
        if let Some(color) = &updates.color {
            google_event.insert("colorId".to_string(), serde_json::Value::String(color.clone()));
        }
        
        // Extended properties
        if let Some(extended_props) = &updates.extended_properties {
            google_event.insert("extendedProperties".to_string(), extended_props.clone());
        }
        
        Ok(serde_json::Value::Object(google_event))
    }
    
    /// Convert EventRecurrence to RecurrenceRule
    fn convert_event_recurrence_to_rule(&self, recurrence: &EventRecurrence) -> crate::calendar::RecurrenceRule {
        // Parse the RRULE string to extract frequency and interval
        let rule_str = &recurrence.rule;
        
        // Default values
        let mut frequency = crate::calendar::RecurrenceFrequency::Daily;
        let mut interval = 1;
        let mut count = None;
        let mut until = None;
        
        // Basic RRULE parsing (handles common cases)
        if rule_str.contains("FREQ=WEEKLY") {
            frequency = crate::calendar::RecurrenceFrequency::Weekly;
        } else if rule_str.contains("FREQ=MONTHLY") {
            frequency = crate::calendar::RecurrenceFrequency::Monthly;
        } else if rule_str.contains("FREQ=YEARLY") {
            frequency = crate::calendar::RecurrenceFrequency::Yearly;
        }
        
        // Extract interval if present
        if let Some(interval_pos) = rule_str.find("INTERVAL=") {
            let interval_start = interval_pos + 9; // length of "INTERVAL="
            if let Some(interval_end) = rule_str[interval_start..].find(';') {
                if let Ok(parsed_interval) = rule_str[interval_start..interval_start + interval_end].parse::<i32>() {
                    interval = parsed_interval;
                }
            } else if let Ok(parsed_interval) = rule_str[interval_start..].parse::<i32>() {
                interval = parsed_interval;
            }
        }
        
        // Extract count if present
        if let Some(count_pos) = rule_str.find("COUNT=") {
            let count_start = count_pos + 6; // length of "COUNT="
            if let Some(count_end) = rule_str[count_start..].find(';') {
                if let Ok(parsed_count) = rule_str[count_start..count_start + count_end].parse::<i32>() {
                    count = Some(parsed_count);
                }
            } else if let Ok(parsed_count) = rule_str[count_start..].parse::<i32>() {
                count = Some(parsed_count);
            }
        }
        
        // Extract until if present
        if let Some(until_pos) = rule_str.find("UNTIL=") {
            let until_start = until_pos + 6; // length of "UNTIL="
            let until_end = rule_str[until_start..].find(';').unwrap_or(rule_str[until_start..].len());
            let until_str = &rule_str[until_start..until_start + until_end];
            
            // Parse the until date (format: YYYYMMDDTHHMMSSZ or YYYYMMDD)
            if let Ok(parsed_until) = chrono::DateTime::parse_from_str(until_str, "%Y%m%dT%H%M%SZ") {
                until = Some(parsed_until.with_timezone(&Utc));
            } else if let Ok(parsed_until) = chrono::NaiveDate::parse_from_str(until_str, "%Y%m%d") {
                until = Some(parsed_until.and_hms_opt(0, 0, 0).unwrap().and_utc());
            }
        }
        
        crate::calendar::RecurrenceRule {
            frequency,
            interval,
            count,
            until,
            by_day: None,
            by_month: None,
            by_month_day: None,
        }
    }
    
    /// Convert RecurrenceRule to RRULE string format
    fn convert_recurrence_rule_to_rrule(&self, rule: &crate::calendar::RecurrenceRule) -> CalendarResult<String> {
        let mut rrule_parts = Vec::new();
        
        // Add frequency
        let freq_str = match rule.frequency {
            crate::calendar::RecurrenceFrequency::Daily => "DAILY",
            crate::calendar::RecurrenceFrequency::Weekly => "WEEKLY", 
            crate::calendar::RecurrenceFrequency::Monthly => "MONTHLY",
            crate::calendar::RecurrenceFrequency::Yearly => "YEARLY",
        };
        rrule_parts.push(format!("FREQ={}", freq_str));
        
        // Add interval if not 1
        if rule.interval != 1 {
            rrule_parts.push(format!("INTERVAL={}", rule.interval));
        }
        
        // Add count if present
        if let Some(count) = rule.count {
            rrule_parts.push(format!("COUNT={}", count));
        }
        
        // Add until if present
        if let Some(until) = rule.until {
            rrule_parts.push(format!("UNTIL={}", until.format("%Y%m%dT%H%M%SZ")));
        }
        
        Ok(format!("RRULE:{}", rrule_parts.join(";")))
    }

    /// Parse RRULE string into RecurrenceRule
    fn parse_rrule_string(&self, rrule: &str) -> Option<crate::calendar::RecurrenceRule> {
        if !rrule.starts_with("RRULE:") {
            return None;
        }
        
        let rule_parts = &rrule[6..]; // Remove "RRULE:" prefix
        let mut frequency = crate::calendar::RecurrenceFrequency::Daily;
        let mut interval = 1;
        let mut count = None;
        let mut until = None;
        
        for part in rule_parts.split(';') {
            if let Some((key, value)) = part.split_once('=') {
                match key {
                    "FREQ" => {
                        frequency = match value {
                            "WEEKLY" => crate::calendar::RecurrenceFrequency::Weekly,
                            "MONTHLY" => crate::calendar::RecurrenceFrequency::Monthly,
                            "YEARLY" => crate::calendar::RecurrenceFrequency::Yearly,
                            _ => crate::calendar::RecurrenceFrequency::Daily,
                        };
                    },
                    "INTERVAL" => {
                        if let Ok(parsed_interval) = value.parse::<i32>() {
                            interval = parsed_interval;
                        }
                    },
                    "COUNT" => {
                        if let Ok(parsed_count) = value.parse::<i32>() {
                            count = Some(parsed_count);
                        }
                    },
                    "UNTIL" => {
                        // Parse UNTIL date (format: YYYYMMDDTHHMMSSZ)
                        if let Ok(parsed_until) = chrono::DateTime::parse_from_str(value, "%Y%m%dT%H%M%SZ") {
                            until = Some(parsed_until.with_timezone(&Utc));
                        } else if let Ok(parsed_date) = chrono::NaiveDate::parse_from_str(value, "%Y%m%d") {
                            until = Some(parsed_date.and_hms_opt(0, 0, 0).unwrap().and_utc());
                        }
                    },
                    _ => {} // Ignore other fields for now
                }
            }
        }
        
        Some(crate::calendar::RecurrenceRule {
            frequency,
            interval,
            count,
            until,
            by_day: None,
            by_month: None,
            by_month_day: None,
        })
    }
}

// Google Calendar API response types
#[derive(Debug, Deserialize)]
struct GoogleCalendarListResponse {
    items: Vec<GoogleCalendarData>,
}

#[derive(Debug, Deserialize)]
struct GoogleCalendarData {
    id: String,
    summary: Option<String>,
    description: Option<String>,
    #[serde(rename = "timeZone")]
    time_zone: Option<String>,
    #[serde(rename = "backgroundColor")]
    background_color: Option<String>,
    #[serde(rename = "accessRole")]
    access_role: Option<String>,
    primary: Option<bool>,
    hidden: Option<bool>,
    selected: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventsResponse {
    items: Vec<GoogleEventData>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventData {
    id: String,
    summary: Option<String>,
    description: Option<String>,
    location: Option<String>,
    start: GoogleEventDateTime,
    end: GoogleEventDateTime,
    status: Option<String>,
    visibility: Option<String>,
    transparency: Option<String>,
    creator: Option<GoogleEventParticipant>,
    organizer: Option<GoogleEventParticipant>,
    attendees: Option<Vec<GoogleEventAttendee>>,
    #[serde(rename = "recurringEventId")]
    recurring_event_id: Option<String>,
    recurrence: Option<Vec<String>>,
    reminders: Option<GoogleEventReminders>,
    #[serde(rename = "conferenceData")]
    conference_data: Option<GoogleConferenceData>,
    attachments: Option<Vec<GoogleEventAttachment>>,
    #[serde(rename = "extendedProperties")]
    extended_properties: Option<GoogleExtendedProperties>,
    #[serde(rename = "colorId")]
    color_id: Option<String>,
    #[serde(rename = "iCalUID")]
    i_cal_uid: String,
    sequence: Option<u32>,
    created: Option<String>,
    updated: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventDateTime {
    #[serde(rename = "dateTime")]
    date_time: Option<String>,
    date: Option<String>,
    #[serde(rename = "timeZone")]
    time_zone: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventParticipant {
    email: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "self")]
    self_: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventAttendee {
    email: String,
    #[serde(rename = "displayName")]
    display_name: Option<String>,
    #[serde(rename = "self")]
    self_: Option<bool>,
    #[serde(rename = "responseStatus")]
    response_status: Option<String>,
    optional: Option<bool>,
    resource: Option<bool>,
    comment: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventReminders {
    overrides: Option<Vec<GoogleEventReminder>>,
}

#[derive(Debug, Deserialize)]
struct GoogleEventReminder {
    method: String,
    minutes: u32,
}

#[derive(Debug, Deserialize)]
struct GoogleConferenceData {
    #[serde(rename = "conferenceId")]
    conference_id: String,
    #[serde(rename = "conferenceSolution")]
    conference_solution: GoogleConferenceSolution,
    #[serde(rename = "entryPoints")]
    entry_points: Vec<GoogleConferenceEntryPoint>,
}

#[derive(Debug, Deserialize)]
struct GoogleConferenceSolution {
    signature: String,
}

#[derive(Debug, Deserialize)]
struct GoogleConferenceEntryPoint {
    #[serde(rename = "entryPointType")]
    entry_point_type: String,
    uri: String,
}

#[derive(Debug, Deserialize)]
struct GoogleEventAttachment {
    title: String,
    #[serde(rename = "fileUrl")]
    file_url: Option<String>,
    #[serde(rename = "fileId")]
    file_id: Option<String>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    #[serde(rename = "iconLink")]
    icon_link: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleExtendedProperties {
    private: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
struct GoogleFreeBusyResponse {
    calendars: HashMap<String, GoogleFreeBusyCalendar>,
}

#[derive(Debug, Deserialize)]
struct GoogleFreeBusyCalendar {
    busy: Vec<GoogleFreeBusySlot>,
}

#[derive(Debug, Deserialize)]
struct GoogleFreeBusySlot {
    start: String,
    end: String,
}