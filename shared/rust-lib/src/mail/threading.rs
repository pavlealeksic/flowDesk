use crate::mail::MailMessage;
use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailThread {
    pub thread_id: String,
    pub subject: String,
    pub participants: Vec<String>,
    pub message_count: usize,
    pub latest_message_date: chrono::DateTime<chrono::Utc>,
    pub is_read: bool,
    pub is_important: bool,
    pub has_attachments: bool,
    pub labels: Vec<String>,
}

pub struct ThreadingEngine {
    message_cache: HashMap<String, MailMessage>,
    threads: HashMap<String, Vec<String>>, // thread_id -> message_ids
    message_to_thread: HashMap<String, String>, // message_id -> thread_id
}

impl ThreadingEngine {
    pub fn new() -> Self {
        Self {
            message_cache: HashMap::new(),
            threads: HashMap::new(),
            message_to_thread: HashMap::new(),
        }
    }

    pub fn add_messages(&mut self, messages: Vec<MailMessage>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        for message in messages {
            self.add_message(message)?;
        }
        Ok(())
    }

    pub fn add_message(&mut self, message: MailMessage) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let message_id = message.id.clone();
        
        // Find or create thread for this message
        let thread_id = self.find_or_create_thread(&message)?;
        
        // Store message
        self.message_cache.insert(message_id.clone(), message);
        
        // Update thread mapping
        self.message_to_thread.insert(message_id.clone(), thread_id.clone());
        
        // Add message to thread
        self.threads.entry(thread_id)
            .or_insert_with(Vec::new)
            .push(message_id);
        
        Ok(())
    }

    fn find_or_create_thread(&self, message: &MailMessage) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // Check if message already has thread_id
        if let Some(existing_thread_id) = &message.thread_id {
            return Ok(existing_thread_id.clone());
        }

        // Try to find existing thread based on References header
        if !message.references.is_empty() {
            for reference in &message.references {
                if let Some(existing_message) = self.find_message_by_message_id(reference) {
                    if let Some(thread_id) = self.message_to_thread.get(&existing_message.id) {
                        return Ok(thread_id.clone());
                    }
                }
            }
        }

        // Try to find existing thread based on In-Reply-To header
        if let Some(in_reply_to) = &message.in_reply_to {
            if let Some(existing_message) = self.find_message_by_message_id(in_reply_to) {
                if let Some(thread_id) = self.message_to_thread.get(&existing_message.id) {
                    return Ok(thread_id.clone());
                }
            }
        }

        // Try to find by subject (normalized)
        let normalized_subject = self.normalize_subject(&message.subject);
        for (cached_message_id, cached_message) in &self.message_cache {
            let cached_normalized_subject = self.normalize_subject(&cached_message.subject);
            if cached_normalized_subject == normalized_subject && 
               cached_message.account_id == message.account_id &&
               self.are_participants_related(message, cached_message) {
                if let Some(thread_id) = self.message_to_thread.get(cached_message_id) {
                    return Ok(thread_id.clone());
                }
            }
        }

        // Create new thread
        let thread_id = uuid::Uuid::new_v4().to_string();
        Ok(thread_id)
    }

    fn find_message_by_message_id(&self, message_id: &str) -> Option<&MailMessage> {
        self.message_cache.values()
            .find(|msg| msg.message_id.as_deref() == Some(message_id))
    }

    fn normalize_subject(&self, subject: &str) -> String {
        let mut normalized = subject.to_lowercase();
        
        // Remove common prefixes
        let prefixes = ["re:", "fwd:", "fw:", "forward:", "reply:"];
        for prefix in &prefixes {
            while normalized.starts_with(prefix) {
                normalized = normalized[prefix.len()..].trim_start().to_string();
            }
        }
        
        // Remove extra whitespace
        normalized.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn are_participants_related(&self, msg1: &MailMessage, msg2: &MailMessage) -> bool {
        let msg1_participants: HashSet<_> = std::iter::once(&msg1.from_address)
            .chain(msg1.to_addresses.iter())
            .chain(msg1.cc_addresses.iter())
            .collect();
            
        let msg2_participants: HashSet<_> = std::iter::once(&msg2.from_address)
            .chain(msg2.to_addresses.iter())
            .chain(msg2.cc_addresses.iter())
            .collect();
            
        // Check if there's any overlap in participants
        msg1_participants.intersection(&msg2_participants).count() > 0
    }

    pub fn get_thread(&self, thread_id: &str) -> Option<EmailThread> {
        let message_ids = self.threads.get(thread_id)?;
        
        if message_ids.is_empty() {
            return None;
        }

        let messages: Vec<_> = message_ids.iter()
            .filter_map(|id| self.message_cache.get(id))
            .collect();

        if messages.is_empty() {
            return None;
        }

        // Get all unique participants
        let mut participants = HashSet::new();
        for message in &messages {
            participants.insert(message.from_address.clone());
            participants.extend(message.to_addresses.iter().cloned());
            participants.extend(message.cc_addresses.iter().cloned());
        }

        // Find latest message
        let latest_message = messages.iter()
            .max_by_key(|msg| msg.received_at)?;

        // Check if all messages are read
        let is_read = messages.iter().all(|msg| msg.is_read);
        
        // Check if any message is important
        let is_important = messages.iter().any(|msg| msg.is_important);
        
        // Check if any message has attachments
        let has_attachments = messages.iter().any(|msg| msg.has_attachments);

        // Collect all labels
        let mut all_labels = HashSet::new();
        for message in &messages {
            all_labels.extend(message.labels.iter().cloned());
        }

        Some(EmailThread {
            thread_id: thread_id.to_string(),
            subject: latest_message.subject.clone(),
            participants: participants.into_iter().collect(),
            message_count: messages.len(),
            latest_message_date: latest_message.received_at,
            is_read,
            is_important,
            has_attachments,
            labels: all_labels.into_iter().collect(),
        })
    }

    pub fn get_messages_in_thread(&self, thread_id: &str) -> Vec<MailMessage> {
        self.threads.get(thread_id)
            .map(|message_ids| {
                let mut messages: Vec<_> = message_ids.iter()
                    .filter_map(|id| self.message_cache.get(id))
                    .cloned()
                    .collect();
                
                // Sort by received date
                messages.sort_by_key(|msg| msg.received_at);
                messages
            })
            .unwrap_or_default()
    }

    pub fn get_all_threads(&self) -> Vec<EmailThread> {
        self.threads.keys()
            .filter_map(|thread_id| self.get_thread(thread_id))
            .collect()
    }

    pub fn get_thread_for_message(&self, message_id: &str) -> Option<String> {
        self.message_to_thread.get(message_id).cloned()
    }

    pub fn remove_message(&mut self, message_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if let Some(thread_id) = self.message_to_thread.remove(message_id) {
            if let Some(message_ids) = self.threads.get_mut(&thread_id) {
                message_ids.retain(|id| id != message_id);
                
                // Remove thread if it becomes empty
                if message_ids.is_empty() {
                    self.threads.remove(&thread_id);
                }
            }
        }
        
        self.message_cache.remove(message_id);
        Ok(())
    }
}