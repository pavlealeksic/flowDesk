/**
 * Notification Store Slice - Manages notifications hub, rules, and digests
 */

import { StateCreator } from 'zustand';

export interface NotificationRule {
  id: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  conditions: NotificationCondition[];
  actions: NotificationAction[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationCondition {
  type: 'sender' | 'subject' | 'keyword' | 'app' | 'time' | 'unread_count';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
  value: string | number;
}

export interface NotificationAction {
  type: 'show' | 'bundle' | 'suppress' | 'forward' | 'digest';
  config: Record<string, any>;
}

export interface AppNotification {
  id: string;
  appId: string;
  appName: string;
  type: 'email' | 'calendar' | 'plugin' | 'system';
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, any>;
  isRead: boolean;
  isArchived: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  readAt?: Date;
  actionButtons?: NotificationButton[];
}

export interface NotificationButton {
  id: string;
  label: string;
  action: string;
  style?: 'default' | 'primary' | 'destructive';
}

export interface NotificationDigest {
  id: string;
  name: string;
  schedule: {
    type: 'daily' | 'weekly' | 'custom';
    time: string; // HH:mm format
    days?: number[]; // 0-6, Sunday = 0
  };
  filters: {
    apps: string[];
    priorities: string[];
    keywords: string[];
  };
  isEnabled: boolean;
  lastSent?: Date;
}

export interface NotificationSettings {
  globalEnabled: boolean;
  doNotDisturbEnabled: boolean;
  doNotDisturbSchedule?: {
    start: string; // HH:mm
    end: string; // HH:mm
    days: number[];
  };
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeCountEnabled: boolean;
  previewEnabled: boolean;
}

export interface NotificationSlice {
  // State
  notifications: AppNotification[];
  rules: NotificationRule[];
  digests: NotificationDigest[];
  settings: NotificationSettings;
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  
  // Notification management
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead' | 'isArchived'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  archiveNotification: (id: string) => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Rule management
  createRule: (rule: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateRule: (id: string, updates: Partial<NotificationRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  
  // Digest management
  createDigest: (digest: Omit<NotificationDigest, 'id'>) => string;
  updateDigest: (id: string, updates: Partial<NotificationDigest>) => void;
  deleteDigest: (id: string) => void;
  sendDigest: (id: string) => Promise<void>;
  
  // Settings
  updateSettings: (updates: Partial<NotificationSettings>) => void;
  toggleDoNotDisturb: () => void;
  
  // Actions
  executeNotificationAction: (notificationId: string, actionId: string) => Promise<void>;
  
  // Utility functions
  getUnreadNotifications: () => AppNotification[];
  getNotificationsByApp: (appId: string) => AppNotification[];
  isInDoNotDisturbMode: () => boolean;
}

export const createNotificationStore: StateCreator<
  any,
  [],
  [],
  NotificationSlice
> = (set, get) => ({
  // Initial state
  notifications: [],
  rules: [],
  digests: [],
  settings: {
    globalEnabled: true,
    doNotDisturbEnabled: false,
    soundEnabled: true,
    vibrationEnabled: true,
    badgeCountEnabled: true,
    previewEnabled: true,
  },
  unreadCount: 0,
  isLoading: false,
  error: null,
  
  // Notification management
  addNotification: (notificationData) => {
    const notification: AppNotification = {
      ...notificationData,
      id: `notif_${Date.now()}`,
      createdAt: new Date(),
      isRead: false,
      isArchived: false,
    };
    
    // Apply rules to determine if notification should be shown
    const rules = get().rules.filter(r => r.isEnabled);
    let shouldShow = true;
    let finalNotification = notification;
    
    for (const rule of rules) {
      // Simple rule evaluation (in production, this would be more sophisticated)
      const matches = rule.conditions.every(condition => {
        switch (condition.type) {
          case 'app':
            return notification.appId === condition.value;
          case 'keyword':
            return notification.title.toLowerCase().includes((condition.value as string).toLowerCase()) ||
                   notification.body.toLowerCase().includes((condition.value as string).toLowerCase());
          default:
            return true;
        }
      });
      
      if (matches) {
        rule.actions.forEach(action => {
          switch (action.type) {
            case 'suppress':
              shouldShow = false;
              break;
            case 'bundle':
              finalNotification.priority = 'low';
              break;
          }
        });
      }
    }
    
    if (shouldShow && !get().isInDoNotDisturbMode()) {
      set((state: any) => {
        state.notifications.unshift(finalNotification);
        state.unreadCount = state.notifications.filter((n: AppNotification) => !n.isRead).length;
      });
    }
  },
  
  markAsRead: (id) => {
    set((state: any) => {
      const notification = state.notifications.find((n: AppNotification) => n.id === id);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date();
        state.unreadCount = state.notifications.filter((n: AppNotification) => !n.isRead).length;
      }
    });
  },
  
  markAllAsRead: () => {
    set((state: any) => {
      const now = new Date();
      state.notifications.forEach((n: AppNotification) => {
        if (!n.isRead) {
          n.isRead = true;
          n.readAt = now;
        }
      });
      state.unreadCount = 0;
    });
  },
  
  archiveNotification: (id) => {
    set((state: any) => {
      const notification = state.notifications.find((n: AppNotification) => n.id === id);
      if (notification) {
        notification.isArchived = true;
        if (!notification.isRead) {
          notification.isRead = true;
          notification.readAt = new Date();
        }
        state.unreadCount = state.notifications.filter((n: AppNotification) => !n.isRead).length;
      }
    });
  },
  
  deleteNotification: (id) => {
    set((state: any) => {
      const index = state.notifications.findIndex((n: AppNotification) => n.id === id);
      if (index >= 0) {
        const notification = state.notifications[index];
        state.notifications.splice(index, 1);
        
        if (!notification.isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      }
    });
  },
  
  clearAllNotifications: () => {
    set((state: any) => {
      state.notifications = [];
      state.unreadCount = 0;
    });
  },
  
  // Rule management
  createRule: (ruleData) => {
    const id = `rule_${Date.now()}`;
    const rule: NotificationRule = {
      ...ruleData,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state: any) => {
      state.rules.push(rule);
    });
    
    return id;
  },
  
  updateRule: (id, updates) => {
    set((state: any) => {
      const index = state.rules.findIndex((r: NotificationRule) => r.id === id);
      if (index >= 0) {
        state.rules[index] = {
          ...state.rules[index],
          ...updates,
          updatedAt: new Date(),
        };
      }
    });
  },
  
  deleteRule: (id) => {
    set((state: any) => {
      state.rules = state.rules.filter((r: NotificationRule) => r.id !== id);
    });
  },
  
  toggleRule: (id) => {
    set((state: any) => {
      const rule = state.rules.find((r: NotificationRule) => r.id === id);
      if (rule) {
        rule.isEnabled = !rule.isEnabled;
        rule.updatedAt = new Date();
      }
    });
  },
  
  // Digest management
  createDigest: (digestData) => {
    const id = `digest_${Date.now()}`;
    const digest: NotificationDigest = {
      ...digestData,
      id,
    };
    
    set((state: any) => {
      state.digests.push(digest);
    });
    
    return id;
  },
  
  updateDigest: (id, updates) => {
    set((state: any) => {
      const index = state.digests.findIndex((d: NotificationDigest) => d.id === id);
      if (index >= 0) {
        state.digests[index] = { ...state.digests[index], ...updates };
      }
    });
  },
  
  deleteDigest: (id) => {
    set((state: any) => {
      state.digests = state.digests.filter((d: NotificationDigest) => d.id !== id);
    });
  },
  
  sendDigest: async (id) => {
    const digest = get().digests.find(d => d.id === id);
    if (!digest || !digest.isEnabled) return;
    
    // Mock digest sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    set((state: any) => {
      const digestIndex = state.digests.findIndex((d: NotificationDigest) => d.id === id);
      if (digestIndex >= 0) {
        state.digests[digestIndex].lastSent = new Date();
      }
    });
  },
  
  // Settings
  updateSettings: (updates) => {
    set((state: any) => {
      state.settings = { ...state.settings, ...updates };
    });
  },
  
  toggleDoNotDisturb: () => {
    set((state: any) => {
      state.settings.doNotDisturbEnabled = !state.settings.doNotDisturbEnabled;
    });
  },
  
  // Actions
  executeNotificationAction: async (notificationId, actionId) => {
    const notification = get().notifications.find(n => n.id === notificationId);
    const actionButton = notification?.actionButtons?.find(b => b.id === actionId);
    
    if (actionButton) {
      // Execute the action based on the action string
      console.log(`Executing action: ${actionButton.action} for notification: ${notificationId}`);
      
      // Mark notification as read after action
      get().markAsRead(notificationId);
    }
  },
  
  // Utility functions
  getUnreadNotifications: () => {
    return get().notifications.filter(n => !n.isRead && !n.isArchived);
  },
  
  getNotificationsByApp: (appId) => {
    return get().notifications.filter(n => n.appId === appId);
  },
  
  isInDoNotDisturbMode: () => {
    const settings = get().settings;
    if (!settings.doNotDisturbEnabled || !settings.doNotDisturbSchedule) {
      return false;
    }
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();
    
    const { start, end, days } = settings.doNotDisturbSchedule;
    
    if (!days.includes(currentDay)) {
      return false;
    }
    
    // Simple time comparison (doesn't handle cross-midnight ranges)
    return currentTime >= start && currentTime <= end;
  },
});