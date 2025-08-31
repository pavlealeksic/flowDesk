/**
 * Plugin Sandbox Manager - Provides secure isolated execution environment for plugins
 * 
 * This manager creates and manages sandboxed execution contexts for plugins,
 * ensuring they cannot access unauthorized system resources or interfere with
 * the main application or other plugins.
 */

import { BrowserWindow, BrowserView, webContents, session } from 'electron';
import * as path from 'path';
import { PluginManifest, PluginInstallation, PluginRuntimeContext } from '@flow-desk/shared';
import { PluginSecurityManager } from '../security/PluginSecurityManager';
import { PluginExecutionContext } from './PluginExecutionContext';
import { PluginLogger } from '../utils/PluginLogger';

export interface SandboxConfig {
  /** Maximum memory usage in MB */
  maxMemoryMB: number;
  /** Execution timeout in ms */
  timeoutMs: number;
  /** Allow network access */
  allowNetworkAccess: boolean;
  /** Allow file system access */
  allowFileSystemAccess: boolean;
  /** Allowed domains for network requests */
  allowedDomains: string[];
  /** CSP policy */
  contentSecurityPolicy: string;
}

/**
 * Plugin Sandbox Manager
 * 
 * Creates isolated execution environments for plugins using Electron's
 * security features and custom sandboxing mechanisms.
 */
export class PluginSandboxManager {
  private readonly logger: PluginLogger;
  private readonly securityManager: PluginSecurityManager;
  private readonly executionContexts = new Map<string, PluginExecutionContext>();
  private readonly sandboxSessions = new Map<string, Electron.Session>();

  constructor(securityManager: PluginSecurityManager) {
    this.logger = new PluginLogger('PluginSandboxManager');
    this.securityManager = securityManager;
  }

  /**
   * Initialize the sandbox manager
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing plugin sandbox manager');
    
    // Setup default sandbox session
    this.setupDefaultSandboxSession();
    
    this.logger.info('Plugin sandbox manager initialized');
  }

  /**
   * Shutdown the sandbox manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down plugin sandbox manager');
    
    // Destroy all execution contexts
    const destroyPromises = Array.from(this.executionContexts.values()).map(
      context => context.destroy()
    );
    await Promise.allSettled(destroyPromises);
    
    // Clear maps
    this.executionContexts.clear();
    this.sandboxSessions.clear();
    
    this.logger.info('Plugin sandbox manager shut down');
  }

  /**
   * Create a new sandboxed execution context for a plugin
   */
  async createExecutionContext(
    installation: PluginInstallation,
    manifest: PluginManifest,
    runtimeContext: PluginRuntimeContext
  ): Promise<PluginExecutionContext> {
    const pluginId = installation.pluginId;
    this.logger.info(`Creating sandbox for plugin ${pluginId}`);

    try {
      // Generate sandbox configuration
      const sandboxConfig = this.generateSandboxConfig(installation, manifest);
      
      // Create isolated session for the plugin
      const sandboxSession = this.createPluginSession(pluginId, sandboxConfig);
      
      // Create execution context
      const executionContext = new PluginExecutionContext(
        installation,
        manifest,
        runtimeContext,
        sandboxConfig,
        sandboxSession,
        this.securityManager
      );

      // Store the context
      this.executionContexts.set(installation.id, executionContext);
      this.sandboxSessions.set(pluginId, sandboxSession);

      this.logger.info(`Sandbox created for plugin ${pluginId}`);
      return executionContext;
    } catch (error) {
      this.logger.error(`Failed to create sandbox for plugin ${pluginId}`, error);
      throw error;
    }
  }

  /**
   * Destroy a plugin's execution context
   */
  async destroyExecutionContext(installationId: string): Promise<void> {
    const context = this.executionContexts.get(installationId);
    if (!context) return;

    this.logger.info(`Destroying sandbox for installation ${installationId}`);

    try {
      await context.destroy();
      this.executionContexts.delete(installationId);
      
      // Clean up session
      const pluginId = context.getInstallation().pluginId;
      const sandboxSession = this.sandboxSessions.get(pluginId);
      if (sandboxSession) {
        await sandboxSession.clearCache();
        await sandboxSession.clearStorageData();
        this.sandboxSessions.delete(pluginId);
      }

      this.logger.info(`Sandbox destroyed for installation ${installationId}`);
    } catch (error) {
      this.logger.error(`Failed to destroy sandbox for installation ${installationId}`, error);
      throw error;
    }
  }

  /**
   * Get execution context by installation ID
   */
  getExecutionContext(installationId: string): PluginExecutionContext | undefined {
    return this.executionContexts.get(installationId);
  }

  /**
   * Get all active execution contexts
   */
  getExecutionContexts(): PluginExecutionContext[] {
    return Array.from(this.executionContexts.values());
  }

  /**
   * Private: Generate sandbox configuration for a plugin
   */
  private generateSandboxConfig(
    installation: PluginInstallation,
    manifest: PluginManifest
  ): SandboxConfig {
    const hasNetworkPermission = installation.grantedPermissions.includes('network');
    const hasFileSystemPermission = installation.grantedPermissions.includes('filesystem');
    
    return {
      maxMemoryMB: 128, // Default 128MB memory limit
      timeoutMs: 30000, // 30 second timeout
      allowNetworkAccess: hasNetworkPermission,
      allowFileSystemAccess: hasFileSystemPermission,
      allowedDomains: this.extractAllowedDomains(manifest),
      contentSecurityPolicy: this.generateCSP(manifest, hasNetworkPermission)
    };
  }

  /**
   * Private: Extract allowed domains from manifest
   */
  private extractAllowedDomains(manifest: PluginManifest): string[] {
    // Extract domains from homepage, repository, documentation URLs
    const urls = [
      manifest.homepage,
      manifest.repository,
      manifest.documentation
    ].filter(Boolean) as string[];

    const domains = urls.map(url => {
      try {
        return new URL(url).hostname;
      } catch {
        return null;
      }
    }).filter(Boolean) as string[];

    return Array.from(new Set(domains));
  }

  /**
   * Private: Generate Content Security Policy for plugin
   */
  private generateCSP(manifest: PluginManifest, allowNetwork: boolean): string {
    const allowedDomains = this.extractAllowedDomains(manifest);
    
    let csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
    
    if (allowNetwork && allowedDomains.length > 0) {
      csp += ` connect-src 'self' ${allowedDomains.join(' ')};`;
      csp += ` img-src 'self' data: ${allowedDomains.join(' ')};`;
    } else {
      csp += " connect-src 'self'; img-src 'self' data:;";
    }
    
    csp += " object-src 'none'; base-uri 'self'; form-action 'self';";
    
    return csp;
  }

  /**
   * Private: Create isolated session for plugin
   */
  private createPluginSession(pluginId: string, config: SandboxConfig): Electron.Session {
    const sessionName = `plugin-${pluginId}`;
    const pluginSession = session.fromPartition(sessionName, { cache: true });

    // Configure session security
    pluginSession.setPermissionRequestHandler((webContents, permission, callback) => {
      this.logger.debug(`Permission request for ${pluginId}: ${permission}`);
      
      // Only allow specific permissions based on plugin configuration
      const allowedPermissions = ['notifications'];
      if (config.allowNetworkAccess) {
        allowedPermissions.push('geolocation', 'media');
      }
      
      callback(allowedPermissions.includes(permission));
    });

    // Set up CSP
    pluginSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};
      
      if (!responseHeaders['content-security-policy']) {
        responseHeaders['content-security-policy'] = [config.contentSecurityPolicy];
      }
      
      callback({ responseHeaders });
    });

    // Block unauthorized network requests
    if (!config.allowNetworkAccess) {
      pluginSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        // Allow local resources
        if (details.url.startsWith('file://') || 
            details.url.startsWith('data:') ||
            details.url.includes('localhost')) {
          callback({});
          return;
        }
        
        // Block external requests if network access not allowed
        this.logger.warn(`Blocked network request from ${pluginId}: ${details.url}`);
        callback({ cancel: true });
      });
    } else if (config.allowedDomains.length > 0) {
      // Only allow requests to specified domains
      pluginSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        try {
          const url = new URL(details.url);
          const isAllowed = config.allowedDomains.includes(url.hostname) ||
                          details.url.startsWith('file://') ||
                          details.url.startsWith('data:') ||
                          url.hostname === 'localhost' ||
                          url.hostname === '127.0.0.1';
          
          if (!isAllowed) {
            this.logger.warn(`Blocked unauthorized network request from ${pluginId}: ${details.url}`);
            callback({ cancel: true });
            return;
          }
        } catch (error) {
          this.logger.warn(`Invalid URL from ${pluginId}: ${details.url}`);
          callback({ cancel: true });
          return;
        }
        
        callback({});
      });
    }

    // Set memory and cache limits
    pluginSession.setUserAgent(pluginSession.getUserAgent() + ` FlowDesk-Plugin/${pluginId}`);

    return pluginSession;
  }

  /**
   * Private: Setup default sandbox session configuration
   */
  private setupDefaultSandboxSession(): void {
    // Configure default security settings for all plugin sessions
    const defaultSession = session.defaultSession;
    
    // Block dangerous protocols
    const dangerousProtocols = ['shell', 'command', 'ftp'];
    dangerousProtocols.forEach(protocol => {
      defaultSession.protocol.interceptFileProtocol(protocol, (request, callback) => {
        this.logger.warn(`Blocked dangerous protocol: ${protocol}`);
        callback({ error: -3 }); // net::ERR_ABORTED
      });
    });

    this.logger.debug('Default sandbox session configured');
  }
}