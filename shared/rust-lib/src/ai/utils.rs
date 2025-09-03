//! AI Utilities Module
//!
//! Common utilities for AI operations.

use crate::ai::{error::AIResult, types::*};

pub fn estimate_tokens(text: &str) -> usize {
    // Simple token estimation: roughly 1 token per 4 characters
    (text.len() as f64 / 4.0).ceil() as usize
}

pub fn truncate_text(text: &str, max_tokens: usize) -> String {
    let estimated_chars = max_tokens * 4;
    if text.len() <= estimated_chars {
        text.to_string()
    } else {
        text.chars().take(estimated_chars).collect()
    }
}

pub fn validate_temperature(temperature: f32) -> AIResult<f32> {
    if temperature < 0.0 || temperature > 1.0 {
        Err(crate::ai::error::AIError::invalid_parameter("temperature", "must be between 0.0 and 1.0"))
    } else {
        Ok(temperature)
    }
}

pub fn format_prompt_for_provider(prompt: &str, provider: AIProvider) -> String {
    match provider {
        AIProvider::OpenAI => prompt.to_string(),
        AIProvider::DeepSeek => format!("Please respond professionally: {}", prompt),
        AIProvider::Local => prompt.to_string(),
    }
}