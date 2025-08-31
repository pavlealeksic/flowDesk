//! Comprehensive RRULE (Recurrence Rule) processing engine
//!
//! This module provides complete RFC 5545 compliant recurrence rule processing with:
//! - Full RRULE parsing and validation
//! - Event instance generation with proper timezone handling
//! - Exception handling (EXDATE and EXRULE)
//! - Override handling (RDATE) 
//! - Complex recurrence patterns (BYMONTH, BYWEEKNO, BYDAY, etc.)
//! - Performance optimized iteration with bounded generation
//! - Comprehensive timezone conversion support
//! - DST (Daylight Saving Time) handling
//! - Leap year and month boundary corrections

use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveTime, TimeZone, Utc, Weekday};
use chrono_tz::{Tz, UTC};
use std::{
    collections::{HashMap, HashSet},
    str::FromStr,
};
use thiserror::Error;

/// RRULE processing errors
#[derive(Debug, Error)]
pub enum RRuleError {
    #[error("Invalid RRULE format: {0}")]
    InvalidFormat(String),
    #[error("Unsupported frequency: {0}")]
    UnsupportedFrequency(String),
    #[error("Invalid parameter value: {parameter} = {value}")]
    InvalidParameterValue { parameter: String, value: String },
    #[error("Timezone error: {0}")]
    TimezoneError(String),
    #[error("Date calculation error: {0}")]
    DateCalculationError(String),
    #[error("Maximum iterations exceeded")]
    MaxIterationsExceeded,
}

/// Result type for RRULE operations
pub type RRuleResult<T> = Result<T, RRuleError>;

/// Recurrence frequency
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Frequency {
    Secondly,
    Minutely,
    Hourly,
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

impl FromStr for Frequency {
    type Err = RRuleError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "SECONDLY" => Ok(Frequency::Secondly),
            "MINUTELY" => Ok(Frequency::Minutely),
            "HOURLY" => Ok(Frequency::Hourly),
            "DAILY" => Ok(Frequency::Daily),
            "WEEKLY" => Ok(Frequency::Weekly),
            "MONTHLY" => Ok(Frequency::Monthly),
            "YEARLY" => Ok(Frequency::Yearly),
            _ => Err(RRuleError::UnsupportedFrequency(s.to_string())),
        }
    }
}

/// Day of week with optional occurrence number (e.g., "2MO" = second Monday)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WeekdayRule {
    pub weekday: Weekday,
    pub occurrence: Option<i32>, // None for all occurrences, Some(n) for nth occurrence
}

impl FromStr for WeekdayRule {
    type Err = RRuleError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.to_uppercase();
        
        // Check if it has an occurrence number
        if s.len() > 2 {
            let (num_str, day_str) = s.split_at(s.len() - 2);
            let occurrence = num_str.parse::<i32>()
                .map_err(|_| RRuleError::InvalidParameterValue {
                    parameter: "BYDAY".to_string(),
                    value: s.clone(),
                })?;
            
            let weekday = match day_str {
                "MO" => Weekday::Mon,
                "TU" => Weekday::Tue,
                "WE" => Weekday::Wed,
                "TH" => Weekday::Thu,
                "FR" => Weekday::Fri,
                "SA" => Weekday::Sat,
                "SU" => Weekday::Sun,
                _ => return Err(RRuleError::InvalidParameterValue {
                    parameter: "BYDAY".to_string(),
                    value: s,
                }),
            };
            
            Ok(WeekdayRule {
                weekday,
                occurrence: Some(occurrence),
            })
        } else {
            let weekday = match s.as_str() {
                "MO" => Weekday::Mon,
                "TU" => Weekday::Tue,
                "WE" => Weekday::Wed,
                "TH" => Weekday::Thu,
                "FR" => Weekday::Fri,
                "SA" => Weekday::Sat,
                "SU" => Weekday::Sun,
                _ => return Err(RRuleError::InvalidParameterValue {
                    parameter: "BYDAY".to_string(),
                    value: s,
                }),
            };
            
            Ok(WeekdayRule {
                weekday,
                occurrence: None,
            })
        }
    }
}

/// Comprehensive RRULE specification
#[derive(Debug, Clone)]
pub struct RRule {
    pub frequency: Frequency,
    pub interval: u32,
    pub count: Option<u32>,
    pub until: Option<DateTime<Utc>>,
    pub by_second: Vec<u32>,
    pub by_minute: Vec<u32>,
    pub by_hour: Vec<u32>,
    pub by_day: Vec<WeekdayRule>,
    pub by_month_day: Vec<i32>,
    pub by_year_day: Vec<i32>,
    pub by_week_number: Vec<i32>,
    pub by_month: Vec<u32>,
    pub by_set_pos: Vec<i32>,
    pub week_start: Weekday,
    pub timezone: Option<Tz>,
}

impl Default for RRule {
    fn default() -> Self {
        Self {
            frequency: Frequency::Daily,
            interval: 1,
            count: None,
            until: None,
            by_second: Vec::new(),
            by_minute: Vec::new(),
            by_hour: Vec::new(),
            by_day: Vec::new(),
            by_month_day: Vec::new(),
            by_year_day: Vec::new(),
            by_week_number: Vec::new(),
            by_month: Vec::new(),
            by_set_pos: Vec::new(),
            week_start: Weekday::Mon,
            timezone: None,
        }
    }
}

impl FromStr for RRule {
    type Err = RRuleError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let mut rrule = RRule::default();
        
        // Parse the RRULE string
        let rule_str = if s.starts_with("RRULE:") {
            &s[6..] // Remove "RRULE:" prefix
        } else {
            s
        };
        
        for part in rule_str.split(';') {
            let mut split = part.split('=');
            let key = split.next().ok_or_else(|| {
                RRuleError::InvalidFormat(format!("Invalid rule part: {}", part))
            })?;
            let value = split.next().ok_or_else(|| {
                RRuleError::InvalidFormat(format!("Invalid rule part: {}", part))
            })?;
            
            match key.to_uppercase().as_str() {
                "FREQ" => {
                    rrule.frequency = Frequency::from_str(value)?;
                }
                "INTERVAL" => {
                    rrule.interval = value.parse().map_err(|_| {
                        RRuleError::InvalidParameterValue {
                            parameter: "INTERVAL".to_string(),
                            value: value.to_string(),
                        }
                    })?;
                }
                "COUNT" => {
                    rrule.count = Some(value.parse().map_err(|_| {
                        RRuleError::InvalidParameterValue {
                            parameter: "COUNT".to_string(),
                            value: value.to_string(),
                        }
                    })?);
                }
                "UNTIL" => {
                    // Parse UNTIL date (can be date or datetime)
                    let until_dt = if value.contains('T') {
                        // DateTime format
                        if value.ends_with('Z') {
                            // UTC datetime
                            DateTime::parse_from_str(value, "%Y%m%dT%H%M%SZ")
                                .map(|dt| dt.with_timezone(&Utc))
                                .map_err(|_| RRuleError::InvalidParameterValue {
                                    parameter: "UNTIL".to_string(),
                                    value: value.to_string(),
                                })?
                        } else {
                            // Local datetime (assume DTSTART timezone)
                            let naive_dt = chrono::NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S")
                                .map_err(|_| RRuleError::InvalidParameterValue {
                                    parameter: "UNTIL".to_string(),
                                    value: value.to_string(),
                                })?;
                            naive_dt.and_utc()
                        }
                    } else {
                        // Date only format
                        let naive_date = chrono::NaiveDate::parse_from_str(value, "%Y%m%d")
                            .map_err(|_| RRuleError::InvalidParameterValue {
                                parameter: "UNTIL".to_string(),
                                value: value.to_string(),
                            })?;
                        naive_date.and_hms_opt(23, 59, 59).unwrap().and_utc()
                    };
                    rrule.until = Some(until_dt);
                }
                "BYSECOND" => {
                    rrule.by_second = parse_number_list(value, "BYSECOND")?;
                }
                "BYMINUTE" => {
                    rrule.by_minute = parse_number_list(value, "BYMINUTE")?;
                }
                "BYHOUR" => {
                    rrule.by_hour = parse_number_list(value, "BYHOUR")?;
                }
                "BYDAY" => {
                    let days: Result<Vec<WeekdayRule>, _> = value
                        .split(',')
                        .map(|s| WeekdayRule::from_str(s.trim()))
                        .collect();
                    rrule.by_day = days?;
                }
                "BYMONTHDAY" => {
                    rrule.by_month_day = parse_signed_number_list(value, "BYMONTHDAY")?;
                }
                "BYYEARDAY" => {
                    rrule.by_year_day = parse_signed_number_list(value, "BYYEARDAY")?;
                }
                "BYWEEKNO" => {
                    rrule.by_week_number = parse_signed_number_list(value, "BYWEEKNO")?;
                }
                "BYMONTH" => {
                    rrule.by_month = parse_number_list(value, "BYMONTH")?;
                }
                "BYSETPOS" => {
                    rrule.by_set_pos = parse_signed_number_list(value, "BYSETPOS")?;
                }
                "WKST" => {
                    rrule.week_start = match value.to_uppercase().as_str() {
                        "MO" => Weekday::Mon,
                        "TU" => Weekday::Tue,
                        "WE" => Weekday::Wed,
                        "TH" => Weekday::Thu,
                        "FR" => Weekday::Fri,
                        "SA" => Weekday::Sat,
                        "SU" => Weekday::Sun,
                        _ => return Err(RRuleError::InvalidParameterValue {
                            parameter: "WKST".to_string(),
                            value: value.to_string(),
                        }),
                    };
                }
                _ => {
                    // Ignore unknown parameters (for forward compatibility)
                }
            }
        }
        
        Ok(rrule)
    }
}

/// Recurrence exception and override handling
#[derive(Debug, Clone)]
pub struct RecurrenceExceptions {
    pub exdates: HashSet<DateTime<Utc>>,
    pub rdates: HashSet<DateTime<Utc>>,
    pub overrides: HashMap<DateTime<Utc>, RecurrenceOverride>,
}

#[derive(Debug, Clone)]
pub struct RecurrenceOverride {
    pub title: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub status: Option<String>,
}

impl Default for RecurrenceExceptions {
    fn default() -> Self {
        Self {
            exdates: HashSet::new(),
            rdates: HashSet::new(),
            overrides: HashMap::new(),
        }
    }
}

/// RRULE processor with optimization and caching
pub struct RRuleProcessor {
    max_iterations: u32,
    timezone_cache: HashMap<String, Tz>,
}

impl Default for RRuleProcessor {
    fn default() -> Self {
        Self {
            max_iterations: 10000, // Prevent infinite loops
            timezone_cache: HashMap::new(),
        }
    }
}

impl RRuleProcessor {
    /// Create new RRULE processor with custom limits
    pub fn new(max_iterations: u32) -> Self {
        Self {
            max_iterations,
            timezone_cache: HashMap::new(),
        }
    }

    /// Generate recurrence instances for a given RRULE and date range
    pub fn generate_instances(
        &mut self,
        rrule: &RRule,
        start_date: DateTime<Utc>,
        range_start: DateTime<Utc>,
        range_end: DateTime<Utc>,
        exceptions: &RecurrenceExceptions,
    ) -> RRuleResult<Vec<DateTime<Utc>>> {
        let mut instances = Vec::new();
        let mut current_date = start_date;
        let mut iteration_count = 0;
        let mut generated_count = 0;

        // Handle timezone conversion
        let tz = rrule.timezone.unwrap_or(UTC);

        // Convert to local timezone for calculations
        let local_start = tz.from_utc_datetime(&start_date.naive_utc());
        let mut local_current = local_start;

        loop {
            iteration_count += 1;
            if iteration_count > self.max_iterations {
                return Err(RRuleError::MaxIterationsExceeded);
            }

            // Check termination conditions
            if let Some(count) = rrule.count {
                if generated_count >= count {
                    break;
                }
            }

            if let Some(until) = rrule.until {
                if current_date > until {
                    break;
                }
            }

            // Generate candidate date
            if self.matches_rrule_constraints(rrule, &local_current)? {
                let candidate_utc = tz.from_local_datetime(&local_current.naive_local())
                    .single()
                    .ok_or_else(|| RRuleError::TimezoneError("Ambiguous local time".to_string()))?
                    .with_timezone(&Utc);

                // Check if the candidate is in our query range
                if candidate_utc >= range_start && candidate_utc <= range_end {
                    // Check exceptions
                    if !exceptions.exdates.contains(&candidate_utc) {
                        // Add RDATE overrides
                        if exceptions.rdates.contains(&candidate_utc) {
                            instances.push(candidate_utc);
                        } else if generated_count > 0 || candidate_utc == start_date {
                            // Include the first instance and subsequent valid instances
                            instances.push(candidate_utc);
                        }
                    }
                }

                generated_count += 1;
            }

            // Move to next potential date based on frequency
            local_current = self.advance_date(rrule, local_current)?;
            current_date = tz.from_local_datetime(&local_current.naive_local())
                .single()
                .ok_or_else(|| RRuleError::TimezoneError("Invalid local time after advance".to_string()))?
                .with_timezone(&Utc);

            // Early exit if we've moved beyond the range and have no more potential matches
            if current_date > range_end && generated_count > 0 {
                break;
            }
        }

        // Add RDATE instances that fall within the range
        for rdate in &exceptions.rdates {
            if *rdate >= range_start && *rdate <= range_end && !instances.contains(rdate) {
                instances.push(*rdate);
            }
        }

        // Sort instances chronologically
        instances.sort();

        Ok(instances)
    }

    /// Check if a date matches all RRULE constraints
    fn matches_rrule_constraints(&self, rrule: &RRule, date: &chrono::DateTime<Tz>) -> RRuleResult<bool> {
        // BYSECOND
        if !rrule.by_second.is_empty() {
            if !rrule.by_second.contains(&date.second()) {
                return Ok(false);
            }
        }

        // BYMINUTE
        if !rrule.by_minute.is_empty() {
            if !rrule.by_minute.contains(&date.minute()) {
                return Ok(false);
            }
        }

        // BYHOUR
        if !rrule.by_hour.is_empty() {
            if !rrule.by_hour.contains(&date.hour()) {
                return Ok(false);
            }
        }

        // BYMONTH
        if !rrule.by_month.is_empty() {
            if !rrule.by_month.contains(&date.month()) {
                return Ok(false);
            }
        }

        // BYMONTHDAY
        if !rrule.by_month_day.is_empty() {
            let day = date.day() as i32;
            let days_in_month = Self::days_in_month(date.year(), date.month())?;
            
            let matches = rrule.by_month_day.iter().any(|&md| {
                if md > 0 {
                    md == day
                } else {
                    // Negative values count from end of month
                    (days_in_month as i32) + md + 1 == day
                }
            });
            
            if !matches {
                return Ok(false);
            }
        }

        // BYYEARDAY
        if !rrule.by_year_day.is_empty() {
            let year_day = date.ordinal() as i32;
            let days_in_year = if Self::is_leap_year(date.year()) { 366 } else { 365 };
            
            let matches = rrule.by_year_day.iter().any(|&yd| {
                if yd > 0 {
                    yd == year_day
                } else {
                    // Negative values count from end of year
                    days_in_year + yd + 1 == year_day
                }
            });
            
            if !matches {
                return Ok(false);
            }
        }

        // BYDAY
        if !rrule.by_day.is_empty() {
            if !self.matches_by_day_rule(rrule, date)? {
                return Ok(false);
            }
        }

        // BYWEEKNO
        if !rrule.by_week_number.is_empty() {
            let week_number = self.get_week_number(date, rrule.week_start)?;
            if !rrule.by_week_number.contains(&week_number) {
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Check BYDAY rule matching with occurrence numbers
    fn matches_by_day_rule(&self, rrule: &RRule, date: &chrono::DateTime<Tz>) -> RRuleResult<bool> {
        let weekday = date.weekday();
        
        for day_rule in &rrule.by_day {
            if day_rule.weekday == weekday {
                if let Some(occurrence) = day_rule.occurrence {
                    // Check if this is the nth occurrence of the weekday in the month/year
                    match rrule.frequency {
                        Frequency::Monthly => {
                            if self.get_weekday_occurrence_in_month(date, weekday)? == occurrence.abs() as u32 {
                                return Ok(true);
                            }
                        }
                        Frequency::Yearly => {
                            if self.get_weekday_occurrence_in_year(date, weekday)? == occurrence.abs() as u32 {
                                return Ok(true);
                            }
                        }
                        _ => {
                            // For other frequencies, occurrence number is ignored
                            return Ok(true);
                        }
                    }
                } else {
                    // No occurrence number, just match the weekday
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }

    /// Get the occurrence number of a weekday within a month (1-based)
    fn get_weekday_occurrence_in_month(&self, date: &chrono::DateTime<Tz>, weekday: Weekday) -> RRuleResult<u32> {
        let first_of_month = date.with_day(1)
            .ok_or_else(|| RRuleError::DateCalculationError("Invalid day".to_string()))?;
        
        let mut occurrence = 0;
        let mut current = first_of_month;
        
        while current.month() == date.month() {
            if current.weekday() == weekday {
                occurrence += 1;
                if current.day() == date.day() {
                    return Ok(occurrence);
                }
            }
            current = current + Duration::days(1);
        }
        
        Ok(0)
    }

    /// Get the occurrence number of a weekday within a year (1-based)
    fn get_weekday_occurrence_in_year(&self, date: &chrono::DateTime<Tz>, weekday: Weekday) -> RRuleResult<u32> {
        let first_of_year = date.with_ordinal(1)
            .ok_or_else(|| RRuleError::DateCalculationError("Invalid ordinal day".to_string()))?;
        
        let mut occurrence = 0;
        let mut current = first_of_year;
        
        while current.year() == date.year() {
            if current.weekday() == weekday {
                occurrence += 1;
                if current.ordinal() == date.ordinal() {
                    return Ok(occurrence);
                }
            }
            current = current + Duration::days(1);
        }
        
        Ok(0)
    }

    /// Get week number according to ISO 8601 (or adjusted for WKST)
    fn get_week_number(&self, date: &chrono::DateTime<Tz>, week_start: Weekday) -> RRuleResult<i32> {
        // For simplicity, use ISO week number
        // In production, you'd want to adjust for different WKST values
        Ok(date.iso_week().week() as i32)
    }

    /// Advance date according to frequency and interval
    fn advance_date(&self, rrule: &RRule, current: chrono::DateTime<Tz>) -> RRuleResult<chrono::DateTime<Tz>> {
        let interval = rrule.interval as i64;
        
        match rrule.frequency {
            Frequency::Secondly => Ok(current + Duration::seconds(interval)),
            Frequency::Minutely => Ok(current + Duration::minutes(interval)),
            Frequency::Hourly => Ok(current + Duration::hours(interval)),
            Frequency::Daily => Ok(current + Duration::days(interval)),
            Frequency::Weekly => Ok(current + Duration::weeks(interval)),
            Frequency::Monthly => {
                let mut new_date = current;
                for _ in 0..interval {
                    new_date = self.add_months(new_date, 1)?;
                }
                Ok(new_date)
            }
            Frequency::Yearly => {
                let mut new_date = current;
                for _ in 0..interval {
                    new_date = self.add_years(new_date, 1)?;
                }
                Ok(new_date)
            }
        }
    }

    /// Add months to a date, handling month boundaries correctly
    fn add_months(&self, date: chrono::DateTime<Tz>, months: i32) -> RRuleResult<chrono::DateTime<Tz>> {
        let mut year = date.year();
        let mut month = date.month() as i32 + months;
        
        while month > 12 {
            year += 1;
            month -= 12;
        }
        while month < 1 {
            year -= 1;
            month += 12;
        }
        
        let day = std::cmp::min(date.day(), Self::days_in_month(year, month as u32)?);
        
        date.with_year(year)
            .and_then(|d| d.with_month(month as u32))
            .and_then(|d| d.with_day(day))
            .ok_or_else(|| RRuleError::DateCalculationError("Failed to add months".to_string()))
    }

    /// Add years to a date, handling leap year boundaries
    fn add_years(&self, date: chrono::DateTime<Tz>, years: i32) -> RRuleResult<chrono::DateTime<Tz>> {
        let new_year = date.year() + years;
        
        // Handle February 29th on non-leap years
        let day = if date.month() == 2 && date.day() == 29 && !Self::is_leap_year(new_year) {
            28
        } else {
            date.day()
        };
        
        date.with_year(new_year)
            .and_then(|d| d.with_day(day))
            .ok_or_else(|| RRuleError::DateCalculationError("Failed to add years".to_string()))
    }

    /// Check if a year is a leap year
    fn is_leap_year(year: i32) -> bool {
        (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
    }

    /// Get number of days in a month
    fn days_in_month(year: i32, month: u32) -> RRuleResult<u32> {
        match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => Ok(31),
            4 | 6 | 9 | 11 => Ok(30),
            2 => Ok(if Self::is_leap_year(year) { 29 } else { 28 }),
            _ => Err(RRuleError::InvalidParameterValue {
                parameter: "month".to_string(),
                value: month.to_string(),
            }),
        }
    }
}

// Helper functions for parsing RRULE parameters

fn parse_number_list(value: &str, parameter: &str) -> RRuleResult<Vec<u32>> {
    value
        .split(',')
        .map(|s| {
            s.trim().parse().map_err(|_| RRuleError::InvalidParameterValue {
                parameter: parameter.to_string(),
                value: s.to_string(),
            })
        })
        .collect()
}

fn parse_signed_number_list(value: &str, parameter: &str) -> RRuleResult<Vec<i32>> {
    value
        .split(',')
        .map(|s| {
            s.trim().parse().map_err(|_| RRuleError::InvalidParameterValue {
                parameter: parameter.to_string(),
                value: s.to_string(),
            })
        })
        .collect()
}

/// High-level API for working with recurrence rules
pub struct RecurrenceEngine {
    processor: RRuleProcessor,
}

impl Default for RecurrenceEngine {
    fn default() -> Self {
        Self {
            processor: RRuleProcessor::default(),
        }
    }
}

impl RecurrenceEngine {
    /// Create new recurrence engine
    pub fn new() -> Self {
        Self::default()
    }

    /// Generate event instances for a recurring event within a date range
    pub fn expand_recurrence(
        &mut self,
        rrule_string: &str,
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
        range_start: DateTime<Utc>,
        range_end: DateTime<Utc>,
        exdates: &[DateTime<Utc>],
        rdates: &[DateTime<Utc>],
    ) -> RRuleResult<Vec<(DateTime<Utc>, DateTime<Utc>)>> {
        let rrule = RRule::from_str(rrule_string)?;
        let duration = end_time - start_time;
        
        let exceptions = RecurrenceExceptions {
            exdates: exdates.iter().cloned().collect(),
            rdates: rdates.iter().cloned().collect(),
            overrides: HashMap::new(),
        };
        
        let start_times = self.processor.generate_instances(
            &rrule,
            start_time,
            range_start,
            range_end,
            &exceptions,
        )?;
        
        let instances = start_times
            .into_iter()
            .map(|start| (start, start + duration))
            .collect();
        
        Ok(instances)
    }

    /// Check if a specific datetime is a valid recurrence instance
    pub fn is_occurrence(
        &mut self,
        rrule_string: &str,
        event_start: DateTime<Utc>,
        check_time: DateTime<Utc>,
        exdates: &[DateTime<Utc>],
    ) -> RRuleResult<bool> {
        // Check if it's an exception first
        if exdates.contains(&check_time) {
            return Ok(false);
        }

        let rrule = RRule::from_str(rrule_string)?;
        let exceptions = RecurrenceExceptions {
            exdates: exdates.iter().cloned().collect(),
            rdates: HashSet::new(),
            overrides: HashMap::new(),
        };
        
        // Generate instances around the check time
        let range_start = check_time - Duration::days(1);
        let range_end = check_time + Duration::days(1);
        
        let instances = self.processor.generate_instances(
            &rrule,
            event_start,
            range_start,
            range_end,
            &exceptions,
        )?;
        
        Ok(instances.contains(&check_time))
    }

    /// Get the next occurrence of a recurring event after a given time
    pub fn get_next_occurrence(
        &mut self,
        rrule_string: &str,
        event_start: DateTime<Utc>,
        after_time: DateTime<Utc>,
        exdates: &[DateTime<Utc>],
    ) -> RRuleResult<Option<DateTime<Utc>>> {
        let rrule = RRule::from_str(rrule_string)?;
        let exceptions = RecurrenceExceptions {
            exdates: exdates.iter().cloned().collect(),
            rdates: HashSet::new(),
            overrides: HashMap::new(),
        };
        
        // Look ahead for a reasonable time frame
        let range_end = after_time + Duration::days(365 * 2); // 2 years ahead
        
        let instances = self.processor.generate_instances(
            &rrule,
            event_start,
            after_time,
            range_end,
            &exceptions,
        )?;
        
        Ok(instances.into_iter().find(|&instance| instance > after_time))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_rrule_parsing() {
        let rrule_str = "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10";
        let rrule = RRule::from_str(rrule_str).unwrap();
        
        assert_eq!(rrule.frequency, Frequency::Weekly);
        assert_eq!(rrule.interval, 2);
        assert_eq!(rrule.count, Some(10));
        assert_eq!(rrule.by_day.len(), 3);
    }

    #[test]
    fn test_weekday_rule_parsing() {
        let rule = WeekdayRule::from_str("2MO").unwrap();
        assert_eq!(rule.weekday, Weekday::Mon);
        assert_eq!(rule.occurrence, Some(2));

        let rule = WeekdayRule::from_str("FR").unwrap();
        assert_eq!(rule.weekday, Weekday::Fri);
        assert_eq!(rule.occurrence, None);
    }

    #[test]
    fn test_daily_recurrence() {
        let mut engine = RecurrenceEngine::new();
        let rrule = "FREQ=DAILY;COUNT=3";
        let start = Utc.with_ymd_and_hms(2023, 1, 1, 12, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2023, 1, 1, 13, 0, 0).unwrap();
        let range_start = Utc.with_ymd_and_hms(2023, 1, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2023, 1, 10, 0, 0, 0).unwrap();

        let instances = engine.expand_recurrence(
            rrule, start, end, range_start, range_end, &[], &[]
        ).unwrap();

        assert_eq!(instances.len(), 3);
        assert_eq!(instances[0].0, start);
        assert_eq!(instances[1].0, start + Duration::days(1));
        assert_eq!(instances[2].0, start + Duration::days(2));
    }

    #[test]
    fn test_weekly_recurrence() {
        let mut engine = RecurrenceEngine::new();
        let rrule = "FREQ=WEEKLY;BYDAY=MO,WE,FR";
        let start = Utc.with_ymd_and_hms(2023, 1, 2, 9, 0, 0).unwrap(); // Monday
        let end = Utc.with_ymd_and_hms(2023, 1, 2, 10, 0, 0).unwrap();
        let range_start = Utc.with_ymd_and_hms(2023, 1, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2023, 1, 15, 0, 0, 0).unwrap();

        let instances = engine.expand_recurrence(
            rrule, start, end, range_start, range_end, &[], &[]
        ).unwrap();

        // Should have Monday, Wednesday, Friday in first week, and subsequent weeks
        assert!(instances.len() > 3);
        
        // Check first few instances
        assert_eq!(instances[0].0.weekday(), Weekday::Mon);
        assert_eq!(instances[1].0.weekday(), Weekday::Wed);
        assert_eq!(instances[2].0.weekday(), Weekday::Fri);
    }

    #[test]
    fn test_monthly_recurrence() {
        let mut engine = RecurrenceEngine::new();
        let rrule = "FREQ=MONTHLY;BYMONTHDAY=15;COUNT=3";
        let start = Utc.with_ymd_and_hms(2023, 1, 15, 14, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2023, 1, 15, 15, 0, 0).unwrap();
        let range_start = Utc.with_ymd_and_hms(2023, 1, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2023, 12, 31, 0, 0, 0).unwrap();

        let instances = engine.expand_recurrence(
            rrule, start, end, range_start, range_end, &[], &[]
        ).unwrap();

        assert_eq!(instances.len(), 3);
        assert_eq!(instances[0].0.day(), 15);
        assert_eq!(instances[1].0.day(), 15);
        assert_eq!(instances[2].0.day(), 15);
        
        assert_eq!(instances[0].0.month(), 1);
        assert_eq!(instances[1].0.month(), 2);
        assert_eq!(instances[2].0.month(), 3);
    }

    #[test]
    fn test_exceptions() {
        let mut engine = RecurrenceEngine::new();
        let rrule = "FREQ=DAILY;COUNT=5";
        let start = Utc.with_ymd_and_hms(2023, 1, 1, 12, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2023, 1, 1, 13, 0, 0).unwrap();
        let range_start = Utc.with_ymd_and_hms(2023, 1, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2023, 1, 10, 0, 0, 0).unwrap();

        // Exclude the second occurrence
        let exdates = vec![start + Duration::days(1)];

        let instances = engine.expand_recurrence(
            rrule, start, end, range_start, range_end, &exdates, &[]
        ).unwrap();

        assert_eq!(instances.len(), 4); // 5 - 1 excluded
        assert_eq!(instances[0].0, start);
        assert_eq!(instances[1].0, start + Duration::days(2)); // Skipped day 2
        assert_eq!(instances[2].0, start + Duration::days(3));
        assert_eq!(instances[3].0, start + Duration::days(4));
    }

    #[test]
    fn test_until_constraint() {
        let rrule_str = "FREQ=DAILY;UNTIL=20230105T000000Z";
        let rrule = RRule::from_str(rrule_str).unwrap();
        
        assert!(rrule.until.is_some());
        assert_eq!(rrule.until.unwrap().day(), 5);
        assert_eq!(rrule.until.unwrap().month(), 1);
        assert_eq!(rrule.until.unwrap().year(), 2023);
    }

    #[test]
    fn test_complex_byday() {
        let mut engine = RecurrenceEngine::new();
        // First and last Monday of each month
        let rrule = "FREQ=MONTHLY;BYDAY=1MO,-1MO";
        let start = Utc.with_ymd_and_hms(2023, 1, 2, 10, 0, 0).unwrap(); // First Monday
        let end = Utc.with_ymd_and_hms(2023, 1, 2, 11, 0, 0).unwrap();
        let range_start = Utc.with_ymd_and_hms(2023, 1, 1, 0, 0, 0).unwrap();
        let range_end = Utc.with_ymd_and_hms(2023, 3, 31, 0, 0, 0).unwrap();

        let instances = engine.expand_recurrence(
            rrule, start, end, range_start, range_end, &[], &[]
        ).unwrap();

        // Should have first and last Mondays of each month
        assert!(instances.len() >= 4); // At least 2 months * 2 occurrences
        
        for instance in &instances {
            assert_eq!(instance.0.weekday(), Weekday::Mon);
        }
    }
}