"use strict";
/**
 * Pure Rust Calendar Engine Proxy
 *
 * Delegates all calendar operations to the pure Rust backend via NAPI bindings.
 * This TypeScript layer is a minimal wrapper with no business logic.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarEngine = exports.CalendarEngine = exports.pureRustCalendarEngine = exports.PureRustCalendarEngine = void 0;
// Import Rust NAPI calendar functions
const shared_rust_1 = require("@flow-desk/shared-rust");
const electron_log_1 = __importDefault(require("electron-log"));
/**
 * Pure Rust Calendar Engine Proxy
 * All operations are delegated to Rust backend
 */
class PureRustCalendarEngine {
    constructor() {
        this.isInitialized = false;
    }
    /**
     * Initialize Rust calendar engine
     */
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            electron_log_1.default.info('Initializing pure Rust calendar engine proxy...');
            await (0, shared_rust_1.initCalendarEngine)();
            this.isInitialized = true;
            electron_log_1.default.info('Pure Rust calendar engine proxy initialized');
        }
        catch (error) {
            electron_log_1.default.error('Failed to initialize pure Rust calendar engine proxy:', error);
            throw error;
        }
    }
    /**
     * Add calendar account via Rust backend
     */
    async addAccount(accountData) {
        await this.ensureInitialized();
        // Handle legacy interface
        let napiAccount;
        if ('userId' in accountData) {
            napiAccount = {
                id: accountData.userId,
                email: accountData.email || '',
                provider: accountData.provider,
                display_name: accountData.name,
                is_enabled: accountData.isEnabled !== false,
            };
        }
        else {
            // Legacy CalendarAccount interface
            napiAccount = {
                id: accountData.id,
                email: accountData.email,
                provider: accountData.provider,
                display_name: accountData.displayName,
                is_enabled: accountData.isEnabled,
            };
        }
        await (0, shared_rust_1.addCalendarAccount)(napiAccount);
        return {
            id: napiAccount.id,
            userId: napiAccount.id,
            provider: napiAccount.provider,
            name: napiAccount.display_name,
            email: napiAccount.email,
            isEnabled: napiAccount.is_enabled,
            config: {
                provider: napiAccount.provider
            },
            status: 'active',
            syncIntervalMinutes: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    /**
     * Remove calendar account via Rust backend
     */
    async removeAccount(accountId) {
        await this.ensureInitialized();
        await (0, shared_rust_1.removeCalendarAccount)(accountId);
    }
    /**
     * Get calendar account by ID (fetch from Rust backend)
     */
    getAccount(accountId) {
        // This will need to be made async to fetch from Rust
        // For now, return undefined to maintain compatibility
        return undefined;
    }
    /**
     * Get all accounts via Rust backend
     */
    async getAccounts() {
        await this.ensureInitialized();
        const rustAccounts = await (0, shared_rust_1.getCalendarAccounts)();
        return rustAccounts.map((rustAccount) => ({
            id: rustAccount.id,
            userId: rustAccount.id,
            provider: rustAccount.provider,
            name: rustAccount.display_name,
            email: rustAccount.email,
            isEnabled: rustAccount.is_enabled,
            config: {
                provider: rustAccount.provider
            },
            status: 'active',
            syncIntervalMinutes: 15,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));
    }
    /**
     * Get calendars for account via Rust backend
     */
    async getCalendars(accountId) {
        await this.ensureInitialized();
        try {
            const rustCalendars = await (0, shared_rust_1.getCalendars)(accountId);
            return rustCalendars.map((rustCal) => ({
                id: rustCal.id,
                accountId: rustCal.account_id || accountId,
                providerId: rustCal.id,
                name: rustCal.name,
                description: rustCal.description || undefined,
                color: rustCal.color || '#3174ad',
                timezone: rustCal.timezone || 'UTC',
                isPrimary: rustCal.is_primary || false,
                accessLevel: 'owner',
                isVisible: true,
                canSync: true,
                type: rustCal.is_primary ? 'primary' : 'secondary',
                isSelected: true,
                syncStatus: {
                    isBeingSynced: false
                },
                createdAt: new Date(),
                updatedAt: new Date(),
            }));
        }
        catch (error) {
            electron_log_1.default.warn('Failed to get calendars from Rust backend:', error);
            if (error instanceof Error && error.message.includes('not yet implemented')) {
                electron_log_1.default.info('Calendar functionality not fully implemented in Rust backend yet');
            }
            return [];
        }
    }
    /**
     * Get events for account via Rust backend
     */
    async getEvents(accountId, startDate, endDate) {
        await this.ensureInitialized();
        try {
            // Get calendars first, then get events for all calendars
            const calendars = await this.getCalendars(accountId);
            if (calendars.length === 0) {
                electron_log_1.default.info(`No calendars found for account ${accountId}`);
                return [];
            }
            // For now, get events from the first calendar
            const rustEvents = await (0, shared_rust_1.getCalendarEvents)(calendars[0].id);
            return rustEvents
                .map((rustEvent) => ({
                id: rustEvent.id,
                providerId: rustEvent.id,
                calendarId: rustEvent.calendar_id,
                title: rustEvent.title,
                description: rustEvent.description,
                startTime: new Date(rustEvent.start_time * 1000),
                endTime: new Date(rustEvent.end_time * 1000),
                timezone: 'UTC',
                isAllDay: rustEvent.is_all_day,
                status: 'confirmed',
                visibility: 'default',
                location: rustEvent.location,
                attendees: [], // Convert from Rust format
                recurrence: undefined,
                reminders: [],
                attachments: [],
                transparency: 'opaque',
                uid: rustEvent.id,
                sequence: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            }))
                .filter(event => {
                // Apply date filtering if provided
                if (startDate && endDate) {
                    return event.startTime >= startDate && event.endTime <= endDate;
                }
                return true;
            });
        }
        catch (error) {
            electron_log_1.default.warn('Failed to get events from Rust backend:', error);
            if (error instanceof Error && error.message.includes('not yet implemented')) {
                electron_log_1.default.info('Calendar events functionality not fully implemented in Rust backend yet');
            }
            return [];
        }
    }
    /**
     * Create event via Rust backend
     */
    async createEvent(data) {
        await this.ensureInitialized();
        // Handle both modern and legacy interfaces
        const calendarId = data.calendarId;
        const title = data.title;
        const startTime = data.startTime;
        const endTime = data.endTime;
        const eventId = await (0, shared_rust_1.createCalendarEvent)(calendarId, title, Math.floor(startTime.getTime() / 1000), Math.floor(endTime.getTime() / 1000));
        // Return in legacy format for backward compatibility
        return {
            id: eventId,
            providerId: eventId,
            calendarId: calendarId,
            title: title,
            description: data.description,
            startTime: startTime,
            endTime: endTime,
            timezone: 'UTC',
            isAllDay: data.isAllDay || false,
            status: 'confirmed',
            visibility: 'default',
            location: data.location,
            attendees: data.attendees || [],
            recurrence: data.recurrence,
            reminders: data.reminders || [],
            attachments: data.attachments || [],
            transparency: 'opaque',
            uid: eventId,
            sequence: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    /**
     * Update event via Rust backend
     * TODO: Implement updateCalendarEvent in Rust NAPI bindings
     */
    async updateEvent(eventId, updates) {
        await this.ensureInitialized();
        // For now, throw an error as this needs to be implemented in Rust
        throw new Error('Update event not yet implemented in Rust backend');
    }
    /**
     * Delete event via Rust backend
     * TODO: Implement deleteCalendarEvent in Rust NAPI bindings
     */
    async deleteEvent(eventId) {
        await this.ensureInitialized();
        // For now, throw an error as this needs to be implemented in Rust
        throw new Error('Delete event not yet implemented in Rust backend');
    }
    /**
     * Sync account via Rust backend
     */
    async syncAccount(accountId) {
        await this.ensureInitialized();
        return await (0, shared_rust_1.syncCalendarAccount)(accountId);
    }
    /**
     * Ensure Rust engine is initialized
     */
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }
}
exports.PureRustCalendarEngine = PureRustCalendarEngine;
// Export singleton instance
exports.pureRustCalendarEngine = new PureRustCalendarEngine();
// Keep the old interface for backward compatibility, but delegate to Rust
class CalendarEngine extends PureRustCalendarEngine {
}
exports.CalendarEngine = CalendarEngine;
exports.calendarEngine = new CalendarEngine();
