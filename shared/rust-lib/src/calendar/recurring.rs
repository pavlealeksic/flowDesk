/*!
 * Recurring Events Engine
 * 
 * RRULE processing and recurring event instance generation.
 */

use chrono::{DateTime, Utc, TimeZone};
use serde::{Deserialize, Serialize};
use crate::calendar::{CalendarResult, CalendarError, CalendarEvent, RecurrenceRule, RecurrenceFrequency};
use rrule::{RRule, RRuleSet, Frequency as RRuleFreq, Weekday};
use std::str::FromStr;

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

        // TODO: Convert EventRecurrence to RecurrenceRule properly
        // For now, skip RRULE parsing and use simple implementation
        let _rrule_str = "FREQ=DAILY"; // Placeholder

        let event_start = master_event.start_time;

        let event_duration = master_event.end_time - event_start;

        // Generate occurrences between start_date and end_date  
        // TODO: Implement proper RRule occurrence generation
        let mut occurrences = Vec::new();
        let mut current = event_start;
        
        // Simple daily recurring implementation for now
        while current <= end_date && occurrences.len() < 100 {
            if current >= start_date {
                occurrences.push(current.naive_utc());
            }
            current += chrono::Duration::days(1);
        }

        let mut instances = Vec::new();
        for occurrence in occurrences {
            let occurrence_utc = Utc.from_utc_datetime(&occurrence);
            let instance_end = occurrence_utc + event_duration;
            
            let mut instance = master_event.clone();
            instance.id = format!("{}-{}", master_event.id, occurrence_utc.timestamp());
            instance.start_time = occurrence_utc;
            instance.end_time = instance_end;
            
            // Mark as instance of recurring event via extended_properties
            if let Some(ref mut props) = instance.extended_properties {
                if let Some(obj) = props.as_object_mut() {
                    obj.insert("is_recurring_instance".to_string(), serde_json::Value::String("true".to_string()));
                    obj.insert("master_event_id".to_string(), serde_json::Value::String(master_event.id.clone()));
                }
            } else {
                instance.extended_properties = Some(serde_json::json!({
                    "is_recurring_instance": "true",
                    "master_event_id": master_event.id.clone()
                }));
            }
            
            instances.push(instance);
        }

        Ok(instances)
    }

    /// Parse RRULE string into RecurrenceRule
    pub fn parse_rrule(rrule: &str) -> CalendarResult<RecurrenceRule> {
        let rrule = RRule::from_str(rrule)
            .map_err(|e| CalendarError::ValidationError {
                message: format!("Invalid RRULE format: {}", e),
                field: Some("rrule".to_string()),
                value: Some(rrule.to_string()),
                constraint: "valid_rrule_format".to_string(),
            })?;

        let frequency = match rrule.get_freq() {
            RRuleFreq::Yearly => RecurrenceFrequency::Yearly,
            RRuleFreq::Monthly => RecurrenceFrequency::Monthly,
            RRuleFreq::Weekly => RecurrenceFrequency::Weekly,
            RRuleFreq::Daily => RecurrenceFrequency::Daily,
            // For frequencies not supported in our enum, default to Daily
            RRuleFreq::Hourly => RecurrenceFrequency::Daily,
            RRuleFreq::Minutely => RecurrenceFrequency::Daily,
            RRuleFreq::Secondly => RecurrenceFrequency::Daily,
        };

        let interval = rrule.get_interval() as u32;
        let count = rrule.get_count().map(|c| c as u32);
        let until = rrule.get_until().map(|dt| Utc.from_utc_datetime(&dt.naive_utc()).to_rfc3339());
        
        // TODO: Implement proper RRule parsing

        Ok(RecurrenceRule {
            frequency,
            interval: interval as i32,
            count: count.map(|c| c as i32),
            until: until.and_then(|u| DateTime::parse_from_rfc3339(&u).ok().map(|dt| dt.with_timezone(&Utc))),
        })
    }

    /// Convert RecurrenceRule to RRULE string
    pub fn to_rrule_string(rule: &RecurrenceRule) -> String {
        let mut rrule_parts = Vec::new();
        
        // Frequency (required)
        let freq_str = match rule.frequency {
            RecurrenceFrequency::Yearly => "YEARLY",
            RecurrenceFrequency::Monthly => "MONTHLY",
            RecurrenceFrequency::Weekly => "WEEKLY",
            RecurrenceFrequency::Daily => "DAILY",
        };
        rrule_parts.push(format!("FREQ={}", freq_str));
        
        // Interval
        if rule.interval > 1 {
            rrule_parts.push(format!("INTERVAL={}", rule.interval));
        }
        
        // Count
        if let Some(count) = rule.count {
            rrule_parts.push(format!("COUNT={}", count));
        }
        
        // Until
        if let Some(until) = &rule.until {
            rrule_parts.push(format!("UNTIL={}", until.format("%Y%m%dT%H%M%SZ")));
        }
        
        // TODO: Add support for additional recurrence options (by_weekday, by_monthday, etc.)
        // For now, only basic frequency, interval, count, and until are supported
        
        format!("RRULE:{}", rrule_parts.join(";"))
    }

    /// Check if a date matches a recurrence pattern
    pub fn matches_recurrence(
        rule: &RecurrenceRule,
        date: DateTime<Utc>,
        start_date: DateTime<Utc>,
    ) -> bool {
        // TODO: Implement proper RRule-based date matching
        // For now, use simple daily recurrence matching
        match rule.frequency {
            RecurrenceFrequency::Daily => {
                let days_diff = (date.date_naive() - start_date.date_naive()).num_days();
                days_diff >= 0 && days_diff % (rule.interval as i64) == 0
            },
            _ => false, // Other frequencies not implemented yet
        }
    }

    /// Get next occurrence after given date
    pub fn next_occurrence(
        rule: &RecurrenceRule,
        after: DateTime<Utc>,
        start_date: DateTime<Utc>,
    ) -> Option<DateTime<Utc>> {
        // TODO: Implement proper next occurrence calculation
        // For now, use simple daily recurrence
        match rule.frequency {
            RecurrenceFrequency::Daily => {
                Some(after + chrono::Duration::days(rule.interval as i64))
            },
            _ => None, // Other frequencies not implemented yet
        }
    }
    
    /// Get all occurrences in a date range
    pub fn get_occurrences_in_range(
        rule: &RecurrenceRule,
        start_date: DateTime<Utc>,
        range_start: DateTime<Utc>,
        range_end: DateTime<Utc>,
    ) -> CalendarResult<Vec<DateTime<Utc>>> {
        // TODO: Implement proper range-based occurrence generation
        // For now, use simple daily recurrence
        let mut occurrences = Vec::new();
        let mut current = start_date.max(range_start);
        
        // Generate up to 100 occurrences to avoid infinite loops
        while current <= range_end && occurrences.len() < 100 {
            if current >= range_start {
                occurrences.push(current);
            }
            match rule.frequency {
                RecurrenceFrequency::Daily => {
                    current += chrono::Duration::days(rule.interval as i64);
                },
                _ => break, // Other frequencies not implemented yet
            }
        }
        
        Ok(occurrences)
    }
    
    /// Check if a recurring event has expired (past until date or count reached)
    pub fn is_recurrence_expired(
        rule: &RecurrenceRule,
        start_date: DateTime<Utc>,
        current_date: DateTime<Utc>,
    ) -> bool {
        // Check until date
        if let Some(until_date) = &rule.until {
            if current_date > *until_date {
                return true;
            }
        }
        
        // Check count
        if let Some(count) = rule.count {
            // TODO: Implement proper count checking
            // For now, use simple calculation based on days elapsed and frequency
            match rule.frequency {
                RecurrenceFrequency::Daily => {
                    let days_elapsed = (current_date.date_naive() - start_date.date_naive()).num_days();
                    let occurrences_so_far = (days_elapsed / rule.interval as i64) + 1;
                    return occurrences_so_far >= count as i64;
                },
                _ => return false, // Other frequencies not implemented yet
            }
        }
        
        false
    }
}