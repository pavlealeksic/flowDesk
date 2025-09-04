/*!
 * Calendar Provider Auto-Detection
 * 
 * Automatically detects calendar provider types and configurations
 * based on email domains and server URLs.
 */

use crate::calendar::{
    CalendarProvider, CalDavConfig, GoogleCalendarConfig, 
    OutlookCalendarConfig, CalendarResult, CalendarError
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest::Client;
use url::Url;

/// Provider detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionResult {
    pub provider: CalendarProvider,
    pub server_url: Option<String>,
    pub auto_config: Option<AutoDetectedConfig>,
    pub confidence: f32, // 0.0 to 1.0
}

/// Auto-detected configuration for a provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutoDetectedConfig {
    CalDAV {
        server_url: String,
        principal_url: Option<String>,
        calendar_home_set: Option<String>,
        supports_calendar_query: bool,
        supports_calendar_multiget: bool,
    },
    Google {
        client_id: Option<String>,
        scopes: Vec<String>,
    },
    Outlook {
        tenant_id: Option<String>,
        scopes: Vec<String>,
    },
}

/// Calendar provider auto-detection engine
pub struct ProviderDetector {
    client: Client,
    domain_mappings: HashMap<String, ProviderInfo>,
}

#[derive(Debug, Clone)]
struct ProviderInfo {
    provider: CalendarProvider,
    caldav_url_template: Option<String>,
    confidence: f32,
}

impl ProviderDetector {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        let mut domain_mappings = HashMap::new();
        
        // Popular email providers with known CalDAV/CardDAV endpoints
        domain_mappings.insert("gmail.com".to_string(), ProviderInfo {
            provider: CalendarProvider::Google,
            caldav_url_template: None, // Google uses API, not CalDAV
            confidence: 0.95,
        });
        
        domain_mappings.insert("googlemail.com".to_string(), ProviderInfo {
            provider: CalendarProvider::Google,
            caldav_url_template: None,
            confidence: 0.95,
        });
        
        domain_mappings.insert("outlook.com".to_string(), ProviderInfo {
            provider: CalendarProvider::Outlook,
            caldav_url_template: None, // Outlook uses Graph API
            confidence: 0.95,
        });
        
        domain_mappings.insert("hotmail.com".to_string(), ProviderInfo {
            provider: CalendarProvider::Outlook,
            caldav_url_template: None,
            confidence: 0.90,
        });
        
        domain_mappings.insert("live.com".to_string(), ProviderInfo {
            provider: CalendarProvider::Outlook,
            caldav_url_template: None,
            confidence: 0.90,
        });
        
        domain_mappings.insert("icloud.com".to_string(), ProviderInfo {
            provider: CalendarProvider::ICloud,
            caldav_url_template: Some("https://caldav.icloud.com".to_string()),
            confidence: 0.95,
        });
        
        domain_mappings.insert("me.com".to_string(), ProviderInfo {
            provider: CalendarProvider::ICloud,
            caldav_url_template: Some("https://caldav.icloud.com".to_string()),
            confidence: 0.95,
        });
        
        domain_mappings.insert("mac.com".to_string(), ProviderInfo {
            provider: CalendarProvider::ICloud,
            caldav_url_template: Some("https://caldav.icloud.com".to_string()),
            confidence: 0.90,
        });
        
        domain_mappings.insert("fastmail.com".to_string(), ProviderInfo {
            provider: CalendarProvider::Fastmail,
            caldav_url_template: Some("https://caldav.fastmail.com".to_string()),
            confidence: 0.95,
        });
        
        domain_mappings.insert("fastmail.fm".to_string(), ProviderInfo {
            provider: CalendarProvider::Fastmail,
            caldav_url_template: Some("https://caldav.fastmail.com".to_string()),
            confidence: 0.95,
        });

        Self {
            client,
            domain_mappings,
        }
    }

    /// Detect calendar provider from email address
    pub async fn detect_from_email(&self, email: &str) -> CalendarResult<Vec<DetectionResult>> {
        let domain = email.split('@').nth(1)
            .ok_or_else(|| CalendarError::ValidationError {
                message: "Invalid email format".to_string(),
                provider: None,
                account_id: None,
                field: Some("email".to_string()),
                value: Some(email.to_string()),
                constraint: Some("valid_email".to_string()),
            })?;

        let mut results = Vec::new();

        // Check known domain mappings
        if let Some(provider_info) = self.domain_mappings.get(domain) {
            let auto_config = match &provider_info.provider {
                CalendarProvider::Google => Some(AutoDetectedConfig::Google {
                    client_id: None,
                    scopes: vec![
                        "https://www.googleapis.com/auth/calendar".to_string(),
                        "https://www.googleapis.com/auth/calendar.events".to_string(),
                    ],
                }),
                CalendarProvider::Outlook => Some(AutoDetectedConfig::Outlook {
                    tenant_id: None,
                    scopes: vec![
                        "https://graph.microsoft.com/calendars.readwrite".to_string(),
                        "https://graph.microsoft.com/calendars.readwrite.shared".to_string(),
                    ],
                }),
                CalendarProvider::ICloud | CalendarProvider::Fastmail | CalendarProvider::CalDAV => {
                    provider_info.caldav_url_template.as_ref().map(|url| AutoDetectedConfig::CalDAV {
                        server_url: url.clone(),
                        principal_url: None,
                        calendar_home_set: None,
                        supports_calendar_query: true,
                        supports_calendar_multiget: true,
                    })
                },
                _ => None,
            };

            results.push(DetectionResult {
                provider: provider_info.provider.clone(),
                server_url: provider_info.caldav_url_template.clone(),
                auto_config,
                confidence: provider_info.confidence,
            });
        }

        // Try to detect CalDAV through common patterns
        let caldav_candidates = self.generate_caldav_urls(domain);
        for url in caldav_candidates {
            if let Ok(detection) = self.probe_caldav_server(&url).await {
                results.push(detection);
            }
        }

        // Sort by confidence
        results.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));

        Ok(results)
    }

    /// Detect calendar provider from server URL
    pub async fn detect_from_url(&self, server_url: &str) -> CalendarResult<DetectionResult> {
        // Try to parse the URL
        let url = Url::parse(server_url)
            .map_err(|e| CalendarError::ValidationError {
                message: format!("Invalid server URL: {}", e),
                provider: None,
                account_id: None,
                field: Some("server_url".to_string()),
                value: Some(server_url.to_string()),
                constraint: Some("valid_url".to_string()),
            })?;

        // Check if it's a known service
        if let Some(host) = url.host_str() {
            if host.contains("google") || host.contains("googleapis") {
                return Ok(DetectionResult {
                    provider: CalendarProvider::Google,
                    server_url: Some(server_url.to_string()),
                    auto_config: Some(AutoDetectedConfig::Google {
                        client_id: None,
                        scopes: vec![
                            "https://www.googleapis.com/auth/calendar".to_string(),
                            "https://www.googleapis.com/auth/calendar.events".to_string(),
                        ],
                    }),
                    confidence: 0.90,
                });
            }

            if host.contains("outlook") || host.contains("office365") || host.contains("microsoft") {
                return Ok(DetectionResult {
                    provider: CalendarProvider::Outlook,
                    server_url: Some(server_url.to_string()),
                    auto_config: Some(AutoDetectedConfig::Outlook {
                        tenant_id: None,
                        scopes: vec![
                            "https://graph.microsoft.com/calendars.readwrite".to_string(),
                            "https://graph.microsoft.com/calendars.readwrite.shared".to_string(),
                        ],
                    }),
                    confidence: 0.90,
                });
            }

            if host.contains("icloud") {
                return Ok(DetectionResult {
                    provider: CalendarProvider::ICloud,
                    server_url: Some(server_url.to_string()),
                    auto_config: Some(AutoDetectedConfig::CalDAV {
                        server_url: server_url.to_string(),
                        principal_url: None,
                        calendar_home_set: None,
                        supports_calendar_query: true,
                        supports_calendar_multiget: true,
                    }),
                    confidence: 0.90,
                });
            }

            if host.contains("fastmail") {
                return Ok(DetectionResult {
                    provider: CalendarProvider::Fastmail,
                    server_url: Some(server_url.to_string()),
                    auto_config: Some(AutoDetectedConfig::CalDAV {
                        server_url: server_url.to_string(),
                        principal_url: None,
                        calendar_home_set: None,
                        supports_calendar_query: true,
                        supports_calendar_multiget: true,
                    }),
                    confidence: 0.90,
                });
            }
        }

        // Try CalDAV probing
        self.probe_caldav_server(server_url).await
    }

    /// Generate possible CalDAV URLs for a domain
    fn generate_caldav_urls(&self, domain: &str) -> Vec<String> {
        vec![
            format!("https://caldav.{}", domain),
            format!("https://{}/caldav", domain),
            format!("https://{}/remote.php/dav", domain), // Nextcloud/ownCloud
            format!("https://{}/dav", domain),
            format!("https://{}/calendar/dav", domain),
            format!("https://calendar.{}", domain),
            format!("https://cal.{}", domain),
        ]
    }

    /// Probe a CalDAV server to check if it supports calendar operations
    async fn probe_caldav_server(&self, server_url: &str) -> CalendarResult<DetectionResult> {
        // Try OPTIONS request to check DAV capabilities
        let response = self.client
            .request(reqwest::Method::OPTIONS, server_url)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to probe CalDAV server: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: "detection".to_string(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;

        let mut confidence = 0.0;
        let mut supports_calendar_query = false;
        let mut supports_calendar_multiget = false;

        // Check DAV header
        if let Some(dav_header) = response.headers().get("DAV") {
            if let Ok(dav_value) = dav_header.to_str() {
                if dav_value.contains("1") {
                    confidence += 0.3;
                }
                if dav_value.contains("calendar-access") {
                    confidence += 0.4;
                    supports_calendar_query = true;
                    supports_calendar_multiget = true;
                }
            }
        }

        // Check Allow header
        if let Some(allow_header) = response.headers().get("Allow") {
            if let Ok(allow_value) = allow_header.to_str() {
                let allow_methods: Vec<&str> = allow_value.split(',').map(|s| s.trim()).collect();
                if allow_methods.contains(&"PROPFIND") {
                    confidence += 0.1;
                }
                if allow_methods.contains(&"REPORT") {
                    confidence += 0.2;
                    supports_calendar_query = true;
                }
            }
        }

        if confidence > 0.2 {
            Ok(DetectionResult {
                provider: CalendarProvider::CalDAV,
                server_url: Some(server_url.to_string()),
                auto_config: Some(AutoDetectedConfig::CalDAV {
                    server_url: server_url.to_string(),
                    principal_url: None,
                    calendar_home_set: None,
                    supports_calendar_query,
                    supports_calendar_multiget,
                }),
                confidence,
            })
        } else {
            Err(CalendarError::NotFoundError {
                resource_type: "caldav_server".to_string(),
                resource_id: server_url.to_string(),
                provider: CalendarProvider::CalDAV,
                account_id: "detection".to_string(),
            })
        }
    }

    /// Get recommended configuration for a detected provider
    pub fn get_recommended_config(&self, detection: &DetectionResult, email: &str, password: Option<&str>) -> CalendarResult<serde_json::Value> {
        match &detection.provider {
            CalendarProvider::Google => {
                Ok(serde_json::json!({
                    "provider": "Google",
                    "email": email,
                    "oauth_required": true,
                    "scopes": [
                        "https://www.googleapis.com/auth/calendar",
                        "https://www.googleapis.com/auth/calendar.events"
                    ],
                    "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
                    "token_url": "https://oauth2.googleapis.com/token"
                }))
            },
            CalendarProvider::Outlook => {
                Ok(serde_json::json!({
                    "provider": "Outlook",
                    "email": email,
                    "oauth_required": true,
                    "scopes": [
                        "https://graph.microsoft.com/calendars.readwrite",
                        "https://graph.microsoft.com/calendars.readwrite.shared"
                    ],
                    "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                    "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token"
                }))
            },
            CalendarProvider::CalDAV | CalendarProvider::ICloud | CalendarProvider::Fastmail => {
                Ok(serde_json::json!({
                    "provider": detection.provider,
                    "email": email,
                    "server_url": detection.server_url,
                    "username": email,
                    "password": password.unwrap_or(""),
                    "oauth_required": false,
                    "auth_type": "basic"
                }))
            },
            _ => {
                Err(CalendarError::ValidationError {
                    message: format!("Unsupported provider: {:?}", detection.provider),
                    provider: Some(detection.provider.clone()),
                    account_id: None,
                    field: Some("provider".to_string()),
                    value: None,
                    constraint: Some("supported_provider".to_string()),
                })
            }
        }
    }
}

impl Default for ProviderDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_detect_gmail() {
        let detector = ProviderDetector::new();
        let results = detector.detect_from_email("user@gmail.com").await.unwrap();
        
        assert!(!results.is_empty());
        assert_eq!(results[0].provider, CalendarProvider::Google);
        assert!(results[0].confidence > 0.9);
    }

    #[tokio::test]
    async fn test_detect_icloud() {
        let detector = ProviderDetector::new();
        let results = detector.detect_from_email("user@icloud.com").await.unwrap();
        
        assert!(!results.is_empty());
        assert_eq!(results[0].provider, CalendarProvider::ICloud);
        assert!(results[0].confidence > 0.9);
    }

    #[test]
    fn test_generate_caldav_urls() {
        let detector = ProviderDetector::new();
        let urls = detector.generate_caldav_urls("example.com");
        
        assert!(urls.contains(&"https://caldav.example.com".to_string()));
        assert!(urls.contains(&"https://example.com/caldav".to_string()));
        assert!(urls.len() > 5);
    }
}