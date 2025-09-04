use shared_rust_lib::calendar::providers::{CalDavProvider, CalendarProviderTrait};
use shared_rust_lib::calendar::types::{CalDavConfig, CalendarAccountCredentials};
use shared_rust_lib::calendar::CalendarResult;

#[tokio::main]
async fn main() -> CalendarResult<()> {
    println!("Testing CalDAV implementation...");
    
    let config = CalDavConfig {
        server_url: "https://caldav.example.com".to_string(),
        host: "caldav.example.com".to_string(),
        username: "test_user".to_string(),
        password: "test_pass".to_string(),
        accept_invalid_certs: true,
        oauth_tokens: None,
    };
    
    let credentials = CalendarAccountCredentials {
        access_token: "".to_string(),
        refresh_token: None,
        expires_at: None,
        auth_type: Some("basic".to_string()),
        username: Some("test_user".to_string()),
        password: Some("test_pass".to_string()),
    };
    
    let mut provider = CalDavProvider::new(
        "test_account".to_string(),
        config,
        Some(credentials)
    )?;
    
    println!("CalDAV provider created successfully!");
    println!("Provider type: {:?}", provider.provider_type());
    println!("Account ID: {}", provider.account_id());
    
    // Test basic functionality (won't actually connect to real server)
    println!("Testing get_sync_token...");
    let sync_token = provider.get_sync_token("test_calendar").await?;
    println!("Sync token: {:?}", sync_token);
    
    println!("Testing is_sync_token_valid...");
    let is_valid = provider.is_sync_token_valid("dummy_token").await?;
    println!("Token valid: {}", is_valid);
    
    println!("CalDAV implementation test completed successfully!");
    
    Ok(())
}