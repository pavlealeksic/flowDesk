//! Cross-Platform Keychain Manager
//!
//! Provides secure credential storage across Windows, macOS, and Linux using
//! the system's native keychain/credential manager services.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, error, info, warn};

#[cfg(target_os = "windows")]
use winapi::um::{wincred, winbase, winnt};
#[cfg(target_os = "windows")]
use std::ffi::{CString, OsString};
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStringExt;
#[cfg(target_os = "windows")]
use std::ptr;

#[cfg(target_os = "macos")]
use security_framework::passwords::{SecKeychain, SecPassword};

#[cfg(target_os = "linux")]
use std::process::Command;
#[cfg(target_os = "linux")]
use std::fs;

/// Cross-platform keychain manager for secure credential storage
pub struct KeychainManager {
    service_prefix: String,
}

/// Keychain entry for stored credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeychainEntry {
    pub service: String,
    pub account: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_accessed: Option<chrono::DateTime<chrono::Utc>>,
}

/// Encryption key information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionKey {
    pub key_id: String,
    pub algorithm: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl KeychainManager {
    /// Create a new keychain manager with the specified service prefix
    pub fn new(service_prefix: String) -> Result<Self> {
        info!("Initializing keychain manager for service: {}", service_prefix);
        
        let manager = Self { service_prefix };
        
        // Test keychain availability
        manager.test_keychain_access()?;
        
        Ok(manager)
    }

    /// Store a password in the system keychain
    pub fn store_password(&self, service: &str, account: &str, password: &str) -> Result<()> {
        let full_service = self.get_full_service_name(service);
        debug!("Storing password for service: {}, account: {}", full_service, account);
        
        self.store_password_impl(&full_service, account, password)
            .context("Failed to store password in keychain")
    }

    /// Retrieve a password from the system keychain
    pub fn get_password(&self, service: &str, account: &str) -> Result<String> {
        let full_service = self.get_full_service_name(service);
        debug!("Retrieving password for service: {}, account: {}", full_service, account);
        
        self.get_password_impl(&full_service, account)
            .context("Failed to retrieve password from keychain")
    }

    /// Delete a password from the system keychain
    pub fn delete_password(&self, service: &str, account: &str) -> Result<()> {
        let full_service = self.get_full_service_name(service);
        debug!("Deleting password for service: {}, account: {}", full_service, account);
        
        self.delete_password_impl(&full_service, account)
            .context("Failed to delete password from keychain")
    }

    /// Store arbitrary data in the keychain (for metadata, keys, etc.)
    pub fn store_data(&self, key: &str, data: &str) -> Result<()> {
        let full_service = self.get_full_service_name(key);
        debug!("Storing data for key: {}", full_service);
        
        self.store_password_impl(&full_service, "data", data)
            .context("Failed to store data in keychain")
    }

    /// Retrieve arbitrary data from the keychain
    pub fn get_data(&self, key: &str) -> Result<String> {
        let full_service = self.get_full_service_name(key);
        debug!("Retrieving data for key: {}", full_service);
        
        self.get_password_impl(&full_service, "data")
            .context("Failed to retrieve data from keychain")
    }

    /// Delete arbitrary data from the keychain
    pub fn delete_data(&self, key: &str) -> Result<()> {
        let full_service = self.get_full_service_name(key);
        debug!("Deleting data for key: {}", full_service);
        
        self.delete_password_impl(&full_service, "data")
            .context("Failed to delete data from keychain")
    }

    /// Generate and store a new encryption key
    pub fn generate_encryption_key(&self, key_id: &str, algorithm: &str) -> Result<EncryptionKey> {
        use rand::Rng;
        
        let key_data = match algorithm {
            "AES256" => {
                let key: [u8; 32] = rand::thread_rng().gen();
                base64::encode(key)
            },
            "ChaCha20" => {
                let key: [u8; 32] = rand::thread_rng().gen();
                base64::encode(key)
            },
            _ => return Err(anyhow::anyhow!("Unsupported encryption algorithm: {}", algorithm)),
        };

        let encryption_key = EncryptionKey {
            key_id: key_id.to_string(),
            algorithm: algorithm.to_string(),
            created_at: chrono::Utc::now(),
            expires_at: None,
        };

        // Store the actual key data
        let key_service = format!("encryption-key-{}", key_id);
        self.store_data(&key_service, &key_data)?;

        // Store the key metadata
        let metadata_service = format!("encryption-metadata-{}", key_id);
        let metadata_json = serde_json::to_string(&encryption_key)?;
        self.store_data(&metadata_service, &metadata_json)?;

        info!("Generated and stored encryption key: {} ({})", key_id, algorithm);
        Ok(encryption_key)
    }

    /// Retrieve an encryption key
    pub fn get_encryption_key(&self, key_id: &str) -> Result<(EncryptionKey, String)> {
        // Get key metadata
        let metadata_service = format!("encryption-metadata-{}", key_id);
        let metadata_json = self.get_data(&metadata_service)
            .context("Encryption key metadata not found")?;
        let metadata: EncryptionKey = serde_json::from_str(&metadata_json)
            .context("Failed to parse encryption key metadata")?;

        // Get actual key data
        let key_service = format!("encryption-key-{}", key_id);
        let key_data = self.get_data(&key_service)
            .context("Encryption key data not found")?;

        Ok((metadata, key_data))
    }

    /// Delete an encryption key
    pub fn delete_encryption_key(&self, key_id: &str) -> Result<()> {
        let key_service = format!("encryption-key-{}", key_id);
        let metadata_service = format!("encryption-metadata-{}", key_id);
        
        let _ = self.delete_data(&key_service);
        let _ = self.delete_data(&metadata_service);
        
        info!("Deleted encryption key: {}", key_id);
        Ok(())
    }

    /// List all services with the given prefix
    pub fn list_services_with_prefix(&self, prefix: &str) -> Result<Vec<String>> {
        let full_prefix = self.get_full_service_name(prefix);
        self.list_services_impl(&full_prefix)
    }

    /// Get the full service name with prefix
    fn get_full_service_name(&self, service: &str) -> String {
        format!("{}.{}", self.service_prefix, service)
    }

    /// Test keychain access
    fn test_keychain_access(&self) -> Result<()> {
        let test_service = self.get_full_service_name("test");
        let test_account = "test_account";
        let test_password = "test_password";

        // Try to store and retrieve a test password
        self.store_password_impl(&test_service, test_account, test_password)?;
        let retrieved = self.get_password_impl(&test_service, test_account)?;
        
        if retrieved != test_password {
            return Err(anyhow::anyhow!("Keychain test failed: password mismatch"));
        }

        // Clean up test entry
        let _ = self.delete_password_impl(&test_service, test_account);

        info!("Keychain access test passed");
        Ok(())
    }

    // Platform-specific implementations

    #[cfg(target_os = "windows")]
    fn store_password_impl(&self, service: &str, account: &str, password: &str) -> Result<()> {
        use std::mem;

        let target_name = CString::new(format!("{}:{}", service, account))?;
        let user_name = CString::new(account)?;
        let password_wide: Vec<u16> = OsString::from(password).encode_wide().collect();

        unsafe {
            let mut credential: wincred::CREDENTIALW = mem::zeroed();
            credential.Type = wincred::CRED_TYPE_GENERIC;
            credential.TargetName = target_name.as_ptr() as *mut u16;
            credential.CredentialBlob = password_wide.as_ptr() as *mut u8;
            credential.CredentialBlobSize = (password_wide.len() * 2) as u32;
            credential.UserName = user_name.as_ptr() as *mut u16;
            credential.Persist = wincred::CRED_PERSIST_LOCAL_MACHINE;

            let result = wincred::CredWriteW(&mut credential, 0);
            if result == 0 {
                return Err(anyhow::anyhow!("Failed to store password in Windows Credential Manager"));
            }
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn get_password_impl(&self, service: &str, account: &str) -> Result<String> {
        use std::slice;

        let target_name = CString::new(format!("{}:{}", service, account))?;
        
        unsafe {
            let mut credential_ptr: *mut wincred::CREDENTIALW = ptr::null_mut();
            let result = wincred::CredReadW(
                target_name.as_ptr() as *const u16,
                wincred::CRED_TYPE_GENERIC,
                0,
                &mut credential_ptr,
            );

            if result == 0 {
                return Err(anyhow::anyhow!("Password not found in Windows Credential Manager"));
            }

            let credential = &*credential_ptr;
            let password_bytes = slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            );
            
            // Convert from UTF-16 to String
            let password_wide: &[u16] = slice::from_raw_parts(
                password_bytes.as_ptr() as *const u16,
                password_bytes.len() / 2,
            );
            let password = String::from_utf16_lossy(password_wide);

            wincred::CredFree(credential_ptr as *mut _);
            
            Ok(password)
        }
    }

    #[cfg(target_os = "windows")]
    fn delete_password_impl(&self, service: &str, account: &str) -> Result<()> {
        let target_name = CString::new(format!("{}:{}", service, account))?;
        
        unsafe {
            let result = wincred::CredDeleteW(
                target_name.as_ptr() as *const u16,
                wincred::CRED_TYPE_GENERIC,
                0,
            );

            if result == 0 {
                return Err(anyhow::anyhow!("Failed to delete password from Windows Credential Manager"));
            }
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn list_services_impl(&self, prefix: &str) -> Result<Vec<String>> {
        // Windows credential enumeration is complex, returning empty for now
        // In production, you'd implement CredEnumerateW
        Ok(Vec::new())
    }

    #[cfg(target_os = "macos")]
    fn store_password_impl(&self, service: &str, account: &str, password: &str) -> Result<()> {
        use security_framework::item::{ItemClass, ItemSearchOptions};

        // Delete existing entry if it exists
        let _ = self.delete_password_impl(service, account);

        // Add new password
        let keychain = SecKeychain::default()?;
        keychain.add_generic_password(service, account, password.as_bytes())?;
        
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn get_password_impl(&self, service: &str, account: &str) -> Result<String> {
        let keychain = SecKeychain::default()?;
        let password_data = keychain.find_generic_password(service, account)?;
        let password = String::from_utf8(password_data.as_ref().to_vec())
            .context("Invalid UTF-8 in stored password")?;
        
        Ok(password)
    }

    #[cfg(target_os = "macos")]
    fn delete_password_impl(&self, service: &str, account: &str) -> Result<()> {
        let keychain = SecKeychain::default()?;
        let item = keychain.find_generic_password(service, account)?;
        item.delete();
        
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn list_services_impl(&self, prefix: &str) -> Result<Vec<String>> {
        // macOS keychain enumeration would require more complex Security Framework usage
        // For now, returning empty. In production, you'd use SecItemCopyMatching
        Ok(Vec::new())
    }

    #[cfg(target_os = "linux")]
    fn store_password_impl(&self, service: &str, account: &str, password: &str) -> Result<()> {
        // Try Secret Service API first (most modern)
        if self.try_secret_service_store(service, account, password).is_ok() {
            return Ok(());
        }

        // Fallback to gnome-keyring if available
        if self.try_gnome_keyring_store(service, account, password).is_ok() {
            return Ok(());
        }

        // Last resort: encrypted file storage
        self.try_file_store(service, account, password)
    }

    #[cfg(target_os = "linux")]
    fn get_password_impl(&self, service: &str, account: &str) -> Result<String> {
        // Try Secret Service API first
        if let Ok(password) = self.try_secret_service_get(service, account) {
            return Ok(password);
        }

        // Fallback to gnome-keyring
        if let Ok(password) = self.try_gnome_keyring_get(service, account) {
            return Ok(password);
        }

        // Last resort: encrypted file storage
        self.try_file_get(service, account)
    }

    #[cfg(target_os = "linux")]
    fn delete_password_impl(&self, service: &str, account: &str) -> Result<()> {
        // Try all methods
        let _ = self.try_secret_service_delete(service, account);
        let _ = self.try_gnome_keyring_delete(service, account);
        let _ = self.try_file_delete(service, account);
        
        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn list_services_impl(&self, prefix: &str) -> Result<Vec<String>> {
        // Linux service enumeration would require complex dbus interactions
        // For now, returning empty
        Ok(Vec::new())
    }

    // Linux helper methods
    #[cfg(target_os = "linux")]
    fn try_secret_service_store(&self, service: &str, account: &str, password: &str) -> Result<()> {
        let output = Command::new("secret-tool")
            .args(&["store", "--label", &format!("{} - {}", service, account)])
            .args(&["service", service])
            .args(&["account", account])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?
            .stdin
            .as_mut()
            .unwrap()
            .write_all(password.as_bytes())?;

        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn try_secret_service_get(&self, service: &str, account: &str) -> Result<String> {
        let output = Command::new("secret-tool")
            .args(&["lookup", "service", service, "account", account])
            .output()?;

        if output.status.success() {
            Ok(String::from_utf8(output.stdout)?.trim().to_string())
        } else {
            Err(anyhow::anyhow!("Secret service lookup failed"))
        }
    }

    #[cfg(target_os = "linux")]
    fn try_secret_service_delete(&self, service: &str, account: &str) -> Result<()> {
        let _ = Command::new("secret-tool")
            .args(&["clear", "service", service, "account", account])
            .output()?;
        
        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn try_gnome_keyring_store(&self, service: &str, account: &str, password: &str) -> Result<()> {
        // Similar implementation using gnome-keyring command line tools
        Err(anyhow::anyhow!("Gnome keyring not implemented"))
    }

    #[cfg(target_os = "linux")]
    fn try_gnome_keyring_get(&self, service: &str, account: &str) -> Result<String> {
        Err(anyhow::anyhow!("Gnome keyring not implemented"))
    }

    #[cfg(target_os = "linux")]
    fn try_gnome_keyring_delete(&self, service: &str, account: &str) -> Result<()> {
        Err(anyhow::anyhow!("Gnome keyring not implemented"))
    }

    #[cfg(target_os = "linux")]
    fn try_file_store(&self, service: &str, account: &str, password: &str) -> Result<()> {
        use std::io::Write;
        
        let data_dir = dirs::data_local_dir()
            .context("Could not find local data directory")?
            .join(&self.service_prefix)
            .join("keychain");
        
        fs::create_dir_all(&data_dir)?;
        
        let file_path = data_dir.join(format!("{}_{}.enc", service, account));
        
        // Simple encryption using the system's entropy
        let encrypted = self.simple_encrypt(password)?;
        
        let mut file = fs::File::create(file_path)?;
        file.write_all(&encrypted)?;
        
        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn try_file_get(&self, service: &str, account: &str) -> Result<String> {
        let data_dir = dirs::data_local_dir()
            .context("Could not find local data directory")?
            .join(&self.service_prefix)
            .join("keychain");
        
        let file_path = data_dir.join(format!("{}_{}.enc", service, account));
        let encrypted = fs::read(file_path)?;
        
        self.simple_decrypt(&encrypted)
    }

    #[cfg(target_os = "linux")]
    fn try_file_delete(&self, service: &str, account: &str) -> Result<()> {
        let data_dir = dirs::data_local_dir()
            .context("Could not find local data directory")?
            .join(&self.service_prefix)
            .join("keychain");
        
        let file_path = data_dir.join(format!("{}_{}.enc", service, account));
        let _ = fs::remove_file(file_path);
        
        Ok(())
    }

    #[cfg(target_os = "linux")]
    fn simple_encrypt(&self, data: &str) -> Result<Vec<u8>> {
        // Simple XOR encryption with machine-specific key
        // In production, you'd want proper encryption
        let machine_id = fs::read_to_string("/etc/machine-id")
            .or_else(|_| fs::read_to_string("/var/lib/dbus/machine-id"))?;
        
        let key = machine_id.trim().as_bytes();
        let mut encrypted = Vec::new();
        
        for (i, &byte) in data.as_bytes().iter().enumerate() {
            encrypted.push(byte ^ key[i % key.len()]);
        }
        
        Ok(encrypted)
    }

    #[cfg(target_os = "linux")]
    fn simple_decrypt(&self, encrypted: &[u8]) -> Result<String> {
        let machine_id = fs::read_to_string("/etc/machine-id")
            .or_else(|_| fs::read_to_string("/var/lib/dbus/machine-id"))?;
        
        let key = machine_id.trim().as_bytes();
        let mut decrypted = Vec::new();
        
        for (i, &byte) in encrypted.iter().enumerate() {
            decrypted.push(byte ^ key[i % key.len()]);
        }
        
        String::from_utf8(decrypted).context("Invalid UTF-8 in decrypted data")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keychain_manager_creation() {
        let manager = KeychainManager::new("test-app".to_string());
        assert!(manager.is_ok());
    }

    #[test]
    fn test_service_name_generation() {
        let manager = KeychainManager::new("test-app".to_string()).unwrap();
        let full_name = manager.get_full_service_name("email");
        assert_eq!(full_name, "test-app.email");
    }
}