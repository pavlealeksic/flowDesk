/**
 * Plugin Integration - Integrates the plugin system with the main Electron process
 * 
 * This module sets up IPC handlers for plugin operations and initializes
 * the plugin runtime system.
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { PluginRuntimeManager } from './plugin-runtime/PluginRuntimeManager';
import { PluginLogger } from './plugin-runtime/utils/PluginLogger';

let pluginRuntimeManager: PluginRuntimeManager | null = null;
const logger = new PluginLogger('PluginIntegration');

/**
 * Initialize the plugin system
 */
export async function initializePluginSystem(mainWindow: BrowserWindow): Promise<void> {
  logger.info('Initializing plugin system integration');

  try {
    // Configure plugin runtime
    const pluginConfig = {
      pluginDir: path.join(os.homedir(), '.flowdesk', 'plugins'),
      userDataDir: path.join(os.homedir(), '.flowdesk'),
      developmentMode: process.env.NODE_ENV === 'development',
      maxConcurrentPlugins: 50,
      executionTimeout: 30000, // 30 seconds
      security: {
        strictCSP: true,
        allowedOrigins: ['https://api.slack.com', 'https://api.notion.com'],
        verifySignatures: process.env.NODE_ENV !== 'development',
        auditLogging: true
      }
    };

    // Initialize plugin runtime
    pluginRuntimeManager = new PluginRuntimeManager(pluginConfig);
    await pluginRuntimeManager.initialize(mainWindow);

    // Setup IPC handlers
    setupPluginIPCHandlers();

    logger.info('Plugin system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize plugin system', error);
    throw error;
  }
}

/**
 * Shutdown the plugin system
 */
export async function shutdownPluginSystem(): Promise<void> {
  if (pluginRuntimeManager) {
    logger.info('Shutting down plugin system');
    await pluginRuntimeManager.shutdown();
    pluginRuntimeManager = null;
  }
}

/**
 * Setup IPC handlers for plugin operations
 */
function setupPluginIPCHandlers(): void {
  // Plugin Management
  ipcMain.handle('plugin-manager:getInstalledPlugins', async () => {
    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    return pluginRuntimeManager.getPluginInstallations();
  });

  ipcMain.handle('plugin-manager:installPlugin', async (
    event, 
    pluginId: string, 
    options: any = {}
  ) => {
    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    
    try {
      logger.info(`Installing plugin: ${pluginId}`, options);
      
      // Get current user context (would come from session/auth)
      const userId = 'default-user'; // Simplified user management
      const workspaceId = options.workspaceId;
      
      // Use marketplace manager to install the plugin
      const marketplaceManager = pluginRuntimeManager?.getMarketplaceManager();
      const installationId = await marketplaceManager.installPlugin(
        pluginId,
        userId,
        workspaceId,
        options
      );
      
      return { success: true, installationId };
    } catch (error) {
      logger.error(`Plugin installation failed for ${pluginId}`, error);
      throw error;
    }
  });

  ipcMain.handle('plugin-manager:uninstallPlugin', async (event, installationId: string) => {
    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    return pluginRuntimeManager.uninstallPlugin(installationId);
  });

  ipcMain.handle('plugin-manager:enablePlugin', async (event, installationId: string) => {
    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    return pluginRuntimeManager.enablePlugin(installationId);
  });

  ipcMain.handle('plugin-manager:disablePlugin', async (event, installationId: string) => {
    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    return pluginRuntimeManager.disablePlugin(installationId);
  });

  ipcMain.handle('plugin-manager:searchPlugins', async (event, searchOptions: any) => {
    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    
    try {
      logger.info('Plugin search request', searchOptions);
      
      const marketplaceManager = pluginRuntimeManager.getMarketplaceManager();
      const results = await marketplaceManager.searchPlugins(searchOptions);
      
      return results;
    } catch (error) {
      logger.error('Plugin search failed', error);
      // Return empty array on error to gracefully handle offline scenarios
      return [];
    }
  });

  // Plugin Runtime Operations
  ipcMain.handle('plugin:executeAction', async (event, installationId: string, action: string, params: any) => {
    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    return pluginRuntimeManager.executePluginAction(installationId, action, params);
  });

  // Plugin Storage Operations (used by plugin preload script)
  ipcMain.handle('plugin:storage:get', async (event, key: string) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');
    
    try {
      const storageManager = pluginRuntimeManager.getStorageManager();
      const value = await storageManager.get(pluginId, key);
      logger.debug(`Storage get request from ${pluginId}: ${key} -> ${value !== null ? 'found' : 'not found'}`);
      return value;
    } catch (error) {
      logger.error(`Storage get failed for ${pluginId}:${key}`, error);
      throw error;
    }
  });

  ipcMain.handle('plugin:storage:set', async (event, key: string, value: any) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');

    try {
      const storageManager = pluginRuntimeManager.getStorageManager();
      await storageManager.set(pluginId, key, value);
      logger.debug(`Storage set request from ${pluginId}: ${key}`);
    } catch (error) {
      logger.error(`Storage set failed for ${pluginId}:${key}`, error);
      throw error;
    }
  });

  ipcMain.handle('plugin:storage:remove', async (event, key: string) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    logger.debug(`Storage remove request from ${pluginId}: ${key}`);
  });

  ipcMain.handle('plugin:storage:clear', async (event) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    logger.debug(`Storage clear request from ${pluginId}`);
  });

  ipcMain.handle('plugin:storage:keys', async (event) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');

    try {
      const storageManager = pluginRuntimeManager.getStorageManager();
      const keys = await storageManager.getKeys(pluginId);
      logger.debug(`Storage keys request from ${pluginId}: ${keys.length} keys found`);
      return keys;
    } catch (error) {
      logger.error(`Storage keys request failed for ${pluginId}`, error);
      throw error;
    }
  });

  ipcMain.handle('plugin:storage:getUsage', async (event) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');

    try {
      const storageManager = pluginRuntimeManager.getStorageManager();
      const usage = await storageManager.getUsage(pluginId);
      logger.debug(`Storage usage request from ${pluginId}: ${usage} bytes`);
      return usage;
    } catch (error) {
      logger.error(`Storage usage request failed for ${pluginId}`, error);
      return 0; // Return 0 on error instead of throwing
    }
  });

  // Plugin Events
  ipcMain.on('plugin:events:emit', (event, type: string, data: any) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      logger.warn('Event emit from unknown plugin context');
      return;
    }

    logger.debug(`Event emit from ${pluginId}: ${type}`);
  });

  // Plugin UI Operations
  ipcMain.handle('plugin:ui:showNotification', async (event, options: any) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');

    try {
      const securityManager = pluginRuntimeManager.getSecurityManager();
      
      // Validate notification permission
      const hasNotificationPermission = securityManager.hasPermission(pluginId, 'notifications');
      if (!hasNotificationPermission) {
        throw new Error('Plugin does not have notification permission');
      }

      logger.info(`Notification request from ${pluginId}`, options);
      
      // Show native system notification
      const { Notification } = await import('electron');
      
      if (!Notification.isSupported()) {
        throw new Error('Notifications not supported on this system');
      }

      const notification = new Notification({
        title: options.title || 'Flow Desk Plugin',
        body: options.body || options.message || '',
        icon: options.icon,
        silent: options.silent || false,
        urgency: options.urgency || 'normal',
        timeoutType: options.timeout ? 'default' : 'never',
        actions: options.actions || []
      });

      // Handle notification events
      notification.on('click', () => {
        // Notify the plugin about notification click
        const mainWindow = pluginRuntimeManager?.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send('plugin:notification:clicked', {
            pluginId,
            notificationId: options.id
          });
        }
      });

      notification.show();
      return { success: true, notificationId: Date.now().toString() };
    } catch (error) {
      logger.error(`Notification failed for plugin ${pluginId}`, error);
      throw error;
    }
  });

  ipcMain.handle('plugin:ui:showDialog', async (event, options: any) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }
    
    logger.info(`Dialog request from ${pluginId}`, options);
    
    try {
      const { dialog, BrowserWindow } = require('electron');
      const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      
      // Default dialog options
      const dialogOptions: Electron.MessageBoxOptions = {
        type: options.type || 'info',
        title: options.title || `Plugin: ${pluginId}`,
        message: options.message || '',
        detail: options.detail,
        buttons: options.buttons || ['OK'],
        defaultId: options.defaultId || 0,
        cancelId: options.cancelId,
        noLink: true
      };

      // Show dialog with parent window if available
      const result = mainWindow 
        ? await dialog.showMessageBox(mainWindow, dialogOptions)
        : await dialog.showMessageBox(dialogOptions);

      logger.debug(`Dialog result from ${pluginId}:`, result);
      return {
        response: result.response,
        checkboxChecked: result.checkboxChecked
      };
    } catch (error) {
      logger.error(`Dialog failed for plugin ${pluginId}`, error);
      throw error;
    }
  });

  ipcMain.handle('plugin:ui:getTheme', async () => {
    // Return current theme information
    return {
      mode: 'light', // Would get from actual theme system
      colors: {
        primary: '#0066cc',
        background: '#ffffff',
        foreground: '#000000'
      }
    };
  });

  // Plugin Network Operations
  ipcMain.handle('plugin:network:fetch', async (event, url: string, options: any) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    if (!pluginRuntimeManager) throw new Error('Plugin runtime not initialized');

    try {
      const securityManager = pluginRuntimeManager.getSecurityManager();
      
      // Validate network permission
      const hasNetworkPermission = securityManager.hasPermission(pluginId, 'network');
      if (!hasNetworkPermission) {
        throw new Error('Plugin does not have network permission');
      }

      // Validate URL against allowed domains
      const allowedDomains = securityManager.getAllowedDomains(pluginId);
      if (allowedDomains.length > 0) {
        const urlObj = new URL(url);
        if (!allowedDomains.includes(urlObj.hostname)) {
          throw new Error(`Network access denied for domain: ${urlObj.hostname}`);
        }
      }

      logger.debug(`Network request from ${pluginId}: ${url}`);
      
      // Make the actual request with security restrictions
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, {
        ...options,
        timeout: 30000, // 30 second timeout
        redirect: 'manual', // Don't follow redirects automatically
        headers: {
          ...options.headers,
          'User-Agent': `FlowDesk-Plugin/${pluginId}`
        }
      });

      // Convert response to serializable format
      const responseData = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: await response.text()
      };

      return responseData;
    } catch (error) {
      logger.error(`Network request failed for ${pluginId}: ${url}`, error);
      throw error;
    }
  });

  // Plugin Logging
  ipcMain.on('plugin:logger:debug', (event, message: string, args: any[]) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (pluginId) {
      const pluginLogger = PluginLogger.forPlugin(pluginId);
      pluginLogger.debug(message, args);
    }
  });

  ipcMain.on('plugin:logger:info', (event, message: string, args: any[]) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (pluginId) {
      const pluginLogger = PluginLogger.forPlugin(pluginId);
      pluginLogger.info(message, args);
    }
  });

  ipcMain.on('plugin:logger:warn', (event, message: string, args: any[]) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (pluginId) {
      const pluginLogger = PluginLogger.forPlugin(pluginId);
      pluginLogger.warn(message, args);
    }
  });

  ipcMain.on('plugin:logger:error', (event, message: string, args: any[]) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (pluginId) {
      const pluginLogger = PluginLogger.forPlugin(pluginId);
      pluginLogger.error(message, args);
    }
  });

  // Plugin Lifecycle
  ipcMain.on('plugin:lifecycle:ready', (event) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (pluginId) {
      logger.info(`Plugin ready: ${pluginId}`);
    }
  });

  ipcMain.on('plugin:lifecycle:unload', (event) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (pluginId) {
      logger.info(`Plugin unloading: ${pluginId}`);
    }
  });

  // Plugin Security
  ipcMain.handle('plugin:security:sanitizeHTML', async (event, html: string) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    logger.debug(`HTML sanitization request from ${pluginId}`);
    
    try {
      // Basic HTML sanitization - remove dangerous elements and attributes
      let sanitized = html;
      
      // Remove script tags and their content
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // Remove dangerous attributes
      const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
      for (const attr of dangerousAttrs) {
        const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
        sanitized = sanitized.replace(regex, '');
      }
      
      // Remove javascript: URLs
      sanitized = sanitized.replace(/javascript:/gi, '');
      
      // Remove data: URLs (except images)
      sanitized = sanitized.replace(/data:(?!image\/)/gi, '');
      
      // Remove vbscript: URLs
      sanitized = sanitized.replace(/vbscript:/gi, '');
      
      // Remove dangerous tags
      const dangerousTags = ['object', 'embed', 'applet', 'iframe', 'frame', 'frameset', 'meta', 'link', 'style', 'base'];
      for (const tag of dangerousTags) {
        const regex = new RegExp(`<${tag}\\b[^>]*>.*?<\\/${tag}>`, 'gi');
        sanitized = sanitized.replace(regex, '');
        // Also remove self-closing tags
        const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/>`, 'gi');
        sanitized = sanitized.replace(selfClosingRegex, '');
      }
      
      logger.debug(`HTML sanitized for ${pluginId}: ${html.length} -> ${sanitized.length} chars`);
      return sanitized;
    } catch (error) {
      logger.error(`HTML sanitization failed for ${pluginId}`, error);
      // Return empty string on error for security
      return '';
    }
  });

  ipcMain.handle('plugin:security:validateCSP', async (event, csp: string) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    logger.debug(`CSP validation request from ${pluginId}`);
    
    try {
      // Basic CSP validation - check for dangerous directives
      if (!csp || typeof csp !== 'string') {
        return { valid: false, error: 'Invalid CSP format' };
      }

      const directives = csp.split(';').map(d => d.trim()).filter(Boolean);
      const issues: string[] = [];
      
      // Check for unsafe directives
      const unsafePatterns = [
        "'unsafe-inline'",
        "'unsafe-eval'",
        "data:",
        "*",
        "http://",
        "'unsafe-hashes'"
      ];

      for (const directive of directives) {
        for (const unsafePattern of unsafePatterns) {
          if (directive.includes(unsafePattern)) {
            // Allow 'unsafe-inline' for style-src in development
            if (directive.startsWith('style-src') && unsafePattern === "'unsafe-inline'" && process.env.NODE_ENV === 'development') {
              continue;
            }
            issues.push(`Potentially unsafe directive: ${directive}`);
          }
        }
      }

      // Check for missing essential directives
      const hasDefaultSrc = directives.some(d => d.startsWith('default-src'));
      const hasScriptSrc = directives.some(d => d.startsWith('script-src'));
      
      if (!hasDefaultSrc && !hasScriptSrc) {
        issues.push('Missing script-src or default-src directive');
      }

      const valid = issues.length === 0;
      
      logger.debug(`CSP validation for ${pluginId}: ${valid ? 'PASS' : 'FAIL'}`, issues);
      
      return {
        valid,
        issues,
        error: valid ? undefined : `CSP validation failed: ${issues.join(', ')}`
      };
    } catch (error) {
      logger.error(`CSP validation failed for ${pluginId}`, error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  });

  logger.info('Plugin IPC handlers registered');
}

/**
 * Get plugin ID from WebContents context
 * In a real implementation, this would properly track plugin contexts
 */
function getPluginIdFromWebContents(webContents: Electron.WebContents): string | null {
  // This is a simplified implementation
  // In reality, you'd need to track which WebContents belongs to which plugin
  const url = webContents.getURL();
  
  // Check if this is a plugin context based on URL or other identifier
  if (url.includes('plugin://') || url.includes('file://') && url.includes('plugins')) {
    // Extract plugin ID from URL or use a mapping
    return 'unknown-plugin'; // Would be replaced with actual plugin ID
  }
  
  return null;
}

/**
 * Get current user ID from session or authentication context
 */
async function getCurrentUserId(): Promise<string> {
  try {
    // In a production app, this would get from your authentication system
    // For now, return a default user ID
    return 'current-user-id';
  } catch (error) {
    logger.warn('Failed to get current user ID, using default');
    return 'default-user';
  }
}

/**
 * Get plugin runtime manager instance
 */
export function getPluginRuntimeManager(): PluginRuntimeManager | null {
  return pluginRuntimeManager;
}