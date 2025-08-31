use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub name: String,
    pub display_name: String,
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_security: SecurityType,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: SecurityType,
    pub auth_methods: Vec<AuthMethod>,
    pub oauth_config: Option<OAuthConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityType {
    None,
    Tls,
    StartTls,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthMethod {
    Plain,
    Login,
    OAuth2,
    XOAuth2,
    AppPassword,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub scopes: Vec<String>,
    pub auth_url: String,
    pub token_url: String,
}

pub fn get_predefined_configs() -> HashMap<String, ServerConfig> {
    let mut configs = HashMap::new();

    // Gmail configuration
    configs.insert("gmail".to_string(), ServerConfig {
        name: "gmail".to_string(),
        display_name: "Gmail".to_string(),
        imap_host: "imap.gmail.com".to_string(),
        imap_port: 993,
        imap_security: SecurityType::Tls,
        smtp_host: "smtp.gmail.com".to_string(),
        smtp_port: 587,
        smtp_security: SecurityType::StartTls,
        auth_methods: vec![AuthMethod::OAuth2, AuthMethod::AppPassword],
        oauth_config: Some(OAuthConfig {
            client_id: "".to_string(), // To be configured
            scopes: vec![
                "https://mail.google.com/".to_string()
            ],
            auth_url: "https://accounts.google.com/o/oauth2/auth".to_string(),
            token_url: "https://oauth2.googleapis.com/token".to_string(),
        }),
    });

    // Outlook/Hotmail configuration
    configs.insert("outlook".to_string(), ServerConfig {
        name: "outlook".to_string(),
        display_name: "Outlook / Hotmail".to_string(),
        imap_host: "outlook.office365.com".to_string(),
        imap_port: 993,
        imap_security: SecurityType::Tls,
        smtp_host: "smtp-mail.outlook.com".to_string(),
        smtp_port: 587,
        smtp_security: SecurityType::StartTls,
        auth_methods: vec![AuthMethod::OAuth2, AuthMethod::Plain],
        oauth_config: Some(OAuthConfig {
            client_id: "".to_string(), // To be configured
            scopes: vec![
                "https://graph.microsoft.com/IMAP.AccessAsUser.All".to_string(),
                "https://graph.microsoft.com/SMTP.Send".to_string(),
            ],
            auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string(),
            token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string(),
        }),
    });

    // Yahoo Mail configuration
    configs.insert("yahoo".to_string(), ServerConfig {
        name: "yahoo".to_string(),
        display_name: "Yahoo Mail".to_string(),
        imap_host: "imap.mail.yahoo.com".to_string(),
        imap_port: 993,
        imap_security: SecurityType::Tls,
        smtp_host: "smtp.mail.yahoo.com".to_string(),
        smtp_port: 587,
        smtp_security: SecurityType::StartTls,
        auth_methods: vec![AuthMethod::AppPassword],
        oauth_config: None,
    });

    // ProtonMail configuration (via Bridge)
    configs.insert("protonmail".to_string(), ServerConfig {
        name: "protonmail".to_string(),
        display_name: "ProtonMail (Bridge Required)".to_string(),
        imap_host: "127.0.0.1".to_string(),
        imap_port: 1143,
        imap_security: SecurityType::StartTls,
        smtp_host: "127.0.0.1".to_string(),
        smtp_port: 1025,
        smtp_security: SecurityType::StartTls,
        auth_methods: vec![AuthMethod::Plain],
        oauth_config: None,
    });

    // FastMail configuration
    configs.insert("fastmail".to_string(), ServerConfig {
        name: "fastmail".to_string(),
        display_name: "FastMail".to_string(),
        imap_host: "imap.fastmail.com".to_string(),
        imap_port: 993,
        imap_security: SecurityType::Tls,
        smtp_host: "smtp.fastmail.com".to_string(),
        smtp_port: 587,
        smtp_security: SecurityType::StartTls,
        auth_methods: vec![AuthMethod::Plain, AuthMethod::Login],
        oauth_config: None,
    });

    // iCloud Mail configuration  
    configs.insert("icloud".to_string(), ServerConfig {
        name: "icloud".to_string(),
        display_name: "iCloud Mail".to_string(),
        imap_host: "imap.mail.me.com".to_string(),
        imap_port: 993,
        imap_security: SecurityType::Tls,
        smtp_host: "smtp.mail.me.com".to_string(),
        smtp_port: 587,
        smtp_security: SecurityType::StartTls,
        auth_methods: vec![AuthMethod::AppPassword],
        oauth_config: None,
    });

    // Generic IMAP configuration template
    configs.insert("custom".to_string(), ServerConfig {
        name: "custom".to_string(),
        display_name: "Custom IMAP Server".to_string(),
        imap_host: "".to_string(),
        imap_port: 993,
        imap_security: SecurityType::Tls,
        smtp_host: "".to_string(),
        smtp_port: 587,
        smtp_security: SecurityType::StartTls,
        auth_methods: vec![AuthMethod::Plain, AuthMethod::Login],
        oauth_config: None,
    });

    configs
}

pub fn get_config_by_domain(email: &str) -> Option<ServerConfig> {
    let domain = email.split('@').nth(1)?;
    
    let configs = get_predefined_configs();
    
    match domain.to_lowercase().as_str() {
        "gmail.com" | "googlemail.com" => configs.get("gmail").cloned(),
        "outlook.com" | "hotmail.com" | "live.com" | "msn.com" => configs.get("outlook").cloned(),
        "yahoo.com" | "yahoo.co.uk" | "yahoo.fr" => configs.get("yahoo").cloned(),
        "protonmail.com" | "protonmail.ch" | "pm.me" => configs.get("protonmail").cloned(),
        "fastmail.com" | "fastmail.fm" => configs.get("fastmail").cloned(),
        "icloud.com" | "me.com" | "mac.com" => configs.get("icloud").cloned(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_predefined_configs() {
        let configs = get_predefined_configs();
        assert!(configs.contains_key("gmail"));
        assert!(configs.contains_key("outlook"));
        assert!(configs.contains_key("yahoo"));
    }

    #[test]
    fn test_domain_detection() {
        assert!(get_config_by_domain("user@gmail.com").is_some());
        assert!(get_config_by_domain("user@outlook.com").is_some());
        assert!(get_config_by_domain("user@unknown-provider.com").is_none());
    }
}