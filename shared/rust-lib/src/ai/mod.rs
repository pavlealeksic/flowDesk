//! AI Module for Flow Desk
//! 
//! This module provides comprehensive AI functionality including:
//! - Multi-provider AI integration (OpenAI, DeepSeek)
//! - Email composition and reply generation
//! - Tone analysis and sentiment detection
//! - Smart text processing and summarization
//! - Context-aware content generation

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use uuid::Uuid;

pub mod config;
pub mod providers;
pub mod email_assistant;
pub mod tone_analysis;
pub mod content_generation;
pub mod analytics;
pub mod error;
pub mod types;
pub mod utils;
pub mod napi;

pub use config::*;
pub use providers::*;
pub use email_assistant::*;
pub use tone_analysis::*;
pub use content_generation::*;
pub use analytics::*;
pub use error::*;
pub use types::*;
pub use utils::*;

/// AI Engine - Main entry point for all AI functionality
#[derive(Debug)]
pub struct AIEngine {
    config: AIConfig,
    providers: HashMap<AIProvider, Box<dyn AIProviderTrait + Send + Sync>>,
    session_cache: RwLock<HashMap<String, AISession>>,
    analytics: AIAnalytics,
}

impl AIEngine {
    /// Create a new AI Engine instance
    pub fn new(config: AIConfig) -> Result<Self, AIError> {
        let providers = HashMap::new();
        let session_cache = RwLock::new(HashMap::new());
        let analytics = AIAnalytics::new();

        Ok(Self {
            config,
            providers,
            session_cache,
            analytics,
        })
    }

    /// Initialize all configured AI providers
    pub async fn initialize(&mut self) -> Result<(), AIError> {
        // Initialize OpenAI provider if configured
        if let Some(openai_config) = &self.config.openai {
            let provider = providers::openai::OpenAIProvider::new(openai_config.clone()).await?;
            self.providers.insert(AIProvider::OpenAI, Box::new(provider));
        }

        // Initialize DeepSeek provider if configured
        if let Some(deepseek_config) = &self.config.deepseek {
            let provider = providers::deepseek::DeepSeekProvider::new(deepseek_config.clone()).await?;
            self.providers.insert(AIProvider::DeepSeek, Box::new(provider));
        }

        // Initialize local models if configured
        if let Some(local_config) = &self.config.local {
            let provider = providers::local::LocalProvider::new(local_config.clone()).await?;
            self.providers.insert(AIProvider::Local, Box::new(provider));
        }

        Ok(())
    }

    /// Generate email composition based on context
    pub async fn compose_email(&self, request: EmailCompositionRequest) -> Result<EmailCompositionResponse, AIError> {
        let assistant = EmailAssistant::new(&self.config, &self.providers)?;
        assistant.compose_email(request).await
    }

    /// Generate smart email reply
    pub async fn generate_reply(&self, request: EmailReplyRequest) -> Result<EmailReplyResponse, AIError> {
        let assistant = EmailAssistant::new(&self.config, &self.providers)?;
        assistant.generate_reply(request).await
    }

    /// Analyze tone and sentiment of text
    pub async fn analyze_tone(&self, request: ToneAnalysisRequest) -> Result<ToneAnalysisResponse, AIError> {
        let analyzer = ToneAnalyzer::new(&self.config, &self.providers)?;
        analyzer.analyze(request).await
    }

    /// Generate content based on prompt and context
    pub async fn generate_content(&self, request: ContentGenerationRequest) -> Result<ContentGenerationResponse, AIError> {
        let generator = ContentGenerator::new(&self.config, &self.providers)?;
        generator.generate(request).await
    }

    /// Summarize text content
    pub async fn summarize(&self, request: SummarizationRequest) -> Result<SummarizationResponse, AIError> {
        let generator = ContentGenerator::new(&self.config, &self.providers)?;
        generator.summarize(request).await
    }

    /// Get AI usage analytics
    pub async fn get_analytics(&self) -> Result<AIAnalyticsReport, AIError> {
        self.analytics.get_report().await
    }

    /// Create a new AI session for contextual interactions
    pub async fn create_session(&self, context: AISessionContext) -> Result<String, AIError> {
        let session_id = Uuid::new_v4().to_string();
        let session = AISession::new(session_id.clone(), context);
        
        self.session_cache.write().await.insert(session_id.clone(), session);
        Ok(session_id)
    }

    /// Continue conversation in existing session
    pub async fn continue_session(&self, session_id: &str, message: String) -> Result<AIResponse, AIError> {
        let mut cache = self.session_cache.write().await;
        let session = cache.get_mut(session_id)
            .ok_or(AIError::SessionNotFound(session_id.to_string()))?;

        session.add_message(AIMessage::user(message));
        
        // Get response from configured provider
        let provider = self.get_primary_provider()?;
        let response = provider.chat(session.get_messages()).await?;
        
        session.add_message(AIMessage::assistant(response.content.clone()));
        
        Ok(response)
    }

    /// Get health status of all providers
    pub async fn health_check(&self) -> Result<HashMap<AIProvider, ProviderHealth>, AIError> {
        let mut health = HashMap::new();
        
        for (provider_type, provider) in &self.providers {
            let status = provider.health_check().await;
            health.insert(*provider_type, status);
        }
        
        Ok(health)
    }

    /// Get primary provider based on configuration
    fn get_primary_provider(&self) -> Result<&(dyn AIProviderTrait + Send + Sync), AIError> {
        let primary = self.config.primary_provider;
        
        self.providers.get(&primary)
            .map(|p| p.as_ref())
            .ok_or(AIError::ProviderNotAvailable(primary))
    }

    /// Get provider with fallback logic
    fn get_provider_with_fallback(&self, preferred: AIProvider) -> Result<&(dyn AIProviderTrait + Send + Sync), AIError> {
        // Try preferred provider first
        if let Some(provider) = self.providers.get(&preferred) {
            return Ok(provider.as_ref());
        }

        // Fall back to primary provider
        self.get_primary_provider()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ai_engine_creation() {
        let config = AIConfig::default();
        let engine = AIEngine::new(config);
        assert!(engine.is_ok());
    }
}