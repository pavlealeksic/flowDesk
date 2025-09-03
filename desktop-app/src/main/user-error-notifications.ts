/**
 * User-Friendly Error Notifications and Recovery Mechanisms
 * 
 * This module provides a comprehensive system for presenting errors to users
 * in an understandable way and guiding them through recovery processes.
 */

import { BrowserWindow, dialog, shell, Notification } from 'electron';
import log from 'electron-log';
import { EventEmitter } from 'events';
import { FlowDeskErrorInfo } from './rust-error-handler';

// Error notification types
export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

export enum ActionType {
  DISMISS = 'dismiss',
  RETRY = 'retry',
  OPEN_URL = 'open_url',
  RESTART_SERVICE = 'restart_service',
  OPEN_SETTINGS = 'open_settings',
  CONTACT_SUPPORT = 'contact_support',
  VIEW_LOGS = 'view_logs',
  ENABLE_OFFLINE_MODE = 'enable_offline_mode'
}

export interface NotificationAction {
  id: string;
  label: string;
  type: ActionType;
  url?: string;
  primary?: boolean;
  destructive?: boolean;
}

export interface UserNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
  actions: NotificationAction[];
  persistent?: boolean;
  timestamp: Date;
  context?: {
    service?: string;
    operation?: string;
    accountId?: string;
    errorCode?: string;
  };
}

export interface RecoveryGuide {
  title: string;
  description: string;
  steps: RecoveryStep[];
  estimatedTime?: string;
  difficulty: 'easy' | 'medium' | 'advanced';
}

export interface RecoveryStep {
  title: string;
  description: string;
  action?: NotificationAction;
  verification?: string;
  troubleshooting?: string[];
}

// Recovery guides for common error scenarios
const RECOVERY_GUIDES: { [key: string]: RecoveryGuide } = {
  authentication: {
    title: 'Re-authenticate Your Account',
    description: 'Your account credentials have expired and need to be refreshed.',
    difficulty: 'easy',
    estimatedTime: '2-3 minutes',
    steps: [
      {
        title: 'Click Re-authenticate',
        description: 'Click the "Re-authenticate" button to open the login page in your browser.',
        action: {
          id: 'auth_step1',
          label: 'Re-authenticate',
          type: ActionType.OPEN_URL
        }
      },
      {
        title: 'Sign in to your account',
        description: 'Enter your credentials in the browser window that opens.',
        verification: 'You should see a success message in your browser.'
      },
      {
        title: 'Return to Flow Desk',
        description: 'The connection will be restored automatically. You can close the browser tab.',
        verification: 'The error notification will disappear and sync will resume.'
      }
    ]
  },
  network: {
    title: 'Fix Network Connection',
    description: 'There appears to be a network connectivity issue preventing synchronization.',
    difficulty: 'easy',
    estimatedTime: '1-2 minutes',
    steps: [
      {
        title: 'Check your internet connection',
        description: 'Ensure you are connected to the internet by opening a web page.',
        verification: 'You can browse websites normally.'
      },
      {
        title: 'Check firewall settings',
        description: 'Make sure Flow Desk is allowed through your firewall.',
        troubleshooting: [
          'Add Flow Desk to your firewall exceptions',
          'Temporarily disable antivirus to test',
          'Check corporate proxy settings'
        ]
      },
      {
        title: 'Retry the operation',
        description: 'Click retry to attempt the operation again.',
        action: {
          id: 'network_retry',
          label: 'Retry',
          type: ActionType.RETRY
        }
      }
    ]
  },
  rate_limit: {
    title: 'Handle Rate Limiting',
    description: 'The service is temporarily limiting requests to prevent overload.',
    difficulty: 'easy',
    estimatedTime: 'Automatic',
    steps: [
      {
        title: 'Wait for automatic retry',
        description: 'Flow Desk will automatically retry the operation after the rate limit resets.',
        verification: 'The operation will complete automatically.'
      },
      {
        title: 'Enable offline mode (optional)',
        description: 'You can continue working with cached data while waiting.',
        action: {
          id: 'enable_offline',
          label: 'Enable Offline Mode',
          type: ActionType.ENABLE_OFFLINE_MODE
        }
      }
    ]
  },
  configuration: {
    title: 'Fix Configuration Issue',
    description: 'There is an issue with your application configuration that needs attention.',
    difficulty: 'medium',
    estimatedTime: '5-10 minutes',
    steps: [
      {
        title: 'Open Settings',
        description: 'Navigate to the Settings section to review your configuration.',
        action: {
          id: 'open_settings',
          label: 'Open Settings',
          type: ActionType.OPEN_SETTINGS
        }
      },
      {
        title: 'Review account settings',
        description: 'Check that all account information is correct and up to date.',
        troubleshooting: [
          'Verify email addresses are correct',
          'Check server settings if using IMAP/SMTP',
          'Ensure OAuth apps are properly configured'
        ]
      },
      {
        title: 'Reset to defaults (if needed)',
        description: 'If problems persist, you can reset settings to their default values.',
        verification: 'Settings should be restored to working defaults.'
      }
    ]
  },
  service_unavailable: {
    title: 'Service Temporarily Unavailable',
    description: 'The requested service is temporarily unavailable but will resume automatically.',
    difficulty: 'easy',
    estimatedTime: 'Automatic',
    steps: [
      {
        title: 'Use offline mode',
        description: 'Continue working with cached data while the service is restored.',
        action: {
          id: 'enable_offline',
          label: 'Continue Offline',
          type: ActionType.ENABLE_OFFLINE_MODE
        }
      },
      {
        title: 'Automatic restoration',
        description: 'The service will be restored automatically and sync will resume.',
        verification: 'You will receive a notification when the service is restored.'
      }
    ]
  }
};

// User notification manager
export class UserNotificationManager extends EventEmitter {
  private mainWindow?: BrowserWindow;
  private activeNotifications: Map<string, UserNotification> = new Map();
  private notificationHistory: UserNotification[] = [];
  private maxHistorySize = 100;

  constructor(mainWindow?: BrowserWindow) {
    super();
    this.mainWindow = mainWindow;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen for notification actions from renderer process
    if (this.mainWindow) {
      this.mainWindow.webContents.on('ipc-message', (event, channel, ...args) => {
        if (channel === 'notification-action') {
          const [notificationId, actionId] = args;
          this.handleNotificationAction(notificationId, actionId);
        }
      });
    }
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.setupEventHandlers();
  }

  public showErrorNotification(
    error: FlowDeskErrorInfo,
    context?: { service?: string; operation?: string; accountId?: string }
  ): string {
    const notification = this.createNotificationFromError(error, context);
    return this.showNotification(notification);
  }

  public showNotification(notification: UserNotification): string {
    // Add to active notifications
    this.activeNotifications.set(notification.id, notification);
    
    // Add to history
    this.notificationHistory.unshift(notification);
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.pop();
    }

    // Log the notification
    log.info(`Showing notification: ${notification.title} - ${notification.message}`);

    // Show system notification for critical errors
    if (notification.type === NotificationType.ERROR && notification.persistent) {
      this.showSystemNotification(notification);
    }

    // Send to renderer process
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('user-notification', notification);
    }

    // Emit event
    this.emit('notification-shown', notification);

    return notification.id;
  }

  private createNotificationFromError(
    error: FlowDeskErrorInfo,
    context?: { service?: string; operation?: string; accountId?: string }
  ): UserNotification {
    const notificationId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const title = this.getErrorTitle(error);
    const message = this.getErrorMessage(error);
    const actions = this.getErrorActions(error);
    
    return {
      id: notificationId,
      type: this.getNotificationType(error),
      title,
      message,
      details: error.recovery_suggestion,
      actions,
      persistent: error.severity === 'critical' || error.requires_user_action,
      timestamp: new Date(),
      context: {
        service: context?.service || error.component,
        operation: context?.operation || error.operation,
        accountId: context?.accountId || error.account_id,
        errorCode: error.error_type
      }
    };
  }

  private getErrorTitle(error: FlowDeskErrorInfo): string {
    const titles: { [key: string]: string } = {
      'authentication': '🔐 Authentication Required',
      'network': '🌐 Connection Issue',
      'rate_limit': '⏱️ Rate Limit Exceeded',
      'validation': '⚠️ Input Error',
      'configuration': '⚙️ Configuration Issue',
      'service_unavailable': '🔧 Service Maintenance',
      'critical': '🚨 Critical Error',
      'database': '💾 Data Storage Issue',
      'provider_api': '🔗 Service Provider Issue'
    };

    return titles[error.error_type] || '❌ An Error Occurred';
  }

  private getErrorMessage(error: FlowDeskErrorInfo): string {
    // Provide user-friendly messages instead of technical error text
    const friendlyMessages: { [key: string]: string } = {
      'authentication': 'Your account needs to be re-authenticated. This is a security measure to keep your data safe.',
      'network': 'Unable to connect to the service. Please check your internet connection and try again.',
      'rate_limit': 'Too many requests were made too quickly. We\'ll automatically retry in a moment.',
      'validation': 'There was an issue with the information provided. Please check and try again.',
      'configuration': 'There\'s an issue with your settings that needs attention.',
      'service_unavailable': 'The service is temporarily unavailable. You can continue working offline.',
      'critical': 'A serious error occurred that requires immediate attention.',
      'database': 'There was an issue accessing your local data storage.',
      'provider_api': 'The external service is experiencing issues. This is usually temporary.'
    };

    const friendlyMessage = friendlyMessages[error.error_type];
    if (friendlyMessage) {
      return friendlyMessage;
    }

    // Fall back to the original message, but make it more user-friendly
    return error.message.replace(/Error:|Exception:/g, '').trim();
  }

  private getNotificationType(error: FlowDeskErrorInfo): NotificationType {
    switch (error.severity) {
      case 'critical':
        return NotificationType.ERROR;
      case 'high':
        return NotificationType.ERROR;
      case 'medium':
        return NotificationType.WARNING;
      case 'low':
        return NotificationType.INFO;
      default:
        return NotificationType.WARNING;
    }
  }

  private getErrorActions(error: FlowDeskErrorInfo): NotificationAction[] {
    const actions: NotificationAction[] = [];

    if (error.requires_user_action) {
      if (error.auth_url) {
        actions.push({
          id: 'reauth',
          label: 'Re-authenticate',
          type: ActionType.OPEN_URL,
          url: error.auth_url,
          primary: true
        });
      } else if (error.error_type === 'configuration') {
        actions.push({
          id: 'open_settings',
          label: 'Open Settings',
          type: ActionType.OPEN_SETTINGS,
          primary: true
        });
      }
    }

    if (error.is_retryable) {
      actions.push({
        id: 'retry',
        label: 'Retry',
        type: ActionType.RETRY,
        primary: !error.requires_user_action
      });
    }

    // Add recovery guide action if available
    if (RECOVERY_GUIDES[error.error_type]) {
      actions.push({
        id: 'show_guide',
        label: 'Show Fix Guide',
        type: ActionType.OPEN_SETTINGS // This would open the recovery guide
      });
    }

    // Add support action for critical errors
    if (error.severity === 'critical') {
      actions.push({
        id: 'contact_support',
        label: 'Contact Support',
        type: ActionType.CONTACT_SUPPORT
      });
    }

    // Always add dismiss action
    actions.push({
      id: 'dismiss',
      label: error.persistent ? 'Remind Later' : 'Dismiss',
      type: ActionType.DISMISS
    });

    return actions;
  }

  private async handleNotificationAction(notificationId: string, actionId: string): Promise<void> {
    const notification = this.activeNotifications.get(notificationId);
    if (!notification) return;

    const action = notification.actions.find(a => a.id === actionId);
    if (!action) return;

    log.info(`Handling notification action: ${actionId} for notification ${notificationId}`);

    try {
      switch (action.type) {
        case ActionType.DISMISS:
          this.dismissNotification(notificationId);
          break;

        case ActionType.RETRY:
          await this.handleRetryAction(notification);
          break;

        case ActionType.OPEN_URL:
          if (action.url) {
            await shell.openExternal(action.url);
          }
          break;

        case ActionType.RESTART_SERVICE:
          await this.handleRestartService(notification);
          break;

        case ActionType.OPEN_SETTINGS:
          this.openSettings(notification);
          break;

        case ActionType.CONTACT_SUPPORT:
          this.contactSupport(notification);
          break;

        case ActionType.VIEW_LOGS:
          this.viewLogs();
          break;

        case ActionType.ENABLE_OFFLINE_MODE:
          this.enableOfflineMode(notification);
          break;
      }

      this.emit('notification-action-handled', { notificationId, actionId, notification });
    } catch (error) {
      log.error(`Failed to handle notification action ${actionId}:`, error);
    }
  }

  private dismissNotification(notificationId: string): void {
    const notification = this.activeNotifications.get(notificationId);
    if (!notification) return;

    this.activeNotifications.delete(notificationId);
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('notification-dismissed', notificationId);
    }

    this.emit('notification-dismissed', notification);
  }

  private async handleRetryAction(notification: UserNotification): Promise<void> {
    // Emit retry event that the service can listen to
    this.emit('retry-requested', {
      service: notification.context?.service,
      operation: notification.context?.operation,
      accountId: notification.context?.accountId,
      notificationId: notification.id
    });

    // Show temporary "retrying" notification
    this.showNotification({
      id: `retry_${notification.id}`,
      type: NotificationType.INFO,
      title: 'Retrying...',
      message: 'Attempting to resolve the issue.',
      actions: [],
      timestamp: new Date()
    });
  }

  private async handleRestartService(notification: UserNotification): Promise<void> {
    if (notification.context?.service) {
      this.emit('service-restart-requested', {
        service: notification.context.service,
        notificationId: notification.id
      });
    }
  }

  private openSettings(notification: UserNotification): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('open-settings', {
        section: notification.context?.service || 'general',
        highlight: notification.context?.errorCode
      });
    }
  }

  private contactSupport(notification: UserNotification): void {
    const supportUrl = 'https://support.flowdesk.app/contact';
    const errorDetails = {
      error_type: notification.context?.errorCode,
      service: notification.context?.service,
      operation: notification.context?.operation,
      timestamp: notification.timestamp.toISOString()
    };

    const supportUrlWithDetails = `${supportUrl}?error=${encodeURIComponent(JSON.stringify(errorDetails))}`;
    shell.openExternal(supportUrlWithDetails);
  }

  private viewLogs(): void {
    const logPath = log.transports.file.getFile().path;
    shell.openPath(logPath);
  }

  private enableOfflineMode(notification: UserNotification): void {
    this.emit('offline-mode-requested', {
      service: notification.context?.service,
      notificationId: notification.id
    });

    this.showNotification({
      id: `offline_${notification.id}`,
      type: NotificationType.SUCCESS,
      title: '📶 Offline Mode Enabled',
      message: 'You can continue working with cached data. Changes will sync when the connection is restored.',
      actions: [{ id: 'dismiss', label: 'OK', type: ActionType.DISMISS }],
      timestamp: new Date()
    });
  }

  private showSystemNotification(notification: UserNotification): void {
    if (Notification.isSupported()) {
      const systemNotification = new Notification({
        title: notification.title.replace(/[🔐🌐⏱️⚠️⚙️🔧🚨💾🔗❌📶]/g, '').trim(),
        body: notification.message,
        icon: this.getNotificationIcon(notification.type),
        urgency: notification.type === NotificationType.ERROR ? 'critical' : 'normal'
      });

      systemNotification.on('click', () => {
        if (this.mainWindow) {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      });

      systemNotification.show();
    }
  }

  private getNotificationIcon(type: NotificationType): string {
    // In production, you'd have actual icon files
    return '';
  }

  public getRecoveryGuide(errorType: string): RecoveryGuide | null {
    return RECOVERY_GUIDES[errorType] || null;
  }

  public getActiveNotifications(): UserNotification[] {
    return Array.from(this.activeNotifications.values());
  }

  public getNotificationHistory(limit = 20): UserNotification[] {
    return this.notificationHistory.slice(0, limit);
  }

  public clearHistory(): void {
    this.notificationHistory = [];
  }

  public dismissAllNotifications(): void {
    for (const notificationId of this.activeNotifications.keys()) {
      this.dismissNotification(notificationId);
    }
  }
}

// Global notification manager instance
let notificationManager: UserNotificationManager | null = null;

export function getUserNotificationManager(mainWindow?: BrowserWindow): UserNotificationManager {
  if (!notificationManager) {
    notificationManager = new UserNotificationManager(mainWindow);
  } else if (mainWindow) {
    notificationManager.setMainWindow(mainWindow);
  }
  return notificationManager;
}

export { RECOVERY_GUIDES };