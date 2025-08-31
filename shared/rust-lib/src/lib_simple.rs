//! Simple NAPI module for testing

use napi_derive::napi;

/// Simple hello function
#[napi]
pub fn hello() -> String {
    "Hello from Rust!".to_string()
}

/// Get version
#[napi]
pub fn get_version() -> String {
    "0.1.0".to_string()
}

/// Add two numbers
#[napi]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}