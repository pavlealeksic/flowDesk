/*!
 * Recurring Events Engine
 * 
 * Complete RRULE processing and recurring event instance generation
 * using RFC 5545 compliant implementation.
 */

use chrono::{DateTime, Utc, TimeZone, Datelike, Weekday as ChronoWeekday};
use serde::{Deserialize, Serialize};
use crate::calendar::{CalendarResult, CalendarError, CalendarEvent, RecurrenceRule, RecurrenceFrequency};
use rrule::{RRule, RRuleSet, Frequency as RRuleFreq, Weekday};
use std::str::FromStr;
use std::collections::HashMap;

pub struct RecurringEventEngine;

impl RecurringEventEngine {
    /// Generate recurring event instances from an RRULE
    pub fn generate_instances(
        master_event: &CalendarEvent,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> CalendarResult<Vec<CalendarEvent>> {
        let recurrence = match &master_event.recurrence {
            Some(rule) => rule,
            None => return Ok(vec![master_event.clone()]),
        };

        // Convert RecurrenceRule to RRULE string
        let rrule_str = Self::convert_recurrence_rule_to_rrule(recurrence)?;
        
        // Parse RRULE using the rrule crate
        let rrule = RRule::from_str(&rrule_str)
            .map_err(|e| CalendarError::ParseError {
                message: format!("Invalid RRULE: {}", e),
                data_type: "rrule".to_string(),
            })?;

        // Generate occurrences between start_date and end_date
        let event_start = master_event.start_time;
        let event_duration = master_event.end_time - event_start;

        // Set DTSTART to the master event start time
        let rrule_set = RRuleSet::new(event_start);
        let rrule_set = rrule_set.rrule(rrule);

        // Generate occurrences in the specified range
        let occurrences = rrule_set.all(500); // Limit to 500 occurrences for performance

        let mut instances = Vec::new();
        for occurrence in occurrences {
            let occurrence_utc = occurrence.with_timezone(&Utc);
            
            // Skip occurrences outside our range
            if occurrence_utc < start_date || occurrence_utc > end_date {
                continue;
            }

            // Create event instance
            let mut instance = master_event.clone();
            instance.id = uuid::Uuid::new_v4();
            instance.start_time = occurrence_utc;
            instance.end_time = occurrence_utc + event_duration;
            instance.recurring_event_id = Some(master_event.id.to_string());
            instance.original_start_time = Some(occurrence_utc);
            
            instances.push(instance);
        }

        Ok(instances)
    }

    /// Convert RecurrenceRule to RFC 5545 RRULE string
    pub fn convert_recurrence_rule_to_rrule(rule: &RecurrenceRule) -> CalendarResult<String> {
        let mut rrule_parts = Vec::new();

        // Frequency (required)
        let freq = match rule.frequency {
            RecurrenceFrequency::Daily => "DAILY",
            RecurrenceFrequency::Weekly => "WEEKLY", 
            RecurrenceFrequency::Monthly => "MONTHLY",
            RecurrenceFrequency::Yearly => "YEARLY",
        };
        rrule_parts.push(format!("FREQ={}", freq));

        // Interval
        if rule.interval > 1 {
            rrule_parts.push(format!("INTERVAL={}", rule.interval));
        }

        // Count
        if let Some(count) = rule.count {
            rrule_parts.push(format!("COUNT={}", count));
        }

        // Until
        if let Some(until) = rule.until {
            rrule_parts.push(format!("UNTIL={}", until.format("%Y%m%dT%H%M%SZ")));
        }

        // By day
        if let Some(ref by_day) = rule.by_day {
            if !by_day.is_empty() {
                let days: Vec<String> = by_day.iter().map(|day| {
                    match day {
                        0 => "SU",
                        1 => "MO", 
                        2 => "TU",
                        3 => "WE",
                        4 => "TH",
                        5 => "FR",
                        6 => "SA",
                        _ => "SU", // Default fallback
                    }
                }.to_string()).collect();
                rrule_parts.push(format!("BYDAY={}", days.join(",")));
            }
        }

        // By month day
        if let Some(ref by_month_day) = rule.by_month_day {
            if !by_month_day.is_empty() {
                let days: Vec<String> = by_month_day.iter().map(|d| d.to_string()).collect();
                rrule_parts.push(format!("BYMONTHDAY={}", days.join(",")));
            }
        }

        // By month
        if let Some(ref by_month) = rule.by_month {
            if !by_month.is_empty() {
                let months: Vec<String> = by_month.iter().map(|m| m.to_string()).collect();
                rrule_parts.push(format!("BYMONTH={}", months.join(",")));
            }
        }

        Ok(format!("RRULE:{}", rrule_parts.join(";")))
    }

    /// Parse RRULE string to RecurrenceRule
    pub fn parse_rrule_to_recurrence_rule(rrule_str: &str) -> CalendarResult<RecurrenceRule> {
        let rrule = RRule::from_str(rrule_str)
            .map_err(|e| CalendarError::ParseError {
                message: format!("Failed to parse RRULE: {}", e),
                data_type: "rrule".to_string(),
            })?;

        // Extract frequency
        let frequency = match rrule.get_freq() {
            RRuleFreq::Daily => RecurrenceFrequency::Daily,
            RRuleFreq::Weekly => RecurrenceFrequency::Weekly,
            RRuleFreq::Monthly => RecurrenceFrequency::Monthly,
            RRuleFreq::Yearly => RecurrenceFrequency::Yearly,
            _ => RecurrenceFrequency::Daily, // Default fallback
        };

        // Extract interval
        let interval = rrule.get_interval();

        // Extract count
        let count = rrule.get_count();

        // Extract until
        let until = rrule.get_until().map(|dt| dt.with_timezone(&Utc));

        // Extract by_day
        let by_day = if let Some(by_weekday) = rrule.get_by_weekday() {
            Some(by_weekday.iter().map(|wd| {
                match wd.weekday {
                    Weekday::Mon => 1,
                    Weekday::Tue => 2,
                    Weekday::Wed => 3,
                    Weekday::Thu => 4,
                    Weekday::Fri => 5,
                    Weekday::Sat => 6,
                    Weekday::Sun => 0,
                }
            }).collect())
        } else {
            None
        };

        // Extract by_month_day
        let by_month_day = rrule.get_by_monthday().map(|days| days.to_vec());

        // Extract by_month
        let by_month = rrule.get_by_month().map(|months| months.to_vec());

        Ok(RecurrenceRule {
            frequency,
            interval,
            until,
            count,
            by_day,
            by_month_day,
            by_month,
        })
    }

    /// Check if a date matches the recurrence rule
    pub fn matches_recurrence_rule(
        rule: &RecurrenceRule,
        date: DateTime<Utc>,
        master_start: DateTime<Utc>,
    ) -> bool {
        // Generate a small range around the date to check if it's an occurrence
        let start_range = date - chrono::Duration::days(1);
        let end_range = date + chrono::Duration::days(1);

        // Create a temporary event for generation
        let temp_event = CalendarEvent {
            id: uuid::Uuid::new_v4(),
            calendar_id: uuid::Uuid::new_v4(),
            account_id: uuid::Uuid::new_v4(),
            provider_id: "temp".to_string(),
            title: "temp".to_string(),
            description: None,
            location: None,
            start_time: master_start,
            end_time: master_start + chrono::Duration::hours(1),
            timezone: None,
            all_day: false,
            recurrence: Some(rule.clone()),
            recurring_event_id: None,
            original_start_time: None,
            status: crate::calendar::EventStatus::Confirmed,
            visibility: crate::calendar::EventVisibility::Default,
            attendees: vec![],
            attachments: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            extended_properties: None,
            color: None,
            uid: None,
        };

        if let Ok(instances) = Self::generate_instances(&temp_event, start_range, end_range) {
            instances.iter().any(|instance| {
                (instance.start_time - date).abs() < chrono::Duration::minutes(1)
            })
        } else {
            false
        }
    }

    /// Calculate the next occurrence after a given date
    pub fn get_next_occurrence(
        rule: &RecurrenceRule,
        after: DateTime<Utc>,
        master_start: DateTime<Utc>,
    ) -> CalendarResult<Option<DateTime<Utc>>> {
        // Generate occurrences in a reasonable range after the date
        let search_end = after + chrono::Duration::days(365); // Search up to 1 year ahead

        let temp_event = CalendarEvent {
            id: uuid::Uuid::new_v4(),
            calendar_id: uuid::Uuid::new_v4(),
            account_id: uuid::Uuid::new_v4(),
            provider_id: "temp".to_string(),
            title: "temp".to_string(),
            description: None,
            location: None,
            start_time: master_start,
            end_time: master_start + chrono::Duration::hours(1),
            timezone: None,
            all_day: false,
            recurrence: Some(rule.clone()),
            recurring_event_id: None,
            original_start_time: None,
            status: crate::calendar::EventStatus::Confirmed,
            visibility: crate::calendar::EventVisibility::Default,
            attendees: vec![],
            attachments: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            extended_properties: None,
            color: None,
            uid: None,
        };

        let instances = Self::generate_instances(&temp_event, after, search_end)?;
        
        Ok(instances.into_iter()
            .find(|instance| instance.start_time > after)
            .map(|instance| instance.start_time))
    }

    /// Generate occurrences within a specific range with proper count/until handling
    pub fn generate_occurrences_in_range(
        rule: &RecurrenceRule,
        master_start: DateTime<Utc>,
        range_start: DateTime<Utc>,
        range_end: DateTime<Utc>,
    ) -> CalendarResult<Vec<DateTime<Utc>>> {
        let rrule_str = Self::convert_recurrence_rule_to_rrule(rule)?;
        
        let rrule = RRule::from_str(&rrule_str)
            .map_err(|e| CalendarError::ParseError {
                message: format!("Invalid RRULE: {}", e),
                data_type: "rrule".to_string(),
            })?;

        let rrule_set = RRuleSet::new(master_start);
        let rrule_set = rrule_set.rrule(rrule);

        // Generate all occurrences and filter by range
        let max_occurrences = rule.count.unwrap_or(1000); // Reasonable limit
        let all_occurrences = rrule_set.all(max_occurrences as u16);

        let filtered_occurrences: Vec<DateTime<Utc>> = all_occurrences
            .into_iter()
            .map(|dt| dt.with_timezone(&Utc))
            .filter(|dt| *dt >= range_start && *dt <= range_end)
            .collect();

        Ok(filtered_occurrences)
    }

    /// Check if we should generate more occurrences based on count limits
    pub fn should_generate_more_occurrences(
        rule: &RecurrenceRule,
        generated_count: usize,
        last_occurrence: DateTime<Utc>,
    ) -> bool {
        // Check count limit
        if let Some(count_limit) = rule.count {
            if generated_count >= count_limit as usize {
                return false;
            }
        }

        // Check until limit  
        if let Some(until_date) = rule.until {
            if last_occurrence >= until_date {
                return false;
            }
        }

        // Continue generating if neither limit is reached
        true
    }

    /// Validate a recurrence rule for correctness
    pub fn validate_recurrence_rule(rule: &RecurrenceRule) -> CalendarResult<()> {
        // Basic validation
        if rule.interval < 1 {
            return Err(CalendarError::ValidationError {
                message: "Recurrence interval must be at least 1".to_string(),
                field: Some("interval".to_string()),
                value: Some(rule.interval.to_string()),
                constraint: "minimum_value".to_string(),
            });
        }

        // Validate count and until are not both specified
        if rule.count.is_some() && rule.until.is_some() {
            return Err(CalendarError::ValidationError {
                message: "Cannot specify both COUNT and UNTIL in recurrence rule".to_string(),
                field: Some("recurrence".to_string()),
                value: None,
                constraint: "exclusive_fields".to_string(),
            });
        }

        // Validate by_day values
        if let Some(ref by_day) = rule.by_day {
            for &day in by_day {
                if day > 6 {
                    return Err(CalendarError::ValidationError {
                        message: format!("Invalid weekday value: {}. Must be 0-6", day),
                        field: Some("by_day".to_string()),
                        value: Some(day.to_string()),
                        constraint: "range".to_string(),
                    });
                }
            }
        }

        // Validate by_month values
        if let Some(ref by_month) = rule.by_month {
            for &month in by_month {
                if month < 1 || month > 12 {
                    return Err(CalendarError::ValidationError {
                        message: format!("Invalid month value: {}. Must be 1-12", month),
                        field: Some("by_month".to_string()),
                        value: Some(month.to_string()),
                        constraint: "range".to_string(),
                    });
                }
            }
        }

        // Validate by_month_day values
        if let Some(ref by_month_day) = rule.by_month_day {
            for &day in by_month_day {
                if day < -31 || day > 31 || day == 0 {
                    return Err(CalendarError::ValidationError {
                        message: format!("Invalid month day value: {}. Must be 1-31 or -1 to -31", day),
                        field: Some("by_month_day".to_string()),
                        value: Some(day.to_string()),
                        constraint: "range".to_string(),
                    });
                }
            }
        }

        Ok(())
    }

    /// Get next N occurrences after a given date
    pub fn get_next_n_occurrences(
        rule: &RecurrenceRule,
        after: DateTime<Utc>,
        master_start: DateTime<Utc>,
        n: usize,
    ) -> CalendarResult<Vec<DateTime<Utc>>> {
        let rrule_str = Self::convert_recurrence_rule_to_rrule(rule)?;
        
        let rrule = RRule::from_str(&rrule_str)
            .map_err(|e| CalendarError::ParseError {
                message: format!("Invalid RRULE: {}", e),
                data_type: "rrule".to_string(),
            })?;

        let rrule_set = RRuleSet::new(master_start);
        let rrule_set = rrule_set.rrule(rrule);

        // Generate more occurrences than needed, then filter and limit
        let all_occurrences = rrule_set.all((n * 2).min(1000) as u16);

        let next_occurrences: Vec<DateTime<Utc>> = all_occurrences
            .into_iter()
            .map(|dt| dt.with_timezone(&Utc))
            .filter(|dt| *dt > after)
            .take(n)
            .collect();

        Ok(next_occurrences)
    }

    /// Check if an event is a recurring event instance
    pub fn is_recurring_instance(event: &CalendarEvent) -> bool {
        event.recurring_event_id.is_some() || event.recurrence.is_some()
    }

    /// Get the master event ID for a recurring instance
    pub fn get_master_event_id(event: &CalendarEvent) -> Option<String> {
        event.recurring_event_id.clone()
    }

    /// Create an exception for a recurring event instance
    pub fn create_recurrence_exception(
        master_event: &CalendarEvent,
        exception_date: DateTime<Utc>,
        modified_event: Option<CalendarEvent>,
    ) -> CalendarResult<CalendarEvent> {
        let mut exception_event = if let Some(modified) = modified_event {
            modified
        } else {
            // Create a copy of the master event for the exception date
            let mut event = master_event.clone();
            event.id = uuid::Uuid::new_v4();
            event.start_time = exception_date;
            event.end_time = exception_date + (master_event.end_time - master_event.start_time);
            event
        };

        // Mark as exception
        exception_event.recurring_event_id = Some(master_event.id.to_string());
        exception_event.original_start_time = Some(exception_date);
        exception_event.recurrence = None; // Exceptions don't have recurrence

        Ok(exception_event)
    }

    /// Calculate statistics for a recurrence rule
    pub fn calculate_recurrence_stats(
        rule: &RecurrenceRule,
        master_start: DateTime<Utc>,
        analysis_period_days: u32,
    ) -> CalendarResult<RecurrenceStats> {
        let analysis_end = master_start + chrono::Duration::days(analysis_period_days as i64);
        let occurrences = Self::generate_occurrences_in_range(
            rule,
            master_start,
            master_start,
            analysis_end,
        )?;

        let total_occurrences = occurrences.len();
        let occurrences_per_week = if analysis_period_days >= 7 {
            (total_occurrences as f64 * 7.0) / analysis_period_days as f64
        } else {
            total_occurrences as f64
        };

        let next_occurrence = Self::get_next_occurrence(rule, Utc::now(), master_start)?;

        Ok(RecurrenceStats {
            total_occurrences_in_period: total_occurrences,
            occurrences_per_week,
            next_occurrence,
            frequency: rule.frequency.clone(),
            interval: rule.interval,
            has_end_condition: rule.count.is_some() || rule.until.is_some(),
        })
    }
}

/// Statistics for recurring events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurrenceStats {
    pub total_occurrences_in_period: usize,
    pub occurrences_per_week: f64,
    pub next_occurrence: Option<DateTime<Utc>>,
    pub frequency: RecurrenceFrequency,
    pub interval: u32,
    pub has_end_condition: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn create_test_event(recurrence: Option<RecurrenceRule>) -> CalendarEvent {
        CalendarEvent {
            id: Uuid::new_v4(),
            calendar_id: Uuid::new_v4(),
            account_id: Uuid::new_v4(),
            provider_id: "test".to_string(),
            title: "Test Event".to_string(),
            description: None,
            location: None,
            start_time: Utc::now(),
            end_time: Utc::now() + chrono::Duration::hours(1),
            timezone: None,
            all_day: false,
            recurrence,
            recurring_event_id: None,
            original_start_time: None,
            status: crate::calendar::EventStatus::Confirmed,
            visibility: crate::calendar::EventVisibility::Default,
            attendees: vec![],
            attachments: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            extended_properties: None,
            color: None,
            uid: None,
        }
    }

    #[test]
    fn test_daily_recurrence() {
        let rule = RecurrenceRule {
            frequency: RecurrenceFrequency::Daily,
            interval: 1,
            until: None,
            count: Some(5),
            by_day: None,
            by_month_day: None,
            by_month: None,
        };

        let event = create_test_event(Some(rule));
        let start = Utc::now();
        let end = start + chrono::Duration::days(10);

        let instances = RecurringEventEngine::generate_instances(&event, start, end).unwrap();
        assert_eq!(instances.len(), 5); // Should generate exactly 5 instances
    }

    #[test]
    fn test_weekly_recurrence() {
        let rule = RecurrenceRule {
            frequency: RecurrenceFrequency::Weekly,
            interval: 1,
            until: None,
            count: None,
            by_day: Some(vec![1, 3, 5]), // Monday, Wednesday, Friday
            by_month_day: None,
            by_month: None,
        };

        let rrule_str = RecurringEventEngine::convert_recurrence_rule_to_rrule(&rule).unwrap();
        assert!(rrule_str.contains("FREQ=WEEKLY"));
        assert!(rrule_str.contains("BYDAY=MO,WE,FR"));
    }

    #[test]
    fn test_rrule_parsing() {
        let rrule_str = "RRULE:FREQ=DAILY;INTERVAL=2;COUNT=10";
        let rule = RecurringEventEngine::parse_rrule_to_recurrence_rule(rrule_str).unwrap();
        
        assert_eq!(rule.frequency, RecurrenceFrequency::Daily);
        assert_eq!(rule.interval, 2);
        assert_eq!(rule.count, Some(10));
        assert!(rule.until.is_none());
    }

    #[test]
    fn test_recurrence_validation() {
        let valid_rule = RecurrenceRule {
            frequency: RecurrenceFrequency::Daily,
            interval: 1,
            until: None,
            count: Some(5),
            by_day: None,
            by_month_day: None,
            by_month: None,
        };

        assert!(RecurringEventEngine::validate_recurrence_rule(&valid_rule).is_ok());

        let invalid_rule = RecurrenceRule {
            frequency: RecurrenceFrequency::Daily,
            interval: 0, // Invalid interval
            until: None,
            count: Some(5),
            by_day: None,
            by_month_day: None,
            by_month: None,
        };

        assert!(RecurringEventEngine::validate_recurrence_rule(&invalid_rule).is_err());
    }
}