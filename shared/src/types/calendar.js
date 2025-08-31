"use strict";
/**
 * Calendar System Types for Flow Desk
 *
 * Defines comprehensive types for calendar accounts, events, attendees,
 * recurring patterns, and calendar provider integrations following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarAccountSchema = exports.CalendarEventSchema = exports.RecurrenceRuleSchema = exports.EventAttendeeSchema = exports.EventParticipantSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.EventParticipantSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    displayName: zod_1.z.string().optional(),
    self: zod_1.z.boolean().optional()
});
exports.EventAttendeeSchema = exports.EventParticipantSchema.extend({
    responseStatus: zod_1.z.enum(['needsAction', 'declined', 'tentative', 'accepted']),
    optional: zod_1.z.boolean(),
    isResource: zod_1.z.boolean(),
    additionalEmails: zod_1.z.array(zod_1.z.string().email()).optional(),
    comment: zod_1.z.string().optional()
});
exports.RecurrenceRuleSchema = zod_1.z.object({
    frequency: zod_1.z.enum(['SECONDLY', 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    interval: zod_1.z.number().positive(),
    byWeekDay: zod_1.z.array(zod_1.z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
    byMonthDay: zod_1.z.array(zod_1.z.number().min(1).max(31)).optional(),
    byMonth: zod_1.z.array(zod_1.z.number().min(1).max(12)).optional(),
    byWeekNumber: zod_1.z.array(zod_1.z.number()).optional(),
    byYearDay: zod_1.z.array(zod_1.z.number().min(1).max(366)).optional(),
    byHour: zod_1.z.array(zod_1.z.number().min(0).max(23)).optional(),
    byMinute: zod_1.z.array(zod_1.z.number().min(0).max(59)).optional(),
    count: zod_1.z.number().positive().optional(),
    until: zod_1.z.date().optional(),
    weekStart: zod_1.z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']).optional(),
    rrule: zod_1.z.string()
});
exports.CalendarEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    calendarId: zod_1.z.string(),
    providerId: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    locationData: zod_1.z.object({
        displayName: zod_1.z.string(),
        room: zod_1.z.string().optional(),
        building: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        postalCode: zod_1.z.string().optional(),
        coordinates: zod_1.z.object({
            latitude: zod_1.z.number(),
            longitude: zod_1.z.number()
        }).optional(),
        capacity: zod_1.z.number().optional(),
        features: zod_1.z.array(zod_1.z.string()).optional()
    }).optional(),
    startTime: zod_1.z.date(),
    endTime: zod_1.z.date(),
    timezone: zod_1.z.string().optional(),
    isAllDay: zod_1.z.boolean(),
    status: zod_1.z.enum(['confirmed', 'tentative', 'cancelled']),
    visibility: zod_1.z.enum(['default', 'public', 'private', 'confidential']),
    creator: exports.EventParticipantSchema.optional(),
    organizer: exports.EventParticipantSchema.optional(),
    attendees: zod_1.z.array(exports.EventAttendeeSchema),
    recurrence: exports.RecurrenceRuleSchema.optional(),
    recurringEventId: zod_1.z.string().optional(),
    originalStartTime: zod_1.z.date().optional(),
    reminders: zod_1.z.array(zod_1.z.object({
        method: zod_1.z.enum(['email', 'popup', 'sms', 'sound']),
        minutesBefore: zod_1.z.number().nonnegative()
    })),
    conferencing: zod_1.z.object({
        solution: zod_1.z.enum(['zoom', 'meet', 'teams', 'webex', 'gotomeeting', 'hangout', 'skype', 'custom']),
        meetingId: zod_1.z.string().optional(),
        joinUrl: zod_1.z.string().url().optional(),
        phoneNumbers: zod_1.z.array(zod_1.z.object({
            country: zod_1.z.string(),
            number: zod_1.z.string(),
            pin: zod_1.z.string().optional()
        })).optional(),
        passcode: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        room: zod_1.z.string().optional()
    }).optional(),
    attachments: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        title: zod_1.z.string(),
        fileUrl: zod_1.z.string().url().optional(),
        fileId: zod_1.z.string().optional(),
        mimeType: zod_1.z.string().optional(),
        iconUrl: zod_1.z.string().url().optional(),
        size: zod_1.z.number().optional()
    })),
    extendedProperties: zod_1.z.record(zod_1.z.string()).optional(),
    source: zod_1.z.object({
        title: zod_1.z.string(),
        url: zod_1.z.string().url().optional()
    }).optional(),
    color: zod_1.z.string().optional(),
    transparency: zod_1.z.enum(['opaque', 'transparent']),
    uid: zod_1.z.string(),
    sequence: zod_1.z.number(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.CalendarAccountSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    name: zod_1.z.string(),
    email: zod_1.z.string().email(),
    provider: zod_1.z.enum(['google', 'outlook', 'exchange', 'caldav', 'icloud', 'fastmail']),
    config: zod_1.z.any(), // Union type too complex for Zod
    credentials: zod_1.z.object({
        accessToken: zod_1.z.string().optional(),
        refreshToken: zod_1.z.string().optional(),
        tokenExpiresAt: zod_1.z.date().optional(),
        password: zod_1.z.string().optional(),
        additionalTokens: zod_1.z.record(zod_1.z.string()).optional()
    }).optional(),
    status: zod_1.z.enum(['active', 'auth_error', 'quota_exceeded', 'suspended', 'disabled', 'error']),
    defaultCalendarId: zod_1.z.string().optional(),
    lastSyncAt: zod_1.z.date().optional(),
    nextSyncAt: zod_1.z.date().optional(),
    syncIntervalMinutes: zod_1.z.number().positive(),
    isEnabled: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
//# sourceMappingURL=calendar.js.map