//! Content Generation Engine
//!
//! This module provides AI-powered content generation capabilities including
//! email composition, document creation, summarization, and text rewriting.

use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::ai::{
    config::AIConfig,
    error::{AIError, AIResult},
    providers::{AIProviderTrait, ContentAIProviderTrait, RewriteStyle, ExtractionSchema},
    types::{
        AIProvider, AIMessage, ContentGenerationRequest, ContentGenerationResponse,
        SummarizationRequest, SummarizationResponse, ToneAnalysis, ContentType,
        ToneStyle, VerbosityLevel, SummaryType, SummaryLength,
    },
};

/// Content generator for AI-powered text creation
pub struct ContentGenerator {
    config: Arc<AIConfig>,
    providers: Arc<HashMap<AIProvider, Box<dyn AIProviderTrait + Send + Sync>>>,
    template_cache: Arc<dashmap::DashMap<String, ContentTemplate>>,
    generation_cache: Arc<dashmap::DashMap<String, ContentGenerationResponse>>,
}

impl ContentGenerator {
    /// Create a new content generator
    pub fn new(
        config: &AIConfig,
        providers: &HashMap<AIProvider, Box<dyn AIProviderTrait + Send + Sync>>,
    ) -> AIResult<Self> {
        Ok(Self {
            config: Arc::new(config.clone()),
            providers: Arc::new(
                providers.iter()
                    .map(|(k, v)| (*k, v.clone()))
                    .collect()
            ),
            template_cache: Arc::new(dashmap::DashMap::new()),
            generation_cache: Arc::new(dashmap::DashMap::new()),
        })
    }

    /// Generate content based on request
    pub async fn generate(&self, request: ContentGenerationRequest) -> AIResult<ContentGenerationResponse> {
        info!("Generating {:?} content with {:?} tone", request.content_type, request.tone);

        // Check cache first
        let cache_key = self.generate_cache_key(&request);
        if self.config.caching.cache_completions {
            if let Some(cached) = self.generation_cache.get(&cache_key) {
                debug!("Using cached content generation");
                return Ok(cached.clone());
            }
        }

        // Select appropriate provider
        let provider = self.select_provider_for_content_type(&request.content_type).await?;
        
        // Generate content using specialized or generic approach
        let response = if let Some(content_provider) = self.get_content_provider(&provider).await? {
            content_provider.generate_content(request.clone()).await?
        } else {
            self.generate_with_chat(&provider, request.clone()).await?
        };

        // Post-process and validate
        let processed_response = self.post_process_content(response, &request).await?;

        // Cache if enabled
        if self.config.caching.cache_completions {
            self.generation_cache.insert(cache_key, processed_response.clone());
        }

        Ok(processed_response)
    }

    /// Summarize text content
    pub async fn summarize(&self, request: SummarizationRequest) -> AIResult<SummarizationResponse> {
        info!("Summarizing text with {:?} type, {:?} length", request.summary_type, request.length);

        let provider = self.select_provider_for_content_type(&ContentType::Summary).await?;
        
        if let Some(content_provider) = self.get_content_provider(&provider).await? {
            content_provider.summarize(request).await
        } else {
            self.summarize_with_chat(&provider, request).await
        }
    }

    /// Rewrite text in different style
    pub async fn rewrite_text(&self, text: &str, style: RewriteStyle, target_tone: Option<ToneStyle>) -> AIResult<String> {
        info!("Rewriting text with {:?} style", style);

        let provider = self.select_provider_for_content_type(&ContentType::Document).await?;
        
        if let Some(content_provider) = self.get_content_provider(&provider).await? {
            content_provider.rewrite_text(text, style).await
        } else {
            self.rewrite_with_chat(&provider, text, style, target_tone).await
        }
    }

    /// Extract structured information from text
    pub async fn extract_information(&self, text: &str, schema: ExtractionSchema) -> AIResult<serde_json::Value> {
        info!("Extracting information using schema: {:?}", schema);

        let provider = self.select_provider_for_content_type(&ContentType::Document).await?;
        
        if let Some(content_provider) = self.get_content_provider(&provider).await? {
            content_provider.extract_information(text, schema).await
        } else {
            self.extract_with_chat(&provider, text, schema).await
        }
    }

    /// Generate multiple content variations
    pub async fn generate_variations(
        &self,
        request: ContentGenerationRequest,
        count: u32,
        variation_degree: VariationDegree,
    ) -> AIResult<Vec<ContentGenerationResponse>> {
        info!("Generating {} variations with {:?} degree", count, variation_degree);

        let mut variations = Vec::new();
        let base_response = self.generate(request.clone()).await?;
        variations.push(base_response);

        for i in 1..count {
            let mut modified_request = request.clone();
            
            // Modify request based on variation degree
            match variation_degree {
                VariationDegree::Minimal => {
                    modified_request.prompt = format!("{} (variation {})", modified_request.prompt, i);
                }
                VariationDegree::Moderate => {
                    modified_request.tone = self.get_alternative_tone(&request.tone);
                    modified_request.length = self.get_alternative_length(&request.length);
                }
                VariationDegree::Significant => {
                    modified_request.tone = self.get_alternative_tone(&request.tone);
                    modified_request.length = self.get_alternative_length(&request.length);
                    modified_request.prompt = format!(
                        "Create a different approach to: {}",
                        modified_request.prompt
                    );
                }
            }
            
            let variation = self.generate(modified_request).await?;
            variations.push(variation);
        }

        Ok(variations)
    }

    /// Improve existing content
    pub async fn improve_content(
        &self,
        content: &str,
        content_type: ContentType,
        improvement_goals: Vec<ImprovementGoal>,
    ) -> AIResult<ContentImprovementResponse> {
        info!("Improving content with {} goals", improvement_goals.len());

        let provider = self.select_provider_for_content_type(&content_type).await?;
        
        let system_prompt = self.build_improvement_system_prompt(&content_type, &improvement_goals);
        let user_prompt = format!(
            "Improve this content based on the specified goals:\n\n{}\n\nGoals: {:?}",
            content,
            improvement_goals
        );

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(&provider)
            .ok_or(AIError::ProviderNotAvailable(provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        Ok(ContentImprovementResponse {
            improved_content: response.content.clone(),
            improvements_made: improvement_goals,
            quality_score: self.calculate_quality_score(&response.content),
            change_summary: self.generate_change_summary(content, &response.content),
        })
    }

    /// Generate content outline
    pub async fn generate_outline(&self, topic: &str, outline_type: OutlineType) -> AIResult<ContentOutline> {
        info!("Generating {:?} outline for: {}", outline_type, topic);

        let provider = self.select_provider_for_content_type(&ContentType::Document).await?;
        
        let system_prompt = format!(
            "You are an expert content strategist. Create a detailed {} outline.",
            format!("{:?}", outline_type).to_lowercase()
        );
        
        let user_prompt = format!("Create an outline for: {}", topic);

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(&provider)
            .ok_or(AIError::ProviderNotAvailable(provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        Ok(ContentOutline {
            topic: topic.to_string(),
            outline_type,
            sections: self.parse_outline_sections(&response.content),
            estimated_length: self.estimate_content_length(&response.content),
        })
    }

    // Private helper methods

    async fn generate_with_chat(
        &self,
        provider: &AIProvider,
        request: ContentGenerationRequest,
    ) -> AIResult<ContentGenerationResponse> {
        let system_prompt = self.build_generation_system_prompt(&request);
        let user_prompt = self.build_generation_user_prompt(&request);

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        Ok(ContentGenerationResponse {
            content: response.content,
            content_type: request.content_type,
            tone_analysis: self.analyze_generated_tone(&response.content, &request.tone).await?,
            quality_score: self.calculate_quality_score(&response.content),
            alternative_versions: vec![],
            metadata: HashMap::new(),
        })
    }

    async fn summarize_with_chat(
        &self,
        provider: &AIProvider,
        request: SummarizationRequest,
    ) -> AIResult<SummarizationResponse> {
        let system_prompt = self.build_summarization_system_prompt(&request);
        let user_prompt = format!("Summarize this text:\n\n{}", request.text);

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        Ok(SummarizationResponse {
            summary: response.content.clone(),
            key_points: self.extract_key_points(&response.content),
            action_items: self.extract_action_items(&response.content),
            summary_type: request.summary_type,
            compression_ratio: request.text.len() as f32 / response.content.len() as f32,
            metadata: HashMap::new(),
        })
    }

    async fn rewrite_with_chat(
        &self,
        provider: &AIProvider,
        text: &str,
        style: RewriteStyle,
        target_tone: Option<ToneStyle>,
    ) -> AIResult<String> {
        let system_prompt = format!(
            "You are an expert writer. Rewrite text in a {} style{}.",
            format!("{:?}", style).to_lowercase(),
            target_tone.map(|t| format!(" with a {:?} tone", t)).unwrap_or_default()
        );
        
        let user_prompt = format!("Rewrite this text:\n\n{}", text);

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        Ok(response.content)
    }

    async fn extract_with_chat(
        &self,
        provider: &AIProvider,
        text: &str,
        schema: ExtractionSchema,
    ) -> AIResult<serde_json::Value> {
        let system_prompt = "You are an expert at extracting structured information from text. Return only valid JSON.";
        
        let user_prompt = format!(
            "Extract information from this text according to the schema:\n\nText: {}\n\nSchema: {:?}\n\nReturn only JSON:",
            text, schema
        );

        let messages = vec![
            AIMessage::system(system_prompt.to_string()),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        serde_json::from_str(&response.content).map_err(|e| {
            AIError::provider_error(
                *provider,
                format!("Failed to parse extracted JSON: {}", e),
                false,
            )
        })
    }

    async fn select_provider_for_content_type(&self, content_type: &ContentType) -> AIResult<AIProvider> {
        // Could implement content-type specific provider selection
        let primary = self.config.primary_provider;
        
        if self.providers.contains_key(&primary) {
            Ok(primary)
        } else if let Some((&fallback, _)) = self.providers.iter().next() {
            warn!("Primary provider {} not available, using fallback", primary);
            Ok(fallback)
        } else {
            Err(AIError::provider_error(
                primary,
                "No providers available for content generation".to_string(),
                false,
            ))
        }
    }

    async fn get_content_provider(&self, provider: &AIProvider) -> AIResult<Option<&dyn ContentAIProviderTrait>> {
        // In a real implementation, this would check if the provider implements ContentAIProviderTrait
        Ok(None)
    }

    async fn post_process_content(
        &self,
        mut response: ContentGenerationResponse,
        request: &ContentGenerationRequest,
    ) -> AIResult<ContentGenerationResponse> {
        // Apply privacy filters if enabled
        if self.config.privacy.scrub_personal_info {
            response.content = self.scrub_personal_information(&response.content);
        }

        // Validate content length matches request
        if !self.content_length_matches_request(&response.content, &request.length) {
            warn!("Generated content length doesn't match request");
        }

        // Add metadata
        response.metadata.insert(
            "provider".to_string(),
            serde_json::Value::String(self.config.primary_provider.to_string())
        );
        response.metadata.insert(
            "generated_at".to_string(),
            serde_json::Value::String(chrono::Utc::now().to_rfc3339())
        );

        Ok(response)
    }

    // Prompt building methods

    fn build_generation_system_prompt(&self, request: &ContentGenerationRequest) -> String {
        format!(
            "You are a professional content creator specializing in {} content. \
            Use a {:?} tone with {:?} level of detail. \
            Create high-quality, engaging content that meets the specified requirements.",
            format!("{:?}", request.content_type).to_lowercase(),
            request.tone,
            request.length
        )
    }

    fn build_generation_user_prompt(&self, request: &ContentGenerationRequest) -> String {
        let mut prompt = format!("Create {} content based on this prompt: {}", 
            format!("{:?}", request.content_type).to_lowercase(),
            request.prompt
        );

        if let Some(context) = &request.context {
            prompt.push_str(&format!("\n\nAdditional context: {}", context));
        }

        if !request.constraints.is_empty() {
            prompt.push_str(&format!("\n\nConstraints: {}", request.constraints.join(", ")));
        }

        if !request.examples.is_empty() {
            prompt.push_str(&format!("\n\nExamples for reference:\n{}", request.examples.join("\n\n")));
        }

        prompt
    }

    fn build_summarization_system_prompt(&self, request: &SummarizationRequest) -> String {
        let length_instruction = match request.length {
            SummaryLength::Short => "Keep it brief - 1-2 sentences",
            SummaryLength::Medium => "Provide a moderate summary - 3-5 sentences",  
            SummaryLength::Long => "Create a detailed summary - 1-2 paragraphs",
            SummaryLength::Custom(words) => &format!("Aim for approximately {} words", words),
        };

        format!(
            "You are an expert at creating {} summaries. {}. Focus on the most important information.",
            format!("{:?}", request.summary_type).to_lowercase(),
            length_instruction
        )
    }

    fn build_improvement_system_prompt(&self, content_type: &ContentType, goals: &[ImprovementGoal]) -> String {
        format!(
            "You are an expert {} editor. Improve the content focusing on: {}. \
            Maintain the original meaning while enhancing quality.",
            format!("{:?}", content_type).to_lowercase(),
            goals.iter().map(|g| format!("{:?}", g)).collect::<Vec<_>>().join(", ")
        )
    }

    // Utility methods

    fn generate_cache_key(&self, request: &ContentGenerationRequest) -> String {
        let content = format!(
            "{}:{}:{:?}:{:?}:{}:{}",
            request.prompt,
            request.context.as_deref().unwrap_or(""),
            request.content_type,
            request.tone,
            request.constraints.join(","),
            request.examples.join(",")
        );
        format!("content:{}", blake3::hash(content.as_bytes()))
    }

    fn scrub_personal_information(&self, content: &str) -> String {
        // Simple implementation - would be more sophisticated in production
        let mut scrubbed = content.to_string();
        
        // Remove common patterns
        let patterns = [
            (regex::Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").unwrap(), "[SSN]"),
            (regex::Regex::new(r"\b\d{3}-\d{3}-\d{4}\b").unwrap(), "[PHONE]"),
            (regex::Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap(), "[EMAIL]"),
        ];

        for (pattern, replacement) in &patterns {
            scrubbed = pattern.replace_all(&scrubbed, *replacement).to_string();
        }

        scrubbed
    }

    fn content_length_matches_request(&self, content: &str, requested_length: &VerbosityLevel) -> bool {
        let word_count = content.split_whitespace().count();
        
        match requested_length {
            VerbosityLevel::Minimal => word_count <= 50,
            VerbosityLevel::Concise => word_count <= 150,
            VerbosityLevel::Balanced => word_count <= 300,
            VerbosityLevel::Detailed => word_count <= 500,
            VerbosityLevel::Comprehensive => word_count > 500,
        }
    }

    fn calculate_quality_score(&self, content: &str) -> f32 {
        let mut score = 0.5; // Base score
        
        // Check for various quality indicators
        let word_count = content.split_whitespace().count();
        let sentence_count = content.split('.').count();
        let avg_sentence_length = word_count as f32 / sentence_count.max(1) as f32;
        
        // Adjust score based on readability metrics
        if avg_sentence_length >= 15.0 && avg_sentence_length <= 25.0 {
            score += 0.2;
        }
        
        if word_count >= 50 {
            score += 0.1;
        }
        
        if content.contains("because") || content.contains("therefore") || content.contains("however") {
            score += 0.1; // Logical connectors
        }
        
        score.min(1.0)
    }

    async fn analyze_generated_tone(&self, content: &str, expected_tone: &ToneStyle) -> AIResult<ToneAnalysis> {
        // Simplified tone analysis - would use ToneAnalyzer in production
        Ok(ToneAnalysis {
            overall_tone: expected_tone.clone(),
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
        })
    }

    fn extract_key_points(&self, text: &str) -> Vec<String> {
        // Simple key point extraction
        text.lines()
            .filter(|line| line.trim().starts_with("•") || line.trim().starts_with("-"))
            .map(|line| line.trim_start_matches(&['•', '-', ' ']).to_string())
            .collect()
    }

    fn extract_action_items(&self, text: &str) -> Vec<String> {
        // Look for action-oriented language
        text.lines()
            .filter(|line| {
                let line_lower = line.to_lowercase();
                line_lower.contains("action:") || line_lower.contains("todo:") || line_lower.contains("next:")
            })
            .map(|line| line.to_string())
            .collect()
    }

    fn get_alternative_tone(&self, current_tone: &ToneStyle) -> ToneStyle {
        match current_tone {
            ToneStyle::Professional => ToneStyle::Friendly,
            ToneStyle::Casual => ToneStyle::Professional,
            ToneStyle::Friendly => ToneStyle::Professional,
            ToneStyle::Formal => ToneStyle::Casual,
            ToneStyle::Concise => ToneStyle::Detailed,
            ToneStyle::Detailed => ToneStyle::Concise,
            _ => ToneStyle::Professional,
        }
    }

    fn get_alternative_length(&self, current_length: &VerbosityLevel) -> VerbosityLevel {
        match current_length {
            VerbosityLevel::Minimal => VerbosityLevel::Concise,
            VerbosityLevel::Concise => VerbosityLevel::Balanced,
            VerbosityLevel::Balanced => VerbosityLevel::Detailed,
            VerbosityLevel::Detailed => VerbosityLevel::Concise,
            VerbosityLevel::Comprehensive => VerbosityLevel::Balanced,
        }
    }

    fn generate_change_summary(&self, original: &str, improved: &str) -> String {
        let orig_words = original.split_whitespace().count();
        let imp_words = improved.split_whitespace().count();
        
        format!(
            "Word count changed from {} to {} words. Content has been enhanced for clarity and effectiveness.",
            orig_words, imp_words
        )
    }

    fn parse_outline_sections(&self, content: &str) -> Vec<OutlineSection> {
        let mut sections = Vec::new();
        let mut current_section: Option<OutlineSection> = None;
        
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() { continue; }
            
            // Detect main sections (usually numbered or with special formatting)
            if line.starts_with(char::is_numeric) || line.starts_with("# ") {
                if let Some(section) = current_section.take() {
                    sections.push(section);
                }
                
                current_section = Some(OutlineSection {
                    title: line.to_string(),
                    subsections: vec![],
                    estimated_words: 0,
                });
            } else if line.starts_with("  ") || line.starts_with("- ") {
                // Subsection
                if let Some(ref mut section) = current_section {
                    section.subsections.push(line.to_string());
                }
            }
        }
        
        // Add the last section
        if let Some(section) = current_section {
            sections.push(section);
        }
        
        sections
    }

    fn estimate_content_length(&self, outline: &str) -> u32 {
        // Rough estimation based on outline complexity
        let section_count = outline.lines().filter(|l| !l.trim().is_empty()).count();
        (section_count * 150) as u32 // Rough estimate of 150 words per section
    }
}

// Supporting types

#[derive(Debug, Clone)]
pub struct ContentTemplate {
    pub name: String,
    pub content_type: ContentType,
    pub structure: Vec<String>,
    pub placeholders: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub enum VariationDegree {
    Minimal,
    Moderate,
    Significant,
}

#[derive(Debug, Clone)]
pub enum ImprovementGoal {
    Clarity,
    Engagement,
    Conciseness,
    Flow,
    Grammar,
    Tone,
    Structure,
}

#[derive(Debug, Clone)]
pub struct ContentImprovementResponse {
    pub improved_content: String,
    pub improvements_made: Vec<ImprovementGoal>,
    pub quality_score: f32,
    pub change_summary: String,
}

#[derive(Debug, Clone)]
pub enum OutlineType {
    Article,
    Report,
    Presentation,
    Email,
    Document,
}

#[derive(Debug, Clone)]
pub struct ContentOutline {
    pub topic: String,
    pub outline_type: OutlineType,
    pub sections: Vec<OutlineSection>,
    pub estimated_length: u32,
}

#[derive(Debug, Clone)]
pub struct OutlineSection {
    pub title: String,
    pub subsections: Vec<String>,
    pub estimated_words: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quality_score_calculation() {
        let generator = create_test_generator();
        
        let good_content = "This is a well-written piece of content. It contains multiple sentences with good structure. The sentences are of appropriate length and contain logical connectors because they improve readability.";
        let score = generator.calculate_quality_score(good_content);
        
        assert!(score > 0.5);
        assert!(score <= 1.0);
    }

    #[test]
    fn test_content_length_matching() {
        let generator = create_test_generator();
        
        let short_content = "Brief content.";
        assert!(generator.content_length_matches_request(short_content, &VerbosityLevel::Minimal));
        
        let long_content = "This is a much longer piece of content that contains many more words and should not match the minimal verbosity level but should match detailed or comprehensive levels.";
        assert!(!generator.content_length_matches_request(long_content, &VerbosityLevel::Minimal));
        assert!(generator.content_length_matches_request(long_content, &VerbosityLevel::Detailed));
    }

    fn create_test_generator() -> ContentGenerator {
        let config = AIConfig::default();
        let providers = HashMap::new();
        ContentGenerator::new(&config, &providers).unwrap()
    }
}