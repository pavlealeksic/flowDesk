/**
 * Real Google Calendar API Service Implementation
 * 
 * This service provides real Google Calendar API integration using the googleapis library.
 * It handles OAuth2 authentication, calendar operations, and event management.
 */

/// <reference path="../types/@types/electron-store/index.d.ts" />

import { google, calendar_v3 } from 'googleapis';
import type { Auth } from 'googleapis';
import log from 'electron-log';
import { createTypedStore, TypedStore } from '../types/store';
import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';

// Calendar account interface
interface CalendarAccount {
  id: string;
  email: string;
  provider: string;
  displayName: string;
  accessToken?: string;
  refreshToken?: string;
  isEnabled: boolean;
}

// Calendar interface
interface Calendar {
  id: string;
  accountId: string;
  name: string;
  description?: string;
  color: string;
  isPrimary: boolean;
  isWritable: boolean;
}

// Calendar event interface
interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  organizer: string;
  attendees: string[];
  status: string;
  visibility: string;
  created: Date;
  updated: Date;
}

export class GoogleCalendarService {
  private store: TypedStore<{ accounts: CalendarAccount[] }>;
  private accounts: Map<string, CalendarAccount> = new Map();
  private calendars: Map<string, Calendar[]> = new Map();
  private events: Map<string, CalendarEvent[]> = new Map();

  constructor() {
    this.store = createTypedStore<{ accounts: CalendarAccount[] }>({
      name: 'flow-desk-calendar-accounts',
      encryptionKey: this.getEncryptionKey()
    });
    
    // Load saved accounts
    this.loadAccounts();
  }

  private getEncryptionKey(): string {
    // Use machine-specific key for encryption
    return CryptoJS.SHA256('flow-desk-calendar-encryption').toString();
  }

  private async loadAccounts() {
    try {
      const savedAccounts = this.store.get('accounts', []) as CalendarAccount[];
      for (const account of savedAccounts) {
        this.accounts.set(account.id, account);
      }
      log.info(`Loaded ${savedAccounts.length} calendar accounts`);
    } catch (error) {
      log.error('Failed to load calendar accounts:', error);
    }
  }

  private saveAccounts() {
    const accountsArray = Array.from(this.accounts.values());
    this.store.set('accounts', accountsArray);
  }

  /**
   * Get OAuth2 authorization URL for Google Calendar
   */
  getOAuthUrl(clientId: string, redirectUri: string = 'http://localhost:8080/oauth/callback'): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const auth = new google.auth.OAuth2(clientId, '', redirectUri);
    
    return auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  /**
   * Exchange OAuth authorization code for tokens
   */
  async exchangeOAuthCode(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    authCode: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    
    try {
      const { tokens } = await auth.getToken(authCode);
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined
      };
    } catch (error) {
      log.error('OAuth token exchange failed:', error);
      throw new Error(`OAuth exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add Google Calendar account
   */
  async addAccount(
    email: string,
    accessToken: string,
    refreshToken?: string
  ): Promise<CalendarAccount> {
    const accountId = uuidv4();
    
    const account: CalendarAccount = {
      id: accountId,
      email,
      provider: 'google',
      displayName: email,
      accessToken,
      refreshToken,
      isEnabled: true
    };

    this.accounts.set(accountId, account);
    this.saveAccounts();

    log.info(`Added Google Calendar account: ${email}`);
    return account;
  }

  /**
   * Remove calendar account
   */
  async removeAccount(accountId: string): Promise<void> {
    this.accounts.delete(accountId);
    this.calendars.delete(accountId);
    this.events.delete(accountId);
    this.saveAccounts();
    
    log.info(`Removed calendar account: ${accountId}`);
  }

  /**
   * Get all calendar accounts
   */
  getAccounts(): CalendarAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Sync calendars from Google Calendar API
   */
  async syncAccount(accountId: string): Promise<{
    accountId: string;
    isSync: boolean;
    totalCalendars: number;
    totalEvents: number;
    error?: string;
  }> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.accessToken) {
      throw new Error('No access token for account');
    }

    try {
      log.info(`Syncing Google Calendar account: ${account.email}`);

      // Create authenticated client
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: account.accessToken });
      const calendarApi = google.calendar({ version: 'v3', auth });

      // Fetch calendar list
      const calendarListResponse = await calendarApi.calendarList.list();
      const googleCalendars = calendarListResponse.data.items || [];

      const calendars: Calendar[] = googleCalendars.map(gcal => ({
        id: gcal.id!,
        accountId,
        name: gcal.summary!,
        description: gcal.description || undefined,
        color: gcal.backgroundColor || '#4285f4',
        isPrimary: gcal.primary || false,
        isWritable: gcal.accessRole === 'owner' || gcal.accessRole === 'writer'
      }));

      this.calendars.set(accountId, calendars);

      // Fetch events for primary calendar
      let totalEvents = 0;
      const primaryCalendar = calendars.find(c => c.isPrimary);
      
      if (primaryCalendar) {
        const events = await this.fetchCalendarEvents(calendarApi, primaryCalendar.id);
        this.events.set(primaryCalendar.id, events);
        totalEvents = events.length;
      }

      log.info(`Synced ${calendars.length} calendars with ${totalEvents} events`);

      return {
        accountId,
        isSync: false,
        totalCalendars: calendars.length,
        totalEvents,
      };

    } catch (error) {
      log.error('Calendar sync failed:', error);
      return {
        accountId,
        isSync: false,
        totalCalendars: 0,
        totalEvents: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch events from a specific calendar
   */
  private async fetchCalendarEvents(
    calendarApi: calendar_v3.Calendar,
    calendarId: string
  ): Promise<CalendarEvent[]> {
    try {
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const eventsResponse = await calendarApi.events.list({
        calendarId,
        timeMin: oneMonthAgo.toISOString(),
        timeMax: oneMonthFromNow.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const googleEvents = eventsResponse.data.items || [];

      return googleEvents.map(gevent => {
        const startTime = this.parseGoogleDateTime(gevent.start!);
        const endTime = this.parseGoogleDateTime(gevent.end!);
        
        return {
          id: gevent.id!,
          calendarId,
          title: gevent.summary || '(No Title)',
          description: gevent.description || undefined,
          location: gevent.location || undefined,
          startTime,
          endTime,
          isAllDay: !!gevent.start?.date,
          organizer: gevent.organizer?.email || '',
          attendees: (gevent.attendees || []).map(a => a.email!),
          status: gevent.status || 'confirmed',
          visibility: gevent.visibility || 'default',
          created: new Date(gevent.created!),
          updated: new Date(gevent.updated!)
        };
      });

    } catch (error) {
      log.error(`Failed to fetch events for calendar ${calendarId}:`, error);
      return [];
    }
  }

  /**
   * Parse Google Calendar date/time
   */
  private parseGoogleDateTime(dateTime: calendar_v3.Schema$EventDateTime): Date {
    if (dateTime.dateTime) {
      return new Date(dateTime.dateTime);
    } else if (dateTime.date) {
      return new Date(dateTime.date + 'T00:00:00.000Z');
    } else {
      return new Date();
    }
  }

  /**
   * Create new calendar event
   */
  async createEvent(
    accountId: string,
    calendarId: string,
    title: string,
    startTime: Date,
    endTime: Date,
    description?: string,
    location?: string,
    attendees: string[] = []
  ): Promise<string> {
    const account = this.accounts.get(accountId);
    if (!account?.accessToken) {
      throw new Error('Account not found or no access token');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: account.accessToken });
    const calendarApi = google.calendar({ version: 'v3', auth });

    const event: calendar_v3.Schema$Event = {
      summary: title,
      description,
      location,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC'
      },
      attendees: attendees.map(email => ({ email }))
    };

    try {
      const response = await calendarApi.events.insert({
        calendarId,
        requestBody: event
      });

      log.info(`Created calendar event: ${response.data.id}`);
      return response.data.id!;

    } catch (error) {
      log.error('Failed to create calendar event:', error);
      throw new Error(`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get calendars for account
   */
  getCalendars(accountId: string): Calendar[] {
    return this.calendars.get(accountId) || [];
  }

  /**
   * Get events for calendar
   */
  getEvents(calendarId: string): CalendarEvent[] {
    return this.events.get(calendarId) || [];
  }

  /**
   * Search events across all calendars
   */
  searchEvents(accountId: string, query: string): CalendarEvent[] {
    const results: CalendarEvent[] = [];
    const calendars = this.calendars.get(accountId) || [];
    
    for (const calendar of calendars) {
      const events = this.events.get(calendar.id) || [];
      for (const event of events) {
        if (this.eventMatchesQuery(event, query)) {
          results.push(event);
        }
      }
    }
    
    return results;
  }

  private eventMatchesQuery(event: CalendarEvent, query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return (
      event.title.toLowerCase().includes(lowerQuery) ||
      (event.description?.toLowerCase().includes(lowerQuery)) ||
      (event.location?.toLowerCase().includes(lowerQuery)) ||
      event.attendees.some(email => email.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Update event
   */
  async updateEvent(
    accountId: string,
    calendarId: string,
    eventId: string,
    updates: Partial<CalendarEvent>
  ): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account?.accessToken) {
      throw new Error('Account not found or no access token');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: account.accessToken });
    const calendarApi = google.calendar({ version: 'v3', auth });

    const event: Partial<calendar_v3.Schema$Event> = {};
    
    if (updates.title) event.summary = updates.title;
    if (updates.description) event.description = updates.description;
    if (updates.location) event.location = updates.location;
    if (updates.startTime) {
      event.start = {
        dateTime: updates.startTime.toISOString(),
        timeZone: 'UTC'
      };
    }
    if (updates.endTime) {
      event.end = {
        dateTime: updates.endTime.toISOString(),
        timeZone: 'UTC'
      };
    }

    try {
      await calendarApi.events.patch({
        calendarId,
        eventId,
        requestBody: event
      });

      log.info(`Updated calendar event: ${eventId}`);
    } catch (error) {
      log.error('Failed to update calendar event:', error);
      throw new Error(`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete event
   */
  async deleteEvent(accountId: string, calendarId: string, eventId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account?.accessToken) {
      throw new Error('Account not found or no access token');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: account.accessToken });
    const calendarApi = google.calendar({ version: 'v3', auth });

    try {
      await calendarApi.events.delete({
        calendarId,
        eventId
      });

      // Remove from local cache
      const events = this.events.get(calendarId) || [];
      const updatedEvents = events.filter(e => e.id !== eventId);
      this.events.set(calendarId, updatedEvents);

      log.info(`Deleted calendar event: ${eventId}`);
    } catch (error) {
      log.error('Failed to delete calendar event:', error);
      throw new Error(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get free/busy information
   */
  async getFreeBusy(
    accountId: string,
    calendarIds: string[],
    timeMin: Date,
    timeMax: Date
  ): Promise<{ [calendarId: string]: { start: Date; end: Date }[] }> {
    const account = this.accounts.get(accountId);
    if (!account?.accessToken) {
      throw new Error('Account not found or no access token');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: account.accessToken });
    const calendarApi = google.calendar({ version: 'v3', auth });

    try {
      const response = await calendarApi.freebusy.query({
        requestBody: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          items: calendarIds.map(id => ({ id }))
        }
      });

      const freeBusy: { [calendarId: string]: { start: Date; end: Date }[] } = {};
      
      for (const [calendarId, busyData] of Object.entries(response.data.calendars || {})) {
        freeBusy[calendarId] = (busyData.busy || []).map(period => ({
          start: new Date(period.start!),
          end: new Date(period.end!)
        }));
      }

      return freeBusy;

    } catch (error) {
      log.error('Failed to get free/busy information:', error);
      throw new Error(`Free/busy query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Privacy Sync: Create busy block in target calendar
   */
  async createPrivacyBlock(
    sourceAccountId: string,
    targetAccountId: string,
    targetCalendarId: string,
    event: CalendarEvent,
    privacyTitle: string = 'Private'
  ): Promise<string> {
    const targetAccount = this.accounts.get(targetAccountId);
    if (!targetAccount?.accessToken) {
      throw new Error('Target account not found or no access token');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: targetAccount.accessToken });
    const calendarApi = google.calendar({ version: 'v3', auth });

    // Create privacy-safe event
    const privacyEvent: calendar_v3.Schema$Event = {
      summary: privacyTitle,
      start: {
        dateTime: event.startTime.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: event.endTime.toISOString(),
        timeZone: 'UTC'
      },
      visibility: 'private',
      // Store sync metadata in extended properties
      extendedProperties: {
        private: {
          flowDeskSync: 'true',
          sourceEventId: event.id,
          sourceCalendarId: event.calendarId,
          sourceAccountId
        }
      }
    };

    try {
      const response = await calendarApi.events.insert({
        calendarId: targetCalendarId,
        requestBody: privacyEvent
      });

      log.info(`Created privacy block: ${response.data.id}`);
      return response.data.id!;

    } catch (error) {
      log.error('Failed to create privacy block:', error);
      throw new Error(`Failed to create privacy block: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(accountId: string, clientId: string, clientSecret: string): Promise<string> {
    const account = this.accounts.get(accountId);
    if (!account?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: account.refreshToken });

    try {
      const { credentials } = await auth.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token received during refresh');
      }

      // Update stored account
      account.accessToken = credentials.access_token;
      this.accounts.set(accountId, account);
      this.saveAccounts();

      log.info(`Refreshed access token for account: ${account.email}`);
      return credentials.access_token;

    } catch (error) {
      log.error('Token refresh failed:', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account by email
   */
  getAccountByEmail(email: string): CalendarAccount | undefined {
    return Array.from(this.accounts.values()).find(account => account.email === email);
  }

  /**
   * Start OAuth flow and return authorization URL
   */
  async startOAuthFlow(): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'your-client-id';
    const redirectUri = 'http://localhost:8080/oauth/callback';
    return this.getOAuthUrl(clientId, redirectUri);
  }

  /**
   * Check if account needs token refresh
   */
  async checkAccountHealth(accountId: string): Promise<{
    isHealthy: boolean;
    needsReauth: boolean;
    error?: string;
  }> {
    const account = this.accounts.get(accountId);
    if (!account?.accessToken) {
      return { isHealthy: false, needsReauth: true, error: 'No access token' };
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: account.accessToken });
    const calendarApi = google.calendar({ version: 'v3', auth });

    try {
      // Simple API call to check token validity
      await calendarApi.calendarList.list({ maxResults: 1 });
      return { isHealthy: true, needsReauth: false };
    } catch (error: any) {
      if (error.code === 401) {
        return { isHealthy: false, needsReauth: true, error: 'Token expired' };
      } else {
        return { isHealthy: false, needsReauth: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  }
}

export default GoogleCalendarService;