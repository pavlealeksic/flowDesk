//! AI Provider Implementations
//!
//! This module contains implementations for various AI providers,
//! including OpenAI, DeepSeek, and local models.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::ai::{
    AIMessage, AIResponse, AIError, AIResult, TokenUsage, ProviderHealth, 
    EmailCompositionRequest, EmailCompositionResponse,
    EmailReplyRequest, EmailReplyResponse,
    ToneAnalysisRequest, ToneAnalysisResponse,
    ContentGenerationRequest, ContentGenerationResponse,
    SummarizationRequest, SummarizationResponse,
};

pub mod openai;
pub mod deepseek;
pub mod local;
pub mod utils;

pub use openai::OpenAIProvider;
pub use deepseek::DeepSeekProvider;
pub use local::LocalProvider;

/// Core trait that all AI providers must implement
#[async_trait]
pub trait AIProviderTrait {
    /// Get the provider type
    fn provider_type(&self) -> crate::ai::AIProvider;

    /// Check if the provider is available and healthy
    async fn health_check(&self) -> ProviderHealth;

    /// Generate a chat completion
    async fn chat(&self, messages: &[AIMessage]) -> AIResult<AIResponse>;

    /// Generate a chat completion with streaming
    async fn chat_stream(
        &self,
        messages: &[AIMessage],
    ) -> AIResult<Box<dyn futures::Stream<Item = AIResult<ChatStreamChunk>> + Send + Unpin>>;

    /// Generate embeddings for text
    async fn embed(&self, texts: &[String]) -> AIResult<Vec<Vec<f32>>>;

    /// Get available models
    async fn get_models(&self) -> AIResult<Vec<ModelInfo>>;

    /// Validate API credentials
    async fn validate_credentials(&self) -> AIResult<bool>;

    /// Get current usage/quota information
    async fn get_usage(&self) -> AIResult<UsageInfo>;

    /// Get rate limit information
    async fn get_rate_limits(&self) -> AIResult<RateLimitInfo>;
}

/// Extended trait for email-specific AI operations
#[async_trait]
pub trait EmailAIProviderTrait: AIProviderTrait {
    /// Generate email composition
    async fn compose_email(&self, request: EmailCompositionRequest) -> AIResult<EmailCompositionResponse>;

    /// Generate email reply
    async fn reply_email(&self, request: EmailReplyRequest) -> AIResult<EmailReplyResponse>;

    /// Analyze email tone
    async fn analyze_email_tone(&self, request: ToneAnalysisRequest) -> AIResult<ToneAnalysisResponse>;

    /// Extract email metadata and insights
    async fn extract_email_insights(&self, email_content: &str) -> AIResult<EmailInsights>;
}

/// Extended trait for content generation
#[async_trait]
pub trait ContentAIProviderTrait: AIProviderTrait {
    /// Generate content based on prompt
    async fn generate_content(&self, request: ContentGenerationRequest) -> AIResult<ContentGenerationResponse>;

    /// Summarize text content
    async fn summarize(&self, request: SummarizationRequest) -> AIResult<SummarizationResponse>;

    /// Rewrite/improve text
    async fn rewrite_text(&self, text: &str, style: RewriteStyle) -> AIResult<String>;

    /// Extract key information from text
    async fn extract_information(&self, text: &str, schema: ExtractionSchema) -> AIResult<serde_json::Value>;
}

/// Chat streaming chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatStreamChunk {
    pub id: String,
    pub content: Option<String>,
    pub finish_reason: Option<String>,
    pub usage: Option<TokenUsage>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub context_length: u32,
    pub max_output_tokens: u32,
    pub input_cost_per_token: f64,
    pub output_cost_per_token: f64,
    pub capabilities: ModelCapabilities,
}

/// Model capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCapabilities {
    pub chat: bool,
    pub completion: bool,
    pub embeddings: bool,
    pub function_calling: bool,
    pub vision: bool,
    pub code_generation: bool,
    pub reasoning: bool,
}

/// Usage information from provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    pub total_tokens: u64,
    pub total_requests: u64,
    pub total_cost: f64,
    pub period: UsagePeriod,
    pub limits: Option<UsageLimits>,
}

/// Usage period
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UsagePeriod {
    Daily,
    Monthly,
    Total,
}

/// Usage limits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageLimits {
    pub max_tokens_per_day: Option<u64>,
    pub max_requests_per_day: Option<u64>,
    pub max_cost_per_day: Option<f64>,
}

/// Rate limit information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub requests_per_minute: u32,
    pub tokens_per_minute: u32,
    pub requests_remaining: u32,
    pub tokens_remaining: u32,
    pub reset_time: chrono::DateTime<chrono::Utc>,
}

/// Email insights extracted from content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailInsights {
    pub intent: EmailIntent,
    pub urgency: UrgencyLevel,
    pub sentiment: f32, // -1.0 to 1.0
    pub key_entities: Vec<String>,
    pub action_items: Vec<String>,
    pub topics: Vec<String>,
    pub language: String,
    pub reading_time_seconds: u32,
}

/// Email intent classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmailIntent {
    Question,
    Request,
    Information,
    Meeting,
    Task,
    Follow_up,
    Complaint,
    Compliment,
    Other,
}

/// Urgency level
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UrgencyLevel {
    Low,
    Normal,
    High,
    Critical,
}

/// Text rewrite style
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RewriteStyle {
    Formal,
    Casual,
    Concise,
    Detailed,
    Professional,
    Friendly,
    Academic,
    Marketing,
}

/// Information extraction schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionSchema {
    pub fields: HashMap<String, FieldType>,
    pub required_fields: Vec<String>,
    pub description: Option<String>,
}

/// Field type for extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FieldType {
    String,
    Number,
    Boolean,
    Date,
    Email,
    Phone,
    Url,
    Array(Box<FieldType>),
    Object(HashMap<String, FieldType>),
}

/// Provider factory for creating instances
pub struct ProviderFactory;

impl ProviderFactory {
    /// Create a provider instance based on configuration
    pub async fn create_provider(
        provider_type: crate::ai::AIProvider,
        config: &crate::ai::AIConfig,
    ) -> AIResult<Box<dyn AIProviderTrait + Send + Sync>> {
        match provider_type {
            crate::ai::AIProvider::OpenAI => {
                let openai_config = config.openai.as_ref()
                    .ok_or(AIError::ProviderNotAvailable(provider_type))?;
                let provider = OpenAIProvider::new(openai_config.clone()).await?;
                Ok(Box::new(provider))
            }
            crate::ai::AIProvider::DeepSeek => {
                let deepseek_config = config.deepseek.as_ref()
                    .ok_or(AIError::ProviderNotAvailable(provider_type))?;
                let provider = DeepSeekProvider::new(deepseek_config.clone()).await?;
                Ok(Box::new(provider))
            }
            crate::ai::AIProvider::Local => {
                let local_config = config.local.as_ref()
                    .ok_or(AIError::ProviderNotAvailable(provider_type))?;
                let provider = LocalProvider::new(local_config.clone()).await?;
                Ok(Box::new(provider))
            }
            _ => Err(AIError::ProviderNotAvailable(provider_type)),
        }
    }

    /// Get all available providers from configuration
    pub async fn create_all_providers(
        config: &crate::ai::AIConfig,
    ) -> HashMap<crate::ai::AIProvider, Box<dyn AIProviderTrait + Send + Sync>> {
        let mut providers = HashMap::new();

        // Try to create each configured provider
        if config.openai.is_some() {
            if let Ok(provider) = Self::create_provider(crate::ai::AIProvider::OpenAI, config).await {
                providers.insert(crate::ai::AIProvider::OpenAI, provider);
            }
        }

        if config.deepseek.is_some() {
            if let Ok(provider) = Self::create_provider(crate::ai::AIProvider::DeepSeek, config).await {
                providers.insert(crate::ai::AIProvider::DeepSeek, provider);
            }
        }

        if config.local.is_some() {
            if let Ok(provider) = Self::create_provider(crate::ai::AIProvider::Local, config).await {
                providers.insert(crate::ai::AIProvider::Local, provider);
            }
        }

        providers
    }
}

/// Utility functions for provider implementations
pub mod provider_utils {
    use super::*;

    /// Convert messages to provider-specific format
    pub fn messages_to_openai_format(messages: &[AIMessage]) -> Vec<serde_json::Value> {
        messages.iter().map(|msg| {
            serde_json::json!({
                "role": match msg.role {
                    crate::ai::MessageRole::System => "system",
                    crate::ai::MessageRole::User => "user",
                    crate::ai::MessageRole::Assistant => "assistant",
                    crate::ai::MessageRole::Function => "function",
                },
                "content": msg.content
            })
        }).collect()
    }

    /// Calculate estimated token count for text
    pub fn estimate_tokens(text: &str) -> u32 {
        // Rough estimation: ~4 characters per token for English text
        (text.len() as f32 / 4.0).ceil() as u32
    }

    /// Validate message sequence
    pub fn validate_messages(messages: &[AIMessage]) -> AIResult<()> {
        if messages.is_empty() {
            return Err(AIError::InvalidRequest {
                message: "Messages cannot be empty".to_string(),
                field: Some("messages".to_string()),
            });
        }

        // Check for alternating user/assistant pattern (after system messages)
        let mut found_user = false;
        for msg in messages.iter().skip_while(|m| m.role == crate::ai::MessageRole::System) {
            match msg.role {
                crate::ai::MessageRole::User => {
                    found_user = true;
                }
                crate::ai::MessageRole::Assistant => {
                    if !found_user {
                        return Err(AIError::InvalidRequest {
                            message: "Assistant message must follow a user message".to_string(),
                            field: Some("messages".to_string()),
                        });
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Build system prompt for email operations
    pub fn build_email_system_prompt() -> String {
        r#"You are an AI email assistant for Flow Desk. Your primary functions are:

1. Compose professional, contextually appropriate emails
2. Generate thoughtful replies to received emails
3. Analyze tone and sentiment in email communications
4. Suggest improvements to email drafts
5. Extract key information and action items from emails

Guidelines:
- Maintain a professional and helpful tone
- Be concise but thorough
- Respect user privacy and confidentiality
- Adapt your communication style to match the context
- Always double-check for accuracy and appropriateness
- Consider cultural and business context when appropriate

When composing emails:
- Use appropriate salutations and closings
- Structure content logically with clear paragraphs
- Include relevant details while avoiding unnecessary verbosity
- Ensure the tone matches the intended relationship and purpose

When analyzing emails:
- Provide objective, helpful insights
- Consider both explicit and implicit content
- Suggest actionable improvements when appropriate"#.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{MessageRole, AIMessage};

    #[test]
    fn test_validate_messages() {
        let messages = vec![
            AIMessage::system("You are a helpful assistant".to_string()),
            AIMessage::user("Hello".to_string()),
        ];
        assert!(provider_utils::validate_messages(&messages).is_ok());

        let empty_messages = vec![];
        assert!(provider_utils::validate_messages(&empty_messages).is_err());
    }

    #[test]
    fn test_estimate_tokens() {
        let text = "Hello, world!";
        let tokens = provider_utils::estimate_tokens(text);
        assert!(tokens > 0);
        assert!(tokens < 10); // Should be around 3-4 tokens
    }
}