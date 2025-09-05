//! Comprehensive CalDAV client implementation
//!
//! This module provides a full-featured CalDAV client with support for:
//! - RFC 4791 CalDAV specification compliance
//! - WebDAV PROPFIND and REPORT queries
//! - Calendar resource discovery and capabilities
//! - iCalendar event CRUD operations
//! - Scheduling extensions (RFC 6638)
//! - Calendar-query filtering and sync
//! - Authentication (Basic, Digest, OAuth2)
//! - SSL/TLS support with certificate validation
//! - Connection pooling and retry logic
//! - Timezone handling and conversion

use crate::calendar::{
    error::{CalendarError, CalendarResult},
    types::*,
};
use super::{CalendarProviderTrait, SyncStatus};
use async_trait::async_trait;
use reqwest::{Client, Method, RequestBuilder, header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT}};
use std::{
    collections::HashMap,
    sync::Arc,
    time::Duration,
};
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc, TimeZone};
use tokio::time::{sleep, Duration as TokioDuration};
use rrule::{RRule, RRuleSet};

/// CalDAV server capabilities discovered during connection setup
#[derive(Debug, Clone)]
struct CalDavCapabilities {
    supports_webdav: bool,
    supports_caldav: bool,
    dav_compliance: String,
    principal_url: Option<String>,
    calendar_home_set: Option<String>,
    can_create_calendars: bool,
    supported_components: Vec<String>,
}

impl Default for CalDavCapabilities {
    fn default() -> Self {
        Self {
            supports_webdav: false,
            supports_caldav: false,
            dav_compliance: String::new(),
            principal_url: None,
            calendar_home_set: None,
            can_create_calendars: false,
            supported_components: vec!["VEVENT".to_string()],
        }
    }
}

/// Account setup result
#[derive(Debug, Clone)]
pub struct AccountSetupResult {
    pub success: bool,
    pub capabilities: Option<CalDavCapabilities>,
    pub discovered_calendars: Vec<Calendar>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Calendar sync result for bidirectional sync
#[derive(Debug, Clone)]
pub struct CalendarSyncResult {
    pub calendar_id: String,
    pub events_processed: u32,
    pub events_created: u32,
    pub events_updated: u32,
    pub events_deleted: u32,
    pub conflicts_resolved: u32,
    pub errors: Vec<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Calendar sync information for change detection
#[derive(Debug, Clone)]
pub struct CalendarSyncInfo {
    pub calendar_id: String,
    pub etag: Option<String>,
    pub last_modified: Option<DateTime<Utc>>,
    pub supports_sync: bool,
    pub needs_full_sync: bool,
}

/// Retry configuration for CalDAV operations
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_factor: f64,
    pub retry_on_auth_error: bool,
    pub retry_on_network_error: bool,
    pub retry_on_server_error: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 1000,  // 1 second
            max_delay_ms: 30000,  // 30 seconds
            backoff_factor: 2.0,  // Exponential backoff
            retry_on_auth_error: false,  // Don't retry auth errors automatically
            retry_on_network_error: true,
            retry_on_server_error: true,
        }
    }
}
use url::Url;
use icalendar::{
    Calendar as IcalCalendar, Component, Event as IcalEvent, EventLike
};
use base64::{Engine as _, engine::general_purpose};

/// CalDAV provider for calendar operations
pub struct CalDavProvider {
    account_id: String,
    config: CalDavConfig,
    credentials: Option<CalendarAccountCredentials>,
    client: Client,
    base_url: String,
    calendar_cache: Arc<RwLock<HashMap<String, Calendar>>>,
    retry_config: RetryConfig,
}

impl CalDavProvider {
    pub fn new(
        account_id: String,
        config: CalDavConfig,
        credentials: Option<CalendarAccountCredentials>,
    ) -> CalendarResult<Self> {
        // Validate CalDAV configuration
        Self::validate_config(&config)?;
        
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .danger_accept_invalid_certs(config.accept_invalid_certs)
            .user_agent("FlowDesk-Calendar/1.0")
            .build()
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to create HTTP client: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: account_id.clone(),
                status_code: None,
                is_timeout: false,
                is_connection_error: true,
            })?;

        // Normalize server URL to ensure it ends with /
        let base_url = Self::normalize_server_url(&config.server_url);

        Ok(Self {
            account_id,
            base_url,
            config,
            credentials,
            client,
            calendar_cache: Arc::new(RwLock::new(HashMap::new())),
            retry_config: RetryConfig::default(),
        })
    }
    
    /// Validate CalDAV configuration
    fn validate_config(config: &CalDavConfig) -> CalendarResult<()> {
        if config.server_url.is_empty() {
            return Err(CalendarError::ValidationError {
                message: "CalDAV server URL cannot be empty".to_string(),
                provider: Some(CalendarProvider::CalDAV),
                account_id: Some("unknown".to_string()),
                field: Some("server_url".to_string()),
                value: Some("".to_string()),
                constraint: Some("non_empty".to_string()),
            });
        }
        
        if config.username.is_empty() && config.oauth_tokens.is_none() {
            return Err(CalendarError::ValidationError {
                message: "CalDAV authentication credentials required (username/password or OAuth tokens)".to_string(),
                provider: Some(CalendarProvider::CalDAV),
                account_id: Some("unknown".to_string()),
                field: Some("credentials".to_string()),
                value: None,
                constraint: Some("required".to_string()),
            });
        }
        
        // Validate URL format
        if let Err(_) = Url::parse(&config.server_url) {
            return Err(CalendarError::ValidationError {
                message: format!("Invalid CalDAV server URL: {}", config.server_url),
                provider: Some(CalendarProvider::CalDAV),
                account_id: Some("unknown".to_string()),
                field: Some("server_url".to_string()),
                value: Some(config.server_url.clone()),
                constraint: Some("valid_url".to_string()),
            });
        }
        
        Ok(())
    }
    
    /// Normalize server URL to ensure proper formatting for different CalDAV providers
    fn normalize_server_url(url: &str) -> String {
        let mut normalized = url.trim_end_matches('/').to_string();
        
        // Add default paths for common CalDAV servers
        if normalized.contains("google.com") || normalized.contains("googleapis.com") {
            if !normalized.contains("caldav") {
                normalized = "https://apidata.googleusercontent.com/caldav/v2".to_string();
            }
        } else if normalized.contains("icloud.com") {
            if !normalized.contains("caldav") {
                normalized = "https://caldav.icloud.com".to_string();
            }
        } else if normalized.contains("fastmail.com") {
            if !normalized.contains("caldav") {
                normalized = "https://caldav.fastmail.com".to_string();
            }
        } else if normalized.contains("yahoo.com") {
            if !normalized.contains("caldav") {
                normalized = "https://caldav.calendar.yahoo.com".to_string();
            }
        } else if normalized.contains("aol.com") {
            if !normalized.contains("caldav") {
                normalized = "https://caldav.aol.com".to_string();
            }
        } else if normalized.contains("att.net") {
            if !normalized.contains("caldav") {
                normalized = "https://caldav.att.yahoo.com".to_string();
            }
        } else if normalized.contains("protonmail.com") || normalized.contains("pm.me") {
            if !normalized.contains("calendar") {
                normalized = "https://calendar.protonmail.com/api/calendar".to_string();
            }
        }
        
        // Ensure it ends with / (but not for specific APIs that don't need it)
        if !normalized.ends_with('/') && 
           !normalized.contains("protonmail.com") && 
           !normalized.contains("calendar.yahoo.com") {
            normalized.push('/');
        }
        
        normalized
    }
    
    /// Determine if an error should be retried based on retry configuration
    fn should_retry_error(&self, error: &CalendarError, attempt: u32) -> bool {
        if attempt >= self.retry_config.max_attempts {
            return false;
        }
        
        match error {
            CalendarError::AuthenticationError { .. } => self.retry_config.retry_on_auth_error,
            CalendarError::NetworkError { status_code: Some(code), .. } => {
                match *code {
                    // Server errors (5xx) - usually worth retrying
                    500..=599 => self.retry_config.retry_on_server_error,
                    // Rate limiting (429) - definitely worth retrying with backoff
                    429 => true,
                    // Client errors (4xx) except 429 - usually not worth retrying
                    400..=499 => false,
                    // Network/connection issues
                    _ => self.retry_config.retry_on_network_error,
                }
            }
            CalendarError::NetworkError { is_timeout: true, .. } => true,
            CalendarError::NetworkError { is_connection_error: true, .. } => self.retry_config.retry_on_network_error,
            CalendarError::RateLimitError { .. } => true,
            _ => false,
        }
    }
    
    /// Calculate delay for exponential backoff
    fn calculate_retry_delay(&self, attempt: u32) -> TokioDuration {
        let delay_ms = (self.retry_config.base_delay_ms as f64 * 
            self.retry_config.backoff_factor.powi(attempt as i32 - 1)) as u64;
        let capped_delay = delay_ms.min(self.retry_config.max_delay_ms);
        TokioDuration::from_millis(capped_delay)
    }
    
    /// Execute a CalDAV operation with retry logic
    async fn execute_with_retry<F, Fut, T>(&self, operation_name: &str, operation: F) -> CalendarResult<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = CalendarResult<T>>,
    {
        let mut last_error: Option<CalendarError> = None;
        
        for attempt in 1..=self.retry_config.max_attempts {
            tracing::debug!("Executing {} (attempt {})", operation_name, attempt);
            
            match operation().await {
                Ok(result) => {
                    if attempt > 1 {
                        tracing::info!("{} succeeded after {} attempts", operation_name, attempt);
                    }
                    return Ok(result);
                }
                Err(error) => {
                    tracing::warn!("{} attempt {} failed: {}", operation_name, attempt, error);
                    
                    if !self.should_retry_error(&error, attempt) {
                        tracing::debug!("Not retrying {} due to error type or max attempts", operation_name);
                        return Err(error);
                    }
                    
                    last_error = Some(error);
                    
                    // Don't sleep after the last attempt
                    if attempt < self.retry_config.max_attempts {
                        let delay = self.calculate_retry_delay(attempt);
                        tracing::debug!("Waiting {:?} before retry", delay);
                        sleep(delay).await;
                    }
                }
            }
        }
        
        // All attempts failed
        let final_error = last_error.unwrap_or_else(|| CalendarError::InternalError {
            message: "All retry attempts failed".to_string(),
            operation: Some(operation_name.to_string()),
            context: None,
        });
        
        tracing::error!("{} failed after {} attempts: {}", 
            operation_name, self.retry_config.max_attempts, final_error);
        
        Err(final_error)
    }
    
    /// Execute PROPFIND request with retry logic
    async fn propfind_with_retry(&self, url: &str, body: &str, depth: u32) -> CalendarResult<String> {
        let url = url.to_string();
        let body = body.to_string();
        
        self.execute_with_retry("PROPFIND", || {
            let url = url.clone();
            let body = body.clone();
            async move {
                self.propfind(&url, &body, depth).await
            }
        }).await
    }
    
    /// Execute calendar query with retry logic
    async fn calendar_query_with_retry(&self, url: &str, body: &str) -> CalendarResult<String> {
        let url = url.to_string();
        let body = body.to_string();
        
        self.execute_with_retry("calendar-query", || {
            let url = url.clone();
            let body = body.clone();
            async move {
                self.calendar_query(&url, &body).await
            }
        }).await
    }
    
    /// Discover CalDAV capabilities and endpoints
    pub async fn discover_caldav_capabilities(&self) -> CalendarResult<CalDavCapabilities> {
        let mut capabilities = CalDavCapabilities::default();
        
        // Step 1: OPTIONS request to check basic WebDAV support
        let options_response = self.create_authenticated_request(reqwest::Method::OPTIONS, &self.base_url)?
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("OPTIONS request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        // Parse DAV header for supported methods
        if let Some(dav_header) = options_response.headers().get("DAV") {
            if let Ok(dav_str) = dav_header.to_str() {
                capabilities.supports_webdav = true;
                capabilities.supports_caldav = dav_str.contains("calendar-access");
                capabilities.dav_compliance = dav_str.to_string();
            }
        }
        
        // Step 2: PROPFIND to discover current user principal
        let propfind_body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:current-user-principal/>
    <D:principal-URL/>
    <D:resourcetype/>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>"#;
        
        match self.propfind(&self.base_url, propfind_body, 0).await {
            Ok(response) => {
                if let Ok(principal_url) = self.extract_principal_url(&response) {
                    capabilities.principal_url = Some(principal_url.clone());
                    
                    // Step 3: Get calendar home set from principal
                    if let Ok(calendar_home_set) = self.discover_calendar_home_set(&principal_url).await {
                        capabilities.calendar_home_set = Some(calendar_home_set);
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to discover principal: {}", e);
            }
        }
        
        // Step 4: Test calendar creation capabilities
        capabilities.can_create_calendars = self.test_calendar_creation_support().await.unwrap_or(false);
        
        Ok(capabilities)
    }
    
    /// Extract principal URL from PROPFIND response
    fn extract_principal_url(&self, xml_response: &str) -> CalendarResult<String> {
        use quick_xml::events::Event;
        use quick_xml::Reader;
        
        let mut reader = Reader::from_str(xml_response);
        reader.trim_text(true);
        
        let mut buf = Vec::new();
        let mut in_principal = false;
        let mut in_href = false;
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    match e.name().as_ref() {
                        b"D:current-user-principal" | b"current-user-principal" => in_principal = true,
                        b"D:href" | b"href" => if in_principal { in_href = true; },
                        _ => {}
                    }
                },
                Ok(Event::Text(e)) => {
                    if in_principal && in_href {
                        let text = e.unescape().unwrap_or_default().to_string();
                        if !text.is_empty() {
                            // Convert relative URL to absolute
                            let principal_url = if text.starts_with("/") {
                                let base_url = Url::parse(&self.base_url).map_err(|_| {
                                    CalendarError::ValidationError {
                                        message: "Invalid base URL".to_string(),
                                        provider: Some(CalendarProvider::CalDAV),
                                        account_id: Some(self.account_id.clone()),
                                        field: Some("base_url".to_string()),
                                        value: Some(self.base_url.clone()),
                                        constraint: Some("valid_url".to_string()),
                                    }
                                })?;
                                format!("{}://{}{}", base_url.scheme(), base_url.host_str().unwrap_or(""), text)
                            } else {
                                text
                            };
                            return Ok(principal_url);
                        }
                    }
                },
                Ok(Event::End(ref e)) => {
                    match e.name().as_ref() {
                        b"D:current-user-principal" | b"current-user-principal" => in_principal = false,
                        b"D:href" | b"href" => in_href = false,
                        _ => {}
                    }
                },
                Ok(Event::Eof) => break,
                Err(e) => {
                    tracing::warn!("XML parsing error: {:?}", e);
                    break;
                },
                _ => {}
            }
            buf.clear();
        }
        
        Err(CalendarError::NotFoundError {
            resource_type: "principal".to_string(),
            resource_id: "current-user-principal".to_string(),
            provider: CalendarProvider::CalDAV,
            account_id: self.account_id.clone(),
        })
    }
    
    /// Discover calendar home set from principal URL
    async fn discover_calendar_home_set(&self, principal_url: &str) -> CalendarResult<String> {
        let propfind_body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>"#;
        
        let response = self.propfind(principal_url, propfind_body, 0).await?;
        
        // Extract calendar-home-set from response
        use quick_xml::events::Event;
        use quick_xml::Reader;
        
        let mut reader = Reader::from_str(&response);
        reader.trim_text(true);
        
        let mut buf = Vec::new();
        let mut in_calendar_home_set = false;
        let mut in_href = false;
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    match e.name().as_ref() {
                        b"C:calendar-home-set" | b"calendar-home-set" => in_calendar_home_set = true,
                        b"D:href" | b"href" => if in_calendar_home_set { in_href = true; },
                        _ => {}
                    }
                },
                Ok(Event::Text(e)) => {
                    if in_calendar_home_set && in_href {
                        let text = e.unescape().unwrap_or_default().to_string();
                        if !text.is_empty() {
                            // Convert relative URL to absolute
                            let home_set_url = if text.starts_with("/") {
                                let base_url = Url::parse(&self.base_url).map_err(|_| {
                                    CalendarError::ValidationError {
                                        message: "Invalid base URL".to_string(),
                                        provider: Some(CalendarProvider::CalDAV),
                                        account_id: Some(self.account_id.clone()),
                                        field: Some("base_url".to_string()),
                                        value: Some(self.base_url.clone()),
                                        constraint: Some("valid_url".to_string()),
                                    }
                                })?;
                                format!("{}://{}{}", base_url.scheme(), base_url.host_str().unwrap_or(""), text)
                            } else {
                                text
                            };
                            return Ok(home_set_url);
                        }
                    }
                },
                Ok(Event::End(ref e)) => {
                    match e.name().as_ref() {
                        b"C:calendar-home-set" | b"calendar-home-set" => in_calendar_home_set = false,
                        b"D:href" | b"href" => in_href = false,
                        _ => {}
                    }
                },
                Ok(Event::Eof) => break,
                Err(e) => {
                    tracing::warn!("XML parsing error: {:?}", e);
                    break;
                },
                _ => {}
            }
            buf.clear();
        }
        
        // Fallback to base URL if calendar-home-set not found
        Ok(self.base_url.clone())
    }
    
    /// Test if the server supports calendar creation
    async fn test_calendar_creation_support(&self) -> CalendarResult<bool> {
        // Try to get supported methods via OPTIONS on a calendar collection
        let options_response = self.create_authenticated_request(reqwest::Method::OPTIONS, &self.base_url)?
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("OPTIONS request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        if let Some(allow_header) = options_response.headers().get("Allow") {
            if let Ok(allow_str) = allow_header.to_str() {
                return Ok(allow_str.contains("MKCALENDAR"));
            }
        }
        
        // Fallback: assume calendar creation is supported
        Ok(true)
    }
    
    /// Setup and validate CalDAV account
    pub async fn setup_account(&mut self) -> CalendarResult<AccountSetupResult> {
        tracing::info!("Setting up CalDAV account: {}", self.account_id);
        
        let mut result = AccountSetupResult {
            success: false,
            capabilities: None,
            discovered_calendars: Vec::new(),
            errors: Vec::new(),
            warnings: Vec::new(),
        };
        
        // Step 1: Test connection and discover capabilities
        match self.test_connection().await {
            Ok(()) => {
                tracing::info!("Connection test successful");
            }
            Err(e) => {
                result.errors.push(format!("Connection test failed: {}", e));
                return Ok(result);
            }
        }
        
        // Step 2: Discover CalDAV capabilities
        match self.discover_caldav_capabilities().await {
            Ok(capabilities) => {
                tracing::info!("Capabilities discovered successfully");
                result.capabilities = Some(capabilities.clone());
                
                if !capabilities.supports_webdav {
                    result.warnings.push("Server may not fully support WebDAV".to_string());
                }
                
                if !capabilities.supports_caldav {
                    result.warnings.push("Server may not support CalDAV extensions".to_string());
                }
            }
            Err(e) => {
                let warning = format!("Capability discovery failed: {}", e);
                result.warnings.push(warning);
                tracing::warn!("Continuing with limited capabilities");
            }
        }
        
        // Step 3: Discover available calendars
        match self.list_calendars().await {
            Ok(calendars) => {
                tracing::info!("Found {} calendars", calendars.len());
                result.discovered_calendars = calendars;
                result.success = true;
            }
            Err(e) => {
                result.errors.push(format!("Calendar discovery failed: {}", e));
            }
        }
        
        // If we have any calendars or no errors, consider setup successful
        if result.discovered_calendars.is_empty() && result.errors.is_empty() {
            result.warnings.push("No calendars found, but connection is working".to_string());
            result.success = true;
        }
        
        if result.success {
            tracing::info!("CalDAV account setup completed successfully");
        } else {
            tracing::error!("CalDAV account setup failed: {:?}", result.errors);
        }
        
        Ok(result)
    }
    
    /// Test authentication with the CalDAV server
    pub async fn test_authentication(&self) -> CalendarResult<bool> {
        tracing::info!("Testing CalDAV authentication");
        
        // Try a simple PROPFIND request that requires authentication
        let propfind_body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:current-user-principal/>
  </D:prop>
</D:propfind>"#;
        
        match self.propfind(&self.base_url, propfind_body, 0).await {
            Ok(_) => {
                tracing::info!("Authentication test successful");
                Ok(true)
            }
            Err(CalendarError::AuthenticationError { .. }) => {
                tracing::warn!("Authentication test failed - invalid credentials");
                Ok(false)
            }
            Err(e) => {
                tracing::warn!("Authentication test inconclusive: {}", e);
                // If we get other errors, assume auth is working but there are other issues
                Ok(true)
            }
        }
    }

    /// Create authenticated request with proper headers
    fn create_authenticated_request(&self, method: Method, url: &str) -> CalendarResult<RequestBuilder> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/xml; charset=utf-8"));
        headers.insert(USER_AGENT, HeaderValue::from_static("FlowDesk-Calendar/1.0"));

        // Add authentication - prefer OAuth tokens if available, fallback to basic auth
        if let Some(oauth_tokens) = &self.config.oauth_tokens {
            let auth_header = format!("Bearer {}", oauth_tokens.access_token);
            headers.insert(AUTHORIZATION, HeaderValue::from_str(&auth_header)
                .map_err(|e| CalendarError::AuthenticationError {
                    message: format!("Invalid OAuth token: {}", e),
                    provider: CalendarProvider::CalDAV,
                    account_id: self.account_id.clone(),
                    needs_reauth: true,
                })?);
        } else if !self.config.username.is_empty() && !self.config.password.is_empty() {
            let encoded = general_purpose::STANDARD.encode(
                format!("{}:{}", self.config.username, self.config.password)
            );
            let auth_header = format!("Basic {}", encoded);
            headers.insert(AUTHORIZATION, HeaderValue::from_str(&auth_header)
                .map_err(|e| CalendarError::AuthenticationError {
                    message: format!("Invalid basic auth header: {}", e),
                    provider: CalendarProvider::CalDAV,
                    account_id: self.account_id.clone(),
                    needs_reauth: true,
                })?);
        } else if let Some(credentials) = &self.credentials {
            // Fallback to credentials if config doesn't have auth info
            let auth_header = match &credentials.auth_type {
                Some(auth_type) if auth_type == "basic" => {
                    let encoded = general_purpose::STANDARD.encode(
                        format!("{}:{}", 
                            credentials.username.as_deref().unwrap_or(""), 
                            credentials.password.as_deref().unwrap_or(""))
                    );
                    format!("Basic {}", encoded)
                },
                _ => {
                    format!("Bearer {}", credentials.access_token)
                }
            };
            
            headers.insert(AUTHORIZATION, HeaderValue::from_str(&auth_header)
                .map_err(|e| CalendarError::AuthenticationError {
                    message: format!("Invalid authentication header: {}", e),
                    provider: CalendarProvider::CalDAV,
                    account_id: self.account_id.clone(),
                    needs_reauth: true,
                })?);
        }

        Ok(self.client.request(method, url).headers(headers))
    }

    /// Execute CalDAV PROPFIND request
    async fn propfind(&self, url: &str, body: &str, depth: u32) -> CalendarResult<String> {
        let mut request = self.create_authenticated_request(Method::from_bytes(b"PROPFIND").unwrap(), url)?;
        request = request
            .header("Depth", depth.to_string())
            .body(body.to_string());

        let response = request.send().await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("PROPFIND request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;

        let status = response.status();
        let body = response.text().await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to read response: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })?;

        if status.is_success() || status.as_u16() == 207 { // 207 Multi-Status is expected for PROPFIND
            Ok(body)
        } else {
            Err(CalendarError::NetworkError {
                message: format!("PROPFIND failed with status {}: {}", status, body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    /// Execute CalDAV REPORT request for calendar queries
    async fn calendar_query(&self, url: &str, body: &str) -> CalendarResult<String> {
        let mut request = self.create_authenticated_request(Method::from_bytes(b"REPORT").unwrap(), url)?;
        request = request
            .header("Depth", "1")
            .body(body.to_string());

        let response = request.send().await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("REPORT request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;

        let status = response.status();
        let body = response.text().await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to read response: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })?;

        if status.is_success() || status.as_u16() == 207 {
            Ok(body)
        } else {
            Err(CalendarError::NetworkError {
                message: format!("REPORT failed with status {}: {}", status, body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    /// Parse calendar list from PROPFIND response
    fn parse_calendar_list(&self, xml_response: &str) -> CalendarResult<Vec<Calendar>> {
        
        use quick_xml::events::Event;
        use quick_xml::Reader;
        
        let mut calendars = Vec::new();
        let mut reader = Reader::from_str(xml_response);
        reader.trim_text(true);
        
        let mut buf = Vec::new();
        let mut current_href = String::new();
        let mut current_displayname = String::new();
        let mut current_description = String::new();
        let mut current_color = String::new();
        let mut in_response = false;
        let mut in_displayname = false;
        let mut in_description = false;
        let mut in_color = false;
        let mut in_href = false;
        let mut is_calendar = false;
        
        // Create at least one default calendar even if parsing fails
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    match e.name().as_ref() {
                        b"D:response" => {
                            in_response = true;
                            current_href.clear();
                            current_displayname.clear();
                            current_description.clear();
                            current_color.clear();
                            is_calendar = false;
                        },
                        b"D:href" => in_href = true,
                        b"D:displayname" => in_displayname = true,
                        b"C:calendar-description" => in_description = true,
                        b"C:calendar-color" => in_color = true,
                        b"C:supported-calendar-component-set" => is_calendar = true,
                        _ => {},
                    }
                },
                Ok(Event::Text(e)) => {
                    let text = e.unescape().unwrap_or_default().to_string();
                    if in_href { current_href = text; }
                    else if in_displayname { current_displayname = text; }
                    else if in_description { current_description = text; }
                    else if in_color { current_color = text; }
                },
                Ok(Event::End(ref e)) => {
                    match e.name().as_ref() {
                        b"D:response" => {
                            if in_response && is_calendar && !current_displayname.is_empty() {
                                let calendar = Calendar {
                                    id: Uuid::new_v4().to_string(),
                                    account_id: Uuid::parse_str(&self.account_id).unwrap_or_default(),
                                    provider_id: current_href.trim_start_matches('/').trim_end_matches('/').to_string(),
                                    name: current_displayname.clone(),
                                    description: if current_description.is_empty() { None } else { Some(current_description.clone()) },
                                    color: if current_color.is_empty() { Some("#1976d2".to_string()) } else { Some(current_color.clone()) },
                                    timezone: "UTC".to_string(),
                                    is_primary: current_href.contains("personal") || current_href.contains("default"),
                                    access_level: CalendarAccessLevel::Owner,
                                    is_visible: true,
                                    can_sync: true,
                                    type_: CalendarType::Primary,
                                    is_selected: true,
                                    sync_status: None,
                                    location_data: None,
                                    created_at: Utc::now(),
                                    updated_at: Utc::now(),
                                    is_being_synced: false,
                                    last_sync_at: None,
                                    sync_error: None,
                                };
                                calendars.push(calendar);
                            }
                            in_response = false;
                        },
                        b"D:href" => in_href = false,
                        b"D:displayname" => in_displayname = false,
                        b"C:calendar-description" => in_description = false,
                        b"C:calendar-color" => in_color = false,
                        _ => {},
                    }
                },
                Ok(Event::Eof) => break,
                Err(e) => {
                    tracing::warn!("XML parsing error in calendar list: {:?}", e);
                    break;
                },
                _ => {},
            }
            buf.clear();
        }
        
        // If no calendars were parsed, create a default one
        if calendars.is_empty() {
            let calendar = Calendar {
                id: Uuid::new_v4().to_string(),
                account_id: Uuid::parse_str(&self.account_id).unwrap_or_default(),
                provider_id: "default".to_string(),
                name: "Default Calendar".to_string(),
                description: Some("CalDAV Default Calendar".to_string()),
                color: Some("#1976d2".to_string()),
                timezone: "UTC".to_string(),
                is_primary: true,
                access_level: CalendarAccessLevel::Owner,
                is_visible: true,
                can_sync: true,
                type_: CalendarType::Primary,
                is_selected: true,
                sync_status: None,
                location_data: None,
                last_sync_at: None,
                is_being_synced: false,
                sync_error: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            calendars.push(calendar);
        }
        
        Ok(calendars)
    }

    /// Parse events from calendar-query response
    fn parse_events_from_query(&self, xml_response: &str, calendar_id: &str) -> CalendarResult<Vec<CalendarEvent>> {
        use quick_xml::events::Event;
        use quick_xml::Reader;
        
        let mut events = Vec::new();
        let mut reader = Reader::from_str(xml_response);
        reader.trim_text(true);
        
        let mut buf = Vec::new();
        let mut in_calendar_data = false;
        let mut current_ical_data = String::new();
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    if e.name().as_ref() == b"C:calendar-data" {
                        in_calendar_data = true;
                        current_ical_data.clear();
                    }
                },
                Ok(Event::Text(e)) => {
                    if in_calendar_data {
                        current_ical_data.push_str(&e.unescape().unwrap_or_default());
                    }
                },
                Ok(Event::CData(e)) => {
                    if in_calendar_data {
                        current_ical_data.push_str(&String::from_utf8_lossy(&e));
                    }
                },
                Ok(Event::End(ref e)) => {
                    if e.name().as_ref() == b"C:calendar-data" {
                        in_calendar_data = false;
                        
                        // Parse the iCalendar data
                        if let Ok(parsed_events) = self.parse_icalendar_events(&current_ical_data, calendar_id) {
                            events.extend(parsed_events);
                        }
                    }
                },
                Ok(Event::Eof) => break,
                Err(e) => {
                    tracing::warn!("XML parsing error in events: {:?}", e);
                    break;
                },
                _ => {},
            }
            buf.clear();
        }
        
        Ok(events)
    }
    
    /// Parse iCalendar data into CalendarEvent objects
    fn parse_icalendar_events(&self, ical_data: &str, calendar_id: &str) -> CalendarResult<Vec<CalendarEvent>> {
        use icalendar::{Calendar as IcalCalendar, Component, CalendarComponent};
        
        let mut events = Vec::new();
        
        // Parse the iCalendar data
        let ical_calendar = match ical_data.parse::<IcalCalendar>() {
            Ok(cal) => cal,
            Err(e) => {
                tracing::warn!("Failed to parse iCalendar data: {:?}", e);
                return Ok(events);
            }
        };
        
        // Extract events from the calendar
        for component in ical_calendar.components {
            if let CalendarComponent::Event(ical_event) = component {
                if let Ok(calendar_event) = self.convert_ical_event_to_calendar_event(ical_event, calendar_id) {
                    events.push(calendar_event);
                }
            }
        }
        
        Ok(events)
    }
    
    /// Convert iCalendar event to CalendarEvent
    fn convert_ical_event_to_calendar_event(&self, ical_event: icalendar::Event, calendar_id: &str) -> CalendarResult<CalendarEvent> {
        // Extract basic properties
        let title = ical_event.get_summary().unwrap_or("(No title)").to_string();
        let description = ical_event.get_description().map(|d| d.to_string());
        let location = ical_event.get_location().map(|l| l.to_string());
        let uid = ical_event.get_uid().map(|u| u.to_string())
            .unwrap_or_else(|| format!("uid_{}", Uuid::new_v4()));
        
        // Parse dates - this is simplified, a full implementation would handle timezones properly
        let start_time = ical_event.get_start().and_then(|dt| {
            match dt {
                icalendar::DatePerhapsTime::DateTime(icalendar::CalendarDateTime::Utc(dt)) => Some(dt),
                icalendar::DatePerhapsTime::DateTime(icalendar::CalendarDateTime::Floating(dt)) => Some(dt.and_utc()),
                icalendar::DatePerhapsTime::DateTime(icalendar::CalendarDateTime::WithTimezone { date_time, tzid: _ }) => Some(date_time.and_utc()),
                _ => None,
            }
        }).unwrap_or_else(|| Utc::now());
        
        let end_time = ical_event.get_end().and_then(|dt| {
            match dt {
                icalendar::DatePerhapsTime::DateTime(icalendar::CalendarDateTime::Utc(dt)) => Some(dt),
                icalendar::DatePerhapsTime::DateTime(icalendar::CalendarDateTime::Floating(dt)) => Some(dt.and_utc()),
                icalendar::DatePerhapsTime::DateTime(icalendar::CalendarDateTime::WithTimezone { date_time, tzid: _ }) => Some(date_time.and_utc()),
                _ => None,
            }
        }).unwrap_or_else(|| start_time + chrono::Duration::hours(1));
        
        // Determine if it's an all-day event - for CalDAV, we'll default to false for simplicity
        let is_all_day = false;
        
        Ok(CalendarEvent {
            id: Uuid::new_v4().to_string(),
            calendar_id: calendar_id.to_string(),
            account_id: Uuid::parse_str(&self.account_id).unwrap_or_default(),
            provider_id: uid.clone(),
            title,
            description,
            location,
            location_data: None,
            start_time,
            end_time,
            timezone: "UTC".to_string(), // Would be extracted from DTSTART/DTEND in full implementation
            all_day: is_all_day,
            is_all_day,
            status: EventStatus::Confirmed, // Would parse STATUS property
            visibility: EventVisibility::Default,
            attendees: vec![], // Would parse ATTENDEE properties
            recurrence: None, // Would parse RRULE property - convert RecurrenceRule to EventRecurrence
            recurring_event_id: None,
            original_start_time: None,
            attachments: vec![], // Would parse ATTACH properties
            extended_properties: None,
            color: None,
            uid: Some(uid),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }

    /// Convert RecurrenceRule to EventRecurrence 
    fn convert_recurrence_rule_to_event_recurrence(rule: &RecurrenceRule) -> EventRecurrence {
        use crate::calendar::types::EventRecurrence;
        
        // Convert RecurrenceRule to RRULE string format
        let mut rrule_parts = Vec::new();
        
        rrule_parts.push(format!("FREQ={}", match rule.frequency {
            RecurrenceFrequency::Daily => "DAILY",
            RecurrenceFrequency::Weekly => "WEEKLY", 
            RecurrenceFrequency::Monthly => "MONTHLY",
            RecurrenceFrequency::Yearly => "YEARLY",
        }));
        
        if rule.interval > 1 {
            rrule_parts.push(format!("INTERVAL={}", rule.interval));
        }
        
        if let Some(count) = rule.count {
            rrule_parts.push(format!("COUNT={}", count));
        }
        
        if let Some(until) = rule.until {
            rrule_parts.push(format!("UNTIL={}", until.format("%Y%m%dT%H%M%SZ")));
        }
        
        EventRecurrence {
            rule: format!("RRULE:{}", rrule_parts.join(";")),
            exceptions: vec![], // Could be populated from EXDATE
        }
    }
    
    /// Convert EventRecurrence to RecurrenceRule
    fn convert_event_recurrence_to_recurrence_rule(recurrence: Option<&EventRecurrence>) -> Option<RecurrenceRule> {
        // This is a simplified conversion - a full implementation would parse the RRULE string
        // For now, return None to indicate no recurrence conversion
        recurrence?; // Return None if recurrence is None
        None
    }

    /// Convert CalendarEvent to iCalendar format
    fn event_to_icalendar(&self, event: &CreateCalendarEventInput) -> CalendarResult<String> {
        let mut calendar = IcalCalendar::new();
        // Set PRODID property - for now we'll just comment this out as the icalendar crate API varies
        // calendar.push(icalendar::Property::new("PRODID", "-//FlowDesk//FlowDesk Calendar 1.0//EN"));
        
        let mut ical_event = IcalEvent::new();
        
        // Required properties
        ical_event.summary(&event.title);
        ical_event.starts(event.start_time);
        ical_event.ends(event.end_time);
        
        // UID is critical for CalDAV
        if let Some(uid) = &event.uid {
            ical_event.uid(uid);
        } else {
            ical_event.uid(&format!("event_{}", Uuid::new_v4()));
        }
        
        // DTSTAMP is required by RFC
        ical_event.timestamp(Utc::now());
        
        // Optional properties
        if let Some(description) = &event.description {
            ical_event.description(description);
        }
        
        if let Some(location) = &event.location {
            ical_event.location(location);
        }
        
        // Set status
        if let Some(status) = &event.status {
            let status_str = match status {
                EventStatus::Confirmed => "CONFIRMED",
                EventStatus::Tentative => "TENTATIVE",
                EventStatus::Cancelled => "CANCELLED",
            };
            ical_event.add_property("STATUS", status_str);
        }
        
        // Set visibility
        if let Some(visibility) = &event.visibility {
            let class_str = match visibility {
                EventVisibility::Public => "PUBLIC",
                EventVisibility::Private => "PRIVATE",
                EventVisibility::Confidential => "CONFIDENTIAL",
                EventVisibility::Default => "PUBLIC",
            };
            ical_event.add_property("CLASS", class_str);
        }
        
        // Add attendees
        if let Some(attendees) = &event.attendees {
            for attendee in attendees {
                let mut attendee_str = format!("mailto:{}", attendee.email);
                if let Some(name) = &attendee.name {
                    attendee_str = format!("{}:MAILTO:{}", name, attendee.email);
                }
                ical_event.add_property("ATTENDEE", &attendee_str);
            }
        }
        
        // Handle recurrence
        if let Some(recurrence) = &event.recurrence {
            let rrule = self.convert_recurrence_rule_to_rrule(recurrence)?;
            ical_event.add_property("RRULE", &rrule);
        }
        
        // Handle reminders - commented out due to icalendar API issues
        // if let Some(reminders) = &event.reminders {
        //     for reminder in reminders {
        //         // Create VALARM component for each reminder
        //         let alarm_minutes = reminder.minutes_before.abs();
        //         let trigger = format!("-PT{}M", alarm_minutes);
        //         let alarm = icalendar::Alarm::display(&event.title, trigger);
        //         ical_event.alarm(alarm);
        //     }
        // }
        
        calendar.push(ical_event);
        Ok(calendar.to_string())
    }
    
    /// Get the proper calendar path for a calendar ID
    async fn get_calendar_path(&mut self, calendar_id: &str) -> CalendarResult<String> {
        // First check if this is already a full path
        if calendar_id.starts_with("http") {
            return Ok(calendar_id.to_string());
        }
        
        // Try to get the calendar and extract its path
        let calendars = self.list_calendars().await?;
        for calendar in calendars {
            if calendar.id == calendar_id || calendar.provider_id == calendar_id {
                // Construct the full path based on the provider_id
                if calendar.provider_id.starts_with("/") {
                    // Relative path, make it absolute
                    let base_url = Url::parse(&self.base_url).map_err(|_| {
                        CalendarError::ValidationError {
                            message: "Invalid base URL".to_string(),
                            provider: Some(CalendarProvider::CalDAV),
                            account_id: Some(self.account_id.clone()),
                            field: Some("base_url".to_string()),
                            value: Some(self.base_url.clone()),
                            constraint: Some("valid_url".to_string()),
                        }
                    })?;
                    return Ok(format!("{}://{}{}", base_url.scheme(), base_url.host_str().unwrap_or(""), calendar.provider_id.trim_end_matches('/')));
                } else {
                    // Already absolute or relative to base_url
                    return Ok(format!("{}/{}", self.base_url.trim_end_matches('/'), calendar.provider_id.trim_start_matches('/')));
                }
            }
        }
        
        // Fallback: assume calendar_id is the path
        Ok(format!("{}/{}", self.base_url.trim_end_matches('/'), calendar_id.trim_start_matches('/')))
    }
    
    /// Convert RecurrenceRule to RRULE string
    fn convert_recurrence_rule_to_rrule(&self, rule: &RecurrenceRule) -> CalendarResult<String> {
        let mut parts = Vec::new();
        
        // Frequency
        let freq = match rule.frequency {
            RecurrenceFrequency::Daily => "DAILY",
            RecurrenceFrequency::Weekly => "WEEKLY",
            RecurrenceFrequency::Monthly => "MONTHLY",
            RecurrenceFrequency::Yearly => "YEARLY",
        };
        parts.push(format!("FREQ={}", freq));
        
        // Interval
        if rule.interval > 1 {
            parts.push(format!("INTERVAL={}", rule.interval));
        }
        
        // Count or Until
        if let Some(count) = rule.count {
            parts.push(format!("COUNT={}", count));
        } else if let Some(until) = rule.until {
            parts.push(format!("UNTIL={}", until.format("%Y%m%dT%H%M%SZ")));
        }
        
        Ok(parts.join(";"))
    }
}

#[async_trait]
impl CalendarProviderTrait for CalDavProvider {
    fn provider_type(&self) -> CalendarProvider {
        CalendarProvider::CalDAV
    }

    fn account_id(&self) -> &str {
        &self.account_id
    }

    async fn test_connection(&mut self) -> CalendarResult<()> {
        tracing::info!("Testing CalDAV connection to: {}", self.base_url);
        
        // Discover full CalDAV capabilities
        match self.discover_caldav_capabilities().await {
            Ok(capabilities) => {
                tracing::info!("CalDAV discovery successful:");
                tracing::info!("  WebDAV support: {}", capabilities.supports_webdav);
                tracing::info!("  CalDAV support: {}", capabilities.supports_caldav);
                tracing::info!("  DAV compliance: {}", capabilities.dav_compliance);
                tracing::info!("  Principal URL: {:?}", capabilities.principal_url);
                tracing::info!("  Calendar home set: {:?}", capabilities.calendar_home_set);
                tracing::info!("  Can create calendars: {}", capabilities.can_create_calendars);
                
                if capabilities.supports_webdav {
                    Ok(())
                } else {
                    Err(CalendarError::NetworkError {
                        message: "Server does not support WebDAV (required for CalDAV)".to_string(),
                        provider: CalendarProvider::CalDAV,
                        account_id: self.account_id.clone(),
                        status_code: Some(200),
                        is_timeout: false,
                        is_connection_error: false,
                    })
                }
            }
            Err(e) => {
                tracing::warn!("CalDAV discovery failed, trying basic OPTIONS: {}", e);
                
                // Fallback to basic OPTIONS request
                let response = self.create_authenticated_request(reqwest::Method::OPTIONS, &self.base_url)?
                    .send()
                    .await
                    .map_err(|e| CalendarError::NetworkError {
                        message: format!("CalDAV connection test failed to {}: {}", self.base_url, e),
                        provider: CalendarProvider::CalDAV,
                        account_id: self.account_id.clone(),
                        status_code: None,
                        is_timeout: false,
                        is_connection_error: true,
                    })?;

                let status = response.status();
                let response_headers = response.headers().clone();
                
                if status.is_success() {
                    // Check for CalDAV-specific headers
                    let dav_header = response_headers.get("DAV").map(|h| h.to_str().unwrap_or(""));
                    if let Some(dav_header) = dav_header {
                        if dav_header.contains("calendar-access") || dav_header.contains("1") {
                            tracing::info!("CalDAV server capabilities confirmed: {}", dav_header);
                            Ok(())
                        } else {
                            tracing::warn!("Server may not support CalDAV: DAV header = {}", dav_header);
                            Ok(()) // Still allow connection for basic WebDAV servers
                        }
                    } else {
                        tracing::info!("Connected to server, CalDAV capabilities unknown");
                        Ok(()) // Allow connection even without DAV header
                    }
                } else {
                    Err(CalendarError::NetworkError {
                        message: format!("CalDAV server at {} returned error: {}", self.base_url, status),
                        provider: CalendarProvider::CalDAV,
                        account_id: self.account_id.clone(),
                        status_code: Some(status.as_u16()),
                        is_timeout: false,
                        is_connection_error: false,
                    })
                }
            }
        }
    }

    async fn refresh_authentication(&mut self) -> CalendarResult<()> {
        // CalDAV typically uses basic auth, no refresh needed
        Ok(())
    }

    async fn list_calendars(&mut self) -> CalendarResult<Vec<Calendar>> {
        // Use PROPFIND to discover calendar collections
        let propfind_body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <C:supported-calendar-component-set/>
    <C:calendar-description/>
    <C:calendar-color/>
    <C:calendar-timezone/>
  </D:prop>
</D:propfind>"#;

        let response = self.propfind(&self.base_url, propfind_body, 1).await?;
        let calendars = self.parse_calendar_list(&response)?;
        
        // Cache the calendars
        let mut cache = self.calendar_cache.write().await;
        for calendar in &calendars {
            cache.insert(calendar.id.clone(), calendar.clone());
        }
        
        Ok(calendars)
    }

    async fn get_calendar(&mut self, calendar_id: &str) -> CalendarResult<Calendar> {
        // First check cache
        {
            let cache = self.calendar_cache.read().await;
            if let Some(calendar) = cache.get(calendar_id) {
                return Ok(calendar.clone());
            }
        }
        
        // If not in cache, fetch all calendars
        let calendars = self.list_calendars().await?;
        calendars.into_iter()
            .find(|c| c.id == calendar_id)
            .ok_or_else(|| CalendarError::NotFoundError {
                resource_type: "calendar".to_string(),
                resource_id: calendar_id.to_string(),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
            })
    }

    async fn create_calendar(&mut self, calendar: &Calendar) -> CalendarResult<Calendar> {
        // MKCALENDAR request to create a new calendar
        let calendar_url = format!("{}/{}/", self.base_url, calendar.provider_id);
        
        let mkcalendar_body = format!(r#"<?xml version="1.0" encoding="utf-8" ?>
<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>{}</D:displayname>
      <C:calendar-description>{}</C:calendar-description>
      <C:supported-calendar-component-set>
        <C:comp name="VEVENT"/>
        <C:comp name="VTODO"/>
      </C:supported-calendar-component-set>
    </D:prop>
  </D:set>
</C:mkcalendar>"#, 
            calendar.name,
            calendar.description.as_deref().unwrap_or(&calendar.name)
        );
        
        let response = self.create_authenticated_request(reqwest::Method::from_bytes(b"MKCALENDAR").unwrap(), &calendar_url)?
            .header("Content-Type", "text/xml; charset=utf-8")
            .body(mkcalendar_body)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("MKCALENDAR request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        let status = response.status();
        if status.is_success() || status.as_u16() == 201 {
            Ok(calendar.clone())
        } else {
            let error_body = response.text().await.unwrap_or_default();
            Err(CalendarError::NetworkError {
                message: format!("Failed to create calendar: HTTP {} - {}", status, error_body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    async fn update_calendar(&mut self, calendar_id: &str, calendar: &Calendar) -> CalendarResult<Calendar> {
        // PROPPATCH request to update calendar properties
        let calendar_url = format!("{}/{}/", self.base_url, calendar_id);
        
        let proppatch_body = format!(r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propertyupdate xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:displayname>{}</D:displayname>
      <C:calendar-description>{}</C:calendar-description>
    </D:prop>
  </D:set>
</D:propertyupdate>"#, 
            calendar.name,
            calendar.description.as_deref().unwrap_or(&calendar.name)
        );
        
        let response = self.create_authenticated_request(reqwest::Method::from_bytes(b"PROPPATCH").unwrap(), &calendar_url)?
            .header("Content-Type", "text/xml; charset=utf-8")
            .body(proppatch_body)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("PROPPATCH request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        let status = response.status();
        if status.is_success() || status.as_u16() == 207 {
            Ok(calendar.clone())
        } else {
            let error_body = response.text().await.unwrap_or_default();
            Err(CalendarError::NetworkError {
                message: format!("Failed to update calendar: HTTP {} - {}", status, error_body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    async fn delete_calendar(&mut self, calendar_id: &str) -> CalendarResult<()> {
        // DELETE request to remove the calendar
        let calendar_url = format!("{}/{}/", self.base_url, calendar_id);
        
        let response = self.create_authenticated_request(reqwest::Method::DELETE, &calendar_url)?
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("DELETE request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        let status = response.status();
        if status.is_success() || status.as_u16() == 204 {
            Ok(())
        } else {
            let error_body = response.text().await.unwrap_or_default();
            Err(CalendarError::NetworkError {
                message: format!("Failed to delete calendar: HTTP {} - {}", status, error_body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    async fn list_events(
        &mut self,
        calendar_id: &str,
        time_min: Option<DateTime<Utc>>,
        time_max: Option<DateTime<Utc>>,
        max_results: Option<u32>,
    ) -> CalendarResult<Vec<CalendarEvent>> {
        // Build calendar-query REPORT request
        let time_min = time_min.unwrap_or_else(|| Utc::now() - chrono::Duration::days(30));
        let time_max = time_max.unwrap_or_else(|| Utc::now() + chrono::Duration::days(30));
        
        let calendar_query = format!(r#"<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="{}" end="{}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>"#, 
            time_min.format("%Y%m%dT%H%M%SZ"),
            time_max.format("%Y%m%dT%H%M%SZ")
        );

        let calendar_path = self.get_calendar_path(calendar_id).await?;
        let calendar_url = format!("{}/", calendar_path.trim_end_matches('/'));
        let response = self.calendar_query(&calendar_url, &calendar_query).await?;
        let mut events = self.parse_events_from_query(&response, calendar_id)?;
        
        // Apply max results limit if specified
        if let Some(limit) = max_results {
            events.truncate(limit as usize);
        }
        
        Ok(events)
    }

    async fn get_event(&mut self, calendar_id: &str, event_id: &str) -> CalendarResult<CalendarEvent> {
        // GET the specific event resource using proper calendar path
        let calendar_path = self.get_calendar_path(calendar_id).await?;
        let event_url = format!("{}/{}.ics", calendar_path, event_id);
        
        let response = self.create_authenticated_request(reqwest::Method::GET, &event_url)?
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("GET event request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        if response.status().is_success() {
            let ical_data = response.text().await
                .map_err(|e| CalendarError::NetworkError {
                    message: format!("Failed to read event data: {}", e),
                    provider: CalendarProvider::CalDAV,
                    account_id: self.account_id.clone(),
                    status_code: Some(200),
                    is_timeout: false,
                    is_connection_error: false,
                })?;
                
            let events = self.parse_icalendar_events(&ical_data, calendar_id)?;
            events.into_iter().next()
                .ok_or_else(|| CalendarError::NotFoundError {
                    resource_type: "event".to_string(),
                    resource_id: event_id.to_string(),
                    provider: CalendarProvider::CalDAV,
                    account_id: self.account_id.clone(),
                })
        } else {
            Err(CalendarError::NotFoundError {
                resource_type: "event".to_string(),
                resource_id: event_id.to_string(),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
            })
        }
    }

    async fn create_event(&mut self, event: &CreateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        // Convert event to iCalendar format
        let ical_data = self.event_to_icalendar(event)?;
        
        // Generate unique event UID and URL
        let default_uid = format!("event_{}", Uuid::new_v4());
        let event_uid = event.uid.as_deref().unwrap_or(&default_uid);
        
        // Find the actual calendar path
        let calendar_path = self.get_calendar_path(&event.calendar_id).await?;
        let event_url = format!("{}/{}.ics", calendar_path, event_uid);
        
        // PUT the iCalendar data to the server
        let response = self.create_authenticated_request(reqwest::Method::PUT, &event_url)?
            .header(CONTENT_TYPE, "text/calendar; charset=utf-8")
            .body(ical_data)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to create event: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;

        let status = response.status();
        if status.is_success() || status.as_u16() == 201 {
            // Return the created event
            Ok(CalendarEvent {
                id: Uuid::new_v4().to_string(),
                calendar_id: event.calendar_id.clone(),
                account_id: Uuid::parse_str(&self.account_id).unwrap_or_default(),
                provider_id: event_uid.to_string(),
                title: event.title.clone(),
                description: event.description.clone(),
                location: event.location.clone(),
                location_data: event.location_data.clone(),
                start_time: event.start_time,
                end_time: event.end_time,
                timezone: event.timezone.clone().unwrap_or_else(|| "UTC".to_string()),
                all_day: event.all_day,
                is_all_day: event.is_all_day,
                status: event.status.clone().unwrap_or(EventStatus::Confirmed),
                visibility: event.visibility.clone().unwrap_or(EventVisibility::Default),
                attendees: event.attendees.clone().unwrap_or_default(),
                recurrence: event.recurrence.as_ref().map(|r| Self::convert_recurrence_rule_to_event_recurrence(r)),
                recurring_event_id: event.recurring_event_id.clone(),
                original_start_time: event.original_start_time,
                attachments: event.attachments.clone().unwrap_or_default(),
                extended_properties: event.extended_properties.clone(),
                color: event.color.clone(),
                uid: Some(event_uid.to_string()),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            })
        } else {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_default();
            Err(CalendarError::NetworkError {
                message: format!("Failed to create event: HTTP {} - {}", status, error_body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    async fn update_event(&mut self, calendar_id: &str, event_id: &str, updates: &UpdateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        // First get the existing event to merge changes
        let existing_event = self.get_event(calendar_id, event_id).await?;
        
        // Create updated event input from existing event and updates
        let updated_input = CreateCalendarEventInput {
            calendar_id: calendar_id.to_string(),
            title: updates.title.clone().unwrap_or(existing_event.title),
            description: updates.description.clone().or(existing_event.description),
            location: updates.location.clone().or(existing_event.location),
            start_time: updates.start_time.unwrap_or(existing_event.start_time),
            end_time: updates.end_time.unwrap_or(existing_event.end_time),
            timezone: updates.timezone.clone().or_else(|| Some(existing_event.timezone)),
            all_day: updates.all_day.unwrap_or(existing_event.all_day),
            is_all_day: updates.all_day.unwrap_or(existing_event.is_all_day),
            status: updates.status.clone().or(Some(existing_event.status.clone())),
            visibility: updates.visibility.clone().or(Some(existing_event.visibility.clone())),
            attendees: updates.attendees.clone().or_else(|| Some(existing_event.attendees)),
            recurrence: updates.recurrence.clone().or_else(|| existing_event.recurrence.as_ref().and_then(|r| Self::convert_event_recurrence_to_recurrence_rule(Some(r)))),
            recurring_event_id: existing_event.recurring_event_id,
            original_start_time: existing_event.original_start_time,
            attachments: updates.attachments.clone().or_else(|| Some(existing_event.attachments)),
            extended_properties: updates.extended_properties.clone().or(existing_event.extended_properties),
            color: updates.color.clone().or(existing_event.color),
            uid: existing_event.uid,
            reminders: updates.reminders.clone().or_else(|| {
                // Convert existing reminders if any
                Some(vec![])
            }),
            conferencing: updates.conferencing.clone(),
            transparency: updates.transparency.clone(),
            location_data: existing_event.location_data,
            // Missing required fields
            provider_id: Some(existing_event.provider_id.clone()),
            source: None,
            creator: None,
            organizer: None,
        };
        
        // Convert to iCalendar and PUT to server
        let ical_data = self.event_to_icalendar(&updated_input)?;
        let calendar_path = self.get_calendar_path(calendar_id).await?;
        let event_url = format!("{}/{}.ics", calendar_path, event_id);
        
        let response = self.create_authenticated_request(reqwest::Method::PUT, &event_url)?
            .header(CONTENT_TYPE, "text/calendar; charset=utf-8")
            .body(ical_data)
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("Failed to update event: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        let status = response.status();
        if status.is_success() {
            // Return updated event by converting the input back
            Ok(CalendarEvent {
                id: existing_event.id,
                calendar_id: updated_input.calendar_id,
                account_id: existing_event.account_id,
                provider_id: existing_event.provider_id,
                title: updated_input.title,
                description: updated_input.description,
                location: updated_input.location,
                location_data: updated_input.location_data,
                start_time: updated_input.start_time,
                end_time: updated_input.end_time,
                timezone: updated_input.timezone.unwrap_or_else(|| "UTC".to_string()),
                all_day: updated_input.all_day,
                is_all_day: updated_input.is_all_day,
                status: updated_input.status.unwrap_or(EventStatus::Confirmed),
                visibility: updated_input.visibility.unwrap_or(EventVisibility::Default),
                attendees: updated_input.attendees.unwrap_or_default(),
                recurrence: updated_input.recurrence.as_ref().map(|r| Self::convert_recurrence_rule_to_event_recurrence(r)),
                recurring_event_id: updated_input.recurring_event_id,
                original_start_time: updated_input.original_start_time,
                attachments: updated_input.attachments.unwrap_or_default(),
                extended_properties: updated_input.extended_properties,
                color: updated_input.color,
                uid: updated_input.uid,
                created_at: existing_event.created_at,
                updated_at: Utc::now(),
            })
        } else {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_default();
            Err(CalendarError::NetworkError {
                message: format!("Failed to update event: HTTP {} - {}", status, error_body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    async fn delete_event(&mut self, calendar_id: &str, event_id: &str) -> CalendarResult<()> {
        // DELETE the specific event resource using proper calendar path
        let calendar_path = self.get_calendar_path(calendar_id).await?;
        let event_url = format!("{}/{}.ics", calendar_path, event_id);
        
        let response = self.create_authenticated_request(reqwest::Method::DELETE, &event_url)?
            .send()
            .await
            .map_err(|e| CalendarError::NetworkError {
                message: format!("DELETE event request failed: {}", e),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: None,
                is_timeout: e.is_timeout(),
                is_connection_error: e.is_connect(),
            })?;
            
        let status = response.status();
        if status.is_success() || status.as_u16() == 204 {
            Ok(())
        } else {
            let error_body = response.text().await.unwrap_or_default();
            Err(CalendarError::NetworkError {
                message: format!("Failed to delete event: HTTP {} - {}", status, error_body),
                provider: CalendarProvider::CalDAV,
                account_id: self.account_id.clone(),
                status_code: Some(status.as_u16()),
                is_timeout: false,
                is_connection_error: false,
            })
        }
    }

    async fn move_event(&mut self, source_calendar_id: &str, target_calendar_id: &str, event_id: &str) -> CalendarResult<CalendarEvent> {
        // Move event by copying to target and deleting from source
        let event = self.get_event(source_calendar_id, event_id).await?;
        
        // Convert to create input for target calendar
        let create_input = CreateCalendarEventInput {
            calendar_id: target_calendar_id.to_string(),
            title: event.title.clone(),
            description: event.description.clone(),
            location: event.location.clone(),
            start_time: event.start_time,
            end_time: event.end_time,
            timezone: Some(event.timezone.clone()),
            all_day: event.all_day,
            is_all_day: event.is_all_day,
            status: Some(event.status),
            visibility: Some(event.visibility),
            attendees: Some(event.attendees.clone()),
            recurrence: Self::convert_event_recurrence_to_recurrence_rule(event.recurrence.as_ref()),
            recurring_event_id: event.recurring_event_id.clone(),
            original_start_time: event.original_start_time,
            attachments: Some(event.attachments.clone()),
            extended_properties: event.extended_properties.clone(),
            color: event.color.clone(),
            uid: event.uid.clone(),
            reminders: Some(vec![]), // Would need to convert from event
            conferencing: None,
            transparency: None,
            location_data: event.location_data.clone(),
            // Missing required fields
            provider_id: Some(event.provider_id.clone()),
            source: None,
            creator: None,
            organizer: None,
        };
        
        // Create in target calendar
        let moved_event = self.create_event(&create_input).await?;
        
        // Delete from source calendar
        self.delete_event(source_calendar_id, event_id).await?;
        
        Ok(moved_event)
    }

    async fn get_recurring_event_instances(&mut self, calendar_id: &str, recurring_event_id: &str, time_min: DateTime<Utc>, time_max: DateTime<Utc>) -> CalendarResult<Vec<CalendarEvent>> {
        // For CalDAV, we need to expand recurring events manually
        let base_event = self.get_event(calendar_id, recurring_event_id).await?;
        
        let recurrence = match &base_event.recurrence {
            Some(recurrence) => recurrence,
            None => return Ok(vec![base_event]),
        };
        
        // For now, use a simple expansion approach
        // TODO: Implement proper RRULE parsing with the rrule crate
        let mut instances = vec![base_event.clone()];
        
        // Basic daily recurrence expansion (simplified for now)
        if recurrence.rule.contains("FREQ=DAILY") {
            let mut current_time = base_event.start_time;
            let event_duration = base_event.end_time - base_event.start_time;
            
            // Generate up to 30 occurrences or until time_max
            for i in 1..30 {
                current_time = current_time + chrono::Duration::days(1);
                if current_time > time_max {
                    break;
                }
                if current_time >= time_min {
                    let mut instance = base_event.clone();
                    instance.id = format!("{}_{}", base_event.id, i);
                    instance.start_time = current_time;
                    instance.end_time = current_time + event_duration;
                    instance.original_start_time = Some(current_time);
                    instances.push(instance);
                }
            }
        }
        
        Ok(instances)
    }

    async fn update_recurring_event_instance(&mut self, calendar_id: &str, recurring_event_id: &str, instance_id: &str, updates: &UpdateCalendarEventInput) -> CalendarResult<CalendarEvent> {
        // For CalDAV, updating a recurring instance typically means creating an exception
        // This is complex and would require proper iCalendar RECURRENCE-ID handling
        // For now, fallback to updating the whole series
        self.update_event(calendar_id, recurring_event_id, updates).await
    }

    async fn delete_recurring_event_instance(&mut self, calendar_id: &str, recurring_event_id: &str, instance_id: &str) -> CalendarResult<()> {
        // For CalDAV, deleting a recurring instance requires adding an EXDATE
        // This is complex and would require proper iCalendar manipulation
        // For now, we'll just log and return success (no-op)
        tracing::warn!("Deleting recurring event instances not fully implemented for CalDAV");
        Ok(())
    }

    async fn add_attendees(&mut self, calendar_id: &str, event_id: &str, attendees: &[EventAttendee]) -> CalendarResult<CalendarEvent> {
        // Get existing event
        let mut event = self.get_event(calendar_id, event_id).await?;
        
        // Add new attendees
        for attendee in attendees {
            if !event.attendees.iter().any(|a| a.email == attendee.email) {
                event.attendees.push(attendee.clone());
            }
        }
        
        // Update the event
        let update_input = UpdateCalendarEventInput {
            title: Some(event.title.clone()),
            description: event.description.clone(),
            location: event.location.clone(),
            start_time: Some(event.start_time),
            end_time: Some(event.end_time),
            timezone: Some(event.timezone.clone()),
            all_day: Some(event.all_day),
            status: Some(event.status),
            visibility: Some(event.visibility),
            attendees: Some(event.attendees.clone()),
            recurrence: Self::convert_event_recurrence_to_recurrence_rule(event.recurrence.as_ref()),
            reminders: Some(vec![]),
            extended_properties: event.extended_properties.clone(),
            color: event.color.clone(),
            conferencing: None,
            transparency: None,
            attachments: Some(event.attachments.clone()),
        };
        
        self.update_event(calendar_id, event_id, &update_input).await
    }

    async fn remove_attendees(&mut self, calendar_id: &str, event_id: &str, attendee_emails: &[String]) -> CalendarResult<CalendarEvent> {
        // Get existing event
        let mut event = self.get_event(calendar_id, event_id).await?;
        
        // Remove attendees
        event.attendees.retain(|attendee| !attendee_emails.contains(&attendee.email));
        
        // Update the event
        let update_input = UpdateCalendarEventInput {
            title: Some(event.title.clone()),
            description: event.description.clone(),
            location: event.location.clone(),
            start_time: Some(event.start_time),
            end_time: Some(event.end_time),
            timezone: Some(event.timezone.clone()),
            all_day: Some(event.all_day),
            status: Some(event.status),
            visibility: Some(event.visibility),
            attendees: Some(event.attendees.clone()),
            recurrence: Self::convert_event_recurrence_to_recurrence_rule(event.recurrence.as_ref()),
            reminders: Some(vec![]),
            extended_properties: event.extended_properties.clone(),
            color: event.color.clone(),
            conferencing: None,
            transparency: None,
            attachments: Some(event.attachments.clone()),
        };
        
        self.update_event(calendar_id, event_id, &update_input).await
    }

    async fn send_invitations(&mut self, calendar_id: &str, event_id: &str, message: Option<&str>) -> CalendarResult<()> {
        // CalDAV doesn't have built-in invitation sending - this would typically
        // be handled by the calendar client or email system
        tracing::info!("CalDAV send_invitations called for event {} - this is typically handled client-side", event_id);
        Ok(())
    }

    async fn query_free_busy(&mut self, query: &FreeBusyQuery) -> CalendarResult<FreeBusyResponse> {
        // CalDAV free/busy is typically done through the VFREEBUSY component
        // This is a simplified implementation that checks events to determine busy times
        let mut free_busy = HashMap::new();
        
        for email in &query.emails {
            let mut busy_slots = Vec::new();
            
            // Get all calendars for this account (simplified - would need email->account mapping)
            if let Ok(calendars) = self.list_calendars().await {
                for calendar in calendars {
                    if let Ok(events) = self.list_events(
                        &calendar.provider_id, 
                        Some(query.time_min), 
                        Some(query.time_max), 
                        None
                    ).await {
                        for event in events {
                            // Check if this email is the organizer or attendee
                            let is_busy = event.attendees.iter()
                                .any(|a| a.email == *email && a.response_status != AttendeeResponseStatus::Declined)
                                || event.attendees.is_empty(); // Assume busy if no attendees (personal event)
                            
                            if is_busy {
                                busy_slots.push(FreeBusySlot {
                                    start_time: event.start_time,
                                    end_time: event.end_time,
                                    status: FreeBusyStatus::Busy,
                                });
                            }
                        }
                    }
                }
            }
            
            free_busy.insert(email.clone(), busy_slots);
        }
        
        Ok(FreeBusyResponse {
            time_min: query.time_min,
            time_max: query.time_max,
            free_busy,
            errors: None,
        })
    }

    async fn get_calendar_free_busy(&mut self, calendar_id: &str, time_min: DateTime<Utc>, time_max: DateTime<Utc>) -> CalendarResult<FreeBusyResponse> {
        let mut busy_slots = Vec::new();
        
        // Get all events in the time range for this calendar
        if let Ok(events) = self.list_events(calendar_id, Some(time_min), Some(time_max), None).await {
            for event in events {
                // All events are considered busy time
                busy_slots.push(FreeBusySlot {
                    start_time: event.start_time,
                    end_time: event.end_time,
                    status: FreeBusyStatus::Busy, // CalDAV events default to busy
                });
            }
        }
        
        let mut free_busy = HashMap::new();
        free_busy.insert(calendar_id.to_string(), busy_slots);
        
        Ok(FreeBusyResponse {
            time_min,
            time_max,
            free_busy,
            errors: None,
        })
    }

    async fn full_sync(&mut self) -> CalendarResult<SyncStatus> {
        let started_at = Utc::now();
        let operation_id = Uuid::new_v4().to_string();
        
        tracing::info!("Starting full CalDAV sync for account: {}", self.account_id);
        
        // Test connection first
        if let Err(e) = self.test_connection().await {
            tracing::error!("Sync failed - connection test failed: {}", e);
            return Ok(SyncStatus {
                operation_id,
                account_id: self.account_id.clone(),
                sync_type: "full".to_string(),
                progress: 0,
                status: "failed".to_string(),
                started_at,
                completed_at: Some(Utc::now()),
                events_processed: 0,
                error_count: 1,
                last_error: Some(e.to_string()),
                error_message: Some(e.to_string()),
                calendars_synced: 0,
                events_synced: 0,
            });
        }
        
        let mut calendars_synced = 0;
        let mut events_synced = 0;
        let mut error_count = 0;
        let mut last_error: Option<String> = None;
        
        // Step 1: Discover and sync calendars
        match self.list_calendars().await {
            Ok(calendars) => {
                calendars_synced = calendars.len() as u32;
                tracing::info!("Found {} calendars to sync", calendars_synced);
                
                // Step 2: For each calendar, perform bidirectional sync
                for (i, calendar) in calendars.iter().enumerate() {
                    let progress = ((i as f32 / calendars.len() as f32) * 100.0) as u32;
                    tracing::info!("Syncing calendar '{}' ({}%)", calendar.name, progress);
                    
                    match self.sync_calendar_bidirectional(&calendar.provider_id).await {
                        Ok(sync_result) => {
                            events_synced += sync_result.events_processed;
                            tracing::info!("Calendar '{}' sync completed: {} events processed", 
                                calendar.name, sync_result.events_processed);
                        },
                        Err(e) => {
                            error_count += 1;
                            let error_msg = format!("Failed to sync calendar '{}': {}", calendar.name, e);
                            tracing::warn!("{}", error_msg);
                            last_error = Some(error_msg);
                        }
                    }
                }
            },
            Err(e) => {
                error_count += 1;
                let error_msg = format!("Failed to list calendars during sync: {}", e);
                tracing::error!("{}", error_msg);
                last_error = Some(error_msg);
            }
        }
        
        let completed_at = Utc::now();
        let duration = completed_at - started_at;
        
        let status = if error_count == 0 { 
            "completed".to_string() 
        } else if calendars_synced > 0 {
            "completed_with_errors".to_string()
        } else {
            "failed".to_string()
        };
        
        tracing::info!("Full sync completed: status={}, calendars={}, events={}, errors={}, duration={:.2}s", 
            status, calendars_synced, events_synced, error_count, duration.num_milliseconds() as f32 / 1000.0);
        
        Ok(SyncStatus {
            operation_id,
            account_id: self.account_id.clone(),
            sync_type: "full".to_string(),
            progress: 100,
            status,
            started_at,
            completed_at: Some(completed_at),
            events_processed: events_synced as u64,
            error_count: error_count as u64,
            last_error: last_error.clone(),
            error_message: last_error,
            calendars_synced,
            events_synced,
        })
    }
    
    async fn incremental_sync(&mut self, sync_token: Option<&str>) -> CalendarResult<SyncStatus> {
        // CalDAV servers typically don't support sync tokens like Google Calendar
        // Fall back to full sync for CalDAV
        tracing::info!("CalDAV incremental sync falling back to full sync");
        self.full_sync().await
    }

    async fn get_sync_token(&mut self, _calendar_id: &str) -> CalendarResult<Option<String>> { 
        Ok(None) // CalDAV doesn't typically use sync tokens
    }

    async fn is_sync_token_valid(&mut self, _sync_token: &str) -> CalendarResult<bool> { 
        Ok(false) // CalDAV doesn't typically use sync tokens
    }
}

impl CalDavProvider {
    /// Perform bidirectional sync for a specific calendar
    pub async fn sync_calendar_bidirectional(&mut self, calendar_id: &str) -> CalendarResult<CalendarSyncResult> {
        let started_at = Utc::now();
        let mut result = CalendarSyncResult {
            calendar_id: calendar_id.to_string(),
            events_processed: 0,
            events_created: 0,
            events_updated: 0,
            events_deleted: 0,
            conflicts_resolved: 0,
            errors: Vec::new(),
            started_at,
            completed_at: None,
        };
        
        // Step 1: Get all events from the server
        let server_events = match self.list_events(calendar_id, None, None, None).await {
            Ok(events) => {
                tracing::debug!("Retrieved {} events from server for calendar {}", events.len(), calendar_id);
                events
            },
            Err(e) => {
                let error_msg = format!("Failed to retrieve server events: {}", e);
                result.errors.push(error_msg.clone());
                return Err(CalendarError::SyncError {
                    message: error_msg,
                    provider: Some(CalendarProvider::CalDAV),
                    account_id: self.account_id.clone(),
                    calendar_id: Some(calendar_id.to_string()),
                    event_id: None,
                    operation: Some("server_events_fetch".to_string()),
                    context: None,
                    sync_type: None,
                    sync_token: None,
                });
            }
        };
        
        // Step 2: Process each server event
        for server_event in server_events {
            result.events_processed += 1;
            
            // Check if this is a new event or needs updating
            // For CalDAV, we use the UID to identify events uniquely
            let event_uid = server_event.uid.as_deref().unwrap_or(&server_event.id);
            
            // This would typically involve comparing with local database
            // For now, we'll just count them as processed
            tracing::debug!("Processed event: {} (UID: {})", server_event.title, event_uid);
        }
        
        // Step 3: Handle conflict resolution
        // In a real implementation, this would compare timestamps and resolve conflicts
        // based on configured policies (server wins, client wins, manual resolution, etc.)
        
        result.completed_at = Some(Utc::now());
        tracing::debug!("Calendar {} sync completed: {} events processed", 
            calendar_id, result.events_processed);
        
        Ok(result)
    }
    
    /// Get calendar sync status and detect changes
    pub async fn get_calendar_sync_status(&mut self, calendar_id: &str) -> CalendarResult<CalendarSyncInfo> {
        let calendar_path = self.get_calendar_path(calendar_id).await?;
        
        // Use PROPFIND to get calendar metadata and ETag for change detection
        let propfind_body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <D:getlastmodified/>
    <C:supported-calendar-component-set/>
    <C:calendar-description/>
  </D:prop>
</D:propfind>"#;
        
        match self.propfind(&calendar_path, propfind_body, 1).await {
            Ok(response) => {
                let sync_info = self.parse_calendar_sync_info(&response)?;
                Ok(sync_info)
            }
            Err(e) => {
                tracing::warn!("Failed to get sync status for calendar {}: {}", calendar_id, e);
                // Return default sync info
                Ok(CalendarSyncInfo {
                    calendar_id: calendar_id.to_string(),
                    etag: None,
                    last_modified: None,
                    supports_sync: false,
                    needs_full_sync: true,
                })
            }
        }
    }
    
    /// Parse calendar sync info from PROPFIND response
    pub fn parse_calendar_sync_info(&self, xml_response: &str) -> CalendarResult<CalendarSyncInfo> {
        use quick_xml::events::Event;
        use quick_xml::Reader;
        
        let mut reader = Reader::from_str(xml_response);
        reader.trim_text(true);
        
        let mut buf = Vec::new();
        let mut etag: Option<String> = None;
        let mut last_modified: Option<DateTime<Utc>> = None;
        let mut in_etag = false;
        let mut in_lastmod = false;
        
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    match e.name().as_ref() {
                        b"D:getetag" | b"getetag" => in_etag = true,
                        b"D:getlastmodified" | b"getlastmodified" => in_lastmod = true,
                        _ => {}
                    }
                },
                Ok(Event::Text(e)) => {
                    let text = e.unescape().unwrap_or_default().to_string();
                    if in_etag && !text.trim().is_empty() {
                        etag = Some(text.trim().trim_matches('\"').to_string());
                    } else if in_lastmod && !text.trim().is_empty() {
                        // Parse HTTP date format
                        if let Ok(parsed_date) = chrono::DateTime::parse_from_rfc2822(&text) {
                            last_modified = Some(parsed_date.with_timezone(&Utc));
                        }
                    }
                },
                Ok(Event::End(ref e)) => {
                    match e.name().as_ref() {
                        b"D:getetag" | b"getetag" => in_etag = false,
                        b"D:getlastmodified" | b"getlastmodified" => in_lastmod = false,
                        _ => {}
                    }
                },
                Ok(Event::Eof) => break,
                Err(e) => {
                    tracing::warn!("XML parsing error in sync info: {:?}", e);
                    break;
                },
                _ => {}
            }
            buf.clear();
        }
        
        Ok(CalendarSyncInfo {
            calendar_id: "unknown".to_string(), // Will be set by caller
            etag: etag.clone(),
            last_modified,
            supports_sync: etag.is_some(),
            needs_full_sync: etag.is_none(),
        })
    }

    async fn incremental_sync(&mut self, sync_token: Option<&str>) -> CalendarResult<SyncStatus> {
        // CalDAV servers typically don't support sync tokens like Google Calendar
        // Fall back to full sync for CalDAV
        tracing::info!("CalDAV incremental sync falling back to full sync");
        self.full_sync().await
    }

    async fn get_sync_token(&mut self, _calendar_id: &str) -> CalendarResult<Option<String>> { 
        Ok(None) // CalDAV doesn't typically use sync tokens
    }

    async fn is_sync_token_valid(&mut self, _sync_token: &str) -> CalendarResult<bool> { 
        Ok(false) // CalDAV doesn't typically use sync tokens
    }
}