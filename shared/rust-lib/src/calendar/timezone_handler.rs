//! Comprehensive timezone handling with DST support
//!
//! This module provides comprehensive timezone handling capabilities including:
//! - IANA timezone database integration
//! - Daylight Saving Time (DST) transitions
//! - Timezone conversion with historical accuracy
//! - iCalendar VTIMEZONE component parsing
//! - Floating time handling
//! - UTC offset calculations
//! - Cross-timezone event scheduling
//! - Ambiguous time resolution

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc, LocalResult};
use chrono_tz::{Tz, UTC};
use std::{
    collections::HashMap,
    fmt,
    str::FromStr,
};
use thiserror::Error;
use serde::{Deserialize, Serialize};

/// Timezone handling errors
#[derive(Debug, Error)]
pub enum TimezoneError {
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Invalid timezone format: {0}")]
    InvalidFormat(String),
    #[error("Ambiguous local time: {0}")]
    AmbiguousTime(String),
    #[error("Invalid local time: {0}")]
    InvalidTime(String),
    #[error("DST transition error: {0}")]
    DSTTransitionError(String),
    #[error("Timezone conversion error: {0}")]
    ConversionError(String),
    #[error("VTIMEZONE parsing error: {0}")]
    VTimezoneParsingError(String),
}

/// Result type for timezone operations
pub type TimezoneResult<T> = Result<T, TimezoneError>;

/// Timezone specification with comprehensive metadata
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimezoneInfo {
    /// IANA timezone identifier (e.g., "America/New_York")
    pub tzid: String,
    /// Display name (e.g., "Eastern Standard Time")
    pub display_name: String,
    /// Standard time offset from UTC in seconds
    pub standard_offset: i32,
    /// DST offset from UTC in seconds (if applicable)
    pub dst_offset: Option<i32>,
    /// Whether this timezone observes DST
    pub observes_dst: bool,
    /// Current offset from UTC in seconds (accounting for DST)
    pub current_offset: i32,
    /// Region/continent
    pub region: Option<String>,
    /// Country code (ISO 3166-1 alpha-2)
    pub country_code: Option<String>,
}

/// DST transition information
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DSTTransition {
    /// When the transition occurs (in local time)
    pub transition_time: NaiveDateTime,
    /// Offset before the transition (in seconds from UTC)
    pub offset_before: i32,
    /// Offset after the transition (in seconds from UTC)
    pub offset_after: i32,
    /// Whether this is a transition to DST (spring forward) or from DST (fall back)
    pub is_dst_start: bool,
}

/// Floating time representation (time without timezone)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FloatingTime {
    pub datetime: NaiveDateTime,
    pub description: Option<String>,
}

/// Timezone conversion request
#[derive(Debug, Clone)]
pub struct TimezoneConversion {
    pub source_time: DateTime<Utc>,
    pub source_tz: Option<Tz>,
    pub target_tz: Tz,
}

/// Comprehensive timezone handler
pub struct TimezoneHandler {
    /// Cache of timezone information
    timezone_cache: HashMap<String, TimezoneInfo>,
    /// Cache of DST transitions
    transition_cache: HashMap<String, Vec<DSTTransition>>,
    /// VTIMEZONE component definitions
    vtimezone_definitions: HashMap<String, VTimezoneComponent>,
}

/// VTIMEZONE component from iCalendar
#[derive(Debug, Clone)]
pub struct VTimezoneComponent {
    pub tzid: String,
    pub standard_rules: Vec<TimezoneRule>,
    pub daylight_rules: Vec<TimezoneRule>,
    pub last_modified: Option<DateTime<Utc>>,
}

/// Individual timezone rule (STANDARD or DAYLIGHT)
#[derive(Debug, Clone)]
pub struct TimezoneRule {
    pub dtstart: NaiveDateTime,
    pub tzoffsetfrom: i32, // Seconds from UTC
    pub tzoffsetto: i32,   // Seconds from UTC
    pub rrule: Option<String>,
    pub rdate: Vec<NaiveDateTime>,
    pub tzname: Option<String>,
}

impl Default for TimezoneHandler {
    fn default() -> Self {
        Self::new()
    }
}

impl TimezoneHandler {
    /// Create a new timezone handler
    pub fn new() -> Self {
        let mut handler = Self {
            timezone_cache: HashMap::new(),
            transition_cache: HashMap::new(),
            vtimezone_definitions: HashMap::new(),
        };
        
        handler.initialize_common_timezones();
        handler
    }

    /// Initialize cache with commonly used timezones
    fn initialize_common_timezones(&mut self) {
        let common_timezones = vec![
            "UTC",
            "America/New_York",
            "America/Los_Angeles",
            "America/Chicago",
            "America/Denver",
            "Europe/London",
            "Europe/Paris",
            "Europe/Berlin",
            "Asia/Tokyo",
            "Asia/Shanghai",
            "Asia/Kolkata",
            "Australia/Sydney",
            "Pacific/Auckland",
        ];

        for tzid in common_timezones {
            if let Ok(tz_info) = self.get_timezone_info(tzid) {
                self.timezone_cache.insert(tzid.to_string(), tz_info);
            }
        }
    }

    /// Get comprehensive timezone information
    pub fn get_timezone_info(&mut self, tzid: &str) -> TimezoneResult<TimezoneInfo> {
        // Check cache first
        if let Some(cached) = self.timezone_cache.get(tzid) {
            return Ok(cached.clone());
        }

        // Parse timezone
        let tz = self.parse_timezone(tzid)?;
        let now_utc = Utc::now();
        
        // Get current offset
        let current_offset = tz.offset_from_utc_datetime(&now_utc.naive_utc())
            .fix()
            .local_minus_utc();

        // Determine if DST is observed by checking transitions over the year
        let (observes_dst, standard_offset, dst_offset) = self.analyze_dst_pattern(&tz, now_utc)?;

        let tz_info = TimezoneInfo {
            tzid: tzid.to_string(),
            display_name: self.get_display_name(&tz),
            standard_offset,
            dst_offset,
            observes_dst,
            current_offset,
            region: self.extract_region(tzid),
            country_code: self.get_country_code(tzid),
        };

        // Cache the result
        self.timezone_cache.insert(tzid.to_string(), tz_info.clone());
        
        Ok(tz_info)
    }

    /// Parse timezone from string identifier
    fn parse_timezone(&self, tzid: &str) -> TimezoneResult<Tz> {
        // Handle special cases
        match tzid.to_uppercase().as_str() {
            "UTC" | "GMT" | "Z" => return Ok(UTC),
            _ => {}
        }

        // Try parsing as IANA timezone
        tzid.parse::<Tz>()
            .map_err(|_| TimezoneError::UnknownTimezone(tzid.to_string()))
    }

    /// Analyze DST pattern for a timezone
    fn analyze_dst_pattern(&self, tz: &Tz, reference_time: DateTime<Utc>) -> TimezoneResult<(bool, i32, Option<i32>)> {
        let start_of_year = reference_time.with_ordinal(1)
            .ok_or_else(|| TimezoneError::ConversionError("Invalid date".to_string()))?;
        let end_of_year = reference_time.with_ordinal(365)
            .ok_or_else(|| TimezoneError::ConversionError("Invalid date".to_string()))?;

        let mut offsets = HashSet::new();
        let mut current = start_of_year;
        
        // Sample offsets throughout the year
        while current <= end_of_year {
            let offset = tz.offset_from_utc_datetime(&current.naive_utc())
                .fix()
                .local_minus_utc();
            offsets.insert(offset);
            current = current + chrono::Duration::weeks(2); // Sample every 2 weeks
        }

        if offsets.len() == 1 {
            // No DST observed
            let offset = *offsets.iter().next().unwrap();
            Ok((false, offset, None))
        } else if offsets.len() == 2 {
            // DST observed
            let mut offset_vec: Vec<i32> = offsets.into_iter().collect();
            offset_vec.sort();
            
            // Typically, standard time has the smaller offset (less positive/more negative)
            let standard_offset = offset_vec[0];
            let dst_offset = offset_vec[1];
            
            Ok((true, standard_offset, Some(dst_offset)))
        } else {
            // Complex timezone with multiple offsets (rare)
            let mut offset_vec: Vec<i32> = offsets.into_iter().collect();
            offset_vec.sort();
            
            // Use the most common pattern assumption
            let standard_offset = offset_vec[0];
            let dst_offset = if offset_vec.len() > 1 { Some(offset_vec[1]) } else { None };
            
            Ok((offset_vec.len() > 1, standard_offset, dst_offset))
        }
    }

    /// Get display name for timezone
    fn get_display_name(&self, tz: &Tz) -> String {
        // This would typically come from a localization database
        // For now, use the timezone name itself
        format!("{}", tz)
    }

    /// Extract region from timezone ID
    fn extract_region(&self, tzid: &str) -> Option<String> {
        if let Some(slash_pos) = tzid.find('/') {
            Some(tzid[..slash_pos].to_string())
        } else {
            None
        }
    }

    /// Get country code for timezone (simplified mapping)
    fn get_country_code(&self, tzid: &str) -> Option<String> {
        // This would typically come from a comprehensive timezone database
        // Here's a simplified mapping for demonstration
        let mapping = [
            ("America/New_York", "US"),
            ("America/Los_Angeles", "US"),
            ("America/Chicago", "US"),
            ("America/Denver", "US"),
            ("Europe/London", "GB"),
            ("Europe/Paris", "FR"),
            ("Europe/Berlin", "DE"),
            ("Asia/Tokyo", "JP"),
            ("Asia/Shanghai", "CN"),
            ("Asia/Kolkata", "IN"),
            ("Australia/Sydney", "AU"),
            ("Pacific/Auckland", "NZ"),
        ];

        mapping.iter()
            .find(|(tz, _)| *tz == tzid)
            .map(|(_, code)| code.to_string())
    }

    /// Convert time between timezones
    pub fn convert_timezone(&self, conversion: TimezoneConversion) -> TimezoneResult<DateTime<Tz>> {
        let target_time = conversion.source_time.with_timezone(&conversion.target_tz);
        Ok(target_time)
    }

    /// Convert UTC time to specified timezone
    pub fn utc_to_timezone(&self, utc_time: DateTime<Utc>, tzid: &str) -> TimezoneResult<DateTime<Tz>> {
        let tz = self.parse_timezone(tzid)?;
        Ok(utc_time.with_timezone(&tz))
    }

    /// Convert timezone-aware time to UTC
    pub fn timezone_to_utc(&self, local_time: DateTime<Tz>) -> DateTime<Utc> {
        local_time.with_timezone(&Utc)
    }

    /// Handle floating time by attaching a timezone
    pub fn attach_timezone(&self, floating_time: &FloatingTime, tzid: &str) -> TimezoneResult<DateTime<Tz>> {
        let tz = self.parse_timezone(tzid)?;
        
        match tz.from_local_datetime(&floating_time.datetime) {
            LocalResult::Single(dt) => Ok(dt),
            LocalResult::Ambiguous(earlier, later) => {
                // During DST transition, prefer the earlier time (standard time)
                // This is a policy decision - could be configurable
                tracing::warn!("Ambiguous time {} in timezone {}, using earlier occurrence", 
                              floating_time.datetime, tzid);
                Ok(earlier)
            }
            LocalResult::None => {
                // This time doesn't exist (e.g., during spring-forward DST transition)
                tracing::warn!("Invalid time {} in timezone {}, adjusting", 
                              floating_time.datetime, tzid);
                
                // Find the next valid time
                let mut test_time = floating_time.datetime;
                for _ in 0..60 { // Try for up to 60 minutes
                    test_time = test_time + chrono::Duration::minutes(1);
                    if let LocalResult::Single(dt) = tz.from_local_datetime(&test_time) {
                        return Ok(dt);
                    }
                }
                
                Err(TimezoneError::InvalidTime(format!("Could not resolve time {} in timezone {}", 
                                                      floating_time.datetime, tzid)))
            }
        }
    }

    /// Get DST transitions for a specific year and timezone
    pub fn get_dst_transitions(&mut self, tzid: &str, year: i32) -> TimezoneResult<Vec<DSTTransition>> {
        let cache_key = format!("{}:{}", tzid, year);
        
        // Check cache first
        if let Some(cached) = self.transition_cache.get(&cache_key) {
            return Ok(cached.clone());
        }

        let tz = self.parse_timezone(tzid)?;
        let mut transitions = Vec::new();

        // Sample throughout the year to find transitions
        let start_of_year = Utc.with_ymd_and_hms(year, 1, 1, 0, 0, 0)
            .ok_or_else(|| TimezoneError::ConversionError("Invalid year".to_string()))?;

        let mut current = start_of_year;
        let mut last_offset = tz.offset_from_utc_datetime(&current.naive_utc()).fix().local_minus_utc();

        for day in 1..366 {
            if let Some(test_date) = Utc.with_ymd_and_hms(year, 1, 1, 12, 0, 0)
                .and_then(|d| d.checked_add_signed(chrono::Duration::days(day))) {
                
                let current_offset = tz.offset_from_utc_datetime(&test_date.naive_utc())
                    .fix()
                    .local_minus_utc();

                if current_offset != last_offset {
                    // Found a transition
                    let transition_time = test_date.naive_utc();
                    let is_dst_start = current_offset > last_offset;

                    transitions.push(DSTTransition {
                        transition_time: transition_time,
                        offset_before: last_offset,
                        offset_after: current_offset,
                        is_dst_start,
                    });

                    last_offset = current_offset;
                }
            }
        }

        // Cache the result
        self.transition_cache.insert(cache_key, transitions.clone());
        
        Ok(transitions)
    }

    /// Check if a specific time is during DST
    pub fn is_dst(&self, datetime: DateTime<Tz>) -> bool {
        let offset = datetime.offset().fix().local_minus_utc();
        
        // This is a simplified check - in reality, you'd compare against standard time
        // The assumption here is that DST has a more positive offset than standard time
        
        // For demonstration, assume DST if offset is greater than some baseline
        // This would need to be improved with actual timezone data
        offset > 0 // Simplified assumption
    }

    /// Parse VTIMEZONE component from iCalendar
    pub fn parse_vtimezone(&mut self, ical_data: &str) -> TimezoneResult<VTimezoneComponent> {
        let mut vtimezone = VTimezoneComponent {
            tzid: String::new(),
            standard_rules: Vec::new(),
            daylight_rules: Vec::new(),
            last_modified: None,
        };

        let lines: Vec<&str> = ical_data.lines().collect();
        let mut current_rule: Option<TimezoneRule> = None;
        let mut in_standard = false;
        let mut in_daylight = false;

        for line in lines {
            let line = line.trim();
            
            if line.starts_with("TZID:") {
                vtimezone.tzid = line[5..].to_string();
            } else if line == "BEGIN:STANDARD" {
                in_standard = true;
                in_daylight = false;
                current_rule = Some(TimezoneRule {
                    dtstart: NaiveDateTime::from_timestamp(0, 0).unwrap(),
                    tzoffsetfrom: 0,
                    tzoffsetto: 0,
                    rrule: None,
                    rdate: Vec::new(),
                    tzname: None,
                });
            } else if line == "BEGIN:DAYLIGHT" {
                in_daylight = true;
                in_standard = false;
                current_rule = Some(TimezoneRule {
                    dtstart: NaiveDateTime::from_timestamp(0, 0).unwrap(),
                    tzoffsetfrom: 0,
                    tzoffsetto: 0,
                    rrule: None,
                    rdate: Vec::new(),
                    tzname: None,
                });
            } else if line == "END:STANDARD" {
                if let Some(rule) = current_rule.take() {
                    vtimezone.standard_rules.push(rule);
                }
                in_standard = false;
            } else if line == "END:DAYLIGHT" {
                if let Some(rule) = current_rule.take() {
                    vtimezone.daylight_rules.push(rule);
                }
                in_daylight = false;
            } else if let Some(ref mut rule) = current_rule {
                if line.starts_with("DTSTART:") {
                    rule.dtstart = self.parse_ical_datetime(&line[8..])?;
                } else if line.starts_with("TZOFFSETFROM:") {
                    rule.tzoffsetfrom = self.parse_utc_offset(&line[13..])?;
                } else if line.starts_with("TZOFFSETTO:") {
                    rule.tzoffsetto = self.parse_utc_offset(&line[11..])?;
                } else if line.starts_with("RRULE:") {
                    rule.rrule = Some(line[6..].to_string());
                } else if line.starts_with("TZNAME:") {
                    rule.tzname = Some(line[7..].to_string());
                }
            }
        }

        // Store in cache
        self.vtimezone_definitions.insert(vtimezone.tzid.clone(), vtimezone.clone());
        
        Ok(vtimezone)
    }

    /// Parse iCalendar datetime format
    fn parse_ical_datetime(&self, datetime_str: &str) -> TimezoneResult<NaiveDateTime> {
        // Handle different iCalendar datetime formats
        if datetime_str.len() == 8 {
            // YYYYMMDD format
            let date = NaiveDate::parse_from_str(datetime_str, "%Y%m%d")
                .map_err(|_| TimezoneError::InvalidFormat(datetime_str.to_string()))?;
            Ok(date.and_hms_opt(0, 0, 0).unwrap())
        } else if datetime_str.len() == 15 && datetime_str.chars().nth(8) == Some('T') {
            // YYYYMMDDTHHMMSS format
            NaiveDateTime::parse_from_str(datetime_str, "%Y%m%dT%H%M%S")
                .map_err(|_| TimezoneError::InvalidFormat(datetime_str.to_string()))
        } else {
            Err(TimezoneError::InvalidFormat(datetime_str.to_string()))
        }
    }

    /// Parse UTC offset in iCalendar format (+HHMM or -HHMM)
    fn parse_utc_offset(&self, offset_str: &str) -> TimezoneResult<i32> {
        if offset_str.len() != 5 {
            return Err(TimezoneError::InvalidFormat(offset_str.to_string()));
        }

        let sign = match offset_str.chars().nth(0) {
            Some('+') => 1,
            Some('-') => -1,
            _ => return Err(TimezoneError::InvalidFormat(offset_str.to_string())),
        };

        let hours: i32 = offset_str[1..3].parse()
            .map_err(|_| TimezoneError::InvalidFormat(offset_str.to_string()))?;
        let minutes: i32 = offset_str[3..5].parse()
            .map_err(|_| TimezoneError::InvalidFormat(offset_str.to_string()))?;

        Ok(sign * (hours * 3600 + minutes * 60))
    }

    /// Get all available timezones grouped by region
    pub fn get_timezone_list(&self) -> HashMap<String, Vec<String>> {
        let mut regions = HashMap::new();
        
        // This would typically be generated from the IANA timezone database
        // Here's a simplified version for demonstration
        let timezones = vec![
            "UTC",
            "America/New_York",
            "America/Los_Angeles", 
            "America/Chicago",
            "America/Denver",
            "America/Toronto",
            "America/Vancouver",
            "America/Mexico_City",
            "Europe/London",
            "Europe/Paris",
            "Europe/Berlin",
            "Europe/Rome",
            "Europe/Madrid",
            "Europe/Amsterdam",
            "Asia/Tokyo",
            "Asia/Shanghai",
            "Asia/Seoul",
            "Asia/Kolkata",
            "Asia/Dubai",
            "Asia/Bangkok",
            "Australia/Sydney",
            "Australia/Melbourne",
            "Australia/Perth",
            "Pacific/Auckland",
            "Pacific/Fiji",
            "Africa/Cairo",
            "Africa/Johannesburg",
        ];

        for tz in timezones {
            if tz == "UTC" {
                regions.entry("UTC".to_string()).or_insert_with(Vec::new).push(tz.to_string());
            } else if let Some(slash_pos) = tz.find('/') {
                let region = tz[..slash_pos].to_string();
                regions.entry(region).or_insert_with(Vec::new).push(tz.to_string());
            }
        }

        regions
    }

    /// Format timezone-aware datetime for display
    pub fn format_datetime(&self, datetime: &DateTime<Tz>, format: &str) -> String {
        datetime.format(format).to_string()
    }

    /// Get current time in specified timezone
    pub fn now_in_timezone(&self, tzid: &str) -> TimezoneResult<DateTime<Tz>> {
        let tz = self.parse_timezone(tzid)?;
        Ok(Utc::now().with_timezone(&tz))
    }
}

use std::collections::HashSet;
use chrono::NaiveDate;

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_timezone_info() {
        let mut handler = TimezoneHandler::new();
        
        let info = handler.get_timezone_info("America/New_York").unwrap();
        assert_eq!(info.tzid, "America/New_York");
        assert!(info.observes_dst);
        assert!(info.standard_offset != 0);
    }

    #[test]
    fn test_timezone_conversion() {
        let handler = TimezoneHandler::new();
        let utc_time = Utc.with_ymd_and_hms(2023, 6, 15, 12, 0, 0).unwrap();
        
        let ny_time = handler.utc_to_timezone(utc_time, "America/New_York").unwrap();
        assert_eq!(ny_time.hour(), 8); // EDT is UTC-4 in summer
    }

    #[test]
    fn test_floating_time() {
        let handler = TimezoneHandler::new();
        let floating = FloatingTime {
            datetime: NaiveDateTime::from_timestamp(1686830400, 0).unwrap(), // 2023-06-15 12:00:00
            description: Some("Meeting time".to_string()),
        };
        
        let result = handler.attach_timezone(&floating, "America/New_York").unwrap();
        assert_eq!(result.naive_local(), floating.datetime);
    }

    #[test]
    fn test_dst_transitions() {
        let mut handler = TimezoneHandler::new();
        
        let transitions = handler.get_dst_transitions("America/New_York", 2023).unwrap();
        // Should have spring forward and fall back transitions
        assert!(transitions.len() >= 2);
        
        // Check that we have both types of transitions
        let has_spring = transitions.iter().any(|t| t.is_dst_start);
        let has_fall = transitions.iter().any(|t| !t.is_dst_start);
        assert!(has_spring && has_fall);
    }

    #[test]
    fn test_vtimezone_parsing() {
        let mut handler = TimezoneHandler::new();
        
        let vtimezone_data = r#"
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:20071104T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:20070311T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
END:DAYLIGHT
END:VTIMEZONE
"#;

        let vtimezone = handler.parse_vtimezone(vtimezone_data).unwrap();
        assert_eq!(vtimezone.tzid, "America/New_York");
        assert_eq!(vtimezone.standard_rules.len(), 1);
        assert_eq!(vtimezone.daylight_rules.len(), 1);
        
        let std_rule = &vtimezone.standard_rules[0];
        assert_eq!(std_rule.tzoffsetto, -18000); // -5 hours in seconds
        
        let dst_rule = &vtimezone.daylight_rules[0];
        assert_eq!(dst_rule.tzoffsetto, -14400); // -4 hours in seconds
    }

    #[test]
    fn test_timezone_list() {
        let handler = TimezoneHandler::new();
        let regions = handler.get_timezone_list();
        
        assert!(regions.contains_key("America"));
        assert!(regions.contains_key("Europe"));
        assert!(regions.contains_key("Asia"));
        
        assert!(regions["America"].contains(&"America/New_York".to_string()));
        assert!(regions["Europe"].contains(&"Europe/London".to_string()));
    }

    #[test]
    fn test_utc_offset_parsing() {
        let handler = TimezoneHandler::new();
        
        assert_eq!(handler.parse_utc_offset("+0500").unwrap(), 18000);
        assert_eq!(handler.parse_utc_offset("-0400").unwrap(), -14400);
        assert_eq!(handler.parse_utc_offset("+0000").unwrap(), 0);
    }

    #[test]
    fn test_current_time_in_timezone() {
        let handler = TimezoneHandler::new();
        
        let utc_now = Utc::now();
        let ny_now = handler.now_in_timezone("America/New_York").unwrap();
        
        // Should be the same moment, different representation
        let utc_from_ny = ny_now.with_timezone(&Utc);
        let diff = (utc_now.timestamp() - utc_from_ny.timestamp()).abs();
        assert!(diff <= 1); // Within 1 second (allowing for test execution time)
    }
}