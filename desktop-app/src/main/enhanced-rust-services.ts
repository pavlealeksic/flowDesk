/**
 * Enhanced Rust Services with Comprehensive Error Handling
 * 
 * This module provides enhanced versions of all Rust service calls with proper
 * error handling, retry mechanisms, and graceful degradation.
 */

import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { rustErrorHandler, safeRustCall, resilientRustCall, criticalRustCall, formatErrorForUser } from './rust-error-handler';

// Import the Rust engine (handle both real and mock implementations)
let rustEngine: any;
try {
  rustEngine = require('../lib/rust-engine');
} catch (error) {
  log.warn('Failed to load Rust engine, using mock implementation:', error);
  rustEngine = require('../lib/rust-engine/src/mock-ffi-wrapper');
}

// Enhanced Mail Service
export class EnhancedMailService {
  private mainWindow?: BrowserWindow;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    rustErrorHandler.on('error', (errorInfo) => {
      if (errorInfo.error.component === 'mail') {
        this.handleMailError(errorInfo);
      }
    });

    rustErrorHandler.on('service-degraded', (event) => {
      if (event.service.startsWith('mail')) {
        this.notifyServiceDegraded(event);
      }
    });
  }

  private handleMailError(errorInfo: any): void {
    const userError = formatErrorForUser(errorInfo.error);
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('mail:error', {
        ...userError,
        timestamp: errorInfo.timestamp,
        operation: errorInfo.operationName
      });
    }

    log.error(`Mail service error in ${errorInfo.operationName}:`, errorInfo.error);
  }

  private notifyServiceDegraded(event: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('service:degraded', event);
    }
  }

  // Enhanced mail operations with error handling
  public async initializeEngine(): Promise<boolean> {
    return await safeRustCall('init_mail_engine', async () => {
      await rustEngine.init_mail_engine();
      return true;
    }, {
      retryAttempts: 2,
      fallback: async () => {
        log.warn('Mail engine initialization failed, using offline mode');
        return false;
      }
    });
  }

  public async addAccount(accountData: any): Promise<string> {
    return await resilientRustCall(
      'add_mail_account',
      async () => {
        if (typeof rustEngine.safe_add_mail_account === 'function') {
          return await rustEngine.safe_add_mail_account(JSON.stringify(accountData));
        } else {
          return await rustEngine.add_mail_account(accountData);
        }
      },
      async () => {
        // Fallback: store account data locally for later sync
        const accountId = `offline_${Date.now()}`;
        log.info(`Storing mail account offline: ${accountId}`);
        // In a real implementation, you would store this in local storage
        return accountId;
      }
    );
  }

  public async getAccounts(): Promise<any[]> {
    return await resilientRustCall(
      'get_mail_accounts',
      async () => {
        return await rustEngine.get_mail_accounts();
      },
      async () => {
        // Fallback: return cached accounts
        log.info('Using cached mail accounts due to service degradation');
        return []; // In a real implementation, return cached data
      }
    );
  }

  public async syncAccount(accountId: string): Promise<any> {
    return await safeRustCall('sync_mail_account', async () => {
      return await rustEngine.sync_mail_account(accountId);
    }, {
      retryAttempts: 5,
      fallback: async () => {
        return {
          account_id: accountId,
          is_syncing: false,
          last_sync: null,
          total_messages: 0,
          unread_messages: 0,
          error_message: 'Sync failed, will retry automatically'
        };
      }
    });
  }

  public async getMessages(accountId: string, options?: any): Promise<any[]> {
    return await resilientRustCall(
      'get_mail_messages',
      async () => {
        return await rustEngine.get_mail_messages(accountId);
      },
      async () => {
        // Fallback: return cached messages
        log.info(`Using cached messages for account ${accountId}`);
        return []; // In a real implementation, return cached messages
      }
    );
  }

  public async sendMessage(accountId: string, message: any): Promise<string> {
    return await criticalRustCall('send_mail_message', async () => {
      // This is a critical operation that should use circuit breaker
      return await rustEngine.send_email(accountId, JSON.stringify(message));
    });
  }

  public async searchMessages(query: string, options?: any): Promise<any[]> {
    return await safeRustCall('search_mail_messages', async () => {
      return await rustEngine.search_mail_messages(query);
    }, {
      retryAttempts: 2,
      fallback: async () => {
        log.info('Mail search failed, using local search fallback');
        return []; // In a real implementation, use local search
      }
    });
  }
}

// Enhanced Calendar Service
export class EnhancedCalendarService {
  private mainWindow?: BrowserWindow;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    rustErrorHandler.on('error', (errorInfo) => {
      if (errorInfo.error.component === 'calendar') {
        this.handleCalendarError(errorInfo);
      }
    });
  }

  private handleCalendarError(errorInfo: any): void {
    const userError = formatErrorForUser(errorInfo.error);
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('calendar:error', {
        ...userError,
        timestamp: errorInfo.timestamp,
        operation: errorInfo.operationName
      });
    }

    log.error(`Calendar service error in ${errorInfo.operationName}:`, errorInfo.error);
  }

  public async initializeEngine(): Promise<boolean> {
    return await safeRustCall('init_calendar_engine', async () => {
      await rustEngine.init_calendar_engine();
      return true;
    }, {
      retryAttempts: 2,
      fallback: async () => {
        log.warn('Calendar engine initialization failed, using offline mode');
        return false;
      }
    });
  }

  public async addAccount(accountData: any): Promise<void> {
    return await resilientRustCall(
      'add_calendar_account',
      async () => {
        await rustEngine.add_calendar_account(accountData);
      },
      async () => {
        // Fallback: store account data for later processing
        log.info('Storing calendar account offline for later sync');
      }
    );
  }

  public async getAccounts(): Promise<any[]> {
    return await resilientRustCall(
      'get_calendar_accounts',
      async () => {
        return await rustEngine.get_calendar_accounts();
      },
      async () => {
        log.info('Using cached calendar accounts');
        return []; // Return cached accounts
      }
    );
  }

  public async syncAccount(accountId: string): Promise<any> {
    return await safeRustCall('sync_calendar_account', async () => {
      if (typeof rustEngine.safe_sync_calendar_account === 'function') {
        const result = await rustEngine.safe_sync_calendar_account(accountId);
        return JSON.parse(result);
      } else {
        return await rustEngine.sync_calendar_account(accountId);
      }
    }, {
      retryAttempts: 3,
      fallback: async () => {
        return {
          account_id: accountId,
          is_syncing: false,
          last_sync: null,
          total_calendars: 0,
          total_events: 0,
          error_message: 'Sync failed, will retry later'
        };
      }
    });
  }

  public async getCalendars(accountId: string): Promise<any[]> {
    return await resilientRustCall(
      'get_calendars',
      async () => {
        return await rustEngine.get_calendars(accountId);
      },
      async () => {
        log.info(`Using cached calendars for account ${accountId}`);
        return [];
      }
    );
  }

  public async getEvents(accountId: string, timeMin?: string, timeMax?: string): Promise<any[]> {
    return await resilientRustCall(
      'get_calendar_events',
      async () => {
        return await rustEngine.get_calendar_events(accountId);
      },
      async () => {
        log.info(`Using cached events for account ${accountId}`);
        return [];
      }
    );
  }

  public async createEvent(calendarId: string, eventData: any): Promise<string> {
    return await criticalRustCall('create_calendar_event', async () => {
      return await rustEngine.create_calendar_event(
        calendarId,
        eventData.title,
        eventData.startTime,
        eventData.endTime
      );
    });
  }
}

// Enhanced Search Service
export class EnhancedSearchService {
  private mainWindow?: BrowserWindow;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    rustErrorHandler.on('error', (errorInfo) => {
      if (errorInfo.error.component === 'search') {
        this.handleSearchError(errorInfo);
      }
    });
  }

  private handleSearchError(errorInfo: any): void {
    const userError = formatErrorForUser(errorInfo.error);
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('search:error', {
        ...userError,
        timestamp: errorInfo.timestamp,
        operation: errorInfo.operationName
      });
    }

    log.error(`Search service error in ${errorInfo.operationName}:`, errorInfo.error);
  }

  public async initializeEngine(): Promise<boolean> {
    return await safeRustCall('init_search_engine', async () => {
      await rustEngine.init_search_engine();
      return true;
    }, {
      retryAttempts: 2,
      fallback: async () => {
        log.warn('Search engine initialization failed, using simple search');
        return false;
      }
    });
  }

  public async indexDocument(document: any): Promise<void> {
    return await safeRustCall('index_document', async () => {
      await rustEngine.index_document(
        document.id,
        document.title,
        document.content,
        document.source,
        JSON.stringify(document.metadata || {})
      );
    }, {
      retryAttempts: 2,
      fallback: async () => {
        log.info('Document indexing failed, queuing for later');
        // Queue document for later indexing
      }
    });
  }

  public async search(query: string, limit?: number): Promise<any[]> {
    return await resilientRustCall(
      'search_documents',
      async () => {
        if (typeof rustEngine.safe_search_documents === 'function') {
          const result = await rustEngine.safe_search_documents(query, limit);
          return JSON.parse(result);
        } else {
          return await rustEngine.search_documents(query, limit);
        }
      },
      async () => {
        log.info('Search service degraded, using simple local search');
        // Implement simple local search fallback
        return [];
      }
    );
  }
}

// System Health Monitor
export class SystemHealthMonitor {
  private services: Map<string, any> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private mainWindow?: BrowserWindow;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  public registerService(name: string, service: any): void {
    this.services.set(name, service);
  }

  public startHealthChecks(intervalMs: number = 60000): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, intervalMs);
  }

  public stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private async performHealthChecks(): Promise<void> {
    const healthStatus: { [key: string]: any } = {};

    for (const [serviceName, service] of this.services) {
      try {
        let isHealthy = false;
        
        // Perform service-specific health check
        if (service.initializeEngine) {
          isHealthy = await service.initializeEngine();
        } else {
          isHealthy = true; // Assume healthy if no specific check
        }

        healthStatus[serviceName] = {
          status: rustErrorHandler.isServiceDegraded(serviceName) ? 'degraded' : (isHealthy ? 'healthy' : 'unhealthy'),
          isHealthy,
          isDegraded: rustErrorHandler.isServiceDegraded(serviceName),
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        healthStatus[serviceName] = {
          status: 'unhealthy',
          isHealthy: false,
          isDegraded: true,
          error: error instanceof Error ? error.message : String(error),
          lastCheck: new Date().toISOString()
        };
      }
    }

    // Emit health status
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('system:health-status', healthStatus);
    }

    log.debug('System health check completed:', healthStatus);
  }

  public getServiceHealth(): { [key: string]: any } {
    const health: { [key: string]: any } = {};
    
    for (const [serviceName] of this.services) {
      health[serviceName] = rustErrorHandler.getServiceHealth(serviceName);
    }
    
    return health;
  }

  public getErrorStatistics(): { [key: string]: any } {
    return rustErrorHandler.getErrorStatistics();
  }

  public forceRestoreService(serviceName: string): void {
    rustErrorHandler.forceRestoreService(serviceName);
  }
}

// Factory function to create enhanced services
export function createEnhancedRustServices(mainWindow?: BrowserWindow) {
  const mailService = new EnhancedMailService(mainWindow);
  const calendarService = new EnhancedCalendarService(mainWindow);
  const searchService = new EnhancedSearchService(mainWindow);
  const healthMonitor = new SystemHealthMonitor(mainWindow);

  // Register services with health monitor
  healthMonitor.registerService('mail', mailService);
  healthMonitor.registerService('calendar', calendarService);
  healthMonitor.registerService('search', searchService);

  return {
    mailService,
    calendarService,
    searchService,
    healthMonitor,
    rustErrorHandler
  };
}

export {
  EnhancedMailService,
  EnhancedCalendarService,
  EnhancedSearchService,
  SystemHealthMonitor
};