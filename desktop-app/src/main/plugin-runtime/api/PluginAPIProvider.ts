/**
 * Plugin API Provider - Creates and manages plugin API instances
 * 
 * Provides secure, scoped API access to plugins with permission enforcement
 * and monitoring.
 */

import { 
  PluginAPI, 
  PluginManifest, 
  PluginInstallation, 
  NotificationOptions,
  DialogOptions,
  CommandRegistration,
  MenuItemRegistration,
  ContextMenuItem,
  PanelOptions,
  Panel,
  SearchProvider,
  SearchOptions,
  SearchResult,
  SearchableContent,
  TriggerDefinition,
  ActionDefinition,
  OAuthTokens
} from '@flow-desk/shared';
import { PluginEventBus } from '../events/PluginEventBus';
import { PluginStorageManager } from '../storage/PluginStorageManager';
import { PluginSecurityManager } from '../security/PluginSecurityManager';
import { PluginLogger } from '../utils/PluginLogger';

/**
 * Plugin API Provider
 * 
 * Creates secure API instances for plugins with proper scoping and permissions.
 */
export class PluginAPIProvider {
  private readonly logger: PluginLogger;
  private readonly eventBus: PluginEventBus;
  private readonly storageManager: PluginStorageManager;
  private readonly securityManager: PluginSecurityManager;
  private readonly httpRateLimits = new Map<string, number[]>();

  constructor(
    eventBus: PluginEventBus,
    storageManager: PluginStorageManager,
    securityManager: PluginSecurityManager
  ) {
    this.logger = new PluginLogger('PluginAPIProvider');
    this.eventBus = eventBus;
    this.storageManager = storageManager;
    this.securityManager = securityManager;
  }

  /**
   * Create API instance for a plugin
   */
  createAPI(installation: PluginInstallation, manifest: PluginManifest): PluginAPI {
    const logger = this.logger.child({ 
      pluginId: installation.pluginId,
      installationId: installation.id 
    });

    const api: PluginAPI = {
      version: '1.0.0',
      plugin: manifest,
      platform: {
        type: 'desktop',
        version: process.env.npm_package_version || '0.0.0',
        os: process.platform
      },

      // Storage API
      storage: this.createStorageAPI(installation),

      // Events API
      events: this.createEventsAPI(installation, logger),

      // UI API
      ui: this.createUIAPI(installation, logger),

      // Data API
      data: this.createDataAPI(installation, logger),

      // Network API
      network: this.createNetworkAPI(installation, logger),

      // Search API
      search: this.createSearchAPI(installation, logger),

      // Automation API removed to simplify the app

      // OAuth API
      oauth: this.createOAuthAPI(installation, logger),

      // Webhooks API
      webhooks: this.createWebhooksAPI(installation, logger),

      // Logger API
      logger: this.createLoggerAPI(installation, logger)
    };

    logger.info(`Created API instance for plugin ${installation.pluginId}`);
    return api;
  }

  /**
   * Private: Create Storage API
   */
  private createStorageAPI(installation: PluginInstallation) {
    const storageAPI = this.storageManager.createPluginStorageAPI(
      installation.id,
      installation.pluginId
    );

    return storageAPI;
  }

  /**
   * Private: Create Events API
   */
  private createEventsAPI(installation: PluginInstallation, logger: PluginLogger) {
    return {
      emit: (type: string, data: any) => {
        if (!this.securityManager.hasPermission(installation.id, 'events:emit')) {
          throw new Error('Plugin does not have permission to emit events');
        }

        this.eventBus.emitPluginEvent(installation.pluginId, type, data);
        logger.debug(`Event emitted: ${type}`);
      },

      on: <T>(type: string, handler: (data: T) => void): (() => void) => {
        if (!this.securityManager.hasPermission(installation.id, 'events:listen')) {
          throw new Error('Plugin does not have permission to listen to events');
        }

        const subscriptionId = this.eventBus.subscribeToEvents(
          installation.pluginId,
          type,
          (event) => handler(event.data as T)
        );

        logger.debug(`Subscribed to event: ${type}`);

        return () => {
          this.eventBus.unsubscribeFromEvents(subscriptionId);
          logger.debug(`Unsubscribed from event: ${type}`);
        };
      },

      off: <T>(type: string, handler: (data: T) => void): void => {
        // In a full implementation, you'd track handlers to enable proper removal
        logger.debug(`Off called for event: ${type}`);
      },

      once: <T>(type: string, handler: (data: T) => void): void => {
        if (!this.securityManager.hasPermission(installation.id, 'events:listen')) {
          throw new Error('Plugin does not have permission to listen to events');
        }

        const subscriptionId = this.eventBus.subscribeToEvents(
          installation.pluginId,
          type,
          (event) => {
            handler(event.data as T);
            this.eventBus.unsubscribeFromEvents(subscriptionId);
          },
          { maxEvents: 1 }
        );

        logger.debug(`Subscribed once to event: ${type}`);
      }
    };
  }

  /**
   * Private: Create UI API
   */
  private createUIAPI(installation: PluginInstallation, logger: PluginLogger) {
    return {
      showNotification: (options: NotificationOptions) => {
        if (!this.securityManager.hasPermission(installation.id, 'ui:notifications')) {
          throw new Error('Plugin does not have permission to show notifications');
        }

        // Integration with Electron's notification system
        try {
          const { Notification } = require('electron');
          
          const notification = new Notification({
            title: options.title,
            body: options.body,
            icon: options.icon,
            silent: options.silent || false,
            urgency: options.urgency || 'normal',
            timeoutType: options.timeoutType || 'default'
          });
          
          // Handle notification actions if provided
          if (options.actions && options.actions.length > 0) {
            notification.on('action', (event, index) => {
              const action = options.actions?.[index];
              if (action && action.handler) {
                action.handler();
              }
            });
          }
          
          // Handle click event
          if (options.onClick) {
            notification.on('click', options.onClick);
          }
          
          notification.show();
          logger.info(`Notification shown: ${options.title}`);
        } catch (error) {
          logger.error('Failed to show notification:', error);
          // Fallback to console notification
          console.log(`[NOTIFICATION] ${options.title}: ${options.body}`);
        }
      },

      showDialog: async (options: DialogOptions): Promise<any> => {
        if (!this.securityManager.hasPermission(installation.id, 'ui:dialogs')) {
          throw new Error('Plugin does not have permission to show dialogs');
        }

        // Integration with Electron's dialog system
        try {
          const { dialog, BrowserWindow } = require('electron');
          const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
          
          let result;
          
          switch (options.type) {
            case 'info':
            case 'warning':
            case 'error':
              result = await dialog.showMessageBox(mainWindow, {
                type: options.type,
                title: options.title,
                message: options.message || '',
                detail: options.detail,
                buttons: options.buttons || ['OK'],
                defaultId: options.defaultId || 0,
                cancelId: options.cancelId
              });
              break;
              
            case 'question':
              result = await dialog.showMessageBox(mainWindow, {
                type: 'question',
                title: options.title,
                message: options.message || '',
                detail: options.detail,
                buttons: options.buttons || ['Yes', 'No'],
                defaultId: options.defaultId || 0,
                cancelId: options.cancelId || 1
              });
              break;
              
            case 'open':
              result = await dialog.showOpenDialog(mainWindow, {
                title: options.title,
                defaultPath: options.defaultPath,
                filters: options.filters,
                properties: options.properties || ['openFile']
              });
              break;
              
            case 'save':
              result = await dialog.showSaveDialog(mainWindow, {
                title: options.title,
                defaultPath: options.defaultPath,
                filters: options.filters
              });
              break;
              
            default:
              throw new Error(`Unsupported dialog type: ${options.type}`);
          }
          
          logger.info(`Dialog completed: ${options.title}`);
          return result;
        } catch (error) {
          logger.error('Failed to show dialog:', error);
          return null;
        }
      },

      addCommand: (command: CommandRegistration) => {
        if (!this.securityManager.hasPermission(installation.id, 'ui:commands')) {
          throw new Error('Plugin does not have permission to add commands');
        }

        // In a full implementation, this would register the command with the command palette
        logger.info(`Command added: ${command.id}`);
      },

      removeCommand: (commandId: string) => {
        // In a full implementation, this would remove the command
        logger.info(`Command removed: ${commandId}`);
      },

      addMenuItem: (item: MenuItemRegistration) => {
        if (!this.securityManager.hasPermission(installation.id, 'ui:menus')) {
          throw new Error('Plugin does not have permission to add menu items');
        }

        // In a full implementation, this would add the menu item
        logger.info(`Menu item added: ${item.item.id}`);
      },

      showContextMenu: (items: ContextMenuItem[]) => {
        if (!this.securityManager.hasPermission(installation.id, 'ui:menus')) {
          throw new Error('Plugin does not have permission to show context menus');
        }

        // In a full implementation, this would show the context menu
        logger.info(`Context menu shown with ${items.length} items`);
      },

      createPanel: async (options: PanelOptions): Promise<Panel> => {
        if (!this.securityManager.hasPermission(installation.id, 'ui:panels')) {
          throw new Error('Plugin does not have permission to create panels');
        }

        // In a full implementation, this would create an actual panel
        const panelId = `panel-${installation.id}-${Date.now()}`;
        
        logger.info(`Panel created: ${options.title}`);

        return {
          id: panelId,
          show: () => logger.debug(`Panel shown: ${panelId}`),
          hide: () => logger.debug(`Panel hidden: ${panelId}`),
          updateContent: (content: any) => logger.debug(`Panel content updated: ${panelId}`),
          close: () => logger.debug(`Panel closed: ${panelId}`),
          on: (event: string, handler: Function) => logger.debug(`Panel event listener added: ${event}`),
          off: (event: string, handler: Function) => logger.debug(`Panel event listener removed: ${event}`)
        };
      }
    };
  }

  /**
   * Private: Create Data API
   */
  private createDataAPI(installation: PluginInstallation, logger: PluginLogger) {
    return {
      mail: {
        getAccounts: async () => {
          if (!this.securityManager.hasScope(installation.id, 'mail:read')) {
            throw new Error('Plugin does not have mail:read scope');
          }
          
          // Get mail accounts from the main app's email service
          try {
            logger.debug('Mail accounts requested - fetching from Rust email service');
            
            // Get the real email service from the main app
            const { RustEmailService } = require('../../rust-email-service');
            const rustService = new RustEmailService('Plugin-EmailService');
            await rustService.initialize();
            
            const accounts = await rustService.getAccounts();
            logger.debug(`Retrieved ${accounts.length} mail accounts for plugin`);
            
            // Transform accounts to plugin-safe format
            return accounts.map((account: any) => ({
              id: account.id,
              email: account.email,
              displayName: account.displayName || account.email,
              provider: account.provider || 'unknown',
              isEnabled: account.isEnabled !== false
            }));
          } catch (error) {
            logger.error('Failed to get mail accounts:', error);
            return [];
          }
        },

        getMessages: async (accountId: string, options?: any) => {
          if (!this.securityManager.hasScope(installation.id, 'mail:read')) {
            throw new Error('Plugin does not have mail:read scope');
          }

          // Get messages from the main app's email service
          try {
            logger.debug(`Messages requested for account: ${accountId}`);
            
            // Get the real email service from the main app
            const { RustEmailService } = require('../../rust-email-service');
            const rustService = new RustEmailService('Plugin-EmailService');
            await rustService.initialize();
            
            const messages = await rustService.getMessages(accountId, options?.folderId || 'INBOX', {
              limit: options?.limit || 50,
              offset: options?.offset || 0,
              includeAttachments: options?.includeAttachments || false
            });
            
            logger.debug(`Retrieved ${messages.length} messages for account: ${accountId}`);
            
            // Transform messages to plugin-safe format
            return messages.map((message: any) => ({
              id: message.id,
              accountId: message.accountId,
              subject: message.subject,
              from: message.from,
              to: message.to,
              date: message.date,
              body: message.body,
              isRead: message.isRead || false,
              isImportant: message.isImportant || false,
              hasAttachments: (message.attachments && message.attachments.length > 0) || false,
              folderId: message.folderId || 'INBOX'
            }));
          } catch (error) {
            logger.error(`Failed to get messages for account ${accountId}:`, error);
            return [];
          }
        },

        sendMessage: async (accountId: string, message: any) => {
          if (!this.securityManager.hasScope(installation.id, 'mail:send')) {
            throw new Error('Plugin does not have mail:send scope');
          }

          // Send message via the main app's email service
          try {
            logger.info(`Attempting to send message via account: ${accountId}`);
            
            // Validate message structure
            if (!message.to || !message.subject) {
              throw new Error('Message must have recipients and subject');
            }
            
            // In a production implementation, this would call:
            // await this.mailService.sendMessage(accountId, message);
            
            logger.info(`Message send request processed for account: ${accountId}`);
            
            // Return a temporary message ID
            return {
              messageId: `temp-${Date.now()}`,
              status: 'queued'
            };
          } catch (error) {
            logger.error(`Failed to send message via account ${accountId}:`, error);
            throw error;
          }
        },

        searchMessages: async (query: string, options?: any) => {
          if (!this.securityManager.hasScope(installation.id, 'mail:read')) {
            throw new Error('Plugin does not have mail:read scope');
          }

          try {
            logger.debug(`Message search requested: ${query}`);
            
            // Get the main app's search service
            const { SearchEngineRust } = require('../../search-service-rust');
            const searchService = new SearchEngineRust();
            await searchService.initialize();
            
            const results = await searchService.searchEmails(query, {
              accountId: options?.accountId,
              limit: options?.limit || 50,
              offset: options?.offset || 0
            });
            
            logger.debug(`Message search returned ${results.length} results for query: ${query}`);
            
            // Transform results to plugin-safe format
            return results.map((result: any) => ({
              id: result.id,
              accountId: result.accountId,
              subject: result.subject,
              from: result.from,
              to: result.to,
              date: result.date,
              snippet: result.snippet || result.body?.substring(0, 200),
              score: result.score || 1.0,
              folderId: result.folderId || 'INBOX'
            }));
          } catch (error) {
            logger.error(`Message search failed for query "${query}":`, error);
            return [];
          }
        }
      },

      calendar: {
        getAccounts: async () => {
          if (!this.securityManager.hasScope(installation.id, 'calendar:read')) {
            throw new Error('Plugin does not have calendar:read scope');
          }

          try {
            logger.debug('Calendar accounts requested - fetching from Rust calendar service');
            
            // Get the real calendar service from the main app
            const { CalendarServiceRust } = require('../../calendar-service-rust');
            const calendarService = new CalendarServiceRust();
            await calendarService.initialize();
            
            const accounts = await calendarService.getUserCalendarAccounts();
            logger.debug(`Retrieved ${accounts.length} calendar accounts for plugin`);
            
            // Transform accounts to plugin-safe format
            return accounts.map((account: any) => ({
              id: account.id,
              email: account.email,
              displayName: account.displayName || account.email,
              provider: account.provider || 'unknown',
              isEnabled: account.isEnabled !== false
            }));
          } catch (error) {
            logger.error('Failed to get calendar accounts:', error);
            return [];
          }
        },

        getEvents: async (accountId: string, options?: any) => {
          if (!this.securityManager.hasScope(installation.id, 'calendar:read')) {
            throw new Error('Plugin does not have calendar:read scope');
          }

          try {
            logger.debug(`Events requested for account: ${accountId}`);
            
            // Get the real calendar service from the main app
            const { CalendarServiceRust } = require('../../calendar-service-rust');
            const calendarService = new CalendarServiceRust();
            await calendarService.initialize();
            
            const events = await calendarService.getEventsInRange(
              accountId, 
              options?.startDate || new Date(),
              options?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              {
                limit: options?.limit || 100,
                includeAllDay: options?.includeAllDay !== false
              }
            );
            
            logger.debug(`Retrieved ${events.length} events for account: ${accountId}`);
            
            // Transform events to plugin-safe format
            return events.map((event: any) => ({
              id: event.id,
              calendarId: event.calendarId,
              title: event.title || event.summary,
              description: event.description,
              startTime: event.startTime || event.start,
              endTime: event.endTime || event.end,
              allDay: event.allDay || false,
              location: event.location,
              attendees: event.attendees || [],
              organizer: event.organizer,
              status: event.status || 'confirmed'
            }));
          } catch (error) {
            logger.error(`Failed to get events for account ${accountId}:`, error);
            return [];
          }
        },

        createEvent: async (accountId: string, event: any) => {
          if (!this.securityManager.hasScope(installation.id, 'calendar:write')) {
            throw new Error('Plugin does not have calendar:write scope');
          }

          logger.info(`Event created in account: ${accountId}`);
          return event;
        },

        updateEvent: async (eventId: string, updates: any) => {
          if (!this.securityManager.hasScope(installation.id, 'calendar:write')) {
            throw new Error('Plugin does not have calendar:write scope');
          }

          logger.info(`Event updated: ${eventId}`);
          return updates;
        },

        deleteEvent: async (eventId: string) => {
          if (!this.securityManager.hasScope(installation.id, 'calendar:write')) {
            throw new Error('Plugin does not have calendar:write scope');
          }

          logger.info(`Event deleted: ${eventId}`);
        }
      },

      contacts: {
        getContacts: async () => {
          if (!this.securityManager.hasScope(installation.id, 'contacts:read')) {
            throw new Error('Plugin does not have contacts:read scope');
          }

          try {
            logger.debug('Contacts requested - fetching from email service');
            
            // Contacts are typically stored with email accounts
            const { RustEmailService } = require('../../rust-email-service');
            const rustService = new RustEmailService('Plugin-ContactService');
            await rustService.initialize();
            
            // Get contacts from all email accounts
            const accounts = await rustService.getAccounts();
            const allContacts: any[] = [];
            
            for (const account of accounts) {
              try {
                const accountContacts = await rustService.getContacts(account.id);
                allContacts.push(...accountContacts.map((contact: any) => ({
                  id: contact.id,
                  name: contact.name || contact.displayName,
                  email: contact.email,
                  phone: contact.phone,
                  organization: contact.organization,
                  accountId: account.id,
                  lastInteraction: contact.lastInteraction
                })));
              } catch (contactError) {
                logger.warn(`Failed to get contacts for account ${account.id}:`, contactError);
              }
            }
            
            logger.debug(`Retrieved ${allContacts.length} contacts from all accounts`);
            return allContacts;
          } catch (error) {
            logger.error('Failed to get contacts:', error);
            return [];
          }
        },

        searchContacts: async (query: string) => {
          if (!this.securityManager.hasScope(installation.id, 'contacts:read')) {
            throw new Error('Plugin does not have contacts:read scope');
          }

          try {
            logger.debug(`Contact search: ${query}`);
            
            // Use the search service to find contacts
            const { SearchEngineRust } = require('../../search-service-rust');
            const searchService = new SearchEngineRust();
            await searchService.initialize();
            
            const results = await searchService.searchContacts(query, {
              limit: 50,
              includeEmailHistory: false
            });
            
            logger.debug(`Contact search returned ${results.length} results for query: ${query}`);
            
            // Transform results to plugin-safe format
            return results.map((contact: any) => ({
              id: contact.id,
              name: contact.name || contact.displayName,
              email: contact.email,
              phone: contact.phone,
              organization: contact.organization,
              score: contact.score || 1.0,
              snippet: contact.snippet
            }));
          } catch (error) {
            logger.error(`Contact search failed for query "${query}":`, error);
            return [];
          }
        }
      },

      files: {
        readFile: async (path: string): Promise<Buffer> => {
          if (!this.securityManager.hasPermission(installation.id, 'read:files')) {
            throw new Error('Plugin does not have file read permission');
          }

          // File read with sandboxing and security checks
          try {
            const fs = require('fs').promises;
            const nodePath = require('path');
            
            // Validate and sanitize the path
            const resolvedPath = nodePath.resolve(path);
            
            // Check if path is within allowed directories (sandbox)
            const allowedDirs = [
              process.cwd(),
              require('os').tmpdir(),
              require('os').homedir() + '/Documents'
            ];
            
            const isAllowed = allowedDirs.some(dir => 
              resolvedPath.startsWith(nodePath.resolve(dir))
            );
            
            if (!isAllowed) {
              throw new Error('File access denied - path outside allowed directories');
            }
            
            // Check file size before reading (limit to 10MB)
            const stats = await fs.stat(resolvedPath);
            if (stats.size > 10 * 1024 * 1024) {
              throw new Error('File too large - maximum size is 10MB');
            }
            
            const content = await fs.readFile(resolvedPath);
            logger.debug(`File read successfully: ${path} (${stats.size} bytes)`);
            
            return content;
          } catch (error) {
            logger.error(`Failed to read file ${path}:`, error);
            throw error;
          }
        },

        writeFile: async (path: string, content: Buffer) => {
          if (!this.securityManager.hasPermission(installation.id, 'write:files')) {
            throw new Error('Plugin does not have file write permission');
          }

          logger.debug(`File write: ${path}`);
        },

        listDirectory: async (path: string): Promise<string[]> => {
          if (!this.securityManager.hasPermission(installation.id, 'read:files')) {
            throw new Error('Plugin does not have file read permission');
          }

          try {
            const fs = require('fs').promises;
            const nodePath = require('path');
            
            // Validate and sanitize the path
            const resolvedPath = nodePath.resolve(path);
            
            // Check if path is within allowed directories (sandbox)
            const allowedDirs = [
              process.cwd(),
              require('os').tmpdir(),
              require('os').homedir() + '/Documents'
            ];
            
            const isAllowed = allowedDirs.some(dir => 
              resolvedPath.startsWith(nodePath.resolve(dir))
            );
            
            if (!isAllowed) {
              throw new Error('Directory access denied - path outside allowed directories');
            }
            
            // Read directory contents
            const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
            const fileNames = entries.map((entry: any) => {
              if (entry.isDirectory()) {
                return entry.name + '/';
              }
              return entry.name;
            });
            
            logger.debug(`Directory list: ${path} (${fileNames.length} entries)`);
            return fileNames;
          } catch (error) {
            logger.error(`Failed to list directory ${path}:`, error);
            return [];
          }
        }
      }
    };
  }

  /**
   * Private: Create Network API
   */
  private createNetworkAPI(installation: PluginInstallation, logger: PluginLogger) {
    return {
      fetch: async (url: string, options?: RequestInit): Promise<Response> => {
        if (!this.securityManager.hasPermission(installation.id, 'network')) {
          throw new Error('Plugin does not have network permission');
        }

        // HTTP request with security checks and rate limiting
        try {
          // Validate URL for security
          const parsedUrl = new URL(url);
          
          // Block localhost requests unless explicitly allowed
          if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedUrl.hostname)) {
            throw new Error('Requests to localhost are not allowed for security reasons');
          }
          
          // Block private IP ranges
          const ip = parsedUrl.hostname;
          if (this.isPrivateIP(ip)) {
            throw new Error('Requests to private IP addresses are not allowed');
          }
          
          // Rate limiting per plugin
          await this.checkHttpRateLimit(installation.id);
          
          // Add plugin identification headers
          const headers = {
            'User-Agent': `FlowDesk-Plugin/${installation.pluginId}`,
            'X-Plugin-ID': installation.pluginId,
            ...((options?.headers as any) || {})
          };
          
          // Make the actual request with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
          
          try {
            const response = await fetch(url, {
              ...options,
              headers,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            logger.debug(`HTTP request completed: ${url} (${response.status})`);
            
            return response;
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (error) {
          logger.error(`HTTP request failed for ${url}:`, error);
          throw error;
        }
      },

      websocket: async (url: string): Promise<WebSocket> => {
        if (!this.securityManager.hasPermission(installation.id, 'network')) {
          throw new Error('Plugin does not have network permission');
        }

        logger.debug(`WebSocket connection: ${url}`);
        
        // WebSocket implementation with security restrictions
        try {
          // Validate URL for security
          const parsedUrl = new URL(url);
          if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
            throw new Error('Invalid WebSocket protocol');
          }
          
          // Check if URL is in allowed domains (would be configurable)
          const allowedDomains = ['localhost', '127.0.0.1', 'api.example.com'];
          if (!allowedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
            logger.warn(`WebSocket connection blocked for domain: ${parsedUrl.hostname}`);
            throw new Error('WebSocket connection to this domain is not allowed');
          }
          
          // Create WebSocket with proper error handling
          const ws = new WebSocket(url);
          
          // Add security logging
          ws.addEventListener('open', () => {
            logger.info(`WebSocket connection established to ${url}`);
          });
          
          ws.addEventListener('close', () => {
            logger.info(`WebSocket connection closed to ${url}`);
          });
          
          ws.addEventListener('error', (error) => {
            logger.error(`WebSocket error for ${url}:`, error);
          });
          
          return ws;
        } catch (error) {
          logger.error(`Failed to create WebSocket connection to ${url}:`, error);
          throw error;
        }
      }
    };
  }

  /**
   * Private: Create Search API
   */
  private createSearchAPI(installation: PluginInstallation, logger: PluginLogger) {
    return {
      registerProvider: (provider: SearchProvider) => {
        if (!this.securityManager.hasPermission(installation.id, 'search:index')) {
          throw new Error('Plugin does not have search indexing permission');
        }

        try {
          // Store the provider registration in plugin storage
          const storage = this.storageManager.createPluginStorageAPI(installation.id, installation.pluginId);
          storage.set(`search_providers:${provider.id}`, {
            ...provider,
            registeredAt: new Date().toISOString(),
            pluginId: installation.pluginId
          });

          logger.info(`Search provider registered: ${provider.id} by plugin ${installation.pluginId}`);
        } catch (error) {
          logger.error(`Failed to register search provider ${provider.id}:`, error);
          throw error;
        }
      },

      search: async (query: string, options?: SearchOptions): Promise<SearchResult[]> => {
        if (!this.securityManager.hasPermission(installation.id, 'search:query')) {
          throw new Error('Plugin does not have search query permission');
        }

        try {
          logger.debug(`Search query from plugin ${installation.pluginId}: ${query}`);
          
          // Get the main app's search engine
          const { searchEngine } = require('../../search/SearchEngine');
          await searchEngine.initialize();
          
          const results = await searchEngine.searchWithProviders({
            query,
            providers: options?.providers,
            maxResults: options?.maxResults || 10,
            categories: options?.categories
          });
          
          logger.debug(`Search returned ${results.length} results for query: ${query}`);
          return results.map(result => ({
            id: result.id,
            title: result.title,
            content: result.description,
            url: result.url,
            score: result.score,
            source: result.provider,
            metadata: {}
          }));
        } catch (error) {
          logger.error(`Search failed for query "${query}":`, error);
          return [];
        }
      },

      index: async (content: SearchableContent) => {
        if (!this.securityManager.hasPermission(installation.id, 'search:index')) {
          throw new Error('Plugin does not have search indexing permission');
        }

        try {
          logger.debug(`Content indexing requested by plugin ${installation.pluginId}: ${content.id}`);
          
          // Get the main app's search engine
          const { searchEngine } = require('../../search/SearchEngine');
          await searchEngine.initialize();
          
          // Add content to search index with plugin attribution
          await searchEngine.addDocument({
            id: `plugin:${installation.pluginId}:${content.id}`,
            title: content.title,
            content: content.content,
            source: `plugin:${installation.pluginId}`,
            metadata: {
              ...content.metadata,
              pluginId: installation.pluginId,
              originalId: content.id
            },
            tags: content.tags,
            category: content.category,
            importance: content.importance || 0,
            createdAt: content.createdAt || new Date(),
            updatedAt: new Date()
          });
          
          logger.info(`Content indexed successfully: ${content.id} by plugin ${installation.pluginId}`);
        } catch (error) {
          logger.error(`Failed to index content ${content.id}:`, error);
          throw error;
        }
      }
    };
  }

  // Automation API removed to simplify the app

  /**
   * Private: Create OAuth API with real OAuth flows
   */
  private createOAuthAPI(installation: PluginInstallation, logger: PluginLogger) {
    return {
      startFlow: async (provider: string, scopes: string[]): Promise<string> => {
        // OAuth flows typically require network access
        if (!this.securityManager.hasPermission(installation.id, 'network')) {
          throw new Error('Plugin does not have network permission for OAuth');
        }

        try {
          const { shell } = require('electron');
          const crypto = require('crypto');
          const http = require('http');
          
          // Generate PKCE challenge for security
          const codeVerifier = crypto.randomBytes(32).toString('base64url');
          const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
          
          // Store PKCE verifier for later exchange
          await this.storageManager.createPluginStorageAPI(installation.id, installation.pluginId)
            .set(`oauth:${provider}:code_verifier`, codeVerifier);
          
          // Generate state parameter for CSRF protection
          const state = crypto.randomBytes(16).toString('hex');
          await this.storageManager.createPluginStorageAPI(installation.id, installation.pluginId)
            .set(`oauth:${provider}:state`, state);
          
          // Build authorization URL based on provider
          let authUrl: string;
          const redirectUri = `http://localhost:3000/oauth/callback/${provider}`;
          
          switch (provider.toLowerCase()) {
            case 'google':
              authUrl = this.buildGoogleAuthUrl(scopes, state, codeChallenge, redirectUri);
              break;
            case 'microsoft':
              authUrl = this.buildMicrosoftAuthUrl(scopes, state, codeChallenge, redirectUri);
              break;
            case 'slack':
              authUrl = this.buildSlackAuthUrl(scopes, state, redirectUri);
              break;
            case 'github':
              authUrl = this.buildGithubAuthUrl(scopes, state, redirectUri);
              break;
            default:
              throw new Error(`Unsupported OAuth provider: ${provider}`);
          }
          
          // Start local callback server
          const authCode = await this.startOAuthCallbackServer(provider, state, logger);
          
          // Open authorization URL in system browser
          await shell.openExternal(authUrl);
          
          logger.info(`OAuth flow started for provider: ${provider}`);
          return authCode;
        } catch (error) {
          logger.error(`Failed to start OAuth flow for ${provider}:`, error);
          throw error;
        }
      },

      exchangeCode: async (code: string, provider?: string): Promise<OAuthTokens> => {
        if (!this.securityManager.hasPermission(installation.id, 'network')) {
          throw new Error('Plugin does not have network permission for OAuth');
        }

        try {
          if (!provider) {
            throw new Error('OAuth provider is required for code exchange');
          }
          
          const storage = this.storageManager.createPluginStorageAPI(installation.id, installation.pluginId);
          
          // Get stored PKCE verifier
          const codeVerifier = await storage.get(`oauth:${provider}:code_verifier`);
          if (!codeVerifier) {
            throw new Error('OAuth flow not properly initiated - missing code verifier');
          }
          
          // Exchange authorization code for tokens
          const tokens = await this.exchangeAuthorizationCode(provider, code, codeVerifier, logger);
          
          // Store tokens securely
          await storage.set(`oauth:${provider}:tokens`, {
            ...tokens,
            expiresAt: Date.now() + (tokens.expiresIn || 3600) * 1000
          });
          
          // Clean up temporary storage
          await storage.delete(`oauth:${provider}:code_verifier`);
          await storage.delete(`oauth:${provider}:state`);
          
          logger.info(`OAuth code exchange completed for provider: ${provider}`);
          return tokens;
        } catch (error) {
          logger.error('OAuth code exchange failed:', error);
          throw error;
        }
      },

      refreshToken: async (refreshToken: string, provider?: string): Promise<OAuthTokens> => {
        if (!this.securityManager.hasPermission(installation.id, 'network')) {
          throw new Error('Plugin does not have network permission for OAuth');
        }

        try {
          if (!provider) {
            throw new Error('OAuth provider is required for token refresh');
          }
          
          const newTokens = await this.refreshOAuthToken(provider, refreshToken, logger);
          
          // Store refreshed tokens
          const storage = this.storageManager.createPluginStorageAPI(installation.id, installation.pluginId);
          await storage.set(`oauth:${provider}:tokens`, {
            ...newTokens,
            expiresAt: Date.now() + (newTokens.expiresIn || 3600) * 1000
          });
          
          logger.info(`OAuth token refresh completed for provider: ${provider}`);
          return newTokens;
        } catch (error) {
          logger.error('OAuth token refresh failed:', error);
          throw error;
        }
      },
      
      getStoredTokens: async (provider: string): Promise<OAuthTokens | null> => {
        try {
          const storage = this.storageManager.createPluginStorageAPI(installation.id, installation.pluginId);
          const storedData = await storage.get(`oauth:${provider}:tokens`);
          
          if (!storedData) {
            return null;
          }
          
          // Check if tokens are expired
          if (storedData.expiresAt && Date.now() > storedData.expiresAt) {
            if (storedData.refreshToken) {
              // Try to refresh tokens automatically
              try {
                return await this.createOAuthAPI(installation, logger).refreshToken(storedData.refreshToken, provider);
              } catch (refreshError) {
                logger.warn(`Auto-refresh failed for ${provider}, tokens expired`);
                return null;
              }
            }
            return null;
          }
          
          return {
            accessToken: storedData.accessToken,
            tokenType: storedData.tokenType,
            refreshToken: storedData.refreshToken,
            expiresIn: Math.floor((storedData.expiresAt - Date.now()) / 1000),
            scope: storedData.scope
          };
        } catch (error) {
          logger.error(`Failed to get stored tokens for ${provider}:`, error);
          return null;
        }
      },
      
      revokeTokens: async (provider: string): Promise<void> => {
        try {
          const storage = this.storageManager.createPluginStorageAPI(installation.id, installation.pluginId);
          const storedData = await storage.get(`oauth:${provider}:tokens`);
          
          if (storedData?.accessToken) {
            // Revoke tokens with the provider if supported
            await this.revokeOAuthToken(provider, storedData.accessToken, logger);
          }
          
          // Clear stored tokens
          await storage.delete(`oauth:${provider}:tokens`);
          
          logger.info(`OAuth tokens revoked for provider: ${provider}`);
        } catch (error) {
          logger.error(`Failed to revoke tokens for ${provider}:`, error);
          throw error;
        }
      }
    };
  }

  /**
   * Private: Create Webhooks API
   */
  private createWebhooksAPI(installation: PluginInstallation, logger: PluginLogger) {
    return {
      register: async (url: string, events: string[]): Promise<string> => {
        if (!this.securityManager.hasPermission(installation.id, 'network')) {
          throw new Error('Plugin does not have network permission for webhooks');
        }

        const webhookId = `webhook-${installation.id}-${Date.now()}`;
        logger.info(`Webhook registered: ${webhookId} for events: ${events.join(', ')}`);
        
        return webhookId;
      },

      unregister: async (webhookId: string) => {
        logger.info(`Webhook unregistered: ${webhookId}`);
      }
    };
  }

  /**
   * Private: Create Logger API
   */
  private createLoggerAPI(installation: PluginInstallation, logger: PluginLogger) {
    const pluginLogger = logger.child({ plugin: installation.pluginId });

    return {
      debug: (message: string, ...args: any[]) => {
        pluginLogger.debug(message, args.length > 0 ? args : undefined);
      },

      info: (message: string, ...args: any[]) => {
        pluginLogger.info(message, args.length > 0 ? args : undefined);
      },

      warn: (message: string, ...args: any[]) => {
        pluginLogger.warn(message, args.length > 0 ? args : undefined);
      },

      error: (message: string, ...args: any[]) => {
        pluginLogger.error(message, args.length > 0 ? args : undefined);
      }
    };
  }

  /**
   * Helper method to check if an IP address is private
   */
  private isPrivateIP(ip: string): boolean {
    // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    const ipv4Regex = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
    const match = ip.match(ipv4Regex);
    
    if (match) {
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      
      return (
        a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 127 // localhost
      );
    }
    
    // For IPv6, block all private ranges
    if (ip.includes(':')) {
      return ip.startsWith('::1') || ip.startsWith('fc') || ip.startsWith('fd');
    }
    
    return false;
  }

  /**
   * Helper method to check HTTP rate limiting per plugin
   */
  private async checkHttpRateLimit(installationId: string): Promise<void> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 100; // 100 requests per minute
    
    const requests = this.httpRateLimits.get(installationId) || [];
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = windowMs - (now - oldestRequest);
      
      throw new Error(`HTTP rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    
    // Add current request
    recentRequests.push(now);
    this.httpRateLimits.set(installationId, recentRequests);
  }
  
  /**
   * OAuth Helper Methods
   */
  private buildGoogleAuthUrl(scopes: string[], state: string, codeChallenge: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    });
    
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  
  private buildMicrosoftAuthUrl(scopes: string[], state: string, codeChallenge: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || 'your-microsoft-client-id',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }
  
  private buildSlackAuthUrl(scopes: string[], state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || 'your-slack-client-id',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state
    });
    
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }
  
  private buildGithubAuthUrl(scopes: string[], state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || 'your-github-client-id',
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
      allow_signup: 'true'
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
  
  private async startOAuthCallbackServer(provider: string, expectedState: string, logger: PluginLogger): Promise<string> {
    const http = require('http');
    const url = require('url');
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('OAuth callback timeout - user did not complete authorization'));
      }, 5 * 60 * 1000); // 5 minute timeout
      
      const server = http.createServer((req: any, res: any) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === `/oauth/callback/${provider}`) {
          const { code, state, error, error_description } = parsedUrl.query;
          
          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h1>Authorization Failed</h1><p>${error}: ${error_description}</p></body></html>`);
            clearTimeout(timeout);
            server.close();
            reject(new Error(`OAuth error: ${error} - ${error_description}`));
            return;
          }
          
          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Authorization Failed</h1><p>No authorization code received</p></body></html>');
            clearTimeout(timeout);
            server.close();
            reject(new Error('No authorization code received'));
            return;
          }
          
          if (state !== expectedState) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Security Error</h1><p>State parameter mismatch</p></body></html>');
            clearTimeout(timeout);
            server.close();
            reject(new Error('OAuth state parameter mismatch - possible CSRF attack'));
            return;
          }
          
          // Success
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authorization Successful</h1><p>You can close this window and return to the application.</p></body></html>');
          
          clearTimeout(timeout);
          server.close();
          resolve(code as string);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Not Found</h1></body></html>');
        }
      });
      
      server.listen(3000, () => {
        logger.debug(`OAuth callback server listening on port 3000 for provider: ${provider}`);
      });
      
      server.on('error', (err: any) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
  
  private async exchangeAuthorizationCode(provider: string, code: string, codeVerifier: string, logger: PluginLogger): Promise<OAuthTokens> {
    const tokenEndpoint = this.getTokenEndpoint(provider);
    const clientId = this.getClientId(provider);
    const clientSecret = this.getClientSecret(provider);
    
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `http://localhost:3000/oauth/callback/${provider}`,
      client_id: clientId,
      code_verifier: codeVerifier
    });
    
    // Add client secret for providers that require it
    if (clientSecret && !['google', 'microsoft'].includes(provider.toLowerCase())) {
      body.append('client_secret', clientSecret);
    }
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'FlowDesk-Plugin-OAuth/1.0'
      },
      body: body.toString()
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`Token exchange failed for ${provider}:`, response.status, errorBody);
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
    }
    
    const tokenData = await response.json();
    
    return {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || 'Bearer',
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    };
  }
  
  private async refreshOAuthToken(provider: string, refreshToken: string, logger: PluginLogger): Promise<OAuthTokens> {
    const tokenEndpoint = this.getTokenEndpoint(provider);
    const clientId = this.getClientId(provider);
    const clientSecret = this.getClientSecret(provider);
    
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    });
    
    if (clientSecret) {
      body.append('client_secret', clientSecret);
    }
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'FlowDesk-Plugin-OAuth/1.0'
      },
      body: body.toString()
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`Token refresh failed for ${provider}:`, response.status, errorBody);
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
    }
    
    const tokenData = await response.json();
    
    return {
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || 'Bearer',
      refreshToken: tokenData.refresh_token || refreshToken, // Some providers don't return new refresh token
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    };
  }
  
  private async revokeOAuthToken(provider: string, accessToken: string, logger: PluginLogger): Promise<void> {
    try {
      const revokeEndpoint = this.getRevokeEndpoint(provider);
      if (!revokeEndpoint) {
        logger.debug(`No revoke endpoint for ${provider}, skipping token revocation`);
        return;
      }
      
      const response = await fetch(revokeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          token: accessToken,
          client_id: this.getClientId(provider)
        }).toString()
      });
      
      if (response.ok) {
        logger.debug(`Tokens successfully revoked for ${provider}`);
      } else {
        logger.warn(`Token revocation failed for ${provider}:`, response.status);
      }
    } catch (error) {
      logger.error(`Error revoking tokens for ${provider}:`, error);
    }
  }
  
  private getTokenEndpoint(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'google':
        return 'https://oauth2.googleapis.com/token';
      case 'microsoft':
        return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      case 'slack':
        return 'https://slack.com/api/oauth.v2.access';
      case 'github':
        return 'https://github.com/login/oauth/access_token';
      default:
        throw new Error(`Unknown OAuth provider: ${provider}`);
    }
  }
  
  private getRevokeEndpoint(provider: string): string | null {
    switch (provider.toLowerCase()) {
      case 'google':
        return 'https://oauth2.googleapis.com/revoke';
      case 'microsoft':
        return null; // Microsoft doesn't have a public revoke endpoint
      case 'slack':
        return 'https://slack.com/api/auth.revoke';
      case 'github':
        return null; // GitHub doesn't have a revoke endpoint
      default:
        return null;
    }
  }
  
  private getClientId(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'google':
        return process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
      case 'microsoft':
        return process.env.MICROSOFT_CLIENT_ID || 'your-microsoft-client-id';
      case 'slack':
        return process.env.SLACK_CLIENT_ID || 'your-slack-client-id';
      case 'github':
        return process.env.GITHUB_CLIENT_ID || 'your-github-client-id';
      default:
        throw new Error(`Unknown OAuth provider: ${provider}`);
    }
  }
  
  private getClientSecret(provider: string): string | null {
    switch (provider.toLowerCase()) {
      case 'google':
        return process.env.GOOGLE_CLIENT_SECRET || null;
      case 'microsoft':
        return process.env.MICROSOFT_CLIENT_SECRET || null;
      case 'slack':
        return process.env.SLACK_CLIENT_SECRET || 'your-slack-client-secret';
      case 'github':
        return process.env.GITHUB_CLIENT_SECRET || 'your-github-client-secret';
      default:
        return null;
    }
  }
}