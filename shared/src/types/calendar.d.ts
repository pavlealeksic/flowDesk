/**
 * Calendar System Types for Flow Desk
 *
 * Defines comprehensive types for calendar accounts, events, attendees,
 * recurring patterns, and calendar provider integrations following Blueprint.md requirements.
 */
import { z } from 'zod';
/**
 * Calendar provider types
 */
export type CalendarProvider = 'google' | 'outlook' | 'exchange' | 'caldav' | 'icloud' | 'fastmail';
/**
 * Calendar account configuration
 */
export interface CalendarAccount {
    /** Unique identifier */
    id: string;
    /** User ID who owns this account */
    userId: string;
    /** Display name for the account */
    name: string;
    /** Primary email address */
    email: string;
    /** Calendar provider type */
    provider: CalendarProvider;
    /** Provider-specific configuration */
    config: CalendarAccountConfig;
    /** OAuth credentials (encrypted) */
    credentials?: CalendarAccountCredentials;
    /** Account status */
    status: CalendarAccountStatus;
    /** Default calendar ID for new events */
    defaultCalendarId?: string;
    /** Last successful sync timestamp */
    lastSyncAt?: Date;
    /** Next scheduled sync timestamp */
    nextSyncAt?: Date;
    /** Sync interval in minutes */
    syncIntervalMinutes: number;
    /** Whether account is enabled for syncing */
    isEnabled: boolean;
    /** Account creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Calendar account status
 */
export type CalendarAccountStatus = 'active' | 'auth_error' | 'quota_exceeded' | 'suspended' | 'disabled' | 'error';
/**
 * Provider-specific account configuration
 */
export type CalendarAccountConfig = GoogleCalendarConfig | OutlookCalendarConfig | ExchangeCalendarConfig | CalDavConfig;
/**
 * Google Calendar configuration
 */
export interface GoogleCalendarConfig {
    provider: 'google';
    /** Google API client ID */
    clientId: string;
    /** Enabled Google API scopes */
    scopes: string[];
    /** Whether to use Google Calendar push notifications */
    enablePushNotifications: boolean;
    /** Sync token for incremental sync */
    syncToken?: string;
}
/**
 * Outlook/Graph calendar configuration
 */
export interface OutlookCalendarConfig {
    provider: 'outlook';
    /** Microsoft Graph client ID */
    clientId: string;
    /** Tenant ID for enterprise accounts */
    tenantId?: string;
    /** Enabled Graph API scopes */
    scopes: string[];
    /** Whether to use Graph webhooks */
    enableWebhooks: boolean;
    /** Delta token for incremental sync */
    deltaToken?: string;
}
/**
 * Exchange Web Services configuration
 */
export interface ExchangeCalendarConfig {
    provider: 'exchange';
    /** Exchange server URL */
    serverUrl: string;
    /** Exchange version */
    version: string;
    /** Domain for authentication */
    domain?: string;
    /** Whether to use autodiscovery */
    useAutodiscovery: boolean;
}
/**
 * CalDAV configuration (generic, iCloud, Fastmail)
 */
export interface CalDavConfig {
    provider: 'caldav' | 'icloud' | 'fastmail';
    /** CalDAV server URL */
    serverUrl: string;
    /** Principal URL */
    principalUrl?: string;
    /** Calendar home set URL */
    calendarHomeSet?: string;
    /** Authentication credentials */
    auth: {
        username: string;
        password?: string;
    };
    /** Supported calendar features */
    features: {
        supportsScheduling: boolean;
        supportsFreeBusy: boolean;
        supportsTasks: boolean;
    };
}
/**
 * Encrypted credentials storage
 */
export interface CalendarAccountCredentials {
    /** OAuth access token (encrypted) */
    accessToken?: string;
    /** OAuth refresh token (encrypted) */
    refreshToken?: string;
    /** Token expiry timestamp */
    tokenExpiresAt?: Date;
    /** Password for CalDAV (encrypted) */
    password?: string;
    /** Additional provider-specific tokens */
    additionalTokens?: Record<string, string>;
}
/**
 * Calendar entity
 */
export interface Calendar {
    /** Unique identifier */
    id: string;
    /** Calendar account ID */
    accountId: string;
    /** Provider-specific calendar ID */
    providerId: string;
    /** Calendar name */
    name: string;
    /** Calendar description */
    description?: string;
    /** Calendar color (hex) */
    color: string;
    /** Calendar timezone */
    timezone: string;
    /** Whether calendar is primary for the account */
    isPrimary: boolean;
    /** Access level for the user */
    accessLevel: CalendarAccessLevel;
    /** Whether calendar is visible in UI */
    isVisible: boolean;
    /** Whether calendar can be synced */
    canSync: boolean;
    /** Calendar type */
    type: CalendarType;
    /** Whether calendar is selected for display */
    isSelected: boolean;
    /** Sync status */
    syncStatus: {
        lastSyncAt?: Date;
        isBeingSynced: boolean;
        syncError?: string;
    };
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Calendar access levels
 */
export type CalendarAccessLevel = 'owner' | 'writer' | 'reader' | 'freeBusyReader';
/**
 * Calendar types
 */
export type CalendarType = 'primary' | 'secondary' | 'shared' | 'public' | 'resource' | 'holiday' | 'birthdays';
/**
 * Calendar event entity
 */
export interface CalendarEvent {
    /** Unique identifier */
    id: string;
    /** Calendar ID */
    calendarId: string;
    /** Provider-specific event ID */
    providerId: string;
    /** Event title */
    title: string;
    /** Event description */
    description?: string;
    /** Event location */
    location?: string;
    /** Structured location data */
    locationData?: EventLocation;
    /** Event start time */
    startTime: Date;
    /** Event end time */
    endTime: Date;
    /** Event timezone (overrides calendar timezone) */
    timezone?: string;
    /** Whether event is all-day */
    isAllDay: boolean;
    /** Event status */
    status: EventStatus;
    /** Event visibility */
    visibility: EventVisibility;
    /** Event creator */
    creator?: EventParticipant;
    /** Event organizer */
    organizer?: EventParticipant;
    /** Event attendees */
    attendees: EventAttendee[];
    /** Recurrence rule */
    recurrence?: RecurrenceRule;
    /** Parent recurring event ID */
    recurringEventId?: string;
    /** Original start time for recurring event instances */
    originalStartTime?: Date;
    /** Event reminders */
    reminders: EventReminder[];
    /** Meeting/conferencing information */
    conferencing?: ConferencingInfo;
    /** Event attachments */
    attachments: EventAttachment[];
    /** Custom event properties */
    extendedProperties?: Record<string, string>;
    /** Event source (for imported events) */
    source?: EventSource;
    /** Event color (hex) */
    color?: string;
    /** Event transparency (free/busy) */
    transparency: EventTransparency;
    /** iCalendar UID */
    uid: string;
    /** Event sequence number */
    sequence: number;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Event status
 */
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';
/**
 * Event visibility
 */
export type EventVisibility = 'default' | 'public' | 'private' | 'confidential';
/**
 * Event transparency (for free/busy)
 */
export type EventTransparency = 'opaque' | 'transparent';
/**
 * Structured location data
 */
export interface EventLocation {
    /** Display name */
    displayName: string;
    /** Room/resource name */
    room?: string;
    /** Building name */
    building?: string;
    /** Street address */
    address?: string;
    /** City */
    city?: string;
    /** State/region */
    state?: string;
    /** Country */
    country?: string;
    /** Postal code */
    postalCode?: string;
    /** Coordinates */
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    /** Meeting room capacity */
    capacity?: number;
    /** Room features/equipment */
    features?: string[];
}
/**
 * Event participant base interface
 */
export interface EventParticipant {
    /** Participant email */
    email: string;
    /** Participant display name */
    displayName?: string;
    /** Whether this is the current user */
    self?: boolean;
}
/**
 * Event attendee with response status
 */
export interface EventAttendee extends EventParticipant {
    /** Attendee response status */
    responseStatus: AttendeeResponseStatus;
    /** Whether attendee is optional */
    optional: boolean;
    /** Whether attendee is a resource (room, equipment) */
    isResource: boolean;
    /** Additional attendee emails (for delegates) */
    additionalEmails?: string[];
    /** Comments from attendee */
    comment?: string;
}
/**
 * Attendee response status
 */
export type AttendeeResponseStatus = 'needsAction' | 'declined' | 'tentative' | 'accepted';
/**
 * Recurrence rule for repeating events
 */
export interface RecurrenceRule {
    /** Recurrence frequency */
    frequency: RecurrenceFrequency;
    /** Interval between recurrences */
    interval: number;
    /** Days of week (for weekly/monthly) */
    byWeekDay?: WeekDay[];
    /** Days of month (1-31) */
    byMonthDay?: number[];
    /** Months of year (1-12) */
    byMonth?: number[];
    /** Week numbers of year */
    byWeekNumber?: number[];
    /** Day of year (1-365/366) */
    byYearDay?: number[];
    /** Hour of day (0-23) */
    byHour?: number[];
    /** Minute of hour (0-59) */
    byMinute?: number[];
    /** Recurrence count limit */
    count?: number;
    /** Recurrence end date */
    until?: Date;
    /** Start day of week (for weekly recurrence) */
    weekStart?: WeekDay;
    /** Original RRULE string */
    rrule: string;
}
/**
 * Recurrence frequency
 */
export type RecurrenceFrequency = 'SECONDLY' | 'MINUTELY' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
/**
 * Week day enumeration
 */
export type WeekDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';
/**
 * Event reminder
 */
export interface EventReminder {
    /** Reminder method */
    method: ReminderMethod;
    /** Minutes before event to trigger reminder */
    minutesBefore: number;
}
/**
 * Reminder methods
 */
export type ReminderMethod = 'email' | 'popup' | 'sms' | 'sound';
/**
 * Conferencing/meeting information
 */
export interface ConferencingInfo {
    /** Conferencing solution */
    solution: ConferencingSolution;
    /** Meeting ID */
    meetingId?: string;
    /** Join URL */
    joinUrl?: string;
    /** Phone numbers for dial-in */
    phoneNumbers?: ConferencePhoneNumber[];
    /** Meeting passcode */
    passcode?: string;
    /** Additional meeting details */
    notes?: string;
    /** Meeting room/resource */
    room?: string;
}
/**
 * Conferencing solutions
 */
export type ConferencingSolution = 'zoom' | 'meet' | 'teams' | 'webex' | 'gotomeeting' | 'hangout' | 'skype' | 'custom';
/**
 * Conference phone number
 */
export interface ConferencePhoneNumber {
    /** Country code */
    country: string;
    /** Phone number */
    number: string;
    /** PIN if required */
    pin?: string;
}
/**
 * Event attachment
 */
export interface EventAttachment {
    /** Attachment ID */
    id: string;
    /** Attachment title */
    title: string;
    /** File URL */
    fileUrl?: string;
    /** File ID (for Google Drive, etc.) */
    fileId?: string;
    /** MIME type */
    mimeType?: string;
    /** Icon URL */
    iconUrl?: string;
    /** File size in bytes */
    size?: number;
}
/**
 * Event source information
 */
export interface EventSource {
    /** Source title */
    title: string;
    /** Source URL */
    url?: string;
}
/**
 * Free/busy time slot
 */
export interface FreeBusySlot {
    /** Start time */
    start: Date;
    /** End time */
    end: Date;
    /** Busy status */
    status: FreeBusyStatus;
}
/**
 * Free/busy status
 */
export type FreeBusyStatus = 'free' | 'busy' | 'tentative' | 'outOfOffice';
/**
 * Free/busy query
 */
export interface FreeBusyQuery {
    /** Email addresses to query */
    emails: string[];
    /** Start time for query */
    timeMin: Date;
    /** End time for query */
    timeMax: Date;
    /** Timezone for results */
    timezone?: string;
}
/**
 * Free/busy response
 */
export interface FreeBusyResponse {
    /** Time range of query */
    timeMin: Date;
    timeMax: Date;
    /** Free/busy data by email */
    freeBusy: Record<string, FreeBusySlot[]>;
    /** Query errors by email */
    errors?: Record<string, string>;
}
/**
 * Calendar sync status
 */
export interface CalendarSyncStatus {
    /** Account ID */
    accountId: string;
    /** Overall sync status */
    status: 'idle' | 'syncing' | 'error' | 'paused';
    /** Last successful sync */
    lastSyncAt?: Date;
    /** Current sync operation */
    currentOperation?: {
        type: 'full_sync' | 'incremental_sync' | 'calendar_sync';
        calendarId?: string;
        progress: number;
        startedAt: Date;
    };
    /** Sync statistics */
    stats: {
        totalEvents: number;
        newEvents: number;
        updatedEvents: number;
        deletedEvents: number;
        syncErrors: number;
    };
    /** Last sync error */
    lastError?: {
        message: string;
        code: string;
        timestamp: Date;
        details?: Record<string, any>;
    };
}
/**
 * Calendar privacy sync configuration (from Blueprint.md)
 */
export interface CalendarPrivacySync {
    /** Unique identifier */
    id: string;
    /** User ID */
    userId: string;
    /** Rule name */
    name: string;
    /** Whether rule is enabled */
    isEnabled: boolean;
    /** Source calendars */
    sourceCalendarIds: string[];
    /** Target calendars */
    targetCalendarIds: string[];
    /** Privacy settings */
    privacySettings: {
        /** Default title for copied events */
        defaultTitle: string;
        /** Title template with allowed tokens */
        titleTemplate?: string;
        /** Strip description */
        stripDescription: boolean;
        /** Strip location */
        stripLocation: boolean;
        /** Strip attendees */
        stripAttendees: boolean;
        /** Strip attachments */
        stripAttachments: boolean;
        /** Visibility setting for copied events */
        visibility: EventVisibility;
    };
    /** Sync filters */
    filters?: {
        /** Only sync work hours */
        workHoursOnly: boolean;
        /** Exclude all-day events */
        excludeAllDay: boolean;
        /** Minimum duration in minutes */
        minDurationMinutes?: number;
        /** Only specific event colors */
        includeColors?: string[];
        /** Exclude specific event colors */
        excludeColors?: string[];
    };
    /** Sync window */
    window: {
        /** Days in the past to sync */
        pastDays: number;
        /** Days in the future to sync */
        futureDays: number;
    };
    /** Whether bidirectional sync is enabled */
    isBidirectional: boolean;
    /** Advanced mode (confirm each event) */
    advancedMode: boolean;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Meeting proposal for scheduling
 */
export interface MeetingProposal {
    /** Proposal ID */
    id: string;
    /** Proposal title */
    title: string;
    /** Meeting organizer */
    organizer: EventParticipant;
    /** Proposed attendees */
    attendees: EventParticipant[];
    /** Meeting duration in minutes */
    durationMinutes: number;
    /** Proposed time slots */
    proposedTimes: Date[];
    /** Meeting location */
    location?: string;
    /** Meeting description */
    description?: string;
    /** Attendee responses */
    responses: Record<string, {
        availableTimes: Date[];
        preferredTimes?: Date[];
        unavailableTimes?: Date[];
        comment?: string;
    }>;
    /** Proposal status */
    status: 'pending' | 'scheduled' | 'cancelled';
    /** Final scheduled time */
    scheduledTime?: Date;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
export declare const EventParticipantSchema: z.ZodObject<{
    email: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
    self: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    displayName?: string | undefined;
    self?: boolean | undefined;
}, {
    email: string;
    displayName?: string | undefined;
    self?: boolean | undefined;
}>;
export declare const EventAttendeeSchema: z.ZodObject<{
    email: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
    self: z.ZodOptional<z.ZodBoolean>;
} & {
    responseStatus: z.ZodEnum<["needsAction", "declined", "tentative", "accepted"]>;
    optional: z.ZodBoolean;
    isResource: z.ZodBoolean;
    additionalEmails: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    responseStatus: "accepted" | "declined" | "needsAction" | "tentative";
    optional: boolean;
    isResource: boolean;
    displayName?: string | undefined;
    self?: boolean | undefined;
    additionalEmails?: string[] | undefined;
    comment?: string | undefined;
}, {
    email: string;
    responseStatus: "accepted" | "declined" | "needsAction" | "tentative";
    optional: boolean;
    isResource: boolean;
    displayName?: string | undefined;
    self?: boolean | undefined;
    additionalEmails?: string[] | undefined;
    comment?: string | undefined;
}>;
export declare const RecurrenceRuleSchema: z.ZodObject<{
    frequency: z.ZodEnum<["SECONDLY", "MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]>;
    interval: z.ZodNumber;
    byWeekDay: z.ZodOptional<z.ZodArray<z.ZodEnum<["MO", "TU", "WE", "TH", "FR", "SA", "SU"]>, "many">>;
    byMonthDay: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    byMonth: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    byWeekNumber: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    byYearDay: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    byHour: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    byMinute: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    count: z.ZodOptional<z.ZodNumber>;
    until: z.ZodOptional<z.ZodDate>;
    weekStart: z.ZodOptional<z.ZodEnum<["MO", "TU", "WE", "TH", "FR", "SA", "SU"]>>;
    rrule: z.ZodString;
}, "strip", z.ZodTypeAny, {
    frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
    interval: number;
    rrule: string;
    byWeekDay?: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] | undefined;
    byMonthDay?: number[] | undefined;
    byMonth?: number[] | undefined;
    byWeekNumber?: number[] | undefined;
    byYearDay?: number[] | undefined;
    byHour?: number[] | undefined;
    byMinute?: number[] | undefined;
    count?: number | undefined;
    until?: Date | undefined;
    weekStart?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU" | undefined;
}, {
    frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
    interval: number;
    rrule: string;
    byWeekDay?: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] | undefined;
    byMonthDay?: number[] | undefined;
    byMonth?: number[] | undefined;
    byWeekNumber?: number[] | undefined;
    byYearDay?: number[] | undefined;
    byHour?: number[] | undefined;
    byMinute?: number[] | undefined;
    count?: number | undefined;
    until?: Date | undefined;
    weekStart?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU" | undefined;
}>;
export declare const CalendarEventSchema: z.ZodObject<{
    id: z.ZodString;
    calendarId: z.ZodString;
    providerId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    locationData: z.ZodOptional<z.ZodObject<{
        displayName: z.ZodString;
        room: z.ZodOptional<z.ZodString>;
        building: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
        postalCode: z.ZodOptional<z.ZodString>;
        coordinates: z.ZodOptional<z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
        }, {
            latitude: number;
            longitude: number;
        }>>;
        capacity: z.ZodOptional<z.ZodNumber>;
        features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        displayName: string;
        state?: string | undefined;
        address?: string | undefined;
        room?: string | undefined;
        building?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        postalCode?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
        capacity?: number | undefined;
        features?: string[] | undefined;
    }, {
        displayName: string;
        state?: string | undefined;
        address?: string | undefined;
        room?: string | undefined;
        building?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        postalCode?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
        capacity?: number | undefined;
        features?: string[] | undefined;
    }>>;
    startTime: z.ZodDate;
    endTime: z.ZodDate;
    timezone: z.ZodOptional<z.ZodString>;
    isAllDay: z.ZodBoolean;
    status: z.ZodEnum<["confirmed", "tentative", "cancelled"]>;
    visibility: z.ZodEnum<["default", "public", "private", "confidential"]>;
    creator: z.ZodOptional<z.ZodObject<{
        email: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        self: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    }, {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    }>>;
    organizer: z.ZodOptional<z.ZodObject<{
        email: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        self: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    }, {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    }>>;
    attendees: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        self: z.ZodOptional<z.ZodBoolean>;
    } & {
        responseStatus: z.ZodEnum<["needsAction", "declined", "tentative", "accepted"]>;
        optional: z.ZodBoolean;
        isResource: z.ZodBoolean;
        additionalEmails: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        comment: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        responseStatus: "accepted" | "declined" | "needsAction" | "tentative";
        optional: boolean;
        isResource: boolean;
        displayName?: string | undefined;
        self?: boolean | undefined;
        additionalEmails?: string[] | undefined;
        comment?: string | undefined;
    }, {
        email: string;
        responseStatus: "accepted" | "declined" | "needsAction" | "tentative";
        optional: boolean;
        isResource: boolean;
        displayName?: string | undefined;
        self?: boolean | undefined;
        additionalEmails?: string[] | undefined;
        comment?: string | undefined;
    }>, "many">;
    recurrence: z.ZodOptional<z.ZodObject<{
        frequency: z.ZodEnum<["SECONDLY", "MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]>;
        interval: z.ZodNumber;
        byWeekDay: z.ZodOptional<z.ZodArray<z.ZodEnum<["MO", "TU", "WE", "TH", "FR", "SA", "SU"]>, "many">>;
        byMonthDay: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        byMonth: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        byWeekNumber: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        byYearDay: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        byHour: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        byMinute: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        count: z.ZodOptional<z.ZodNumber>;
        until: z.ZodOptional<z.ZodDate>;
        weekStart: z.ZodOptional<z.ZodEnum<["MO", "TU", "WE", "TH", "FR", "SA", "SU"]>>;
        rrule: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        rrule: string;
        byWeekDay?: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] | undefined;
        byMonthDay?: number[] | undefined;
        byMonth?: number[] | undefined;
        byWeekNumber?: number[] | undefined;
        byYearDay?: number[] | undefined;
        byHour?: number[] | undefined;
        byMinute?: number[] | undefined;
        count?: number | undefined;
        until?: Date | undefined;
        weekStart?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU" | undefined;
    }, {
        frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        rrule: string;
        byWeekDay?: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] | undefined;
        byMonthDay?: number[] | undefined;
        byMonth?: number[] | undefined;
        byWeekNumber?: number[] | undefined;
        byYearDay?: number[] | undefined;
        byHour?: number[] | undefined;
        byMinute?: number[] | undefined;
        count?: number | undefined;
        until?: Date | undefined;
        weekStart?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU" | undefined;
    }>>;
    recurringEventId: z.ZodOptional<z.ZodString>;
    originalStartTime: z.ZodOptional<z.ZodDate>;
    reminders: z.ZodArray<z.ZodObject<{
        method: z.ZodEnum<["email", "popup", "sms", "sound"]>;
        minutesBefore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        method: "email" | "popup" | "sms" | "sound";
        minutesBefore: number;
    }, {
        method: "email" | "popup" | "sms" | "sound";
        minutesBefore: number;
    }>, "many">;
    conferencing: z.ZodOptional<z.ZodObject<{
        solution: z.ZodEnum<["zoom", "meet", "teams", "webex", "gotomeeting", "hangout", "skype", "custom"]>;
        meetingId: z.ZodOptional<z.ZodString>;
        joinUrl: z.ZodOptional<z.ZodString>;
        phoneNumbers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            country: z.ZodString;
            number: z.ZodString;
            pin: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            number: string;
            country: string;
            pin?: string | undefined;
        }, {
            number: string;
            country: string;
            pin?: string | undefined;
        }>, "many">>;
        passcode: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
        room: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        solution: "custom" | "zoom" | "meet" | "teams" | "webex" | "gotomeeting" | "hangout" | "skype";
        notes?: string | undefined;
        room?: string | undefined;
        meetingId?: string | undefined;
        joinUrl?: string | undefined;
        phoneNumbers?: {
            number: string;
            country: string;
            pin?: string | undefined;
        }[] | undefined;
        passcode?: string | undefined;
    }, {
        solution: "custom" | "zoom" | "meet" | "teams" | "webex" | "gotomeeting" | "hangout" | "skype";
        notes?: string | undefined;
        room?: string | undefined;
        meetingId?: string | undefined;
        joinUrl?: string | undefined;
        phoneNumbers?: {
            number: string;
            country: string;
            pin?: string | undefined;
        }[] | undefined;
        passcode?: string | undefined;
    }>>;
    attachments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        fileUrl: z.ZodOptional<z.ZodString>;
        fileId: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        iconUrl: z.ZodOptional<z.ZodString>;
        size: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        size?: number | undefined;
        mimeType?: string | undefined;
        fileUrl?: string | undefined;
        fileId?: string | undefined;
        iconUrl?: string | undefined;
    }, {
        id: string;
        title: string;
        size?: number | undefined;
        mimeType?: string | undefined;
        fileUrl?: string | undefined;
        fileId?: string | undefined;
        iconUrl?: string | undefined;
    }>, "many">;
    extendedProperties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    source: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        url?: string | undefined;
    }, {
        title: string;
        url?: string | undefined;
    }>>;
    color: z.ZodOptional<z.ZodString>;
    transparency: z.ZodEnum<["opaque", "transparent"]>;
    uid: z.ZodString;
    sequence: z.ZodNumber;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    status: "cancelled" | "tentative" | "confirmed";
    providerId: string;
    attachments: {
        id: string;
        title: string;
        size?: number | undefined;
        mimeType?: string | undefined;
        fileUrl?: string | undefined;
        fileId?: string | undefined;
        iconUrl?: string | undefined;
    }[];
    calendarId: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    visibility: "default" | "public" | "private" | "confidential";
    attendees: {
        email: string;
        responseStatus: "accepted" | "declined" | "needsAction" | "tentative";
        optional: boolean;
        isResource: boolean;
        displayName?: string | undefined;
        self?: boolean | undefined;
        additionalEmails?: string[] | undefined;
        comment?: string | undefined;
    }[];
    reminders: {
        method: "email" | "popup" | "sms" | "sound";
        minutesBefore: number;
    }[];
    transparency: "opaque" | "transparent";
    uid: string;
    sequence: number;
    timezone?: string | undefined;
    color?: string | undefined;
    description?: string | undefined;
    location?: string | undefined;
    locationData?: {
        displayName: string;
        state?: string | undefined;
        address?: string | undefined;
        room?: string | undefined;
        building?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        postalCode?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
        capacity?: number | undefined;
        features?: string[] | undefined;
    } | undefined;
    creator?: {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    } | undefined;
    organizer?: {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    } | undefined;
    recurrence?: {
        frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        rrule: string;
        byWeekDay?: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] | undefined;
        byMonthDay?: number[] | undefined;
        byMonth?: number[] | undefined;
        byWeekNumber?: number[] | undefined;
        byYearDay?: number[] | undefined;
        byHour?: number[] | undefined;
        byMinute?: number[] | undefined;
        count?: number | undefined;
        until?: Date | undefined;
        weekStart?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU" | undefined;
    } | undefined;
    recurringEventId?: string | undefined;
    originalStartTime?: Date | undefined;
    conferencing?: {
        solution: "custom" | "zoom" | "meet" | "teams" | "webex" | "gotomeeting" | "hangout" | "skype";
        notes?: string | undefined;
        room?: string | undefined;
        meetingId?: string | undefined;
        joinUrl?: string | undefined;
        phoneNumbers?: {
            number: string;
            country: string;
            pin?: string | undefined;
        }[] | undefined;
        passcode?: string | undefined;
    } | undefined;
    extendedProperties?: Record<string, string> | undefined;
    source?: {
        title: string;
        url?: string | undefined;
    } | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    status: "cancelled" | "tentative" | "confirmed";
    providerId: string;
    attachments: {
        id: string;
        title: string;
        size?: number | undefined;
        mimeType?: string | undefined;
        fileUrl?: string | undefined;
        fileId?: string | undefined;
        iconUrl?: string | undefined;
    }[];
    calendarId: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    visibility: "default" | "public" | "private" | "confidential";
    attendees: {
        email: string;
        responseStatus: "accepted" | "declined" | "needsAction" | "tentative";
        optional: boolean;
        isResource: boolean;
        displayName?: string | undefined;
        self?: boolean | undefined;
        additionalEmails?: string[] | undefined;
        comment?: string | undefined;
    }[];
    reminders: {
        method: "email" | "popup" | "sms" | "sound";
        minutesBefore: number;
    }[];
    transparency: "opaque" | "transparent";
    uid: string;
    sequence: number;
    timezone?: string | undefined;
    color?: string | undefined;
    description?: string | undefined;
    location?: string | undefined;
    locationData?: {
        displayName: string;
        state?: string | undefined;
        address?: string | undefined;
        room?: string | undefined;
        building?: string | undefined;
        city?: string | undefined;
        country?: string | undefined;
        postalCode?: string | undefined;
        coordinates?: {
            latitude: number;
            longitude: number;
        } | undefined;
        capacity?: number | undefined;
        features?: string[] | undefined;
    } | undefined;
    creator?: {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    } | undefined;
    organizer?: {
        email: string;
        displayName?: string | undefined;
        self?: boolean | undefined;
    } | undefined;
    recurrence?: {
        frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval: number;
        rrule: string;
        byWeekDay?: ("MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU")[] | undefined;
        byMonthDay?: number[] | undefined;
        byMonth?: number[] | undefined;
        byWeekNumber?: number[] | undefined;
        byYearDay?: number[] | undefined;
        byHour?: number[] | undefined;
        byMinute?: number[] | undefined;
        count?: number | undefined;
        until?: Date | undefined;
        weekStart?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU" | undefined;
    } | undefined;
    recurringEventId?: string | undefined;
    originalStartTime?: Date | undefined;
    conferencing?: {
        solution: "custom" | "zoom" | "meet" | "teams" | "webex" | "gotomeeting" | "hangout" | "skype";
        notes?: string | undefined;
        room?: string | undefined;
        meetingId?: string | undefined;
        joinUrl?: string | undefined;
        phoneNumbers?: {
            number: string;
            country: string;
            pin?: string | undefined;
        }[] | undefined;
        passcode?: string | undefined;
    } | undefined;
    extendedProperties?: Record<string, string> | undefined;
    source?: {
        title: string;
        url?: string | undefined;
    } | undefined;
}>;
export declare const CalendarAccountSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    provider: z.ZodEnum<["google", "outlook", "exchange", "caldav", "icloud", "fastmail"]>;
    config: z.ZodAny;
    credentials: z.ZodOptional<z.ZodObject<{
        accessToken: z.ZodOptional<z.ZodString>;
        refreshToken: z.ZodOptional<z.ZodString>;
        tokenExpiresAt: z.ZodOptional<z.ZodDate>;
        password: z.ZodOptional<z.ZodString>;
        additionalTokens: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        password?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        additionalTokens?: Record<string, string> | undefined;
    }, {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        password?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        additionalTokens?: Record<string, string> | undefined;
    }>>;
    status: z.ZodEnum<["active", "auth_error", "quota_exceeded", "suspended", "disabled", "error"]>;
    defaultCalendarId: z.ZodOptional<z.ZodString>;
    lastSyncAt: z.ZodOptional<z.ZodDate>;
    nextSyncAt: z.ZodOptional<z.ZodDate>;
    syncIntervalMinutes: z.ZodNumber;
    isEnabled: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    provider: "outlook" | "icloud" | "google" | "fastmail" | "exchange" | "caldav";
    isEnabled: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "active" | "auth_error" | "quota_exceeded" | "suspended" | "disabled";
    userId: string;
    syncIntervalMinutes: number;
    config?: any;
    credentials?: {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        password?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        additionalTokens?: Record<string, string> | undefined;
    } | undefined;
    lastSyncAt?: Date | undefined;
    nextSyncAt?: Date | undefined;
    defaultCalendarId?: string | undefined;
}, {
    id: string;
    email: string;
    provider: "outlook" | "icloud" | "google" | "fastmail" | "exchange" | "caldav";
    isEnabled: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    status: "error" | "active" | "auth_error" | "quota_exceeded" | "suspended" | "disabled";
    userId: string;
    syncIntervalMinutes: number;
    config?: any;
    credentials?: {
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
        password?: string | undefined;
        tokenExpiresAt?: Date | undefined;
        additionalTokens?: Record<string, string> | undefined;
    } | undefined;
    lastSyncAt?: Date | undefined;
    nextSyncAt?: Date | undefined;
    defaultCalendarId?: string | undefined;
}>;
/**
 * Utility types for calendar operations
 */
export type CreateCalendarAccountInput = Omit<CalendarAccount, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncAt' | 'nextSyncAt'>;
export type UpdateCalendarAccountInput = Partial<Pick<CalendarAccount, 'name' | 'config' | 'defaultCalendarId' | 'syncIntervalMinutes' | 'isEnabled'>>;
export type CreateCalendarEventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'sequence'>;
export type UpdateCalendarEventInput = Partial<Pick<CalendarEvent, 'title' | 'description' | 'location' | 'locationData' | 'startTime' | 'endTime' | 'timezone' | 'isAllDay' | 'status' | 'visibility' | 'attendees' | 'recurrence' | 'reminders' | 'conferencing' | 'attachments' | 'color' | 'transparency'>>;
export type CreateCalendarPrivacySyncInput = Omit<CalendarPrivacySync, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCalendarPrivacySyncInput = Partial<Pick<CalendarPrivacySync, 'name' | 'isEnabled' | 'sourceCalendarIds' | 'targetCalendarIds' | 'privacySettings' | 'filters' | 'window' | 'isBidirectional' | 'advancedMode'>>;
/**
 * Calendar search result
 */
export interface CalendarSearchResult {
    /** Search query */
    query: string;
    /** Total number of results */
    totalCount: number;
    /** Current page results */
    events: CalendarEvent[];
    /** Search took this many milliseconds */
    took: number;
    /** Date range covered */
    dateRange: {
        start: Date;
        end: Date;
    };
    /** Faceted search results */
    facets?: {
        calendars: Record<string, number>;
        attendees: Record<string, number>;
        locations: Record<string, number>;
    };
}
/**
 * Bulk event operation types
 */
export interface BulkEventOperation {
    /** Operation type */
    type: 'delete' | 'move' | 'update_status' | 'add_attendees' | 'remove_attendees';
    /** Event IDs to operate on */
    eventIds: string[];
    /** Operation parameters */
    params?: Record<string, any>;
}
export interface BulkEventOperationResult {
    /** Number of successful operations */
    successful: number;
    /** Number of failed operations */
    failed: number;
    /** Failed event IDs with errors */
    errors: Array<{
        eventId: string;
        error: string;
    }>;
}
/**
 * Calendar metrics for analytics and monitoring
 */
export interface CalendarMetrics {
    /** Total events across all accounts */
    totalEvents: number;
    /** Events by provider */
    eventsByProvider: Record<CalendarProvider, number>;
    /** Active accounts by provider */
    activeAccountsByProvider: Record<CalendarProvider, number>;
    /** Sync operations in last 24 hours */
    syncOperations24h: number;
    /** Privacy sync operations in last 24 hours */
    privacySyncOperations24h: number;
    /** Average sync duration in milliseconds */
    avgSyncDurationMs: number;
    /** Error rate (errors per 100 operations) */
    errorRatePercent: number;
    /** Webhook deliveries in last 24 hours */
    webhookDeliveries24h: number;
}
//# sourceMappingURL=calendar.d.ts.map