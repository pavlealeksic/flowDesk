/**
 * Desktop Notification Manager
 * 
 * Handles native OS notifications, notification center integration,
 * notification rules, DND schedules, and cross-platform notification sync.
 */

import { Notification, ipcMain, BrowserWindow, app, systemPreferences } from 'electron';
import { EventEmitter } from 'events';
import Store from 'electron-store';
import path from 'path';

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    sender?: string[];
    keywords?: string[];
    apps?: string[];
    importance?: 'low' | 'normal' | 'high' | 'critical';
    timeRange?: { start: string; end: string };
    days?: number[]; // 0-6 (Sunday-Saturday)
  };
  actions: {
    show?: boolean;
    sound?: boolean;
    badge?: boolean;
    forward?: string[]; // Forward to other apps/services
    autoReply?: string;
    markAsRead?: boolean;
  };
  priority: number; // Higher number = higher priority
}

export interface DNDSchedule {
  id: string;
  name: string;
  enabled: boolean;
  schedule: {
    start: string; // HH:mm format
    end: string;   // HH:mm format
    days: number[]; // 0-6 (Sunday-Saturday)
    timezone?: string;
  };
  allowBreakthrough: {
    calls: boolean;
    emergencyKeywords: string[];
    vipContacts: string[];
    criticalApps: string[];
  };
  exceptions: {
    dates: string[]; // YYYY-MM-DD format
    events: string[]; // Event IDs that override DND
  };
}

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  data?: any;
  timestamp: number;
  source: string; // e.g., 'mail', 'calendar', 'slack-plugin'
  importance: 'low' | 'normal' | 'high' | 'critical';
  category?: string;
  thread?: string; // For grouping related notifications
  requireInteraction?: boolean;
  silent?: boolean;
  tag?: string; // For replacing previous notifications
}

export interface NotificationStats {
  totalSent: number;
  totalShown: number;
  totalDismissed: number;
  totalClicked: number;
  rulesApplied: number;
  dndBlocked: number;
  lastResetTime: number;
}

export class DesktopNotificationManager extends EventEmitter {
  private electronStore: Store;
  private mainWindow: BrowserWindow | null = null;
  private rules: NotificationRule[] = [];
  private dndSchedules: DNDSchedule[] = [];
  private notificationQueue: NotificationData[] = [];
  private activeNotifications: Map<string, Notification> = new Map();
  private stats: NotificationStats;
  private initialized = false;
  private permissionGranted = false;
  private dndActive = false;
  private queueProcessor: NodeJS.Timeout | null = null;

  constructor(mainWindow?: BrowserWindow) {
    super();
    this.mainWindow = mainWindow || null;
    
    this.electronStore = new Store({
      name: 'notification-config',
      defaults: {
        enabled: true,
        sound: true,
        badge: true,
        rules: [],
        dndSchedules: [],
        stats: {
          totalSent: 0,
          totalShown: 0,
          totalDismissed: 0,
          totalClicked: 0,
          rulesApplied: 0,
          dndBlocked: 0,
          lastResetTime: Date.now(),
        },
        groupSimilar: true,
        maxNotifications: 50,
        autoCloseDelay: 5000,
      },
    });

    this.stats = this.electronStore.get('stats') as NotificationStats;
    this.rules = this.electronStore.get('rules') as NotificationRule[];
    this.dndSchedules = this.electronStore.get('dndSchedules') as DNDSchedule[];

    this.setupIPC();
  }

  /**
   * Initialize the notification manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check and request notification permissions
      await this.checkPermissions();
      
      // Load notification rules and DND schedules
      this.loadRules();
      this.loadDNDSchedules();
      
      // Start queue processor
      this.startQueueProcessor();
      
      // Set up DND schedule monitoring
      this.setupDNDMonitoring();
      
      this.initialized = true;
      this.emit('initialized');
      
    } catch (error) {
      console.error('Failed to initialize notification manager:', error);
      throw error;
    }
  }

  /**
   * Send a notification
   */
  async sendNotification(data: NotificationData): Promise<string> {
    if (!this.initialized) {
      throw new Error('Notification manager not initialized');
    }

    try {
      // Add to stats
      this.stats.totalSent++;
      this.updateStats();

      // Add unique ID if not provided
      if (!data.id) {
        data.id = this.generateNotificationId();
      }

      // Add timestamp if not provided
      if (!data.timestamp) {
        data.timestamp = Date.now();
      }

      // Apply notification rules
      const processedData = await this.applyNotificationRules(data);
      
      if (!processedData) {
        // Notification was filtered out by rules
        return data.id;
      }

      // Check DND status
      if (this.dndActive && !this.shouldBreakThroughDND(processedData)) {
        this.stats.dndBlocked++;
        this.updateStats();
        this.emit('notificationBlocked', { data, reason: 'dnd' });
        return data.id;
      }

      // Add to queue for processing
      this.notificationQueue.push(processedData);
      
      this.emit('notificationQueued', processedData);
      return data.id;
      
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Show notification immediately (bypass queue and rules)
   */
  async showNotificationNow(data: NotificationData): Promise<void> {
    if (!this.permissionGranted) {
      throw new Error('Notification permissions not granted');
    }

    try {
      const notification = new Notification({
        title: data.title,
        body: data.body,
        icon: data.icon || this.getDefaultIcon(),
        sound: data.sound || (this.electronStore.get('sound') ? 'default' : undefined),
        silent: data.silent || false,
        urgency: this.mapImportanceToUrgency(data.importance),
        actions: data.actions?.map(action => ({
          type: 'button',
          text: action.title,
        })) || [],
      });

      // Set up event handlers
      notification.on('click', () => {
        this.stats.totalClicked++;
        this.updateStats();
        this.emit('notificationClicked', data);
        this.handleNotificationClick(data);
      });

      notification.on('close', () => {
        this.stats.totalDismissed++;
        this.updateStats();
        this.activeNotifications.delete(data.id);
        this.emit('notificationClosed', data);
      });

      notification.on('action', (event, index) => {
        const action = data.actions?.[index];
        if (action) {
          this.emit('notificationAction', { data, action: action.action });
          this.handleNotificationAction(data, action.action);
        }
      });

      // Show the notification
      notification.show();
      
      // Track active notification
      this.activeNotifications.set(data.id, notification);
      
      this.stats.totalShown++;
      this.updateStats();
      
      this.emit('notificationShown', data);

      // Auto-close if specified
      const autoCloseDelay = this.electronStore.get('autoCloseDelay') as number;
      if (autoCloseDelay > 0) {
        setTimeout(() => {
          if (this.activeNotifications.has(data.id)) {
            notification.close();
          }
        }, autoCloseDelay);
      }

    } catch (error) {
      console.error('Failed to show notification:', error);
      throw error;
    }
  }

  /**
   * Add or update a notification rule
   */
  async addNotificationRule(rule: NotificationRule): Promise<void> {
    const existingIndex = this.rules.findIndex(r => r.id === rule.id);
    
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }

    // Sort by priority (higher priority first)
    this.rules.sort((a, b) => b.priority - a.priority);
    
    await this.saveRules();
    this.emit('ruleUpdated', rule);
  }

  /**
   * Remove a notification rule
   */
  async removeNotificationRule(ruleId: string): Promise<void> {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    await this.saveRules();
    this.emit('ruleRemoved', ruleId);
  }

  /**
   * Add or update a DND schedule
   */
  async addDNDSchedule(schedule: DNDSchedule): Promise<void> {
    const existingIndex = this.dndSchedules.findIndex(s => s.id === schedule.id);
    
    if (existingIndex >= 0) {
      this.dndSchedules[existingIndex] = schedule;
    } else {
      this.dndSchedules.push(schedule);
    }

    await this.saveDNDSchedules();
    this.updateDNDStatus();
    this.emit('dndScheduleUpdated', schedule);
  }

  /**
   * Remove a DND schedule
   */
  async removeDNDSchedule(scheduleId: string): Promise<void> {
    this.dndSchedules = this.dndSchedules.filter(s => s.id !== scheduleId);
    await this.saveDNDSchedules();
    this.updateDNDStatus();
    this.emit('dndScheduleRemoved', scheduleId);
  }

  /**
   * Manually enable/disable DND
   */
  async setDNDActive(active: boolean, duration?: number): Promise<void> {
    this.dndActive = active;
    
    if (duration && active) {
      // Set temporary DND
      setTimeout(() => {
        this.dndActive = false;
        this.emit('dndStatusChanged', false);
      }, duration);
    }

    this.emit('dndStatusChanged', active);
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    for (const notification of this.activeNotifications.values()) {
      notification.close();
    }
    
    this.activeNotifications.clear();
    this.notificationQueue.length = 0;
    
    this.emit('notificationsCleared');
  }

  /**
   * Clear specific notification
   */
  async clearNotification(notificationId: string): Promise<void> {
    const notification = this.activeNotifications.get(notificationId);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(notificationId);
    }
    
    // Remove from queue if present
    this.notificationQueue = this.notificationQueue.filter(n => n.id !== notificationId);
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    return { ...this.stats };
  }

  /**
   * Reset notification statistics
   */
  resetStats(): void {
    this.stats = {
      totalSent: 0,
      totalShown: 0,
      totalDismissed: 0,
      totalClicked: 0,
      rulesApplied: 0,
      dndBlocked: 0,
      lastResetTime: Date.now(),
    };
    
    this.updateStats();
    this.emit('statsReset');
  }

  /**
   * Get current notification rules
   */
  getRules(): NotificationRule[] {
    return [...this.rules];
  }

  /**
   * Get current DND schedules
   */
  getDNDSchedules(): DNDSchedule[] {
    return [...this.dndSchedules];
  }

  /**
   * Get current status
   */
  getStatus(): {
    initialized: boolean;
    permissionGranted: boolean;
    dndActive: boolean;
    queueLength: number;
    activeNotifications: number;
    rulesCount: number;
    dndSchedulesCount: number;
  } {
    return {
      initialized: this.initialized,
      permissionGranted: this.permissionGranted,
      dndActive: this.dndActive,
      queueLength: this.notificationQueue.length,
      activeNotifications: this.activeNotifications.size,
      rulesCount: this.rules.length,
      dndSchedulesCount: this.dndSchedules.length,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopQueueProcessor();
    await this.clearAllNotifications();
    this.removeAllListeners();
  }

  // Private methods

  private async checkPermissions(): Promise<void> {
    if (process.platform === 'darwin') {
      // macOS - check notification permissions
      const status = systemPreferences.getMediaAccessStatus('notifications' as any);
      this.permissionGranted = status === 'granted';
      
      if (!this.permissionGranted) {
        // Request permission
        try {
          await systemPreferences.askForMediaAccess('notifications' as any);
          this.permissionGranted = true;
        } catch {
          console.warn('Notification permission denied');
        }
      }
    } else {
      // Other platforms - notifications are generally allowed
      this.permissionGranted = true;
    }
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private async applyNotificationRules(data: NotificationData): Promise<NotificationData | null> {
    let processedData = { ...data };
    
    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      
      if (this.matchesRule(processedData, rule)) {
        // Apply rule actions
        if (rule.actions.show === false) {
          this.stats.rulesApplied++;
          this.updateStats();
          this.emit('notificationFiltered', { data, rule });
          return null; // Filter out notification
        }
        
        // Modify notification based on rule
        if (rule.actions.sound === false) {
          processedData.silent = true;
        }
        
        if (rule.actions.markAsRead) {
          // Mark as read in source app
          this.emit('markAsRead', { data, rule });
        }
        
        if (rule.actions.autoReply) {
          this.emit('autoReply', { data, rule, message: rule.actions.autoReply });
        }
        
        if (rule.actions.forward) {
          this.emit('forwardNotification', { data, rule, targets: rule.actions.forward });
        }
        
        this.stats.rulesApplied++;
        this.updateStats();
        this.emit('ruleApplied', { data, rule });
      }
    }
    
    return processedData;
  }

  private matchesRule(data: NotificationData, rule: NotificationRule): boolean {
    const conditions = rule.conditions;
    
    // Check sender
    if (conditions.sender && conditions.sender.length > 0) {
      const matches = conditions.sender.some(sender => 
        data.title.toLowerCase().includes(sender.toLowerCase()) ||
        data.body.toLowerCase().includes(sender.toLowerCase())
      );
      if (!matches) return false;
    }
    
    // Check keywords
    if (conditions.keywords && conditions.keywords.length > 0) {
      const text = `${data.title} ${data.body}`.toLowerCase();
      const matches = conditions.keywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      if (!matches) return false;
    }
    
    // Check apps
    if (conditions.apps && conditions.apps.length > 0) {
      if (!conditions.apps.includes(data.source)) {
        return false;
      }
    }
    
    // Check importance
    if (conditions.importance) {
      if (data.importance !== conditions.importance) {
        return false;
      }
    }
    
    // Check time range
    if (conditions.timeRange) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (currentTime < conditions.timeRange.start || currentTime > conditions.timeRange.end) {
        return false;
      }
    }
    
    // Check days
    if (conditions.days && conditions.days.length > 0) {
      const currentDay = new Date().getDay();
      if (!conditions.days.includes(currentDay)) {
        return false;
      }
    }
    
    return true;
  }

  private shouldBreakThroughDND(data: NotificationData): boolean {
    // Check if any DND schedule allows breakthrough
    for (const schedule of this.dndSchedules) {
      if (!schedule.enabled) continue;
      
      if (this.isInDNDSchedule(schedule)) {
        // Check breakthrough conditions
        if (data.importance === 'critical' && schedule.allowBreakthrough.calls) {
          return true;
        }
        
        if (schedule.allowBreakthrough.emergencyKeywords.length > 0) {
          const text = `${data.title} ${data.body}`.toLowerCase();
          const hasEmergencyKeyword = schedule.allowBreakthrough.emergencyKeywords.some(keyword =>
            text.includes(keyword.toLowerCase())
          );
          if (hasEmergencyKeyword) return true;
        }
        
        if (schedule.allowBreakthrough.criticalApps.includes(data.source)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private isInDNDSchedule(schedule: DNDSchedule): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Check if current day is in schedule
    if (!schedule.schedule.days.includes(currentDay)) {
      return false;
    }
    
    // Check if current time is in range
    return currentTime >= schedule.schedule.start && currentTime <= schedule.schedule.end;
  }

  private updateDNDStatus(): void {
    const wasActive = this.dndActive;
    this.dndActive = this.dndSchedules.some(schedule => 
      schedule.enabled && this.isInDNDSchedule(schedule)
    );
    
    if (wasActive !== this.dndActive) {
      this.emit('dndStatusChanged', this.dndActive);
    }
  }

  private setupDNDMonitoring(): void {
    // Check DND status every minute
    setInterval(() => {
      this.updateDNDStatus();
    }, 60000);
  }

  private startQueueProcessor(): void {
    if (this.queueProcessor) return;
    
    this.queueProcessor = setInterval(async () => {
      if (this.notificationQueue.length === 0) return;
      
      const maxNotifications = this.electronStore.get('maxNotifications') as number;
      
      // Process notifications in queue
      while (this.notificationQueue.length > 0 && this.activeNotifications.size < maxNotifications) {
        const notification = this.notificationQueue.shift();
        if (notification) {
          try {
            await this.showNotificationNow(notification);
          } catch (error) {
            console.error('Failed to show queued notification:', error);
          }
        }
      }
    }, 1000); // Process every second
  }

  private stopQueueProcessor(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }
  }

  private handleNotificationClick(data: NotificationData): void {
    // Bring main window to focus
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.show();
      this.mainWindow.focus();
      
      // Send notification click to renderer
      this.mainWindow.webContents.send('notification-clicked', data);
    }
  }

  private handleNotificationAction(data: NotificationData, action: string): void {
    // Handle notification action
    this.emit('notificationActionHandled', { data, action });
    
    // Send action to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('notification-action', { data, action });
    }
  }

  private mapImportanceToUrgency(importance: string): 'normal' | 'critical' | 'low' {
    switch (importance) {
      case 'critical': return 'critical';
      case 'low': return 'low';
      default: return 'normal';
    }
  }

  private getDefaultIcon(): string {
    return path.join(__dirname, '../../assets/notification-icon.png');
  }

  private loadRules(): void {
    // Rules are already loaded from electronStore in constructor
  }

  private loadDNDSchedules(): void {
    // DND schedules are already loaded from electronStore in constructor
  }

  private async saveRules(): Promise<void> {
    this.electronStore.set('rules', this.rules);
  }

  private async saveDNDSchedules(): Promise<void> {
    this.electronStore.set('dndSchedules', this.dndSchedules);
  }

  private updateStats(): void {
    this.electronStore.set('stats', this.stats);
  }

  private setupIPC(): void {
    ipcMain.handle('notifications:send', async (_, data: NotificationData) => {
      return await this.sendNotification(data);
    });

    ipcMain.handle('notifications:clear-all', async () => {
      await this.clearAllNotifications();
    });

    ipcMain.handle('notifications:clear', async (_, notificationId: string) => {
      await this.clearNotification(notificationId);
    });

    ipcMain.handle('notifications:get-status', () => {
      return this.getStatus();
    });

    ipcMain.handle('notifications:get-stats', () => {
      return this.getStats();
    });

    ipcMain.handle('notifications:reset-stats', () => {
      this.resetStats();
    });

    ipcMain.handle('notifications:get-rules', () => {
      return this.getRules();
    });

    ipcMain.handle('notifications:add-rule', async (_, rule: NotificationRule) => {
      await this.addNotificationRule(rule);
    });

    ipcMain.handle('notifications:remove-rule', async (_, ruleId: string) => {
      await this.removeNotificationRule(ruleId);
    });

    ipcMain.handle('notifications:get-dnd-schedules', () => {
      return this.getDNDSchedules();
    });

    ipcMain.handle('notifications:add-dnd-schedule', async (_, schedule: DNDSchedule) => {
      await this.addDNDSchedule(schedule);
    });

    ipcMain.handle('notifications:remove-dnd-schedule', async (_, scheduleId: string) => {
      await this.removeDNDSchedule(scheduleId);
    });

    ipcMain.handle('notifications:set-dnd', async (_, active: boolean, duration?: number) => {
      await this.setDNDActive(active, duration);
    });
  }
}