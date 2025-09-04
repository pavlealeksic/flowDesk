/*!
 * Pure Rust Database Operations Module
 * 
 * This module provides a complete SQLite database backend for Flow Desk,
 * handling all database operations including initialization, migrations,
 * and CRUD operations for mail, calendar, and workspace data.
 */

use sqlx::{SqlitePool, Row, Transaction, Sqlite, migrate::MigrateDatabase};
use std::path::Path;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, debug, error, warn};

pub mod mail_db;
pub mod calendar_db;
pub mod migrations;

use crate::mail::database::MailDatabase;
use crate::calendar::database::CalendarDatabase;

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub mail_db_path: String,
    pub calendar_db_path: String,
    pub search_index_path: String,
    pub user_data_path: String,
    pub schema_version: u32,
}

/// Database initialization progress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInitProgress {
    pub stage: String,
    pub progress: u32,
    pub message: String,
    pub details: Option<String>,
}

/// Migration status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub id: String,
    pub applied: bool,
    pub applied_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

/// Database health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseHealth {
    pub healthy: bool,
    pub issues: Vec<String>,
    pub recommendations: Vec<String>,
}

/// Complete database manager for all Flow Desk data
pub struct FlowDeskDatabase {
    pub config: DatabaseConfig,
    pub mail_db: Option<MailDatabase>,
    pub calendar_db: Option<CalendarDatabase>,
}

impl FlowDeskDatabase {
    /// Create new database instance
    pub async fn new(config: DatabaseConfig) -> Result<Self, DatabaseError> {
        info!("Initializing Flow Desk database with config: {:?}", config);
        
        Ok(Self {
            config,
            mail_db: None,
            calendar_db: None,
        })
    }

    /// Initialize all databases with proper schema
    pub async fn initialize_databases(&self) -> Result<Vec<DatabaseInitProgress>, DatabaseError> {
        let mut progress = Vec::new();
        
        // Step 1: Setup directories
        progress.push(DatabaseInitProgress {
            stage: "directories".to_string(),
            progress: 10,
            message: "Creating database directories".to_string(),
            details: None,
        });
        self.setup_directories().await?;
        
        // Step 2: Initialize mail database
        progress.push(DatabaseInitProgress {
            stage: "mail_db".to_string(),
            progress: 30,
            message: "Initializing mail database".to_string(),
            details: None,
        });
        self.initialize_mail_database().await?;
        
        // Step 3: Initialize calendar database
        progress.push(DatabaseInitProgress {
            stage: "calendar_db".to_string(),
            progress: 60,
            message: "Initializing calendar database".to_string(),
            details: None,
        });
        self.initialize_calendar_database().await?;
        
        // Step 4: Run migrations
        progress.push(DatabaseInitProgress {
            stage: "migrations".to_string(),
            progress: 80,
            message: "Running database migrations".to_string(),
            details: None,
        });
        self.run_all_migrations().await?;
        
        // Step 5: Validate databases
        progress.push(DatabaseInitProgress {
            stage: "validation".to_string(),
            progress: 90,
            message: "Validating database integrity".to_string(),
            details: None,
        });
        self.validate_all_databases().await?;
        
        progress.push(DatabaseInitProgress {
            stage: "complete".to_string(),
            progress: 100,
            message: "Database initialization completed successfully".to_string(),
            details: None,
        });
        
        info!("Database initialization completed successfully");
        Ok(progress)
    }

    /// Setup required directories
    async fn setup_directories(&self) -> Result<(), DatabaseError> {
        let mail_db_dir = Path::new(&self.config.mail_db_path).parent().unwrap().to_string_lossy().to_string();
        let calendar_db_dir = Path::new(&self.config.calendar_db_path).parent().unwrap().to_string_lossy().to_string();
        let search_index_dir = Path::new(&self.config.search_index_path).parent().unwrap().to_string_lossy().to_string();
        
        let directories = vec![
            self.config.user_data_path.as_str(),
            mail_db_dir.as_str(),
            calendar_db_dir.as_str(),
            search_index_dir.as_str(),
        ];

        for dir in directories {
            tokio::fs::create_dir_all(dir).await
                .map_err(|e| DatabaseError::IoError {
                    message: format!("Failed to create directory {}: {}", dir, e),
                    path: dir.to_string(),
                    operation: "create_dir_all".to_string(),
                })?;
        }

        info!("Database directories created successfully");
        Ok(())
    }

    /// Initialize mail database
    async fn initialize_mail_database(&self) -> Result<(), DatabaseError> {
        // Create database file if it doesn't exist
        if !sqlx::Sqlite::database_exists(&self.config.mail_db_path).await.unwrap_or(false) {
            sqlx::Sqlite::create_database(&self.config.mail_db_path).await
                .map_err(|e| DatabaseError::ConnectionError {
                    message: format!("Failed to create mail database: {}", e),
                    database_path: self.config.mail_db_path.clone(),
                    connection_string: format!("sqlite:{}", self.config.mail_db_path),
                })?;
        }

        info!("Mail database initialized successfully");
        Ok(())
    }

    /// Initialize calendar database
    async fn initialize_calendar_database(&self) -> Result<(), DatabaseError> {
        // Create database file if it doesn't exist
        if !sqlx::Sqlite::database_exists(&self.config.calendar_db_path).await.unwrap_or(false) {
            sqlx::Sqlite::create_database(&self.config.calendar_db_path).await
                .map_err(|e| DatabaseError::ConnectionError {
                    message: format!("Failed to create calendar database: {}", e),
                    database_path: self.config.calendar_db_path.clone(),
                    connection_string: format!("sqlite:{}", self.config.calendar_db_path),
                })?;
        }

        info!("Calendar database initialized successfully");
        Ok(())
    }

    /// Run all database migrations
    async fn run_all_migrations(&self) -> Result<Vec<MigrationStatus>, DatabaseError> {
        let mut statuses = Vec::new();
        
        // Run mail database migrations
        let mail_db = MailDatabase::new(&self.config.mail_db_path).await
            .map_err(|e| DatabaseError::ConnectionError {
                message: format!("Failed to connect to mail database: {}", e),
                database_path: self.config.mail_db_path.clone(),
                connection_string: format!("sqlite:{}", self.config.mail_db_path),
            })?;

        // Run calendar database migrations  
        let calendar_db = CalendarDatabase::new(&format!("sqlite:{}", self.config.calendar_db_path)).await
            .map_err(|e| DatabaseError::ConnectionError {
                message: format!("Failed to connect to calendar database: {}", e),
                database_path: self.config.calendar_db_path.clone(),
                connection_string: format!("sqlite:{}", self.config.calendar_db_path),
            })?;

        info!("All database migrations completed successfully");
        Ok(statuses)
    }

    /// Validate all databases
    async fn validate_all_databases(&self) -> Result<Vec<DatabaseHealth>, DatabaseError> {
        let mut health_reports = Vec::new();
        
        // Validate mail database
        let mail_health = self.validate_database(&self.config.mail_db_path, "mail").await?;
        health_reports.push(mail_health);
        
        // Validate calendar database
        let calendar_health = self.validate_database(&self.config.calendar_db_path, "calendar").await?;
        health_reports.push(calendar_health);
        
        Ok(health_reports)
    }

    /// Validate a specific database
    async fn validate_database(&self, db_path: &str, db_type: &str) -> Result<DatabaseHealth, DatabaseError> {
        let mut issues = Vec::new();
        let mut recommendations = Vec::new();

        // Check if database file exists
        if !Path::new(db_path).exists() {
            issues.push(format!("{} database file does not exist: {}", db_type, db_path));
            recommendations.push("Run database initialization to create the database".to_string());
            return Ok(DatabaseHealth {
                healthy: false,
                issues,
                recommendations,
            });
        }

        // Connect to database and run integrity check
        let database_url = format!("sqlite:{}", db_path);
        let pool = SqlitePool::connect(&database_url).await
            .map_err(|e| DatabaseError::ConnectionError {
                message: format!("Failed to connect to {} database: {}", db_type, e),
                database_path: db_path.to_string(),
                connection_string: database_url,
            })?;

        // Run PRAGMA integrity_check
        let integrity_result = sqlx::query("PRAGMA integrity_check")
            .fetch_one(&pool)
            .await
            .map_err(|e| DatabaseError::ValidationError {
                message: format!("Failed to run integrity check: {}", e),
                database: db_type.to_string(),
                check_type: "integrity".to_string(),
            })?;

        let integrity_status: String = integrity_result.get(0);
        if integrity_status != "ok" {
            issues.push(format!("{} database integrity check failed: {}", db_type, integrity_status));
            recommendations.push("Consider running database repair or restoring from backup".to_string());
        }

        // Check foreign key constraints
        let fk_result = sqlx::query("PRAGMA foreign_key_check")
            .fetch_all(&pool)
            .await
            .map_err(|e| DatabaseError::ValidationError {
                message: format!("Failed to check foreign keys: {}", e),
                database: db_type.to_string(),
                check_type: "foreign_keys".to_string(),
            })?;

        if !fk_result.is_empty() {
            issues.push("Foreign key constraint violations detected".to_string());
            recommendations.push("Review and fix data integrity issues".to_string());
        }

        pool.close().await;

        let healthy = issues.is_empty();
        Ok(DatabaseHealth {
            healthy,
            issues,
            recommendations,
        })
    }

    /// Get mail database instance
    pub async fn get_mail_db(&mut self) -> Result<&MailDatabase, DatabaseError> {
        if self.mail_db.is_none() {
            let db = MailDatabase::new(&self.config.mail_db_path).await
                .map_err(|e| DatabaseError::ConnectionError {
                    message: format!("Failed to connect to mail database: {}", e),
                    database_path: self.config.mail_db_path.clone(),
                    connection_string: format!("sqlite:{}", self.config.mail_db_path),
                })?;
            self.mail_db = Some(db);
        }
        Ok(self.mail_db.as_ref().unwrap())
    }

    /// Get calendar database instance
    pub async fn get_calendar_db(&mut self) -> Result<&CalendarDatabase, DatabaseError> {
        if self.calendar_db.is_none() {
            let db = CalendarDatabase::new(&format!("sqlite:{}", self.config.calendar_db_path)).await
                .map_err(|e| DatabaseError::ConnectionError {
                    message: format!("Failed to connect to calendar database: {}", e),
                    database_path: self.config.calendar_db_path.clone(),
                    connection_string: format!("sqlite:{}", self.config.calendar_db_path),
                })?;
            self.calendar_db = Some(db);
        }
        Ok(self.calendar_db.as_ref().unwrap())
    }

    /// Repair corrupted databases
    pub async fn repair_databases(&self) -> Result<Vec<DatabaseHealth>, DatabaseError> {
        info!("Starting database repair process");
        
        let mut health_reports = Vec::new();
        
        // Repair mail database
        let mail_repair = self.repair_database(&self.config.mail_db_path, "mail").await?;
        health_reports.push(mail_repair);
        
        // Repair calendar database
        let calendar_repair = self.repair_database(&self.config.calendar_db_path, "calendar").await?;
        health_reports.push(calendar_repair);
        
        info!("Database repair process completed");
        Ok(health_reports)
    }

    /// Repair a specific database
    async fn repair_database(&self, db_path: &str, db_type: &str) -> Result<DatabaseHealth, DatabaseError> {
        let database_url = format!("sqlite:{}", db_path);
        let pool = SqlitePool::connect(&database_url).await
            .map_err(|e| DatabaseError::ConnectionError {
                message: format!("Failed to connect to {} database for repair: {}", db_type, e),
                database_path: db_path.to_string(),
                connection_string: database_url,
            })?;

        info!("Repairing {} database", db_type);
        
        // Run VACUUM to rebuild database
        sqlx::query("VACUUM").execute(&pool).await
            .map_err(|e| DatabaseError::RepairError {
                message: format!("VACUUM failed for {} database: {}", db_type, e),
                database: db_type.to_string(),
                operation: "vacuum".to_string(),
            })?;

        // Reindex all tables
        sqlx::query("REINDEX").execute(&pool).await
            .map_err(|e| DatabaseError::RepairError {
                message: format!("REINDEX failed for {} database: {}", db_type, e),
                database: db_type.to_string(),
                operation: "reindex".to_string(),
            })?;

        // Analyze for query optimization
        sqlx::query("ANALYZE").execute(&pool).await
            .map_err(|e| DatabaseError::RepairError {
                message: format!("ANALYZE failed for {} database: {}", db_type, e),
                database: db_type.to_string(),
                operation: "analyze".to_string(),
            })?;

        pool.close().await;

        // Validate after repair
        self.validate_database(db_path, db_type).await
    }

    /// Backup databases
    pub async fn backup_databases(&self, backup_dir: &str) -> Result<Vec<String>, DatabaseError> {
        tokio::fs::create_dir_all(backup_dir).await
            .map_err(|e| DatabaseError::IoError {
                message: format!("Failed to create backup directory: {}", e),
                path: backup_dir.to_string(),
                operation: "create_dir_all".to_string(),
            })?;

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let mut backup_files = Vec::new();

        // Backup mail database
        let mail_backup = format!("{}/mail_db_{}.db", backup_dir, timestamp);
        tokio::fs::copy(&self.config.mail_db_path, &mail_backup).await
            .map_err(|e| DatabaseError::IoError {
                message: format!("Failed to backup mail database: {}", e),
                path: self.config.mail_db_path.clone(),
                operation: "copy".to_string(),
            })?;
        backup_files.push(mail_backup);

        // Backup calendar database
        let calendar_backup = format!("{}/calendar_db_{}.db", backup_dir, timestamp);
        tokio::fs::copy(&self.config.calendar_db_path, &calendar_backup).await
            .map_err(|e| DatabaseError::IoError {
                message: format!("Failed to backup calendar database: {}", e),
                path: self.config.calendar_db_path.clone(),
                operation: "copy".to_string(),
            })?;
        backup_files.push(calendar_backup);

        info!("Database backup completed: {:?}", backup_files);
        Ok(backup_files)
    }
}

/// Database error types
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Connection error: {message}")]
    ConnectionError {
        message: String,
        database_path: String,
        connection_string: String,
    },

    #[error("Migration error: {message}")]
    MigrationError {
        message: String,
        migration_id: String,
        database: String,
    },

    #[error("Validation error: {message}")]
    ValidationError {
        message: String,
        database: String,
        check_type: String,
    },

    #[error("Repair error: {message}")]
    RepairError {
        message: String,
        database: String,
        operation: String,
    },

    #[error("IO error: {message}")]
    IoError {
        message: String,
        path: String,
        operation: String,
    },

    #[error("Serialization error: {message}")]
    SerializationError {
        message: String,
        data_type: String,
    },

    #[error("SQL execution error: {message}")]
    SqlError {
        message: String,
        query: String,
        database: String,
    },
}

impl From<sqlx::Error> for DatabaseError {
    fn from(err: sqlx::Error) -> Self {
        DatabaseError::SqlError {
            message: err.to_string(),
            query: "unknown".to_string(),
            database: "unknown".to_string(),
        }
    }
}

impl From<std::io::Error> for DatabaseError {
    fn from(err: std::io::Error) -> Self {
        DatabaseError::IoError {
            message: err.to_string(),
            path: "unknown".to_string(),
            operation: "unknown".to_string(),
        }
    }
}

impl From<serde_json::Error> for DatabaseError {
    fn from(err: serde_json::Error) -> Self {
        DatabaseError::SerializationError {
            message: err.to_string(),
            data_type: "unknown".to_string(),
        }
    }
}