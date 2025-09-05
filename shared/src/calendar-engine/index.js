"use strict";
/**
 * Calendar Engine TypeScript Interface
 *
 * TypeScript wrapper for the Rust calendar engine providing a clean,
 * type-safe interface for all calendar operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarEngineClass = exports.calendarEngine = exports.CalendarWebhookHandler = exports.CalendarEventListener = exports.CalendarEngine = void 0;
// Import the compiled Rust NAPI module
let rustCalendarEngine;
try {
    rustCalendarEngine = require('../../rust-lib/index.node');
}
catch (error) {
    throw new Error('Rust calendar engine is required but not available. Please ensure the native module is properly installed.');
}
/**
 * Main calendar engine class providing unified calendar operations
 */
class CalendarEngine {
    constructor() {
        this.initialized = false;
        if (rustCalendarEngine) {
            this.engine = new rustCalendarEngine.CalendarEngineJs();
        }
        else {
            throw new Error('Rust calendar engine is required but not available. Please ensure the native module is properly installed.');
        }
    }
    /**
     * Initialize the calendar engine with configuration
     */
    async initialize(config) {
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
    async start() {
        this.ensureInitialized();
        await this.engine.start();
    }
    /**
     * Stop the calendar engine
     */
    async stop() {
        if (this.initialized) {
            await this.engine.stop();
        }
    }
    // === Account Management ===
    /**
     * Create a new calendar account
     */
    async createAccount(account) {
        this.ensureInitialized();
        const accountJson = JSON.stringify(account);
        const resultJson = await this.engine.createAccount(accountJson);
        return JSON.parse(resultJson);
    }
    /**
     * Get calendar account by ID
     */
    async getAccount(accountId) {
        this.ensureInitialized();
        const resultJson = await this.engine.getAccount(accountId);
        return JSON.parse(resultJson);
    }
    /**
     * Get all calendar accounts for a user
     */
    async getUserAccounts(userId) {
        this.ensureInitialized();
        const resultJson = await this.engine.getUserAccounts(userId);
        return JSON.parse(resultJson);
    }
    /**
     * Update calendar account
     */
    async updateAccount(accountId, updates) {
        this.ensureInitialized();
        const updatesJson = JSON.stringify(updates);
        const resultJson = await this.engine.updateAccount(accountId, updatesJson);
        return JSON.parse(resultJson);
    }
    /**
     * Delete calendar account
     */
    async deleteAccount(accountId) {
        this.ensureInitialized();
        await this.engine.deleteAccount(accountId);
    }
    // === Calendar Operations ===
    /**
     * List calendars for an account
     */
    async listCalendars(accountId) {
        this.ensureInitialized();
        const resultJson = await this.engine.listCalendars(accountId);
        return JSON.parse(resultJson);
    }
    /**
     * Get calendar by ID
     */
    async getCalendar(calendarId) {
        this.ensureInitialized();
        const resultJson = await this.engine.getCalendar(calendarId);
        return JSON.parse(resultJson);
    }
    /**
     * Create calendar
     */
    async createCalendar(calendar) {
        this.ensureInitialized();
        const calendarJson = JSON.stringify(calendar);
        const resultJson = await this.engine.createCalendar(calendarJson);
        return JSON.parse(resultJson);
    }
    // === Event Operations ===
    /**
     * Create calendar event
     */
    async createEvent(event) {
        this.ensureInitialized();
        const eventJson = JSON.stringify(event);
        const resultJson = await this.engine.createEvent(eventJson);
        return JSON.parse(resultJson);
    }
    /**
     * Update calendar event
     */
    async updateEvent(calendarId, eventId, updates) {
        this.ensureInitialized();
        const updatesJson = JSON.stringify(updates);
        const resultJson = await this.engine.updateEvent(calendarId, eventId, updatesJson);
        return JSON.parse(resultJson);
    }
    /**
     * Delete calendar event
     */
    async deleteEvent(calendarId, eventId) {
        this.ensureInitialized();
        await this.engine.deleteEvent(calendarId, eventId);
    }
    /**
     * Get events in date range
     */
    async getEventsInRange(calendarIds, timeMin, timeMax) {
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
    async queryFreeBusy(query) {
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
    async syncAccount(accountId, force = false) {
        this.ensureInitialized();
        const resultJson = await this.engine.syncAccount(accountId, force);
        return JSON.parse(resultJson);
    }
    /**
     * Get sync status for all accounts
     */
    async getAllSyncStatus() {
        this.ensureInitialized();
        const resultJson = await this.engine.getAllSyncStatus();
        return JSON.parse(resultJson);
    }
    // === Privacy Sync Operations ===
    /**
     * Create privacy sync rule
     */
    async createPrivacySyncRule(rule) {
        this.ensureInitialized();
        const ruleJson = JSON.stringify(rule);
        return await this.engine.createPrivacySyncRule(ruleJson);
    }
    /**
     * Execute privacy sync for all rules
     */
    async executePrivacySync() {
        this.ensureInitialized();
        const resultJson = await this.engine.executePrivacySync();
        return JSON.parse(resultJson);
    }
    /**
     * Execute privacy sync for a specific rule
     */
    async executePrivacySyncRule(ruleId) {
        this.ensureInitialized();
        const resultJson = await this.engine.executePrivacySyncRule(ruleId);
        return JSON.parse(resultJson);
    }
    // === Search Operations ===
    /**
     * Search calendar events
     */
    async searchEvents(query, limit) {
        this.ensureInitialized();
        const resultJson = await this.engine.searchEvents(query, limit);
        return JSON.parse(resultJson);
    }
    /**
     * Search calendars
     */
    async searchCalendars(query) {
        this.ensureInitialized();
        const resultJson = await this.engine.searchCalendars(query);
        return JSON.parse(resultJson);
    }
    // === Metrics and Monitoring ===
    /**
     * Get calendar metrics
     */
    async getMetrics() {
        this.ensureInitialized();
        const resultJson = await this.engine.getMetrics();
        return JSON.parse(resultJson);
    }
    // === Utility Methods ===
    /**
     * Get supported calendar providers
     */
    static getSupportedProviders() {
        if (rustCalendarEngine) {
            const resultJson = rustCalendarEngine.CalendarEngineJs.getSupportedProviders();
            return JSON.parse(resultJson);
        }
        throw new Error('Rust calendar engine is required but not available.');
    }
    /**
     * Get provider capabilities
     */
    static getProviderCapabilities(provider) {
        if (rustCalendarEngine) {
            const resultJson = rustCalendarEngine.CalendarEngineJs.getProviderCapabilities(provider);
            return JSON.parse(resultJson);
        }
        throw new Error('Rust calendar engine is required but not available.');
    }
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('Calendar engine is not initialized. Call initialize() first.');
        }
    }
}
exports.CalendarEngine = CalendarEngine;
exports.CalendarEngineClass = CalendarEngine;
/**
 * Calendar event listener for real-time notifications
 */
class CalendarEventListener {
    constructor() {
        this.listeners = [];
    }
    /**
     * Add event listener for calendar notifications
     */
    addListener(callback) {
        this.listeners.push(callback);
    }
    /**
     * Remove event listener
     */
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * Notify all listeners
     */
    notify(notification) {
        this.listeners.forEach(listener => {
            try {
                listener(notification);
            }
            catch (error) {
                console.error('Error in calendar notification listener:', error);
            }
        });
    }
}
exports.CalendarEventListener = CalendarEventListener;
/**
 * Calendar webhook handler
 */
class CalendarWebhookHandler {
    constructor() {
        if (rustCalendarEngine) {
            this.handler = new rustCalendarEngine.CalendarWebhookHandler();
        }
        else {
            throw new Error('Rust calendar engine is required but not available.');
        }
    }
    /**
     * Set the calendar engine reference
     */
    async setEngine(engine) {
        if (this.handler) {
            await this.handler.setEngine(engine);
        }
    }
    /**
     * Add event listener
     */
    async addListener(listener) {
        if (this.handler) {
            await this.handler.addListener(listener);
        }
    }
    /**
     * Process incoming webhook
     */
    async processWebhook(provider, payload, signature) {
        if (this.handler) {
            await this.handler.processWebhook(provider, payload, signature);
        }
    }
}
exports.CalendarWebhookHandler = CalendarWebhookHandler;
// Export singleton instance
exports.calendarEngine = new CalendarEngine();
exports.default = exports.calendarEngine;
//# sourceMappingURL=index.js.map