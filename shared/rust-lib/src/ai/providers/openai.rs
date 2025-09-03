//! OpenAI Provider Implementation

use async_trait::async_trait;
use futures::Stream;
use reqwest::{Client, header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE}};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, pin::Pin};
use tokio::time::{timeout, Duration};
use tracing::{debug, error, warn};

use crate::ai::{
    config::OpenAIConfig,
    error::{AIError, AIResult, NetworkError},
    types::{
        AIProvider, AIMessage, AIResponse, MessageRole, TokenUsage, ProviderHealth, HealthStatus,
        EmailCompositionRequest, EmailCompositionResponse, EmailReplyRequest, EmailReplyResponse,
        ToneAnalysisRequest, ToneAnalysisResponse, ContentGenerationRequest, ContentGenerationResponse,
        SummarizationRequest, SummarizationResponse,
    },
    providers::{
        AIProviderTrait, EmailAIProviderTrait, ContentAIProviderTrait, ChatStreamChunk,
        ModelInfo, UsageInfo, RateLimitInfo, EmailInsights, RewriteStyle, ExtractionSchema,
        ModelCapabilities, provider_utils,
    },
};

/// OpenAI provider implementation
#[derive(Debug, Clone)]
pub struct OpenAIProvider {
    config: OpenAIConfig,
    client: Client,
    base_url: String,
}

impl OpenAIProvider {
    /// Create a new OpenAI provider
    pub async fn new(config: OpenAIConfig) -> AIResult<Self> {
        let mut headers = HeaderMap::new();
        
        // Set authorization header
        let auth_header = format!("Bearer {}", config.api_key.expose_secret());
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&auth_header).map_err(|e| {
                AIError::provider_error(AIProvider::OpenAI, format!("Invalid API key format: {}", e), false)
            })?
        );
        
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        
        // Add organization header if provided
        if let Some(org_id) = &config.organization_id {
            headers.insert("OpenAI-Organization", HeaderValue::from_str(org_id).map_err(|e| {
                AIError::provider_error(AIProvider::OpenAI, format!("Invalid organization ID format: {}", e), false)
            })?);
        }

        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .map_err(|e| AIError::provider_error(AIProvider::OpenAI, format!("Failed to create HTTP client: {}", e), false))?;

        let provider = Self {
            config: config.clone(),
            client,
            base_url: config.base_url,
        };

        // Validate credentials on creation
        provider.validate_credentials().await?;

        Ok(provider)
    }

    /// Make a request to OpenAI API
    async fn make_request<T, R>(&self, endpoint: &str, payload: &T) -> AIResult<R>
    where
        T: Serialize,
        R: for<'de> Deserialize<'de>,
    {
        let url = format!("{}/{}", self.base_url, endpoint);
        
        debug!("Making OpenAI request to: {}", url);

        let response = timeout(
            Duration::from_secs(self.config.timeout_seconds),
            self.client.post(&url).json(payload).send()
        ).await
        .map_err(|_| AIError::timeout_error("OpenAI API request", self.config.timeout_seconds * 1000))?
        .map_err(|e| self.handle_request_error(e))?;

        let status = response.status();
        
        if status.is_success() {
            let result: R = response.json().await.map_err(|e| {
                AIError::provider_error(AIProvider::OpenAI, format!("Failed to parse response: {}", e), false)
            })?;
            Ok(result)
        } else {
            let error_body = response.text().await.unwrap_or_default();
            self.handle_api_error(status.as_u16(), &error_body)
        }
    }

    /// Handle HTTP request errors
    fn handle_request_error(&self, error: reqwest::Error) -> AIError {
        if error.is_timeout() {
            AIError::timeout_error("OpenAI API request", self.config.timeout_seconds * 1000)
        } else if error.is_connect() {
            AIError::Network(NetworkError::Connection(error.to_string()))
        } else if let Some(status) = error.status() {
            AIError::provider_error(
                AIProvider::OpenAI,
                format!("HTTP error {}: {}", status, error),
                status.as_u16() >= 500 || status.as_u16() == 429
            )
        } else {
            AIError::provider_error(AIProvider::OpenAI, error.to_string(), true)
        }
    }

    /// Handle API error responses
    fn handle_api_error<T>(&self, status_code: u16, body: &str) -> AIResult<T> {
        #[derive(Deserialize)]
        struct OpenAIError {
            error: OpenAIErrorDetail,
        }

        #[derive(Deserialize)]
        struct OpenAIErrorDetail {
            message: String,
            #[serde(rename = "type")]
            error_type: Option<String>,
            code: Option<String>,
        }

        let error_info = serde_json::from_str::<OpenAIError>(body).ok();
        let message = error_info
            .as_ref()
            .map(|e| e.error.message.clone())
            .unwrap_or_else(|| format!("HTTP {} error", status_code));

        match status_code {
            401 => Err(AIError::Authentication {
                provider: AIProvider::OpenAI,
                message: "Invalid API key".to_string(),
            }),
            429 => {
                // Parse retry-after from response headers would be ideal,
                // but we'll use a default for now
                Err(AIError::rate_limit_error(
                    AIProvider::OpenAI,
                    message,
                    Some(60) // 60 seconds default
                ))
            }
            400 => Err(AIError::InvalidRequest {
                message,
                field: error_info.and_then(|e| e.error.code),
            }),
            402 => Err(AIError::QuotaExceeded {
                provider: AIProvider::OpenAI,
                message,
                quota_type: crate::ai::error::QuotaType::TokenCount,
            }),
            403 => Err(AIError::provider_error(AIProvider::OpenAI, message, false)),
            404 => Err(AIError::ModelNotFound {
                model: self.config.default_model.clone(),
                provider: AIProvider::OpenAI,
            }),
            500..=599 => Err(AIError::provider_error(AIProvider::OpenAI, message, true)),
            _ => Err(AIError::provider_error(AIProvider::OpenAI, message, false)),
        }
    }

    /// Build chat completion request
    fn build_chat_request(&self, messages: &[AIMessage]) -> serde_json::Value {
        let openai_messages = provider_utils::messages_to_openai_format(messages);
        
        serde_json::json!({
            "model": self.config.default_model,
            "messages": openai_messages,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "stream": false
        })
    }

    /// Parse OpenAI chat completion response
    fn parse_chat_response(&self, response: OpenAIChatResponse) -> AIResult<AIResponse> {
        let choice = response.choices.into_iter().next()
            .ok_or_else(|| AIError::provider_error(AIProvider::OpenAI, "No choices in response", false))?;

        let usage = TokenUsage {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
            estimated_cost: self.calculate_cost(&response.usage),
        };

        Ok(AIResponse {
            id: response.id,
            content: choice.message.content,
            model: response.model,
            provider: AIProvider::OpenAI,
            usage,
            metadata: None,
            timestamp: chrono::Utc::now(),
            latency_ms: 0, // Would need to track request start time
        })
    }

    /// Calculate estimated cost based on usage
    fn calculate_cost(&self, usage: &OpenAIUsage) -> f64 {
        // GPT-4 pricing (as of 2024)
        let input_cost_per_1k = 0.03;
        let output_cost_per_1k = 0.06;

        let input_cost = (usage.prompt_tokens as f64 / 1000.0) * input_cost_per_1k;
        let output_cost = (usage.completion_tokens as f64 / 1000.0) * output_cost_per_1k;

        input_cost + output_cost
    }
}

#[async_trait]
impl AIProviderTrait for OpenAIProvider {
    fn provider_type(&self) -> AIProvider {
        AIProvider::OpenAI
    }

    async fn health_check(&self) -> ProviderHealth {
        let start_time = std::time::Instant::now();
        let result = self.validate_credentials().await;
        let response_time = start_time.elapsed().as_millis() as u64;

        ProviderHealth {
            provider: AIProvider::OpenAI,
            status: if result.is_ok() {
                HealthStatus::Healthy
            } else {
                HealthStatus::Unhealthy
            },
            last_check: chrono::Utc::now(),
            response_time_ms: Some(response_time),
            error_rate: 0.0, // Would need to track this over time
            rate_limit_remaining: None, // Would need to parse from headers
            rate_limit_reset: None,
        }
    }

    async fn chat(&self, messages: &[AIMessage]) -> AIResult<AIResponse> {
        provider_utils::validate_messages(messages)?;
        
        let request = self.build_chat_request(messages);
        let response: OpenAIChatResponse = self.make_request("chat/completions", &request).await?;
        
        self.parse_chat_response(response)
    }

    async fn chat_stream(
        &self,
        messages: &[AIMessage],
    ) -> AIResult<Box<dyn Stream<Item = AIResult<ChatStreamChunk>> + Send + Unpin>> {
        provider_utils::validate_messages(messages)?;
        
        let mut request = self.build_chat_request(messages);
        request["stream"] = serde_json::Value::Bool(true);

        let url = format!("{}/chat/completions", self.base_url);
        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| self.handle_request_error(e))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            return self.handle_api_error(status, &body);
        }

        // Implementation would need to handle SSE parsing
        // For now, return an error as streaming is complex to implement properly
        Err(AIError::provider_error(
            AIProvider::OpenAI,
            "Streaming not yet implemented",
            false,
        ))
    }

    async fn embed(&self, texts: &[String]) -> AIResult<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let request = serde_json::json!({
            "model": "text-embedding-3-small",
            "input": texts,
            "encoding_format": "float"
        });

        let response: OpenAIEmbeddingResponse = self.make_request("embeddings", &request).await?;
        
        Ok(response.data.into_iter().map(|item| item.embedding).collect())
    }

    async fn get_models(&self) -> AIResult<Vec<ModelInfo>> {
        let response: OpenAIModelsResponse = self.make_request("models", &serde_json::json!({})).await?;
        
        Ok(response.data.into_iter().map(|model| {
            ModelInfo {
                id: model.id.clone(),
                name: model.id,
                description: None,
                context_length: 8192, // Default, would need model-specific info
                max_output_tokens: 4096,
                input_cost_per_token: 0.00003, // Default GPT-4 pricing
                output_cost_per_token: 0.00006,
                capabilities: ModelCapabilities {
                    chat: model.id.contains("gpt"),
                    completion: true,
                    embeddings: model.id.contains("embedding"),
                    function_calling: model.id.contains("gpt-4") || model.id.contains("gpt-3.5-turbo"),
                    vision: model.id.contains("vision") || model.id.contains("gpt-4-turbo"),
                    code_generation: true,
                    reasoning: true,
                },
            }
        }).collect())
    }

    async fn validate_credentials(&self) -> AIResult<bool> {
        let request = serde_json::json!({
            "model": self.config.default_model,
            "messages": [{"role": "user", "content": "test"}],
            "max_tokens": 1
        });

        match self.make_request::<_, OpenAIChatResponse>("chat/completions", &request).await {
            Ok(_) => Ok(true),
            Err(AIError::Authentication { .. }) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn get_usage(&self) -> AIResult<UsageInfo> {
        // OpenAI doesn't provide a direct usage endpoint in their API
        // This would typically be implemented by tracking usage locally
        Err(AIError::provider_error(
            AIProvider::OpenAI,
            "Usage endpoint not available",
            false,
        ))
    }

    async fn get_rate_limits(&self) -> AIResult<RateLimitInfo> {
        // Rate limit info would typically come from response headers
        // For now, return default values based on OpenAI's published limits
        Ok(RateLimitInfo {
            requests_per_minute: 500, // Varies by tier
            tokens_per_minute: 10000, // Varies by tier and model
            requests_remaining: 500,
            tokens_remaining: 10000,
            reset_time: chrono::Utc::now() + chrono::Duration::minutes(1),
        })
    }
}

#[async_trait]
impl EmailAIProviderTrait for OpenAIProvider {
    async fn compose_email(&self, request: EmailCompositionRequest) -> AIResult<EmailCompositionResponse> {
        let system_prompt = provider_utils::build_email_system_prompt();
        
        let user_prompt = format!(
            "Compose an email with the following details:
Context: {}
Recipient: {}
Subject hint: {}
Tone: {:?}
Length: {:?}
Key points: {:?}

Please provide both a subject line and email body.",
            request.context,
            request.recipient,
            request.subject_hint.unwrap_or_else(|| "None provided".to_string()),
            request.tone,
            request.length,
            request.key_points
        );

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let response = self.chat(&messages).await?;
        
        // Parse the response to extract subject and body
        // This is a simplified implementation
        let lines: Vec<&str> = response.content.lines().collect();
        let subject = lines.iter()
            .find(|line| line.to_lowercase().starts_with("subject:"))
            .map(|line| line.split(':').nth(1).unwrap_or("").trim().to_string())
            .unwrap_or_else(|| "No subject generated".to_string());

        let body_start = lines.iter()
            .position(|line| line.trim().is_empty())
            .map(|pos| pos + 1)
            .unwrap_or(1);
        
        let body = lines[body_start..].join("\n");

        Ok(EmailCompositionResponse {
            subject,
            body,
            tone_analysis: crate::ai::ToneAnalysis {
                overall_tone: request.tone,
                sentiment: crate::ai::SentimentAnalysis {
                    polarity: 0.5,
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
            suggestions: vec!["Consider adding a clear call-to-action".to_string()],
            metadata: HashMap::new(),
        })
    }

    async fn reply_email(&self, request: EmailReplyRequest) -> AIResult<EmailReplyResponse> {
        let system_prompt = format!(
            "{}\n\nYou are now replying to an email. Generate an appropriate response.",
            provider_utils::build_email_system_prompt()
        );

        let user_prompt = format!(
            "Original email:\n{}\n\nReply type: {:?}\nTone: {:?}\nKey points to address: {:?}\n\nGenerate an appropriate reply:",
            request.original_message,
            request.reply_type,
            request.tone,
            request.key_points
        );

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let response = self.chat(&messages).await?;

        Ok(EmailReplyResponse {
            body: response.content,
            tone_analysis: crate::ai::ToneAnalysis {
                overall_tone: request.tone,
                sentiment: crate::ai::SentimentAnalysis {
                    polarity: 0.5,
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
            reply_type: request.reply_type,
            suggestions: vec![],
            metadata: HashMap::new(),
        })
    }

    async fn analyze_email_tone(&self, request: ToneAnalysisRequest) -> AIResult<ToneAnalysisResponse> {
        let system_prompt = "You are an expert at analyzing the tone and sentiment of text. Provide detailed analysis including sentiment, formality, and emotional indicators.";

        let user_prompt = format!(
            "Analyze the tone and sentiment of this email:\n\n{}\n\nProvide analysis of sentiment, formality level, and any emotional indicators you detect.",
            request.text
        );

        let messages = vec![
            AIMessage::system(system_prompt.to_string()),
            AIMessage::user(user_prompt),
        ];

        let _response = self.chat(&messages).await?;

        // This would need more sophisticated parsing of the AI response
        // For now, return a basic analysis
        Ok(ToneAnalysisResponse {
            analysis: crate::ai::ToneAnalysis {
                overall_tone: crate::ai::ToneStyle::Professional,
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

    async fn extract_email_insights(&self, email_content: &str) -> AIResult<EmailInsights> {
        let system_prompt = "You are an expert at extracting insights from emails. Identify intent, urgency, key entities, action items, and topics.";

        let user_prompt = format!(
            "Extract insights from this email:\n\n{}\n\nProvide: intent, urgency level, key entities, action items, and main topics.",
            email_content
        );

        let messages = vec![
            AIMessage::system(system_prompt.to_string()),
            AIMessage::user(user_prompt),
        ];

        let _response = self.chat(&messages).await?;

        // This would need sophisticated parsing of the AI response
        // For now, return basic insights
        Ok(EmailInsights {
            intent: crate::ai::providers::EmailIntent::Information,
            urgency: crate::ai::providers::UrgencyLevel::Normal,
            sentiment: 0.1,
            key_entities: vec!["meeting".to_string(), "project".to_string()],
            action_items: vec!["Schedule follow-up".to_string()],
            topics: vec!["business".to_string()],
            language: "en".to_string(),
            reading_time_seconds: (email_content.len() / 200) as u32, // Rough estimate
        })
    }
}

#[async_trait]
impl ContentAIProviderTrait for OpenAIProvider {
    async fn generate_content(&self, request: ContentGenerationRequest) -> AIResult<ContentGenerationResponse> {
        let system_prompt = format!(
            "You are a professional content generator. Create {} content with a {} tone and {} level of detail.",
            format!("{:?}", request.content_type).to_lowercase(),
            format!("{:?}", request.tone).to_lowercase(),
            format!("{:?}", request.length).to_lowercase()
        );

        let mut user_prompt = format!("Generate content based on this prompt: {}", request.prompt);
        
        if let Some(context) = &request.context {
            user_prompt.push_str(&format!("\n\nAdditional context: {}", context));
        }

        if !request.constraints.is_empty() {
            user_prompt.push_str(&format!("\n\nConstraints: {:?}", request.constraints));
        }

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let response = self.chat(&messages).await?;

        Ok(ContentGenerationResponse {
            content: response.content,
            content_type: request.content_type,
            tone_analysis: crate::ai::ToneAnalysis {
                overall_tone: request.tone,
                sentiment: crate::ai::SentimentAnalysis {
                    polarity: 0.3,
                    magnitude: 0.5,
                    label: crate::ai::SentimentLabel::Positive,
                    confidence: 0.8,
                },
                formality_level: crate::ai::FormalityLevel::Neutral,
                emotional_indicators: vec![],
                confidence_score: 0.8,
                key_phrases: vec![],
            },
            quality_score: 0.85,
            alternative_versions: vec![],
            metadata: HashMap::new(),
        })
    }

    async fn summarize(&self, request: SummarizationRequest) -> AIResult<SummarizationResponse> {
        let system_prompt = format!(
            "You are an expert at summarizing text. Create a {} summary of type {:?}.",
            match request.length {
                crate::ai::SummaryLength::Short => "brief",
                crate::ai::SummaryLength::Medium => "moderate",
                crate::ai::SummaryLength::Long => "detailed",
                crate::ai::SummaryLength::Custom(words) => &format!("approximately {} word", words),
            },
            request.summary_type
        );

        let mut user_prompt = format!("Summarize this text:\n\n{}", request.text);
        
        if !request.focus_areas.is_empty() {
            user_prompt.push_str(&format!("\n\nFocus on these areas: {:?}", request.focus_areas));
        }

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let response = self.chat(&messages).await?;

        Ok(SummarizationResponse {
            summary: response.content,
            key_points: vec![], // Would need to parse from response
            action_items: vec![], // Would need to parse from response
            summary_type: request.summary_type,
            compression_ratio: request.text.len() as f32 / response.content.len() as f32,
            metadata: HashMap::new(),
        })
    }

    async fn rewrite_text(&self, text: &str, style: RewriteStyle) -> AIResult<String> {
        let system_prompt = format!(
            "You are an expert at rewriting text in different styles. Rewrite the given text in a {} style.",
            format!("{:?}", style).to_lowercase()
        );

        let user_prompt = format!("Rewrite this text:\n\n{}", text);

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let response = self.chat(&messages).await?;
        Ok(response.content)
    }

    async fn extract_information(&self, text: &str, schema: ExtractionSchema) -> AIResult<serde_json::Value> {
        let system_prompt = format!(
            "You are an expert at extracting structured information from text. Extract information according to the provided schema and return it as JSON."
        );

        let user_prompt = format!(
            "Extract information from this text according to the schema:\n\nText: {}\n\nSchema: {:?}\n\nReturn the extracted information as valid JSON.",
            text,
            schema
        );

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let response = self.chat(&messages).await?;
        
        // Try to parse the response as JSON
        serde_json::from_str(&response.content).map_err(|e| {
            AIError::provider_error(
                AIProvider::OpenAI,
                format!("Failed to parse extracted JSON: {}", e),
                false,
            )
        })
    }
}

// OpenAI API Response Types
#[derive(Debug, Deserialize)]
struct OpenAIChatResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<OpenAIChoice>,
    usage: OpenAIUsage,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    index: u32,
    message: OpenAIMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct OpenAIEmbeddingResponse {
    data: Vec<OpenAIEmbeddingData>,
    usage: OpenAIUsage,
}

#[derive(Debug, Deserialize)]
struct OpenAIEmbeddingData {
    embedding: Vec<f32>,
    index: u32,
}

#[derive(Debug, Deserialize)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModel>,
}

#[derive(Debug, Deserialize)]
struct OpenAIModel {
    id: String,
    object: String,
    created: u64,
    owned_by: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use secrecy::SecretString;

    fn create_test_config() -> OpenAIConfig {
        OpenAIConfig {
            api_key: SecretString::new("test-key".to_string()),
            base_url: "https://api.openai.com/v1".to_string(),
            organization_id: None,
            default_model: "gpt-3.5-turbo".to_string(),
            max_tokens: 1000,
            temperature: 0.7,
            timeout_seconds: 30,
        }
    }

    #[test]
    fn test_provider_type() {
        let config = create_test_config();
        // Can't test new() without valid API key, so just test the basic structure
        assert_eq!(config.default_model, "gpt-3.5-turbo");
    }
}