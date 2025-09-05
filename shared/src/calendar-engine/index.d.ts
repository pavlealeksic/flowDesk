/**
 * Calendar Engine TypeScript Interface
 *
 * TypeScript wrapper for the Rust calendar engine providing a clean,
 * type-safe interface for all calendar operations.
 */
import { CalendarAccount, CalendarEvent, Calendar, CalendarProvider, CreateCalendarEventInput, UpdateCalendarEventInput, CreateCalendarAccountInput, UpdateCalendarAccountInput, CalendarPrivacySync, FreeBusyQuery, FreeBusyResponse, CalendarMetrics, CalendarSyncStatus } from '../types/calendar';
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
export declare class CalendarEngine {
    private engine;
    private initialized;
    constructor();
    /**
     * Initialize the calendar engine with configuration
     */
    initialize(config: CalendarEngineConfig): Promise<void>;
    /**
     * Start the calendar engine background services
     */
    start(): Promise<void>;
    /**
     * Stop the calendar engine
     */
    stop(): Promise<void>;
    /**
     * Create a new calendar account
     */
    createAccount(account: CreateCalendarAccountInput): Promise<CalendarAccount>;
    /**
     * Get calendar account by ID
     */
    getAccount(accountId: string): Promise<CalendarAccount>;
    /**
     * Get all calendar accounts for a user
     */
    getUserAccounts(userId: string): Promise<CalendarAccount[]>;
    /**
     * Update calendar account
     */
    updateAccount(accountId: string, updates: UpdateCalendarAccountInput): Promise<CalendarAccount>;
    /**
     * Delete calendar account
     */
    deleteAccount(accountId: string): Promise<void>;
    /**
     * List calendars for an account
     */
    listCalendars(accountId: string): Promise<Calendar[]>;
    /**
     * Get calendar by ID
     */
    getCalendar(calendarId: string): Promise<Calendar>;
    /**
     * Create calendar
     */
    createCalendar(calendar: Calendar): Promise<Calendar>;
    /**
     * Create calendar event
     */
    createEvent(event: CreateCalendarEventInput): Promise<CalendarEvent>;
    /**
     * Update calendar event
     */
    updateEvent(calendarId: string, eventId: string, updates: UpdateCalendarEventInput): Promise<CalendarEvent>;
    /**
     * Delete calendar event
     */
    deleteEvent(calendarId: string, eventId: string): Promise<void>;
    /**
     * Get events in date range
     */
    getEventsInRange(calendarIds: string[], timeMin: Date, timeMax: Date): Promise<CalendarEvent[]>;
    /**
     * Query free/busy information
     */
    queryFreeBusy(query: FreeBusyQuery): Promise<FreeBusyResponse>;
    /**
     * Trigger full sync for an account
     */
    syncAccount(accountId: string, force?: boolean): Promise<CalendarSyncStatus>;
    /**
     * Get sync status for all accounts
     */
    getAllSyncStatus(): Promise<Record<string, CalendarSyncStatus>>;
    /**
     * Create privacy sync rule
     */
    createPrivacySyncRule(rule: CalendarPrivacySync): Promise<string>;
    /**
     * Execute privacy sync for all rules
     */
    executePrivacySync(): Promise<PrivacySyncResult[]>;
    /**
     * Execute privacy sync for a specific rule
     */
    executePrivacySyncRule(ruleId: string): Promise<PrivacySyncResult>;
    /**
     * Search calendar events
     */
    searchEvents(query: string, limit?: number): Promise<CalendarEvent[]>;
    /**
     * Search calendars
     */
    searchCalendars(query: string): Promise<Calendar[]>;
    /**
     * Get calendar metrics
     */
    getMetrics(): Promise<CalendarMetrics>;
    /**
     * Get supported calendar providers
     */
    static getSupportedProviders(): CalendarProvider[];
    /**
     * Get provider capabilities
     */
    static getProviderCapabilities(provider: CalendarProvider): any;
    private ensureInitialized;
}
/**
 * Calendar event listener for real-time notifications
 */
export declare class CalendarEventListener {
    private listeners;
    /**
     * Add event listener for calendar notifications
     */
    addListener(callback: (notification: CalendarNotification) => void): void;
    /**
     * Remove event listener
     */
    removeListener(callback: (notification: CalendarNotification) => void): void;
    /**
     * Notify all listeners
     */
    notify(notification: CalendarNotification): void;
}
/**
 * Calendar webhook handler
 */
export declare class CalendarWebhookHandler {
    private handler;
    constructor();
    /**
     * Set the calendar engine reference
     */
    setEngine(engine: CalendarEngine): Promise<void>;
    /**
     * Add event listener
     */
    addListener(listener: CalendarEventListener): Promise<void>;
    /**
     * Process incoming webhook
     */
    processWebhook(provider: CalendarProvider, payload: string, signature?: string): Promise<void>;
}
export declare const calendarEngine: CalendarEngine;
export { CalendarEngine as CalendarEngineClass };
export default calendarEngine;
//# sourceMappingURL=index.d.ts.map