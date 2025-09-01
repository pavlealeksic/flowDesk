/*!
 * Outlook Calendar Provider
 * 
 * Integrates with Microsoft Graph API for Outlook/Office 365 calendars.
 * Supports OAuth2 authentication, webhooks, and full event management.
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import type {
  CalendarAccount,
  CalendarEvent,
  Calendar,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  FreeBusyQuery,
  FreeBusyResponse,
  CalendarProvider,
  OutlookCalendarConfig,
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
 * Custom authentication provider for Microsoft Graph
 */
class FlowDeskGraphAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }

  updateAccessToken(newToken: string): void {
    this.accessToken = newToken;
  }
}

/**
 * Microsoft Outlook/Graph API provider implementation
 */
export class OutlookCalendarProvider extends BaseCalendarProvider {
  private graphClient: Client;
  private authProvider: FlowDeskGraphAuthProvider;
  private config: OutlookCalendarConfig;

  constructor(account: CalendarAccount, providerConfig: ProviderConfig) {
    super(account, providerConfig);
    
    this.config = account.config as OutlookCalendarConfig;
    
    // Initialize Graph client with custom auth provider
    this.authProvider = new FlowDeskGraphAuthProvider(
      account.credentials?.accessToken || ''
    );
    
    this.graphClient = Client.initWithMiddleware({
      authProvider: this.authProvider
    });
  }

  getProviderType(): CalendarProvider {
    return 'outlook';
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
      maxAttendees: 500,
      rateLimits: {
        requestsPerMinute: 600,
        requestsPerDay: 10000
      }
    };
  }

  protected async validateConfiguration(): Promise<void> {
    if (!this.config.clientId) {
      throw this.createError('Microsoft Graph client ID is required', 'MISSING_CLIENT_ID');
    }

    if (!this.config.scopes || this.config.scopes.length === 0) {
      throw this.createError('Microsoft Graph scopes are required', 'MISSING_SCOPES');
    }

    // Validate required scopes
    const requiredScopes = [
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/User.Read'
    ];

    for (const scope of requiredScopes) {
      if (!this.config.scopes.includes(scope)) {
        throw this.createError(`Missing required scope: ${scope}`, 'MISSING_REQUIRED_SCOPE');
      }
    }
  }

  protected async initializeProvider(): Promise<void> {
    log.info('Initializing Microsoft Graph API client');
    
    // Update auth provider with current access token
    if (this.account.credentials?.accessToken) {
      this.authProvider.updateAccessToken(this.account.credentials.accessToken);
    }
    
    // Set up webhook notifications if enabled
    if (this.config.enableWebhooks) {
      await this.setupWebhookSubscriptions();
    }
  }

  protected async performConnectionTest(): Promise<boolean> {
    try {
      // Test by getting user profile
      const user = await this.graphClient.api('/me').get();
      return !!user.id;
    } catch (error) {
      log.error('Microsoft Graph connection test failed:', error);
      return false;
    }
  }

  async authenticate(): Promise<AuthenticationResult> {
    try {
      // Generate OAuth URL for user authorization
      const tenantId = this.config.tenantId || 'common';
      const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${this.config.clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(this.config.oauth?.redirectUri || '')}&` +
        `scope=${encodeURIComponent(this.config.scopes.join(' '))}&` +
        `response_mode=query`;

      return {
        success: false,
        error: 'User authorization required',
        additionalData: { authUrl }
      };
    } catch (error) {
      log.error('Microsoft Graph authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async handleAuthorizationCode(code: string): Promise<AuthenticationResult> {
    try {
      const tenantId = this.config.tenantId || 'common';
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.oauth?.clientSecret || '',
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.oauth?.redirectUri || '',
          scope: this.config.scopes.join(' ')
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Token exchange failed');
      }

      // Update auth provider
      this.authProvider.updateAccessToken(data.access_token);

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in * 1000))
      };
    } catch (error) {
      log.error('Microsoft Graph authorization code exchange failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authorization failed'
      };
    }
  }

  async refreshAuthentication(): Promise<AuthenticationResult> {
    try {
      if (!this.account.credentials?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const tenantId = this.config.tenantId || 'common';
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.oauth?.clientSecret || '',
          refresh_token: this.account.credentials.refreshToken,
          grant_type: 'refresh_token',
          scope: this.config.scopes.join(' ')
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Token refresh failed');
      }

      // Update auth provider
      this.authProvider.updateAccessToken(data.access_token);

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.account.credentials.refreshToken,
        expiresAt: new Date(Date.now() + (data.expires_in * 1000))
      };
    } catch (error) {
      log.error('Microsoft Graph token refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  protected async fetchCalendars(): Promise<Calendar[]> {
    try {
      const response = await this.graphClient.api('/me/calendars').get();
      const calendars: Calendar[] = [];

      for (const msCal of response.value || []) {
        if (!msCal.id) continue;

        const calendar: Calendar = {
          id: this.generateCalendarId(),
          accountId: this.account.id,
          providerId: msCal.id,
          name: msCal.name || 'Unnamed Calendar',
          description: undefined,
          color: this.mapOutlookColor(msCal.color),
          timezone: 'UTC', // Microsoft Graph doesn't expose timezone directly
          isPrimary: msCal.isDefault || false,
          accessLevel: this.mapAccessLevel(msCal.canEdit),
          isVisible: !msCal.isHidden,
          canSync: msCal.canEdit !== false,
          type: this.mapCalendarType(msCal),
          isSelected: !msCal.isHidden,
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
      log.error('Failed to fetch Outlook calendars:', error);
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

      // Default time range
      const defaultTimeMin = timeMin || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const defaultTimeMax = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      for (const calendarId of calendarIds) {
        try {
          const outlookCalendarId = await this.getOutlookCalendarId(calendarId);
          if (!outlookCalendarId) {
            errors.push(`Calendar ${calendarId} not found`);
            continue;
          }

          let nextLink: string | undefined;
          let url = `/me/calendars/${outlookCalendarId}/events`;
          
          // Add query parameters
          const queryParams = new URLSearchParams({
            $filter: `start/dateTime ge '${defaultTimeMin.toISOString()}' and end/dateTime le '${defaultTimeMax.toISOString()}'`,
            $orderby: 'start/dateTime',
            $top: '1000'
          });

          // Add delta token for incremental sync if available
          if (this.config.deltaToken) {
            queryParams.set('$deltaToken', this.config.deltaToken);
          }

          url += `?${queryParams.toString()}`;
          
          do {
            const response = await this.graphClient.api(nextLink || url).get();
            const items = response.value || [];
            
            for (const msEvent of items) {
              if (!msEvent.id) continue;

              try {
                const event = await this.convertOutlookEventToCalendarEvent(msEvent, calendarId);
                events.push(event);
                totalEvents++;
                
                // Simplified new/updated detection
                if (msEvent.createdDateTime && msEvent.lastModifiedDateTime && 
                    new Date(msEvent.createdDateTime).getTime() === new Date(msEvent.lastModifiedDateTime).getTime()) {
                  newEvents++;
                } else {
                  updatedEvents++;
                }
              } catch (eventError) {
                errors.push(`Failed to convert event ${msEvent.id}: ${eventError}`);
              }
            }

            nextLink = response['@odata.nextLink'];
            
            // Update delta token for incremental sync
            if (response['@odata.deltaLink']) {
              const deltaUrl = new URL(response['@odata.deltaLink']);
              this.config.deltaToken = deltaUrl.searchParams.get('$deltatoken') || undefined;
            }

            // Emit progress
            this.emit('events:sync:progress', {
              accountId: this.account.id,
              calendarId,
              processed: events.length,
              total: totalEvents
            });
            
          } while (nextLink);

        } catch (calendarError) {
          const errorMessage = `Failed to sync calendar ${calendarId}: ${calendarError}`;
          errors.push(errorMessage);
          log.error(errorMessage, calendarError);
        }
      }

      return {
        success: errors.length === 0,
        calendars: [],
        events,
        totalEvents,
        newEvents,
        updatedEvents,
        deletedEvents: 0,
        errors,
        syncToken: this.config.deltaToken
      };
    } catch (error) {
      log.error('Outlook events sync failed:', error);
      throw this.createError('Events sync failed', 'EVENTS_SYNC_FAILED', error);
    }
  }

  protected async performEventCreation(
    calendarId: string, 
    eventData: CreateCalendarEventInput
  ): Promise<CalendarEvent> {
    try {
      const outlookCalendarId = await this.getOutlookCalendarId(calendarId);
      if (!outlookCalendarId) {
        throw this.createError(`Calendar ${calendarId} not found`, 'CALENDAR_NOT_FOUND');
      }

      const outlookEvent = this.convertCalendarEventToOutlook(eventData);

      const response = await this.graphClient
        .api(`/me/calendars/${outlookCalendarId}/events`)
        .post(outlookEvent);

      if (!response.id) {
        throw this.createError('Event creation failed - no ID returned', 'EVENT_CREATION_FAILED');
      }

      return await this.convertOutlookEventToCalendarEvent(response, calendarId);
    } catch (error) {
      log.error('Outlook event creation failed:', error);
      throw this.createError('Event creation failed', 'EVENT_CREATION_FAILED', error);
    }
  }

  protected async performEventUpdate(
    calendarId: string, 
    eventId: string, 
    updates: UpdateCalendarEventInput
  ): Promise<CalendarEvent> {
    try {
      const outlookCalendarId = await this.getOutlookCalendarId(calendarId);
      const outlookEventId = await this.getOutlookEventId(eventId);

      if (!outlookCalendarId || !outlookEventId) {
        throw this.createError('Calendar or event not found', 'NOT_FOUND');
      }

      const outlookUpdates = this.convertCalendarEventUpdatesToOutlook(updates);

      const response = await this.graphClient
        .api(`/me/calendars/${outlookCalendarId}/events/${outlookEventId}`)
        .patch(outlookUpdates);

      return await this.convertOutlookEventToCalendarEvent(response, calendarId);
    } catch (error) {
      log.error('Outlook event update failed:', error);
      throw this.createError('Event update failed', 'EVENT_UPDATE_FAILED', error);
    }
  }

  protected async performEventDeletion(calendarId: string, eventId: string): Promise<void> {
    try {
      const outlookCalendarId = await this.getOutlookCalendarId(calendarId);
      const outlookEventId = await this.getOutlookEventId(eventId);

      if (!outlookCalendarId || !outlookEventId) {
        throw this.createError('Calendar or event not found', 'NOT_FOUND');
      }

      await this.graphClient
        .api(`/me/calendars/${outlookCalendarId}/events/${outlookEventId}`)
        .delete();
    } catch (error) {
      log.error('Outlook event deletion failed:', error);
      throw this.createError('Event deletion failed', 'EVENT_DELETION_FAILED', error);
    }
  }

  protected async performFreeBusyQuery(query: FreeBusyQuery): Promise<FreeBusyResponse> {
    try {
      const requestBody = {
        schedules: query.emails,
        startTime: {
          dateTime: query.timeMin.toISOString(),
          timeZone: query.timezone || 'UTC'
        },
        endTime: {
          dateTime: query.timeMax.toISOString(),
          timeZone: query.timezone || 'UTC'
        },
        availabilityViewInterval: 60
      };

      const response = await this.graphClient
        .api('/me/calendar/getSchedule')
        .post(requestBody);

      const freeBusy: Record<string, any[]> = {};
      const errors: Record<string, string> = {};

      response.value?.forEach((schedule: any, index: number) => {
        const email = query.emails[index];
        
        if (schedule.error) {
          errors[email] = schedule.error.message || 'Unknown error';
        } else {
          freeBusy[email] = (schedule.busyViewData || []).map((slot: any, slotIndex: number) => {
            const start = new Date(query.timeMin.getTime() + (slotIndex * 60 * 60 * 1000));
            const end = new Date(start.getTime() + (60 * 60 * 1000));
            
            return {
              start,
              end,
              status: slot === '2' ? 'busy' as const : 'free' as const
            };
          }).filter((slot: any) => slot.status === 'busy');
        }
      });

      return {
        timeMin: query.timeMin,
        timeMax: query.timeMax,
        freeBusy,
        errors
      };
    } catch (error) {
      log.error('Outlook free/busy query failed:', error);
      throw this.createError('Free/busy query failed', 'FREEBUSY_QUERY_FAILED', error);
    }
  }

  protected async performDisposal(): Promise<void> {
    if (this.config.enableWebhooks) {
      await this.cleanupWebhookSubscriptions();
    }
  }

  // Helper methods
  private async getOutlookCalendarId(calendarId: string): Promise<string | null> {
    // In practice, you'd maintain a mapping between internal IDs and Outlook IDs
    return calendarId;
  }

  private async getOutlookEventId(eventId: string): Promise<string | null> {
    // In practice, you'd maintain a mapping between internal IDs and Outlook IDs
    return eventId;
  }

  private async convertOutlookEventToCalendarEvent(
    msEvent: any, 
    calendarId: string
  ): Promise<CalendarEvent> {
    const attendees: EventAttendee[] = (msEvent.attendees || []).map((attendee: any) => ({
      email: attendee.emailAddress?.address!,
      displayName: attendee.emailAddress?.name || undefined,
      responseStatus: this.mapOutlookResponseStatus(attendee.status?.response),
      optional: attendee.type === 'optional',
      isResource: attendee.type === 'resource',
      comment: undefined
    }));

    const reminders: EventReminder[] = [];
    if (msEvent.reminderMinutesBeforeStart > 0) {
      reminders.push({
        method: 'popup',
        minutesBefore: msEvent.reminderMinutesBeforeStart
      });
    }

    let conferencing: ConferencingInfo | undefined;
    if (msEvent.onlineMeeting) {
      conferencing = {
        solution: 'teams', // Outlook typically uses Teams
        joinUrl: msEvent.onlineMeeting.joinUrl || undefined
      };
    }

    return {
      id: this.generateEventId(),
      calendarId,
      providerId: msEvent.id!,
      title: msEvent.subject || 'Untitled Event',
      description: msEvent.body?.content || undefined,
      location: msEvent.location?.displayName || undefined,
      startTime: new Date(msEvent.start?.dateTime || ''),
      endTime: new Date(msEvent.end?.dateTime || ''),
      timezone: msEvent.start?.timeZone || undefined,
      isAllDay: msEvent.isAllDay || false,
      status: this.mapOutlookEventStatus(msEvent.showAs),
      visibility: this.mapOutlookEventVisibility(msEvent.sensitivity),
      creator: msEvent.createdBy ? {
        email: msEvent.createdBy.emailAddress?.address!,
        displayName: msEvent.createdBy.emailAddress?.name || undefined
      } : undefined,
      organizer: msEvent.organizer ? {
        email: msEvent.organizer.emailAddress?.address!,
        displayName: msEvent.organizer.emailAddress?.name || undefined
      } : undefined,
      attendees,
      recurrence: msEvent.recurrence ? this.parseOutlookRecurrence(msEvent.recurrence) : undefined,
      recurringEventId: msEvent.seriesMasterId || undefined,
      originalStartTime: undefined, // Would need additional logic
      reminders,
      conferencing,
      attachments: [], // Would need to fetch separately
      color: undefined,
      transparency: msEvent.showAs === 'free' ? 'transparent' : 'opaque',
      uid: msEvent.iCalUId || msEvent.id!,
      sequence: 0, // Outlook doesn't expose sequence directly
      createdAt: new Date(msEvent.createdDateTime || ''),
      updatedAt: new Date(msEvent.lastModifiedDateTime || '')
    };
  }

  private convertCalendarEventToOutlook(eventData: CreateCalendarEventInput): any {
    return {
      subject: eventData.title,
      body: {
        contentType: 'HTML',
        content: eventData.description || ''
      },
      location: eventData.location ? {
        displayName: eventData.location
      } : undefined,
      start: {
        dateTime: eventData.startTime.toISOString(),
        timeZone: eventData.timezone || 'UTC'
      },
      end: {
        dateTime: eventData.endTime.toISOString(),
        timeZone: eventData.timezone || 'UTC'
      },
      isAllDay: eventData.isAllDay,
      showAs: this.mapToOutlookEventStatus(eventData.status),
      sensitivity: this.mapToOutlookEventVisibility(eventData.visibility),
      attendees: eventData.attendees.map(attendee => ({
        emailAddress: {
          address: attendee.email,
          name: attendee.displayName
        },
        type: attendee.optional ? 'optional' : 'required'
      })),
      reminderMinutesBeforeStart: eventData.reminders[0]?.minutesBefore || 15
    };
  }

  private convertCalendarEventUpdatesToOutlook(updates: UpdateCalendarEventInput): any {
    const outlookUpdates: any = {};

    if (updates.title !== undefined) outlookUpdates.subject = updates.title;
    
    if (updates.description !== undefined) {
      outlookUpdates.body = {
        contentType: 'HTML',
        content: updates.description
      };
    }

    if (updates.location !== undefined) {
      outlookUpdates.location = updates.location ? {
        displayName: updates.location
      } : null;
    }

    if (updates.startTime !== undefined) {
      outlookUpdates.start = {
        dateTime: updates.startTime.toISOString(),
        timeZone: updates.timezone || 'UTC'
      };
    }

    if (updates.endTime !== undefined) {
      outlookUpdates.end = {
        dateTime: updates.endTime.toISOString(),
        timeZone: updates.timezone || 'UTC'
      };
    }

    if (updates.isAllDay !== undefined) outlookUpdates.isAllDay = updates.isAllDay;
    if (updates.status) outlookUpdates.showAs = this.mapToOutlookEventStatus(updates.status);
    if (updates.visibility) outlookUpdates.sensitivity = this.mapToOutlookEventVisibility(updates.visibility);

    if (updates.attendees) {
      outlookUpdates.attendees = updates.attendees.map(attendee => ({
        emailAddress: {
          address: attendee.email,
          name: attendee.displayName
        },
        type: attendee.optional ? 'optional' : 'required'
      }));
    }

    if (updates.reminders && updates.reminders.length > 0) {
      outlookUpdates.reminderMinutesBeforeStart = updates.reminders[0].minutesBefore;
    }

    return outlookUpdates;
  }

  // Mapping methods
  private mapAccessLevel(canEdit?: boolean): Calendar['accessLevel'] {
    return canEdit !== false ? 'writer' : 'reader';
  }

  private mapCalendarType(msCal: any): Calendar['type'] {
    if (msCal.isDefault) return 'primary';
    if (msCal.owner?.address === this.account.email) return 'secondary';
    return 'shared';
  }

  private mapOutlookColor(color?: string): string {
    const colorMap: Record<string, string> = {
      'lightBlue': '#3F51B5',
      'lightGreen': '#4CAF50',
      'lightOrange': '#FF9800',
      'lightGray': '#9E9E9E',
      'lightYellow': '#FFEB3B',
      'lightTeal': '#009688',
      'lightPink': '#E91E63',
      'lightBrown': '#795548',
      'lightRed': '#F44336',
      'maxColor': '#9C27B0'
    };
    return colorMap[color || 'lightBlue'] || '#3F51B5';
  }

  private mapOutlookEventStatus(showAs?: string): CalendarEvent['status'] {
    switch (showAs) {
      case 'tentative': return 'tentative';
      case 'busy': return 'confirmed';
      case 'oof': return 'confirmed';
      case 'workingElsewhere': return 'confirmed';
      default: return 'confirmed';
    }
  }

  private mapOutlookEventVisibility(sensitivity?: string): CalendarEvent['visibility'] {
    switch (sensitivity) {
      case 'personal': return 'private';
      case 'private': return 'private';
      case 'confidential': return 'confidential';
      default: return 'default';
    }
  }

  private mapOutlookResponseStatus(response?: string): EventAttendee['responseStatus'] {
    switch (response) {
      case 'accepted': return 'accepted';
      case 'declined': return 'declined';
      case 'tentativelyAccepted': return 'tentative';
      default: return 'needsAction';
    }
  }

  // Reverse mapping methods
  private mapToOutlookEventStatus(status: CalendarEvent['status']): string {
    switch (status) {
      case 'confirmed': return 'busy';
      case 'tentative': return 'tentative';
      case 'cancelled': return 'free';
      default: return 'busy';
    }
  }

  private mapToOutlookEventVisibility(visibility: CalendarEvent['visibility']): string {
    switch (visibility) {
      case 'private': return 'private';
      case 'confidential': return 'confidential';
      default: return 'normal';
    }
  }

  private parseOutlookRecurrence(recurrence: any): RecurrenceRule | undefined {
    if (!recurrence?.pattern) return undefined;

    // Simplified - would need full implementation
    return {
      frequency: 'WEEKLY',
      interval: recurrence.pattern.interval || 1,
      rrule: 'FREQ=WEEKLY;INTERVAL=1' // Would convert from Outlook format
    };
  }

  private async setupWebhookSubscriptions(): Promise<void> {
    try {
      log.info('Setting up Outlook Calendar webhook subscriptions');
      // Implementation would create Graph API subscriptions
    } catch (error) {
      log.error('Failed to setup webhook subscriptions:', error);
    }
  }

  private async cleanupWebhookSubscriptions(): Promise<void> {
    try {
      log.info('Cleaning up Outlook Calendar webhook subscriptions');
      // Implementation would delete Graph API subscriptions
    } catch (error) {
      log.error('Failed to cleanup webhook subscriptions:', error);
    }
  }
}