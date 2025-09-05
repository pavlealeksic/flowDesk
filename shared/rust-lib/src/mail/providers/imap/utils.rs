//! IMAP utility functions

use crate::mail::types::*;
use mailparse::{ParsedMail, MailHeaderMap};

/// Parse IMAP message flags to our internal representation
pub fn parse_imap_flags(flags: &[async_imap::types::Flag]) -> MessageFlags {
    MessageFlags {
        is_seen: flags.contains(&async_imap::types::Flag::Seen),
        is_answered: flags.contains(&async_imap::types::Flag::Answered),
        is_flagged: flags.contains(&async_imap::types::Flag::Flagged),
        is_deleted: flags.contains(&async_imap::types::Flag::Deleted),
        is_draft: flags.contains(&async_imap::types::Flag::Draft),
        is_recent: flags.contains(&async_imap::types::Flag::Recent),
    }
}

/// Convert internal flags to IMAP flag list
pub fn flags_to_imap(flags: &MessageFlags) -> Vec<String> {
    let mut imap_flags = Vec::new();
    
    if flags.is_seen {
        imap_flags.push("\\Seen".to_string());
    }
    if flags.is_answered {
        imap_flags.push("\\Answered".to_string());
    }
    if flags.is_flagged {
        imap_flags.push("\\Flagged".to_string());
    }
    if flags.is_deleted {
        imap_flags.push("\\Deleted".to_string());
    }
    if flags.is_draft {
        imap_flags.push("\\Draft".to_string());
    }
    
    imap_flags
}

/// Parse email addresses from header value
pub fn parse_email_addresses(header_value: &str) -> Vec<String> {
    header_value
        .split(',')
        .map(|addr| addr.trim().to_string())
        .filter(|addr| !addr.is_empty())
        .collect()
}

/// Extract message ID from headers
pub fn extract_message_id(parsed: &ParsedMail) -> Option<String> {
    parsed.headers
        .get_first_value("Message-ID")
        .map(|id| id.trim_matches(&['<', '>'][..]).to_string())
}

/// Extract In-Reply-To header
pub fn extract_in_reply_to(parsed: &ParsedMail) -> Option<String> {
    parsed.headers
        .get_first_value("In-Reply-To")
        .map(|id| id.trim_matches(&['<', '>'][..]).to_string())
}

/// Extract References header as a vector
pub fn extract_references(parsed: &ParsedMail) -> Vec<String> {
    parsed.headers
        .get_first_value("References")
        .map(|refs| {
            refs.split_whitespace()
                .map(|id| id.trim_matches(&['<', '>'][..]).to_string())
                .collect()
        })
        .unwrap_or_default()
}

/// Parse date from IMAP INTERNALDATE or Date header
pub fn parse_message_date(date_str: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    // Try parsing as RFC 2822 date first
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(date_str) {
        return Some(dt.with_timezone(&chrono::Utc));
    }
    
    // Try parsing as RFC 3339/ISO 8601
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(date_str) {
        return Some(dt.with_timezone(&chrono::Utc));
    }
    
    None
}

/// Convert IMAP folder attributes to folder type
pub fn folder_type_from_attributes(attributes: &[async_imap::types::NameAttribute], name: &str) -> MailFolderType {
    
    
    // Use name-based detection since NameAttribute enum variants are not available
    let name_lower = name.to_lowercase();
    if name_lower.contains("inbox") || name_lower == "inbox" {
        return MailFolderType::Inbox;
    } else if name_lower.contains("sent") {
        return MailFolderType::Sent;
    } else if name_lower.contains("draft") {
        return MailFolderType::Drafts;
    } else if name_lower.contains("trash") || name_lower.contains("delete") {
        return MailFolderType::Trash;
    } else if name_lower.contains("spam") || name_lower.contains("junk") {
        return MailFolderType::Spam;
    }
    
    // Fallback to name-based detection
    match name.to_lowercase().as_str() {
        "inbox" => MailFolderType::Inbox,
        "sent" | "sent items" | "sent messages" => MailFolderType::Sent,
        "drafts" => MailFolderType::Drafts,
        "trash" | "deleted items" => MailFolderType::Trash,
        "spam" | "junk" | "junk email" => MailFolderType::Spam,
        "archive" => MailFolderType::Archive,
        _ => MailFolderType::Custom,
    }
}