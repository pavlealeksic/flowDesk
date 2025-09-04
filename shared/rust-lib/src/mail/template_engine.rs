//! Advanced template engine with variables, conditionals, and formatting

use crate::mail::types::*;
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::collections::HashMap;
use regex::Regex;
use uuid::Uuid;

/// Template engine errors
#[derive(Debug, thiserror::Error)]
pub enum TemplateEngineError {
    #[error("Variable '{0}' is required but not provided")]
    RequiredVariableMissing(String),
    
    #[error("Invalid variable value for '{name}': {reason}")]
    InvalidVariableValue { name: String, reason: String },
    
    #[error("Conditional expression error: {0}")]
    ConditionalError(String),
    
    #[error("Template parsing error: {0}")]
    ParseError(String),
    
    #[error("Validation error: {0}")]
    ValidationError(String),
}

/// Template rendering context
#[derive(Debug, Clone, Default)]
pub struct TemplateContext {
    pub variables: HashMap<String, Value>,
    pub metadata: HashMap<String, Value>,
    pub user_data: Option<Value>,
    pub current_time: DateTime<Utc>,
    pub timezone: String,
}

/// Template rendering options
#[derive(Debug, Clone, Default)]
pub struct RenderOptions {
    pub strict_validation: bool,
    pub include_debug_info: bool,
    pub auto_escape_html: bool,
    pub preserve_whitespace: bool,
}

/// Rendered template result
#[derive(Debug, Clone)]
pub struct RenderedTemplate {
    pub subject: String,
    pub body_html: String,
    pub body_text: String,
    pub variables_used: Vec<String>,
    pub conditionals_evaluated: Vec<String>,
    pub render_time_ms: u64,
    pub warnings: Vec<String>,
}

/// Advanced template engine
pub struct TemplateEngine {
    variable_regex: Regex,
    conditional_regex: Regex,
    loop_regex: Regex,
    formatters: HashMap<String, Box<dyn Fn(&str, &[&str]) -> Result<String, TemplateEngineError>>>,
}

impl Default for TemplateEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl TemplateEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            variable_regex: Regex::new(r"\{\{([^}]+)\}\}").unwrap(),
            conditional_regex: Regex::new(r"\{\%\s*(if|elif|else|endif)\s*([^%]*)\%\}").unwrap(),
            loop_regex: Regex::new(r"\{\%\s*for\s+(\w+)\s+in\s+(\w+)\s*\%\}(.*?)\{\%\s*endfor\s*\%\}").unwrap(),
            formatters: HashMap::new(),
        };
        
        engine.register_default_formatters();
        engine
    }
    
    /// Register default formatters
    fn register_default_formatters(&mut self) {
        // Date formatters
        self.register_formatter("date", Box::new(|value: &str, args: &[&str]| {
            let format = args.get(0).unwrap_or(&"%Y-%m-%d");
            // Implementation would parse date and format
            Ok(format!("formatted_date_{}", value))
        }));
        
        // Text formatters
        self.register_formatter("upper", Box::new(|value: &str, _: &[&str]| {
            Ok(value.to_uppercase())
        }));
        
        self.register_formatter("lower", Box::new(|value: &str, _: &[&str]| {
            Ok(value.to_lowercase())
        }));
        
        self.register_formatter("title", Box::new(|value: &str, _: &[&str]| {
            Ok(value.split_whitespace()
                .map(|word| {
                    let mut chars = word.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(first) => format!("{}{}", first.to_uppercase().collect::<String>(), chars.as_str().to_lowercase()),
                    }
                })
                .collect::<Vec<_>>()
                .join(" "))
        }));
        
        // Number formatters
        self.register_formatter("currency", Box::new(|value: &str, args: &[&str]| {
            let currency = args.get(0).unwrap_or(&"USD");
            Ok(format!("{} {}", currency, value))
        }));
        
        self.register_formatter("percentage", Box::new(|value: &str, _: &[&str]| {
            Ok(format!("{}%", value))
        }));
    }
    
    /// Register a custom formatter
    pub fn register_formatter<F>(&mut self, name: &str, formatter: F)
    where
        F: Fn(&str, &[&str]) -> Result<String, TemplateEngineError> + 'static,
    {
        self.formatters.insert(name.to_string(), Box::new(formatter));
    }
    
    /// Render a template with context
    pub fn render(
        &self,
        template: &EmailTemplate,
        context: &TemplateContext,
        options: &RenderOptions,
    ) -> Result<RenderedTemplate, TemplateEngineError> {
        let start_time = std::time::Instant::now();
        
        // Validate required variables
        if options.strict_validation {
            self.validate_required_variables(template, context)?;
        }
        
        // Render subject
        let subject = self.render_text(&template.subject, context, options)?;
        
        // Render HTML body
        let body_html = self.render_text(&template.body_html, context, options)?;
        
        // Render text body
        let body_text = self.render_text(&template.body_text, context, options)?;
        
        // Collect metadata
        let variables_used = self.extract_variables(&template.subject)
            .into_iter()
            .chain(self.extract_variables(&template.body_html))
            .chain(self.extract_variables(&template.body_text))
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        
        let conditionals_evaluated = template.conditionals
            .iter()
            .map(|c| c.id.clone())
            .collect();
        
        let render_time_ms = start_time.elapsed().as_millis() as u64;
        
        Ok(RenderedTemplate {
            subject,
            body_html,
            body_text,
            variables_used,
            conditionals_evaluated,
            render_time_ms,
            warnings: Vec::new(),
        })
    }
    
    /// Render text with variable substitution and conditionals
    fn render_text(
        &self,
        text: &str,
        context: &TemplateContext,
        options: &RenderOptions,
    ) -> Result<String, TemplateEngineError> {
        let mut result = text.to_string();
        
        // Process conditionals first
        result = self.process_conditionals(&result, context)?;
        
        // Process loops
        result = self.process_loops(&result, context)?;
        
        // Process variables and formatters
        result = self.process_variables(&result, context, options)?;
        
        Ok(result)
    }
    
    /// Process conditional statements
    fn process_conditionals(
        &self,
        text: &str,
        context: &TemplateContext,
    ) -> Result<String, TemplateEngineError> {
        let mut result = text.to_string();
        
        // This is a simplified implementation
        // In a real implementation, you'd have a proper parser for conditionals
        let if_regex = Regex::new(r"\{\%\s*if\s+([^%]+)\s*\%\}(.*?)\{\%\s*endif\s*\%\}").unwrap();
        
        while let Some(captures) = if_regex.captures(&result) {
            let condition = captures.get(1).unwrap().as_str().trim();
            let content = captures.get(2).unwrap().as_str();
            let full_match = captures.get(0).unwrap().as_str();
            
            let should_include = self.evaluate_condition(condition, context)?;
            let replacement = if should_include { content } else { "" };
            
            result = result.replace(full_match, replacement);
        }
        
        Ok(result)
    }
    
    /// Process loop statements
    fn process_loops(
        &self,
        text: &str,
        context: &TemplateContext,
    ) -> Result<String, TemplateEngineError> {
        let mut result = text.to_string();
        
        while let Some(captures) = self.loop_regex.captures(&result) {
            let var_name = captures.get(1).unwrap().as_str();
            let collection_name = captures.get(2).unwrap().as_str();
            let loop_content = captures.get(3).unwrap().as_str();
            let full_match = captures.get(0).unwrap().as_str();
            
            let collection = context.variables.get(collection_name)
                .and_then(|v| v.as_array())
                .ok_or_else(|| TemplateEngineError::ParseError(
                    format!("Collection '{}' not found or not an array", collection_name)
                ))?;
            
            let mut loop_result = String::new();
            for item in collection {
                let mut loop_context = context.clone();
                loop_context.variables.insert(var_name.to_string(), item.clone());
                
                let rendered_item = self.process_variables(loop_content, &loop_context, &RenderOptions::default())?;
                loop_result.push_str(&rendered_item);
            }
            
            result = result.replace(full_match, &loop_result);
        }
        
        Ok(result)
    }
    
    /// Process variables and formatters
    fn process_variables(
        &self,
        text: &str,
        context: &TemplateContext,
        options: &RenderOptions,
    ) -> Result<String, TemplateEngineError> {
        let mut result = text.to_string();
        
        for captures in self.variable_regex.captures_iter(text) {
            let full_match = captures.get(0).unwrap().as_str();
            let variable_expr = captures.get(1).unwrap().as_str().trim();
            
            let replacement = self.process_variable_expression(variable_expr, context, options)?;
            result = result.replace(full_match, &replacement);
        }
        
        Ok(result)
    }
    
    /// Process a single variable expression with formatters
    fn process_variable_expression(
        &self,
        expr: &str,
        context: &TemplateContext,
        options: &RenderOptions,
    ) -> Result<String, TemplateEngineError> {
        let parts: Vec<&str> = expr.split('|').collect();
        let variable_name = parts[0].trim();
        
        // Get variable value
        let mut value = self.get_variable_value(variable_name, context)?;
        
        // Apply formatters
        for formatter_expr in parts.iter().skip(1) {
            let formatter_parts: Vec<&str> = formatter_expr.trim().split(':').collect();
            let formatter_name = formatter_parts[0];
            let formatter_args: Vec<&str> = formatter_parts.iter().skip(1).cloned().collect();
            
            if let Some(formatter) = self.formatters.get(formatter_name) {
                value = formatter(&value, &formatter_args)?;
            } else {
                return Err(TemplateEngineError::ParseError(
                    format!("Unknown formatter: {}", formatter_name)
                ));
            }
        }
        
        // HTML escape if needed
        if options.auto_escape_html && !value.contains('<') {
            value = html_escape(&value);
        }
        
        Ok(value)
    }
    
    /// Get variable value from context
    fn get_variable_value(
        &self,
        name: &str,
        context: &TemplateContext,
    ) -> Result<String, TemplateEngineError> {
        // Handle dot notation for nested objects
        let parts: Vec<&str> = name.split('.').collect();
        let mut current_value = context.variables.get(parts[0])
            .ok_or_else(|| TemplateEngineError::RequiredVariableMissing(name.to_string()))?;
        
        for part in parts.iter().skip(1) {
            current_value = current_value.get(part)
                .ok_or_else(|| TemplateEngineError::ParseError(
                    format!("Property '{}' not found in variable '{}'", part, name)
                ))?;
        }
        
        Ok(match current_value {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => b.to_string(),
            Value::Null => String::new(),
            _ => current_value.to_string(),
        })
    }
    
    /// Evaluate a conditional expression
    fn evaluate_condition(
        &self,
        condition: &str,
        context: &TemplateContext,
    ) -> Result<bool, TemplateEngineError> {
        // Simple condition evaluation - in practice you'd want a proper expression parser
        let condition = condition.trim();
        
        // Handle simple variable existence checks
        if let Some(var_name) = condition.strip_prefix('!') {
            let var_name = var_name.trim();
            return Ok(!context.variables.contains_key(var_name) || 
                     context.variables.get(var_name).map_or(false, |v| v.is_null()));
        }
        
        // Handle equality checks
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").collect();
            if parts.len() == 2 {
                let left = self.get_variable_value(parts[0].trim(), context).unwrap_or_default();
                let right = parts[1].trim().trim_matches('"').trim_matches('\'');
                return Ok(left == right);
            }
        }
        
        // Handle simple variable checks
        if context.variables.contains_key(condition) {
            let value = &context.variables[condition];
            return Ok(match value {
                Value::Bool(b) => *b,
                Value::Null => false,
                Value::String(s) => !s.is_empty(),
                Value::Array(a) => !a.is_empty(),
                Value::Object(o) => !o.is_empty(),
                _ => true,
            });
        }
        
        Ok(false)
    }
    
    /// Extract variable names from text
    fn extract_variables(&self, text: &str) -> Vec<String> {
        self.variable_regex
            .captures_iter(text)
            .map(|cap| {
                let expr = cap.get(1).unwrap().as_str();
                // Extract just the variable name (before any formatters)
                expr.split('|').next().unwrap().trim().to_string()
            })
            .collect()
    }
    
    /// Validate required variables are present
    fn validate_required_variables(
        &self,
        template: &EmailTemplate,
        context: &TemplateContext,
    ) -> Result<(), TemplateEngineError> {
        for variable in &template.variables {
            if variable.is_required && !context.variables.contains_key(&variable.key) {
                return Err(TemplateEngineError::RequiredVariableMissing(variable.key.clone()));
            }
            
            // Validate variable value if present
            if let Some(value) = context.variables.get(&variable.key) {
                self.validate_variable_value(variable, value)?;
            }
        }
        
        Ok(())
    }
    
    /// Validate a variable value against its rules
    fn validate_variable_value(
        &self,
        variable: &TemplateVariable,
        value: &Value,
    ) -> Result<(), TemplateEngineError> {
        let value_str = match value {
            Value::String(s) => s.as_str(),
            _ => return Ok(()), // Skip validation for non-string values for now
        };
        
        // Check length constraints
        if let Some(min_len) = variable.min_length {
            if value_str.len() < min_len as usize {
                return Err(TemplateEngineError::InvalidVariableValue {
                    name: variable.key.clone(),
                    reason: format!("Minimum length is {}", min_len),
                });
            }
        }
        
        if let Some(max_len) = variable.max_length {
            if value_str.len() > max_len as usize {
                return Err(TemplateEngineError::InvalidVariableValue {
                    name: variable.key.clone(),
                    reason: format!("Maximum length is {}", max_len),
                });
            }
        }
        
        // Check format pattern
        if let Some(pattern) = &variable.format_pattern {
            let regex = Regex::new(pattern)
                .map_err(|e| TemplateEngineError::ValidationError(format!("Invalid regex pattern: {}", e)))?;
            
            if !regex.is_match(value_str) {
                return Err(TemplateEngineError::InvalidVariableValue {
                    name: variable.key.clone(),
                    reason: "Does not match required format".to_string(),
                });
            }
        }
        
        // Validate by type
        match variable.variable_type {
            VariableType::Email => {
                if !value_str.contains('@') {
                    return Err(TemplateEngineError::InvalidVariableValue {
                        name: variable.key.clone(),
                        reason: "Invalid email format".to_string(),
                    });
                }
            },
            VariableType::Url => {
                if !value_str.starts_with("http://") && !value_str.starts_with("https://") {
                    return Err(TemplateEngineError::InvalidVariableValue {
                        name: variable.key.clone(),
                        reason: "Invalid URL format".to_string(),
                    });
                }
            },
            VariableType::Number => {
                if value_str.parse::<f64>().is_err() {
                    return Err(TemplateEngineError::InvalidVariableValue {
                        name: variable.key.clone(),
                        reason: "Invalid number format".to_string(),
                    });
                }
            },
            _ => {}, // Other types don't need special validation for now
        }
        
        Ok(())
    }
    
    /// Preview template with sample data
    pub fn preview_template(
        &self,
        template: &EmailTemplate,
        sample_data: Option<&HashMap<String, Value>>,
    ) -> Result<RenderedTemplate, TemplateEngineError> {
        let mut context = TemplateContext {
            current_time: Utc::now(),
            timezone: "UTC".to_string(),
            ..Default::default()
        };
        
        // Generate sample data for variables if not provided
        if let Some(data) = sample_data {
            context.variables = data.clone();
        } else {
            for variable in &template.variables {
                let sample_value = self.generate_sample_value(variable);
                context.variables.insert(variable.key.clone(), sample_value);
            }
        }
        
        let options = RenderOptions {
            strict_validation: false,
            include_debug_info: true,
            auto_escape_html: false,
            preserve_whitespace: true,
        };
        
        self.render(template, &context, &options)
    }
    
    /// Generate sample value for a variable
    fn generate_sample_value(&self, variable: &TemplateVariable) -> Value {
        match variable.variable_type {
            VariableType::Text => Value::String(format!("Sample {}", variable.label)),
            VariableType::Email => Value::String("user@example.com".to_string()),
            VariableType::Date => Value::String("2024-12-01".to_string()),
            VariableType::DateTime => Value::String("2024-12-01 12:00:00".to_string()),
            VariableType::Time => Value::String("12:00:00".to_string()),
            VariableType::Number => Value::Number(serde_json::Number::from(42)),
            VariableType::Boolean => Value::Bool(true),
            VariableType::Currency => Value::String("$100.00".to_string()),
            VariableType::Percentage => Value::String("85%".to_string()),
            VariableType::Phone => Value::String("+1 (555) 123-4567".to_string()),
            VariableType::Address => Value::String("123 Main St, Anytown, ST 12345".to_string()),
            VariableType::Url => Value::String("https://example.com".to_string()),
            VariableType::Select | VariableType::MultiSelect => {
                if let Some(options) = &variable.options {
                    if !options.is_empty() {
                        Value::String(options[0].clone())
                    } else {
                        Value::String("Option 1".to_string())
                    }
                } else {
                    Value::String("Option 1".to_string())
                }
            },
            _ => Value::String(format!("Sample {}", variable.label)),
        }
    }
}

/// HTML escape function
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_variable_substitution() {
        let engine = TemplateEngine::new();
        let mut context = TemplateContext::default();
        context.variables.insert("name".to_string(), json!("John"));
        context.variables.insert("company".to_string(), json!("Acme Corp"));
        
        let result = engine.render_text(
            "Hello {{name}}, welcome to {{company}}!",
            &context,
            &RenderOptions::default()
        ).unwrap();
        
        assert_eq!(result, "Hello John, welcome to Acme Corp!");
    }
    
    #[test]
    fn test_formatters() {
        let engine = TemplateEngine::new();
        let mut context = TemplateContext::default();
        context.variables.insert("name".to_string(), json!("john doe"));
        
        let result = engine.render_text(
            "Hello {{name | title}}!",
            &context,
            &RenderOptions::default()
        ).unwrap();
        
        assert_eq!(result, "Hello John Doe!");
    }
    
    #[test]
    fn test_conditionals() {
        let engine = TemplateEngine::new();
        let mut context = TemplateContext::default();
        context.variables.insert("show_greeting".to_string(), json!(true));
        context.variables.insert("name".to_string(), json!("Alice"));
        
        let result = engine.render_text(
            "{% if show_greeting %}Hello {{name}}!{% endif %}",
            &context,
            &RenderOptions::default()
        ).unwrap();
        
        assert_eq!(result, "Hello Alice!");
    }
}