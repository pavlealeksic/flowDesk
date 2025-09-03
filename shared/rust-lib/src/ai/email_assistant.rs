//! Email Assistant Implementation
//!
//! This module provides intelligent email composition, reply generation,
//! and email analysis functionality using AI providers.

use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::ai::{
    config::AIConfig,
    error::{AIError, AIResult},
    providers::{AIProviderTrait, EmailAIProviderTrait, provider_utils},
    types::{
        AIProvider, AIMessage, EmailCompositionRequest, EmailCompositionResponse,
        EmailReplyRequest, EmailReplyResponse, ToneAnalysisRequest, ToneAnalysisResponse,
        EmailContext, EmailMessage, ToneStyle, VerbosityLevel, UserAIPreferences,
        ReplyType, AttachmentInfo,
    },
};

/// Email Assistant - Main interface for AI-powered email functionality
pub struct EmailAssistant {
    config: Arc<AIConfig>,
    providers: Arc<HashMap<AIProvider, Box<dyn AIProviderTrait + Send + Sync>>>,
    templates: EmailTemplateManager,
    context_analyzer: EmailContextAnalyzer,
}

impl EmailAssistant {
    /// Create a new email assistant
    pub fn new(
        config: &AIConfig,
        providers: &HashMap<AIProvider, Box<dyn AIProviderTrait + Send + Sync>>,
    ) -> AIResult<Self> {
        Ok(Self {
            config: Arc::new(config.clone()),
            providers: Arc::new(
                providers.iter()
                    .map(|(k, v)| (*k, v.as_ref() as &dyn AIProviderTrait))
                    .collect::<HashMap<_, _>>()
                    .into_iter()
                    .map(|(k, _)| (k, providers.get(&k).unwrap().as_ref()))
                    .collect::<HashMap<_, _>>()
                    .into_iter()
                    .map(|(k, v)| {
                        // This is complex due to trait object limitations
                        // In practice, this would be handled differently
                        (k, providers.get(&k).unwrap().clone())
                    })
                    .collect()
            ),
            templates: EmailTemplateManager::new(),
            context_analyzer: EmailContextAnalyzer::new(),
        })
    }

    /// Compose a new email using AI
    pub async fn compose_email(&self, mut request: EmailCompositionRequest) -> AIResult<EmailCompositionResponse> {
        info!("Composing email for recipient: {}", request.recipient);

        // Enhance request with template and context analysis
        request = self.enhance_composition_request(request).await?;

        // Select best provider for email composition
        let provider = self.select_provider_for_task("email_composition").await?;

        // Check if provider implements email AI trait
        if let Some(email_provider) = self.get_email_provider(&provider).await? {
            // Use specialized email composition
            let response = email_provider.compose_email(request.clone()).await?;
            
            // Post-process the response
            self.post_process_composition(response, &request).await
        } else {
            // Fall back to generic chat-based composition
            self.compose_email_with_chat(&provider, request).await
        }
    }

    /// Generate a reply to an existing email
    pub async fn generate_reply(&self, mut request: EmailReplyRequest) -> AIResult<EmailReplyResponse> {
        info!("Generating reply of type {:?}", request.reply_type);

        // Analyze the original message for better context
        let analysis = self.analyze_email_for_reply(&request.original_message).await?;
        request = self.enhance_reply_request(request, analysis).await?;

        // Select best provider
        let provider = self.select_provider_for_task("email_reply").await?;

        if let Some(email_provider) = self.get_email_provider(&provider).await? {
            let response = email_provider.reply_email(request.clone()).await?;
            self.post_process_reply(response, &request).await
        } else {
            self.generate_reply_with_chat(&provider, request).await
        }
    }

    /// Analyze email tone and suggest improvements
    pub async fn analyze_tone(&self, request: ToneAnalysisRequest) -> AIResult<ToneAnalysisResponse> {
        info!("Analyzing tone for email content");

        let provider = self.select_provider_for_task("tone_analysis").await?;

        if let Some(email_provider) = self.get_email_provider(&provider).await? {
            email_provider.analyze_email_tone(request).await
        } else {
            self.analyze_tone_with_chat(&provider, request).await
        }
    }

    /// Extract insights from email content
    pub async fn extract_insights(&self, email_content: &str) -> AIResult<EmailInsights> {
        info!("Extracting insights from email content");

        let provider = self.select_provider_for_task("insight_extraction").await?;

        if let Some(email_provider) = self.get_email_provider(&provider).await? {
            email_provider.extract_email_insights(email_content).await
        } else {
            self.extract_insights_with_chat(&provider, email_content).await
        }
    }

    /// Generate multiple email variations
    pub async fn generate_variations(
        &self,
        request: EmailCompositionRequest,
        count: u32,
    ) -> AIResult<Vec<EmailCompositionResponse>> {
        info!("Generating {} email variations", count);

        let mut variations = Vec::new();
        let mut modified_request = request;

        for i in 0..count {
            // Slightly modify the request for variety
            modified_request.key_points.push(format!("Variation {}", i + 1));
            
            let variation = self.compose_email(modified_request.clone()).await?;
            variations.push(variation);
        }

        Ok(variations)
    }

    /// Suggest improvements for draft email
    pub async fn suggest_improvements(&self, draft: &str) -> AIResult<Vec<EmailImprovement>> {
        info!("Suggesting improvements for email draft");

        let provider = self.select_provider_for_task("improvement_suggestions").await?;
        
        let messages = vec![
            AIMessage::system(self.build_improvement_system_prompt()),
            AIMessage::user(format!(
                "Please analyze this email draft and suggest improvements:\n\n{}",
                draft
            )),
        ];

        let response = self.providers.get(&provider)
            .ok_or(AIError::ProviderNotAvailable(provider))?
            .chat(&messages).await?;

        // Parse response into structured improvements
        self.parse_improvement_suggestions(&response.content)
    }

    // Helper methods

    async fn enhance_composition_request(&self, mut request: EmailCompositionRequest) -> AIResult<EmailCompositionRequest> {
        // Apply email templates based on context
        if let Some(template) = self.templates.get_template(&request.recipient, &request.context).await? {
            request.key_points.extend(template.suggested_points);
        }

        // Analyze recipient context if available
        if let Some(context) = self.context_analyzer.analyze_recipient(&request.recipient).await? {
            // Adjust tone based on relationship
            if context.is_external {
                request.tone = ToneStyle::Professional;
            }
        }

        Ok(request)
    }

    async fn enhance_reply_request(&self, mut request: EmailReplyRequest, analysis: EmailAnalysis) -> AIResult<EmailReplyRequest> {
        // Adjust reply type based on original message analysis
        if analysis.requires_urgent_response {
            request.reply_type = ReplyType::Quick;
        }

        // Add context-specific points
        request.key_points.extend(analysis.suggested_response_points);

        Ok(request)
    }

    async fn select_provider_for_task(&self, task: &str) -> AIResult<AIProvider> {
        // Simple provider selection - could be made more sophisticated
        let primary = self.config.primary_provider;
        
        if self.providers.contains_key(&primary) {
            Ok(primary)
        } else if let Some((&fallback, _)) = self.providers.iter().next() {
            warn!("Primary provider {} not available, using fallback {}", primary, fallback);
            Ok(fallback)
        } else {
            Err(AIError::provider_error(
                primary,
                "No providers available".to_string(),
                false,
            ))
        }
    }

    async fn get_email_provider(&self, provider: &AIProvider) -> AIResult<Option<&dyn EmailAIProviderTrait>> {
        // This would check if the provider implements EmailAIProviderTrait
        // For now, we'll assume all providers implement it through the trait objects
        // In a real implementation, this would involve dynamic casting
        Ok(None) // Simplified for now
    }

    async fn compose_email_with_chat(&self, provider: &AIProvider, request: EmailCompositionRequest) -> AIResult<EmailCompositionResponse> {
        let system_prompt = self.build_composition_system_prompt(&request);
        let user_prompt = self.build_composition_user_prompt(&request);

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        // Parse response into structured format
        self.parse_composition_response(&response.content, &request)
    }

    async fn generate_reply_with_chat(&self, provider: &AIProvider, request: EmailReplyRequest) -> AIResult<EmailReplyResponse> {
        let system_prompt = self.build_reply_system_prompt(&request);
        let user_prompt = self.build_reply_user_prompt(&request);

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        self.parse_reply_response(&response.content, &request)
    }

    async fn analyze_tone_with_chat(&self, provider: &AIProvider, request: ToneAnalysisRequest) -> AIResult<ToneAnalysisResponse> {
        let messages = vec![
            AIMessage::system("You are an expert at analyzing email tone and sentiment. Provide detailed analysis.".to_string()),
            AIMessage::user(format!("Analyze the tone of this email:\n\n{}", request.text)),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        // For now, return a basic analysis
        // In practice, this would parse the AI response
        Ok(ToneAnalysisResponse {
            analysis: crate::ai::ToneAnalysis {
                overall_tone: ToneStyle::Professional,
                sentiment: crate::ai::SentimentAnalysis {
                    polarity: 0.1,
                    magnitude: 0.5,
                    label: crate::ai::SentimentLabel::Neutral,
                    confidence: 0.8,
                },
                formality_level: crate::ai::FormalityLevel::Formal,
                emotional_indicators: vec![],
                confidence_score: 0.8,
                key_phrases: vec![],
            },
            suggestions: vec![],
            confidence_score: 0.8,
        })
    }

    async fn extract_insights_with_chat(&self, provider: &AIProvider, email_content: &str) -> AIResult<EmailInsights> {
        let messages = vec![
            AIMessage::system("You are an expert at extracting insights from emails.".to_string()),
            AIMessage::user(format!("Extract insights from this email:\n\n{}", email_content)),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let _response = ai_provider.chat(&messages).await?;
        
        // Return basic insights for now
        Ok(EmailInsights {
            intent: crate::ai::providers::EmailIntent::Information,
            urgency: crate::ai::providers::UrgencyLevel::Normal,
            sentiment: 0.1,
            key_entities: vec!["meeting".to_string()],
            action_items: vec!["Follow up".to_string()],
            topics: vec!["business".to_string()],
            language: "en".to_string(),
            reading_time_seconds: (email_content.len() / 200) as u32,
        })
    }

    fn build_composition_system_prompt(&self, request: &EmailCompositionRequest) -> String {
        format!(
            "You are an AI email assistant helping compose professional emails. 
            Use a {} tone with {} level of detail.
            Consider the recipient relationship and context carefully.
            Always include both a subject line and body in your response.
            
            Guidelines:
            - Start with 'Subject: [your subject line]'
            - Follow with a blank line and then the email body
            - Match the requested tone and formality level
            - Include key points naturally in the content
            - Use appropriate greetings and closings",
            format!("{:?}", request.tone).to_lowercase(),
            format!("{:?}", request.length).to_lowercase()
        )
    }

    fn build_composition_user_prompt(&self, request: &EmailCompositionRequest) -> String {
        let mut prompt = format!(
            "Compose an email with these details:
            
            Recipient: {}
            Context: {}
            Tone: {:?}
            Length: {:?}",
            request.recipient,
            request.context,
            request.tone,
            request.length
        );

        if let Some(subject_hint) = &request.subject_hint {
            prompt.push_str(&format!("\nSubject hint: {}", subject_hint));
        }

        if !request.key_points.is_empty() {
            prompt.push_str(&format!("\nKey points to include: {:?}", request.key_points));
        }

        if !request.attachments.is_empty() {
            prompt.push_str(&format!("\nAttachments mentioned: {:?}", 
                request.attachments.iter().map(|a| &a.name).collect::<Vec<_>>()));
        }

        prompt.push_str("\n\nPlease compose the email now:");
        prompt
    }

    fn build_reply_system_prompt(&self, request: &EmailReplyRequest) -> String {
        format!(
            "You are an AI assistant helping generate email replies.
            Reply type: {:?}
            Tone: {:?}
            
            Guidelines:
            - Address the points in the original message appropriately
            - Use the specified tone and reply type
            - Be contextually appropriate and professional
            - Include necessary details without being verbose",
            request.reply_type,
            request.tone
        )
    }

    fn build_reply_user_prompt(&self, request: &EmailReplyRequest) -> String {
        let mut prompt = format!(
            "Generate a reply to this email:
            
            Original message:
            {}
            
            Reply type: {:?}
            Tone: {:?}",
            request.original_message,
            request.reply_type,
            request.tone
        );

        if !request.key_points.is_empty() {
            prompt.push_str(&format!("\nKey points to address: {:?}", request.key_points));
        }

        prompt.push_str("\n\nGenerate the reply:");
        prompt
    }

    fn build_improvement_system_prompt(&self) -> String {
        "You are an expert email coach. Analyze email drafts and provide specific, actionable suggestions for improvement. Focus on clarity, tone, structure, and effectiveness.".to_string()
    }

    async fn post_process_composition(&self, mut response: EmailCompositionResponse, request: &EmailCompositionRequest) -> AIResult<EmailCompositionResponse> {
        // Add privacy checks
        if self.config.privacy.scrub_personal_info {
            response.body = provider_utils::TextProcessor::sanitize_for_privacy(&response.body, false);
            response.subject = provider_utils::TextProcessor::sanitize_for_privacy(&response.subject, false);
        }

        // Add metadata
        response.metadata.insert("provider".to_string(), serde_json::Value::String(
            self.config.primary_provider.to_string()
        ));
        response.metadata.insert("generated_at".to_string(), serde_json::Value::String(
            chrono::Utc::now().to_rfc3339()
        ));

        Ok(response)
    }

    async fn post_process_reply(&self, mut response: EmailReplyResponse, request: &EmailReplyRequest) -> AIResult<EmailReplyResponse> {
        // Similar post-processing for replies
        if self.config.privacy.scrub_personal_info {
            response.body = provider_utils::TextProcessor::sanitize_for_privacy(&response.body, false);
        }

        response.metadata.insert("provider".to_string(), serde_json::Value::String(
            self.config.primary_provider.to_string()
        ));

        Ok(response)
    }

    fn parse_composition_response(&self, content: &str, request: &EmailCompositionRequest) -> AIResult<EmailCompositionResponse> {
        let lines: Vec<&str> = content.lines().collect();
        
        // Extract subject
        let subject = lines.iter()
            .find(|line| line.to_lowercase().starts_with("subject:"))
            .map(|line| line.split(':').nth(1).unwrap_or("").trim().to_string())
            .unwrap_or_else(|| "Generated Email".to_string());

        // Extract body (everything after first empty line or subject line)
        let body_start = lines.iter()
            .position(|line| line.trim().is_empty() || !line.to_lowercase().starts_with("subject:"))
            .map(|pos| pos + 1)
            .unwrap_or(1);
        
        let body = lines[body_start..].join("\n").trim().to_string();

        Ok(EmailCompositionResponse {
            subject,
            body,
            tone_analysis: crate::ai::ToneAnalysis {
                overall_tone: request.tone.clone(),
                sentiment: crate::ai::SentimentAnalysis {
                    polarity: 0.3,
                    magnitude: 0.5,
                    label: crate::ai::SentimentLabel::Positive,
                    confidence: 0.8,
                },
                formality_level: crate::ai::FormalityLevel::Formal,
                emotional_indicators: vec![],
                confidence_score: 0.8,
                key_phrases: vec![],
            },
            confidence_score: 0.8,
            suggestions: vec![],
            metadata: HashMap::new(),
        })
    }

    fn parse_reply_response(&self, content: &str, request: &EmailReplyRequest) -> AIResult<EmailReplyResponse> {
        Ok(EmailReplyResponse {
            body: content.trim().to_string(),
            tone_analysis: crate::ai::ToneAnalysis {
                overall_tone: request.tone.clone(),
                sentiment: crate::ai::SentimentAnalysis {
                    polarity: 0.2,
                    magnitude: 0.5,
                    label: crate::ai::SentimentLabel::Neutral,
                    confidence: 0.8,
                },
                formality_level: crate::ai::FormalityLevel::Formal,
                emotional_indicators: vec![],
                confidence_score: 0.8,
                key_phrases: vec![],
            },
            confidence_score: 0.8,
            reply_type: request.reply_type.clone(),
            suggestions: vec![],
            metadata: HashMap::new(),
        })
    }

    async fn analyze_email_for_reply(&self, original_message: &str) -> AIResult<EmailAnalysis> {
        // Analyze the original email to better understand how to reply
        Ok(EmailAnalysis {
            requires_urgent_response: original_message.to_lowercase().contains("urgent"),
            suggested_response_points: vec!["Thank you for your email".to_string()],
            detected_questions: self.extract_questions(original_message),
            sentiment_score: 0.1,
        })
    }

    fn extract_questions(&self, text: &str) -> Vec<String> {
        // Simple question extraction
        text.lines()
            .filter(|line| line.trim_end().ends_with('?'))
            .map(|line| line.trim().to_string())
            .collect()
    }

    fn parse_improvement_suggestions(&self, content: &str) -> AIResult<Vec<EmailImprovement>> {
        // Parse AI response into structured improvements
        // This is a simplified implementation
        let lines: Vec<&str> = content.lines()
            .filter(|line| !line.trim().is_empty())
            .collect();

        let improvements = lines.into_iter()
            .map(|line| EmailImprovement {
                category: ImprovementCategory::General,
                suggestion: line.to_string(),
                priority: ImprovementPriority::Medium,
                example: None,
            })
            .collect();

        Ok(improvements)
    }
}

/// Email template management
struct EmailTemplateManager;

impl EmailTemplateManager {
    fn new() -> Self {
        Self
    }

    async fn get_template(&self, _recipient: &str, _context: &str) -> AIResult<Option<EmailTemplate>> {
        // In practice, this would load templates from a database or config
        Ok(None)
    }
}

/// Email context analysis
struct EmailContextAnalyzer;

impl EmailContextAnalyzer {
    fn new() -> Self {
        Self
    }

    async fn analyze_recipient(&self, _recipient: &str) -> AIResult<Option<RecipientContext>> {
        // In practice, this would analyze recipient relationships, history, etc.
        Ok(None)
    }
}

// Supporting types and structures

#[derive(Debug, Clone)]
struct EmailTemplate {
    name: String,
    suggested_points: Vec<String>,
    tone: ToneStyle,
    formality: crate::ai::FormalityLevel,
}

#[derive(Debug, Clone)]
struct RecipientContext {
    is_external: bool,
    relationship_level: RelationshipLevel,
    preferred_communication_style: ToneStyle,
}

#[derive(Debug, Clone)]
enum RelationshipLevel {
    Close,
    Professional,
    Formal,
    Unknown,
}

#[derive(Debug, Clone)]
struct EmailAnalysis {
    requires_urgent_response: bool,
    suggested_response_points: Vec<String>,
    detected_questions: Vec<String>,
    sentiment_score: f32,
}

#[derive(Debug, Clone)]
pub struct EmailImprovement {
    pub category: ImprovementCategory,
    pub suggestion: String,
    pub priority: ImprovementPriority,
    pub example: Option<String>,
}

#[derive(Debug, Clone)]
pub enum ImprovementCategory {
    Clarity,
    Tone,
    Structure,
    Grammar,
    Conciseness,
    Politeness,
    General,
}

#[derive(Debug, Clone)]
pub enum ImprovementPriority {
    High,
    Medium,
    Low,
}

/// Re-export from providers module
pub use crate::ai::providers::EmailInsights;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{config::AIConfig, types::*};

    #[test]
    fn test_question_extraction() {
        let assistant = create_test_assistant();
        let text = "Hello, how are you? This is a statement. Are you available tomorrow?";
        let questions = assistant.extract_questions(text);
        
        assert_eq!(questions.len(), 2);
        assert!(questions[0].contains("how are you?"));
        assert!(questions[1].contains("Are you available tomorrow?"));
    }

    #[test]
    fn test_composition_response_parsing() {
        let assistant = create_test_assistant();
        let request = EmailCompositionRequest {
            context: "Test context".to_string(),
            recipient: "test@example.com".to_string(),
            subject_hint: None,
            tone: ToneStyle::Professional,
            length: VerbosityLevel::Balanced,
            key_points: vec![],
            reference_emails: vec![],
            attachments: vec![],
            user_preferences: UserAIPreferences::default(),
        };

        let content = "Subject: Test Email\n\nThis is the email body content.";
        let result = assistant.parse_composition_response(content, &request);
        
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.subject, "Test Email");
        assert!(response.body.contains("email body content"));
    }

    fn create_test_assistant() -> EmailAssistant {
        let config = AIConfig::default();
        let providers = HashMap::new();
        EmailAssistant::new(&config, &providers).unwrap()
    }
}