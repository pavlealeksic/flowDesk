//! Flow Desk Shared Library
//!
//! This library contains shared functionality for Flow Desk applications,
//! including cryptographic operations, data validation, and common utilities.

#[cfg(feature = "napi")]
use napi_derive::napi;

// Core modules that are always available
pub mod crypto;
pub mod types;
pub mod utils;
pub mod config_sync;
pub mod vector_clock;

// Full featured modules with real implementations
pub mod mail;
pub mod calendar;
pub mod search;
pub mod storage;
pub mod transports;
pub mod database;
// pub mod ai; // Temporarily disabled for audit

// NAPI bindings
#[cfg(feature = "napi")]
pub mod napi_bindings_minimal;

#[cfg(feature = "napi")]
pub use napi_bindings_minimal::*;

// FFI bindings
#[cfg(feature = "ffi")]
pub mod ffi;

// Re-export core functionality
pub use crypto::*;
pub use types::*;
pub use utils::*;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

/// Library version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Initialize the library
pub fn init() {
    // Initialize tracing only if not already initialized
    let _ = tracing_subscriber::fmt::try_init();
    tracing::info!("Flow Desk Shared Library v{} initialized", VERSION);
}

/// Simple test function for NAPI
#[cfg(feature = "napi")]
#[napi]
pub fn hello() -> String {
    "Hello from Rust!".to_string()
}

#[cfg(feature = "wasm")]
#[wasm_bindgen(start)]
pub fn wasm_main() {
    init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init() {
        init(); // Should not panic
    }

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }
}