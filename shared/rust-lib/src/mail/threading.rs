//! Email threading engine for conversation grouping

use crate::mail::{error::MailResult, types::*, utils::*};
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

/// Threading engine for email conversation management
pub struct ThreadingEngine {
    /// Thread cache for fast lookups
    thread_cache: tokio::sync::RwLock<HashMap<Uuid, EmailThread>>,
    /// Message ID to thread ID mapping
    message_thread_map: tokio::sync::RwLock<HashMap<Uuid, Uuid>>,
}

impl ThreadingEngine {
    /// Create new threading engine
    pub fn new() -> Self {
        Self {
            thread_cache: tokio::sync::RwLock::new(HashMap::new()),
            message_thread_map: tokio::sync::RwLock::new(HashMap::new()),
        }
    }

    /// Add message to appropriate thread
    pub async fn add_message_to_thread(&self, message: &EmailMessage) -> MailResult<Uuid> {
        // Find existing thread or create new one
        let thread_id = self.find_or_create_thread(message).await?;

        // Add message to thread
        {
            let mut thread_cache = self.thread_cache.write().await;
            if let Some(thread) = thread_cache.get_mut(&thread_id) {
                if !thread.message_ids.contains(&message.id) {
                    thread.message_ids.push(message.id);
                    thread.updated_at = chrono::Utc::now();
                    
                    // Update thread metadata
                    self.update_thread_metadata(thread, message);
                }
            }
        }

        // Update message-to-thread mapping
        {
            let mut message_thread_map = self.message_thread_map.write().await;
            message_thread_map.insert(message.id, thread_id);
        }

        Ok(thread_id)
    }

    /// Remove message from thread
    pub async fn remove_message_from_thread(&self, message: &EmailMessage) -> MailResult<()> {
        let message_thread_map = self.message_thread_map.read().await;
        if let Some(&thread_id) = message_thread_map.get(&message.id) {
            drop(message_thread_map);

            let mut thread_cache = self.thread_cache.write().await;
            if let Some(thread) = thread_cache.get_mut(&thread_id) {
                thread.message_ids.retain(|&id| id != message.id);
                thread.updated_at = chrono::Utc::now();

                // If thread is empty, remove it
                if thread.message_ids.is_empty() {
                    thread_cache.remove(&thread_id);
                }
            }

            // Remove from message mapping
            let mut message_thread_map = self.message_thread_map.write().await;
            message_thread_map.remove(&message.id);
        }

        Ok(())
    }

    /// Get thread for a message
    pub async fn get_message_thread(&self, message_id: Uuid) -> Option<EmailThread> {
        let message_thread_map = self.message_thread_map.read().await;
        if let Some(&thread_id) = message_thread_map.get(&message_id) {
            let thread_cache = self.thread_cache.read().await;
            thread_cache.get(&thread_id).cloned()
        } else {
            None
        }
    }

    /// Get all threads for an account
    pub async fn get_account_threads(&self, account_id: Uuid) -> Vec<EmailThread> {
        let thread_cache = self.thread_cache.read().await;
        thread_cache
            .values()
            .filter(|thread| thread.account_id == account_id)
            .cloned()
            .collect()
    }

    /// Find existing thread or create new one
    async fn find_or_create_thread(&self, message: &EmailMessage) -> MailResult<Uuid> {
        // Check if message references existing messages
        let existing_thread = self.find_thread_by_references(message).await;

        if let Some(thread_id) = existing_thread {
            Ok(thread_id)
        } else {
            // Create new thread
            self.create_new_thread(message).await
        }
    }

    /// Find thread by message references
    async fn find_thread_by_references(&self, message: &EmailMessage) -> Option<Uuid> {
        // Check In-Reply-To and References headers
        let mut referenced_message_ids = Vec::new();
        
        if let Some(in_reply_to) = &message.in_reply_to {
            referenced_message_ids.push(in_reply_to.clone());
        }
        
        referenced_message_ids.extend(message.references.clone());

        // Look for threads containing referenced messages
        let thread_cache = self.thread_cache.read().await;
        for thread in thread_cache.values() {
            if thread.account_id == message.account_id {
                // Check if this thread contains any referenced messages
                // This is simplified - in reality we'd check message_id headers
                if self.thread_matches_subject(thread, &message.subject) {
                    return Some(thread.id);
                }
            }
        }

        None
    }

    /// Check if thread subject matches (normalized)
    fn thread_matches_subject(&self, thread: &EmailThread, subject: &str) -> bool {
        let normalized_thread_subject = normalize_subject(&thread.subject);
        let normalized_message_subject = normalize_subject(subject);
        
        !normalized_thread_subject.is_empty() && 
        normalized_thread_subject == normalized_message_subject
    }

    /// Create new thread for message
    async fn create_new_thread(&self, message: &EmailMessage) -> MailResult<Uuid> {
        let thread_id = Uuid::new_v4();
        
        let participants = self.extract_participants(message);
        let thread_flags = self.create_thread_flags(message);

        let thread = EmailThread {
            id: thread_id,
            account_id: message.account_id,
            subject: message.subject.clone(),
            message_ids: vec![message.id],
            participants,
            labels: message.labels.clone(),
            flags: thread_flags,
            last_message_at: message.date,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        {
            let mut thread_cache = self.thread_cache.write().await;
            thread_cache.insert(thread_id, thread);
        }

        tracing::debug!("Created new thread {} for message {}", thread_id, message.id);
        Ok(thread_id)
    }

    /// Extract unique participants from message
    fn extract_participants(&self, message: &EmailMessage) -> Vec<EmailAddress> {
        let mut participants = Vec::new();
        let mut seen_addresses = HashSet::new();

        // Add sender
        if seen_addresses.insert(normalize_email(&message.from.address)) {
            participants.push(message.from.clone());
        }

        // Add recipients
        for addr in &message.to {
            if seen_addresses.insert(normalize_email(&addr.address)) {
                participants.push(addr.clone());
            }
        }

        for addr in &message.cc {
            if seen_addresses.insert(normalize_email(&addr.address)) {
                participants.push(addr.clone());
            }
        }

        participants
    }

    /// Create thread flags based on message
    fn create_thread_flags(&self, message: &EmailMessage) -> ThreadFlags {
        ThreadFlags {
            has_unread: !message.flags.is_read,
            has_starred: message.flags.is_starred,
            has_important: message.flags.is_important,
            has_attachments: message.flags.has_attachments,
        }
    }

    /// Update thread metadata when adding message
    fn update_thread_metadata(&self, thread: &mut EmailThread, message: &EmailMessage) {
        // Update last message date
        if message.date > thread.last_message_at {
            thread.last_message_at = message.date;
        }

        // Update participants
        let mut participants_map: HashMap<String, EmailAddress> = thread
            .participants
            .iter()
            .map(|p| (normalize_email(&p.address), p.clone()))
            .collect();

        // Add new participants from message
        for participant in self.extract_participants(message) {
            let normalized_addr = normalize_email(&participant.address);
            if !participants_map.contains_key(&normalized_addr) {
                participants_map.insert(normalized_addr, participant);
            }
        }

        thread.participants = participants_map.into_values().collect();

        // Update thread flags
        if !message.flags.is_read {
            thread.flags.has_unread = true;
        }
        if message.flags.is_starred {
            thread.flags.has_starred = true;
        }
        if message.flags.is_important {
            thread.flags.has_important = true;
        }
        if message.flags.has_attachments {
            thread.flags.has_attachments = true;
        }

        // Merge labels
        for label in &message.labels {
            if !thread.labels.contains(label) {
                thread.labels.push(label.clone());
            }
        }
    }

    /// Rebuild thread relationships (for maintenance)
    pub async fn rebuild_threads(&self, account_id: Uuid, messages: &[EmailMessage]) -> MailResult<()> {
        // Clear existing threads for account
        {
            let mut thread_cache = self.thread_cache.write().await;
            thread_cache.retain(|_, thread| thread.account_id != account_id);
        }

        {
            let mut message_thread_map = self.message_thread_map.write().await;
            let message_ids: HashSet<Uuid> = messages.iter().map(|m| m.id).collect();
            message_thread_map.retain(|msg_id, _| !message_ids.contains(msg_id));
        }

        // Rebuild threads by processing messages in chronological order
        let mut sorted_messages = messages.to_vec();
        sorted_messages.sort_by(|a, b| a.date.cmp(&b.date));

        for message in &sorted_messages {
            self.add_message_to_thread(message).await?;
        }

        tracing::info!("Rebuilt {} threads for account {}", 
                      self.get_account_threads(account_id).await.len(), 
                      account_id);
        
        Ok(())
    }

    /// Clear all cached threads
    pub async fn clear_cache(&self) {
        let mut thread_cache = self.thread_cache.write().await;
        let mut message_thread_map = self.message_thread_map.write().await;
        
        thread_cache.clear();
        message_thread_map.clear();
        
        tracing::debug!("Cleared threading cache");
    }
}

impl Default for ThreadingEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_message(subject: &str, from: &str, to: &str) -> EmailMessage {
        EmailMessage {
            id: Uuid::new_v4(),
            account_id: Uuid::new_v4(),
            provider_id: "test_provider_id".to_string(),
            thread_id: Uuid::new_v4(),
            subject: subject.to_string(),
            body_html: None,
            body_text: Some("Test message body".to_string()),
            snippet: "Test snippet".to_string(),
            from: EmailAddress {
                name: None,
                address: from.to_string(),
            },
            to: vec![EmailAddress {
                name: None,
                address: to.to_string(),
            }],
            cc: vec![],
            bcc: vec![],
            reply_to: vec![],
            date: Utc::now(),
            flags: EmailFlags::default(),
            labels: vec![],
            folder: "INBOX".to_string(),
            importance: MessageImportance::Normal,
            priority: MessagePriority::Normal,
            size: 1000,
            attachments: vec![],
            headers: std::collections::HashMap::new(),
            message_id: format!("test_message_{}", Uuid::new_v4()),
            in_reply_to: None,
            references: vec![],
            encryption: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_create_new_thread() {
        let threading_engine = ThreadingEngine::new();
        let message = create_test_message("Test Subject", "from@example.com", "to@example.com");
        
        let thread_id = threading_engine.add_message_to_thread(&message).await.unwrap();
        
        let thread = threading_engine.get_message_thread(message.id).await.unwrap();
        assert_eq!(thread.id, thread_id);
        assert_eq!(thread.subject, "Test Subject");
        assert_eq!(thread.message_ids.len(), 1);
        assert_eq!(thread.message_ids[0], message.id);
    }

    #[tokio::test]
    async fn test_thread_same_subject() {
        let threading_engine = ThreadingEngine::new();
        let account_id = Uuid::new_v4();
        
        let mut message1 = create_test_message("Test Subject", "from@example.com", "to@example.com");
        message1.account_id = account_id;
        
        let mut message2 = create_test_message("Re: Test Subject", "to@example.com", "from@example.com");
        message2.account_id = account_id;
        
        let thread_id1 = threading_engine.add_message_to_thread(&message1).await.unwrap();
        let thread_id2 = threading_engine.add_message_to_thread(&message2).await.unwrap();
        
        // Should be the same thread due to normalized subject matching
        assert_eq!(thread_id1, thread_id2);
        
        let thread = threading_engine.get_message_thread(message1.id).await.unwrap();
        assert_eq!(thread.message_ids.len(), 2);
    }

    #[tokio::test]
    async fn test_remove_message_from_thread() {
        let threading_engine = ThreadingEngine::new();
        let message = create_test_message("Test Subject", "from@example.com", "to@example.com");
        
        let thread_id = threading_engine.add_message_to_thread(&message).await.unwrap();
        
        // Verify message is in thread
        let thread = threading_engine.get_message_thread(message.id).await.unwrap();
        assert_eq!(thread.message_ids.len(), 1);
        
        // Remove message
        threading_engine.remove_message_from_thread(&message).await.unwrap();
        
        // Thread should be removed (empty)
        assert!(threading_engine.get_message_thread(message.id).await.is_none());
    }
}