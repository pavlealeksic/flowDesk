/*!
 * Base Calendar Provider - Interface and Abstract Implementation
 * 
 * Defines the core interface and functionality that all calendar providers must implement.
 * Provides common utilities for OAuth, authentication, and data transformation.
 */

import { EventEmitter } from 'events';
import type {
  CalendarAccount,
  CalendarEvent,
  Calendar,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  FreeBusyQuery,
  FreeBusyResponse,
  CalendarSyncStatus,
  CalendarProvider,
  RecurrenceRule,
  EventAttendee
} from '@flow-desk/shared/types/calendar';
import log from 'electron-log';

/**
 * Provider capability flags
 */
export interface CalendarProviderCapabilities {
  /** Supports creating events */
  canCreateEvents: boolean;
  /** Supports updating events */
  canUpdateEvents: boolean;
  /** Supports deleting events */
  canDeleteEvents: boolean;
  /** Supports recurring events */
  supportsRecurring: boolean;
  /** Supports attendees and meeting invitations */
  supportsAttendees: boolean;
  /** Supports free/busy queries */
  supportsFreeBusy: boolean;
  /** Supports real-time webhooks */
  supportsWebhooks: boolean;
  /** Supports incremental sync */
  supportsIncrementalSync: boolean;
  /** Supports event attachments */
  supportsAttachments: boolean;
  /** Supports custom reminders */
  supportsReminders: boolean;
  /** Maximum attendees per event */
  maxAttendees: number;
  /** Rate limits */
  rateLimits: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
}

/**
 * Authentication result for providers
 */
export interface AuthenticationResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
  additionalData?: Record<string, any>;
}

/**
 * Sync result information
 */
export interface SyncResult {
  success: boolean;
  calendars: Calendar[];
  events: CalendarEvent[];
  totalEvents: number;
  newEvents: number;
  updatedEvents: number;
  deletedEvents: number;
  errors: string[];
  syncToken?: string;
  nextPageToken?: string;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** API endpoint URLs */
  endpoints: {
    auth?: string;
    api: string;
    webhooks?: string;
  };
  /** OAuth configuration */
  oauth?: {
    clientId: string;
    clientSecret?: string;
    scopes: string[];
    redirectUri: string;
  };
  /** Rate limiting configuration */
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
}

/**
 * Abstract base class for all calendar providers
 */
export abstract class BaseCalendarProvider extends EventEmitter {
  protected account: CalendarAccount;
  protected config: ProviderConfig;
  protected isInitialized = false;
  protected syncInProgress = false;
  protected lastSyncAt?: Date;

  constructor(account: CalendarAccount, config: ProviderConfig) {
    super();
    this.account = account;
    this.config = config;
    this.setMaxListeners(100);
  }

  /**
   * Get provider type
   */
  abstract getProviderType(): CalendarProvider;

  /**
   * Get provider capabilities
   */
  abstract getCapabilities(): CalendarProviderCapabilities;

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    try {
      log.info(`Initializing ${this.getProviderType()} provider for account ${this.account.id}`);
      
      await this.validateConfiguration();
      await this.initializeProvider();
      
      this.isInitialized = true;
      this.emit('initialized', { accountId: this.account.id });
      
      log.info(`${this.getProviderType()} provider initialized successfully`);
    } catch (error) {
      log.error(`Failed to initialize ${this.getProviderType()} provider:`, error);
      this.emit('error', { 
        accountId: this.account.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Test authentication and connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const result = await this.performConnectionTest();
      
      if (result) {
        this.emit('connection:success', { accountId: this.account.id });
        log.info(`${this.getProviderType()} connection test successful`);
      } else {
        this.emit('connection:failed', { accountId: this.account.id });
        log.warn(`${this.getProviderType()} connection test failed`);
      }

      return result;
    } catch (error) {
      log.error(`${this.getProviderType()} connection test error:`, error);
      this.emit('connection:failed', { 
        accountId: this.account.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  /**
   * Authenticate with the provider
   */
  abstract authenticate(): Promise<AuthenticationResult>;

  /**
   * Refresh authentication tokens
   */
  abstract refreshAuthentication(): Promise<AuthenticationResult>;

  /**
   * Sync calendars from the provider
   */
  async syncCalendars(): Promise<Calendar[]> {
    try {
      this.ensureInitialized();
      this.ensureAuthenticated();

      log.info(`Syncing calendars for ${this.getProviderType()} account ${this.account.id}`);
      
      const calendars = await this.fetchCalendars();
      
      this.emit('calendars:synced', { 
        accountId: this.account.id, 
        calendars,
        count: calendars.length 
      });
      
      log.info(`Synced ${calendars.length} calendars for ${this.getProviderType()}`);
      return calendars;
    } catch (error) {
      log.error(`Failed to sync calendars for ${this.getProviderType()}:`, error);
      this.emit('calendars:sync:error', { 
        accountId: this.account.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Sync events from calendars
   */
  async syncEvents(calendarIds: string[], timeMin?: Date, timeMax?: Date): Promise<SyncResult> {
    try {
      this.ensureInitialized();
      this.ensureAuthenticated();

      if (this.syncInProgress) {
        throw new Error('Sync already in progress');
      }

      this.syncInProgress = true;
      this.emit('events:sync:started', { 
        accountId: this.account.id, 
        calendarIds,
        timeRange: { timeMin, timeMax }
      });

      log.info(`Syncing events for ${calendarIds.length} calendars from ${this.getProviderType()}`);

      const result = await this.performEventsSync(calendarIds, timeMin, timeMax);
      this.lastSyncAt = new Date();

      this.emit('events:sync:completed', { 
        accountId: this.account.id, 
        result 
      });

      log.info(`Synced ${result.totalEvents} events for ${this.getProviderType()}`);
      return result;
    } catch (error) {
      log.error(`Failed to sync events for ${this.getProviderType()}:`, error);
      this.emit('events:sync:error', { 
        accountId: this.account.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Create a new event
   */
  async createEvent(calendarId: string, eventData: CreateCalendarEventInput): Promise<CalendarEvent> {
    try {
      this.ensureInitialized();
      this.ensureAuthenticated();
      this.ensureCapability('canCreateEvents');

      log.info(`Creating event in calendar ${calendarId} for ${this.getProviderType()}`);

      const event = await this.performEventCreation(calendarId, eventData);
      
      this.emit('event:created', { 
        accountId: this.account.id, 
        calendarId, 
        event 
      });

      log.info(`Created event ${event.id} for ${this.getProviderType()}`);
      return event;
    } catch (error) {
      log.error(`Failed to create event for ${this.getProviderType()}:`, error);
      this.emit('event:creation:error', { 
        accountId: this.account.id, 
        calendarId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(calendarId: string, eventId: string, updates: UpdateCalendarEventInput): Promise<CalendarEvent> {
    try {
      this.ensureInitialized();
      this.ensureAuthenticated();
      this.ensureCapability('canUpdateEvents');

      log.info(`Updating event ${eventId} in calendar ${calendarId} for ${this.getProviderType()}`);

      const event = await this.performEventUpdate(calendarId, eventId, updates);
      
      this.emit('event:updated', { 
        accountId: this.account.id, 
        calendarId, 
        event 
      });

      log.info(`Updated event ${event.id} for ${this.getProviderType()}`);
      return event;
    } catch (error) {
      log.error(`Failed to update event for ${this.getProviderType()}:`, error);
      this.emit('event:update:error', { 
        accountId: this.account.id, 
        calendarId, 
        eventId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      this.ensureInitialized();
      this.ensureAuthenticated();
      this.ensureCapability('canDeleteEvents');

      log.info(`Deleting event ${eventId} from calendar ${calendarId} for ${this.getProviderType()}`);

      await this.performEventDeletion(calendarId, eventId);
      
      this.emit('event:deleted', { 
        accountId: this.account.id, 
        calendarId, 
        eventId 
      });

      log.info(`Deleted event ${eventId} for ${this.getProviderType()}`);
    } catch (error) {
      log.error(`Failed to delete event for ${this.getProviderType()}:`, error);
      this.emit('event:deletion:error', { 
        accountId: this.account.id, 
        calendarId, 
        eventId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Query free/busy information
   */
  async queryFreeBusy(query: FreeBusyQuery): Promise<FreeBusyResponse> {
    try {
      this.ensureInitialized();
      this.ensureAuthenticated();
      this.ensureCapability('supportsFreeBusy');

      log.info(`Querying free/busy for ${query.emails.length} emails from ${this.getProviderType()}`);

      const response = await this.performFreeBusyQuery(query);

      log.info(`Retrieved free/busy data for ${Object.keys(response.freeBusy).length} emails`);
      return response;
    } catch (error) {
      log.error(`Failed to query free/busy for ${this.getProviderType()}:`, error);
      throw error;
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): CalendarSyncStatus {
    return {
      accountId: this.account.id,
      status: this.syncInProgress ? 'syncing' : 'idle',
      lastSyncAt: this.lastSyncAt,
      currentOperation: this.syncInProgress ? {
        type: 'full_sync',
        progress: 0,
        startedAt: new Date()
      } : undefined,
      stats: {
        totalEvents: 0,
        newEvents: 0,
        updatedEvents: 0,
        deletedEvents: 0,
        syncErrors: 0
      }
    };
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    try {
      log.info(`Disposing ${this.getProviderType()} provider for account ${this.account.id}`);
      
      await this.performDisposal();
      this.removeAllListeners();
      this.isInitialized = false;
      
      log.info(`${this.getProviderType()} provider disposed successfully`);
    } catch (error) {
      log.error(`Error disposing ${this.getProviderType()} provider:`, error);
      throw error;
    }
  }

  // Abstract methods to be implemented by concrete providers
  protected abstract validateConfiguration(): Promise<void>;
  protected abstract initializeProvider(): Promise<void>;
  protected abstract performConnectionTest(): Promise<boolean>;
  protected abstract fetchCalendars(): Promise<Calendar[]>;
  protected abstract performEventsSync(calendarIds: string[], timeMin?: Date, timeMax?: Date): Promise<SyncResult>;
  protected abstract performEventCreation(calendarId: string, eventData: CreateCalendarEventInput): Promise<CalendarEvent>;
  protected abstract performEventUpdate(calendarId: string, eventId: string, updates: UpdateCalendarEventInput): Promise<CalendarEvent>;
  protected abstract performEventDeletion(calendarId: string, eventId: string): Promise<void>;
  protected abstract performFreeBusyQuery(query: FreeBusyQuery): Promise<FreeBusyResponse>;
  protected abstract performDisposal(): Promise<void>;

  // Utility methods
  protected ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`${this.getProviderType()} provider not initialized`);
    }
  }

  protected ensureAuthenticated(): void {
    if (!this.account.credentials?.accessToken) {
      throw new Error(`${this.getProviderType()} provider not authenticated`);
    }
  }

  protected ensureCapability(capability: keyof CalendarProviderCapabilities): void {
    const capabilities = this.getCapabilities();
    if (!capabilities[capability]) {
      throw new Error(`${this.getProviderType()} provider does not support ${capability}`);
    }
  }

  protected generateEventId(): string {
    return `${this.getProviderType()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected generateCalendarId(): string {
    return `${this.getProviderType()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a standardized error object
   */
  protected createError(message: string, code?: string, details?: any): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.provider = this.getProviderType();
    error.accountId = this.account.id;
    error.details = details;
    return error;
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  protected async handleRateLimit(attempt: number = 0): Promise<void> {
    if (attempt >= this.config.maxRetries) {
      throw this.createError('Rate limit exceeded, max retries reached', 'RATE_LIMIT_EXCEEDED');
    }

    const delay = this.config.retryDelay * Math.pow(2, attempt);
    log.warn(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Make an authenticated HTTP request with retry logic
   */
  protected async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {},
    attempt: number = 0
  ): Promise<Response> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.account.credentials?.accessToken}`,
        ...options.headers
      };

      const response = await fetch(url, {
        ...options,
        headers,
        timeout: this.config.timeout
      });

      if (response.status === 429) {
        await this.handleRateLimit(attempt);
        return this.makeAuthenticatedRequest(url, options, attempt + 1);
      }

      if (response.status === 401) {
        // Try to refresh token
        const authResult = await this.refreshAuthentication();
        if (authResult.success && authResult.accessToken) {
          this.account.credentials = {
            ...this.account.credentials,
            accessToken: authResult.accessToken,
            refreshToken: authResult.refreshToken || this.account.credentials?.refreshToken,
            tokenExpiresAt: authResult.expiresAt
          };
          
          // Retry with new token
          return this.makeAuthenticatedRequest(url, options, attempt + 1);
        } else {
          throw this.createError('Authentication failed and refresh unsuccessful', 'AUTH_FAILED');
        }
      }

      if (!response.ok) {
        const error = await response.text();
        throw this.createError(
          `HTTP ${response.status}: ${error}`,
          `HTTP_${response.status}`,
          { status: response.status, response: error }
        );
      }

      return response;
    } catch (error) {
      if (attempt < this.config.maxRetries && 
          (error instanceof TypeError || error.message.includes('fetch'))) {
        await this.handleRateLimit(attempt);
        return this.makeAuthenticatedRequest(url, options, attempt + 1);
      }
      throw error;
    }
  }
}