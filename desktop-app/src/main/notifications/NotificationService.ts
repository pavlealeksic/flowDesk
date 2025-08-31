/**
 * Notification Service
 * Handles system notifications and alerts
 */

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  isRead: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  label: string;
  action: () => void;
}

export interface NotificationOptions {
  title: string;
  body: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  persistent?: boolean;
  actions?: NotificationAction[];
}

export class NotificationService {
  private notifications: Map<string, Notification> = new Map();
  private listeners: Array<(notification: Notification) => void> = [];

  showNotification(options: NotificationOptions): string {
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      title: options.title,
      body: options.body,
      type: options.type || 'info',
      timestamp: new Date(),
      isRead: false,
      actions: options.actions
    };

    this.notifications.set(notification.id, notification);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(notification));

    // Show system notification if available
    if (typeof window !== 'undefined' && window.Notification) {
      if (window.Notification.permission === 'granted') {
        new window.Notification(options.title, {
          body: options.body,
          icon: '/assets/icon.png' // Assuming there's an icon
        });
      }
    }

    return notification.id;
  }

  getNotifications(): Notification[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getUnreadCount(): number {
    return Array.from(this.notifications.values())
      .filter(n => !n.isRead).length;
  }

  markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.isRead = true;
    }
  }

  markAllAsRead(): void {
    for (const notification of this.notifications.values()) {
      notification.isRead = true;
    }
  }

  removeNotification(notificationId: string): void {
    this.notifications.delete(notificationId);
  }

  clearAll(): void {
    this.notifications.clear();
  }

  onNotification(listener: (notification: Notification) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Convenience methods for different notification types
  showInfo(title: string, body: string, options?: Partial<NotificationOptions>): string {
    return this.showNotification({ ...options, title, body, type: 'info' });
  }

  showSuccess(title: string, body: string, options?: Partial<NotificationOptions>): string {
    return this.showNotification({ ...options, title, body, type: 'success' });
  }

  showWarning(title: string, body: string, options?: Partial<NotificationOptions>): string {
    return this.showNotification({ ...options, title, body, type: 'warning' });
  }

  showError(title: string, body: string, options?: Partial<NotificationOptions>): string {
    return this.showNotification({ ...options, title, body, type: 'error' });
  }

  async show(options: NotificationOptions): Promise<string> {
    return this.showNotification(options);
  }
}

export const notificationService = new NotificationService();