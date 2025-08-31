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
        verifySignatures: process.env.NODE_ENV !== 'development'
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
      const userId = 'current-user-id'; // TODO: Get from actual user session
      const workspaceId = options.workspaceId;
      
      // Use marketplace manager to install the plugin
      const marketplaceManager = pluginRuntimeManager.getMarketplaceManager();
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

    logger.debug(`Storage keys request from ${pluginId}`);
    return [];
  });

  ipcMain.handle('plugin:storage:getUsage', async (event) => {
    const webContents = event.sender;
    const pluginId = getPluginIdFromWebContents(webContents);
    
    if (!pluginId) {
      throw new Error('Could not determine plugin context');
    }

    logger.debug(`Storage usage request from ${pluginId}`);
    return 0;
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
        const mainWindow = pluginRuntimeManager.getMainWindow();
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
    
    logger.info(`Dialog request from ${pluginId}`, options);
    
    // In a real implementation, this would show a dialog
    return null;
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
    // In a real implementation, this would sanitize HTML
    logger.debug('HTML sanitization request');
    return html; // Simplified for demo
  });

  ipcMain.handle('plugin:security:validateCSP', async (event, csp: string) => {
    // In a real implementation, this would validate CSP
    logger.debug('CSP validation request');
    return true; // Simplified for demo
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
 * Get plugin runtime manager instance
 */
export function getPluginRuntimeManager(): PluginRuntimeManager | null {
  return pluginRuntimeManager;
}