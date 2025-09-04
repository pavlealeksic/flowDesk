/**
 * Calendar Engine TypeScript Interface
 * 
 * TypeScript wrapper for the Rust calendar engine providing a clean,
 * type-safe interface for all calendar operations.
 */

import { 
  CalendarAccount, CalendarEvent, Calendar, CalendarProvider,
  CreateCalendarEventInput, UpdateCalendarEventInput,
  CreateCalendarAccountInput, UpdateCalendarAccountInput,
  CalendarPrivacySync, FreeBusyQuery, FreeBusyResponse,
  CalendarMetrics, CalendarSyncStatus
} from '../types/calendar';

// Import the compiled Rust NAPI module
let rustCalendarEngine: any;
try {
  rustCalendarEngine = require('../../rust-lib/index.node');
} catch (error) {
  console.warn('Calendar engine native module not found, using mock implementation');
  rustCalendarEngine = null;
}

/**
 * Configuration for the calendar engine
 */
export interface CalendarEngineConfig {
  /** Database connection URL */
  databaseUrl: string;
  /** Maximum concurrent sync operations */
  maxConcurrentSyncs?: number;
  /** Default sync interval in minutes */
  defaultSyncIntervalMinutes?: number;
  /** Webhook server configuration */
  webhookConfig?: {
    host: string;
    port: number;
    basePath: string;
    secret: string;
  };
  /** Rate limiting configuration */
  rateLimits?: {
    googleCalendarRpm: number;
    microsoftGraphRpm: number;
    caldavRpm: number;
    burstCapacity: number;
  };
  /** Privacy sync configuration */
  privacySync?: {
    defaultPrivacyTitle: string;
    maxPastDays: number;
    maxFutureDays: number;
    enableAdvancedMode: boolean;
    syncIntervalMinutes: number;
  };
  /** Server timezone */
  serverTimezone?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Result of a privacy sync operation
 */
export interface PrivacySyncResult {
  ruleId: string;
  success: boolean;
  error?: string;
  eventsProcessed: number;
  eventsSynced: number;
  durationMs: number;
}

/**
 * Calendar notification for real-time events
 */
export interface CalendarNotification {
  notificationType: string;
  accountId: string;
  calendarId?: string;
  eventId?: string;
  timestamp: string;
  data?: string;
}

/**
 * Main calendar engine class providing unified calendar operations
 */
export class CalendarEngine {
  private engine: any;
  private initialized = false;

  constructor() {
    if (calendarEngine) {
      this.engine = new rustCalendarEngine.CalendarEngineJs();
    } else {
      // Mock implementation for development/testing
      this.engine = new MockCalendarEngine();
    }
  }

  /**
   * Initialize the calendar engine with configuration
   */
  async initialize(config: CalendarEngineConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('Calendar engine is already initialized');
    }

    const configJson = JSON.stringify({
      database_url: config.databaseUrl,
      max_concurrent_syncs: config.maxConcurrentSyncs ?? 10,
      default_sync_interval_minutes: config.defaultSyncIntervalMinutes ?? 15,
      webhook_config: config.webhookConfig ? {
        host: config.webhookConfig.host,
        port: config.webhookConfig.port,
        base_path: config.webhookConfig.basePath,
        secret: config.webhookConfig.secret,
      } : null,
      rate_limits: {
        google_calendar_rpm: config.rateLimits?.googleCalendarRpm ?? 300,
        microsoft_graph_rpm: config.rateLimits?.microsoftGraphRpm ?? 600,
        caldav_rpm: config.rateLimits?.caldavRpm ?? 60,
        burst_capacity: config.rateLimits?.burstCapacity ?? 10,
      },
      privacy_sync: {
        default_privacy_title: config.privacySync?.defaultPrivacyTitle ?? 'Private',
        max_past_days: config.privacySync?.maxPastDays ?? 7,
        max_future_days: config.privacySync?.maxFutureDays ?? 60,
        enable_advanced_mode: config.privacySync?.enableAdvancedMode ?? false,
        sync_interval_minutes: config.privacySync?.syncIntervalMinutes ?? 5,
      },
      server_timezone: config.serverTimezone ?? 'UTC',
      debug: config.debug ?? false,
    });

    await this.engine.initialize(configJson);
    this.initialized = true;
  }

  /**
   * Start the calendar engine background services
   */
  async start(): Promise<void> {
    this.ensureInitialized();
    await this.engine.start();
  }

  /**
   * Stop the calendar engine
   */
  async stop(): Promise<void> {
    if (this.initialized) {
      await this.engine.stop();
    }
  }

  // === Account Management ===

  /**
   * Create a new calendar account
   */
  async createAccount(account: CreateCalendarAccountInput): Promise<CalendarAccount> {
    this.ensureInitialized();
    const accountJson = JSON.stringify(account);
    const resultJson = await this.engine.createAccount(accountJson);
    return JSON.parse(resultJson);
  }

  /**
   * Get calendar account by ID
   */
  async getAccount(accountId: string): Promise<CalendarAccount> {
    this.ensureInitialized();
    const resultJson = await this.engine.getAccount(accountId);
    return JSON.parse(resultJson);
  }

  /**
   * Get all calendar accounts for a user
   */
  async getUserAccounts(userId: string): Promise<CalendarAccount[]> {
    this.ensureInitialized();
    const resultJson = await this.engine.getUserAccounts(userId);
    return JSON.parse(resultJson);
  }

  /**
   * Update calendar account
   */
  async updateAccount(accountId: string, updates: UpdateCalendarAccountInput): Promise<CalendarAccount> {
    this.ensureInitialized();
    const updatesJson = JSON.stringify(updates);
    const resultJson = await this.engine.updateAccount(accountId, updatesJson);
    return JSON.parse(resultJson);
  }

  /**
   * Delete calendar account
   */
  async deleteAccount(accountId: string): Promise<void> {
    this.ensureInitialized();
    await this.engine.deleteAccount(accountId);
  }

  // === Calendar Operations ===

  /**
   * List calendars for an account
   */
  async listCalendars(accountId: string): Promise<Calendar[]> {
    this.ensureInitialized();
    const resultJson = await this.engine.listCalendars(accountId);
    return JSON.parse(resultJson);
  }

  /**
   * Get calendar by ID
   */
  async getCalendar(calendarId: string): Promise<Calendar> {
    this.ensureInitialized();
    const resultJson = await this.engine.getCalendar(calendarId);
    return JSON.parse(resultJson);
  }

  /**
   * Create calendar
   */
  async createCalendar(calendar: Calendar): Promise<Calendar> {
    this.ensureInitialized();
    const calendarJson = JSON.stringify(calendar);
    const resultJson = await this.engine.createCalendar(calendarJson);
    return JSON.parse(resultJson);
  }

  // === Event Operations ===

  /**
   * Create calendar event
   */
  async createEvent(event: CreateCalendarEventInput): Promise<CalendarEvent> {
    this.ensureInitialized();
    const eventJson = JSON.stringify(event);
    const resultJson = await this.engine.createEvent(eventJson);
    return JSON.parse(resultJson);
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    updates: UpdateCalendarEventInput
  ): Promise<CalendarEvent> {
    this.ensureInitialized();
    const updatesJson = JSON.stringify(updates);
    const resultJson = await this.engine.updateEvent(calendarId, eventId, updatesJson);
    return JSON.parse(resultJson);
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    this.ensureInitialized();
    await this.engine.deleteEvent(calendarId, eventId);
  }

  /**
   * Get events in date range
   */
  async getEventsInRange(
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date
  ): Promise<CalendarEvent[]> {
    this.ensureInitialized();
    const calendarIdsJson = JSON.stringify(calendarIds);
    const timeMinIso = timeMin.toISOString();
    const timeMaxIso = timeMax.toISOString();
    const resultJson = await this.engine.getEventsInRange(calendarIdsJson, timeMinIso, timeMaxIso);
    return JSON.parse(resultJson);
  }

  // === Free/Busy Operations ===

  /**
   * Query free/busy information
   */
  async queryFreeBusy(query: FreeBusyQuery): Promise<FreeBusyResponse> {
    this.ensureInitialized();
    const queryJson = JSON.stringify({
      ...query,
      time_min: query.timeMin.toISOString(),
      time_max: query.timeMax.toISOString(),
    });
    const resultJson = await this.engine.queryFreeBusy(queryJson);
    return JSON.parse(resultJson);
  }

  // === Sync Operations ===

  /**
   * Trigger full sync for an account
   */
  async syncAccount(accountId: string, force = false): Promise<CalendarSyncStatus> {
    this.ensureInitialized();
    const resultJson = await this.engine.syncAccount(accountId, force);
    return JSON.parse(resultJson);
  }

  /**
   * Get sync status for all accounts
   */
  async getAllSyncStatus(): Promise<Record<string, CalendarSyncStatus>> {
    this.ensureInitialized();
    const resultJson = await this.engine.getAllSyncStatus();
    return JSON.parse(resultJson);
  }

  // === Privacy Sync Operations ===

  /**
   * Create privacy sync rule
   */
  async createPrivacySyncRule(rule: CalendarPrivacySync): Promise<string> {
    this.ensureInitialized();
    const ruleJson = JSON.stringify(rule);
    return await this.engine.createPrivacySyncRule(ruleJson);
  }

  /**
   * Execute privacy sync for all rules
   */
  async executePrivacySync(): Promise<PrivacySyncResult[]> {
    this.ensureInitialized();
    const resultJson = await this.engine.executePrivacySync();
    return JSON.parse(resultJson);
  }

  /**
   * Execute privacy sync for a specific rule
   */
  async executePrivacySyncRule(ruleId: string): Promise<PrivacySyncResult> {
    this.ensureInitialized();
    const resultJson = await this.engine.executePrivacySyncRule(ruleId);
    return JSON.parse(resultJson);
  }

  // === Search Operations ===

  /**
   * Search calendar events
   */
  async searchEvents(query: string, limit?: number): Promise<CalendarEvent[]> {
    this.ensureInitialized();
    const resultJson = await this.engine.searchEvents(query, limit);
    return JSON.parse(resultJson);
  }

  /**
   * Search calendars
   */
  async searchCalendars(query: string): Promise<Calendar[]> {
    this.ensureInitialized();
    const resultJson = await this.engine.searchCalendars(query);
    return JSON.parse(resultJson);
  }

  // === Metrics and Monitoring ===

  /**
   * Get calendar metrics
   */
  async getMetrics(): Promise<CalendarMetrics> {
    this.ensureInitialized();
    const resultJson = await this.engine.getMetrics();
    return JSON.parse(resultJson);
  }

  // === Utility Methods ===

  /**
   * Get supported calendar providers
   */
  static getSupportedProviders(): CalendarProvider[] {
    if (calendarEngine) {
      const resultJson = rustCalendarEngine.CalendarEngineJs.getSupportedProviders();
      return JSON.parse(resultJson);
    }
    return ['google', 'outlook', 'caldav', 'icloud', 'fastmail'];
  }

  /**
   * Get provider capabilities
   */
  static getProviderCapabilities(provider: CalendarProvider) {
    if (calendarEngine) {
      const resultJson = rustCalendarEngine.CalendarEngineJs.getProviderCapabilities(provider);
      return JSON.parse(resultJson);
    }
    // Mock capabilities for development
    return {
      supportsWebhooks: provider === 'google' || provider === 'outlook',
      supportsPushNotifications: provider === 'google' || provider === 'outlook',
      supportsRecurringEvents: true,
      supportsAttendees: true,
      supportsFreeBusy: true,
      supportsConferencing: provider === 'google' || provider === 'outlook',
      supportsAttachments: provider === 'google' || provider === 'outlook',
      supportsReminders: true,
      supportsColors: true,
      supportsMultipleCalendars: true,
      supportsCalendarSharing: provider === 'google' || provider === 'outlook',
      maxEventDurationDays: provider.startsWith('caldav') ? null : 365,
      rateLimitRpm: provider === 'google' ? 300 : provider === 'outlook' ? 600 : 60,
      batchOperations: provider === 'google' || provider === 'outlook',
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Calendar engine is not initialized. Call initialize() first.');
    }
  }
}

/**
 * Calendar event listener for real-time notifications
 */
export class CalendarEventListener {
  private listeners: ((notification: CalendarNotification) => void)[] = [];

  /**
   * Add event listener for calendar notifications
   */
  addListener(callback: (notification: CalendarNotification) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeListener(callback: (notification: CalendarNotification) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners
   */
  notify(notification: CalendarNotification): void {
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in calendar notification listener:', error);
      }
    });
  }
}

/**
 * Calendar webhook handler
 */
export class CalendarWebhookHandler {
  private handler: any;

  constructor() {
    if (calendarEngine) {
      this.handler = new rustCalendarEngine.CalendarWebhookHandler();
    }
  }

  /**
   * Set the calendar engine reference
   */
  async setEngine(engine: CalendarEngine): Promise<void> {
    if (this.handler) {
      await this.handler.setEngine(engine);
    }
  }

  /**
   * Add event listener
   */
  async addListener(listener: CalendarEventListener): Promise<void> {
    if (this.handler) {
      await this.handler.addListener(listener);
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(
    provider: CalendarProvider,
    payload: string,
    signature?: string
  ): Promise<void> {
    if (this.handler) {
      await this.handler.processWebhook(provider, payload, signature);
    }
  }
}

// Mock implementation for development/testing when native module isn't available
class MockCalendarEngine {
  private accounts: Map<string, CalendarAccount> = new Map();
  private calendars: Map<string, Calendar> = new Map();
  private events: Map<string, CalendarEvent> = new Map();
  
  async initialize(_configJson: string): Promise<void> {
    console.warn('Using mock calendar engine - no actual calendar operations will be performed');
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async createAccount(accountJson: string): Promise<string> {
    const account: CreateCalendarAccountInput = JSON.parse(accountJson);
    const createdAccount: CalendarAccount = {
      id: `mock-account-${Date.now()}`,
      userId: account.userId,
      name: account.name,
      email: account.email,
      provider: account.provider,
      config: account.config,
      credentials: account.credentials,
      status: account.status,
      defaultCalendarId: account.defaultCalendarId,
      lastSyncAt: new Date(),
      nextSyncAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      syncIntervalMinutes: account.syncIntervalMinutes,
      isEnabled: account.isEnabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.accounts.set(createdAccount.id, createdAccount);
    return JSON.stringify(createdAccount);
  }

  async getAccount(accountId: string): Promise<string> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }
    return JSON.stringify(account);
  }

  async getUserAccounts(userId: string): Promise<string> {
    const userAccounts = Array.from(this.accounts.values())
      .filter(account => account.userId === userId);
    return JSON.stringify(userAccounts);
  }

  // Additional mock methods would go here...
  async updateAccount(accountId: string, updatesJson: string): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async deleteAccount(accountId: string): Promise<void> {
    this.accounts.delete(accountId);
  }
  
  async listCalendars(accountId: string): Promise<string> {
    return JSON.stringify([]);
  }
  
  async getCalendar(calendarId: string): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async createCalendar(calendarJson: string): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async createEvent(eventJson: string): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async updateEvent(calendarId: string, eventId: string, updatesJson: string): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {}
  
  async getEventsInRange(calendarIdsJson: string, timeMinIso: string, timeMaxIso: string): Promise<string> {
    return JSON.stringify([]);
  }
  
  async queryFreeBusy(queryJson: string): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async syncAccount(accountId: string, force: boolean): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async getAllSyncStatus(): Promise<string> {
    return JSON.stringify({});
  }
  
  async createPrivacySyncRule(ruleJson: string): Promise<string> {
    return `mock-rule-${Date.now()}`;
  }
  
  async executePrivacySync(): Promise<string> {
    return JSON.stringify([]);
  }
  
  async executePrivacySyncRule(ruleId: string): Promise<string> {
    throw new Error('Mock implementation');
  }
  
  async searchEvents(query: string, limit?: number): Promise<string> {
    return JSON.stringify([]);
  }
  
  async searchCalendars(query: string): Promise<string> {
    return JSON.stringify([]);
  }
  
  async getMetrics(): Promise<string> {
    throw new Error('Mock implementation');
  }
}

// Export singleton instance
export const calendarEngine = new CalendarEngine();
export { CalendarEngine as CalendarEngineClass };
export default calendarEngine;