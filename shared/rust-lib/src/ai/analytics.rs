//! AI Analytics Module
//!
//! This module provides analytics and monitoring for AI operations.

use crate::ai::{error::AIResult, types::*};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalytics {
    pub request_count: u64,
    pub total_tokens_used: u64,
    pub average_response_time: f64,
    pub error_rate: f64,
    pub provider_usage: HashMap<String, u64>,
}

impl AIAnalytics {
    pub fn new() -> Self {
        Self {
            request_count: 0,
            total_tokens_used: 0,
            average_response_time: 0.0,
            error_rate: 0.0,
            provider_usage: HashMap::new(),
        }
    }

    pub async fn record_request(&mut self, provider: &str, tokens: u64, response_time: f64) -> AIResult<()> {
        self.request_count += 1;
        self.total_tokens_used += tokens;
        self.average_response_time = (self.average_response_time + response_time) / 2.0;
        
        *self.provider_usage.entry(provider.to_string()).or_insert(0) += 1;
        
        Ok(())
    }

    pub async fn record_error(&mut self) -> AIResult<()> {
        self.error_rate = (self.error_rate + 1.0) / 2.0;
        Ok(())
    }

    pub fn get_stats(&self) -> AIAnalyticsStats {
        AIAnalyticsStats {
            total_requests: self.request_count,
            total_tokens: self.total_tokens_used,
            avg_response_time_ms: self.average_response_time,
            error_rate_percent: self.error_rate * 100.0,
            top_provider: self.provider_usage.iter()
                .max_by(|a, b| a.1.cmp(b.1))
                .map(|(k, _)| k.clone())
                .unwrap_or_default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalyticsStats {
    pub total_requests: u64,
    pub total_tokens: u64,
    pub avg_response_time_ms: f64,
    pub error_rate_percent: f64,
    pub top_provider: String,
}

impl Default for AIAnalytics {
    fn default() -> Self {
        Self::new()
    }
}