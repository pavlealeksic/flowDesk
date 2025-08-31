//! Vector clock implementation for conflict detection in config sync

use std::collections::HashMap;
use std::cmp::Ordering;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};

/// Vector clock for tracking causal relationships between config changes
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VectorClock {
    /// Map of device ID to logical timestamp
    pub clocks: HashMap<String, u64>,
}

impl VectorClock {
    /// Create a new empty vector clock
    pub fn new() -> Self {
        Self {
            clocks: HashMap::new(),
        }
    }
    
    /// Create a vector clock with a single device
    pub fn with_device(device_id: String) -> Self {
        let mut clocks = HashMap::new();
        clocks.insert(device_id, 1);
        Self { clocks }
    }
    
    /// Increment the clock for a specific device
    pub fn increment(&mut self, device_id: &str) {
        let counter = self.clocks.entry(device_id.to_string()).or_insert(0);
        *counter += 1;
    }
    
    /// Update this vector clock with information from another clock
    /// This is used when receiving updates from other devices
    pub fn update(&mut self, other: &VectorClock) {
        for (device_id, &timestamp) in &other.clocks {
            let current = self.clocks.entry(device_id.clone()).or_insert(0);
            *current = (*current).max(timestamp);
        }
    }
    
    /// Merge this clock with another and increment the local device
    pub fn merge_and_increment(&mut self, other: &VectorClock, local_device_id: &str) {
        self.update(other);
        self.increment(local_device_id);
    }
    
    /// Get the timestamp for a specific device
    pub fn get_timestamp(&self, device_id: &str) -> u64 {
        self.clocks.get(device_id).copied().unwrap_or(0)
    }
    
    /// Check if this clock happens before another clock
    pub fn happens_before(&self, other: &VectorClock) -> bool {
        // This clock happens before other if:
        // 1. For all devices in this clock, timestamp <= other's timestamp
        // 2. At least one device has strictly less timestamp
        
        let mut strictly_less = false;
        
        for (device_id, &timestamp) in &self.clocks {
            let other_timestamp = other.get_timestamp(device_id);
            if timestamp > other_timestamp {
                return false;
            }
            if timestamp < other_timestamp {
                strictly_less = true;
            }
        }
        
        // Also check devices that exist in other but not in self
        for (device_id, &other_timestamp) in &other.clocks {
            if !self.clocks.contains_key(device_id) && other_timestamp > 0 {
                strictly_less = true;
            }
        }
        
        strictly_less
    }
    
    /// Check if this clock happens after another clock
    pub fn happens_after(&self, other: &VectorClock) -> bool {
        other.happens_before(self)
    }
    
    /// Check if two clocks are concurrent (neither happens before the other)
    pub fn is_concurrent(&self, other: &VectorClock) -> bool {
        !self.happens_before(other) && !self.happens_after(other)
    }
    
    /// Compare two vector clocks
    pub fn compare(&self, other: &VectorClock) -> ClockComparison {
        if self == other {
            ClockComparison::Equal
        } else if self.happens_before(other) {
            ClockComparison::Before
        } else if self.happens_after(other) {
            ClockComparison::After
        } else {
            ClockComparison::Concurrent
        }
    }
    
    /// Get all device IDs present in this clock
    pub fn device_ids(&self) -> Vec<String> {
        self.clocks.keys().cloned().collect()
    }
    
    /// Check if the clock is empty
    pub fn is_empty(&self) -> bool {
        self.clocks.is_empty()
    }
    
    /// Get the maximum timestamp across all devices
    pub fn max_timestamp(&self) -> u64 {
        self.clocks.values().copied().max().unwrap_or(0)
    }
    
    /// Create a compact string representation
    pub fn to_compact_string(&self) -> String {
        let mut parts: Vec<String> = self.clocks
            .iter()
            .map(|(device, timestamp)| format!("{}:{}", device, timestamp))
            .collect();
        parts.sort();
        parts.join(",")
    }
    
    /// Parse from compact string representation
    pub fn from_compact_string(s: &str) -> Result<Self> {
        let mut clocks = HashMap::new();
        
        if s.is_empty() {
            return Ok(Self { clocks });
        }
        
        for part in s.split(',') {
            let parts: Vec<&str> = part.split(':').collect();
            if parts.len() != 2 {
                return Err(anyhow!("Invalid vector clock format: {}", part));
            }
            
            let device_id = parts[0].to_string();
            let timestamp: u64 = parts[1].parse()
                .map_err(|_| anyhow!("Invalid timestamp: {}", parts[1]))?;
            
            clocks.insert(device_id, timestamp);
        }
        
        Ok(Self { clocks })
    }
}

impl Default for VectorClock {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of comparing two vector clocks
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClockComparison {
    /// Clocks are equal
    Equal,
    /// First clock happens before second
    Before,
    /// First clock happens after second
    After,
    /// Clocks are concurrent (conflict)
    Concurrent,
}

/// Versioned value with vector clock for conflict detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionedValue<T> {
    /// The actual value
    pub value: T,
    /// Vector clock when this value was created/modified
    pub vector_clock: VectorClock,
    /// Device that last modified this value
    pub modified_by: String,
    /// Timestamp when modified (for human readability)
    pub modified_at: chrono::DateTime<chrono::Utc>,
}

impl<T> VersionedValue<T> {
    /// Create a new versioned value
    pub fn new(value: T, device_id: String) -> Self {
        let mut vector_clock = VectorClock::new();
        vector_clock.increment(&device_id);
        
        Self {
            value,
            vector_clock,
            modified_by: device_id,
            modified_at: chrono::Utc::now(),
        }
    }
    
    /// Create a new version of this value
    pub fn update(&self, new_value: T, device_id: String) -> Self {
        let mut new_clock = self.vector_clock.clone();
        new_clock.increment(&device_id);
        
        Self {
            value: new_value,
            vector_clock: new_clock,
            modified_by: device_id,
            modified_at: chrono::Utc::now(),
        }
    }
    
    /// Compare with another versioned value
    pub fn compare(&self, other: &VersionedValue<T>) -> ClockComparison {
        self.vector_clock.compare(&other.vector_clock)
    }
    
    /// Check if this version happens before another
    pub fn happens_before(&self, other: &VersionedValue<T>) -> bool {
        self.vector_clock.happens_before(&other.vector_clock)
    }
    
    /// Check if this version is concurrent with another (conflict)
    pub fn is_concurrent(&self, other: &VersionedValue<T>) -> bool {
        self.vector_clock.is_concurrent(&other.vector_clock)
    }
}

/// Conflict detection result
#[derive(Debug, Clone)]
pub enum ConflictResult<T> {
    /// No conflict - one value is clearly newer
    NoConflict(VersionedValue<T>),
    /// Conflict detected - both values are concurrent
    Conflict {
        local: VersionedValue<T>,
        remote: VersionedValue<T>,
    },
}

/// Detect conflicts between two versioned values
pub fn detect_conflict<T>(
    local: VersionedValue<T>,
    remote: VersionedValue<T>,
) -> ConflictResult<T> {
    match local.compare(&remote) {
        ClockComparison::Equal | ClockComparison::Before => {
            ConflictResult::NoConflict(remote)
        }
        ClockComparison::After => {
            ConflictResult::NoConflict(local)
        }
        ClockComparison::Concurrent => {
            ConflictResult::Conflict { local, remote }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_clock_creation() {
        let clock = VectorClock::new();
        assert!(clock.is_empty());
        
        let clock = VectorClock::with_device("device1".to_string());
        assert_eq!(clock.get_timestamp("device1"), 1);
        assert_eq!(clock.get_timestamp("device2"), 0);
    }

    #[test]
    fn test_vector_clock_increment() {
        let mut clock = VectorClock::new();
        clock.increment("device1");
        assert_eq!(clock.get_timestamp("device1"), 1);
        
        clock.increment("device1");
        assert_eq!(clock.get_timestamp("device1"), 2);
        
        clock.increment("device2");
        assert_eq!(clock.get_timestamp("device2"), 1);
    }

    #[test]
    fn test_vector_clock_update() {
        let mut clock1 = VectorClock::new();
        clock1.increment("device1");
        clock1.increment("device1");
        
        let mut clock2 = VectorClock::new();
        clock2.increment("device2");
        clock2.increment("device2");
        clock2.increment("device2");
        
        clock1.update(&clock2);
        assert_eq!(clock1.get_timestamp("device1"), 2);
        assert_eq!(clock1.get_timestamp("device2"), 3);
    }

    #[test]
    fn test_happens_before() {
        let mut clock1 = VectorClock::with_device("device1".to_string());
        let mut clock2 = clock1.clone();
        clock2.increment("device1");
        
        assert!(clock1.happens_before(&clock2));
        assert!(!clock2.happens_before(&clock1));
    }

    #[test]
    fn test_concurrent_clocks() {
        let mut clock1 = VectorClock::with_device("device1".to_string());
        let mut clock2 = VectorClock::with_device("device2".to_string());
        
        // Both increment independently - they should be concurrent
        clock1.increment("device1");
        clock2.increment("device2");
        
        assert!(clock1.is_concurrent(&clock2));
        assert!(clock2.is_concurrent(&clock1));
        assert!(!clock1.happens_before(&clock2));
        assert!(!clock2.happens_before(&clock1));
    }

    #[test]
    fn test_clock_comparison() {
        let clock1 = VectorClock::with_device("device1".to_string());
        let mut clock2 = clock1.clone();
        clock2.increment("device1");
        
        assert_eq!(clock1.compare(&clock2), ClockComparison::Before);
        assert_eq!(clock2.compare(&clock1), ClockComparison::After);
        assert_eq!(clock1.compare(&clock1), ClockComparison::Equal);
        
        let mut clock3 = VectorClock::with_device("device2".to_string());
        assert_eq!(clock1.compare(&clock3), ClockComparison::Concurrent);
    }

    #[test]
    fn test_compact_string_representation() {
        let mut clock = VectorClock::new();
        clock.increment("device1");
        clock.increment("device2");
        clock.increment("device1");
        
        let compact = clock.to_compact_string();
        let parsed = VectorClock::from_compact_string(&compact).unwrap();
        
        assert_eq!(clock, parsed);
    }

    #[test]
    fn test_versioned_value() {
        let value1 = VersionedValue::new("hello".to_string(), "device1".to_string());
        let value2 = value1.update("world".to_string(), "device2".to_string());
        
        assert!(value1.happens_before(&value2));
        assert!(!value2.happens_before(&value1));
        
        let value3 = value1.update("concurrent".to_string(), "device3".to_string());
        assert!(value2.is_concurrent(&value3));
    }

    #[test]
    fn test_conflict_detection() {
        let value1 = VersionedValue::new("original".to_string(), "device1".to_string());
        let value2 = value1.update("update1".to_string(), "device2".to_string());
        let value3 = value1.update("update2".to_string(), "device3".to_string());
        
        // value2 should win over value1
        match detect_conflict(value1.clone(), value2.clone()) {
            ConflictResult::NoConflict(winner) => {
                assert_eq!(winner.value, "update1");
            }
            _ => panic!("Expected no conflict"),
        }
        
        // value2 and value3 should conflict
        match detect_conflict(value2, value3) {
            ConflictResult::Conflict { local, remote } => {
                assert_eq!(local.value, "update1");
                assert_eq!(remote.value, "update2");
            }
            _ => panic!("Expected conflict"),
        }
    }
}