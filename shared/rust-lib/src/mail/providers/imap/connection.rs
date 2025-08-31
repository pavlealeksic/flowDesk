//! IMAP connection management with pooling and automatic reconnection

use super::ImapConfig;
use crate::mail::error::{MailError, MailResult};
use async_imap::{Client, Session};
use async_native_tls::{TlsConnector, TlsStream};
use std::{
    collections::VecDeque,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    net::TcpStream,
    sync::{Mutex, RwLock, Semaphore},
    time::sleep,
};
use tracing::{debug, error, info, warn};

/// IMAP connection wrapper with automatic reconnection
pub struct ImapConnection {
    config: ImapConfig,
    session: Option<Session<TlsStream<TcpStream>>>,
    last_used: Instant,
    connection_id: u64,
    is_idle: bool,
}

impl ImapConnection {
    /// Create new IMAP connection
    pub async fn new(config: ImapConfig, connection_id: u64) -> MailResult<Self> {
        let mut conn = Self {
            config,
            session: None,
            last_used: Instant::now(),
            connection_id,
            is_idle: false,
        };
        
        conn.connect().await?;
        Ok(conn)
    }

    /// Establish connection to IMAP server
    async fn connect(&mut self) -> MailResult<()> {
        debug!("Connecting to IMAP server {}:{}", self.config.imap_host, self.config.imap_port);
        
        let addr = format!("{}:{}", self.config.imap_host, self.config.imap_port);
        let tcp_stream = tokio::time::timeout(
            self.config.connection_timeout,
            TcpStream::connect(&addr)
        ).await
        .map_err(|_| MailError::timeout("IMAP connection"))?
        .map_err(|e| MailError::connection(&format!("Failed to connect to {}: {}", addr, e)))?;

        let session = if self.config.imap_tls {
            // TLS connection
            let connector = TlsConnector::new();
            let tls_stream = connector.connect(&self.config.imap_host, tcp_stream).await
                .map_err(|e| MailError::connection(&format!("TLS handshake failed: {}", e)))?;
            
            let client = Client::new(tls_stream);
            self.authenticate(client).await?
        } else {
            // Plain connection (not recommended for production)
            let client = Client::new(tcp_stream);
            self.authenticate(client).await?
        };

        self.session = Some(session);
        self.last_used = Instant::now();
        
        info!("Successfully connected to IMAP server (connection {})", self.connection_id);
        Ok(())
    }

    /// Authenticate with the IMAP server
    async fn authenticate(&self, client: Client<TlsStream<TcpStream>>) -> MailResult<Session<TlsStream<TlsStream<TcpStream>>>> {
        let session = if self.config.enable_oauth2 {
            // OAuth2 SASL authentication
            if let Some(ref mechanism) = self.config.oauth2_mechanism {
                let oauth_string = format!(
                    "user={}\x01auth=Bearer {}\x01\x01",
                    self.config.username,
                    self.config.password.expose_secret()
                );
                
                client.authenticate(mechanism, &oauth_string).await
                    .map_err(|e| MailError::authentication(&format!("OAuth2 authentication failed: {:?}", e)))?
            } else {
                return Err(MailError::authentication("OAuth2 enabled but no mechanism specified"));
            }
        } else {
            // Plain password authentication
            client.login(&self.config.username, self.config.password.expose_secret()).await
                .map_err(|e| MailError::authentication(&format!("Login failed: {:?}", e)))?
        };

        debug!("Successfully authenticated with IMAP server");
        Ok(session)
    }

    /// Check if connection is alive and reconnect if necessary
    pub async fn ensure_connected(&mut self) -> MailResult<()> {
        if self.session.is_none() || self.is_stale() {
            warn!("IMAP connection {} is stale, reconnecting", self.connection_id);
            self.connect().await?;
        } else {
            // Test the connection with a NOOP command
            if let Some(ref mut session) = self.session {
                if let Err(e) = session.noop().await {
                    warn!("NOOP failed on connection {}, reconnecting: {:?}", self.connection_id, e);
                    self.connect().await?;
                }
            }
        }
        Ok(())
    }

    /// Check if connection is stale based on last use time
    fn is_stale(&self) -> bool {
        self.last_used.elapsed() > Duration::from_secs(300) // 5 minutes
    }

    /// Get the underlying IMAP session
    pub fn session(&mut self) -> MailResult<&mut Session<TlsStream<TcpStream>>> {
        self.last_used = Instant::now();
        self.session.as_mut()
            .ok_or_else(|| MailError::connection("No active IMAP session"))
    }

    /// Mark connection as being used for IDLE
    pub fn set_idle(&mut self, idle: bool) {
        self.is_idle = idle;
    }

    /// Check if connection is in IDLE state
    pub fn is_idle(&self) -> bool {
        self.is_idle
    }

    /// Get connection ID
    pub fn connection_id(&self) -> u64 {
        self.connection_id
    }

    /// Close the connection gracefully
    pub async fn close(&mut self) {
        if let Some(mut session) = self.session.take() {
            if let Err(e) = session.logout().await {
                warn!("Failed to logout from IMAP session {}: {:?}", self.connection_id, e);
            }
        }
        debug!("Closed IMAP connection {}", self.connection_id);
    }
}

impl Drop for ImapConnection {
    fn drop(&mut self) {
        debug!("Dropping IMAP connection {}", self.connection_id);
    }
}

/// IMAP connection pool with intelligent pooling and health monitoring
pub struct ImapConnectionPool {
    config: ImapConfig,
    connections: Arc<Mutex<VecDeque<ImapConnection>>>,
    active_connections: Arc<RwLock<u64>>,
    semaphore: Arc<Semaphore>,
    next_connection_id: Arc<Mutex<u64>>,
    health_check_task: Option<tokio::task::JoinHandle<()>>,
}

impl ImapConnectionPool {
    /// Create new connection pool
    pub async fn new(config: ImapConfig) -> MailResult<Self> {
        let max_connections = config.max_connections;
        
        let pool = Self {
            config,
            connections: Arc::new(Mutex::new(VecDeque::new())),
            active_connections: Arc::new(RwLock::new(0)),
            semaphore: Arc::new(Semaphore::new(max_connections)),
            next_connection_id: Arc::new(Mutex::new(1)),
            health_check_task: None,
        };

        // Start health check task
        let health_check_pool = pool.clone();
        let health_check_task = tokio::spawn(async move {
            health_check_pool.health_check_loop().await;
        });

        Ok(Self {
            health_check_task: Some(health_check_task),
            ..pool
        })
    }

    /// Get a connection from the pool
    pub async fn get_connection(&self) -> MailResult<ImapConnection> {
        // Acquire semaphore permit
        let _permit = self.semaphore.acquire().await
            .map_err(|_| MailError::connection("Failed to acquire connection permit"))?;

        // Try to get an existing connection
        {
            let mut connections = self.connections.lock().await;
            if let Some(mut conn) = connections.pop_front() {
                // Test and ensure connection is still valid
                if let Err(e) = conn.ensure_connected().await {
                    warn!("Failed to reuse pooled connection: {}", e);
                } else {
                    debug!("Reusing pooled IMAP connection {}", conn.connection_id());
                    return Ok(conn);
                }
            }
        }

        // Create new connection
        let connection_id = {
            let mut id = self.next_connection_id.lock().await;
            let current_id = *id;
            *id += 1;
            current_id
        };

        let conn = ImapConnection::new(self.config.clone(), connection_id).await?;
        
        {
            let mut active = self.active_connections.write().await;
            *active += 1;
        }

        debug!("Created new IMAP connection {} (total active: {})", 
               connection_id, *self.active_connections.read().await);
        
        Ok(conn)
    }

    /// Return a connection to the pool
    pub async fn return_connection(&self, mut connection: ImapConnection) {
        if connection.is_idle() {
            // Don't pool IDLE connections
            connection.close().await;
            
            let mut active = self.active_connections.write().await;
            *active = active.saturating_sub(1);
            return;
        }

        // Check if connection is still healthy
        if connection.ensure_connected().await.is_ok() && !connection.is_stale() {
            let mut connections = self.connections.lock().await;
            connections.push_back(connection);
            debug!("Returned connection to pool (pool size: {})", connections.len());
        } else {
            // Connection is unhealthy, close it
            connection.close().await;
            
            let mut active = self.active_connections.write().await;
            *active = active.saturating_sub(1);
        }
    }

    /// Get pool statistics
    pub async fn get_stats(&self) -> PoolStats {
        let connections = self.connections.lock().await;
        let active_connections = *self.active_connections.read().await;
        
        PoolStats {
            pooled_connections: connections.len(),
            active_connections,
            max_connections: self.config.max_connections,
            available_permits: self.semaphore.available_permits(),
        }
    }

    /// Health check loop for maintaining pool health
    async fn health_check_loop(&self) {
        let mut interval = tokio::time::interval(Duration::from_secs(60)); // Check every minute
        
        loop {
            interval.tick().await;
            
            let mut connections = self.connections.lock().await;
            let mut healthy_connections = VecDeque::new();
            let mut closed_count = 0;
            
            while let Some(mut conn) = connections.pop_front() {
                if conn.ensure_connected().await.is_ok() && !conn.is_stale() {
                    healthy_connections.push_back(conn);
                } else {
                    conn.close().await;
                    closed_count += 1;
                }
            }
            
            *connections = healthy_connections;
            
            if closed_count > 0 {
                info!("Health check closed {} stale connections", closed_count);
                
                let mut active = self.active_connections.write().await;
                *active = active.saturating_sub(closed_count);
            }
            
            debug!("Health check completed. Pool size: {}, Active: {}", 
                   connections.len(), *self.active_connections.read().await);
        }
    }

    /// Close all connections and shutdown the pool
    pub async fn shutdown(&mut self) {
        // Cancel health check task
        if let Some(task) = self.health_check_task.take() {
            task.abort();
        }

        // Close all pooled connections
        let mut connections = self.connections.lock().await;
        while let Some(mut conn) = connections.pop_front() {
            conn.close().await;
        }

        info!("IMAP connection pool shutdown completed");
    }
}

impl Clone for ImapConnectionPool {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            connections: Arc::clone(&self.connections),
            active_connections: Arc::clone(&self.active_connections),
            semaphore: Arc::clone(&self.semaphore),
            next_connection_id: Arc::clone(&self.next_connection_id),
            health_check_task: None, // Don't clone the health check task
        }
    }
}

impl Drop for ImapConnectionPool {
    fn drop(&mut self) {
        debug!("Dropping IMAP connection pool");
    }
}

/// Pool statistics for monitoring
#[derive(Debug, Clone)]
pub struct PoolStats {
    pub pooled_connections: usize,
    pub active_connections: u64,
    pub max_connections: usize,
    pub available_permits: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use secrecy::Secret;

    fn create_test_config() -> ImapConfig {
        ImapConfig {
            imap_host: "localhost".to_string(),
            imap_port: 993,
            imap_tls: true,
            username: "test@example.com".to_string(),
            password: Secret::new("password".to_string()),
            max_connections: 5,
            ..Default::default()
        }
    }

    #[test]
    fn test_connection_stale_detection() {
        let config = create_test_config();
        let conn = ImapConnection {
            config,
            session: None,
            last_used: Instant::now() - Duration::from_secs(400), // 6+ minutes ago
            connection_id: 1,
            is_idle: false,
        };
        
        assert!(conn.is_stale());
    }

    #[tokio::test]
    async fn test_pool_creation() {
        let config = create_test_config();
        let pool = ImapConnectionPool::new(config).await;
        
        // Pool creation might fail due to no IMAP server, but the structure should be valid
        match pool {
            Ok(mut pool) => {
                let stats = pool.get_stats().await;
                assert_eq!(stats.pooled_connections, 0);
                assert_eq!(stats.max_connections, 5);
                pool.shutdown().await;
            }
            Err(_) => {
                // Expected if no IMAP server is available
            }
        }
    }
}