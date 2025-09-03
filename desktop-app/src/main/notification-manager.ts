import { Notification } from 'electron';
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

  constructor() {
    this.setupNotificationHandlers();
  }

  private setupNotificationHandlers(): void {
    // Request notification permission on macOS
    if (process.platform === 'darwin') {
      try {
        const { systemPreferences } = require('electron');
        if (systemPreferences.getMediaAccessStatus('notifications') !== 'granted') {
          systemPreferences.askForMediaAccess('notifications');
        }
      } catch (error) {
        log.warn('Failed to request notification permission:', error);
      }
    }
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    try {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        tag: options.tag,
        urgency: options.priority === 'high' ? 'critical' : 'normal',
      });

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
    for (const notification of this.activeNotifications.values()) {
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
}