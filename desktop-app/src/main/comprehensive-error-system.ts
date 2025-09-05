/**
 * Comprehensive Error Handling System Integration
 * 
 * This module integrates all error handling components into a cohesive system
 * that prevents app crashes and provides excellent user experience.
 */

import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import {
  createEnhancedRustServices,
  EnhancedMailService,
  EnhancedCalendarService,
  EnhancedSearchService,
  SystemHealthMonitor
} from './enhanced-rust-services';
import {
  rustErrorHandler,
  RustErrorHandler,
  formatErrorForUser
} from './rust-error-handler';
import {
  getUserNotificationManager,
  UserNotificationManager,
  NotificationType
} from './user-error-notifications';

export interface ErrorSystemConfig {
  enableCircuitBreakers: boolean;
  enableUserNotifications: boolean;
  retryAttempts: number;
  circuitBreakerThreshold: number;
  healthCheckInterval: number;
  maxNotificationHistory: number;
}

export const DEFAULT_ERROR_SYSTEM_CONFIG: ErrorSystemConfig = {
  enableCircuitBreakers: true,
  enableUserNotifications: true,
  retryAttempts: 3,
  circuitBreakerThreshold: 5,
  healthCheckInterval: 60000, // 1 minute
  maxNotificationHistory: 100
};

export class ComprehensiveErrorSystem {
  private config: ErrorSystemConfig;
  private mainWindow?: BrowserWindow;
  private errorHandler: RustErrorHandler;
  private notificationManager: UserNotificationManager;
  private healthMonitor: SystemHealthMonitor;
  private enhancedServices: {
    mailService: EnhancedMailService;
    calendarService: EnhancedCalendarService;
    searchService: SearchService;
  };
  private isInitialized = false;

  constructor(config: Partial<ErrorSystemConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_SYSTEM_CONFIG, ...config };
    this.errorHandler = rustErrorHandler;
    this.degradationManager = getGracefulDegradationManager();
    this.notificationManager = getUserNotificationManager();
  }

  public async initialize(mainWindow?: BrowserWindow): Promise<void> {
    if (this.isInitialized) return;

    this.mainWindow = mainWindow;
    
    try {
      log.info('Initializing comprehensive error handling system...');

      // Initialize core components
      await this.degradationManager.initialize();
      
      // Update components with main window reference
      if (mainWindow) {
        this.notificationManager.setMainWindow(mainWindow);
        this.degradationManager = getGracefulDegradationManager(mainWindow);
      }

      // Create enhanced services
      this.enhancedServices = createEnhancedRustServices(mainWindow);
      this.healthMonitor = this.enhancedServices.healthMonitor;

      // Setup integrations between components
      this.setupComponentIntegrations();
      
      // Setup IPC handlers
      this.setupIpcHandlers();
      
      // Start health monitoring
      if (this.config.enableGracefulDegradation) {
        this.healthMonitor.startHealthChecks(this.config.healthCheckInterval);
      }

      // Initialize Rust error handling
      try {
        if (typeof require('../lib/rust-engine').init_error_handling === 'function') {
          require('../lib/rust-engine').init_error_handling();
        }
      } catch (error) {
        log.warn('Rust error handling initialization failed, using fallback:', error);
      }

      this.isInitialized = true;
      log.info('Comprehensive error handling system initialized successfully');

      // Show initialization success notification
      if (this.config.enableUserNotifications && mainWindow) {
        this.notificationManager.showNotification({
          id: 'system_initialized',
          type: NotificationType.SUCCESS,
          title: '✅ Error Protection Active',
          message: 'Flow Desk is protected against errors and will handle issues gracefully.',
          actions: [{ id: 'dismiss', label: 'OK', type: 'dismiss' as any }],
          timestamp: new Date()
        });
      }

    } catch (error) {
      log.error('Failed to initialize error handling system:', error);
      throw error;
    }
  }

  private setupComponentIntegrations(): void {
    // Connect error handler to notification manager
    this.errorHandler.on('error', (errorInfo) => {
      if (this.config.enableUserNotifications) {
        this.notificationManager.showErrorNotification(errorInfo.error, {
          service: errorInfo.error.component,
          operation: errorInfo.operationName,
          accountId: errorInfo.error.account_id
        });
      }
    });

    // Connect degradation manager to notification manager
    this.degradationManager.on('degradation-changed', (event) => {
      if (this.config.enableUserNotifications) {
        this.handleDegradationChange(event);
      }
    });

    // Connect notification manager retry requests to error handler
    this.notificationManager.on('retry-requested', (retryInfo) => {
      this.handleRetryRequest(retryInfo);
    });

    // Connect service restart requests
    this.notificationManager.on('service-restart-requested', (restartInfo) => {
      this.handleServiceRestartRequest(restartInfo);
    });

    // Connect offline mode requests
    this.notificationManager.on('offline-mode-requested', (offlineInfo) => {
      this.handleOfflineModeRequest(offlineInfo);
    });

    // Handle service degradation events
    this.errorHandler.on('service-degraded', (event) => {
      log.warn(`Service degraded: ${event.service}`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('service:degraded', event);
      }
    });

    // Handle service restoration events
    this.errorHandler.on('service-restored', (event) => {
      log.info(`Service restored: ${event.service}`);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('service:restored', event);
      }
    });
  }

  private setupIpcHandlers(): void {
    // Error system status
    ipcMain.handle('error-system:get-status', () => {
      return {
        isInitialized: this.isInitialized,
        config: this.config,
        serviceHealth: this.healthMonitor.getServiceHealth(),
        degradationState: this.degradationManager.getCurrentState(),
        errorStatistics: this.errorHandler.getErrorStatistics(),
        activeNotifications: this.notificationManager.getActiveNotifications().length,
        notificationHistory: this.notificationManager.getNotificationHistory(10)
      };
    });

    // Force health check
    ipcMain.handle('error-system:force-health-check', async () => {
      await this.degradationManager.forceServiceCheck();
      return this.healthMonitor.getServiceHealth();
    });

    // Clear error statistics
    ipcMain.handle('error-system:clear-statistics', () => {
      this.errorHandler.clearErrorStatistics();
      return true;
    });

    // Force service restoration
    ipcMain.handle('error-system:restore-service', (_, serviceName: string) => {
      this.healthMonitor.forceRestoreService(serviceName);
      return true;
    });

    // Get notification history
    ipcMain.handle('error-system:get-notifications', (_, limit = 20) => {
      return {
        active: this.notificationManager.getActiveNotifications(),
        history: this.notificationManager.getNotificationHistory(limit)
      };
    });

    // Dismiss all notifications
    ipcMain.handle('error-system:dismiss-all-notifications', () => {
      this.notificationManager.dismissAllNotifications();
      return true;
    });

    // Test error handling
    ipcMain.handle('error-system:test-error', async (_, errorType: string) => {
      return this.triggerTestError(errorType);
    });
  }

  private handleDegradationChange(event: any): void {
    const { previousLevel, newLevel, state } = event;

    if (newLevel === 'none' && previousLevel !== 'none') {
      // Services restored
      this.notificationManager.showNotification({
        id: `restoration_${Date.now()}`,
        type: NotificationType.SUCCESS,
        title: '🎉 Services Restored',
        message: 'All services are now operating normally. Queued operations are being processed.',
        actions: [{ id: 'dismiss', label: 'Great!', type: 'dismiss' as any }],
        timestamp: new Date()
      });
    } else if (newLevel !== 'none' && previousLevel === 'none') {
      // Services degraded
      const title = {
        'partial': '⚠️ Limited Functionality',
        'offline': '📶 Offline Mode',
        'critical': '🚨 Critical Issues'
      }[newLevel] || '⚠️ Service Issues';

      const message = {
        'partial': 'Some features are temporarily unavailable. You can continue working with reduced functionality.',
        'offline': 'Working in offline mode. Your changes will sync when connectivity is restored.',
        'critical': 'Critical services are unavailable. Please check your configuration.'
      }[newLevel] || 'Some services are experiencing issues.';

      this.notificationManager.showNotification({
        id: `degradation_${Date.now()}`,
        type: newLevel === 'critical' ? NotificationType.ERROR : NotificationType.WARNING,
        title,
        message,
        details: `Affected services: ${state.limitations.join(', ')}`,
        actions: [
          { id: 'view_status', label: 'View Status', type: 'open_settings' as any },
          { id: 'dismiss', label: 'OK', type: 'dismiss' as any }
        ],
        persistent: newLevel === 'critical',
        timestamp: new Date()
      });
    }
  }

  private handleRetryRequest(retryInfo: any): void {
    log.info(`Retry requested for ${retryInfo.operation} on ${retryInfo.service}`);
    
    // Emit retry event that services can listen to
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('service:retry-operation', retryInfo);
    }
  }

  private handleServiceRestartRequest(restartInfo: any): void {
    log.info(`Service restart requested for ${restartInfo.service}`);
    
    // Force restore the service
    this.healthMonitor.forceRestoreService(restartInfo.service);
    
    // Show confirmation notification
    this.notificationManager.showNotification({
      id: `restart_${Date.now()}`,
      type: NotificationType.INFO,
      title: '🔄 Service Restarting',
      message: `Attempting to restart ${restartInfo.service} service...`,
      actions: [{ id: 'dismiss', label: 'OK', type: 'dismiss' as any }],
      timestamp: new Date()
    });
  }

  private handleOfflineModeRequest(offlineInfo: any): void {
    log.info(`Offline mode requested for ${offlineInfo.service}`);
    
    // Enable offline mode
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('service:enable-offline-mode', offlineInfo);
    }
  }

  private async triggerTestError(errorType: string): Promise<any> {
    log.info(`Triggering test error: ${errorType}`);

    const testErrors: { [key: string]: any } = {
      'authentication': {
        error_type: 'authentication',
        message: 'Test authentication error',
        operation: 'test_operation',
        component: 'test',
        is_retryable: false,
        requires_user_action: true,
        severity: 'high',
        auth_url: 'https://accounts.google.com/oauth',
        recovery_suggestion: 'This is a test authentication error',
        context: '{}'
      },
      'network': {
        error_type: 'network',
        message: 'Test network error',
        operation: 'test_operation',
        component: 'test',
        is_retryable: true,
        requires_user_action: false,
        severity: 'medium',
        recovery_suggestion: 'This is a test network error',
        context: '{}'
      },
      'critical': {
        error_type: 'critical',
        message: 'Test critical error',
        operation: 'test_operation',
        component: 'test',
        is_retryable: false,
        requires_user_action: true,
        severity: 'critical',
        recovery_suggestion: 'This is a test critical error that requires immediate attention',
        context: '{}'
      }
    };

    const testError = testErrors[errorType] || testErrors['network'];
    
    // Show the test error notification
    const notificationId = this.notificationManager.showErrorNotification(testError);
    
    return {
      success: true,
      errorType,
      notificationId,
      message: `Test ${errorType} error triggered successfully`
    };
  }

  // Public API
  public getEnhancedServices() {
    if (!this.isInitialized) {
      throw new Error('Error system not initialized');
    }
    return this.enhancedServices;
  }

  public getSystemStatus() {
    return {
      isInitialized: this.isInitialized,
      serviceHealth: this.healthMonitor.getServiceHealth(),
      degradationLevel: this.degradationManager.getCurrentState().level,
      errorStats: this.errorHandler.getErrorStatistics(),
      activeNotifications: this.notificationManager.getActiveNotifications().length
    };
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    log.info('Shutting down comprehensive error handling system...');

    try {
      // Stop health monitoring
      this.healthMonitor.stopHealthChecks();
      
      // Shutdown degradation manager
      this.degradationManager.shutdown();
      
      // Clear notifications
      this.notificationManager.clearHistory();
      
      // Clear error statistics
      this.errorHandler.clearErrorStatistics();

      this.isInitialized = false;
      log.info('Error handling system shut down successfully');
    } catch (error) {
      log.error('Error during error handling system shutdown:', error);
      throw error;
    }
  }

  public isSystemHealthy(): boolean {
    const degradationLevel = this.degradationManager.getCurrentState().level;
    return degradationLevel === 'none' || degradationLevel === 'partial';
  }

  public getCriticalErrors(): any[] {
    return this.notificationManager.getActiveNotifications()
      .filter(n => n.type === NotificationType.ERROR && n.persistent);
  }
}

// Global error system instance
let comprehensiveErrorSystem: ComprehensiveErrorSystem | null = null;

export function initializeComprehensiveErrorSystem(
  mainWindow?: BrowserWindow,
  config?: Partial<ErrorSystemConfig>
): ComprehensiveErrorSystem {
  if (!comprehensiveErrorSystem) {
    comprehensiveErrorSystem = new ComprehensiveErrorSystem(config);
  }
  
  return comprehensiveErrorSystem.initialize(mainWindow).then(() => {
    log.info('Comprehensive error handling system ready');
    return comprehensiveErrorSystem!;
  }).catch((error) => {
    log.error('Failed to initialize comprehensive error system:', error);
    throw error;
  });
}

export function getComprehensiveErrorSystem(): ComprehensiveErrorSystem {
  if (!comprehensiveErrorSystem) {
    throw new Error('Comprehensive error system not initialized');
  }
  return comprehensiveErrorSystem;
}

export async function shutdownComprehensiveErrorSystem(): Promise<void> {
  if (comprehensiveErrorSystem) {
    await comprehensiveErrorSystem.shutdown();
    comprehensiveErrorSystem = null;
  }
}

// Error boundary for the main process
export function setupMainProcessErrorBoundary(): void {
  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception in main process:', error);
    
    if (comprehensiveErrorSystem) {
      const systemStatus = comprehensiveErrorSystem.getSystemStatus();
      log.error('System status at time of error:', systemStatus);
      
      // Try to show critical error notification
      try {
        const notificationManager = getUserNotificationManager();
        notificationManager.showNotification({
          id: `critical_${Date.now()}`,
          type: NotificationType.ERROR,
          title: '🚨 Critical Application Error',
          message: 'A critical error occurred. The application may need to be restarted.',
          details: error.message,
          actions: [
            { id: 'restart', label: 'Restart App', type: 'restart_service' as any, primary: true },
            { id: 'dismiss', label: 'Continue', type: 'dismiss' as any, destructive: true }
          ],
          persistent: true,
          timestamp: new Date()
        });
      } catch (notificationError) {
        log.error('Failed to show critical error notification:', notificationError);
      }
    }

    // Don't exit the process immediately, let the error system handle it
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled promise rejection in main process:', reason, promise);
    
    if (comprehensiveErrorSystem && reason instanceof Error) {
      try {
        const notificationManager = getUserNotificationManager();
        notificationManager.showNotification({
          id: `rejection_${Date.now()}`,
          type: NotificationType.WARNING,
          title: '⚠️ Unhandled Promise Rejection',
          message: 'An asynchronous operation failed unexpectedly.',
          details: reason.message,
          actions: [{ id: 'dismiss', label: 'OK', type: 'dismiss' as any }],
          timestamp: new Date()
        });
      } catch (notificationError) {
        log.error('Failed to show rejection notification:', notificationError);
      }
    }
  });
}

export default ComprehensiveErrorSystem;