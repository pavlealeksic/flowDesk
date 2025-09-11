import { Notification, BrowserWindow } from 'electron';
import log from 'electron-log';

export interface NotificationOptions {
  title: string;
  body: string;
  tag?: string;
  priority?: 'normal' | 'high' | 'low';
  actions?: Array<{
    type: string;
    text: string;
  }>;
}

export class DesktopNotificationManager {
  private activeNotifications: Map<string, Notification> = new Map();
  private mainWindow?: BrowserWindow;

  constructor(mainWindow?: BrowserWindow) {
    this.mainWindow = mainWindow || undefined;
    this.setupNotificationHandlers();
  }

  async initialize(): Promise<void> {
    log.info('Desktop notification manager initializing...');
    
    try {
      // Verify notification support
      if (!Notification.isSupported()) {
        log.warn('Notifications are not supported on this system');
        return;
      }

      // On macOS, check notification permissions
      if (process.platform === 'darwin') {
        try {
          const { systemPreferences } = require('electron');
          const getNotificationPermission = (systemPreferences as any).getNotificationPermission;
          
          if (typeof getNotificationPermission === 'function') {
            const permission = getNotificationPermission();
            log.info(`Notification permission status: ${permission}`);
            if (permission === 'denied') {
              log.warn('Notification permissions denied. Users can enable them in System Preferences.');
            }
          } else {
            log.info('getNotificationPermission not available on this Electron version');
          }
        } catch (permError) {
          log.warn('Failed to check macOS notification permissions:', permError);
          // Continue anyway - basic notifications might still work
        }
      }
      
      log.info('Desktop notification manager initialized successfully');
    } catch (error) {
      log.error('Failed to initialize notification manager:', error);
      // Don't throw - continue without advanced notification features
      log.info('Continuing with basic notification support');
    }
  }

  private setupNotificationHandlers(): void {
    // Check notification permissions
    try {
      if (process.platform === 'darwin') {
        const { systemPreferences } = require('electron');
        
        // Check if we have notification permissions
        try {
          const getNotificationPermission = (systemPreferences as any).getNotificationPermission;
          if (typeof getNotificationPermission === 'function') {
            const notificationPermission = getNotificationPermission();
            log.info(`Notification permission status: ${notificationPermission}`);
            if (notificationPermission === 'denied') {
              log.warn('Notification permissions denied. Notifications will not be shown.');
              return;
            }
          }
        } catch (permError) {
          log.warn('Failed to check notification permissions:', permError);
          // Continue anyway - permissions might still work
        }
      }
      
      // Test notification availability
      if (!Notification.isSupported()) {
        log.warn('Notifications are not supported on this system');
        return;
      }
      
      log.info('Notification system initialized successfully');
    } catch (error) {
      log.warn('Failed to setup notification handlers:', error);
      // Don't throw - continue without notifications
    }
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    try {
      // Check if notifications are supported
      if (!Notification.isSupported()) {
        log.warn('Notifications not supported, skipping notification');
        return;
      }

      // Check permissions on macOS
      if (process.platform === 'darwin') {
        try {
          const { systemPreferences } = require('electron');
          const getNotificationPermission = (systemPreferences as any).getNotificationPermission;
          
          if (typeof getNotificationPermission === 'function') {
            const permission = getNotificationPermission();
            if (permission === 'denied') {
              log.warn('Notification permissions denied, skipping notification');
              return;
            }
          }
        } catch (permError) {
          log.warn('Failed to check notification permissions, attempting to show notification anyway:', permError);
          // Continue with showing notification - it might still work
        }
      }

      const notificationConfig: Electron.NotificationConstructorOptions = {
        title: options.title,
        body: options.body,
        silent: false,
      };

      // Add urgency for Linux systems
      if (process.platform === 'linux' && options.priority) {
        notificationConfig.urgency = options.priority === 'high' ? 'critical' : 'normal';
      }

      const notification = new Notification(notificationConfig);

      if (options.tag) {
        // Close existing notification with same tag
        const existing = this.activeNotifications.get(options.tag);
        if (existing) {
          existing.close();
        }
        this.activeNotifications.set(options.tag, notification);
      }

      notification.on('close', () => {
        if (options.tag) {
          this.activeNotifications.delete(options.tag);
        }
      });

      notification.on('click', () => {
        // Focus main window when notification is clicked
        if (this.mainWindow) {
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.focus();
        }
      });

      notification.show();
      log.info(`Notification shown: ${options.title}`);
    } catch (error) {
      log.error('Failed to show notification:', error);
    }
  }

  async showEmailNotification(
    subject: string,
    sender: string,
    accountName: string
  ): Promise<void> {
    await this.showNotification({
      title: `New Email - ${accountName}`,
      body: `From: ${sender}\n${subject}`,
      tag: 'email',
      priority: 'normal',
    });
  }

  async showCalendarNotification(
    eventTitle: string,
    time: string
  ): Promise<void> {
    await this.showNotification({
      title: 'Calendar Reminder',
      body: `${eventTitle} at ${time}`,
      tag: 'calendar',
      priority: 'high',
    });
  }

  clearAllNotifications(): void {
    for (const notification of Array.from(this.activeNotifications.values())) {
      notification.close();
    }
    this.activeNotifications.clear();
  }

  clearNotification(tag: string): void {
    const notification = this.activeNotifications.get(tag);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(tag);
    }
  }

  isNotificationSupported(): boolean {
    return Notification.isSupported();
  }

  getNotificationPermissionStatus(): 'granted' | 'denied' | 'unknown' | 'not-determined' {
    try {
      if (process.platform === 'darwin') {
        try {
          const { systemPreferences } = require('electron');
          const getNotificationPermission = (systemPreferences as any).getNotificationPermission;
          if (typeof getNotificationPermission === 'function') {
            const permission = getNotificationPermission();
            return permission || 'unknown';
          } else {
            return 'unknown';
          }
        } catch (macError) {
          log.warn('Failed to get macOS notification permission status:', macError);
          return 'unknown';
        }
      }
      // On Windows and Linux, permissions are typically granted by default
      return 'granted';
    } catch (error) {
      log.warn('Failed to get notification permission status:', error);
      return 'unknown';
    }
  }

  async cleanup(): Promise<void> {
    this.clearAllNotifications();
    log.info('Desktop notification manager cleaned up');
  }
}