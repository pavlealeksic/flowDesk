fn main() {
    #[cfg(feature = "napi")]
    {
        napi_build::setup();
        
        // Add Node.js specific linking for macOS arm64
        if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
            // Ensure proper linking with Node.js
            println!("cargo:rustc-link-arg=-undefined");
            println!("cargo:rustc-link-arg=dynamic_lookup");
        }
        
        // Tell cargo to invalidate the built crate whenever the NAPI build changes
        println!("cargo:rerun-if-changed=build.rs");
        println!("cargo:rerun-if-env-changed=NODE_INCLUDE_PATH");
    }
    
    // Only rebuild when this file changes
    println!("cargo:rerun-if-changed=build.rs");
}