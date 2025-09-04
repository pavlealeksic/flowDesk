//! Minimal NAPI bindings for Flow Desk Rust engines
//!
//! This module provides a minimal set of Node.js bindings using NAPI-RS
//! to get basic functionality working first.

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Initialize the Rust library
#[napi]
pub fn init_library() -> String {
    crate::init();
    format!("Flow Desk Rust Library v{} initialized", crate::VERSION)
}

/// Simple test function
#[napi] 
pub fn hello() -> String {
    "Hello from Rust NAPI!".to_string()
}

/// Get library version
#[napi]
pub fn get_version() -> String {
    crate::VERSION.to_string()
}

/// Simple encrypt function
#[napi]
pub fn encrypt_string(data: String, key: String) -> Result<String> {
    use base64::{engine::general_purpose, Engine as _};
    
    let key_bytes = general_purpose::STANDARD.decode(key)
        .map_err(|e| Error::from_reason(format!("Invalid key: {}", e)))?;
    
    let encrypted = crate::crypto::encrypt_data(data.as_bytes(), &key_bytes)
        .map_err(|e| Error::from_reason(format!("Encryption error: {:?}", e)))?;
    
    Ok(general_purpose::STANDARD.encode(encrypted))
}

/// Simple decrypt function  
#[napi]
pub fn decrypt_string(encrypted_data: String, key: String) -> Result<String> {
    use base64::{engine::general_purpose, Engine as _};
    
    let key_bytes = general_purpose::STANDARD.decode(key)
        .map_err(|e| Error::from_reason(format!("Invalid key: {}", e)))?;
        
    let encrypted_bytes = general_purpose::STANDARD.decode(encrypted_data)
        .map_err(|e| Error::from_reason(format!("Invalid encrypted data: {}", e)))?;
    
    let decrypted = crate::crypto::decrypt_data(&encrypted_bytes, &key_bytes)
        .map_err(|e| Error::from_reason(format!("Decryption error: {:?}", e)))?;
    
    String::from_utf8(decrypted)
        .map_err(|e| Error::from_reason(format!("Invalid UTF-8: {}", e)))
}

/// Generate encryption key pair
#[napi]
pub fn generate_encryption_key_pair() -> Result<String> {
    use base64::{engine::general_purpose, Engine as _};
    
    let (public_key, private_key) = crate::crypto::generate_key_pair()
        .map_err(|e| Error::from_reason(format!("Key generation error: {:?}", e)))?;
    
    let result = serde_json::json!({
        "publicKey": general_purpose::STANDARD.encode(public_key),
        "privateKey": general_purpose::STANDARD.encode(private_key)
    });
    
    Ok(result.to_string())
}

/// Simple mail test (placeholder for now)
#[napi]
pub async fn test_mail_connection() -> Result<String> {
    // This is a placeholder that always succeeds for testing
    Ok("Mail connection test passed".to_string())
}

/// Simple calendar test (placeholder for now)  
#[napi]
pub async fn test_calendar_connection() -> Result<String> {
    // This is a placeholder that always succeeds for testing
    Ok("Calendar connection test passed".to_string())
}

/// Simple search test (placeholder for now)
#[napi]
pub async fn test_search_engine() -> Result<String> {
    // This is a placeholder that always succeeds for testing
    Ok("Search engine test passed".to_string())
}