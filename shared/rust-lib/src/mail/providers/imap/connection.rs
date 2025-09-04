//! IMAP connection management with pooling and automatic reconnection

use super::ImapConfig;
use crate::mail::error::{MailError, MailResult};
use async_imap::{Client, Session, imap_proto};
use async_native_tls::{TlsConnector, TlsStream};
use tokio_util::compat::{Compat, TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt, FuturesAsyncReadCompatExt};
use tokio::net::TcpStream;
use secrecy::ExposeSecret;
use std::{
    collections::VecDeque,
    sync::Arc,
    time::{Duration, Instant},
};

// Type aliases for cleaner code
type TlsCompatStream = TlsStream<Compat<TcpStream>>;
type TcpCompatStream = Compat<TcpStream>;

/// Enum to handle both TLS and plain IMAP sessions
pub enum ImapSession {
    Tls(Session<TlsCompatStream>),
    Plain(Session<TcpCompatStream>),
}

/// Enum to handle both TLS and plain IDLE handles
pub enum IdleHandle {
    Tls(async_imap::extensions::idle::Handle<TlsCompatStream>),
    Plain(async_imap::extensions::idle::Handle<TcpCompatStream>),
}

impl IdleHandle {
    /// Initialize IDLE session
    pub async fn init(&mut self) -> Result<(), async_imap::error::Error> {
        match self {
            IdleHandle::Tls(handle) => handle.init().await,
            IdleHandle::Plain(handle) => handle.init().await,
        }
    }

    /// Wait for IDLE response with timeout
    pub async fn wait_with_timeout(&mut self, timeout: std::time::Duration) -> Result<async_imap::extensions::idle::IdleResponse, async_imap::error::Error> {
        match self {
            IdleHandle::Tls(handle) => {
                let (wait_future, _stop_source) = handle.wait_with_timeout(timeout);
                wait_future.await
            },
            IdleHandle::Plain(handle) => {
                let (wait_future, _stop_source) = handle.wait_with_timeout(timeout);
                wait_future.await
            },
        }
    }

    /// Stop IDLE session
    pub async fn done(self) -> Result<(), async_imap::error::Error> {
        match self {
            IdleHandle::Tls(handle) => handle.done().await.map(|_| ()),
            IdleHandle::Plain(handle) => handle.done().await.map(|_| ()),
        }
    }
}

impl ImapSession {
    /// Execute a NOOP command
    pub async fn noop(&mut self) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.noop().await,
            ImapSession::Plain(session) => session.noop().await,
        }
    }
    
    /// Logout and close the session
    pub async fn logout(self) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(mut session) => session.logout().await,
            ImapSession::Plain(mut session) => session.logout().await,
        }
    }

    /// Select a folder
    pub async fn select(&mut self, folder: &str) -> Result<async_imap::types::Mailbox, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.select(folder).await,
            ImapSession::Plain(session) => session.select(folder).await,
        }
    }

    /// Fetch messages by UID
    pub async fn uid_fetch(&mut self, sequence_set: impl AsRef<str>, query: &str) -> Result<Vec<async_imap::types::Fetch>, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => {
                let stream = session.uid_fetch(sequence_set, query).await?;
                stream.try_collect().await
            },
            ImapSession::Plain(session) => {
                let stream = session.uid_fetch(sequence_set, query).await?;
                stream.try_collect().await
            },
        }
    }

    /// Search for messages
    pub async fn search(&mut self, query: impl AsRef<str>) -> Result<std::collections::HashSet<u32>, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.search(query).await,
            ImapSession::Plain(session) => session.search(query).await,
        }
    }

    /// Append message to folder
    pub async fn append(&mut self, folder: &str, message: &[u8]) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.append(folder, None, None, message).await.map(|_| ()),
            ImapSession::Plain(session) => session.append(folder, None, None, message).await.map(|_| ()),
        }
    }

    /// Store flags for messages
    pub async fn uid_store(&mut self, sequence_set: impl AsRef<str>, query: impl AsRef<str>) -> Result<Vec<async_imap::types::Fetch>, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => {
                let stream = session.uid_store(sequence_set, query).await?;
                stream.try_collect().await
            },
            ImapSession::Plain(session) => {
                let stream = session.uid_store(sequence_set, query).await?;
                stream.try_collect().await
            },
        }
    }

    /// Expunge deleted messages
    pub async fn expunge(&mut self) -> Result<Vec<u32>, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => {
                let stream = session.expunge().await?;
                stream.try_collect().await
            },
            ImapSession::Plain(session) => {
                let stream = session.expunge().await?;
                stream.try_collect().await
            },
        }
    }

    /// Get server capabilities
    pub async fn capabilities(&mut self) -> Result<async_imap::types::Capabilities, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.capabilities().await,
            ImapSession::Plain(session) => session.capabilities().await,
        }
    }

    /// Run a custom command
    pub async fn run_command(&mut self, command: &str) -> Result<imap_proto::RequestId, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.run_command(command).await,
            ImapSession::Plain(session) => session.run_command(command).await,
        }
    }

    /// Start IDLE session for real-time notifications
    pub fn idle(self) -> IdleHandle {
        match self {
            ImapSession::Tls(session) => IdleHandle::Tls(session.idle()),
            ImapSession::Plain(session) => IdleHandle::Plain(session.idle()),
        }
    }

    /// UID copy messages
    pub async fn uid_copy(&mut self, uid_set: &str, mailbox_name: &str) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.uid_copy(uid_set, mailbox_name).await,
            ImapSession::Plain(session) => session.uid_copy(uid_set, mailbox_name).await,
        }
    }

    /// UID move messages
    pub async fn uid_mv(&mut self, uid_set: &str, mailbox_name: &str) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.uid_mv(uid_set, mailbox_name).await,
            ImapSession::Plain(session) => session.uid_mv(uid_set, mailbox_name).await,
        }
    }

    /// UID search messages
    pub async fn uid_search(&mut self, query: &str) -> Result<std::collections::HashSet<u32>, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.uid_search(query).await,
            ImapSession::Plain(session) => session.uid_search(query).await,
        }
    }

    /// List folders
    pub async fn list(&mut self, reference_name: Option<&str>, mailbox_name: Option<&str>) -> Result<Vec<async_imap::types::Name>, async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => {
                let stream = session.list(reference_name, mailbox_name).await?;
                stream.try_collect().await
            },
            ImapSession::Plain(session) => {
                let stream = session.list(reference_name, mailbox_name).await?;
                stream.try_collect().await
            },
        }
    }

    /// Create a mailbox
    pub async fn create(&mut self, mailbox_name: &str) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.create(mailbox_name).await.map(|_| ()),
            ImapSession::Plain(session) => session.create(mailbox_name).await.map(|_| ()),
        }
    }

    /// Subscribe to a mailbox
    pub async fn subscribe(&mut self, mailbox_name: &str) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.subscribe(mailbox_name).await.map(|_| ()),
            ImapSession::Plain(session) => session.subscribe(mailbox_name).await.map(|_| ()),
        }
    }

    /// Unsubscribe from a mailbox
    pub async fn unsubscribe(&mut self, mailbox_name: &str) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.unsubscribe(mailbox_name).await.map(|_| ()),
            ImapSession::Plain(session) => session.unsubscribe(mailbox_name).await.map(|_| ()),
        }
    }

    /// Delete a mailbox
    pub async fn delete(&mut self, mailbox_name: &str) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.delete(mailbox_name).await.map(|_| ()),
            ImapSession::Plain(session) => session.delete(mailbox_name).await.map(|_| ()),
        }
    }

    /// Rename a mailbox
    pub async fn rename(&mut self, from: &str, to: &str) -> Result<(), async_imap::error::Error> {
        match self {
            ImapSession::Tls(session) => session.rename(from, to).await.map(|_| ()),
            ImapSession::Plain(session) => session.rename(from, to).await.map(|_| ()),
        }
    }
}

use tokio::{
    sync::{Mutex, RwLock, Semaphore},
    time::sleep,
};
use tracing::{debug, error, info, warn};
use futures::{AsyncRead, AsyncWrite, StreamExt, TryStreamExt};

/// IMAP connection wrapper with automatic reconnection
pub struct ImapConnection {
    config: ImapConfig,
    session: Option<ImapSession>,
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
        .map_err(|_| MailError::timeout("IMAP connection", 30))?
        .map_err(|e| MailError::connection(&format!("Failed to connect to {}: {}", addr, e)))?;

        let session = if self.config.imap_tls {
            // TLS connection
            let connector = TlsConnector::new();
            let tls_stream = connector.connect(&self.config.imap_host, tcp_stream.compat()).await
                .map_err(|e| MailError::connection(&format!("TLS handshake failed: {}", e)))?;
            
            // The TLS stream is already in futures format, so just use it directly
            let client = Client::new(tls_stream);
            let session = self.authenticate(client).await?;
            ImapSession::Tls(session)
        } else {
            // Plain connection (not recommended for production) 
            let compat_stream = tcp_stream.compat();  
            let client = Client::new(compat_stream);
            let session = self.authenticate(client).await?;
            ImapSession::Plain(session)
        };

        self.session = Some(session);
        self.last_used = Instant::now();
        
        info!("Successfully connected to IMAP server (connection {})", self.connection_id);
        Ok(())
    }

    /// Authenticate with the IMAP server
    async fn authenticate<T>(&self, client: Client<T>) -> MailResult<Session<T>> 
    where 
        T: AsyncRead + AsyncWrite + Unpin + Send + std::fmt::Debug,
    {
        let session = if self.config.enable_oauth2 {
            // OAuth2 SASL authentication
            if let Some(ref mechanism) = self.config.oauth2_mechanism {
                let oauth_string = format!(
                    "user={}\x01auth=Bearer {}\x01\x01",
                    self.config.username,
                    self.config.password.expose_secret()
                );
                
                client.login(&self.config.username, &oauth_string).await
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
    pub fn session(&mut self) -> MailResult<&mut ImapSession> {
        self.last_used = Instant::now();
        self.session.as_mut()
            .ok_or_else(|| MailError::connection("No active IMAP session"))
    }

    /// Take ownership of the session for operations that need it (like IDLE)
    pub fn take_session(&mut self) -> MailResult<ImapSession> {
        self.last_used = Instant::now();
        self.session.take()
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

impl ImapConnectionPool {
    /// Create uninitialized connection pool (for sync constructor compatibility)
    pub fn new_uninitialized() -> Self {
        Self {
            config: ImapConfig::default(),
            connections: Arc::new(Mutex::new(VecDeque::new())),
            active_connections: Arc::new(RwLock::new(0)),
            semaphore: Arc::new(Semaphore::new(1)),
            next_connection_id: Arc::new(Mutex::new(1)),
            health_check_task: None,
        }
    }

    /// Create new connection pool
    pub async fn new(config: ImapConfig) -> MailResult<Self> {
        let max_connections = config.max_connections;
        
        let mut pool = Self {
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

        pool.health_check_task = Some(health_check_task);
        Ok(pool)
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