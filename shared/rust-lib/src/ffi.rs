//! FFI interface for Flow Desk Shared Library
//!
//! This module provides a C-compatible FFI interface that can be called
//! from Node.js using node-ffi-napi or similar libraries.

use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};
use std::ptr;

use crate::{crypto, mail, calendar, search};
use std::sync::Mutex;
use std::collections::HashMap;
use once_cell::sync::Lazy;

// Global state to manage instances
static SEARCH_ENGINES: Lazy<Mutex<HashMap<usize, search::SearchEngine>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static MAIL_ENGINES: Lazy<Mutex<HashMap<usize, mail::MailEngine>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static CALENDAR_ENGINES: Lazy<Mutex<HashMap<usize, calendar::CalendarEngine>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static NEXT_HANDLE: Lazy<Mutex<usize>> = Lazy::new(|| Mutex::new(1));

fn get_next_handle() -> usize {
    let mut handle = NEXT_HANDLE.lock().unwrap();
    let current = *handle;
    *handle += 1;
    current
}

/// Initialize the library
#[no_mangle]
pub extern "C" fn flow_desk_init() -> c_int {
    crate::init();
    0 // Success
}

/// Get library version
#[no_mangle]
pub extern "C" fn flow_desk_version() -> *const c_char {
    let version = CString::new(crate::VERSION).unwrap();
    version.into_raw()
}

/// Free a string allocated by Rust
#[no_mangle]
pub extern "C" fn flow_desk_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}

// Crypto functions
#[no_mangle]
pub extern "C" fn flow_desk_encrypt_data(
    data: *const c_char,
    key: *const c_char,
) -> *mut c_char {
    if data.is_null() || key.is_null() {
        return ptr::null_mut();
    }

    let data_str = unsafe {
        match CStr::from_ptr(data).to_str() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        }
    };

    let key_str = unsafe {
        match CStr::from_ptr(key).to_str() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        }
    };

    // Simple encryption using data as bytes and key as fixed-length key
    let key_bytes = key_str.as_bytes();
    let mut fixed_key = [0u8; 32];
    let key_len = std::cmp::min(key_bytes.len(), 32);
    fixed_key[..key_len].copy_from_slice(&key_bytes[..key_len]);
    
    match crypto::encrypt_data(data_str.as_bytes(), &fixed_key) {
        Ok(encrypted) => {
            let encoded = crypto::encode_base64(&encrypted);
            match CString::new(encoded) {
                Ok(c_string) => c_string.into_raw(),
                Err(_) => ptr::null_mut(),
            }
        }
        Err(_) => ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn flow_desk_decrypt_data(
    encrypted_data: *const c_char,
    key: *const c_char,
) -> *mut c_char {
    if encrypted_data.is_null() || key.is_null() {
        return ptr::null_mut();
    }

    let encrypted_str = unsafe {
        match CStr::from_ptr(encrypted_data).to_str() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        }
    };

    let key_str = unsafe {
        match CStr::from_ptr(key).to_str() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        }
    };

    // Decode base64 and decrypt
    let key_bytes = key_str.as_bytes();
    let mut fixed_key = [0u8; 32];
    let key_len = std::cmp::min(key_bytes.len(), 32);
    fixed_key[..key_len].copy_from_slice(&key_bytes[..key_len]);
    
    match crypto::decode_base64(encrypted_str) {
        Ok(encrypted_bytes) => {
            match crypto::decrypt_data(&encrypted_bytes, &fixed_key) {
                Ok(decrypted) => {
                    match String::from_utf8(decrypted) {
                        Ok(decrypted_str) => {
                            match CString::new(decrypted_str) {
                                Ok(c_string) => c_string.into_raw(),
                                Err(_) => ptr::null_mut(),
                            }
                        }
                        Err(_) => ptr::null_mut(),
                    }
                }
                Err(_) => ptr::null_mut(),
            }
        }
        Err(_) => ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "C" fn flow_desk_hash_password(password: *const c_char) -> *mut c_char {
    if password.is_null() {
        return ptr::null_mut();
    }

    let password_str = unsafe {
        match CStr::from_ptr(password).to_str() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        }
    };

    let hash = crypto::hash_to_hex(password_str.as_bytes());
    match CString::new(hash) {
        Ok(c_string) => c_string.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

// Search functions
#[no_mangle]
pub extern "C" fn flow_desk_search_create() -> usize {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("FlowDesk")
        .join("search_index");
    
    let config = search::SearchConfig {
        index_dir: data_dir,
        max_memory_mb: 256,
        max_response_time_ms: 300,
        num_threads: 4,
        enable_analytics: true,
        enable_suggestions: true,
        enable_realtime: true,
        providers: vec![],
    };
    
    let rt = tokio::runtime::Runtime::new().unwrap();
    let engine = match rt.block_on(search::SearchEngine::new(config)) {
        Ok(engine) => engine,
        Err(_) => return 0, // Error - return invalid handle
    };
    
    let handle = get_next_handle();
    let mut engines = SEARCH_ENGINES.lock().unwrap();
    engines.insert(handle, engine);
    handle
}

#[no_mangle]
pub extern "C" fn flow_desk_search_destroy(handle: usize) {
    let mut engines = SEARCH_ENGINES.lock().unwrap();
    engines.remove(&handle);
}

#[no_mangle]
pub extern "C" fn flow_desk_search_add_document(
    handle: usize,
    id: *const c_char,
    title: *const c_char,
    content: *const c_char,
    source: *const c_char,
) -> c_int {
    if id.is_null() || title.is_null() || content.is_null() || source.is_null() {
        return -1;
    }

    let id_str = unsafe {
        match CStr::from_ptr(id).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let title_str = unsafe {
        match CStr::from_ptr(title).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let content_str = unsafe {
        match CStr::from_ptr(content).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let source_str = unsafe {
        match CStr::from_ptr(source).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let document = search::SearchDocument {
        id: id_str.to_string(),
        title: title_str.to_string(),
        content: content_str.to_string(),
        summary: None,
        content_type: search::ContentType::Document,
        provider_id: source_str.to_string(),
        provider_type: search::ProviderType::LocalFiles,
        account_id: None,
        file_path: None,
        url: None,
        icon: None,
        thumbnail: None,
        metadata: search::DocumentMetadata {
            author: None,
            created_at: Some(chrono::Utc::now()),
            modified_at: Some(chrono::Utc::now()),
            file_size: None,
            size: None,
            file_type: None,
            mime_type: None,
            language: None,
            tags: Vec::new(),
            custom_fields: std::collections::HashMap::new(),
            location: None,
            collaboration: None,
            activity: None,
            priority: None,
            status: None,
            custom: std::collections::HashMap::new(),
        },
        tags: vec![],
        categories: vec![],
        author: None,
        created_at: chrono::Utc::now(),
        last_modified: chrono::Utc::now(),
        indexing_info: search::IndexingInfo {
            indexed_at: chrono::Utc::now(),
            version: 1,
            checksum: "".to_string(),
            index_type: search::IndexType::Full,
        },
    };

    let mut engines = SEARCH_ENGINES.lock().unwrap();
    if let Some(engine) = engines.get_mut(&handle) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        match rt.block_on(engine.index_document(document)) {
            Ok(_) => 0,
            Err(_) => -1,
        }
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn flow_desk_search_query(
    handle: usize,
    query: *const c_char,
    limit: c_int,
) -> *mut c_char {
    if query.is_null() || limit <= 0 {
        return ptr::null_mut();
    }

    let query_str = unsafe {
        match CStr::from_ptr(query).to_str() {
            Ok(s) => s,
            Err(_) => return ptr::null_mut(),
        }
    };

    let search_query = search::SearchQuery {
        query: query_str.to_string(),
        content_types: None,
        provider_ids: None,
        filters: None,
        sort: None,
        limit: Some(limit as usize),
        offset: None,
        options: search::SearchOptions::default(),
    };

    let mut engines = SEARCH_ENGINES.lock().unwrap();
    if let Some(engine) = engines.get_mut(&handle) {
        let rt = tokio::runtime::Runtime::new().unwrap();
        match rt.block_on(engine.search(search_query)) {
            Ok(results) => {
                match serde_json::to_string(&results) {
                    Ok(json) => {
                        match CString::new(json) {
                            Ok(c_string) => c_string.into_raw(),
                            Err(_) => ptr::null_mut(),
                        }
                    }
                    Err(_) => ptr::null_mut(),
                }
            }
            Err(_) => ptr::null_mut(),
        }
    } else {
        ptr::null_mut()
    }
}

// Mail functions
#[no_mangle]
pub extern "C" fn flow_desk_mail_create_engine() -> usize {
    // TODO: Implement proper MailEngine initialization with config, database, and auth
    // For now return 0 as invalid handle since MailEngine::new requires complex setup
    0
}

#[no_mangle]
pub extern "C" fn flow_desk_mail_destroy_engine(handle: usize) {
    let mut engines = MAIL_ENGINES.lock().unwrap();
    engines.remove(&handle);
}

#[no_mangle]
pub extern "C" fn flow_desk_mail_add_account(
    handle: usize,
    account_id: *const c_char,
    email: *const c_char,
    provider: *const c_char,
    display_name: *const c_char,
) -> c_int {
    if account_id.is_null() || email.is_null() || provider.is_null() || display_name.is_null() {
        return -1;
    }

    let account_id_str = unsafe {
        match CStr::from_ptr(account_id).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let email_str = unsafe {
        match CStr::from_ptr(email).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let provider_str = unsafe {
        match CStr::from_ptr(provider).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let display_name_str = unsafe {
        match CStr::from_ptr(display_name).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    // TODO: Implement proper MailAccount creation with all required fields
    // MailAccount needs Uuid, MailProvider enum, status, timestamps, etc.
    // For now return error since proper implementation is complex
    -1
}

// Calendar functions
#[no_mangle]
pub extern "C" fn flow_desk_calendar_create_engine() -> usize {
    // TODO: Implement proper CalendarEngine initialization with config
    // CalendarEngine::new requires CalendarConfig and is async
    // For now return 0 as invalid handle
    0
}

#[no_mangle]
pub extern "C" fn flow_desk_calendar_destroy_engine(handle: usize) {
    let mut engines = CALENDAR_ENGINES.lock().unwrap();
    engines.remove(&handle);
}

#[no_mangle]
pub extern "C" fn flow_desk_calendar_add_account(
    handle: usize,
    account_id: *const c_char,
    email: *const c_char,
    provider: *const c_char,
    display_name: *const c_char,
) -> c_int {
    if account_id.is_null() || email.is_null() || provider.is_null() || display_name.is_null() {
        return -1;
    }

    let account_id_str = unsafe {
        match CStr::from_ptr(account_id).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let email_str = unsafe {
        match CStr::from_ptr(email).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let provider_str = unsafe {
        match CStr::from_ptr(provider).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    let display_name_str = unsafe {
        match CStr::from_ptr(display_name).to_str() {
            Ok(s) => s,
            Err(_) => return -1,
        }
    };

    // TODO: Implement proper CalendarAccount creation with all required fields
    // CalendarAccount needs proper Uuid, CalendarProvider enum, status, timestamps, etc.
    // For now return error since proper implementation is complex
    -1
}

// Test function to verify the library is working
#[no_mangle]
pub extern "C" fn flow_desk_test() -> *mut c_char {
    let test_msg = "Flow Desk Rust Library is working correctly!";
    match CString::new(test_msg) {
        Ok(c_string) => c_string.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}