//! AI Types and Data Structures

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Supported AI providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AIProvider {
    OpenAI,
    DeepSeek,
    Local,
    Claude,  // Future support
    Gemini,  // Future support
}

impl std::fmt::Display for AIProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AIProvider::OpenAI => write!(f, "openai"),
            AIProvider::DeepSeek => write!(f, "deepseek"),
            AIProvider::Local => write!(f, "local"),
            AIProvider::Claude => write!(f, "claude"),
            AIProvider::Gemini => write!(f, "gemini"),
        }
    }
}

/// AI model specifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIModel {
    pub name: String,
    pub provider: AIProvider,
    pub max_tokens: u32,
    pub context_window: u32,
    pub cost_per_token: f64,
    pub supports_function_calling: bool,
    pub supports_vision: bool,
    pub supports_code: bool,
}

/// Message role in conversation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Function,
}

/// AI message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIMessage {
    pub id: String,
    pub role: MessageRole,
    pub content: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub timestamp: DateTime<Utc>,
    pub token_count: Option<u32>,
}

impl AIMessage {
    pub fn new(role: MessageRole, content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            role,
            content,
            metadata: None,
            timestamp: Utc::now(),
            token_count: None,
        }
    }

    pub fn system(content: String) -> Self {
        Self::new(MessageRole::System, content)
    }

    pub fn user(content: String) -> Self {
        Self::new(MessageRole::User, content)
    }

    pub fn assistant(content: String) -> Self {
        Self::new(MessageRole::Assistant, content)
    }

    pub fn with_metadata(mut self, metadata: HashMap<String, serde_json::Value>) -> Self {
        self.metadata = Some(metadata);
        self
    }

    pub fn with_token_count(mut self, count: u32) -> Self {
        self.token_count = Some(count);
        self
    }
}

/// AI response from providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub id: String,
    pub content: String,
    pub model: String,
    pub provider: AIProvider,
    pub usage: TokenUsage,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub timestamp: DateTime<Utc>,
    pub latency_ms: u64,
}

/// Token usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub estimated_cost: f64,
}

/// AI session for contextual conversations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISession {
    pub id: String,
    pub context: AISessionContext,
    pub messages: Vec<AIMessage>,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub metadata: HashMap<String, serde_json::Value>,
}

impl AISession {
    pub fn new(id: String, context: AISessionContext) -> Self {
        let now = Utc::now();
        Self {
            id,
            context,
            messages: Vec::new(),
            created_at: now,
            last_activity: now,
            metadata: HashMap::new(),
        }
    }

    pub fn add_message(&mut self, message: AIMessage) {
        self.messages.push(message);
        self.last_activity = Utc::now();
    }

    pub fn get_messages(&self) -> &[AIMessage] {
        &self.messages
    }

    pub fn get_recent_messages(&self, count: usize) -> &[AIMessage] {
        let start = self.messages.len().saturating_sub(count);
        &self.messages[start..]
    }
}

/// Session context for AI interactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISessionContext {
    pub session_type: SessionType,
    pub user_id: String,
    pub workspace_id: Option<String>,
    pub email_context: Option<EmailContext>,
    pub preferences: UserAIPreferences,
}

/// Type of AI session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionType {
    EmailComposition,
    EmailReply,
    GeneralChat,
    DocumentAnalysis,
    CodeAssistance,
    Research,
}

/// Email context for AI operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailContext {
    pub thread_id: Option<String>,
    pub original_message: Option<String>,
    pub sender: Option<String>,
    pub recipients: Vec<String>,
    pub subject: Option<String>,
    pub attachments: Vec<AttachmentInfo>,
    pub conversation_history: Vec<EmailMessage>,
}

/// Attachment information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentInfo {
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub content_summary: Option<String>,
}

/// Email message in conversation history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailMessage {
    pub id: String,
    pub from: String,
    pub to: Vec<String>,
    pub subject: String,
    pub body: String,
    pub timestamp: DateTime<Utc>,
    pub message_type: EmailMessageType,
}

/// Type of email message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmailMessageType {
    Sent,
    Received,
    Draft,
}

/// User AI preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAIPreferences {
    pub preferred_tone: ToneStyle,
    pub verbosity: VerbosityLevel,
    pub language: String,
    pub custom_instructions: Option<String>,
    pub privacy_mode: PrivacyMode,
    pub auto_suggestions: bool,
    pub context_awareness: bool,
}

impl Default for UserAIPreferences {
    fn default() -> Self {
        Self {
            preferred_tone: ToneStyle::Professional,
            verbosity: VerbosityLevel::Balanced,
            language: "en".to_string(),
            custom_instructions: None,
            privacy_mode: PrivacyMode::Standard,
            auto_suggestions: true,
            context_awareness: true,
        }
    }
}

/// Tone style for content generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToneStyle {
    Professional,
    Casual,
    Friendly,
    Formal,
    Concise,
    Detailed,
    Creative,
    Technical,
    Persuasive,
    Empathetic,
}

/// Verbosity level for responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerbosityLevel {
    Minimal,
    Concise,
    Balanced,
    Detailed,
    Comprehensive,
}

/// Privacy mode for AI operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrivacyMode {
    /// Full privacy - no data sent to external providers
    Strict,
    /// Standard privacy - anonymized data only
    Standard,
    /// Enhanced features - some personal data for better results
    Enhanced,
}

/// Provider health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub provider: AIProvider,
    pub status: HealthStatus,
    pub last_check: DateTime<Utc>,
    pub response_time_ms: Option<u64>,
    pub error_rate: f64,
    pub rate_limit_remaining: Option<u32>,
    pub rate_limit_reset: Option<DateTime<Utc>>,
}

/// Health status enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Request/Response types for specific AI operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailCompositionRequest {
    pub context: String,
    pub recipient: String,
    pub subject_hint: Option<String>,
    pub tone: ToneStyle,
    pub length: VerbosityLevel,
    pub key_points: Vec<String>,
    pub reference_emails: Vec<String>,
    pub attachments: Vec<AttachmentInfo>,
    pub user_preferences: UserAIPreferences,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailCompositionResponse {
    pub subject: String,
    pub body: String,
    pub tone_analysis: ToneAnalysis,
    pub confidence_score: f32,
    pub suggestions: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailReplyRequest {
    pub original_message: String,
    pub conversation_history: Vec<EmailMessage>,
    pub reply_type: ReplyType,
    pub tone: ToneStyle,
    pub key_points: Vec<String>,
    pub user_preferences: UserAIPreferences,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReplyType {
    Quick,
    Detailed,
    Forward,
    Acknowledgment,
    Decline,
    CounterProposal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailReplyResponse {
    pub body: String,
    pub tone_analysis: ToneAnalysis,
    pub confidence_score: f32,
    pub reply_type: ReplyType,
    pub suggestions: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToneAnalysisRequest {
    pub text: String,
    pub context_type: ContextType,
    pub analyze_sentiment: bool,
    pub analyze_formality: bool,
    pub analyze_emotion: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContextType {
    Email,
    Document,
    Chat,
    Social,
    Business,
    Academic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToneAnalysisResponse {
    pub analysis: ToneAnalysis,
    pub suggestions: Vec<ToneImprovement>,
    pub confidence_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToneAnalysis {
    pub overall_tone: ToneStyle,
    pub sentiment: SentimentAnalysis,
    pub formality_level: FormalityLevel,
    pub emotional_indicators: Vec<EmotionalIndicator>,
    pub confidence_score: f32,
    pub key_phrases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentAnalysis {
    pub polarity: f32,  // -1.0 to 1.0
    pub magnitude: f32, // 0.0 to 1.0
    pub label: SentimentLabel,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SentimentLabel {
    VeryNegative,
    Negative,
    Neutral,
    Positive,
    VeryPositive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FormalityLevel {
    VeryInformal,
    Informal,
    Neutral,
    Formal,
    VeryFormal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionalIndicator {
    pub emotion: EmotionType,
    pub intensity: f32, // 0.0 to 1.0
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmotionType {
    Joy,
    Sadness,
    Anger,
    Fear,
    Surprise,
    Disgust,
    Trust,
    Anticipation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToneImprovement {
    pub suggestion: String,
    pub impact: ImprovementImpact,
    pub example: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImprovementImpact {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentGenerationRequest {
    pub prompt: String,
    pub content_type: ContentType,
    pub tone: ToneStyle,
    pub length: VerbosityLevel,
    pub context: Option<String>,
    pub constraints: Vec<String>,
    pub examples: Vec<String>,
    pub user_preferences: UserAIPreferences,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContentType {
    Email,
    Document,
    Summary,
    BulletPoints,
    Paragraph,
    Title,
    Keywords,
    Translation,
    Code,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentGenerationResponse {
    pub content: String,
    pub content_type: ContentType,
    pub tone_analysis: ToneAnalysis,
    pub quality_score: f32,
    pub alternative_versions: Vec<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizationRequest {
    pub text: String,
    pub summary_type: SummaryType,
    pub length: SummaryLength,
    pub focus_areas: Vec<String>,
    pub preserve_key_points: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SummaryType {
    Extractive,
    Abstractive,
    BulletPoints,
    KeyInsights,
    ActionItems,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SummaryLength {
    Short,    // 1-2 sentences
    Medium,   // 3-5 sentences
    Long,     // 1-2 paragraphs
    Custom(u32), // Custom word count
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizationResponse {
    pub summary: String,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,
    pub summary_type: SummaryType,
    pub compression_ratio: f32,
    pub metadata: HashMap<String, serde_json::Value>,
}