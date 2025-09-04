//! Email scheduling system with timezone support and recurring emails

use crate::mail::types::*;
use crate::mail::error::{MailError, MailResult};
use chrono::{DateTime, Utc, TimeZone, Duration, Datelike};
use chrono_tz::Tz;
use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{interval, Duration as TokioDuration};
use uuid::Uuid;
use std::sync::Arc;

/// Email scheduler errors
#[derive(Debug, thiserror::Error)]
pub enum SchedulerError {
    #[error("Invalid timezone: {0}")]
    InvalidTimezone(String),
    
    #[error("Email already scheduled: {0}")]
    AlreadyScheduled(Uuid),
    
    #[error("Scheduled email not found: {0}")]
    NotFound(Uuid),
    
    #[error("Invalid recurring pattern: {0}")]
    InvalidRecurringPattern(String),
    
    #[error("Email has expired")]
    EmailExpired,
    
    #[error("Maximum send attempts exceeded")]
    MaxAttemptsExceeded,
    
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Scheduler event types
#[derive(Debug, Clone)]
pub enum SchedulerEvent {
    EmailScheduled(Uuid),
    EmailSent(Uuid),
    EmailFailed { id: Uuid, error: String },
    EmailCancelled(Uuid),
    EmailExpired(Uuid),
    RecurringEmailCreated { original_id: Uuid, next_id: Uuid },
}

/// Email scheduler with timezone support
pub struct EmailScheduler {
    scheduled_emails: Arc<RwLock<HashMap<Uuid, ScheduledEmail>>>,
    event_sender: mpsc::UnboundedSender<SchedulerEvent>,
    event_receiver: Arc<RwLock<Option<mpsc::UnboundedReceiver<SchedulerEvent>>>>,
    running: Arc<RwLock<bool>>,
    send_callback: Arc<dyn Fn(ScheduledEmail) -> MailResult<()> + Send + Sync>,
}

impl EmailScheduler {
    /// Create a new email scheduler
    pub fn new<F>(send_callback: F) -> Self 
    where
        F: Fn(ScheduledEmail) -> MailResult<()> + Send + Sync + 'static,
    {
        let (event_sender, event_receiver) = mpsc::unbounded_channel();
        
        Self {
            scheduled_emails: Arc::new(RwLock::new(HashMap::new())),
            event_sender,
            event_receiver: Arc::new(RwLock::new(Some(event_receiver))),
            running: Arc::new(RwLock::new(false)),
            send_callback: Arc::new(send_callback),
        }
    }
    
    /// Start the scheduler
    pub async fn start(&self) -> MailResult<()> {
        let mut running = self.running.write().await;
        if *running {
            return Ok(());
        }
        *running = true;
        drop(running);
        
        // Start the main scheduler loop
        let scheduled_emails = Arc::clone(&self.scheduled_emails);
        let running = Arc::clone(&self.running);
        let event_sender = self.event_sender.clone();
        let send_callback = Arc::clone(&self.send_callback);
        
        tokio::spawn(async move {
            let mut interval = interval(TokioDuration::from_secs(10)); // Check every 10 seconds
            
            while *running.read().await {
                interval.tick().await;
                
                let now = Utc::now();
                let mut emails_to_send = Vec::new();
                let mut emails_to_remove = Vec::new();
                
                // Check for emails ready to send
                {
                    let emails = scheduled_emails.read().await;
                    for (id, email) in emails.iter() {
                        match email.status {
                            ScheduleStatus::Pending => {
                                if email.scheduled_time <= now {
                                    if let Some(expires_at) = email.expires_at {
                                        if now > expires_at {
                                            emails_to_remove.push(*id);
                                            let _ = event_sender.send(SchedulerEvent::EmailExpired(*id));
                                            continue;
                                        }
                                    }
                                    
                                    if email.send_attempts < email.max_attempts {
                                        emails_to_send.push(email.clone());
                                    } else {
                                        emails_to_remove.push(*id);
                                    }
                                }
                            },
                            ScheduleStatus::Failed => {
                                if email.send_attempts < email.max_attempts {
                                    // Retry after exponential backoff
                                    if let Some(last_attempt) = email.last_attempt_at {
                                        let retry_delay = Duration::seconds(60 * (1 << email.send_attempts.min(5)));
                                        if now >= last_attempt + retry_delay {
                                            emails_to_send.push(email.clone());
                                        }
                                    }
                                } else {
                                    emails_to_remove.push(*id);
                                }
                            },
                            _ => {}
                        }
                    }
                }
                
                // Send emails
                for mut email in emails_to_send {
                    let result = send_callback(email.clone());
                    
                    {
                        let mut emails = scheduled_emails.write().await;
                        if let Some(stored_email) = emails.get_mut(&email.id) {
                            stored_email.send_attempts += 1;
                            stored_email.last_attempt_at = Some(now);
                            
                            match result {
                                Ok(_) => {
                                    stored_email.status = ScheduleStatus::Sent;
                                    stored_email.sent_at = Some(now);
                                    let _ = event_sender.send(SchedulerEvent::EmailSent(email.id));
                                    
                                    // Schedule next occurrence for recurring emails
                                    if let Some(recurring) = &stored_email.recurring {
                                        if let Ok(next_email) = Self::create_next_recurring_email(stored_email, recurring) {
                                            let next_id = next_email.id;
                                            emails.insert(next_id, next_email);
                                            let _ = event_sender.send(SchedulerEvent::RecurringEmailCreated {
                                                original_id: email.id,
                                                next_id,
                                            });
                                        }
                                    }
                                },
                                Err(e) => {
                                    stored_email.status = ScheduleStatus::Failed;
                                    stored_email.error_message = Some(e.to_string());
                                    let _ = event_sender.send(SchedulerEvent::EmailFailed {
                                        id: email.id,
                                        error: e.to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
                
                // Remove expired/failed emails
                if !emails_to_remove.is_empty() {
                    let mut emails = scheduled_emails.write().await;
                    for id in emails_to_remove {
                        emails.remove(&id);
                    }
                }
            }
        });
        
        Ok(())
    }
    
    /// Stop the scheduler
    pub async fn stop(&self) {
        let mut running = self.running.write().await;
        *running = false;
    }
    
    /// Schedule an email
    pub async fn schedule_email(
        &self,
        mut email: ScheduledEmail,
    ) -> Result<Uuid, SchedulerError> {
        // Validate timezone
        if !email.timezone.is_empty() {
            email.timezone.parse::<Tz>()
                .map_err(|_| SchedulerError::InvalidTimezone(email.timezone.clone()))?;
        }
        
        // Validate recurring pattern if present
        if let Some(recurring) = &email.recurring {
            Self::validate_recurring_pattern(recurring)?;
        }
        
        // Check if email is already scheduled
        let mut scheduled_emails = self.scheduled_emails.write().await;
        if scheduled_emails.contains_key(&email.id) {
            return Err(SchedulerError::AlreadyScheduled(email.id));
        }
        
        let email_id = email.id;
        scheduled_emails.insert(email_id, email);
        
        let _ = self.event_sender.send(SchedulerEvent::EmailScheduled(email_id));
        
        Ok(email_id)
    }
    
    /// Cancel a scheduled email
    pub async fn cancel_email(&self, email_id: Uuid) -> Result<(), SchedulerError> {
        let mut scheduled_emails = self.scheduled_emails.write().await;
        
        if let Some(mut email) = scheduled_emails.remove(&email_id) {
            email.status = ScheduleStatus::Cancelled;
            let _ = self.event_sender.send(SchedulerEvent::EmailCancelled(email_id));
            Ok(())
        } else {
            Err(SchedulerError::NotFound(email_id))
        }
    }
    
    /// Get scheduled email by ID
    pub async fn get_scheduled_email(&self, email_id: Uuid) -> Option<ScheduledEmail> {
        let scheduled_emails = self.scheduled_emails.read().await;
        scheduled_emails.get(&email_id).cloned()
    }
    
    /// List all scheduled emails
    pub async fn list_scheduled_emails(
        &self,
        user_id: Option<Uuid>,
        status: Option<ScheduleStatus>,
    ) -> Vec<ScheduledEmail> {
        let scheduled_emails = self.scheduled_emails.read().await;
        
        scheduled_emails
            .values()
            .filter(|email| {
                if let Some(user_id) = user_id {
                    if email.user_id != user_id {
                        return false;
                    }
                }
                
                if let Some(status) = status {
                    if email.status != status {
                        return false;
                    }
                }
                
                true
            })
            .cloned()
            .collect()
    }
    
    /// Update scheduled email
    pub async fn update_scheduled_email(
        &self,
        email_id: Uuid,
        updates: ScheduledEmailUpdate,
    ) -> Result<(), SchedulerError> {
        let mut scheduled_emails = self.scheduled_emails.write().await;
        
        if let Some(email) = scheduled_emails.get_mut(&email_id) {
            if let Some(scheduled_time) = updates.scheduled_time {
                email.scheduled_time = scheduled_time;
            }
            
            if let Some(timezone) = updates.timezone {
                // Validate timezone
                timezone.parse::<Tz>()
                    .map_err(|_| SchedulerError::InvalidTimezone(timezone.clone()))?;
                email.timezone = timezone;
            }
            
            if let Some(subject) = updates.subject {
                email.subject = subject;
            }
            
            if let Some(body_html) = updates.body_html {
                email.body_html = body_html;
            }
            
            if let Some(body_text) = updates.body_text {
                email.body_text = body_text;
            }
            
            if let Some(priority) = updates.priority {
                email.priority = priority;
            }
            
            email.updated_at = Utc::now();
            
            Ok(())
        } else {
            Err(SchedulerError::NotFound(email_id))
        }
    }
    
    /// Get event receiver for listening to scheduler events
    pub async fn take_event_receiver(&self) -> Option<mpsc::UnboundedReceiver<SchedulerEvent>> {
        self.event_receiver.write().await.take()
    }
    
    /// Convert local time to UTC based on timezone
    pub fn local_to_utc(
        local_time: DateTime<chrono::offset::FixedOffset>,
        timezone: &str,
    ) -> Result<DateTime<Utc>, SchedulerError> {
        let tz: Tz = timezone.parse()
            .map_err(|_| SchedulerError::InvalidTimezone(timezone.to_string()))?;
        
        let local_dt = tz.from_local_datetime(&local_time.naive_local())
            .single()
            .ok_or_else(|| SchedulerError::InvalidTimezone(format!("Ambiguous local time: {}", local_time)))?;
        
        Ok(local_dt.with_timezone(&Utc))
    }
    
    /// Convert UTC time to local time based on timezone
    pub fn utc_to_local(
        utc_time: DateTime<Utc>,
        timezone: &str,
    ) -> Result<DateTime<chrono_tz::Tz>, SchedulerError> {
        let tz: Tz = timezone.parse()
            .map_err(|_| SchedulerError::InvalidTimezone(timezone.to_string()))?;
        
        Ok(utc_time.with_timezone(&tz))
    }
    
    /// Validate recurring pattern
    fn validate_recurring_pattern(recurring: &RecurringSettings) -> Result<(), SchedulerError> {
        if recurring.interval <= 0 {
            return Err(SchedulerError::InvalidRecurringPattern("Interval must be positive".to_string()));
        }
        
        match recurring.pattern {
            RecurringPattern::Weekly => {
                if let Some(days) = &recurring.days_of_week {
                    for &day in days {
                        if day > 6 {
                            return Err(SchedulerError::InvalidRecurringPattern("Day of week must be 0-6".to_string()));
                        }
                    }
                }
            },
            RecurringPattern::Monthly => {
                if let Some(day) = recurring.day_of_month {
                    if day < 1 || day > 31 {
                        return Err(SchedulerError::InvalidRecurringPattern("Day of month must be 1-31".to_string()));
                    }
                }
            },
            RecurringPattern::Yearly => {
                if let Some(month) = recurring.month_of_year {
                    if month < 1 || month > 12 {
                        return Err(SchedulerError::InvalidRecurringPattern("Month of year must be 1-12".to_string()));
                    }
                }
            },
            _ => {}
        }
        
        match recurring.end_type {
            RecurringEndType::Occurrences => {
                if recurring.occurrence_count.is_none() || recurring.occurrence_count.unwrap() <= 0 {
                    return Err(SchedulerError::InvalidRecurringPattern("Occurrence count must be positive".to_string()));
                }
            },
            RecurringEndType::Date => {
                if recurring.end_date.is_none() {
                    return Err(SchedulerError::InvalidRecurringPattern("End date is required".to_string()));
                }
            },
            _ => {}
        }
        
        Ok(())
    }
    
    /// Create the next occurrence of a recurring email
    fn create_next_recurring_email(
        base_email: &ScheduledEmail,
        recurring: &RecurringSettings,
    ) -> Result<ScheduledEmail, SchedulerError> {
        let next_time = Self::calculate_next_occurrence(base_email.scheduled_time, recurring)?;
        
        // Check if we should continue creating occurrences
        match recurring.end_type {
            RecurringEndType::Date => {
                if let Some(end_date) = recurring.end_date {
                    if next_time > end_date {
                        return Err(SchedulerError::InvalidRecurringPattern("Recurring end date reached".to_string()));
                    }
                }
            },
            RecurringEndType::Occurrences => {
                // This would need to be tracked in the recurring settings
                // For now, we'll assume the caller manages occurrence counting
            },
            _ => {}
        }
        
        let mut next_email = base_email.clone();
        next_email.id = Uuid::new_v4();
        next_email.scheduled_time = next_time;
        next_email.status = ScheduleStatus::Pending;
        next_email.send_attempts = 0;
        next_email.sent_at = None;
        next_email.last_attempt_at = None;
        next_email.error_message = None;
        next_email.created_at = Utc::now();
        next_email.updated_at = Utc::now();
        
        Ok(next_email)
    }
    
    /// Calculate the next occurrence time for recurring email
    fn calculate_next_occurrence(
        current_time: DateTime<Utc>,
        recurring: &RecurringSettings,
    ) -> Result<DateTime<Utc>, SchedulerError> {
        let next_time = match recurring.pattern {
            RecurringPattern::Daily => {
                current_time + Duration::days(recurring.interval as i64)
            },
            RecurringPattern::Weekdays => {
                let mut next = current_time + Duration::days(1);
                while next.weekday().num_days_from_monday() >= 5 {
                    next = next + Duration::days(1);
                }
                next
            },
            RecurringPattern::Weekly => {
                if let Some(days_of_week) = &recurring.days_of_week {
                    let current_weekday = current_time.weekday().num_days_from_sunday() as u8;
                    
                    // Find next day in the same week
                    if let Some(&next_day) = days_of_week.iter().find(|&&d| d > current_weekday) {
                        let days_ahead = (next_day - current_weekday) as i64;
                        current_time + Duration::days(days_ahead)
                    } else {
                        // Go to next week and use first day
                        let days_to_next_week = 7 - current_weekday as i64;
                        let first_day = days_of_week[0] as i64;
                        current_time + Duration::days(days_to_next_week + first_day)
                    }
                } else {
                    current_time + Duration::weeks(recurring.interval as i64)
                }
            },
            RecurringPattern::Monthly => {
                // Add months (approximate)
                current_time + Duration::days(30 * recurring.interval as i64)
            },
            RecurringPattern::Yearly => {
                // Add years (approximate)
                current_time + Duration::days(365 * recurring.interval as i64)
            },
            RecurringPattern::Custom => {
                // Custom patterns would need more complex logic
                current_time + Duration::days(recurring.interval as i64)
            },
        };
        
        // Skip weekends if configured
        let mut final_time = next_time;
        if recurring.skip_weekends {
            while final_time.weekday().num_days_from_monday() >= 5 {
                final_time = final_time + Duration::days(1);
            }
        }
        
        Ok(final_time)
    }
}

/// Update structure for scheduled emails
#[derive(Debug, Clone, Default)]
pub struct ScheduledEmailUpdate {
    pub scheduled_time: Option<DateTime<Utc>>,
    pub timezone: Option<String>,
    pub subject: Option<String>,
    pub body_html: Option<String>,
    pub body_text: Option<String>,
    pub priority: Option<SchedulePriority>,
}

/// Scheduler statistics
#[derive(Debug, Clone)]
pub struct SchedulerStats {
    pub total_scheduled: usize,
    pub pending: usize,
    pub sent: usize,
    pub failed: usize,
    pub cancelled: usize,
    pub recurring_active: usize,
}

impl EmailScheduler {
    /// Get scheduler statistics
    pub async fn get_stats(&self) -> SchedulerStats {
        let scheduled_emails = self.scheduled_emails.read().await;
        
        let mut stats = SchedulerStats {
            total_scheduled: scheduled_emails.len(),
            pending: 0,
            sent: 0,
            failed: 0,
            cancelled: 0,
            recurring_active: 0,
        };
        
        for email in scheduled_emails.values() {
            match email.status {
                ScheduleStatus::Pending => stats.pending += 1,
                ScheduleStatus::Sent => stats.sent += 1,
                ScheduleStatus::Failed => stats.failed += 1,
                ScheduleStatus::Cancelled => stats.cancelled += 1,
                _ => {}
            }
            
            if email.recurring.is_some() && email.status == ScheduleStatus::Pending {
                stats.recurring_active += 1;
            }
        }
        
        stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[tokio::test]
    async fn test_schedule_email() {
        let scheduler = EmailScheduler::new(|_email| Ok(()));
        
        let scheduled_time = Utc::now() + Duration::hours(1);
        let email = ScheduledEmail {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            account_id: Uuid::new_v4(),
            template_id: None,
            to: vec![EmailAddress {
                address: "test@example.com".to_string(),
                name: Some("Test User".to_string()),
                email: "test@example.com".to_string(),
            }],
            cc: vec![],
            bcc: vec![],
            subject: "Test Email".to_string(),
            body_html: "<p>Test</p>".to_string(),
            body_text: "Test".to_string(),
            attachments: vec![],
            scheduled_time,
            timezone: "UTC".to_string(),
            status: ScheduleStatus::Pending,
            recurring: None,
            send_attempts: 0,
            max_attempts: 3,
            priority: SchedulePriority::Normal,
            metadata: HashMap::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            sent_at: None,
            last_attempt_at: None,
            error_message: None,
            expires_at: None,
        };
        
        let email_id = scheduler.schedule_email(email).await.unwrap();
        
        let retrieved = scheduler.get_scheduled_email(email_id).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().scheduled_time, scheduled_time);
    }
    
    #[test]
    fn test_timezone_conversion() {
        let local_time = chrono::offset::FixedOffset::east_opt(0).unwrap()
            .with_ymd_and_hms(2024, 12, 1, 12, 0, 0).unwrap();
        
        let utc_time = EmailScheduler::local_to_utc(local_time, "UTC").unwrap();
        assert_eq!(utc_time.hour(), 12);
        
        let back_to_local = EmailScheduler::utc_to_local(utc_time, "UTC").unwrap();
        assert_eq!(back_to_local.hour(), 12);
    }
}