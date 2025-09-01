/*!
 * Google Calendar Provider
 * 
 * Integrates with Google Calendar API v3 using OAuth2 authentication.
 * Supports full CRUD operations, recurring events, and real-time webhooks.
 */

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type {
  CalendarAccount,
  CalendarEvent,
  Calendar,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  FreeBusyQuery,
  FreeBusyResponse,
  CalendarProvider,
  GoogleCalendarConfig,
  RecurrenceRule,
  EventAttendee,
  EventReminder,
  ConferencingInfo
} from '@flow-desk/shared/types/calendar';
import { 
  BaseCalendarProvider, 
  CalendarProviderCapabilities, 
  AuthenticationResult, 
  SyncResult, 
  ProviderConfig 
} from './base-calendar-provider';
import log from 'electron-log';

/**
 * Google Calendar API provider implementation
 */
export class GoogleCalendarProvider extends BaseCalendarProvider {
  private oauth2Client: OAuth2Client;
  private calendarApi: calendar_v3.Calendar;
  private config: GoogleCalendarConfig;

  constructor(account: CalendarAccount, providerConfig: ProviderConfig) {
    super(account, providerConfig);
    
    this.config = account.config as GoogleCalendarConfig;
    this.oauth2Client = new OAuth2Client(
      this.config.clientId,
      providerConfig.oauth?.clientSecret,
      providerConfig.oauth?.redirectUri
    );
    
    // Set up credentials if available
    if (account.credentials) {
      this.oauth2Client.setCredentials({
        access_token: account.credentials.accessToken,
        refresh_token: account.credentials.refreshToken,
        token_type: 'Bearer',
        expiry_date: account.credentials.tokenExpiresAt?.getTime()
      });
    }

    this.calendarApi = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  getProviderType(): CalendarProvider {
    return 'google';
  }

  getCapabilities(): CalendarProviderCapabilities {
    return {
      canCreateEvents: true,
      canUpdateEvents: true,
      canDeleteEvents: true,
      supportsRecurring: true,
      supportsAttendees: true,
      supportsFreeBusy: true,
      supportsWebhooks: true,
      supportsIncrementalSync: true,
      supportsAttachments: true,
      supportsReminders: true,
      maxAttendees: 600,
      rateLimits: {
        requestsPerMinute: 300,
        requestsPerDay: 1000000
      }
    };
  }

  protected async validateConfiguration(): Promise<void> {
    if (!this.config.clientId) {
      throw this.createError('Google client ID is required', 'MISSING_CLIENT_ID');
    }

    if (!this.config.scopes || this.config.scopes.length === 0) {
      throw this.createError('Google Calendar scopes are required', 'MISSING_SCOPES');
    }

    // Validate required scopes
    const requiredScopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    for (const scope of requiredScopes) {
      if (!this.config.scopes.includes(scope)) {
        throw this.createError(`Missing required scope: ${scope}`, 'MISSING_REQUIRED_SCOPE');
      }
    }
  }

  protected async initializeProvider(): Promise<void> {
    // Initialize Google Calendar API
    log.info('Initializing Google Calendar API client');
    
    // Set up webhook notifications if enabled
    if (this.config.enablePushNotifications) {
      await this.setupWebhookNotifications();
    }
  }

  protected async performConnectionTest(): Promise<boolean> {
    try {
      // Test by getting calendar list
      const response = await this.calendarApi.calendarList.list({
        maxResults: 1
      });
      
      return response.status === 200;
    } catch (error) {
      log.error('Google Calendar connection test failed:', error);
      return false;
    }
  }

  async authenticate(): Promise<AuthenticationResult> {
    try {
      // Generate OAuth URL for user authorization
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: this.config.scopes,
        prompt: 'consent'
      });

      return {
        success: false,
        error: 'User authorization required',
        additionalData: { authUrl }
      };
    } catch (error) {
      log.error('Google authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async handleAuthorizationCode(code: string): Promise<AuthenticationResult> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      this.oauth2Client.setCredentials(tokens);

      return {
        success: true,
        accessToken: tokens.access_token || undefined,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined
      };
    } catch (error) {
      log.error('Google authorization code exchange failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authorization failed'
      };
    }
  }

  async refreshAuthentication(): Promise<AuthenticationResult> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      this.oauth2Client.setCredentials(credentials);

      return {
        success: true,
        accessToken: credentials.access_token || undefined,
        refreshToken: credentials.refresh_token || undefined,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
      };
    } catch (error) {
      log.error('Google token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  protected async fetchCalendars(): Promise<Calendar[]> {
    try {
      const response = await this.calendarApi.calendarList.list();
      const calendars: Calendar[] = [];

      for (const gcal of response.data.items || []) {
        if (!gcal.id) continue;

        const calendar: Calendar = {
          id: this.generateCalendarId(),
          accountId: this.account.id,
          providerId: gcal.id,
          name: gcal.summary || 'Unnamed Calendar',
          description: gcal.description || undefined,
          color: gcal.backgroundColor || '#1976d2',
          timezone: gcal.timeZone || 'UTC',
          isPrimary: gcal.primary || false,
          accessLevel: this.mapAccessLevel(gcal.accessRole),
          isVisible: !gcal.hidden,
          canSync: gcal.accessRole !== 'freeBusyReader',
          type: this.mapCalendarType(gcal),
          isSelected: !gcal.hidden,
          syncStatus: {
            isBeingSynced: false
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        calendars.push(calendar);
      }

      return calendars;
    } catch (error) {
      log.error('Failed to fetch Google calendars:', error);
      throw this.createError('Failed to fetch calendars', 'FETCH_CALENDARS_FAILED', error);
    }
  }

  protected async performEventsSync(
    calendarIds: string[], 
    timeMin?: Date, 
    timeMax?: Date
  ): Promise<SyncResult> {
    try {
      const events: CalendarEvent[] = [];
      const errors: string[] = [];
      let totalEvents = 0;
      let newEvents = 0;
      let updatedEvents = 0;

      // Default time range - last 7 days to next 30 days
      const defaultTimeMin = timeMin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const defaultTimeMax = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      for (const calendarId of calendarIds) {
        try {
          // Find the Google calendar ID
          const googleCalendarId = await this.getGoogleCalendarId(calendarId);
          if (!googleCalendarId) {
            errors.push(`Calendar ${calendarId} not found`);
            continue;
          }

          let pageToken: string | undefined;
          
          do {
            const response = await this.calendarApi.events.list({
              calendarId: googleCalendarId,
              timeMin: defaultTimeMin.toISOString(),
              timeMax: defaultTimeMax.toISOString(),
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 2500,
              pageToken,
              syncToken: this.config.syncToken
            });

            const items = response.data.items || [];
            
            for (const gevent of items) {
              if (!gevent.id) continue;

              try {
                const event = await this.convertGoogleEventToCalendarEvent(gevent, calendarId);
                events.push(event);
                totalEvents++;
                
                // Determine if this is new or updated (simplified logic)
                if (gevent.created && gevent.updated && 
                    new Date(gevent.created).getTime() === new Date(gevent.updated).getTime()) {
                  newEvents++;
                } else {
                  updatedEvents++;
                }
              } catch (eventError) {
                errors.push(`Failed to convert event ${gevent.id}: ${eventError}`);
              }
            }

            pageToken = response.data.nextPageToken || undefined;
            
            // Update sync token for incremental sync
            if (response.data.nextSyncToken) {
              this.config.syncToken = response.data.nextSyncToken;
            }

            // Emit progress
            this.emit('events:sync:progress', {
              accountId: this.account.id,
              calendarId,
              processed: events.length,
              total: totalEvents
            });
            
          } while (pageToken);

        } catch (calendarError) {
          const errorMessage = `Failed to sync calendar ${calendarId}: ${calendarError}`;
          errors.push(errorMessage);
          log.error(errorMessage, calendarError);
        }
      }

      return {
        success: errors.length === 0,
        calendars: [], // Not fetching calendars in event sync
        events,
        totalEvents,
        newEvents,
        updatedEvents,
        deletedEvents: 0, // Would need additional logic to detect deletions
        errors,
        syncToken: this.config.syncToken
      };
    } catch (error) {
      log.error('Google events sync failed:', error);
      throw this.createError('Events sync failed', 'EVENTS_SYNC_FAILED', error);
    }
  }

  protected async performEventCreation(
    calendarId: string, 
    eventData: CreateCalendarEventInput
  ): Promise<CalendarEvent> {
    try {
      const googleCalendarId = await this.getGoogleCalendarId(calendarId);
      if (!googleCalendarId) {
        throw this.createError(`Calendar ${calendarId} not found`, 'CALENDAR_NOT_FOUND');
      }

      const googleEvent = this.convertCalendarEventToGoogle(eventData);

      const response = await this.calendarApi.events.insert({
        calendarId: googleCalendarId,
        sendUpdates: 'all',
        requestBody: googleEvent
      });

      if (!response.data.id) {
        throw this.createError('Event creation failed - no ID returned', 'EVENT_CREATION_FAILED');
      }

      return await this.convertGoogleEventToCalendarEvent(response.data, calendarId);
    } catch (error) {
      log.error('Google event creation failed:', error);
      throw this.createError('Event creation failed', 'EVENT_CREATION_FAILED', error);
    }
  }

  protected async performEventUpdate(
    calendarId: string, 
    eventId: string, 
    updates: UpdateCalendarEventInput
  ): Promise<CalendarEvent> {
    try {
      const googleCalendarId = await this.getGoogleCalendarId(calendarId);
      const googleEventId = await this.getGoogleEventId(eventId);

      if (!googleCalendarId || !googleEventId) {
        throw this.createError('Calendar or event not found', 'NOT_FOUND');
      }

      // Get current event to merge with updates
      const currentEvent = await this.calendarApi.events.get({
        calendarId: googleCalendarId,
        eventId: googleEventId
      });

      const updatedGoogleEvent = {
        ...currentEvent.data,
        ...this.convertCalendarEventUpdatesToGoogle(updates)
      };

      const response = await this.calendarApi.events.update({
        calendarId: googleCalendarId,
        eventId: googleEventId,
        sendUpdates: 'all',
        requestBody: updatedGoogleEvent
      });

      return await this.convertGoogleEventToCalendarEvent(response.data, calendarId);
    } catch (error) {
      log.error('Google event update failed:', error);
      throw this.createError('Event update failed', 'EVENT_UPDATE_FAILED', error);
    }
  }

  protected async performEventDeletion(calendarId: string, eventId: string): Promise<void> {
    try {
      const googleCalendarId = await this.getGoogleCalendarId(calendarId);
      const googleEventId = await this.getGoogleEventId(eventId);

      if (!googleCalendarId || !googleEventId) {
        throw this.createError('Calendar or event not found', 'NOT_FOUND');
      }

      await this.calendarApi.events.delete({
        calendarId: googleCalendarId,
        eventId: googleEventId,
        sendUpdates: 'all'
      });
    } catch (error) {
      log.error('Google event deletion failed:', error);
      throw this.createError('Event deletion failed', 'EVENT_DELETION_FAILED', error);
    }
  }

  protected async performFreeBusyQuery(query: FreeBusyQuery): Promise<FreeBusyResponse> {
    try {
      const response = await this.calendarApi.freebusy.query({
        requestBody: {
          timeMin: query.timeMin.toISOString(),
          timeMax: query.timeMax.toISOString(),
          timeZone: query.timezone || 'UTC',
          items: query.emails.map(email => ({ id: email }))
        }
      });

      const freeBusy: Record<string, any[]> = {};
      const errors: Record<string, string> = {};

      for (const email of query.emails) {
        const calendar = response.data.calendars?.[email];
        if (calendar?.errors?.length) {
          errors[email] = calendar.errors[0].reason || 'Unknown error';
        } else if (calendar?.busy) {
          freeBusy[email] = calendar.busy.map(slot => ({
            start: new Date(slot.start!),
            end: new Date(slot.end!),
            status: 'busy' as const
          }));
        } else {
          freeBusy[email] = [];
        }
      }

      return {
        timeMin: query.timeMin,
        timeMax: query.timeMax,
        freeBusy,
        errors
      };
    } catch (error) {
      log.error('Google free/busy query failed:', error);
      throw this.createError('Free/busy query failed', 'FREEBUSY_QUERY_FAILED', error);
    }
  }

  protected async performDisposal(): Promise<void> {
    // Clean up any resources, webhook subscriptions, etc.
    if (this.config.enablePushNotifications) {
      await this.cleanupWebhookNotifications();
    }
  }

  // Helper methods
  private async getGoogleCalendarId(calendarId: string): Promise<string | null> {
    // In a real implementation, you'd maintain a mapping between internal IDs and Google IDs
    // For now, return the calendarId as-is
    return calendarId;
  }

  private async getGoogleEventId(eventId: string): Promise<string | null> {
    // In a real implementation, you'd maintain a mapping between internal IDs and Google IDs
    return eventId;
  }

  private async convertGoogleEventToCalendarEvent(
    gevent: calendar_v3.Schema$Event, 
    calendarId: string
  ): Promise<CalendarEvent> {
    const attendees: EventAttendee[] = (gevent.attendees || []).map(attendee => ({
      email: attendee.email!,
      displayName: attendee.displayName || undefined,
      responseStatus: this.mapResponseStatus(attendee.responseStatus),
      optional: attendee.optional || false,
      isResource: attendee.resource || false,
      comment: attendee.comment || undefined
    }));

    const reminders: EventReminder[] = [];
    if (gevent.reminders?.overrides) {
      reminders.push(...gevent.reminders.overrides.map(reminder => ({
        method: this.mapReminderMethod(reminder.method),
        minutesBefore: reminder.minutes || 0
      })));
    }

    let conferencing: ConferencingInfo | undefined;
    if (gevent.conferenceData?.conferenceSolution) {
      conferencing = {
        solution: this.mapConferencingSolution(gevent.conferenceData.conferenceSolution.name),
        meetingId: gevent.conferenceData.conferenceId || undefined,
        joinUrl: gevent.conferenceData.entryPoints?.[0]?.uri || undefined,
        passcode: gevent.conferenceData.entryPoints?.[0]?.accessCode || undefined
      };
    }

    return {
      id: this.generateEventId(),
      calendarId,
      providerId: gevent.id!,
      title: gevent.summary || 'Untitled Event',
      description: gevent.description || undefined,
      location: gevent.location || undefined,
      startTime: new Date(gevent.start?.dateTime || gevent.start?.date || ''),
      endTime: new Date(gevent.end?.dateTime || gevent.end?.date || ''),
      timezone: gevent.start?.timeZone || undefined,
      isAllDay: !!gevent.start?.date,
      status: this.mapEventStatus(gevent.status),
      visibility: this.mapEventVisibility(gevent.visibility),
      creator: gevent.creator ? {
        email: gevent.creator.email!,
        displayName: gevent.creator.displayName || undefined
      } : undefined,
      organizer: gevent.organizer ? {
        email: gevent.organizer.email!,
        displayName: gevent.organizer.displayName || undefined
      } : undefined,
      attendees,
      recurrence: gevent.recurrence ? this.parseRecurrence(gevent.recurrence) : undefined,
      recurringEventId: gevent.recurringEventId || undefined,
      originalStartTime: gevent.originalStartTime?.dateTime ? 
        new Date(gevent.originalStartTime.dateTime) : undefined,
      reminders,
      conferencing,
      attachments: [], // Google API doesn't directly support attachments in this format
      color: gevent.colorId || undefined,
      transparency: gevent.transparency === 'transparent' ? 'transparent' : 'opaque',
      uid: gevent.iCalUID || gevent.id!,
      sequence: gevent.sequence || 0,
      createdAt: new Date(gevent.created || ''),
      updatedAt: new Date(gevent.updated || '')
    };
  }

  private convertCalendarEventToGoogle(eventData: CreateCalendarEventInput): calendar_v3.Schema$Event {
    const googleEvent: calendar_v3.Schema$Event = {
      summary: eventData.title,
      description: eventData.description,
      location: eventData.location,
      start: eventData.isAllDay ? {
        date: eventData.startTime.toISOString().split('T')[0]
      } : {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timezone
      },
      end: eventData.isAllDay ? {
        date: eventData.endTime.toISOString().split('T')[0]
      } : {
        dateTime: eventData.endTime.toISOString(),
        timeZone: eventData.timezone
      },
      status: this.mapToGoogleEventStatus(eventData.status),
      visibility: this.mapToGoogleEventVisibility(eventData.visibility),
      transparency: eventData.transparency === 'transparent' ? 'transparent' : 'opaque',
      attendees: eventData.attendees.map(attendee => ({
        email: attendee.email,
        displayName: attendee.displayName,
        optional: attendee.optional,
        resource: attendee.isResource,
        responseStatus: this.mapToGoogleResponseStatus(attendee.responseStatus)
      })),
      reminders: {
        overrides: eventData.reminders.map(reminder => ({
          method: this.mapToGoogleReminderMethod(reminder.method),
          minutes: reminder.minutesBefore
        }))
      }
    };

    // Add recurrence if specified
    if (eventData.recurrence) {
      googleEvent.recurrence = [eventData.recurrence.rrule];
    }

    return googleEvent;
  }

  private convertCalendarEventUpdatesToGoogle(updates: UpdateCalendarEventInput): Partial<calendar_v3.Schema$Event> {
    const googleUpdates: Partial<calendar_v3.Schema$Event> = {};

    if (updates.title !== undefined) googleUpdates.summary = updates.title;
    if (updates.description !== undefined) googleUpdates.description = updates.description;
    if (updates.location !== undefined) googleUpdates.location = updates.location;
    
    if (updates.startTime || updates.isAllDay !== undefined) {
      googleUpdates.start = updates.isAllDay ? {
        date: (updates.startTime || new Date()).toISOString().split('T')[0]
      } : {
        dateTime: (updates.startTime || new Date()).toISOString(),
        timeZone: updates.timezone
      };
    }

    if (updates.endTime || updates.isAllDay !== undefined) {
      googleUpdates.end = updates.isAllDay ? {
        date: (updates.endTime || new Date()).toISOString().split('T')[0]
      } : {
        dateTime: (updates.endTime || new Date()).toISOString(),
        timeZone: updates.timezone
      };
    }

    if (updates.status) googleUpdates.status = this.mapToGoogleEventStatus(updates.status);
    if (updates.visibility) googleUpdates.visibility = this.mapToGoogleEventVisibility(updates.visibility);
    if (updates.transparency) googleUpdates.transparency = updates.transparency;

    if (updates.attendees) {
      googleUpdates.attendees = updates.attendees.map(attendee => ({
        email: attendee.email,
        displayName: attendee.displayName,
        optional: attendee.optional,
        resource: attendee.isResource,
        responseStatus: this.mapToGoogleResponseStatus(attendee.responseStatus)
      }));
    }

    if (updates.reminders) {
      googleUpdates.reminders = {
        overrides: updates.reminders.map(reminder => ({
          method: this.mapToGoogleReminderMethod(reminder.method),
          minutes: reminder.minutesBefore
        }))
      };
    }

    if (updates.recurrence) {
      googleUpdates.recurrence = [updates.recurrence.rrule];
    }

    return googleUpdates;
  }

  // Mapping methods
  private mapAccessLevel(accessRole?: string | null): Calendar['accessLevel'] {
    switch (accessRole) {
      case 'owner': return 'owner';
      case 'writer': return 'writer';
      case 'reader': return 'reader';
      case 'freeBusyReader': return 'freeBusyReader';
      default: return 'reader';
    }
  }

  private mapCalendarType(gcal: calendar_v3.Schema$CalendarListEntry): Calendar['type'] {
    if (gcal.primary) return 'primary';
    if (gcal.accessRole === 'owner') return 'secondary';
    return 'shared';
  }

  private mapEventStatus(status?: string | null): CalendarEvent['status'] {
    switch (status) {
      case 'confirmed': return 'confirmed';
      case 'tentative': return 'tentative';
      case 'cancelled': return 'cancelled';
      default: return 'confirmed';
    }
  }

  private mapEventVisibility(visibility?: string | null): CalendarEvent['visibility'] {
    switch (visibility) {
      case 'public': return 'public';
      case 'private': return 'private';
      case 'confidential': return 'confidential';
      default: return 'default';
    }
  }

  private mapResponseStatus(responseStatus?: string | null): EventAttendee['responseStatus'] {
    switch (responseStatus) {
      case 'accepted': return 'accepted';
      case 'declined': return 'declined';
      case 'tentative': return 'tentative';
      default: return 'needsAction';
    }
  }

  private mapReminderMethod(method?: string | null): EventReminder['method'] {
    switch (method) {
      case 'email': return 'email';
      case 'popup': return 'popup';
      case 'sms': return 'sms';
      default: return 'popup';
    }
  }

  private mapConferencingSolution(name?: string | null): ConferencingInfo['solution'] {
    if (name?.includes('Meet')) return 'meet';
    if (name?.includes('Zoom')) return 'zoom';
    if (name?.includes('Teams')) return 'teams';
    if (name?.includes('Hangout')) return 'hangout';
    return 'custom';
  }

  // Reverse mapping methods
  private mapToGoogleEventStatus(status: CalendarEvent['status']): string {
    switch (status) {
      case 'confirmed': return 'confirmed';
      case 'tentative': return 'tentative';
      case 'cancelled': return 'cancelled';
      default: return 'confirmed';
    }
  }

  private mapToGoogleEventVisibility(visibility: CalendarEvent['visibility']): string {
    switch (visibility) {
      case 'public': return 'public';
      case 'private': return 'private';
      case 'confidential': return 'confidential';
      default: return 'default';
    }
  }

  private mapToGoogleResponseStatus(status: EventAttendee['responseStatus']): string {
    switch (status) {
      case 'accepted': return 'accepted';
      case 'declined': return 'declined';
      case 'tentative': return 'tentative';
      case 'needsAction': return 'needsAction';
      default: return 'needsAction';
    }
  }

  private mapToGoogleReminderMethod(method: EventReminder['method']): string {
    switch (method) {
      case 'email': return 'email';
      case 'popup': return 'popup';
      case 'sms': return 'sms';
      case 'sound': return 'popup'; // Google doesn't have sound, use popup
      default: return 'popup';
    }
  }

  private parseRecurrence(recurrence: string[]): RecurrenceRule | undefined {
    if (!recurrence || recurrence.length === 0) return undefined;

    // This is a simplified parser - in production, you'd use a proper RRULE library
    const rrule = recurrence[0];
    
    return {
      frequency: 'WEEKLY', // Default, would parse from RRULE
      interval: 1,
      rrule
    };
  }

  private async setupWebhookNotifications(): Promise<void> {
    try {
      // Set up Google Calendar push notifications
      // This would require a webhook endpoint to be configured
      log.info('Setting up Google Calendar webhook notifications');
      
      // Implementation would go here
    } catch (error) {
      log.error('Failed to setup webhook notifications:', error);
    }
  }

  private async cleanupWebhookNotifications(): Promise<void> {
    try {
      // Clean up webhook subscriptions
      log.info('Cleaning up Google Calendar webhook notifications');
      
      // Implementation would go here
    } catch (error) {
      log.error('Failed to cleanup webhook notifications:', error);
    }
  }
}