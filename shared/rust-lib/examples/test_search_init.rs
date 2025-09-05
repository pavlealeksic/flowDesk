//! Test search engine initialization
//! 
//! This example verifies that the search engine can be initialized properly
//! and handles the meta.json file issue correctly.

use flow_desk_shared::search::{SearchEngine, SearchConfig, IndexManager};
use tempfile::TempDir;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt().init();
    
    println!("Testing search engine initialization...");
    
    // Test 1: Create search engine with new index
    let temp_dir = TempDir::new()?;
    println!("Test 1: Creating new index at: {:?}", temp_dir.path());
    
    let config = SearchConfig {
        index_dir: temp_dir.path().to_path_buf(),
        max_memory_mb: 64, // Small memory for test
        max_response_time_ms: 1000,
        num_threads: 1,
        enable_analytics: false,
        enable_suggestions: false,
        enable_realtime: false,
        providers: Vec::new(),
    };
    
    let engine = SearchEngine::new(config).await?;
    println!("✅ Search engine created successfully");
    
    let health_status = engine.get_health_status().await;
    println!("Health status: healthy={}, documents={}", health_status.is_healthy, health_status.total_documents);
    
    // Test 2: Create index manager directly
    let temp_dir2 = TempDir::new()?;
    println!("\nTest 2: Creating index manager at: {:?}", temp_dir2.path());
    
    let index_manager = IndexManager::new(temp_dir2.path(), 64).await?;
    println!("✅ IndexManager created successfully");
    
    // Test 3: Simulate corrupted index directory
    let temp_dir3 = TempDir::new()?;
    println!("\nTest 3: Testing corrupted index recovery at: {:?}", temp_dir3.path());
    
    // Create some garbage files but no proper meta.json
    tokio::fs::write(temp_dir3.path().join("garbage.file"), b"invalid content").await?;
    tokio::fs::write(temp_dir3.path().join("meta.json.backup"), b"not the real meta.json").await?;
    
    let index_manager2 = IndexManager::new(temp_dir3.path(), 64).await?;
    println!("✅ Index recovered from corruption successfully");
    
    let is_healthy = index_manager2.is_healthy().await?;
    println!("Recovered index health: {}", is_healthy);
    
    println!("\n🎉 All tests passed! Search engine initialization is working correctly.");
    Ok(())
}