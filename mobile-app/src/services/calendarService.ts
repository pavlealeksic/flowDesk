/**
 * Calendar Service for React Native
 * 
 * Provides a React Native-optimized interface to the Rust calendar engine
 * with mobile-specific features like device calendar integration, offline support,
 * and background sync capabilities.
 */

import { NativeModules, Platform, AppState, AppStateStatus } from 'react-native';
import { CalendarEngine, CalendarEngineConfig, CalendarNotification, CalendarEventListener } from '@flow-desk/shared/calendar-engine';
import { CalendarAccount, CalendarEvent, Calendar, CalendarProvider, CreateCalendarAccountInput, CreateCalendarEventInput, UpdateCalendarEventInput, CalendarPrivacySync, FreeBusyQuery, FreeBusyResponse, CalendarSyncStatus } from '@flow-desk/shared/types/calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerBackgroundFetch, unregisterBackgroundFetch } from 'expo-background-fetch';
import { registerTaskManager, unregisterTaskManager } from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';

// Native module interface
interface CalendarNativeModule {
  // iOS EventKit methods
  requestAccessToEventStore(): Promise<boolean>;
  getDeviceCalendars(): Promise<any[]>;
  getDeviceEvents(startDate: string, endDate: string): Promise<any[]>;
  createDeviceEvent(event: any): Promise<string>;
  updateDeviceEvent(eventId: string, event: any): Promise<void>;
  deleteDeviceEvent(eventId: string): Promise<void>;
  
  // Android CalendarContract methods  
  requestCalendarPermissions(): Promise<boolean>;
  getAndroidCalendars(): Promise<any[]>;
  getAndroidEvents(startDate: string, endDate: string): Promise<any[]>;
  createAndroidEvent(event: any): Promise<string>;
  updateAndroidEvent(eventId: string, event: any): Promise<void>;
  deleteAndroidEvent(eventId: string): Promise<void>;
  
  // Contact picker integration
  pickContact(): Promise<any>;
  
  // Location services
  requestLocationPermissions(): Promise<boolean>;
  getCurrentLocation(): Promise<{ latitude: number; longitude: number }>;
  
  // Deep link handling
  openMeetingUrl(url: string): Promise<void>;
  
  // System integration
  addToSystemCalendar(event: any): Promise<void>;
  openSystemCalendarApp(): Promise<void>;
}

const CalendarNative = NativeModules.FlowDeskCalendar as CalendarNativeModule;

export interface MobileCalendarConfig extends CalendarEngineConfig {
  /** Enable device calendar integration */
  enableDeviceIntegration?: boolean;
  /** Background sync interval in minutes */
  backgroundSyncInterval?: number;
  /** Enable push notifications */
  enableNotifications?: boolean;
  /** Offline cache size limit in MB */
  offlineCacheLimit?: number;
  /** Enable location services */
  enableLocationServices?: boolean;
}

export interface OfflineSyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  accountId: string;
  calendarId?: string;
  eventId?: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  lastError?: string;
}

export interface CalendarNotificationSettings {
  enableEventReminders: boolean;
  enableSyncNotifications: boolean;
  reminderSound: boolean;
  vibration: boolean;
  defaultReminderMinutes: number[];
}

/**
 * React Native Calendar Service
 * 
 * Bridges the Rust calendar engine with React Native-specific features:
 * - Device calendar integration (iOS EventKit, Android CalendarContract)
 * - Offline support with local SQLite cache
 * - Background sync with task manager
 * - Push notifications for events
 * - Location-based event features
 * - Contact picker integration
 * - Deep linking to meeting apps
 */
export class MobileCalendarService {
  private engine: CalendarEngine;
  private eventListener: CalendarEventListener;
  private database: SQLite.WebSQLDatabase;
  private isInitialized = false;
  private isOnline = true;
  private syncQueue: OfflineSyncOperation[] = [];
  private backgroundTaskId: string | null = null;
  private appStateSubscription: any;
  private netInfoUnsubscribe: any;
  private notificationSettings: CalendarNotificationSettings;

  constructor() {
    this.engine = new CalendarEngine();
    this.eventListener = new CalendarEventListener();
    this.database = SQLite.openDatabase('calendar_cache.db');
    this.notificationSettings = {
      enableEventReminders: true,
      enableSyncNotifications: false,
      reminderSound: true,
      vibration: true,
      defaultReminderMinutes: [15, 30, 60],
    };
    
    this.setupEventListeners();
    this.initializeDatabase();
  }

  /**
   * Initialize the calendar service with mobile-optimized configuration
   */
  async initialize(config: MobileCalendarConfig): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Calendar service is already initialized');
    }

    try {
      // Initialize Rust calendar engine
      await this.engine.initialize({
        ...config,
        databaseUrl: `sqlite://${SQLite.databaseDirectory}/calendar.db`,
      });

      // Initialize native calendar integration if enabled
      if (config.enableDeviceIntegration !== false) {
        await this.initializeDeviceIntegration();
      }

      // Initialize notifications if enabled
      if (config.enableNotifications !== false) {
        await this.initializeNotifications();
      }

      // Initialize location services if enabled
      if (config.enableLocationServices === true) {
        await this.initializeLocationServices();
      }

      // Setup background sync
      if (config.backgroundSyncInterval) {
        await this.setupBackgroundSync(config.backgroundSyncInterval);
      }

      // Setup network monitoring
      this.setupNetworkMonitoring();

      // Setup app state handling
      this.setupAppStateHandling();

      // Load cached data
      await this.loadCachedData();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize calendar service: ${error}`);
    }
  }

  /**
   * Start the calendar service and background sync
   */
  async start(): Promise<void> {
    this.ensureInitialized();
    
    await this.engine.start();
    
    // Start background sync if configured
    if (this.backgroundTaskId) {
      await registerBackgroundFetch(this.backgroundTaskId, {
        minimumInterval: 15 * 60 * 1000, // 15 minutes
      });
    }

    // Process any pending sync operations
    await this.processSyncQueue();
  }

  /**
   * Stop the calendar service and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // Unregister background tasks
    if (this.backgroundTaskId) {
      await unregisterBackgroundFetch(this.backgroundTaskId);
      await unregisterTaskManager(this.backgroundTaskId);
    }

    // Cleanup subscriptions
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }

    await this.engine.stop();
  }

  // === Account Management ===

  /**
   * Create calendar account with mobile OAuth2 flow
   */
  async createAccount(account: CreateCalendarAccountInput): Promise<CalendarAccount> {
    this.ensureInitialized();
    
    try {
      const result = await this.engine.createAccount(account);
      
      // Cache account data
      await this.cacheAccountData(result);
      
      // Trigger initial sync
      this.syncAccountInBackground(result.id);
      
      return result;
    } catch (error) {
      if (!this.isOnline) {
        // Queue for later sync when online
        await this.queueSyncOperation({
          id: `create-account-${Date.now()}`,
          type: 'create',
          accountId: 'pending',
          data: account,
          timestamp: new Date(),
          retryCount: 0,
        });
        
        // Return mock account for offline use
        return this.createOfflineAccount(account);
      }
      throw error;
    }
  }

  /**
   * Get user accounts with offline fallback
   */
  async getUserAccounts(userId: string): Promise<CalendarAccount[]> {
    this.ensureInitialized();
    
    try {
      if (this.isOnline) {
        const accounts = await this.engine.getUserAccounts(userId);
        await this.cacheUserAccounts(userId, accounts);
        return accounts;
      } else {
        return await this.getCachedUserAccounts(userId);
      }
    } catch (error) {
      // Return cached accounts on error
      return await this.getCachedUserAccounts(userId);
    }
  }

  /**
   * Sync account with retry logic and offline queue
   */
  async syncAccount(accountId: string, force = false): Promise<CalendarSyncStatus> {
    this.ensureInitialized();
    
    try {
      if (!this.isOnline && !force) {
        throw new Error('Account sync requires internet connection');
      }

      const status = await this.engine.syncAccount(accountId, force);
      
      // Send notification if enabled
      if (this.notificationSettings.enableSyncNotifications && status.success) {
        await this.sendSyncNotification(accountId, status);
      }
      
      return status;
    } catch (error) {
      // Queue sync for later if offline
      if (!this.isOnline) {
        await this.queueSyncOperation({
          id: `sync-account-${accountId}-${Date.now()}`,
          type: 'update',
          accountId,
          data: { force },
          timestamp: new Date(),
          retryCount: 0,
        });
      }
      throw error;
    }
  }

  // === Event Management ===

  /**
   * Create event with offline support and device integration
   */
  async createEvent(event: CreateCalendarEventInput): Promise<CalendarEvent> {
    this.ensureInitialized();
    
    try {
      const result = await this.engine.createEvent(event);
      
      // Add to device calendar if enabled
      if (await this.isDeviceIntegrationEnabled()) {
        await this.addEventToDeviceCalendar(result);
      }
      
      // Schedule notifications
      await this.scheduleEventNotifications(result);
      
      // Cache event
      await this.cacheEvent(result);
      
      return result;
    } catch (error) {
      if (!this.isOnline) {
        // Create offline event and queue for sync
        const offlineEvent = await this.createOfflineEvent(event);
        await this.queueSyncOperation({
          id: `create-event-${offlineEvent.id}`,
          type: 'create',
          accountId: event.accountId,
          calendarId: event.calendarId,
          data: event,
          timestamp: new Date(),
          retryCount: 0,
        });
        return offlineEvent;
      }
      throw error;
    }
  }

  /**
   * Get events with local cache and device integration
   */
  async getEventsInRange(
    calendarIds: string[],
    startDate: Date,
    endDate: Date,
    includeDeviceEvents = false
  ): Promise<CalendarEvent[]> {
    this.ensureInitialized();
    
    const events: CalendarEvent[] = [];
    
    try {
      // Get events from calendar engine
      if (this.isOnline) {
        const engineEvents = await this.engine.getEventsInRange(calendarIds, startDate, endDate);
        events.push(...engineEvents);
        
        // Cache events
        await this.cacheEvents(engineEvents);
      } else {
        // Get cached events
        const cachedEvents = await this.getCachedEventsInRange(calendarIds, startDate, endDate);
        events.push(...cachedEvents);
      }
      
      // Add device calendar events if requested
      if (includeDeviceEvents && await this.isDeviceIntegrationEnabled()) {
        const deviceEvents = await this.getDeviceEventsInRange(startDate, endDate);
        events.push(...deviceEvents);
      }
      
      return this.deduplicateEvents(events);
    } catch (error) {
      // Return cached events on error
      return await this.getCachedEventsInRange(calendarIds, startDate, endDate);
    }
  }

  // === Device Integration ===

  /**
   * Request permissions for device calendar access
   */
  async requestDeviceCalendarPermissions(): Promise<boolean> {
    if (!CalendarNative) {
      return false;
    }

    try {
      if (Platform.OS === 'ios') {
        return await CalendarNative.requestAccessToEventStore();
      } else if (Platform.OS === 'android') {
        return await CalendarNative.requestCalendarPermissions();
      }
      return false;
    } catch (error) {
      console.error('Error requesting calendar permissions:', error);
      return false;
    }
  }

  /**
   * Get device calendars (iOS EventKit / Android CalendarContract)
   */
  async getDeviceCalendars(): Promise<Calendar[]> {
    if (!CalendarNative || !await this.isDeviceIntegrationEnabled()) {
      return [];
    }

    try {
      let deviceCalendars: any[] = [];
      
      if (Platform.OS === 'ios') {
        deviceCalendars = await CalendarNative.getDeviceCalendars();
      } else if (Platform.OS === 'android') {
        deviceCalendars = await CalendarNative.getAndroidCalendars();
      }
      
      return deviceCalendars.map(this.mapDeviceCalendarToCalendar);
    } catch (error) {
      console.error('Error getting device calendars:', error);
      return [];
    }
  }

  /**
   * Get device events in date range
   */
  private async getDeviceEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    if (!CalendarNative) {
      return [];
    }

    try {
      let deviceEvents: any[] = [];
      
      if (Platform.OS === 'ios') {
        deviceEvents = await CalendarNative.getDeviceEvents(
          startDate.toISOString(),
          endDate.toISOString()
        );
      } else if (Platform.OS === 'android') {
        deviceEvents = await CalendarNative.getAndroidEvents(
          startDate.toISOString(),
          endDate.toISOString()
        );
      }
      
      return deviceEvents.map(this.mapDeviceEventToCalendarEvent);
    } catch (error) {
      console.error('Error getting device events:', error);
      return [];
    }
  }

  // === Privacy Sync ===

  /**
   * Create privacy sync rule for cross-calendar busy blocks
   */
  async createPrivacySyncRule(rule: CalendarPrivacySync): Promise<string> {
    this.ensureInitialized();
    return await this.engine.createPrivacySyncRule(rule);
  }

  /**
   * Execute privacy sync with mobile optimizations
   */
  async executePrivacySync(): Promise<void> {
    this.ensureInitialized();
    
    try {
      const results = await this.engine.executePrivacySync();
      
      // Send notification about privacy sync completion
      if (this.notificationSettings.enableSyncNotifications && results.length > 0) {
        await this.sendPrivacySyncNotification(results);
      }
    } catch (error) {
      console.error('Privacy sync failed:', error);
      throw error;
    }
  }

  // === Notifications ===

  /**
   * Schedule event notifications
   */
  private async scheduleEventNotifications(event: CalendarEvent): Promise<void> {
    if (!this.notificationSettings.enableEventReminders || !event.reminders.length) {
      return;
    }

    try {
      for (const reminder of event.reminders) {
        const notificationTime = new Date(event.startTime.getTime() - (reminder.minutes * 60 * 1000));
        
        if (notificationTime > new Date()) {
          await Notifications.scheduleNotificationAsync({
            identifier: `event-${event.id}-${reminder.minutes}`,
            content: {
              title: event.title,
              body: reminder.method === 'email' ? 
                `Event starts in ${reminder.minutes} minutes` : 
                `📅 ${event.title}`,
              data: {
                eventId: event.id,
                calendarId: event.calendarId,
                type: 'event-reminder',
              },
              sound: this.notificationSettings.reminderSound,
            },
            trigger: {
              date: notificationTime,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error scheduling event notifications:', error);
    }
  }

  // === Utility Methods ===

  /**
   * Open meeting URL in appropriate app
   */
  async openMeetingUrl(url: string): Promise<void> {
    if (CalendarNative) {
      await CalendarNative.openMeetingUrl(url);
    } else {
      // Fallback to web browser
      const { WebBrowser } = await import('expo-web-browser');
      await WebBrowser.openBrowserAsync(url);
    }
  }

  /**
   * Pick contact for event attendees
   */
  async pickContact(): Promise<any> {
    if (CalendarNative) {
      return await CalendarNative.pickContact();
    }
    return null;
  }

  /**
   * Get current location for location-based events
   */
  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    if (CalendarNative) {
      try {
        const hasPermission = await CalendarNative.requestLocationPermissions();
        if (hasPermission) {
          return await CalendarNative.getCurrentLocation();
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    }
    return null;
  }

  // === Private Methods ===

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Calendar service is not initialized. Call initialize() first.');
    }
  }

  private setupEventListeners(): void {
    this.eventListener.addListener(this.handleCalendarNotification.bind(this));
  }

  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.database.transaction(
        (tx) => {
          // Create tables for offline cache
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS accounts (
              id TEXT PRIMARY KEY,
              userId TEXT,
              data TEXT,
              cachedAt INTEGER
            )`,
            [],
            () => {},
            (_, error) => {
              console.error('Error creating accounts table:', error);
              return false;
            }
          );
          
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS events (
              id TEXT PRIMARY KEY,
              calendarId TEXT,
              accountId TEXT,
              data TEXT,
              startTime INTEGER,
              endTime INTEGER,
              cachedAt INTEGER
            )`,
            [],
            () => {},
            (_, error) => {
              console.error('Error creating events table:', error);
              return false;
            }
          );
          
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS sync_queue (
              id TEXT PRIMARY KEY,
              operation TEXT,
              timestamp INTEGER,
              retryCount INTEGER
            )`,
            [],
            () => {},
            (_, error) => {
              console.error('Error creating sync_queue table:', error);
              return false;
            }
          );
        },
        (error) => reject(error),
        () => resolve()
      );
    });
  }

  private async initializeDeviceIntegration(): Promise<void> {
    if (CalendarNative) {
      await this.requestDeviceCalendarPermissions();
    }
  }

  private async initializeNotifications(): Promise<void> {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Notification permissions not granted');
    }
    
    // Configure notification handling
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: this.notificationSettings.reminderSound,
        shouldSetBadge: false,
      }),
    });
  }

  private async initializeLocationServices(): Promise<void> {
    if (CalendarNative) {
      await CalendarNative.requestLocationPermissions();
    }
  }

  private async isDeviceIntegrationEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem('device_calendar_enabled');
      return enabled === 'true';
    } catch {
      return true; // Default to enabled
    }
  }

  private setupNetworkMonitoring(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected === true;
      
      if (!wasOnline && this.isOnline) {
        // Back online - process sync queue
        this.processSyncQueue();
      }
    });
  }

  private setupAppStateHandling(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  private async setupBackgroundSync(intervalMinutes: number): Promise<void> {
    this.backgroundTaskId = 'CALENDAR_BACKGROUND_SYNC';
    
    registerTaskManager(this.backgroundTaskId, async () => {
      try {
        if (this.isOnline) {
          // Sync all accounts
          const accounts = await this.engine.getUserAccounts('current_user');
          for (const account of accounts) {
            await this.syncAccount(account.id);
          }
        }
        return 'success';
      } catch (error) {
        console.error('Background sync failed:', error);
        return 'error';
      }
    });
  }

  private async loadCachedData(): Promise<void> {
    // Load sync queue
    await this.loadSyncQueue();
  }

  private async loadSyncQueue(): Promise<void> {
    return new Promise((resolve) => {
      this.database.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM sync_queue ORDER BY timestamp ASC',
          [],
          (_, { rows }) => {
            this.syncQueue = [];
            for (let i = 0; i < rows.length; i++) {
              const row = rows.item(i);
              this.syncQueue.push(JSON.parse(row.operation));
            }
            resolve();
          },
          (_, error) => {
            console.error('Error loading sync queue:', error);
            resolve();
            return false;
          }
        );
      });
    });
  }

  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const operations = [...this.syncQueue];
    this.syncQueue = [];

    for (const operation of operations) {
      try {
        await this.processSyncOperation(operation);
        await this.removeSyncOperation(operation.id);
      } catch (error) {
        operation.retryCount++;
        operation.lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (operation.retryCount < 3) {
          this.syncQueue.push(operation);
        } else {
          console.error(`Sync operation failed after 3 retries: ${operation.id}`, error);
          await this.removeSyncOperation(operation.id);
        }
      }
    }
  }

  private async processSyncOperation(operation: OfflineSyncOperation): Promise<void> {
    switch (operation.type) {
      case 'create':
        if (operation.eventId) {
          await this.engine.createEvent(operation.data);
        } else {
          await this.engine.createAccount(operation.data);
        }
        break;
      case 'update':
        if (operation.eventId) {
          await this.engine.updateEvent(operation.calendarId!, operation.eventId, operation.data);
        } else {
          await this.engine.updateAccount(operation.accountId, operation.data);
        }
        break;
      case 'delete':
        if (operation.eventId) {
          await this.engine.deleteEvent(operation.calendarId!, operation.eventId);
        } else {
          await this.engine.deleteAccount(operation.accountId);
        }
        break;
    }
  }

  private async queueSyncOperation(operation: OfflineSyncOperation): Promise<void> {
    this.syncQueue.push(operation);
    
    // Persist to database
    return new Promise((resolve) => {
      this.database.transaction(tx => {
        tx.executeSql(
          'INSERT OR REPLACE INTO sync_queue (id, operation, timestamp, retryCount) VALUES (?, ?, ?, ?)',
          [operation.id, JSON.stringify(operation), operation.timestamp.getTime(), operation.retryCount],
          () => resolve(),
          (_, error) => {
            console.error('Error queuing sync operation:', error);
            resolve();
            return false;
          }
        );
      });
    });
  }

  private async removeSyncOperation(operationId: string): Promise<void> {
    return new Promise((resolve) => {
      this.database.transaction(tx => {
        tx.executeSql(
          'DELETE FROM sync_queue WHERE id = ?',
          [operationId],
          () => resolve(),
          (_, error) => {
            console.error('Error removing sync operation:', error);
            resolve();
            return false;
          }
        );
      });
    });
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active' && this.isOnline) {
      // App became active - sync if needed
      this.processSyncQueue();
    }
  }

  private handleCalendarNotification(notification: CalendarNotification): void {
    // Handle real-time calendar notifications from the engine
    console.log('Calendar notification received:', notification);
  }

  private async sendSyncNotification(accountId: string, status: CalendarSyncStatus): Promise<void> {
    if (!status.success) return;
    
    await Notifications.scheduleNotificationAsync({
      identifier: `sync-${accountId}-${Date.now()}`,
      content: {
        title: 'Calendar Synced',
        body: `${status.eventsProcessed} events processed`,
      },
      trigger: null,
    });
  }

  private async sendPrivacySyncNotification(results: any[]): Promise<void> {
    const totalEvents = results.reduce((sum, result) => sum + result.eventsProcessed, 0);
    
    await Notifications.scheduleNotificationAsync({
      identifier: `privacy-sync-${Date.now()}`,
      content: {
        title: 'Privacy Sync Complete',
        body: `${totalEvents} events processed across calendars`,
      },
      trigger: null,
    });
  }

  private syncAccountInBackground(accountId: string): void {
    // Non-blocking background sync
    setTimeout(() => {
      this.syncAccount(accountId).catch(error => {
        console.error('Background sync failed:', error);
      });
    }, 1000);
  }

  // Mapping functions for device calendar integration
  private mapDeviceCalendarToCalendar(deviceCalendar: any): Calendar {
    return {
      id: `device-${deviceCalendar.id}`,
      accountId: 'device',
      name: deviceCalendar.title || deviceCalendar.name,
      description: deviceCalendar.description,
      color: deviceCalendar.color || '#1976d2',
      isVisible: true,
      isWritable: deviceCalendar.allowsContentModifications !== false,
      isDefault: deviceCalendar.isPrimary === true,
      timeZone: deviceCalendar.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      provider: 'device' as CalendarProvider,
      providerCalendarId: deviceCalendar.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private mapDeviceEventToCalendarEvent(deviceEvent: any): CalendarEvent {
    return {
      id: `device-${deviceEvent.id}`,
      calendarId: `device-${deviceEvent.calendarId}`,
      title: deviceEvent.title || 'Untitled Event',
      description: deviceEvent.description,
      location: deviceEvent.location,
      startTime: new Date(deviceEvent.startDate),
      endTime: new Date(deviceEvent.endDate),
      isAllDay: deviceEvent.allDay === true,
      isRecurring: deviceEvent.hasRecurrenceRules === true,
      recurrenceRule: deviceEvent.recurrenceRule,
      attendees: (deviceEvent.attendees || []).map((attendee: any) => ({
        email: attendee.email,
        name: attendee.name,
        status: attendee.participantStatus || 'needsAction',
        isOptional: attendee.participantRole === 'optional',
        isOrganizer: attendee.isCurrentUser === true,
      })),
      organizer: deviceEvent.organizer ? {
        email: deviceEvent.organizer.email,
        name: deviceEvent.organizer.name,
        status: 'accepted',
        isOptional: false,
        isOrganizer: true,
      } : undefined,
      status: deviceEvent.status === 'cancelled' ? 'cancelled' : 'confirmed',
      visibility: deviceEvent.availability === 'free' ? 'public' : 'private',
      reminders: (deviceEvent.alarms || []).map((alarm: any) => ({
        method: 'popup' as const,
        minutes: Math.abs(alarm.relativeOffset) / 60,
      })),
      attachments: [],
      meetingUrl: deviceEvent.url,
      providerEventId: deviceEvent.id,
      createdAt: new Date(deviceEvent.creationDate || Date.now()),
      updatedAt: new Date(deviceEvent.lastModifiedDate || Date.now()),
    };
  }

  private deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
    const seen = new Set();
    return events.filter(event => {
      const key = `${event.title}-${event.startTime.getTime()}-${event.endTime.getTime()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Cache management methods
  private async cacheAccountData(account: CalendarAccount): Promise<void> {
    // Implementation for caching account data
  }

  private async cacheUserAccounts(userId: string, accounts: CalendarAccount[]): Promise<void> {
    // Implementation for caching user accounts
  }

  private async getCachedUserAccounts(userId: string): Promise<CalendarAccount[]> {
    // Implementation for retrieving cached user accounts
    return [];
  }

  private async cacheEvent(event: CalendarEvent): Promise<void> {
    // Implementation for caching event data
  }

  private async cacheEvents(events: CalendarEvent[]): Promise<void> {
    // Implementation for caching multiple events
  }

  private async getCachedEventsInRange(calendarIds: string[], startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    // Implementation for retrieving cached events in date range
    return [];
  }

  private createOfflineAccount(input: CreateCalendarAccountInput): CalendarAccount {
    // Implementation for creating offline account placeholder
    return {
      id: `offline-${Date.now()}`,
      userId: input.userId,
      name: input.name,
      email: input.email,
      provider: input.provider,
      config: input.config,
      credentials: input.credentials,
      status: 'offline',
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async createOfflineEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    // Implementation for creating offline event placeholder
    return {
      id: `offline-event-${Date.now()}`,
      calendarId: input.calendarId,
      title: input.title,
      description: input.description,
      location: input.location,
      startTime: input.startTime,
      endTime: input.endTime,
      isAllDay: input.isAllDay || false,
      isRecurring: input.isRecurring || false,
      recurrenceRule: input.recurrenceRule,
      attendees: input.attendees || [],
      organizer: input.organizer,
      status: input.status || 'confirmed',
      visibility: input.visibility || 'public',
      reminders: input.reminders || [],
      attachments: input.attachments || [],
      meetingUrl: input.meetingUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async addEventToDeviceCalendar(event: CalendarEvent): Promise<void> {
    if (!CalendarNative) return;

    try {
      const deviceEvent = this.mapCalendarEventToDeviceEvent(event);
      
      if (Platform.OS === 'ios') {
        await CalendarNative.createDeviceEvent(deviceEvent);
      } else if (Platform.OS === 'android') {
        await CalendarNative.createAndroidEvent(deviceEvent);
      }
    } catch (error) {
      console.error('Error adding event to device calendar:', error);
    }
  }

  private mapCalendarEventToDeviceEvent(event: CalendarEvent): any {
    return {
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: event.startTime.getTime(),
      endDate: event.endTime.getTime(),
      allDay: event.isAllDay,
      url: event.meetingUrl,
      alarms: event.reminders.map(reminder => ({
        relativeOffset: -reminder.minutes * 60,
      })),
    };
  }
}

// Export singleton instance
export const mobileCalendarService = new MobileCalendarService();
export default mobileCalendarService;