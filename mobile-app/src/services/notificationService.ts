/**
 * Enhanced Notification Service - Handles push notifications, local notifications, and cross-platform sync
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import { useStore } from '../store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Background task for notification sync
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Determine if we should show the notification based on focus rules
    const focusModeActive = await AsyncStorage.getItem('focusModeActive');
    const notificationRules = await AsyncStorage.getItem('notificationRules');
    
    if (focusModeActive === 'true') {
      const rules = notificationRules ? JSON.parse(notificationRules) : [];
      const shouldBreakthrough = rules.some((rule: any) => 
        rule.breakthrough && rule.apps?.includes(notification.request.content.data?.source)
      );
      
      if (!shouldBreakthrough) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: true,
        };
      }
    }
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    apps?: string[];
    keywords?: string[];
    senders?: string[];
    importance?: 'low' | 'normal' | 'high' | 'critical';
    timeRange?: { start: string; end: string };
    days?: number[];
  };
  actions: {
    show: boolean;
    sound: boolean;
    vibrate: boolean;
    breakthrough: boolean;
    autoReply?: string;
    forward?: string[];
  };
}

export interface NotificationSyncData {
  id: string;
  deviceId: string;
  timestamp: number;
  action: 'read' | 'dismissed' | 'clicked' | 'archived';
  notificationId: string;
  source: string;
}

export class NotificationService {
  private static instance: NotificationService | null = null;
  private pushToken: string | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private rules: NotificationRule[] = [];
  private notificationHistory: any[] = [];
  private webSocketConnection: WebSocket | null = null;
  private isOnline: boolean = true;
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }
  
  async initialize() {
    // Request permissions
    const { status } = await this.requestPermissions();
    
    if (status !== 'granted') {
      console.warn('Notification permissions not granted');
      return;
    }
    
    // Get push token for remote notifications
    try {
      this.pushToken = await this.getPushToken();
      console.log('Push token:', this.pushToken);
      
      // Register token with sync service
      await this.registerTokenWithServer();
    } catch (error) {
      console.error('Failed to get push token:', error);
    }
    
    // Load notification rules
    await this.loadNotificationRules();
    
    // Set up notification listeners
    this.setupListeners();
    
    // Set up network monitoring
    this.setupNetworkMonitoring();
    
    // Initialize cross-platform sync
    await this.initializeCrossPlatformSync();
    
    // Set up background tasks
    await this.setupBackgroundTasks();
    
    // Start periodic sync
    this.startPeriodicSync();
  }
  
  private async requestPermissions() {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return { status: 'denied' };
    }
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return { status: finalStatus };
  }
  
  private async getPushToken(): Promise<string> {
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID || 'your-expo-project-id',
    })).data;
    
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      // Create additional channels for different notification types
      await Notifications.setNotificationChannelAsync('email', {
        name: 'Email Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'email_notification.wav',
      });
      
      await Notifications.setNotificationChannelAsync('calendar', {
        name: 'Calendar Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'calendar_notification.wav',
      });
      
      await Notifications.setNotificationChannelAsync('focus', {
        name: 'Focus Mode',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0],
        sound: null,
      });
    }
    
    return token;
  }
  
  private setupListeners() {
    // Handle notifications received while app is foregrounded
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      this.handleNotificationReceived(notification);
      
      // Add to history
      this.addToHistory({
        id: notification.request.identifier,
        action: 'received',
        timestamp: Date.now(),
        notification: notification.request.content
      });
    });
    
    // Handle notification taps
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
      
      // Sync action across devices
      this.syncNotificationAction({
        id: `${Date.now()}_${Math.random()}`,
        deviceId: Device.deviceName || 'unknown',
        timestamp: Date.now(),
        action: 'clicked',
        notificationId: response.notification.request.identifier,
        source: response.notification.request.content.data?.source || 'unknown'
      });
    });
  }
  
  private handleNotificationReceived(notification: Notifications.Notification) {
    const { request } = notification;
    const { content } = request;
    
    // Add to app's notification store
    const store = useStore.getState();
    
    store.addNotification({
      appId: content.data?.appId || 'system',
      appName: content.data?.appName || 'System',
      type: content.data?.type || 'system',
      title: content.title || 'Notification',
      body: content.body || '',
      data: content.data,
      priority: content.data?.priority || 'normal',
    });
  }
  
  private handleNotificationResponse(response: Notifications.NotificationResponse) {
    const { notification, actionIdentifier } = response;
    const { request } = notification;
    const { content } = request;
    
    // Handle different notification actions
    if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // User tapped the notification
      this.handleNotificationTap(content.data);
    } else {
      // User tapped a specific action button
      this.handleNotificationAction(actionIdentifier, content.data);
    }
  }
  
  private handleNotificationTap(data: any) {
    // Navigate to relevant screen based on notification data
    if (data?.type === 'email' && data?.messageId) {
      // Navigate to email
      useStore.getState().setSelectedMessage?.(data.messageId);
    } else if (data?.type === 'calendar' && data?.eventId) {
      // Navigate to calendar event
      useStore.getState().setSelectedEvent?.(data.eventId);
    } else if (data?.type === 'task' && data?.taskId) {
      // Navigate to task
      useStore.getState().setSelectedTask?.(data.taskId);
    }
  }
  
  private handleNotificationAction(actionId: string, data: any) {
    // Handle specific action buttons
    switch (actionId) {
      case 'reply':
      case 'quick_reply':
        // Open compose with reply context
        useStore.getState().openReply?.(data);
        break;
      case 'archive':
        // Archive the email
        if (data?.messageId) {
          useStore.getState().archiveMessage?.(data.messageId);
        }
        break;
      case 'mark_read':
        // Mark as read
        if (data?.messageId) {
          useStore.getState().markAsRead?.(data.messageId);
        }
        break;
      case 'accept':
        // Accept calendar event
        if (data?.eventId) {
          useStore.getState().respondToEvent?.(data.eventId, 'accepted');
        }
        break;
      case 'decline':
        // Decline calendar event
        if (data?.eventId) {
          useStore.getState().respondToEvent?.(data.eventId, 'declined');
        }
        break;
      case 'maybe':
        // Maybe respond to calendar event
        if (data?.eventId) {
          useStore.getState().respondToEvent?.(data.eventId, 'tentative');
        }
        break;
      case 'complete':
        // Complete task
        if (data?.taskId) {
          useStore.getState().completeTask?.(data.taskId);
        }
        break;
      case 'snooze':
        // Snooze notification
        this.snoozeNotification(data);
        break;
    }
  }
  
  private async snoozeNotification(data: any): Promise<void> {
    // Schedule the notification to appear again in 1 hour
    await this.scheduleLocalNotification({
      title: data.title || 'Reminder',
      body: data.body || 'Snoozed notification',
      data,
      trigger: {
        seconds: 60 * 60, // 1 hour
      },
    });
  }
  
  async scheduleLocalNotification({
    title,
    body,
    data,
    trigger,
    categoryId,
    channelId,
  }: {
    title: string;
    body: string;
    data?: any;
    trigger?: Notifications.NotificationTriggerInput;
    categoryId?: string;
    channelId?: string;
  }) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          categoryIdentifier: categoryId,
        },
        trigger: trigger || null, // null means show immediately
        ...(Platform.OS === 'android' && channelId ? { channelId } : {}),
      });
      
      return id;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      throw error;
    }
  }
  
  async cancelNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
  
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
  
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }
  
  getPushToken(): string | null {
    return this.pushToken;
  }
  
  // Create notification categories with actions
  async createNotificationCategories() {
    await Notifications.setNotificationCategoryAsync('email', [
      {
        identifier: 'reply',
        buttonTitle: 'Reply',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'archive',
        buttonTitle: 'Archive',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark Read',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
    
    await Notifications.setNotificationCategoryAsync('calendar', [
      {
        identifier: 'accept',
        buttonTitle: 'Accept',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'decline',
        buttonTitle: 'Decline',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'maybe',
        buttonTitle: 'Maybe',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
    
    await Notifications.setNotificationCategoryAsync('task', [
      {
        identifier: 'complete',
        buttonTitle: 'Complete',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
    
    await Notifications.setNotificationCategoryAsync('message', [
      {
        identifier: 'quick_reply',
        buttonTitle: 'Quick Reply',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'mark_read',
        buttonTitle: 'Mark Read',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);
  }
  
  // Cross-platform sync methods
  
  private async initializeCrossPlatformSync(): Promise<void> {
    try {
      // Get sync endpoint from config
      const syncEndpoint = await AsyncStorage.getItem('syncEndpoint');
      if (syncEndpoint) {
        this.connectToSyncService(syncEndpoint);
      }
    } catch (error) {
      console.error('Failed to initialize cross-platform sync:', error);
    }
  }
  
  private connectToSyncService(endpoint: string): void {
    if (this.webSocketConnection) {
      this.webSocketConnection.close();
    }
    
    this.webSocketConnection = new WebSocket(endpoint);
    
    this.webSocketConnection.onopen = () => {
      console.log('Connected to notification sync service');
      // Register device
      this.webSocketConnection?.send(JSON.stringify({
        type: 'register',
        deviceId: Device.deviceName,
        platform: Platform.OS,
        pushToken: this.pushToken
      }));
    };
    
    this.webSocketConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSyncMessage(data);
      } catch (error) {
        console.error('Failed to parse sync message:', error);
      }
    };
    
    this.webSocketConnection.onclose = () => {
      console.log('Disconnected from notification sync service');
      // Attempt reconnection after delay
      setTimeout(() => {
        if (this.isOnline) {
          this.connectToSyncService(endpoint);
        }
      }, 5000);
    };
    
    this.webSocketConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  private handleSyncMessage(data: any): void {
    switch (data.type) {
      case 'notification_action':
        this.handleRemoteNotificationAction(data.payload);
        break;
      case 'notification_read':
        this.handleRemoteNotificationRead(data.payload);
        break;
      case 'focus_mode_changed':
        this.handleRemoteFocusModeChange(data.payload);
        break;
      case 'rules_updated':
        this.handleRemoteRulesUpdate(data.payload);
        break;
    }
  }
  
  private async handleRemoteNotificationAction(payload: NotificationSyncData): Promise<void> {
    // Mark local notification as handled to prevent duplicate actions
    await AsyncStorage.setItem(
      `notification_${payload.notificationId}_handled`,
      'true'
    );
    
    // Update local state
    useStore.getState().syncNotificationAction?.(payload);
  }
  
  private async handleRemoteNotificationRead(payload: any): Promise<void> {
    // Mark local notifications as read
    if (payload.messageIds) {
      useStore.getState().markMessagesAsRead?.(payload.messageIds);
    }
  }
  
  private async handleRemoteFocusModeChange(payload: any): Promise<void> {
    await AsyncStorage.setItem('focusModeActive', payload.active.toString());
    useStore.getState().setFocusMode?.(payload.active);
  }
  
  private async handleRemoteRulesUpdate(payload: any): Promise<void> {
    this.rules = payload.rules;
    await AsyncStorage.setItem('notificationRules', JSON.stringify(this.rules));
    useStore.getState().updateNotificationRules?.(this.rules);
  }
  
  private async syncNotificationAction(data: NotificationSyncData): Promise<void> {
    if (this.webSocketConnection?.readyState === WebSocket.OPEN) {
      this.webSocketConnection.send(JSON.stringify({
        type: 'notification_action',
        payload: data
      }));
    } else {
      // Store for later sync
      const pendingActions = await AsyncStorage.getItem('pendingNotificationActions');
      const actions = pendingActions ? JSON.parse(pendingActions) : [];
      actions.push(data);
      await AsyncStorage.setItem('pendingNotificationActions', JSON.stringify(actions));
    }
  }
  
  private async registerTokenWithServer(): Promise<void> {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const deviceId = Device.deviceName;
      
      if (userId && this.pushToken) {
        // Send to your backend to register the token
        const response = await fetch('https://api.flowdesk.com/notifications/register-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
          },
          body: JSON.stringify({
            userId,
            deviceId,
            pushToken: this.pushToken,
            platform: Platform.OS
          })
        });
        
        if (response.ok) {
          console.log('Push token registered successfully');
        }
      }
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }
  
  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (!wasOnline && this.isOnline) {
        // Reconnect to sync service
        this.initializeCrossPlatformSync();
        
        // Sync pending actions
        this.syncPendingActions();
      }
    });
  }
  
  private async syncPendingActions(): Promise<void> {
    try {
      const pendingActions = await AsyncStorage.getItem('pendingNotificationActions');
      if (pendingActions) {
        const actions = JSON.parse(pendingActions);
        
        for (const action of actions) {
          await this.syncNotificationAction(action);
        }
        
        // Clear pending actions
        await AsyncStorage.removeItem('pendingNotificationActions');
      }
    } catch (error) {
      console.error('Failed to sync pending actions:', error);
    }
  }
  
  private async setupBackgroundTasks(): Promise<void> {
    try {
      // Define background task
      TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
        try {
          // Sync notification state in background
          await this.syncPendingActions();
          
          // Check for any missed notifications
          await this.checkMissedNotifications();
          
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          console.error('Background notification task failed:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
      
      // Register background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
    } catch (error) {
      console.error('Failed to setup background tasks:', error);
    }
  }
  
  private async checkMissedNotifications(): Promise<void> {
    // Implementation to check for missed notifications from server
    try {
      const lastSyncTime = await AsyncStorage.getItem('lastNotificationSync');
      const userId = await AsyncStorage.getItem('userId');
      
      if (userId) {
        const response = await fetch(`https://api.flowdesk.com/notifications/missed?since=${lastSyncTime}`, {
          headers: {
            'Authorization': `Bearer ${await AsyncStorage.getItem('authToken')}`,
          },
        });
        
        if (response.ok) {
          const missedNotifications = await response.json();
          
          for (const notification of missedNotifications) {
            await this.scheduleLocalNotification({
              title: notification.title,
              body: notification.body,
              data: notification.data,
              categoryId: notification.categoryId,
              channelId: notification.channelId,
            });
          }
          
          await AsyncStorage.setItem('lastNotificationSync', Date.now().toString());
        }
      }
    } catch (error) {
      console.error('Failed to check missed notifications:', error);
    }
  }
  
  private startPeriodicSync(): void {
    // Sync every 5 minutes when app is active
    this.syncInterval = setInterval(async () => {
      if (this.isOnline) {
        await this.syncPendingActions();
      }
    }, 5 * 60 * 1000);
  }
  
  private async loadNotificationRules(): Promise<void> {
    try {
      const rulesJson = await AsyncStorage.getItem('notificationRules');
      if (rulesJson) {
        this.rules = JSON.parse(rulesJson);
      }
    } catch (error) {
      console.error('Failed to load notification rules:', error);
    }
  }
  
  private addToHistory(entry: any): void {
    this.notificationHistory.unshift(entry);
    // Keep only last 100 entries
    if (this.notificationHistory.length > 100) {
      this.notificationHistory = this.notificationHistory.slice(0, 100);
    }
  }
  
  // Public methods for rule management
  
  async addNotificationRule(rule: NotificationRule): Promise<void> {
    this.rules.push(rule);
    await AsyncStorage.setItem('notificationRules', JSON.stringify(this.rules));
    
    // Sync rule to other devices
    if (this.webSocketConnection?.readyState === WebSocket.OPEN) {
      this.webSocketConnection.send(JSON.stringify({
        type: 'rules_updated',
        payload: { rules: this.rules }
      }));
    }
  }
  
  async updateNotificationRule(ruleId: string, updates: Partial<NotificationRule>): Promise<void> {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index >= 0) {
      this.rules[index] = { ...this.rules[index], ...updates };
      await AsyncStorage.setItem('notificationRules', JSON.stringify(this.rules));
      
      // Sync rule to other devices
      if (this.webSocketConnection?.readyState === WebSocket.OPEN) {
        this.webSocketConnection.send(JSON.stringify({
          type: 'rules_updated',
          payload: { rules: this.rules }
        }));
      }
    }
  }
  
  async removeNotificationRule(ruleId: string): Promise<void> {
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
    await AsyncStorage.setItem('notificationRules', JSON.stringify(this.rules));
    
    // Sync rule to other devices
    if (this.webSocketConnection?.readyState === WebSocket.OPEN) {
      this.webSocketConnection.send(JSON.stringify({
        type: 'rules_updated',
        payload: { rules: this.rules }
      }));
    }
  }
  
  getNotificationRules(): NotificationRule[] {
    return [...this.rules];
  }
  
  getNotificationHistory(): any[] {
    return [...this.notificationHistory];
  }
  
  async setFocusMode(active: boolean): Promise<void> {
    await AsyncStorage.setItem('focusModeActive', active.toString());
    
    // Sync to other devices
    if (this.webSocketConnection?.readyState === WebSocket.OPEN) {
      this.webSocketConnection.send(JSON.stringify({
        type: 'focus_mode_changed',
        payload: { active }
      }));
    }
  }
  
  async getFocusMode(): Promise<boolean> {
    const active = await AsyncStorage.getItem('focusModeActive');
    return active === 'true';
  }
  
  // Cleanup
  
  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.webSocketConnection) {
      this.webSocketConnection.close();
      this.webSocketConnection = null;
    }
  }
}

// Helper functions
export const initializeNotifications = async () => {
  const service = NotificationService.getInstance();
  await service.initialize();
  await service.createNotificationCategories();
};

export const scheduleNotification = (options: {
  title: string;
  body: string;
  data?: any;
  trigger?: Notifications.NotificationTriggerInput;
  categoryId?: string;
  channelId?: string;
}) => {
  return NotificationService.getInstance().scheduleLocalNotification(options);
};

export const updateBadgeCount = (count: number) => {
  return NotificationService.getInstance().setBadgeCount(count);
};

export const addNotificationRule = (rule: NotificationRule) => {
  return NotificationService.getInstance().addNotificationRule(rule);
};

export const updateNotificationRule = (ruleId: string, updates: Partial<NotificationRule>) => {
  return NotificationService.getInstance().updateNotificationRule(ruleId, updates);
};

export const removeNotificationRule = (ruleId: string) => {
  return NotificationService.getInstance().removeNotificationRule(ruleId);
};

export const getNotificationRules = () => {
  return NotificationService.getInstance().getNotificationRules();
};

export const setFocusMode = (active: boolean) => {
  return NotificationService.getInstance().setFocusMode(active);
};

export const getFocusMode = () => {
  return NotificationService.getInstance().getFocusMode();
};