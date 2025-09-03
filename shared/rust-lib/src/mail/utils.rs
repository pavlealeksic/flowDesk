//! Utility functions for mail processing

use crate::mail::{error::MailResult, types::*};
use chrono::{DateTime, Utc};
use regex::Regex;
use std::collections::HashMap;

/// Parse an email address string into EmailAddress struct
pub fn parse_email_address(addr_str: &str) -> MailResult<EmailAddress> {
    // Handle formats like:
    // - "user@example.com"
    // - "John Doe <user@example.com>"
    // - "John Doe" <user@example.com>

    let addr_str = addr_str.trim();
    
    if addr_str.contains('<') && addr_str.contains('>') {
        // Format: "Name <email@example.com>" or Name <email@example.com>
        let re = Regex::new(r#"^(?:"?([^"<>]+?)"?\s*)?<([^<>]+)>$"#).unwrap();
        if let Some(captures) = re.captures(addr_str) {
            let name = captures.get(1).map(|m| m.as_str().trim().to_string());
            let address = captures.get(2).unwrap().as_str().trim().to_string();
            
            if is_valid_email(&address) {
                return Ok(EmailAddress { name, address: address.clone(), email: address });
            }
        }
    } else if is_valid_email(addr_str) {
        // Simple email format
        return Ok(EmailAddress {
            name: None,
            address: addr_str.to_string(),
            email: addr_str.to_string(),
        });
    }

    Err(crate::mail::error::MailError::validation(
        "email",
        format!("Invalid email address format: {}", addr_str),
    ))
}

/// Parse multiple email addresses from a string
pub fn parse_email_addresses(addr_str: &str) -> MailResult<Vec<EmailAddress>> {
    if addr_str.trim().is_empty() {
        return Ok(vec![]);
    }

    let mut addresses = Vec::new();
    
    // Split by comma, but be careful about commas within quoted names
    let parts = split_email_list(addr_str);
    
    for part in parts {
        if !part.trim().is_empty() {
            addresses.push(parse_email_address(&part)?);
        }
    }

    Ok(addresses)
}

/// Split email address list, handling quoted names correctly
fn split_email_list(input: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut in_angle_brackets = false;
    
    for ch in input.chars() {
        match ch {
            '"' => {
                in_quotes = !in_quotes;
                current.push(ch);
            }
            '<' => {
                in_angle_brackets = true;
                current.push(ch);
            }
            '>' => {
                in_angle_brackets = false;
                current.push(ch);
            }
            ',' if !in_quotes && !in_angle_brackets => {
                parts.push(current.trim().to_string());
                current.clear();
            }
            _ => {
                current.push(ch);
            }
        }
    }
    
    if !current.is_empty() {
        parts.push(current.trim().to_string());
    }
    
    parts
}

/// Validate email address format
pub fn is_valid_email(email: &str) -> bool {
    let re = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
    re.is_match(email)
}

/// Extract email domain
pub fn extract_domain(email: &str) -> Option<String> {
    email.split('@').nth(1).map(|s| s.to_string())
}

/// Normalize email address (lowercase, trim)
pub fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

/// Generate thread ID based on subject and participants
pub fn generate_thread_id(subject: &str, participants: &[EmailAddress]) -> String {
    // Normalize subject by removing common reply/forward prefixes
    let normalized_subject = normalize_subject(subject);
    
    // Sort participants to ensure consistent thread IDs
    let mut participant_emails: Vec<String> = participants
        .iter()
        .map(|addr| normalize_email(&addr.address))
        .collect();
    participant_emails.sort();
    
    // Create thread ID from normalized subject and sorted participants
    let thread_data = format!("{}:{}", normalized_subject, participant_emails.join(","));
    
    // Generate a consistent hash
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    thread_data.hash(&mut hasher);
    format!("thread_{:x}", hasher.finish())
}

/// Normalize email subject for threading
pub fn normalize_subject(subject: &str) -> String {
    let mut normalized = subject.trim().to_lowercase();
    
    // Remove common reply/forward prefixes
    let prefixes = [
        "re:", "fwd:", "fw:", "forward:", "reply:",
        "aw:", "antw:", "r:", "tr:", "wg:",
        "vs:", "sv:", "ref:", "res:", "enc:",
    ];
    
    loop {
        let original = normalized.clone();
        for prefix in &prefixes {
            if normalized.starts_with(prefix) {
                normalized = normalized[prefix.len()..].trim().to_string();
            }
        }
        if normalized == original {
            break;
        }
    }
    
    // Remove extra whitespace
    normalized = normalized
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    
    normalized
}

/// Extract references from email headers for threading
pub fn extract_references(headers: &HashMap<String, String>) -> Vec<String> {
    let mut references = Vec::new();
    
    // Check References header
    if let Some(refs) = headers.get("references").or_else(|| headers.get("References")) {
        references.extend(parse_message_ids(refs));
    }
    
    // Check In-Reply-To header
    if let Some(in_reply_to) = headers.get("in-reply-to").or_else(|| headers.get("In-Reply-To")) {
        references.extend(parse_message_ids(in_reply_to));
    }
    
    // Remove duplicates while preserving order
    let mut seen = std::collections::HashSet::new();
    references.retain(|id| seen.insert(id.clone()));
    
    references
}

/// Parse Message-ID references from header value
fn parse_message_ids(header_value: &str) -> Vec<String> {
    let re = Regex::new(r"<([^>]+)>").unwrap();
    re.captures_iter(header_value)
        .map(|cap| cap[1].to_string())
        .collect()
}

/// Convert HTML email content to plain text
pub fn html_to_text(html: &str) -> String {
    html2text::from_read(html.as_bytes(), 80)
}

/// Generate email snippet from content
pub fn generate_snippet(content: &str, max_length: usize) -> String {
    let clean_text = content
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    
    if clean_text.len() <= max_length {
        clean_text
    } else {
        let mut snippet = clean_text.chars().take(max_length - 3).collect::<String>();
        // Try to break at word boundary
        if let Some(last_space) = snippet.rfind(' ') {
            snippet.truncate(last_space);
        }
        snippet.push_str("...");
        snippet
    }
}

/// Detect email content language
pub fn detect_language(content: &str) -> Option<String> {
    // Simple language detection based on common patterns
    // In a real implementation, you might use a proper language detection library
    
    let content_lower = content.to_lowercase();
    
    if content_lower.contains("the ") && content_lower.contains(" and ") {
        Some("en".to_string())
    } else if content_lower.contains(" der ") || content_lower.contains(" und ") {
        Some("de".to_string())
    } else if content_lower.contains(" le ") || content_lower.contains(" et ") {
        Some("fr".to_string())
    } else if content_lower.contains(" el ") || content_lower.contains(" y ") {
        Some("es".to_string())
    } else {
        None
    }
}

/// Extract priority from email headers
pub fn extract_priority(headers: &HashMap<String, String>) -> MessagePriority {
    // Check X-Priority header
    if let Some(priority) = headers.get("x-priority").or_else(|| headers.get("X-Priority")) {
        match priority.chars().next() {
            Some('1') | Some('2') => return MessagePriority::High,
            Some('4') | Some('5') => return MessagePriority::Low,
            _ => {}
        }
    }
    
    // Check Priority header
    if let Some(priority) = headers.get("priority").or_else(|| headers.get("Priority")) {
        match priority.to_lowercase().as_str() {
            "urgent" | "high" => return MessagePriority::High,
            "low" => return MessagePriority::Low,
            _ => {}
        }
    }
    
    // Check Importance header
    if let Some(importance) = headers.get("importance").or_else(|| headers.get("Importance")) {
        match importance.to_lowercase().as_str() {
            "high" => return MessagePriority::High,
            "low" => return MessagePriority::Low,
            _ => {}
        }
    }
    
    MessagePriority::Normal
}

/// Extract importance from email headers
pub fn extract_importance(headers: &HashMap<String, String>) -> MessageImportance {
    // Check Importance header
    if let Some(importance) = headers.get("importance").or_else(|| headers.get("Importance")) {
        match importance.to_lowercase().as_str() {
            "high" => return MessageImportance::High,
            "low" => return MessageImportance::Low,
            _ => {}
        }
    }
    
    // Check X-MSMail-Priority header (Outlook)
    if let Some(priority) = headers.get("x-msmail-priority").or_else(|| headers.get("X-MSMail-Priority")) {
        match priority.to_lowercase().as_str() {
            "high" => return MessageImportance::High,
            "low" => return MessageImportance::Low,
            _ => {}
        }
    }
    
    MessageImportance::Normal
}

/// Calculate message size estimation
pub fn estimate_message_size(message: &EmailMessage) -> i64 {
    let mut size = 0i64;
    
    // Subject
    size += message.subject.len() as i64;
    
    // Body content
    if let Some(html) = &message.body_html {
        size += html.len() as i64;
    }
    if let Some(text) = &message.body_text {
        size += text.len() as i64;
    }
    
    // Headers
    for (key, value) in &message.headers {
        size += key.len() as i64 + value.len() as i64 + 4; // +4 for ": \r\n"
    }
    
    // Addresses
    size += estimate_address_size(&message.from);
    for addr in &message.to {
        size += estimate_address_size(addr);
    }
    for addr in &message.cc {
        size += estimate_address_size(addr);
    }
    for addr in &message.bcc {
        size += estimate_address_size(addr);
    }
    for addr in &message.reply_to {
        size += estimate_address_size(addr);
    }
    
    // Attachments
    for attachment in &message.attachments {
        size += attachment.size;
        size += attachment.filename.len() as i64;
        size += attachment.mime_type.len() as i64;
    }
    
    size
}

fn estimate_address_size(addr: &EmailAddress) -> i64 {
    let mut size = addr.address.len() as i64;
    if let Some(name) = &addr.name {
        size += name.len() as i64;
    }
    size
}

/// Format date for display
pub fn format_message_date(date: &DateTime<Utc>) -> String {
    let now = Utc::now();
    let diff = now.signed_duration_since(*date);
    
    if diff.num_days() == 0 {
        // Today - show time
        date.format("%H:%M").to_string()
    } else if diff.num_days() < 7 {
        // This week - show day
        date.format("%a").to_string()
    } else if diff.num_days() < 365 {
        // This year - show month and day
        date.format("%b %d").to_string()
    } else {
        // Older - show year
        date.format("%Y").to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_email_address() {
        // Simple format
        let addr = parse_email_address("user@example.com").unwrap();
        assert_eq!(addr.address, "user@example.com");
        assert!(addr.name.is_none());

        // With name in quotes
        let addr = parse_email_address(r#""John Doe" <john@example.com>"#).unwrap();
        assert_eq!(addr.address, "john@example.com");
        assert_eq!(addr.name, Some("John Doe".to_string()));

        // With name without quotes
        let addr = parse_email_address("John Doe <john@example.com>").unwrap();
        assert_eq!(addr.address, "john@example.com");
        assert_eq!(addr.name, Some("John Doe".to_string()));
    }

    #[test]
    fn test_normalize_subject() {
        assert_eq!(normalize_subject("Re: Test subject"), "test subject");
        assert_eq!(normalize_subject("FWD: RE: Test"), "test");
        assert_eq!(normalize_subject("  Multiple   spaces  "), "multiple spaces");
        assert_eq!(normalize_subject("Normal subject"), "normal subject");
    }

    #[test]
    fn test_generate_snippet() {
        let content = "This is a long email content that should be truncated to fit within the specified length limit.";
        let snippet = generate_snippet(content, 50);
        assert!(snippet.len() <= 50);
        assert!(snippet.ends_with("..."));
    }

    #[test]
    fn test_is_valid_email() {
        assert!(is_valid_email("user@example.com"));
        assert!(is_valid_email("user.name+tag@example-domain.com"));
        assert!(!is_valid_email("invalid-email"));
        assert!(!is_valid_email("@example.com"));
        assert!(!is_valid_email("user@"));
    }

    #[test]
    fn test_extract_domain() {
        assert_eq!(extract_domain("user@example.com"), Some("example.com".to_string()));
        assert_eq!(extract_domain("invalid-email"), None);
    }

    #[test]
    fn test_parse_message_ids() {
        let refs = "<msg1@example.com> <msg2@example.com>";
        let ids = parse_message_ids(refs);
        assert_eq!(ids, vec!["msg1@example.com", "msg2@example.com"]);
    }
}