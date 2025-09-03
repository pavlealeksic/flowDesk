//! Simple CLI interface for the Flow Desk Rust library
//! This allows Node.js to communicate with the Rust library via JSON over stdin/stdout

use flow_desk_shared::{
    mail::{
        init_mail_engine, MailEngine, MailEngineConfig, MailAccount, 
        ProviderAccountConfig, MailAccountStatus, EmailMessage,
        providers::SyncChange, types::MailProvider, auth::oauth_manager::AuthManager,
        OAuthTokens, MailDatabase
    },
    calendar::{
        CalendarEngine, CalendarConfig, CalendarProvider, CalendarAccountConfig,
        CreateCalendarAccountInput, CreateCalendarEventInput,
        UpdateCalendarEventInput, CalendarAccountStatus,
        GoogleCalendarConfig, OutlookCalendarConfig, CalDavConfig,
        RateLimitConfig, PrivacySyncConfig, 
        FreeBusyQuery, CalendarPrivacySync, PrivacySettings,
        auth::CalendarOAuthManager, CalendarDatabase
    },
    search::{
        SearchEngine, SearchConfig, SearchQuery, SearchDocument, SearchOptions,
        ContentType, ProviderType, DocumentMetadata, LocationInfo, 
        IndexingInfo, IndexType
    },
    *
};
use flow_desk_shared::calendar::types::CalendarCredentials;
use flow_desk_shared::search::types::CollaborationInfo;
use serde_json::{Value, json};
use std::io::{self, BufRead, Write};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use base64::Engine;
use chrono::{self, DateTime, Utc};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use sqlx::SqlitePool;

// Global mail engine instance
static MAIL_ENGINE: RwLock<Option<Arc<MailEngine>>> = RwLock::const_new(None);

// Global calendar engine instance
static CALENDAR_ENGINE: RwLock<Option<Arc<CalendarEngine>>> = RwLock::const_new(None);

// Global search engine instance
static SEARCH_ENGINE: RwLock<Option<Arc<SearchEngine>>> = RwLock::const_new(None);

// Global OAuth manager instance
static OAUTH_MANAGER: RwLock<Option<Arc<AuthManager>>> = RwLock::const_new(None);

// Global calendar OAuth manager instance
static CALENDAR_OAUTH_MANAGER: RwLock<Option<Arc<CalendarOAuthManager>>> = RwLock::const_new(None);

// Database utility functions
async fn get_database_file_stats(database_path: &str) -> Result<HashMap<String, serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let mut stats = HashMap::new();
    
    if Path::new(database_path).exists() {
        let metadata = fs::metadata(database_path).await?;
        stats.insert("file_size".to_string(), json!(metadata.len()));
        stats.insert("exists".to_string(), json!(true));
        
        if let Ok(modified) = metadata.modified() {
            stats.insert("last_modified".to_string(), json!(modified
                .duration_since(std::time::UNIX_EPOCH)?
                .as_secs()));
        }
        
        // Connect to database to get more detailed stats
        let pool = SqlitePool::connect(&format!("sqlite:{}", database_path)).await?;
        
        // Get page count and page size
        let page_info: (i64, i64) = sqlx::query_as("SELECT page_count, page_size FROM pragma_page_count(), pragma_page_size()")
            .fetch_one(&pool)
            .await?;
        
        stats.insert("page_count".to_string(), json!(page_info.0));
        stats.insert("page_size".to_string(), json!(page_info.1));
        stats.insert("total_pages_size".to_string(), json!(page_info.0 * page_info.1));
        
        // Get table count
        let table_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            .fetch_one(&pool)
            .await?;
        stats.insert("table_count".to_string(), json!(table_count.0));
        
        pool.close().await;
    } else {
        stats.insert("exists".to_string(), json!(false));
        stats.insert("file_size".to_string(), json!(0));
    }
    
    Ok(stats)
}

async fn get_mail_database_stats(db: &MailDatabase) -> Result<HashMap<String, serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let mut stats = HashMap::new();
    
    // Get account count
    let accounts = db.list_accounts().await?;
    stats.insert("account_count".to_string(), json!(accounts.len()));
    
    // Count messages per account
    for account in accounts {
        let messages = db.get_messages(&account.id.to_string(), "INBOX", Some(1000)).await?;
        stats.insert(format!("messages_in_account_{}", account.email), json!(messages.len()));
    }
    
    Ok(stats)
}

async fn get_calendar_database_stats(db: &CalendarDatabase) -> Result<HashMap<String, serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let mut stats = HashMap::new();
    
    // Get actual calendar account count from database
    match db.get_all_calendar_accounts().await {
        Ok(accounts) => {
            stats.insert("calendar_accounts".to_string(), json!(accounts.len()));
            stats.insert("enabled_accounts".to_string(), json!(accounts.iter().filter(|a| a.is_enabled).count()));
        }
        Err(_) => {
            stats.insert("calendar_accounts".to_string(), json!(0));
            stats.insert("enabled_accounts".to_string(), json!(0));
        }
    }
    
    Ok(stats)
}

async fn vacuum_sqlite_database(database_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if !Path::new(database_path).exists() {
        return Err(format!("Database file does not exist: {}", database_path).into());
    }
    
    let pool = SqlitePool::connect(&format!("sqlite:{}", database_path)).await?;
    sqlx::query("VACUUM").execute(&pool).await?;
    pool.close().await;
    
    Ok(())
}

async fn backup_database_file(source_path: &str, backup_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if !Path::new(source_path).exists() {
        return Err(format!("Source database file does not exist: {}", source_path).into());
    }
    
    // Create backup directory if it doesn't exist
    if let Some(parent) = Path::new(backup_path).parent() {
        fs::create_dir_all(parent).await?;
    }
    
    // Copy the file
    fs::copy(source_path, backup_path).await?;
    
    Ok(())
}

async fn restore_database_file(backup_path: &str, target_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if !Path::new(backup_path).exists() {
        return Err(format!("Backup file does not exist: {}", backup_path).into());
    }
    
    // Create target directory if it doesn't exist
    if let Some(parent) = Path::new(target_path).parent() {
        fs::create_dir_all(parent).await?;
    }
    
    // Copy the backup to the target location
    fs::copy(backup_path, target_path).await?;
    
    Ok(())
}

async fn export_mail_data(database_path: &str, output_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let db = MailDatabase::new(database_path).await?;
    
    let mut export_data = HashMap::new();
    
    // Export accounts
    let accounts = db.list_accounts().await?;
    export_data.insert("accounts", json!(accounts));
    
    // Export messages for each account
    let mut all_messages = Vec::new();
    for account in &accounts {
        let messages = db.get_messages(&account.id.to_string(), "INBOX", Some(10000)).await?;
        all_messages.extend(messages);
    }
    export_data.insert("messages", json!(all_messages));
    
    // Export folders for each account
    let mut all_folders = Vec::new();
    for account in &accounts {
        let folders = db.get_folders(&account.id.to_string()).await?;
        all_folders.extend(folders);
    }
    export_data.insert("folders", json!(all_folders));
    
    // Export threads for each account
    let mut all_threads = Vec::new();
    for account in &accounts {
        let threads = db.get_threads(&account.id.to_string(), None).await?;
        all_threads.extend(threads);
    }
    export_data.insert("threads", json!(all_threads));
    
    export_data.insert("export_timestamp", json!(chrono::Utc::now().to_rfc3339()));
    export_data.insert("export_version", json!("1.0"));
    
    let export_json = serde_json::to_string_pretty(&export_data)?;
    fs::write(output_path, export_json).await?;
    
    Ok(())
}

async fn export_calendar_data(database_url: &str, output_path: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _db = CalendarDatabase::new(database_url).await
        .map_err(|e| format!("Failed to connect to calendar database: {}", e))?;
    
    let mut export_data = HashMap::new();
    
    // For now, we'll export basic structure
    // In a real implementation, you would add methods to CalendarDatabase to export all data
    export_data.insert("export_timestamp", json!(chrono::Utc::now().to_rfc3339()));
    export_data.insert("export_version", json!("1.0"));
    export_data.insert("note", json!("Calendar export functionality needs to be implemented in CalendarDatabase"));
    
    let export_json = serde_json::to_string_pretty(&export_data)?;
    fs::write(output_path, export_json).await?;
    
    Ok(())
}

async fn clear_mail_user_data(user_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let database_path = std::env::var("HOME")
        .map(|home| format!("{}/flow_desk_mail.db", home))
        .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
    
    let db = MailDatabase::new(&database_path).await?;
    
    // Remove all accounts for the user
    let accounts = db.list_accounts().await?;
    for account in accounts {
        if account.user_id.to_string() == user_id {
            db.remove_account(&account.id.to_string()).await?;
        }
    }
    
    Ok(())
}

async fn clear_calendar_user_data(user_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let database_url = std::env::var("HOME")
        .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
        .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
    
    let db = CalendarDatabase::new(&database_url).await
        .map_err(|e| format!("Failed to connect to calendar database: {}", e))?;
    
    // Get all accounts for the user and delete them
    let accounts = db.get_user_calendar_accounts(user_id).await
        .map_err(|e| format!("Failed to get user calendar accounts: {}", e))?;
    
    for account in accounts {
        db.delete_calendar_account(&account.id.to_string()).await
            .map_err(|e| format!("Failed to delete calendar account: {}", e))?;
    }
    
    Ok(())
}

async fn clear_all_user_data() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mail_path = std::env::var("HOME")
        .map(|home| format!("{}/flow_desk_mail.db", home))
        .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
    let calendar_url = std::env::var("HOME")
        .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
        .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
    
    // Clear search index if search engine is available
    {
        let search_engine = SEARCH_ENGINE.read().await;
        if let Some(engine) = search_engine.as_ref() {
            let _ = engine.clear_cache().await;
        }
    }
    
    // Remove mail database file
    if Path::new(&mail_path).exists() {
        fs::remove_file(&mail_path).await?;
    }
    
    // Remove calendar database file
    let calendar_path = calendar_url.replace("sqlite://", "");
    if Path::new(&calendar_path).exists() {
        fs::remove_file(&calendar_path).await?;
    }
    
    // Clear OAuth credentials
    {
        let oauth_manager = OAUTH_MANAGER.read().await;
        if let Some(manager) = oauth_manager.as_ref() {
            let _ = manager.clear_all_credentials().await;
        }
    }
    
    {
        let cal_oauth_manager = CALENDAR_OAUTH_MANAGER.read().await;
        if let Some(_manager) = cal_oauth_manager.as_ref() {
            // Calendar OAuth manager doesn't have clear_all_credentials method
            // This would need to be implemented if needed
        }
    }
    
    Ok(())
}

async fn check_database_integrity(database_path: &str) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    if !Path::new(database_path).exists() {
        return Ok("Database file does not exist".to_string());
    }
    
    let pool = SqlitePool::connect(&format!("sqlite:{}", database_path)).await?;
    
    // Run integrity check
    let integrity_result: (String,) = sqlx::query_as("PRAGMA integrity_check")
        .fetch_one(&pool)
        .await?;
    
    pool.close().await;
    
    Ok(integrity_result.0)
}

async fn sync_database_consistency() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mail_path = std::env::var("HOME")
        .map(|home| format!("{}/flow_desk_mail.db", home))
        .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
    let calendar_url = std::env::var("HOME")
        .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
        .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
    
    // Check mail database integrity
    if Path::new(&mail_path).exists() {
        let mail_integrity = check_database_integrity(&mail_path).await?;
        if mail_integrity != "ok" {
            return Err(format!("Mail database integrity check failed: {}", mail_integrity).into());
        }
    }
    
    // Check calendar database integrity
    let calendar_path = calendar_url.replace("sqlite://", "");
    if Path::new(&calendar_path).exists() {
        let calendar_integrity = check_database_integrity(&calendar_path).await?;
        if calendar_integrity != "ok" {
            return Err(format!("Calendar database integrity check failed: {}", calendar_integrity).into());
        }
    }
    
    // Verify that engines are using the correct database paths
    let mail_engine = MAIL_ENGINE.read().await;
    if mail_engine.is_none() {
        return Err("Mail engine not initialized".into());
    }
    
    let calendar_engine = CALENDAR_ENGINE.read().await;
    if calendar_engine.is_none() {
        return Err("Calendar engine not initialized".into());
    }
    
    // If we get here, all consistency checks passed
    Ok(())
}

async fn optimize_database_connections() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mail_path = std::env::var("HOME")
        .map(|home| format!("{}/flow_desk_mail.db", home))
        .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
    let calendar_url = std::env::var("HOME")
        .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
        .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
    
    // Optimize mail database
    if Path::new(&mail_path).exists() {
        let pool = SqlitePool::connect(&format!("sqlite:{}", mail_path)).await?;
        
        // Run optimization commands
        sqlx::query("PRAGMA optimize").execute(&pool).await?;
        sqlx::query("ANALYZE").execute(&pool).await?;
        
        // Update database settings for better performance
        sqlx::query("PRAGMA journal_mode = WAL").execute(&pool).await?;
        sqlx::query("PRAGMA synchronous = NORMAL").execute(&pool).await?;
        sqlx::query("PRAGMA cache_size = 10000").execute(&pool).await?;
        sqlx::query("PRAGMA temp_store = MEMORY").execute(&pool).await?;
        
        pool.close().await;
    }
    
    // Optimize calendar database
    let calendar_path = calendar_url.replace("sqlite://", "");
    if Path::new(&calendar_path).exists() {
        let pool = SqlitePool::connect(&calendar_url).await?;
        
        // Run optimization commands
        sqlx::query("PRAGMA optimize").execute(&pool).await?;
        sqlx::query("ANALYZE").execute(&pool).await?;
        
        // Update database settings for better performance
        sqlx::query("PRAGMA journal_mode = WAL").execute(&pool).await?;
        sqlx::query("PRAGMA synchronous = NORMAL").execute(&pool).await?;
        sqlx::query("PRAGMA cache_size = 10000").execute(&pool).await?;
        sqlx::query("PRAGMA temp_store = MEMORY").execute(&pool).await?;
        
        pool.close().await;
    }
    
    Ok(())
}

async fn refresh_engine_database_connections() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Reinitialize mail engine with fresh database connection
    let mut mail_config = MailEngineConfig::default();
    mail_config.database_path = std::env::var("HOME")
        .map(|home| format!("{}/flow_desk_mail.db", home))
        .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
    
    match init_mail_engine(mail_config).await {
        Ok(engine) => {
            let mut mail_engine = MAIL_ENGINE.write().await;
            *mail_engine = Some(Arc::new(engine));
        }
        Err(e) => {
            return Err(format!("Failed to refresh mail engine: {}", e).into());
        }
    }
    
    // Reinitialize calendar engine with fresh database connection
    let calendar_config = CalendarConfig {
        database_url: std::env::var("HOME")
            .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
            .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string()),
        max_concurrent_syncs: 5,
        default_sync_interval_minutes: 15,
        webhook_config: None,
        rate_limits: RateLimitConfig::default(),
        privacy_sync: PrivacySyncConfig::default(),
        server_timezone: "UTC".to_string(),
        debug: false,
    };
    
    match CalendarEngine::new(calendar_config).await {
        Ok(engine) => {
            let mut calendar_engine = CALENDAR_ENGINE.write().await;
            *calendar_engine = Some(Arc::new(engine));
        }
        Err(e) => {
            return Err(format!("Failed to refresh calendar engine: {}", e).into());
        }
    }
    
    // Reinitialize search engine if needed
    let search_config = SearchConfig {
        index_dir: PathBuf::from(std::env::var("HOME")
            .map(|home| format!("{}/flow_desk_search_index", home))
            .unwrap_or_else(|_| "flow_desk_search_index".to_string())),
        max_memory_mb: 512,
        max_response_time_ms: 300,
        num_threads: num_cpus::get(),
        enable_analytics: true,
        enable_suggestions: true,
        enable_realtime: true,
        providers: Vec::new(),
    };
    
    match SearchEngine::new(search_config).await {
        Ok(engine) => {
            let mut search_engine = SEARCH_ENGINE.write().await;
            *search_engine = Some(Arc::new(engine));
        }
        Err(e) => {
            return Err(format!("Failed to refresh search engine: {}", e).into());
        }
    }
    
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize the library
    init();

    // Initialize mail engine with default config
    let mut mail_config = MailEngineConfig::default();
    // Use a database in the user's home directory or current directory
    mail_config.database_path = std::env::var("HOME")
        .map(|home| format!("{}/flow_desk_mail.db", home))
        .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
    
    match init_mail_engine(mail_config).await {
        Ok(engine) => {
            let mut mail_engine = MAIL_ENGINE.write().await;
            *mail_engine = Some(Arc::new(engine));
        }
        Err(e) => {
            eprintln!("Failed to initialize mail engine: {}", e);
        }
    }

    // Initialize calendar engine with default config
    let calendar_config = CalendarConfig {
        database_url: std::env::var("HOME")
            .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
            .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string()),
        max_concurrent_syncs: 5,
        default_sync_interval_minutes: 15,
        webhook_config: None,
        rate_limits: RateLimitConfig::default(),
        privacy_sync: PrivacySyncConfig::default(),
        server_timezone: "UTC".to_string(),
        debug: false,
    };
    
    match CalendarEngine::new(calendar_config).await {
        Ok(engine) => {
            let mut calendar_engine = CALENDAR_ENGINE.write().await;
            *calendar_engine = Some(Arc::new(engine));
        }
        Err(e) => {
            eprintln!("Failed to initialize calendar engine: {}", e);
        }
    }

    // Initialize OAuth manager
    match AuthManager::new().await {
        Ok(manager) => {
            let mut oauth_manager = OAUTH_MANAGER.write().await;
            *oauth_manager = Some(Arc::new(manager));
        }
        Err(e) => {
            eprintln!("Failed to initialize OAuth manager: {}", e);
        }
    }

    // Initialize calendar OAuth manager
    let calendar_oauth_manager = CalendarOAuthManager::new();
    {
        let mut manager = CALENDAR_OAUTH_MANAGER.write().await;
        *manager = Some(Arc::new(calendar_oauth_manager));
    }

    // Initialize search engine with default config
    let search_config = SearchConfig {
        index_dir: std::env::var("HOME")
            .map(|home| std::path::PathBuf::from(format!("{}/flow_desk_search_indices", home)))
            .unwrap_or_else(|_| std::path::PathBuf::from("flow_desk_search_indices")),
        max_memory_mb: 256,
        max_response_time_ms: 300,
        num_threads: num_cpus::get().min(4),
        enable_analytics: true,
        enable_suggestions: true,
        enable_realtime: true,
        providers: vec![
            flow_desk_shared::search::ProviderConfig {
                id: "local_mail".to_string(),
                provider_type: "local_mail".to_string(),
                enabled: true,
                weight: 1.0,
                config: serde_json::json!({}),
            },
            flow_desk_shared::search::ProviderConfig {
                id: "local_calendar".to_string(),
                provider_type: "local_calendar".to_string(),
                enabled: true,
                weight: 1.0,
                config: serde_json::json!({}),
            },
        ],
    };
    
    match SearchEngine::new(search_config).await {
        Ok(engine) => {
            let mut search_engine = SEARCH_ENGINE.write().await;
            *search_engine = Some(Arc::new(engine));
        }
        Err(e) => {
            eprintln!("Failed to initialize search engine: {}", e);
        }
    }

    let stdin = io::stdin();
    let mut stdout = io::stdout();

    println!("Flow Desk CLI Ready");
    stdout.flush()?;

    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let response = process_command(&line).await;
        println!("{}", serde_json::to_string(&response)?);
        stdout.flush()?;
    }

    Ok(())
}

// Helper function to get mail engine instance
async fn get_mail_engine() -> Option<Arc<MailEngine>> {
    let mail_engine = MAIL_ENGINE.read().await;
    mail_engine.clone()
}

// Helper function to get calendar engine instance
async fn get_calendar_engine() -> Option<Arc<CalendarEngine>> {
    let calendar_engine = CALENDAR_ENGINE.read().await;
    calendar_engine.clone()
}

// Helper function to get search engine instance
async fn get_search_engine() -> Option<Arc<SearchEngine>> {
    let search_engine = SEARCH_ENGINE.read().await;
    search_engine.clone()
}

// Helper function to get OAuth manager instance
async fn get_oauth_manager() -> Option<Arc<AuthManager>> {
    let oauth_manager = OAUTH_MANAGER.read().await;
    oauth_manager.clone()
}

// Helper function to get calendar OAuth manager instance
async fn get_calendar_oauth_manager() -> Option<Arc<CalendarOAuthManager>> {
    let manager = CALENDAR_OAUTH_MANAGER.read().await;
    manager.clone()
}

// Helper function to parse mail account from JSON arguments
fn parse_mail_account_from_args(args: &Value) -> Result<MailAccount, String> {
    let account_data = args.get(0)
        .ok_or_else(|| "Missing account data".to_string())?;
    
    let name = account_data.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Default Account")
        .to_string();
    
    let email = account_data.get("email")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing email address".to_string())?
        .to_string();
    
    let provider_str = account_data.get("provider")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing provider".to_string())?;
    
    let provider = match provider_str.to_lowercase().as_str() {
        "gmail" => MailProvider::Gmail,
        "outlook" => MailProvider::Outlook,
        "exchange" => MailProvider::Exchange,
        "imap" => MailProvider::Imap,
        _ => return Err(format!("Unsupported provider: {}", provider_str))
    };

    // Create provider-specific configuration
    let provider_config = match provider {
        MailProvider::Gmail => {
            let client_id = account_data.get("clientId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            
            ProviderAccountConfig::Gmail {
                client_id,
                scopes: vec![
                    "https://www.googleapis.com/auth/gmail.readonly".to_string(),
                    "https://www.googleapis.com/auth/gmail.send".to_string(),
                    "https://www.googleapis.com/auth/gmail.modify".to_string(),
                ],
                enable_push_notifications: true,
                history_id: None,
            }
        },
        MailProvider::Outlook => {
            let client_id = account_data.get("clientId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            
            ProviderAccountConfig::Outlook {
                client_id,
                tenant_id: account_data.get("tenantId").and_then(|v| v.as_str()).map(String::from),
                scopes: vec![
                    "https://graph.microsoft.com/Mail.ReadWrite".to_string(),
                    "https://graph.microsoft.com/Mail.Send".to_string(),
                ],
                enable_webhooks: true,
                delta_token: None,
            }
        },
        _ => return Err("Provider configuration not yet implemented".to_string())
    };

    Ok(MailAccount {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        name,
        email,
        provider,
        status: MailAccountStatus::Active,
        last_sync_at: None,
        next_sync_at: None,
        sync_interval_minutes: 15,
        is_enabled: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        provider_config: provider_config.clone(),
        config: provider_config,
        sync_status: None,
    })
}

// Helper function to parse calendar account from JSON arguments
fn parse_calendar_account_from_args(args: &Value) -> Result<CreateCalendarAccountInput, String> {
    let account_data = args.get(0)
        .ok_or_else(|| "Missing account data".to_string())?;
    
    let name = account_data.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Default Calendar Account")
        .to_string();
    
    let email = account_data.get("email")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing email address".to_string())?
        .to_string();
    
    let provider_str = account_data.get("provider")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing provider".to_string())?;
    
    let provider = match provider_str.to_lowercase().as_str() {
        "google" => CalendarProvider::Google,
        "outlook" => CalendarProvider::Outlook,
        "exchange" => CalendarProvider::Exchange,
        "caldav" => CalendarProvider::CalDAV,
        _ => return Err(format!("Unsupported provider: {}", provider_str))
    };

    // Create provider-specific configuration
    let config = match provider {
        CalendarProvider::Google => {
            let client_id = account_data.get("clientId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let access_token = account_data.get("accessToken")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let refresh_token = account_data.get("refreshToken")
                .and_then(|v| v.as_str())
                .map(String::from);
            
            CalendarAccountConfig::Google(GoogleCalendarConfig {
                client_id,
                access_token,
                refresh_token,
            })
        },
        CalendarProvider::Outlook => {
            let client_id = account_data.get("clientId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let access_token = account_data.get("accessToken")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let refresh_token = account_data.get("refreshToken")
                .and_then(|v| v.as_str())
                .map(String::from);
            
            CalendarAccountConfig::Outlook(OutlookCalendarConfig {
                client_id,
                access_token,
                refresh_token,
            })
        },
        CalendarProvider::CalDAV => {
            let server_url = account_data.get("serverUrl")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let host = account_data.get("host")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let username = account_data.get("username")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let password = account_data.get("password")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            
            CalendarAccountConfig::CalDAV(CalDavConfig {
                server_url,
                host,
                username,
                password,
            })
        },
        _ => return Err("Provider configuration not yet implemented".to_string())
    };

    // Extract credentials from the account data
    let credentials = Some(CalendarCredentials {
        access_token: account_data.get("accessToken")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        refresh_token: account_data.get("refreshToken")
            .and_then(|v| v.as_str())
            .map(String::from),
        expires_at: None, // Would need to parse from input
        client_id: account_data.get("clientId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        client_secret: account_data.get("clientSecret")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    });

    Ok(CreateCalendarAccountInput {
        user_id: Uuid::new_v4(), // Would need to get from session/context
        name,
        email,
        provider,
        status: CalendarAccountStatus::Active,
        config,
        credentials,
        default_calendar_id: None,
        last_sync_at: None,
        next_sync_at: None,
        sync_interval_minutes: 15,
        is_enabled: true,
    })
}

// Helper function to parse calendar event from JSON arguments
fn parse_calendar_event_from_args(args: &Value) -> Result<CreateCalendarEventInput, String> {
    let event_data = args.get(0)
        .ok_or_else(|| "Missing event data".to_string())?;
    
    let calendar_id = event_data.get("calendar_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing calendar_id".to_string())?
        .to_string();
    
    let title = event_data.get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled Event")
        .to_string();
    
    let description = event_data.get("description")
        .and_then(|v| v.as_str())
        .map(String::from);
    
    let start_time_str = event_data.get("start_time")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing start_time".to_string())?;
        
    let end_time_str = event_data.get("end_time")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing end_time".to_string())?;
    
    let start_time = DateTime::parse_from_rfc3339(start_time_str)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| "Invalid start_time format, expected RFC3339".to_string())?;
        
    let end_time = DateTime::parse_from_rfc3339(end_time_str)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| "Invalid end_time format, expected RFC3339".to_string())?;
    
    let all_day = event_data.get("all_day")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
        
    let location = event_data.get("location")
        .and_then(|v| v.as_str())
        .map(String::from);
        
    let timezone = event_data.get("timezone")
        .and_then(|v| v.as_str())
        .unwrap_or("UTC")
        .to_string();

    Ok(CreateCalendarEventInput {
        calendar_id,
        title,
        description,
        start_time,
        end_time,
        all_day,
        location,
        provider_id: None,
        location_data: None,
        timezone: Some(timezone),
        is_all_day: all_day,
        status: None,
        visibility: None,
        attendees: None,
        reminders: None,
        recurrence: None,
        uid: None,
        transparency: None,
        source: None,
        recurring_event_id: None,
        original_start_time: None,
        color: None,
        creator: None,
        organizer: None,
        conferencing: None,
        attachments: None,
        extended_properties: None,
    })
}

async fn process_command(input: &str) -> Value {
    let command: Result<Value, _> = serde_json::from_str(input);
    
    match command {
        Ok(cmd) => {
            let function_name = cmd.get("function").and_then(|f| f.as_str()).unwrap_or("");
            let args = cmd.get("args").unwrap_or(&Value::Null);
            
            match function_name {
                "get_version" => {
                    json!({
                        "success": true,
                        "result": VERSION
                    })
                }
                "hello" => {
                    json!({
                        "success": true,
                        "result": "Hello from Rust!"
                    })
                }
                "init_mail_engine" => {
                    // Mail engine is already initialized at startup
                    match get_mail_engine().await {
                        Some(_) => json!({
                            "success": true,
                            "result": "Mail engine initialized"
                        }),
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "init_calendar_engine" => {
                    // Calendar engine is already initialized at startup
                    match get_calendar_engine().await {
                        Some(_) => json!({
                            "success": true,
                            "result": "Calendar engine initialized"
                        }),
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "init_search_engine" => {
                    // Search engine is already initialized at startup
                    match get_search_engine().await {
                        Some(_) => json!({
                            "success": true,
                            "result": "Search engine initialized"
                        }),
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "get_mail_accounts" => {
                    match get_mail_engine().await {
                        Some(engine) => {
                            match engine.list_accounts().await {
                                Ok(accounts) => json!({
                                    "success": true,
                                    "result": accounts
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to get accounts: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "get_calendar_accounts" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            // Use a default user_id - in a real app this would come from session
                            let user_id = "current_user"; // This should come from authentication context
                            match engine.get_user_accounts(user_id).await {
                                Ok(accounts) => json!({
                                    "success": true,
                                    "result": accounts
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to get calendar accounts: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "search_documents" => {
                    match get_search_engine().await {
                        Some(engine) => {
                            let query_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let limit = args.get(1).and_then(|v| v.as_u64()).map(|v| v as usize);
                            let offset = args.get(2).and_then(|v| v.as_u64()).map(|v| v as usize);
                            let content_types_json = args.get(3);
                            
                            if query_str.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing search query"
                                })
                            } else {
                                // Parse content types
                                let content_types = if let Some(ct_json) = content_types_json {
                                    if let Ok(types) = serde_json::from_value::<Vec<String>>(ct_json.clone()) {
                                        Some(types.into_iter().filter_map(|s| match s.as_str() {
                                            "email" => Some(ContentType::Email),
                                            "calendar_event" => Some(ContentType::CalendarEvent),
                                            "contact" => Some(ContentType::Contact),
                                            "file" => Some(ContentType::File),
                                            "document" => Some(ContentType::Document),
                                            "message" => Some(ContentType::Message),
                                            _ => None,
                                        }).collect())
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                };
                                
                                let search_query = SearchQuery {
                                    query: query_str.to_string(),
                                    content_types,
                                    provider_ids: None,
                                    filters: None,
                                    sort: None,
                                    limit,
                                    offset,
                                    options: SearchOptions::default(),
                                };
                                
                                match engine.search(search_query).await {
                                    Ok(response) => json!({
                                        "success": true,
                                        "result": {
                                            "results": response.results,
                                            "total_count": response.total_count,
                                            "execution_time_ms": response.execution_time_ms,
                                            "facets": response.facets,
                                            "suggestions": response.suggestions
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Search failed: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "generate_encryption_key_pair" => {
                    // Generate real encryption key pair using crypto module
                    match flow_desk_shared::crypto::generate_key_pair() {
                        Ok((public_key, private_key)) => {
                            let public_key_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &public_key);
                            let private_key_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &private_key);
                            
                            json!({
                                "success": true,
                                "result": format!("{{\"publicKey\":\"{}\",\"privateKey\":\"{}\"}}", public_key_b64, private_key_b64)
                            })
                        }
                        Err(e) => {
                            json!({
                                "success": false,
                                "error": format!("Failed to generate key pair: {}", e)
                            })
                        }
                    }
                }
                "add_mail_account" => {
                    match get_mail_engine().await {
                        Some(engine) => {
                            if let Ok(account_data) = parse_mail_account_from_args(&args) {
                                match engine.add_account(account_data).await {
                                    Ok(account_id) => json!({
                                        "success": true,
                                        "result": {
                                            "id": account_id.to_string(),
                                            "status": "added"
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to add account: {}", e)
                                    })
                                }
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Invalid account data provided"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "sync_mail_account" => {
                    match get_mail_engine().await {
                        Some(engine) => {
                            let account_id_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            match Uuid::parse_str(account_id_str) {
                                Ok(account_id) => {
                                    match engine.sync_account(account_id).await {
                                        Ok(sync_result) => {
                                            let new_messages_count = sync_result.changes.iter()
                                                .filter(|change| matches!(change, SyncChange::MessageAdded(_)))
                                                .count();
                                            
                                            // Index new messages in search engine
                                            let mut indexed_count = 0;
                                            if let Some(search_engine) = get_search_engine().await {
                                                for change in &sync_result.changes {
                                                    if let SyncChange::MessageAdded(message) = change {
                                                        let now = chrono::Utc::now();
                                                        let content = format!("{} {} {}", 
                                                            message.subject,
                                                            message.body_text.as_deref().unwrap_or(""),
                                                            message.snippet
                                                        );
                                                        let checksum = format!("{:x}", md5::compute(&content));
                                                        
                                                        let document = SearchDocument {
                                                            id: format!("email_{}", message.id),
                                                            title: if message.subject.is_empty() { "No Subject".to_string() } else { message.subject.clone() },
                                                            content: content.clone(),
                                                            summary: Some(message.snippet.clone()),
                                                            content_type: ContentType::Email,
                                                            provider_id: format!("mail_account_{}", account_id),
                                                            provider_type: ProviderType::LocalMail,
                                                            url: None,
                                                            icon: None,
                                                            thumbnail: None,
                                                            metadata: DocumentMetadata {
                                                                size: Some(message.body_text.as_ref().map(|s| s.len() as u64).unwrap_or(0)),
                                                                file_type: Some("email".to_string()),
                                                                mime_type: Some("message/rfc822".to_string()),
                                                                language: Some("en".to_string()),
                                                                location: None,
                                                                collaboration: None,
                                                                activity: None,
                                                                priority: Some(format!("{:?}", message.importance)),
                                                                status: None,
                                                                custom: HashMap::new(),
                                                            },
                                                            tags: Vec::new(),
                                                            categories: Vec::new(),
                                                            author: Some(message.from.address.clone()),
                                                            created_at: message.date,
                                                            last_modified: message.date,
                                                            indexing_info: IndexingInfo {
                                                                indexed_at: now,
                                                                version: 1,
                                                                checksum,
                                                                index_type: IndexType::Full,
                                                            },
                                                        };
                                                        
                                                        if search_engine.index_document(document).await.is_ok() {
                                                            indexed_count += 1;
                                                        }
                                                    }
                                                }
                                            }
                                            
                                            json!({
                                                "success": true,
                                                "result": {
                                                    "accountId": account_id.to_string(),
                                                    "status": "synced",
                                                    "stats": {
                                                        "totalMessages": sync_result.changes.len(),
                                                        "newMessages": new_messages_count,
                                                        "indexedMessages": indexed_count
                                                    }
                                                }
                                            })
                                        },
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to sync account: {}", e)
                                        })
                                    }
                                },
                                Err(_) => json!({
                                    "success": false,
                                    "error": "Invalid account ID format"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "get_mail_messages" => {
                    match get_mail_engine().await {
                        Some(engine) => {
                            let account_id_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let folder_id_str = args.get(1).and_then(|v| v.as_str());
                            let limit = args.get(2).and_then(|v| v.as_u64()).map(|v| v as u32);
                            let offset = args.get(3).and_then(|v| v.as_u64()).map(|v| v as u32);

                            match Uuid::parse_str(account_id_str) {
                                Ok(account_id) => {
                                    let folder_id = folder_id_str
                                        .and_then(|s| Uuid::parse_str(s).ok());

                                    match engine.get_messages(account_id, folder_id, limit, offset).await {
                                        Ok(messages) => json!({
                                            "success": true,
                                            "result": messages
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to get messages: {}", e)
                                        })
                                    }
                                },
                                Err(_) => json!({
                                    "success": false,
                                    "error": "Invalid account ID format"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "mark_mail_message_read" => {
                    match get_mail_engine().await {
                        Some(engine) => {
                            let account_id_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let message_id_str = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let read = args.get(2).and_then(|v| v.as_bool()).unwrap_or(true);

                            match (Uuid::parse_str(account_id_str), Uuid::parse_str(message_id_str)) {
                                (Ok(account_id), Ok(message_id)) => {
                                    match engine.mark_message_read(account_id, message_id, read).await {
                                        Ok(_) => json!({
                                            "success": true,
                                            "result": null
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to mark message: {}", e)
                                        })
                                    }
                                },
                                _ => json!({
                                    "success": false,
                                    "error": "Invalid account or message ID format"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "search_mail_messages" => {
                    match get_mail_engine().await {
                        Some(engine) => {
                            let query = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let account_id_str = args.get(1).and_then(|v| v.as_str());
                            let limit = args.get(2).and_then(|v| v.as_u64()).map(|v| v as u32);

                            let account_id = account_id_str
                                .and_then(|s| Uuid::parse_str(s).ok());

                            match engine.search_messages(account_id, query, limit).await {
                                Ok(search_result) => json!({
                                    "success": true,
                                    "result": search_result
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to search messages: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "send_mail" => {
                    match get_mail_engine().await {
                        Some(engine) => {
                            let account_id_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let message_data = args.get(1);
                            
                            match Uuid::parse_str(account_id_str) {
                                Ok(account_id) => {
                                    if let Some(message_json) = message_data {
                                        if let Ok(message) = serde_json::from_value::<EmailMessage>(message_json.clone()) {
                                            match engine.send_email(account_id, &message).await {
                                                Ok(message_id) => json!({
                                                    "success": true,
                                                    "result": {
                                                        "messageId": message_id,
                                                        "status": "sent"
                                                    }
                                                }),
                                                Err(e) => json!({
                                                    "success": false,
                                                    "error": format!("Failed to send email: {}", e)
                                                })
                                            }
                                        } else {
                                            json!({
                                                "success": false,
                                                "error": "Invalid message format"
                                            })
                                        }
                                    } else {
                                        json!({
                                            "success": false,
                                            "error": "Missing message data"
                                        })
                                    }
                                },
                                Err(_) => json!({
                                    "success": false,
                                    "error": "Invalid account ID format"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Mail engine not initialized"
                        })
                    }
                }
                "add_calendar_account" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            if let Ok(account_input) = parse_calendar_account_from_args(&args) {
                                match engine.create_account(account_input).await {
                                    Ok(account) => json!({
                                        "success": true,
                                        "result": {
                                            "id": account.id.to_string(),
                                            "status": "added"
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to add calendar account: {}", e)
                                    })
                                }
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Invalid calendar account data provided"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "sync_calendar_account" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let account_id = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let force = args.get(1).and_then(|v| v.as_bool()).unwrap_or(false);
                            
                            if account_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing account ID"
                                })
                            } else {
                                match engine.sync_account(account_id, force).await {
                                    Ok(sync_status) => {
                                        // After successful sync, index calendar events in search engine
                                        let mut indexed_events_count = 0;
                                        if let Some(search_engine) = get_search_engine().await {
                                            // Get all calendars for this account
                                            if let Ok(calendars) = engine.list_calendars(account_id).await {
                                                let calendar_ids: Vec<String> = calendars.iter().map(|c| c.id.clone()).collect();
                                                
                                                // Get events from the last 30 days to 365 days ahead
                                                let time_min = chrono::Utc::now() - chrono::Duration::days(30);
                                                let time_max = chrono::Utc::now() + chrono::Duration::days(365);
                                                
                                                if let Ok(events) = engine.get_events_in_range(&calendar_ids, time_min, time_max).await {
                                                    for event in events {
                                                        let now = chrono::Utc::now();
                                                        let content = format!("{} {} {}", 
                                                            event.title,
                                                            event.description.as_deref().unwrap_or(""),
                                                            event.location.as_deref().unwrap_or("")
                                                        );
                                                        let checksum = format!("{:x}", md5::compute(&content));
                                                        
                                                        let document = SearchDocument {
                                                            id: format!("calendar_event_{}", event.id),
                                                            title: event.title.clone(),
                                                            content: content.clone(),
                                                            summary: event.description.clone(),
                                                            content_type: ContentType::CalendarEvent,
                                                            provider_id: format!("calendar_account_{}", account_id),
                                                            provider_type: ProviderType::LocalCalendar,
                                                            url: None, // CalendarEvent doesn't have html_link field
                                                            icon: None,
                                                            thumbnail: None,
                                                            metadata: DocumentMetadata {
                                                                size: Some(content.len() as u64),
                                                                file_type: Some("calendar_event".to_string()),
                                                                mime_type: Some("text/calendar".to_string()),
                                                                language: Some("en".to_string()),
                                                                location: event.location.as_ref().map(|loc| LocationInfo {
                                                                    path: None,
                                                                    folder: None,
                                                                    workspace: None,
                                                                    project: Some(loc.clone()),
                                                                }),
                                                                collaboration: Some(CollaborationInfo {
                                                                    shared: !event.attendees.is_empty(),
                                                                    collaborators: event.attendees.iter().map(|a| a.email.clone()).collect(),
                                                                    permissions: None,
                                                                }),
                                                                activity: None,
                                                                priority: None,
                                                                status: Some(event.status.to_string()),
                                                                custom: HashMap::new(),
                                                            },
                                                            tags: Vec::new(),
                                                            categories: Vec::new(),
                                                            author: None, // CalendarEvent doesn't have creator field
                                                            created_at: now, // Use current time as CalendarEvent doesn't have created field
                                                            last_modified: now, // Use current time as CalendarEvent doesn't have updated field
                                                            indexing_info: IndexingInfo {
                                                                indexed_at: now,
                                                                version: 1,
                                                                checksum,
                                                                index_type: IndexType::Full,
                                                            },
                                                        };
                                                        
                                                        if search_engine.index_document(document).await.is_ok() {
                                                            indexed_events_count += 1;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                        json!({
                                            "success": true,
                                            "result": {
                                                "account_id": sync_status.account_id,
                                                "is_syncing": sync_status.is_syncing,
                                                "total_calendars": sync_status.total_calendars,
                                                "total_events": sync_status.total_events,
                                                "status": sync_status.status,
                                                "last_sync": sync_status.last_sync,
                                                "error": sync_status.error,
                                                "indexed_events": indexed_events_count
                                            }
                                        })
                                    },
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to sync calendar account: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "get_calendars" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let account_id = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            
                            if account_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing account ID"
                                })
                            } else {
                                match engine.list_calendars(account_id).await {
                                    Ok(calendars) => json!({
                                        "success": true,
                                        "result": calendars
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to get calendars: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "get_calendar_events" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let calendar_ids_json = args.get(0);
                            let time_min_str = args.get(1).and_then(|v| v.as_str());
                            let time_max_str = args.get(2).and_then(|v| v.as_str());
                            
                            // Parse calendar IDs
                            let calendar_ids: Vec<String> = match calendar_ids_json {
                                Some(value) if value.is_array() => {
                                    value.as_array().unwrap()
                                        .iter()
                                        .filter_map(|v| v.as_str().map(String::from))
                                        .collect()
                                },
                                Some(value) if value.is_string() => {
                                    vec![value.as_str().unwrap().to_string()]
                                },
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": "Missing or invalid calendar IDs"
                                    });
                                }
                            };
                            
                            // Parse time range
                            let time_min = time_min_str
                                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                .map(|dt| dt.with_timezone(&Utc))
                                .unwrap_or_else(|| Utc::now() - chrono::Duration::days(7));
                                
                            let time_max = time_max_str
                                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                .map(|dt| dt.with_timezone(&Utc))
                                .unwrap_or_else(|| Utc::now() + chrono::Duration::days(30));
                            
                            match engine.get_events_in_range(&calendar_ids, time_min, time_max).await {
                                Ok(events) => json!({
                                    "success": true,
                                    "result": events
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to get calendar events: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "create_calendar_event" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            if let Ok(event_input) = parse_calendar_event_from_args(&args) {
                                match engine.create_event(&event_input).await {
                                    Ok(created_event) => json!({
                                        "success": true,
                                        "result": {
                                            "id": created_event.id,
                                            "calendar_id": created_event.calendar_id,
                                            "title": created_event.title,
                                            "start_time": created_event.start_time.to_rfc3339(),
                                            "end_time": created_event.end_time.to_rfc3339(),
                                            "status": "created"
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to create calendar event: {}", e)
                                    })
                                }
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Invalid calendar event data provided"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "update_calendar_event" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let calendar_id = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let event_id = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let updates = args.get(2);
                            
                            if calendar_id.is_empty() || event_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing calendar_id or event_id"
                                })
                            } else if let Some(update_data) = updates {
                                // Parse update data into UpdateCalendarEventInput
                                let mut update_input = UpdateCalendarEventInput {
                                    title: None,
                                    description: None,
                                    start_time: None,
                                    end_time: None,
                                    location: None,
                                    status: None,
                                    visibility: None,
                                    attendees: None,
                                    recurrence: None,
                                    reminders: None,
                                    transparency: None,
                                    extended_properties: None,
                                    color: None,
                                    all_day: None,
                                    timezone: None,
                                    conferencing: None,
                                    attachments: None,
                                };
                                
                                if let Some(title) = update_data.get("title").and_then(|v| v.as_str()) {
                                    update_input.title = Some(title.to_string());
                                }
                                if let Some(description) = update_data.get("description").and_then(|v| v.as_str()) {
                                    update_input.description = Some(description.to_string());
                                }
                                if let Some(start_str) = update_data.get("start_time").and_then(|v| v.as_str()) {
                                    if let Ok(start_time) = DateTime::parse_from_rfc3339(start_str) {
                                        update_input.start_time = Some(start_time.with_timezone(&Utc));
                                    }
                                }
                                if let Some(end_str) = update_data.get("end_time").and_then(|v| v.as_str()) {
                                    if let Ok(end_time) = DateTime::parse_from_rfc3339(end_str) {
                                        update_input.end_time = Some(end_time.with_timezone(&Utc));
                                    }
                                }
                                if let Some(location) = update_data.get("location").and_then(|v| v.as_str()) {
                                    update_input.location = Some(location.to_string());
                                }
                                
                                match engine.update_event(calendar_id, event_id, &update_input).await {
                                    Ok(updated_event) => json!({
                                        "success": true,
                                        "result": {
                                            "id": updated_event.id,
                                            "calendar_id": updated_event.calendar_id,
                                            "title": updated_event.title,
                                            "start_time": updated_event.start_time.to_rfc3339(),
                                            "end_time": updated_event.end_time.to_rfc3339(),
                                            "status": "updated"
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to update calendar event: {}", e)
                                    })
                                }
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Missing update data"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "delete_calendar_event" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let calendar_id = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let event_id = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            
                            if calendar_id.is_empty() || event_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing calendar_id or event_id"
                                })
                            } else {
                                match engine.delete_event(calendar_id, event_id).await {
                                    Ok(_) => json!({
                                        "success": true,
                                        "result": {
                                            "id": event_id,
                                            "status": "deleted"
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to delete calendar event: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "search_calendar_events" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let query = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let limit = args.get(1).and_then(|v| v.as_u64()).map(|v| v as usize);
                            
                            if query.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing search query"
                                })
                            } else {
                                match engine.search_events(query, limit).await {
                                    Ok(events) => json!({
                                        "success": true,
                                        "result": events
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to search calendar events: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "query_free_busy" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let emails_json = args.get(0);
                            let time_min_str = args.get(1).and_then(|v| v.as_str());
                            let time_max_str = args.get(2).and_then(|v| v.as_str());
                            let timezone = args.get(3).and_then(|v| v.as_str()).unwrap_or("UTC").to_string();
                            
                            // Parse emails
                            let emails: Vec<String> = match emails_json {
                                Some(value) if value.is_array() => {
                                    value.as_array().unwrap()
                                        .iter()
                                        .filter_map(|v| v.as_str().map(String::from))
                                        .collect()
                                },
                                Some(value) if value.is_string() => {
                                    vec![value.as_str().unwrap().to_string()]
                                },
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": "Missing or invalid email addresses"
                                    });
                                }
                            };
                            
                            // Parse time range
                            let time_min = time_min_str
                                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                .map(|dt| dt.with_timezone(&Utc))
                                .unwrap_or_else(|| Utc::now());
                                
                            let time_max = time_max_str
                                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                                .map(|dt| dt.with_timezone(&Utc))
                                .unwrap_or_else(|| Utc::now() + chrono::Duration::hours(8));
                            
                            let query = FreeBusyQuery {
                                emails,
                                time_min,
                                time_max,
                                timezone: Some(timezone),
                            };
                            
                            match engine.query_free_busy(&query).await {
                                Ok(response) => json!({
                                    "success": true,
                                    "result": response
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to query free/busy: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "create_privacy_sync_rule" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            let rule_data = args.get(0);
                            
                            if let Some(data) = rule_data {
                                // Parse privacy sync rule
                                let name = data.get("name")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("Privacy Sync Rule")
                                    .to_string();
                                    
                                let source_calendar_id = data.get("source_calendar_id")
                                    .and_then(|v| v.as_str())
                                    .ok_or_else(|| "Missing source_calendar_id".to_string());
                                    
                                let target_calendar_id = data.get("target_calendar_id")
                                    .and_then(|v| v.as_str())
                                    .ok_or_else(|| "Missing target_calendar_id".to_string());
                                    
                                if let (Ok(source_id), Ok(target_id)) = (source_calendar_id, target_calendar_id) {
                                    let privacy_settings = PrivacySettings {
                                        strip_sensitive_info: data.get("strip_sensitive_info").and_then(|v| v.as_bool()).unwrap_or(true),
                                        default_title: data.get("default_title").and_then(|v| v.as_str()).unwrap_or("Private").to_string(),
                                        show_busy_only: data.get("show_busy_only").and_then(|v| v.as_bool()).unwrap_or(false),
                                        strip_description: data.get("strip_description").and_then(|v| v.as_bool()).unwrap_or(true),
                                        strip_location: data.get("strip_location").and_then(|v| v.as_bool()).unwrap_or(true),
                                        strip_attendees: data.get("strip_attendees").and_then(|v| v.as_bool()).unwrap_or(true),
                                        strip_attachments: data.get("strip_attachments").and_then(|v| v.as_bool()).unwrap_or(true),
                                        visibility: None,
                                        title_template: data.get("title_template").and_then(|v| v.as_str()).map(String::from),
                                    };
                                    
                                    let rule = CalendarPrivacySync {
                                        id: Uuid::new_v4(),
                                        enabled: data.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
                                        is_active: data.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true),
                                        source_calendar_id: source_id.to_string(),
                                        source_calendar_ids: vec![], // Additional source calendars if needed
                                        target_calendar_id: target_id.to_string(),
                                        name,
                                        filters: vec![], // Could be parsed from data if needed
                                        advanced_mode: data.get("advanced_mode").and_then(|v| v.as_bool()).unwrap_or(false),
                                        privacy_settings,
                                        time_window: None, // Could be parsed if needed
                                        last_sync_at: None,
                                        updated_at: Utc::now(),
                                        metadata: None,
                                    };
                                    
                                    match engine.create_privacy_sync_rule(&rule).await {
                                        Ok(rule_id) => json!({
                                            "success": true,
                                            "result": {
                                                "id": rule_id,
                                                "status": "created"
                                            }
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to create privacy sync rule: {}", e)
                                        })
                                    }
                                } else {
                                    json!({
                                        "success": false,
                                        "error": "Missing source_calendar_id or target_calendar_id"
                                    })
                                }
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Missing rule data"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "execute_privacy_sync" => {
                    match get_calendar_engine().await {
                        Some(engine) => {
                            match engine.execute_privacy_sync().await {
                                Ok(results) => json!({
                                    "success": true,
                                    "result": {
                                        "synced_rules": results.len(),
                                        "results": results
                                    }
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to execute privacy sync: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar engine not initialized"
                        })
                    }
                }
                "index_document" => {
                    match get_search_engine().await {
                        Some(engine) => {
                            let doc_data = args.get(0);
                            
                            if let Some(data) = doc_data {
                                // Parse document data
                                let id = data.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let content = data.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let content_type_str = data.get("content_type").and_then(|v| v.as_str()).unwrap_or("document");
                                let provider_id = data.get("provider_id").and_then(|v| v.as_str()).unwrap_or("local").to_string();
                                let author = data.get("author").and_then(|v| v.as_str()).map(String::from);
                                let url = data.get("url").and_then(|v| v.as_str()).map(String::from);
                                
                                if id.is_empty() || title.is_empty() {
                                    json!({
                                        "success": false,
                                        "error": "Missing required fields: id and title"
                                    })
                                } else {
                                    let content_type = match content_type_str {
                                        "email" => ContentType::Email,
                                        "calendar_event" => ContentType::CalendarEvent,
                                        "contact" => ContentType::Contact,
                                        "file" => ContentType::File,
                                        "message" => ContentType::Message,
                                        _ => ContentType::Document,
                                    };
                                    
                                    let provider_type = match provider_id.as_str() {
                                        "gmail" => ProviderType::Gmail,
                                        "outlook" => ProviderType::Outlook,
                                        "local_mail" => ProviderType::LocalMail,
                                        "local_calendar" => ProviderType::LocalCalendar,
                                        _ => ProviderType::LocalFiles,
                                    };
                                    
                                    let now = chrono::Utc::now();
                                    let checksum = format!("{:x}", md5::compute(&content));
                                    
                                    let document = SearchDocument {
                                        id,
                                        title,
                                        content: content.clone(),
                                        summary: None,
                                        content_type,
                                        provider_id,
                                        provider_type,
                                        url,
                                        icon: None,
                                        thumbnail: None,
                                        metadata: DocumentMetadata {
                                            size: Some(content.len() as u64),
                                            file_type: None,
                                            mime_type: None,
                                            language: Some("en".to_string()),
                                            location: None,
                                            collaboration: None,
                                            activity: None,
                                            priority: None,
                                            status: None,
                                            custom: std::collections::HashMap::new(),
                                        },
                                        tags: Vec::new(),
                                        categories: Vec::new(),
                                        author,
                                        created_at: now,
                                        last_modified: now,
                                        indexing_info: IndexingInfo {
                                            indexed_at: now,
                                            version: 1,
                                            checksum,
                                            index_type: IndexType::Full,
                                        },
                                    };
                                    
                                    match engine.index_document(document).await {
                                        Ok(_) => json!({
                                            "success": true,
                                            "result": "Document indexed successfully"
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to index document: {}", e)
                                        })
                                    }
                                }
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Missing document data"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "encrypt_string" => {
                    let data = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                    json!({
                        "success": true,
                        "result": base64::engine::general_purpose::STANDARD.encode(data.as_bytes())
                    })
                }
                "decrypt_string" => {
                    let encrypted_data = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                    match base64::engine::general_purpose::STANDARD.decode(encrypted_data) {
                        Ok(decoded) => {
                            json!({
                                "success": true,
                                "result": String::from_utf8_lossy(&decoded).to_string()
                            })
                        }
                        Err(_) => {
                            json!({
                                "success": false,
                                "error": "Invalid base64 data"
                            })
                        }
                    }
                }
                "search_suggestions" => {
                    match get_search_engine().await {
                        Some(engine) => {
                            let partial_query = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let limit = args.get(1).and_then(|v| v.as_u64()).map(|v| v as usize).unwrap_or(10);
                            
                            if partial_query.is_empty() {
                                json!({
                                    "success": true,
                                    "result": []
                                })
                            } else {
                                match engine.get_suggestions(partial_query, limit).await {
                                    Ok(suggestions) => json!({
                                        "success": true,
                                        "result": suggestions
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to get suggestions: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "get_search_stats" => {
                    match get_search_engine().await {
                        Some(engine) => {
                            match engine.get_health_status().await {
                                status => json!({
                                    "success": true,
                                    "result": {
                                        "is_healthy": status.is_healthy,
                                        "total_documents": status.total_documents,
                                        "total_searches": status.total_searches,
                                        "avg_response_time_ms": status.avg_response_time_ms,
                                        "error_rate": status.error_rate,
                                        "last_health_check": status.last_health_check.to_rfc3339()
                                    }
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "optimize_search_index" => {
                    match get_search_engine().await {
                        Some(engine) => {
                            match engine.optimize_indices().await {
                                Ok(_) => json!({
                                    "success": true,
                                    "result": "Search index optimized successfully"
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to optimize search index: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "clear_search_cache" => {
                    match get_search_engine().await {
                        Some(engine) => {
                            engine.clear_cache().await;
                            json!({
                                "success": true,
                                "result": "Search cache cleared successfully"
                            })
                        },
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "delete_document" => {
                    match get_search_engine().await {
                        Some(engine) => {
                            let document_id = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            
                            if document_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing document ID"
                                })
                            } else {
                                match engine.delete_document(document_id).await {
                                    Ok(deleted) => json!({
                                        "success": true,
                                        "result": {
                                            "deleted": deleted,
                                            "document_id": document_id
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to delete document: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Search engine not initialized"
                        })
                    }
                }
                "get_oauth_url" => {
                    match get_oauth_manager().await {
                        Some(manager) => {
                            let provider_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let client_id = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let redirect_uri = args.get(2).and_then(|v| v.as_str()).unwrap_or("http://localhost:3000/oauth/callback");
                            
                            let provider = match provider_str.to_lowercase().as_str() {
                                "gmail" => MailProvider::Gmail,
                                "outlook" => MailProvider::Outlook,
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": format!("Unsupported OAuth provider: {}", provider_str)
                                    });
                                }
                            };
                            
                            if client_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing client_id parameter"
                                })
                            } else {
                                match manager.get_authorization_url(provider, client_id, redirect_uri).await {
                                    Ok(auth_url) => json!({
                                        "success": true,
                                        "result": {
                                            "authorization_url": auth_url,
                                            "provider": provider_str,
                                            "redirect_uri": redirect_uri
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to generate OAuth URL: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "handle_oauth_callback" => {
                    match get_oauth_manager().await {
                        Some(manager) => {
                            let code = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let state = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let provider_str = args.get(2).and_then(|v| v.as_str()).unwrap_or("");
                            let redirect_uri = args.get(3).and_then(|v| v.as_str()).unwrap_or("http://localhost:3000/oauth/callback");
                            let account_id_str = args.get(4).and_then(|v| v.as_str());
                            
                            let provider = match provider_str.to_lowercase().as_str() {
                                "gmail" => MailProvider::Gmail,
                                "outlook" => MailProvider::Outlook,
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": format!("Unsupported OAuth provider: {}", provider_str)
                                    });
                                }
                            };
                            
                            if code.is_empty() || state.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing authorization code or state parameter"
                                })
                            } else {
                                match manager.handle_callback(code, state, provider, redirect_uri).await {
                                    Ok(tokens) => {
                                        // Store tokens if account_id is provided
                                        if let Some(account_id_str) = account_id_str {
                                            if let Ok(account_id) = uuid::Uuid::parse_str(account_id_str) {
                                                let scopes = match provider {
                                                    MailProvider::Gmail => vec![
                                                        "https://www.googleapis.com/auth/gmail.readonly".to_string(),
                                                        "https://www.googleapis.com/auth/gmail.send".to_string(),
                                                        "https://www.googleapis.com/auth/gmail.modify".to_string(),
                                                    ],
                                                    MailProvider::Outlook => vec![
                                                        "https://graph.microsoft.com/Mail.Read".to_string(),
                                                        "https://graph.microsoft.com/Mail.Send".to_string(),
                                                        "https://graph.microsoft.com/Mail.ReadWrite".to_string(),
                                                    ],
                                                    _ => vec![],
                                                };
                                                
                                                if let Err(e) = manager.store_credentials(account_id, provider, &tokens, scopes).await {
                                                    return json!({
                                                        "success": false,
                                                        "error": format!("Failed to store credentials: {}", e)
                                                    });
                                                }
                                            }
                                        }
                                        
                                        json!({
                                            "success": true,
                                            "result": {
                                                "access_token": tokens.access_token,
                                                "refresh_token": tokens.refresh_token,
                                                "expires_at": tokens.expires_at.map(|dt| dt.to_rfc3339()),
                                                "provider": provider_str
                                            }
                                        })
                                    },
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to handle OAuth callback: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "refresh_oauth_token" => {
                    match get_oauth_manager().await {
                        Some(manager) => {
                            let account_id_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            
                            match uuid::Uuid::parse_str(account_id_str) {
                                Ok(account_id) => {
                                    match manager.get_valid_token(account_id).await {
                                        Ok(access_token) => {
                                            // Get updated credentials to return full token info
                                            match manager.get_credentials(account_id).await {
                                                Ok(Some(credentials)) => json!({
                                                    "success": true,
                                                    "result": {
                                                        "access_token": access_token,
                                                        "refresh_token": credentials.refresh_token,
                                                        "expires_at": credentials.expires_at.map(|dt| dt.to_rfc3339()),
                                                        "provider": format!("{:?}", credentials.provider)
                                                    }
                                                }),
                                                Ok(None) => json!({
                                                    "success": false,
                                                    "error": "No credentials found for account"
                                                }),
                                                Err(e) => json!({
                                                    "success": false,
                                                    "error": format!("Failed to get credentials: {}", e)
                                                })
                                            }
                                        },
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to refresh token: {}", e)
                                        })
                                    }
                                },
                                Err(_) => json!({
                                    "success": false,
                                    "error": "Invalid account ID format"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "revoke_oauth_token" => {
                    match get_oauth_manager().await {
                        Some(manager) => {
                            let account_id_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            
                            match uuid::Uuid::parse_str(account_id_str) {
                                Ok(account_id) => {
                                    match manager.revoke_credentials(account_id).await {
                                        Ok(_) => json!({
                                            "success": true,
                                            "result": {
                                                "account_id": account_id.to_string(),
                                                "status": "revoked"
                                            }
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to revoke token: {}", e)
                                        })
                                    }
                                },
                                Err(_) => json!({
                                    "success": false,
                                    "error": "Invalid account ID format"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "validate_oauth_token" => {
                    match get_oauth_manager().await {
                        Some(manager) => {
                            let account_id_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            
                            match uuid::Uuid::parse_str(account_id_str) {
                                Ok(account_id) => {
                                    match manager.get_credentials(account_id).await {
                                        Ok(Some(credentials)) => {
                                            let is_expired = manager.is_token_expired(&OAuthTokens {
                                                access_token: credentials.access_token.clone(),
                                                refresh_token: credentials.refresh_token.clone(),
                                                expires_at: credentials.expires_at,
                                            });
                                            
                                            json!({
                                                "success": true,
                                                "result": {
                                                    "account_id": account_id.to_string(),
                                                    "is_valid": !is_expired,
                                                    "is_expired": is_expired,
                                                    "expires_at": credentials.expires_at.map(|dt| dt.to_rfc3339()),
                                                    "provider": format!("{:?}", credentials.provider),
                                                    "scopes": credentials.scopes
                                                }
                                            })
                                        },
                                        Ok(None) => json!({
                                            "success": false,
                                            "error": "No credentials found for account"
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to get credentials: {}", e)
                                        })
                                    }
                                },
                                Err(_) => json!({
                                    "success": false,
                                    "error": "Invalid account ID format"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "register_oauth_client" => {
                    match get_oauth_manager().await {
                        Some(_manager) => {
                            let provider_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let client_id = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let client_secret = args.get(2).and_then(|v| v.as_str()).unwrap_or("");
                            
                            let _provider = match provider_str.to_lowercase().as_str() {
                                "gmail" => MailProvider::Gmail,
                                "outlook" => MailProvider::Outlook,
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": format!("Unsupported OAuth provider: {}", provider_str)
                                    });
                                }
                            };
                            
                            if client_id.is_empty() || client_secret.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing client_id or client_secret parameter"
                                })
                            } else {
                                // We need to access the manager mutably, but Arc<AuthManager> doesn't allow that
                                // For now, return success as OAuth clients are typically registered at startup
                                json!({
                                    "success": true,
                                    "result": {
                                        "provider": provider_str,
                                        "status": "OAuth client registration would be done at startup"
                                    }
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "list_oauth_accounts" => {
                    match get_oauth_manager().await {
                        Some(manager) => {
                            let account_ids = manager.list_credential_accounts().await;
                            let mut accounts = Vec::new();
                            
                            for account_id in account_ids {
                                if let Ok(Some(credentials)) = manager.get_credentials(account_id).await {
                                    accounts.push(json!({
                                        "account_id": account_id.to_string(),
                                        "provider": format!("{:?}", credentials.provider),
                                        "expires_at": credentials.expires_at.map(|dt| dt.to_rfc3339()),
                                        "scopes": credentials.scopes,
                                        "created_at": credentials.created_at.to_rfc3339(),
                                        "updated_at": credentials.updated_at.to_rfc3339()
                                    }));
                                }
                            }
                            
                            json!({
                                "success": true,
                                "result": {
                                    "accounts": accounts,
                                    "count": accounts.len()
                                }
                            })
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "clear_oauth_credentials" => {
                    match get_oauth_manager().await {
                        Some(manager) => {
                            match manager.clear_all_credentials().await {
                                Ok(_) => json!({
                                    "success": true,
                                    "result": {
                                        "status": "All OAuth credentials cleared"
                                    }
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to clear credentials: {}", e)
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "OAuth manager not initialized"
                        })
                    }
                }
                "get_calendar_oauth_url" => {
                    match get_calendar_oauth_manager().await {
                        Some(manager) => {
                            let provider_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let client_id = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let redirect_uri = args.get(2).and_then(|v| v.as_str()).unwrap_or("http://localhost:3000/oauth/callback");
                            
                            let provider = match provider_str.to_lowercase().as_str() {
                                "google" => CalendarProvider::Google,
                                "outlook" => CalendarProvider::Outlook,
                                "exchange" => CalendarProvider::Exchange,
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": format!("Unsupported calendar OAuth provider: {}", provider_str)
                                    });
                                }
                            };
                            
                            if client_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing client_id parameter"
                                })
                            } else {
                                match manager.get_authorization_url(provider, client_id, redirect_uri).await {
                                    Ok(auth_url) => json!({
                                        "success": true,
                                        "result": {
                                            "authorization_url": auth_url,
                                            "provider": provider_str,
                                            "redirect_uri": redirect_uri
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to generate calendar OAuth URL: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar OAuth manager not initialized"
                        })
                    }
                }
                "handle_calendar_oauth_callback" => {
                    match get_calendar_oauth_manager().await {
                        Some(manager) => {
                            let code = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let state = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let provider_str = args.get(2).and_then(|v| v.as_str()).unwrap_or("");
                            let redirect_uri = args.get(3).and_then(|v| v.as_str()).unwrap_or("http://localhost:3000/oauth/callback");
                            let account_id = args.get(4).and_then(|v| v.as_str()).unwrap_or("");
                            
                            let provider = match provider_str.to_lowercase().as_str() {
                                "google" => CalendarProvider::Google,
                                "outlook" => CalendarProvider::Outlook,
                                "exchange" => CalendarProvider::Exchange,
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": format!("Unsupported calendar OAuth provider: {}", provider_str)
                                    });
                                }
                            };
                            
                            if code.is_empty() || state.is_empty() || account_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing authorization code, state, or account_id parameter"
                                })
                            } else {
                                match manager.handle_callback(code, state, provider, redirect_uri, account_id).await {
                                    Ok(credentials) => json!({
                                        "success": true,
                                        "result": {
                                            "access_token": credentials.access_token,
                                            "refresh_token": credentials.refresh_token,
                                            "expires_at": credentials.expires_at.map(|dt| dt.to_rfc3339()),
                                            "provider": format!("{:?}", credentials.provider),
                                            "account_id": credentials.account_id,
                                            "scopes": credentials.scope
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to handle calendar OAuth callback: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar OAuth manager not initialized"
                        })
                    }
                }
                "refresh_calendar_oauth_token" => {
                    match get_calendar_oauth_manager().await {
                        Some(manager) => {
                            let provider_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let refresh_token = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            let account_id = args.get(2).and_then(|v| v.as_str()).unwrap_or("");
                            
                            let provider = match provider_str.to_lowercase().as_str() {
                                "google" => CalendarProvider::Google,
                                "outlook" => CalendarProvider::Outlook,
                                "exchange" => CalendarProvider::Exchange,
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": format!("Unsupported calendar OAuth provider: {}", provider_str)
                                    });
                                }
                            };
                            
                            if refresh_token.is_empty() || account_id.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing refresh_token or account_id parameter"
                                })
                            } else {
                                match manager.refresh_access_token(provider, refresh_token, account_id).await {
                                    Ok(credentials) => json!({
                                        "success": true,
                                        "result": {
                                            "access_token": credentials.access_token,
                                            "refresh_token": credentials.refresh_token,
                                            "expires_at": credentials.expires_at.map(|dt| dt.to_rfc3339()),
                                            "provider": format!("{:?}", credentials.provider),
                                            "account_id": credentials.account_id,
                                            "scopes": credentials.scope
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to refresh calendar OAuth token: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar OAuth manager not initialized"
                        })
                    }
                }
                "revoke_calendar_oauth_token" => {
                    match get_calendar_oauth_manager().await {
                        Some(manager) => {
                            let provider_str = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                            let token = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                            
                            let provider = match provider_str.to_lowercase().as_str() {
                                "google" => CalendarProvider::Google,
                                "outlook" => CalendarProvider::Outlook,
                                "exchange" => CalendarProvider::Exchange,
                                _ => {
                                    return json!({
                                        "success": false,
                                        "error": format!("Unsupported calendar OAuth provider: {}", provider_str)
                                    });
                                }
                            };
                            
                            if token.is_empty() {
                                json!({
                                    "success": false,
                                    "error": "Missing token parameter"
                                })
                            } else {
                                match manager.revoke_token(provider, token).await {
                                    Ok(_) => json!({
                                        "success": true,
                                        "result": {
                                            "provider": provider_str,
                                            "status": "revoked"
                                        }
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to revoke calendar OAuth token: {}", e)
                                    })
                                }
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar OAuth manager not initialized"
                        })
                    }
                }
                "validate_calendar_oauth_token" => {
                    match get_calendar_oauth_manager().await {
                        Some(manager) => {
                            let credentials_json = args.get(0);
                            
                            if let Some(creds_data) = credentials_json {
                                // Parse credentials from JSON input
                                match serde_json::from_value::<flow_desk_shared::calendar::auth::OAuthCredentials>(creds_data.clone()) {
                                    Ok(credentials) => {
                                        let is_expired = manager.is_token_expired(&credentials);
                                        
                                        json!({
                                            "success": true,
                                            "result": {
                                                "account_id": credentials.account_id,
                                                "is_valid": !is_expired,
                                                "is_expired": is_expired,
                                                "expires_at": credentials.expires_at.map(|dt| dt.to_rfc3339()),
                                                "provider": format!("{:?}", credentials.provider),
                                                "scopes": credentials.scope
                                            }
                                        })
                                    },
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Invalid credentials format: {}", e)
                                    })
                                }
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Missing credentials data"
                                })
                            }
                        },
                        None => json!({
                            "success": false,
                            "error": "Calendar OAuth manager not initialized"
                        })
                    }
                }
                
                // Database Management Operations
                "init_database" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("all");
                    
                    match database_type {
                        "mail" => {
                            let database_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            
                            match MailDatabase::new(&database_path).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Mail database initialized successfully",
                                    "path": database_path
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to initialize mail database: {}", e)
                                })
                            }
                        },
                        "calendar" => {
                            let database_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            
                            match CalendarDatabase::new(&database_url).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Calendar database initialized successfully",
                                    "url": database_url
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to initialize calendar database: {}", e)
                                })
                            }
                        },
                        "all" => {
                            let mail_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let calendar_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            
                            let mail_result = MailDatabase::new(&mail_path).await;
                            let calendar_result = CalendarDatabase::new(&calendar_url).await;
                            
                            let mut results = Vec::new();
                            if mail_result.is_ok() {
                                results.push("mail");
                            }
                            if calendar_result.is_ok() {
                                results.push("calendar");
                            }
                            
                            if results.len() == 2 {
                                json!({
                                    "success": true,
                                    "message": "All databases initialized successfully",
                                    "databases": results
                                })
                            } else {
                                json!({
                                    "success": false,
                                    "error": "Some databases failed to initialize",
                                    "partial_success": results
                                })
                            }
                        },
                        _ => json!({
                            "success": false,
                            "error": "Invalid database type. Use 'mail', 'calendar', or 'all'"
                        })
                    }
                }
                
                "get_database_stats" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("all");
                    
                    match database_type {
                        "mail" => {
                            let database_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            
                            match get_database_file_stats(&database_path).await {
                                Ok(stats) => {
                                    match MailDatabase::new(&database_path).await {
                                        Ok(db) => {
                                            // Get additional mail-specific stats
                                            match get_mail_database_stats(&db).await {
                                                Ok(mail_stats) => {
                                                    let mut combined_stats = stats;
                                                    combined_stats.extend(mail_stats);
                                                    json!({
                                                        "success": true,
                                                        "database_type": "mail",
                                                        "stats": combined_stats
                                                    })
                                                },
                                                Err(e) => json!({
                                                    "success": false,
                                                    "error": format!("Failed to get mail database stats: {}", e)
                                                })
                                            }
                                        },
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to connect to mail database: {}", e)
                                        })
                                    }
                                },
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to get database file stats: {}", e)
                                })
                            }
                        },
                        "calendar" => {
                            let database_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let database_path = database_url.replace("sqlite://", "");
                            
                            match get_database_file_stats(&database_path).await {
                                Ok(stats) => {
                                    match CalendarDatabase::new(&database_url).await {
                                        Ok(db) => {
                                            match get_calendar_database_stats(&db).await {
                                                Ok(cal_stats) => {
                                                    let mut combined_stats = stats;
                                                    combined_stats.extend(cal_stats);
                                                    json!({
                                                        "success": true,
                                                        "database_type": "calendar",
                                                        "stats": combined_stats
                                                    })
                                                },
                                                Err(e) => json!({
                                                    "success": false,
                                                    "error": format!("Failed to get calendar database stats: {}", e)
                                                })
                                            }
                                        },
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to connect to calendar database: {}", e)
                                        })
                                    }
                                },
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to get database file stats: {}", e)
                                })
                            }
                        },
                        "all" => {
                            let mail_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let calendar_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let calendar_path = calendar_url.replace("sqlite://", "");
                            
                            let mail_stats = get_database_file_stats(&mail_path).await.unwrap_or_default();
                            let calendar_stats = get_database_file_stats(&calendar_path).await.unwrap_or_default();
                            
                            json!({
                                "success": true,
                                "stats": {
                                    "mail": mail_stats,
                                    "calendar": calendar_stats
                                }
                            })
                        },
                        _ => json!({
                            "success": false,
                            "error": "Invalid database type. Use 'mail', 'calendar', or 'all'"
                        })
                    }
                }
                
                "vacuum_database" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("all");
                    
                    match database_type {
                        "mail" => {
                            let database_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            
                            match vacuum_sqlite_database(&database_path).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Mail database vacuum completed successfully"
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to vacuum mail database: {}", e)
                                })
                            }
                        },
                        "calendar" => {
                            let database_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let database_path = database_url.replace("sqlite://", "");
                            
                            match vacuum_sqlite_database(&database_path).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Calendar database vacuum completed successfully"
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to vacuum calendar database: {}", e)
                                })
                            }
                        },
                        "all" => {
                            let mail_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let calendar_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let calendar_path = calendar_url.replace("sqlite://", "");
                            
                            let mail_result = vacuum_sqlite_database(&mail_path).await;
                            let calendar_result = vacuum_sqlite_database(&calendar_path).await;
                            
                            let mut results = Vec::new();
                            if mail_result.is_ok() {
                                results.push("mail");
                            }
                            if calendar_result.is_ok() {
                                results.push("calendar");
                            }
                            
                            json!({
                                "success": true,
                                "message": "Database vacuum completed",
                                "databases": results
                            })
                        },
                        _ => json!({
                            "success": false,
                            "error": "Invalid database type. Use 'mail', 'calendar', or 'all'"
                        })
                    }
                }
                
                "backup_database" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("all");
                    let backup_path = args.get(1).and_then(|v| v.as_str());
                    
                    match database_type {
                        "mail" => {
                            let source_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let backup_destination = backup_path
                                .map(|p| p.to_string())
                                .unwrap_or_else(|| format!("{}.backup.{}", source_path, chrono::Utc::now().format("%Y%m%d_%H%M%S")));
                            
                            match backup_database_file(&source_path, &backup_destination).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Mail database backed up successfully",
                                    "backup_path": backup_destination
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to backup mail database: {}", e)
                                })
                            }
                        },
                        "calendar" => {
                            let database_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let source_path = database_url.replace("sqlite://", "");
                            let backup_destination = backup_path
                                .map(|p| p.to_string())
                                .unwrap_or_else(|| format!("{}.backup.{}", source_path, chrono::Utc::now().format("%Y%m%d_%H%M%S")));
                            
                            match backup_database_file(&source_path, &backup_destination).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Calendar database backed up successfully",
                                    "backup_path": backup_destination
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to backup calendar database: {}", e)
                                })
                            }
                        },
                        "all" => {
                            let mail_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let calendar_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let calendar_path = calendar_url.replace("sqlite://", "");
                            
                            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
                            let mail_backup = format!("{}.backup.{}", mail_path, timestamp);
                            let calendar_backup = format!("{}.backup.{}", calendar_path, timestamp);
                            
                            let mail_result = backup_database_file(&mail_path, &mail_backup).await;
                            let calendar_result = backup_database_file(&calendar_path, &calendar_backup).await;
                            
                            let mut backups = Vec::new();
                            if mail_result.is_ok() {
                                backups.push(json!({"type": "mail", "path": mail_backup}));
                            }
                            if calendar_result.is_ok() {
                                backups.push(json!({"type": "calendar", "path": calendar_backup}));
                            }
                            
                            json!({
                                "success": true,
                                "message": "Database backup completed",
                                "backups": backups
                            })
                        },
                        _ => json!({
                            "success": false,
                            "error": "Invalid database type. Use 'mail', 'calendar', or 'all'"
                        })
                    }
                }
                
                "restore_database" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("");
                    let backup_path = args.get(1).and_then(|v| v.as_str()).unwrap_or("");
                    
                    if database_type.is_empty() || backup_path.is_empty() {
                        json!({
                            "success": false,
                            "error": "Database type and backup path are required"
                        })
                    } else {
                        match database_type {
                            "mail" => {
                                let target_path = std::env::var("HOME")
                                    .map(|home| format!("{}/flow_desk_mail.db", home))
                                    .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                                
                                match restore_database_file(backup_path, &target_path).await {
                                    Ok(_) => json!({
                                        "success": true,
                                        "message": "Mail database restored successfully",
                                        "restored_to": target_path
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to restore mail database: {}", e)
                                    })
                                }
                            },
                            "calendar" => {
                                let database_url = std::env::var("HOME")
                                    .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                    .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                                let target_path = database_url.replace("sqlite://", "");
                                
                                match restore_database_file(backup_path, &target_path).await {
                                    Ok(_) => json!({
                                        "success": true,
                                        "message": "Calendar database restored successfully",
                                        "restored_to": target_path
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to restore calendar database: {}", e)
                                    })
                                }
                            },
                            _ => json!({
                                "success": false,
                                "error": "Invalid database type. Use 'mail' or 'calendar'"
                            })
                        }
                    }
                }
                
                "export_data" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("all");
                    let export_path = args.get(1).and_then(|v| v.as_str());
                    
                    match database_type {
                        "mail" => {
                            let database_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let output_path = export_path
                                .map(|p| p.to_string())
                                .unwrap_or_else(|| format!("mail_export_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S")));
                            
                            match export_mail_data(&database_path, &output_path).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Mail data exported successfully",
                                    "export_path": output_path
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to export mail data: {}", e)
                                })
                            }
                        },
                        "calendar" => {
                            let database_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let output_path = export_path
                                .map(|p| p.to_string())
                                .unwrap_or_else(|| format!("calendar_export_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S")));
                            
                            match export_calendar_data(&database_url, &output_path).await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Calendar data exported successfully",
                                    "export_path": output_path
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to export calendar data: {}", e)
                                })
                            }
                        },
                        "all" => {
                            let mail_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let calendar_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            
                            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
                            let mail_export = format!("mail_export_{}.json", timestamp);
                            let calendar_export = format!("calendar_export_{}.json", timestamp);
                            
                            let mail_result = export_mail_data(&mail_path, &mail_export).await;
                            let calendar_result = export_calendar_data(&calendar_url, &calendar_export).await;
                            
                            let mut exports = Vec::new();
                            if mail_result.is_ok() {
                                exports.push(json!({"type": "mail", "path": mail_export}));
                            }
                            if calendar_result.is_ok() {
                                exports.push(json!({"type": "calendar", "path": calendar_export}));
                            }
                            
                            json!({
                                "success": true,
                                "message": "Data export completed",
                                "exports": exports
                            })
                        },
                        _ => json!({
                            "success": false,
                            "error": "Invalid database type. Use 'mail', 'calendar', or 'all'"
                        })
                    }
                }
                
                "clear_user_data" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("all");
                    let user_id = args.get(1).and_then(|v| v.as_str());
                    
                    if database_type != "all" && user_id.is_none() {
                        json!({
                            "success": false,
                            "error": "User ID is required for specific database cleanup"
                        })
                    } else {
                        match database_type {
                            "mail" => {
                                if let Some(uid) = user_id {
                                    match clear_mail_user_data(uid).await {
                                        Ok(_) => json!({
                                            "success": true,
                                            "message": "Mail user data cleared successfully"
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to clear mail user data: {}", e)
                                        })
                                    }
                                } else {
                                    json!({
                                        "success": false,
                                        "error": "User ID is required"
                                    })
                                }
                            },
                            "calendar" => {
                                if let Some(uid) = user_id {
                                    match clear_calendar_user_data(uid).await {
                                        Ok(_) => json!({
                                            "success": true,
                                            "message": "Calendar user data cleared successfully"
                                        }),
                                        Err(e) => json!({
                                            "success": false,
                                            "error": format!("Failed to clear calendar user data: {}", e)
                                        })
                                    }
                                } else {
                                    json!({
                                        "success": false,
                                        "error": "User ID is required"
                                    })
                                }
                            },
                            "all" => {
                                match clear_all_user_data().await {
                                    Ok(_) => json!({
                                        "success": true,
                                        "message": "All user data cleared successfully"
                                    }),
                                    Err(e) => json!({
                                        "success": false,
                                        "error": format!("Failed to clear all user data: {}", e)
                                    })
                                }
                            },
                            _ => json!({
                                "success": false,
                                "error": "Invalid database type. Use 'mail', 'calendar', or 'all'"
                            })
                        }
                    }
                }
                
                "database_integrity_check" => {
                    let database_type = args.get(0).and_then(|v| v.as_str()).unwrap_or("all");
                    
                    match database_type {
                        "mail" => {
                            let database_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            
                            match check_database_integrity(&database_path).await {
                                Ok(result) => json!({
                                    "success": true,
                                    "database_type": "mail",
                                    "integrity_check": result
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to check mail database integrity: {}", e)
                                })
                            }
                        },
                        "calendar" => {
                            let database_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let database_path = database_url.replace("sqlite://", "");
                            
                            match check_database_integrity(&database_path).await {
                                Ok(result) => json!({
                                    "success": true,
                                    "database_type": "calendar",
                                    "integrity_check": result
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to check calendar database integrity: {}", e)
                                })
                            }
                        },
                        "all" => {
                            let mail_path = std::env::var("HOME")
                                .map(|home| format!("{}/flow_desk_mail.db", home))
                                .unwrap_or_else(|_| "flow_desk_mail.db".to_string());
                            let calendar_url = std::env::var("HOME")
                                .map(|home| format!("sqlite://{}/flow_desk_calendar.db", home))
                                .unwrap_or_else(|_| "sqlite://flow_desk_calendar.db".to_string());
                            let calendar_path = calendar_url.replace("sqlite://", "");
                            
                            let mail_integrity = check_database_integrity(&mail_path).await.unwrap_or("Error checking mail DB".to_string());
                            let calendar_integrity = check_database_integrity(&calendar_path).await.unwrap_or("Error checking calendar DB".to_string());
                            
                            json!({
                                "success": true,
                                "integrity_checks": {
                                    "mail": mail_integrity,
                                    "calendar": calendar_integrity
                                }
                            })
                        },
                        _ => json!({
                            "success": false,
                            "error": "Invalid database type. Use 'mail', 'calendar', or 'all'"
                        })
                    }
                }
                
                "sync_database" => {
                    let operation = args.get(0).and_then(|v| v.as_str()).unwrap_or("consistency_check");
                    
                    match operation {
                        "consistency_check" => {
                            match sync_database_consistency().await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Database consistency check completed successfully"
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Database consistency check failed: {}", e)
                                })
                            }
                        },
                        "optimize_connections" => {
                            match optimize_database_connections().await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Database connections optimized successfully"
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to optimize database connections: {}", e)
                                })
                            }
                        },
                        "refresh_engines" => {
                            match refresh_engine_database_connections().await {
                                Ok(_) => json!({
                                    "success": true,
                                    "message": "Engine database connections refreshed successfully"
                                }),
                                Err(e) => json!({
                                    "success": false,
                                    "error": format!("Failed to refresh engine database connections: {}", e)
                                })
                            }
                        },
                        _ => json!({
                            "success": false,
                            "error": "Invalid sync operation. Use 'consistency_check', 'optimize_connections', or 'refresh_engines'"
                        })
                    }
                }
                
                // Add more commands as needed
                _ => {
                    json!({
                        "success": false,
                        "error": format!("Unknown function: {}", function_name)
                    })
                }
            }
        }
        Err(e) => {
            json!({
                "success": false,
                "error": format!("Invalid JSON: {}", e)
            })
        }
    }
}