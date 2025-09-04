/*!
 * Calendar Provider Traits
 * 
 * Abstract traits that all calendar providers must implement for unified
 * calendar operations across different services.
 */

use async_trait::async_trait;
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::calendar::{
    CalendarResult, CalendarError, Calendar, CalendarEvent,
    CreateCalendarEventInput, UpdateCalendarEventInput,
    FreeBusyQuery, FreeBusyResponse, EventAttendee,
    WebhookSubscription, CalendarProvider
};

use super::{
    BatchOperationRequest, BatchOperationResult, 
    WebhookNotification, SyncStatus
};

/// Main trait that all calendar providers must implement
#[async_trait]
pub trait CalendarProviderTrait: Send + Sync {
    /// Get provider type
    fn provider_type(&self) -> CalendarProvider;

    /// Get account ID this provider is associated with
    fn account_id(&self) -> &str;

    /// Test connection and authentication
    async fn test_connection(&mut self) -> CalendarResult<()>;

    /// Refresh authentication tokens if needed
    async fn refresh_authentication(&mut self) -> CalendarResult<()>;

    // === Calendar Operations ===

    /// List all calendars for this account
    async fn list_calendars(&mut self) -> CalendarResult<Vec<Calendar>>;

    /// Get a specific calendar by provider ID
    async fn get_calendar(&mut self, calendar_id: &str) -> CalendarResult<Calendar>;

    /// Create a new calendar
    async fn create_calendar(&mut self, calendar: &Calendar) -> CalendarResult<Calendar>;

    /// Update an existing calendar
    async fn update_calendar(&mut self, calendar_id: &str, calendar: &Calendar) -> CalendarResult<Calendar>;

    /// Delete a calendar
    async fn delete_calendar(&mut self, calendar_id: &str) -> CalendarResult<()>;

    // === Event Operations ===

    /// List events in a calendar within a time range
    async fn list_events(
        &mut self,
        calendar_id: &str,
        time_min: Option<DateTime<Utc>>,
        time_max: Option<DateTime<Utc>>,
        max_results: Option<u32>,
    ) -> CalendarResult<Vec<CalendarEvent>>;

    /// Get a specific event by provider ID
    async fn get_event(&mut self, calendar_id: &str, event_id: &str) -> CalendarResult<CalendarEvent>;

    /// Create a new event
    async fn create_event(&mut self, event: &CreateCalendarEventInput) -> CalendarResult<CalendarEvent>;

    /// Update an existing event
    async fn update_event(
        &mut self, 
        calendar_id: &str,
        event_id: &str, 
        updates: &UpdateCalendarEventInput
    ) -> CalendarResult<CalendarEvent>;

    /// Delete an event
    async fn delete_event(&mut self, calendar_id: &str, event_id: &str) -> CalendarResult<()>;

    /// Move an event to a different calendar
    async fn move_event(
        &mut self,
        source_calendar_id: &str,
        target_calendar_id: &str,
        event_id: &str,
    ) -> CalendarResult<CalendarEvent>;

    // === Recurring Events ===

    /// Get instances of a recurring event in a time range
    async fn get_recurring_event_instances(
        &mut self,
        calendar_id: &str,
        recurring_event_id: &str,
        time_min: DateTime<Utc>,
        time_max: DateTime<Utc>,
    ) -> CalendarResult<Vec<CalendarEvent>>;

    /// Update a single instance of a recurring event
    async fn update_recurring_event_instance(
        &mut self,
        calendar_id: &str,
        recurring_event_id: &str,
        instance_id: &str,
        updates: &UpdateCalendarEventInput,
    ) -> CalendarResult<CalendarEvent>;

    /// Delete a single instance of a recurring event
    async fn delete_recurring_event_instance(
        &mut self,
        calendar_id: &str,
        recurring_event_id: &str,
        instance_id: &str,
    ) -> CalendarResult<()>;

    // === Attendee Operations ===

    /// Add attendees to an event
    async fn add_attendees(
        &mut self,
        calendar_id: &str,
        event_id: &str,
        attendees: &[EventAttendee],
    ) -> CalendarResult<CalendarEvent>;

    /// Remove attendees from an event
    async fn remove_attendees(
        &mut self,
        calendar_id: &str,
        event_id: &str,
        attendee_emails: &[String],
    ) -> CalendarResult<CalendarEvent>;

    /// Send meeting invitations to attendees
    async fn send_invitations(
        &mut self,
        calendar_id: &str,
        event_id: &str,
        message: Option<&str>,
    ) -> CalendarResult<()>;

    // === Free/Busy Operations ===

    /// Query free/busy information for email addresses
    async fn query_free_busy(&mut self, query: &FreeBusyQuery) -> CalendarResult<FreeBusyResponse>;

    /// Get availability for a specific calendar
    async fn get_calendar_free_busy(
        &mut self,
        calendar_id: &str,
        time_min: DateTime<Utc>,
        time_max: DateTime<Utc>,
    ) -> CalendarResult<FreeBusyResponse>;

    // === Synchronization ===

    /// Perform full synchronization of all calendars
    async fn full_sync(&mut self) -> CalendarResult<SyncStatus>;

    /// Perform incremental sync using sync tokens
    async fn incremental_sync(&mut self, sync_token: Option<&str>) -> CalendarResult<SyncStatus>;

    /// Get the current sync token for incremental syncing
    async fn get_sync_token(&mut self, calendar_id: &str) -> CalendarResult<Option<String>>;

    /// Check if sync token is still valid
    async fn is_sync_token_valid(&mut self, sync_token: &str) -> CalendarResult<bool>;

    // === Batch Operations (if supported) ===

    /// Execute batch operations if provider supports them
    async fn batch_operations(&mut self, request: &BatchOperationRequest) -> CalendarResult<Vec<BatchOperationResult>> {
        // Default implementation performs operations sequentially
        let mut results = Vec::new();
        
        for operation in &request.operations {
            let result = match operation {
                super::BatchOperation::CreateEvent(event) => {
                    match self.create_event(event).await {
                        Ok(created_event) => BatchOperationResult {
                            operation: operation.clone(),
                            success: true,
                            result: Some(serde_json::to_value(created_event)?),
                            error: None,
                        },
                        Err(e) => BatchOperationResult {
                            operation: operation.clone(),
                            success: false,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    }
                },
                super::BatchOperation::UpdateEvent { event_id, updates } => {
                    // Would need calendar_id - this is a simplified example
                    BatchOperationResult {
                        operation: operation.clone(),
                        success: false,
                        result: None,
                        error: Some("Batch update not implemented in default trait".to_string()),
                    }
                },
                super::BatchOperation::DeleteEvent { event_id } => {
                    // Would need calendar_id - this is a simplified example
                    BatchOperationResult {
                        operation: operation.clone(),
                        success: false,
                        result: None,
                        error: Some("Batch delete not implemented in default trait".to_string()),
                    }
                },
            };
            results.push(result);
        }
        
        Ok(results)
    }
}

/// Trait for providers that support webhook subscriptions
#[async_trait]
pub trait WebhookCapableProvider: CalendarProviderTrait {
    /// Subscribe to webhook notifications for a calendar
    async fn subscribe_to_webhooks(
        &self,
        calendar_id: &str,
        webhook_url: &str,
        events: &[WebhookEventType],
    ) -> CalendarResult<WebhookSubscription>;

    /// Unsubscribe from webhook notifications
    async fn unsubscribe_from_webhooks(&self, subscription_id: &str) -> CalendarResult<()>;

    /// Renew webhook subscription before expiration
    async fn renew_webhook_subscription(&self, subscription_id: &str) -> CalendarResult<WebhookSubscription>;

    /// List active webhook subscriptions
    async fn list_webhook_subscriptions(&self) -> CalendarResult<Vec<WebhookSubscription>>;

    /// Process incoming webhook notification
    async fn process_webhook_notification(&self, payload: &[u8]) -> CalendarResult<WebhookNotification>;

    /// Validate webhook signature
    fn validate_webhook_signature(&self, payload: &[u8], signature: &str) -> CalendarResult<bool>;
}

/// Types of events that can trigger webhooks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebhookEventType {
    /// Calendar was created
    CalendarCreated,
    /// Calendar was updated
    CalendarUpdated,
    /// Calendar was deleted
    CalendarDeleted,
    /// Event was created
    EventCreated,
    /// Event was updated
    EventUpdated,
    /// Event was deleted
    EventDeleted,
    /// Attendee response changed
    AttendeeResponseChanged,
    /// Sync required (token expired)
    SyncRequired,
}

/// Trait for providers that support real-time notifications
#[async_trait]
pub trait PushNotificationProvider: CalendarProviderTrait {
    /// Enable push notifications for a calendar
    async fn enable_push_notifications(
        &self,
        calendar_id: &str,
        notification_url: &str,
    ) -> CalendarResult<String>; // Returns channel ID

    /// Disable push notifications for a calendar  
    async fn disable_push_notifications(&self, channel_id: &str) -> CalendarResult<()>;

    /// Handle incoming push notification
    async fn handle_push_notification(&self, payload: &[u8]) -> CalendarResult<WebhookNotification>;
}

/// Trait for providers that support advanced scheduling features
#[async_trait]
pub trait AdvancedSchedulingProvider: CalendarProviderTrait {
    /// Find available meeting times across multiple calendars/attendees
    async fn find_meeting_times(
        &self,
        attendee_emails: &[String],
        duration_minutes: u32,
        time_min: DateTime<Utc>,
        time_max: DateTime<Utc>,
        max_candidates: Option<u32>,
    ) -> CalendarResult<Vec<MeetingTimeCandidate>>;

    /// Create meeting room booking
    async fn book_meeting_room(
        &self,
        room_email: &str,
        event: &CreateCalendarEventInput,
    ) -> CalendarResult<CalendarEvent>;

    /// Find available meeting rooms
    async fn find_available_rooms(
        &self,
        building: Option<&str>,
        capacity: Option<u32>,
        equipment: &[String],
        time_min: DateTime<Utc>,
        time_max: DateTime<Utc>,
    ) -> CalendarResult<Vec<MeetingRoom>>;
}

/// Meeting time candidate from scheduling search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingTimeCandidate {
    /// Proposed meeting start time
    pub start_time: DateTime<Utc>,
    /// Proposed meeting end time
    pub end_time: DateTime<Utc>,
    /// Confidence score (0-100)
    pub confidence: u8,
    /// Attendee availability conflicts
    pub conflicts: Vec<AttendeeConflict>,
    /// Suggested location
    pub suggested_location: Option<String>,
}

/// Meeting room information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingRoom {
    /// Room email address
    pub email: String,
    /// Room display name
    pub name: String,
    /// Building name
    pub building: Option<String>,
    /// Floor number
    pub floor: Option<String>,
    /// Room capacity
    pub capacity: Option<u32>,
    /// Available equipment
    pub equipment: Vec<String>,
    /// Room features
    pub features: Vec<String>,
    /// Whether room is currently available
    pub is_available: bool,
}

/// Attendee conflict information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttendeeConflict {
    /// Attendee email
    pub email: String,
    /// Type of conflict
    pub conflict_type: ConflictType,
    /// Conflicting event title (if available)
    pub conflicting_event: Option<String>,
    /// Conflict start time
    pub conflict_start: DateTime<Utc>,
    /// Conflict end time
    pub conflict_end: DateTime<Utc>,
}

/// Types of scheduling conflicts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictType {
    /// Attendee has another event
    Busy,
    /// Attendee is tentative
    Tentative,
    /// Attendee is out of office
    OutOfOffice,
    /// Attendee working hours conflict
    OutsideWorkingHours,
    /// Room is booked
    RoomUnavailable,
}

/// Provider authentication status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatus {
    /// Whether authentication is valid
    pub is_valid: bool,
    /// Token expiration time
    pub expires_at: Option<DateTime<Utc>>,
    /// Required scopes
    pub required_scopes: Vec<String>,
    /// Current scopes
    pub current_scopes: Vec<String>,
    /// Whether re-authentication is needed
    pub needs_reauth: bool,
    /// Last authentication error
    pub last_error: Option<String>,
}

/// Trait for checking authentication status
#[async_trait]
pub trait AuthenticationProvider {
    /// Check current authentication status
    async fn check_auth_status(&self) -> CalendarResult<AuthStatus>;
    
    /// Get OAuth authorization URL for re-authentication
    async fn get_auth_url(&self, redirect_uri: &str) -> CalendarResult<String>;
    
    /// Complete OAuth flow with authorization code
    async fn complete_auth_flow(&mut self, authorization_code: &str) -> CalendarResult<()>;
    
    /// Revoke authentication tokens
    async fn revoke_authentication(&self) -> CalendarResult<()>;
}