//! Tone Analysis Engine
//!
//! This module provides comprehensive tone and sentiment analysis for text content,
//! particularly focused on email communication. It uses AI providers to analyze
//! emotional indicators, formality levels, and overall sentiment.

use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::ai::{
    config::AIConfig,
    error::{AIError, AIResult},
    providers::{AIProviderTrait, ContentAIProviderTrait},
    types::{
        AIProvider, AIMessage, ToneAnalysisRequest, ToneAnalysisResponse,
        ToneAnalysis, SentimentAnalysis, SentimentLabel, FormalityLevel,
        EmotionalIndicator, EmotionType, ToneImprovement, ImprovementImpact,
        ToneStyle, ContextType,
    },
};

/// Tone analyzer for comprehensive text analysis
pub struct ToneAnalyzer {
    config: Arc<AIConfig>,
    providers: Arc<HashMap<AIProvider, Box<dyn AIProviderTrait + Send + Sync>>>,
    sentiment_cache: Arc<dashmap::DashMap<String, SentimentAnalysis>>,
    tone_cache: Arc<dashmap::DashMap<String, ToneAnalysis>>,
}

impl ToneAnalyzer {
    /// Create a new tone analyzer
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
            sentiment_cache: Arc::new(dashmap::DashMap::new()),
            tone_cache: Arc::new(dashmap::DashMap::new()),
        })
    }

    /// Analyze tone and sentiment of text
    pub async fn analyze(&self, request: ToneAnalysisRequest) -> AIResult<ToneAnalysisResponse> {
        info!("Analyzing tone for {} context", format!("{:?}", request.context_type));

        // Check cache first
        let cache_key = self.generate_cache_key(&request);
        if let Some(cached_analysis) = self.tone_cache.get(&cache_key) {
            debug!("Using cached tone analysis");
            return Ok(ToneAnalysisResponse {
                analysis: cached_analysis.clone(),
                suggestions: self.generate_tone_suggestions(&cached_analysis, &request).await?,
                confidence_score: cached_analysis.confidence_score,
            });
        }

        // Select provider for analysis
        let provider = self.select_provider_for_tone_analysis().await?;
        
        // Perform comprehensive analysis
        let analysis = self.perform_comprehensive_analysis(&request, &provider).await?;
        
        // Cache the result
        self.tone_cache.insert(cache_key, analysis.clone());
        
        // Generate improvement suggestions
        let suggestions = self.generate_tone_suggestions(&analysis, &request).await?;

        Ok(ToneAnalysisResponse {
            analysis: analysis.clone(),
            suggestions,
            confidence_score: analysis.confidence_score,
        })
    }

    /// Quick sentiment analysis (cached)
    pub async fn quick_sentiment(&self, text: &str) -> AIResult<SentimentAnalysis> {
        let cache_key = format!("sentiment:{}", blake3::hash(text.as_bytes()));
        
        if let Some(cached) = self.sentiment_cache.get(&cache_key) {
            return Ok(cached.clone());
        }

        let provider = self.select_provider_for_tone_analysis().await?;
        let sentiment = self.analyze_sentiment(text, &provider).await?;
        
        self.sentiment_cache.insert(cache_key, sentiment.clone());
        Ok(sentiment)
    }

    /// Analyze formality level
    pub async fn analyze_formality(&self, text: &str, context: ContextType) -> AIResult<FormalityLevel> {
        let provider = self.select_provider_for_tone_analysis().await?;
        
        let system_prompt = self.build_formality_system_prompt(context);
        let user_prompt = format!("Analyze the formality level of this text:\n\n{}", text);
        
        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(&provider)
            .ok_or(AIError::ProviderNotAvailable(provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        // Parse formality level from response
        self.parse_formality_level(&response.content)
    }

    /// Detect emotional indicators
    pub async fn detect_emotions(&self, text: &str) -> AIResult<Vec<EmotionalIndicator>> {
        let provider = self.select_provider_for_tone_analysis().await?;
        
        let system_prompt = "You are an expert at detecting emotions in text. Identify specific emotional indicators with their intensity levels.";
        let user_prompt = format!(
            "Detect and analyze emotions in this text. For each emotion found, provide the emotion type and intensity (0.0-1.0):\n\n{}", 
            text
        );
        
        let messages = vec![
            AIMessage::system(system_prompt.to_string()),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(&provider)
            .ok_or(AIError::ProviderNotAvailable(provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        // Parse emotional indicators from response
        self.parse_emotional_indicators(&response.content)
    }

    /// Compare tone between texts
    pub async fn compare_tone(&self, text1: &str, text2: &str) -> AIResult<ToneComparison> {
        let analysis1 = self.analyze(ToneAnalysisRequest {
            text: text1.to_string(),
            context_type: ContextType::Email,
            analyze_sentiment: true,
            analyze_formality: true,
            analyze_emotion: true,
        }).await?;

        let analysis2 = self.analyze(ToneAnalysisRequest {
            text: text2.to_string(),
            context_type: ContextType::Email,
            analyze_sentiment: true,
            analyze_formality: true,
            analyze_emotion: true,
        }).await?;

        Ok(ToneComparison {
            text1_analysis: analysis1.analysis,
            text2_analysis: analysis2.analysis,
            differences: self.calculate_tone_differences(&analysis1.analysis, &analysis2.analysis),
            similarity_score: self.calculate_similarity_score(&analysis1.analysis, &analysis2.analysis),
        })
    }

    // Private helper methods

    async fn perform_comprehensive_analysis(
        &self,
        request: &ToneAnalysisRequest,
        provider: &AIProvider,
    ) -> AIResult<ToneAnalysis> {
        let system_prompt = self.build_comprehensive_analysis_prompt(request);
        let user_prompt = format!("Analyze this text comprehensively:\n\n{}", request.text);
        
        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        // Parse comprehensive analysis
        let sentiment = if request.analyze_sentiment {
            self.parse_sentiment_from_response(&response.content)?
        } else {
            SentimentAnalysis {
                polarity: 0.0,
                magnitude: 0.0,
                label: SentimentLabel::Neutral,
                confidence: 0.0,
            }
        };

        let formality = if request.analyze_formality {
            self.parse_formality_from_response(&response.content)?
        } else {
            FormalityLevel::Neutral
        };

        let emotions = if request.analyze_emotion {
            self.parse_emotions_from_response(&response.content)?
        } else {
            vec![]
        };

        let overall_tone = self.determine_overall_tone(&sentiment, &formality, &emotions);
        let key_phrases = self.extract_key_phrases(&response.content);
        
        Ok(ToneAnalysis {
            overall_tone,
            sentiment,
            formality_level: formality,
            emotional_indicators: emotions,
            confidence_score: self.calculate_confidence(&sentiment, &emotions),
            key_phrases,
        })
    }

    async fn analyze_sentiment(&self, text: &str, provider: &AIProvider) -> AIResult<SentimentAnalysis> {
        let system_prompt = "You are an expert sentiment analyzer. Analyze the sentiment and provide polarity (-1.0 to 1.0) and magnitude (0.0 to 1.0).";
        let user_prompt = format!("Analyze sentiment: {}", text);
        
        let messages = vec![
            AIMessage::system(system_prompt.to_string()),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(provider)
            .ok_or(AIError::ProviderNotAvailable(*provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        self.parse_sentiment_from_response(&response.content)
    }

    async fn generate_tone_suggestions(
        &self,
        analysis: &ToneAnalysis,
        request: &ToneAnalysisRequest,
    ) -> AIResult<Vec<ToneImprovement>> {
        let provider = self.select_provider_for_tone_analysis().await?;
        
        let system_prompt = format!(
            "You are an expert communication coach. Based on the tone analysis, provide specific improvement suggestions for {} context.",
            format!("{:?}", request.context_type).to_lowercase()
        );
        
        let user_prompt = format!(
            "Based on this tone analysis, suggest improvements:\n\
            Overall tone: {:?}\n\
            Sentiment: {:?} (polarity: {:.2})\n\
            Formality: {:?}\n\
            Emotions: {:?}\n\
            \n\
            Original text: {}\n\
            \n\
            Provide specific, actionable suggestions for improvement.",
            analysis.overall_tone,
            analysis.sentiment.label,
            analysis.sentiment.polarity,
            analysis.formality_level,
            analysis.emotional_indicators.iter()
                .map(|e| format!("{:?}", e.emotion))
                .collect::<Vec<_>>(),
            request.text
        );

        let messages = vec![
            AIMessage::system(system_prompt),
            AIMessage::user(user_prompt),
        ];

        let ai_provider = self.providers.get(&provider)
            .ok_or(AIError::ProviderNotAvailable(provider))?;

        let response = ai_provider.chat(&messages).await?;
        
        self.parse_improvement_suggestions(&response.content)
    }

    async fn select_provider_for_tone_analysis(&self) -> AIResult<AIProvider> {
        let primary = self.config.primary_provider;
        
        if self.providers.contains_key(&primary) {
            Ok(primary)
        } else if let Some((&fallback, _)) = self.providers.iter().next() {
            warn!("Primary provider {} not available for tone analysis, using fallback", primary);
            Ok(fallback)
        } else {
            Err(AIError::provider_error(
                primary,
                "No providers available for tone analysis".to_string(),
                false,
            ))
        }
    }

    fn generate_cache_key(&self, request: &ToneAnalysisRequest) -> String {
        let content = format!(
            "{}:{:?}:{}:{}:{}",
            request.text,
            request.context_type,
            request.analyze_sentiment,
            request.analyze_formality,
            request.analyze_emotion
        );
        format!("tone:{}", blake3::hash(content.as_bytes()))
    }

    fn build_comprehensive_analysis_prompt(&self, request: &ToneAnalysisRequest) -> String {
        let mut prompt = "You are an expert at analyzing communication tone and style.".to_string();
        
        if request.analyze_sentiment {
            prompt.push_str(" Analyze sentiment with polarity (-1.0 to 1.0) and magnitude (0.0 to 1.0).");
        }
        
        if request.analyze_formality {
            prompt.push_str(" Determine formality level (very informal to very formal).");
        }
        
        if request.analyze_emotion {
            prompt.push_str(" Identify emotional indicators with intensity levels.");
        }
        
        prompt.push_str(&format!(" Context type: {:?}.", request.context_type));
        prompt.push_str(" Provide detailed analysis in a structured format.");
        
        prompt
    }

    fn build_formality_system_prompt(&self, context: ContextType) -> String {
        format!(
            "You are an expert at analyzing formality levels in {} communication. \
            Classify text as: very informal, informal, neutral, formal, or very formal.",
            format!("{:?}", context).to_lowercase()
        )
    }

    // Parsing methods

    fn parse_sentiment_from_response(&self, response: &str) -> AIResult<SentimentAnalysis> {
        // Simple parsing - in production, this would be more sophisticated
        let polarity = self.extract_float_from_response(response, "polarity").unwrap_or(0.0);
        let magnitude = self.extract_float_from_response(response, "magnitude").unwrap_or(0.5);
        
        let label = if polarity > 0.3 {
            if polarity > 0.7 { SentimentLabel::VeryPositive } else { SentimentLabel::Positive }
        } else if polarity < -0.3 {
            if polarity < -0.7 { SentimentLabel::VeryNegative } else { SentimentLabel::Negative }
        } else {
            SentimentLabel::Neutral
        };

        Ok(SentimentAnalysis {
            polarity: polarity.clamp(-1.0, 1.0),
            magnitude: magnitude.clamp(0.0, 1.0),
            label,
            confidence: 0.8, // Would be parsed from response in production
        })
    }

    fn parse_formality_level(&self, response: &str) -> AIResult<FormalityLevel> {
        let response_lower = response.to_lowercase();
        
        if response_lower.contains("very formal") {
            Ok(FormalityLevel::VeryFormal)
        } else if response_lower.contains("very informal") {
            Ok(FormalityLevel::VeryInformal)
        } else if response_lower.contains("formal") {
            Ok(FormalityLevel::Formal)
        } else if response_lower.contains("informal") {
            Ok(FormalityLevel::Informal)
        } else {
            Ok(FormalityLevel::Neutral)
        }
    }

    fn parse_formality_from_response(&self, response: &str) -> AIResult<FormalityLevel> {
        self.parse_formality_level(response)
    }

    fn parse_emotional_indicators(&self, response: &str) -> AIResult<Vec<EmotionalIndicator>> {
        // Simplified parsing - production would be more sophisticated
        let mut indicators = Vec::new();
        
        let emotions = [
            ("joy", EmotionType::Joy),
            ("happiness", EmotionType::Joy),
            ("sadness", EmotionType::Sadness),
            ("sad", EmotionType::Sadness),
            ("anger", EmotionType::Anger),
            ("angry", EmotionType::Anger),
            ("fear", EmotionType::Fear),
            ("afraid", EmotionType::Fear),
            ("surprise", EmotionType::Surprise),
            ("surprised", EmotionType::Surprise),
            ("disgust", EmotionType::Disgust),
            ("trust", EmotionType::Trust),
            ("anticipation", EmotionType::Anticipation),
        ];

        for (keyword, emotion_type) in emotions {
            if response.to_lowercase().contains(keyword) {
                indicators.push(EmotionalIndicator {
                    emotion: emotion_type,
                    intensity: 0.6, // Default intensity
                    confidence: 0.7,
                });
            }
        }

        Ok(indicators)
    }

    fn parse_emotions_from_response(&self, response: &str) -> AIResult<Vec<EmotionalIndicator>> {
        self.parse_emotional_indicators(response)
    }

    fn parse_improvement_suggestions(&self, response: &str) -> AIResult<Vec<ToneImprovement>> {
        // Parse suggestions from AI response
        let lines: Vec<&str> = response.lines()
            .filter(|line| !line.trim().is_empty())
            .collect();

        let mut suggestions = Vec::new();
        
        for line in lines {
            if line.trim().starts_with('-') || line.trim().starts_with('•') || line.trim().starts_with('*') {
                let suggestion_text = line.trim_start_matches(&['-', '•', '*', ' ']);
                
                suggestions.push(ToneImprovement {
                    suggestion: suggestion_text.to_string(),
                    impact: self.determine_impact_level(suggestion_text),
                    example: None, // Could extract examples from response
                });
            }
        }

        if suggestions.is_empty() {
            suggestions.push(ToneImprovement {
                suggestion: "Consider reviewing the tone and clarity of your message.".to_string(),
                impact: ImprovementImpact::Medium,
                example: None,
            });
        }

        Ok(suggestions)
    }

    // Utility methods

    fn extract_float_from_response(&self, response: &str, key: &str) -> Option<f32> {
        // Simple regex-like extraction
        if let Some(start) = response.find(key) {
            let substring = &response[start..];
            if let Some(colon_pos) = substring.find(':') {
                let after_colon = &substring[colon_pos + 1..];
                // Extract number
                let number_str: String = after_colon.chars()
                    .skip_while(|c| !c.is_ascii_digit() && *c != '-' && *c != '.')
                    .take_while(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
                    .collect();
                number_str.parse().ok()
            } else {
                None
            }
        } else {
            None
        }
    }

    fn determine_overall_tone(
        &self,
        sentiment: &SentimentAnalysis,
        formality: &FormalityLevel,
        emotions: &[EmotionalIndicator],
    ) -> ToneStyle {
        // Logic to determine overall tone based on analysis
        match (sentiment.label.clone(), formality) {
            (SentimentLabel::Positive | SentimentLabel::VeryPositive, FormalityLevel::Formal | FormalityLevel::VeryFormal) => {
                ToneStyle::Professional
            }
            (SentimentLabel::Positive | SentimentLabel::VeryPositive, FormalityLevel::Informal | FormalityLevel::VeryInformal) => {
                ToneStyle::Friendly
            }
            (_, FormalityLevel::VeryFormal) => ToneStyle::Formal,
            (_, FormalityLevel::VeryInformal) => ToneStyle::Casual,
            _ => {
                // Check emotions for additional context
                if emotions.iter().any(|e| matches!(e.emotion, EmotionType::Joy)) {
                    ToneStyle::Friendly
                } else if emotions.iter().any(|e| matches!(e.emotion, EmotionType::Trust)) {
                    ToneStyle::Professional
                } else {
                    ToneStyle::Professional // Default
                }
            }
        }
    }

    fn extract_key_phrases(&self, response: &str) -> Vec<String> {
        // Simple key phrase extraction
        let words: Vec<&str> = response.split_whitespace()
            .filter(|word| word.len() > 4 && !word.chars().all(|c| c.is_ascii_punctuation()))
            .take(5)
            .collect();
        
        words.into_iter().map(|s| s.to_string()).collect()
    }

    fn calculate_confidence(&self, sentiment: &SentimentAnalysis, emotions: &[EmotionalIndicator]) -> f32 {
        let sentiment_confidence = sentiment.confidence;
        let emotion_confidence: f32 = emotions.iter()
            .map(|e| e.confidence)
            .sum::<f32>() / emotions.len().max(1) as f32;
        
        (sentiment_confidence + emotion_confidence) / 2.0
    }

    fn determine_impact_level(&self, suggestion: &str) -> ImprovementImpact {
        let high_impact_keywords = ["urgent", "critical", "important", "major", "significant"];
        let low_impact_keywords = ["minor", "small", "slight", "consider"];
        
        let suggestion_lower = suggestion.to_lowercase();
        
        if high_impact_keywords.iter().any(|&keyword| suggestion_lower.contains(keyword)) {
            ImprovementImpact::High
        } else if low_impact_keywords.iter().any(|&keyword| suggestion_lower.contains(keyword)) {
            ImprovementImpact::Low
        } else {
            ImprovementImpact::Medium
        }
    }

    fn calculate_tone_differences(&self, analysis1: &ToneAnalysis, analysis2: &ToneAnalysis) -> ToneDifferences {
        ToneDifferences {
            sentiment_diff: (analysis1.sentiment.polarity - analysis2.sentiment.polarity).abs(),
            formality_diff: self.formality_distance(&analysis1.formality_level, &analysis2.formality_level),
            emotion_overlap: self.calculate_emotion_overlap(&analysis1.emotional_indicators, &analysis2.emotional_indicators),
            overall_tone_match: analysis1.overall_tone == analysis2.overall_tone,
        }
    }

    fn calculate_similarity_score(&self, analysis1: &ToneAnalysis, analysis2: &ToneAnalysis) -> f32 {
        let differences = self.calculate_tone_differences(analysis1, analysis2);
        
        let sentiment_similarity = 1.0 - differences.sentiment_diff;
        let formality_similarity = 1.0 - (differences.formality_diff as f32 / 4.0); // Max distance is 4
        let emotion_similarity = differences.emotion_overlap;
        let tone_similarity = if differences.overall_tone_match { 1.0 } else { 0.0 };
        
        (sentiment_similarity + formality_similarity + emotion_similarity + tone_similarity) / 4.0
    }

    fn formality_distance(&self, level1: &FormalityLevel, level2: &FormalityLevel) -> u32 {
        let to_number = |level: &FormalityLevel| match level {
            FormalityLevel::VeryInformal => 0,
            FormalityLevel::Informal => 1,
            FormalityLevel::Neutral => 2,
            FormalityLevel::Formal => 3,
            FormalityLevel::VeryFormal => 4,
        };
        
        (to_number(level1) as i32 - to_number(level2) as i32).unsigned_abs()
    }

    fn calculate_emotion_overlap(&self, emotions1: &[EmotionalIndicator], emotions2: &[EmotionalIndicator]) -> f32 {
        if emotions1.is_empty() && emotions2.is_empty() {
            return 1.0;
        }
        
        let set1: std::collections::HashSet<_> = emotions1.iter().map(|e| &e.emotion).collect();
        let set2: std::collections::HashSet<_> = emotions2.iter().map(|e| &e.emotion).collect();
        
        let intersection = set1.intersection(&set2).count();
        let union = set1.union(&set2).count();
        
        if union == 0 {
            1.0
        } else {
            intersection as f32 / union as f32
        }
    }
}

/// Tone comparison result
#[derive(Debug, Clone)]
pub struct ToneComparison {
    pub text1_analysis: ToneAnalysis,
    pub text2_analysis: ToneAnalysis,
    pub differences: ToneDifferences,
    pub similarity_score: f32,
}

/// Differences between two tone analyses
#[derive(Debug, Clone)]
pub struct ToneDifferences {
    pub sentiment_diff: f32,
    pub formality_diff: u32,
    pub emotion_overlap: f32,
    pub overall_tone_match: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{config::AIConfig, types::*};
    
    #[test]
    fn test_formality_distance() {
        let analyzer = create_test_analyzer();
        
        assert_eq!(
            analyzer.formality_distance(&FormalityLevel::VeryFormal, &FormalityLevel::VeryInformal),
            4
        );
        
        assert_eq!(
            analyzer.formality_distance(&FormalityLevel::Formal, &FormalityLevel::Neutral),
            1
        );
        
        assert_eq!(
            analyzer.formality_distance(&FormalityLevel::Neutral, &FormalityLevel::Neutral),
            0
        );
    }

    #[test]
    fn test_cache_key_generation() {
        let analyzer = create_test_analyzer();
        let request = ToneAnalysisRequest {
            text: "Hello world".to_string(),
            context_type: ContextType::Email,
            analyze_sentiment: true,
            analyze_formality: true,
            analyze_emotion: false,
        };
        
        let key1 = analyzer.generate_cache_key(&request);
        let key2 = analyzer.generate_cache_key(&request);
        
        assert_eq!(key1, key2);
        assert!(key1.starts_with("tone:"));
    }

    fn create_test_analyzer() -> ToneAnalyzer {
        let config = AIConfig::default();
        let providers = HashMap::new();
        ToneAnalyzer::new(&config, &providers).unwrap()
    }
}