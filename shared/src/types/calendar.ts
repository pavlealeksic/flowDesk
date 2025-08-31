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
export type CalendarProvider = 
  | 'google'          // Google Calendar
  | 'outlook'         // Microsoft 365/Graph
  | 'exchange'        // Exchange Web Services
  | 'caldav'          // CalDAV (generic)
  | 'icloud'          // iCloud Calendar (CalDAV)
  | 'fastmail';       // Fastmail Calendar (CalDAV)

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
export type CalendarAccountStatus = 
  | 'active'          // Account is working normally
  | 'auth_error'      // Authentication failed, needs re-auth
  | 'quota_exceeded'  // API quota exceeded
  | 'suspended'       // Account suspended by provider
  | 'disabled'        // Manually disabled by user
  | 'error';          // General error state

/**
 * Provider-specific account configuration
 */
export type CalendarAccountConfig = 
  | GoogleCalendarConfig
  | OutlookCalendarConfig
  | ExchangeCalendarConfig
  | CalDavConfig;

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
    password?: string; // Encrypted
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
export type CalendarAccessLevel = 
  | 'owner'           // Full control
  | 'writer'          // Can create/edit events
  | 'reader'          // Read-only access
  | 'freeBusyReader'; // Can only see free/busy times

/**
 * Calendar types
 */
export type CalendarType = 
  | 'primary'         // User's main calendar
  | 'secondary'       // Additional calendars
  | 'shared'          // Shared by others
  | 'public'          // Public calendars
  | 'resource'        // Room/resource calendars
  | 'holiday'         // Holiday calendars
  | 'birthdays';      // Birthdays calendar

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
export type EventStatus = 
  | 'confirmed'       // Event is confirmed
  | 'tentative'       // Event is tentative
  | 'cancelled';      // Event is cancelled

/**
 * Event visibility
 */
export type EventVisibility = 
  | 'default'         // Default visibility (usually public)
  | 'public'          // Publicly visible
  | 'private'         // Private to owner
  | 'confidential';   // Confidential

/**
 * Event transparency (for free/busy)
 */
export type EventTransparency = 
  | 'opaque'          // Blocks time (busy)
  | 'transparent';    // Doesn't block time (free)

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
export type AttendeeResponseStatus = 
  | 'needsAction'     // No response yet
  | 'declined'        // Declined invitation
  | 'tentative'       // Tentatively accepted
  | 'accepted';       // Accepted invitation

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
export type RecurrenceFrequency = 
  | 'SECONDLY'
  | 'MINUTELY'
  | 'HOURLY'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY';

/**
 * Week day enumeration
 */
export type WeekDay = 
  | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

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
export type ReminderMethod = 
  | 'email'           // Email reminder
  | 'popup'           // Desktop notification
  | 'sms'             // SMS reminder (if supported)
  | 'sound';          // Audio alert

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
export type ConferencingSolution = 
  | 'zoom'            // Zoom
  | 'meet'            // Google Meet
  | 'teams'           // Microsoft Teams
  | 'webex'           // Cisco Webex
  | 'gotomeeting'     // GoToMeeting
  | 'hangout'         // Google Hangouts (legacy)
  | 'skype'           // Skype
  | 'custom';         // Custom/other

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
export type FreeBusyStatus = 
  | 'free'            // Available
  | 'busy'            // Busy
  | 'tentative'       // Tentatively busy
  | 'outOfOffice';    // Out of office

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
    progress: number; // 0-100
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

// Zod schemas for runtime validation
export const EventParticipantSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  self: z.boolean().optional()
});

export const EventAttendeeSchema = EventParticipantSchema.extend({
  responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']),
  optional: z.boolean(),
  isResource: z.boolean(),
  additionalEmails: z.array(z.string().email()).optional(),
  comment: z.string().optional()
});

export const RecurrenceRuleSchema = z.object({
  frequency: z.enum(['SECONDLY', 'MINUTELY', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().positive(),
  byWeekDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
  byMonthDay: z.array(z.number().min(1).max(31)).optional(),
  byMonth: z.array(z.number().min(1).max(12)).optional(),
  byWeekNumber: z.array(z.number()).optional(),
  byYearDay: z.array(z.number().min(1).max(366)).optional(),
  byHour: z.array(z.number().min(0).max(23)).optional(),
  byMinute: z.array(z.number().min(0).max(59)).optional(),
  count: z.number().positive().optional(),
  until: z.date().optional(),
  weekStart: z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']).optional(),
  rrule: z.string()
});

export const CalendarEventSchema = z.object({
  id: z.string(),
  calendarId: z.string(),
  providerId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  locationData: z.object({
    displayName: z.string(),
    room: z.string().optional(),
    building: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    }).optional(),
    capacity: z.number().optional(),
    features: z.array(z.string()).optional()
  }).optional(),
  startTime: z.date(),
  endTime: z.date(),
  timezone: z.string().optional(),
  isAllDay: z.boolean(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']),
  visibility: z.enum(['default', 'public', 'private', 'confidential']),
  creator: EventParticipantSchema.optional(),
  organizer: EventParticipantSchema.optional(),
  attendees: z.array(EventAttendeeSchema),
  recurrence: RecurrenceRuleSchema.optional(),
  recurringEventId: z.string().optional(),
  originalStartTime: z.date().optional(),
  reminders: z.array(z.object({
    method: z.enum(['email', 'popup', 'sms', 'sound']),
    minutesBefore: z.number().nonnegative()
  })),
  conferencing: z.object({
    solution: z.enum(['zoom', 'meet', 'teams', 'webex', 'gotomeeting', 'hangout', 'skype', 'custom']),
    meetingId: z.string().optional(),
    joinUrl: z.string().url().optional(),
    phoneNumbers: z.array(z.object({
      country: z.string(),
      number: z.string(),
      pin: z.string().optional()
    })).optional(),
    passcode: z.string().optional(),
    notes: z.string().optional(),
    room: z.string().optional()
  }).optional(),
  attachments: z.array(z.object({
    id: z.string(),
    title: z.string(),
    fileUrl: z.string().url().optional(),
    fileId: z.string().optional(),
    mimeType: z.string().optional(),
    iconUrl: z.string().url().optional(),
    size: z.number().optional()
  })),
  extendedProperties: z.record(z.string()).optional(),
  source: z.object({
    title: z.string(),
    url: z.string().url().optional()
  }).optional(),
  color: z.string().optional(),
  transparency: z.enum(['opaque', 'transparent']),
  uid: z.string(),
  sequence: z.number(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const CalendarAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  provider: z.enum(['google', 'outlook', 'exchange', 'caldav', 'icloud', 'fastmail']),
  config: z.any(), // Union type too complex for Zod
  credentials: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    tokenExpiresAt: z.date().optional(),
    password: z.string().optional(),
    additionalTokens: z.record(z.string()).optional()
  }).optional(),
  status: z.enum(['active', 'auth_error', 'quota_exceeded', 'suspended', 'disabled', 'error']),
  defaultCalendarId: z.string().optional(),
  lastSyncAt: z.date().optional(),
  nextSyncAt: z.date().optional(),
  syncIntervalMinutes: z.number().positive(),
  isEnabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

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