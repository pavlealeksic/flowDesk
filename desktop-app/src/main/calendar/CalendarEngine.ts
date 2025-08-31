/**
 * Calendar Engine
 * Handles calendar operations and account management
 */

export interface CalendarAccount {
  id: string;
  email: string;
  provider: string;
  displayName: string;
  isEnabled: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  attendees: string[];
  location?: string;
}

export interface Calendar {
  id: string;
  accountId: string;
  name: string;
  description?: string;
  color: string;
  isPrimary: boolean;
}

export class CalendarEngine {
  private accounts: Map<string, CalendarAccount> = new Map();
  private calendars: Map<string, Calendar[]> = new Map();
  private events: Map<string, CalendarEvent[]> = new Map();

  async addAccount(account: CalendarAccount): Promise<void> {
    this.accounts.set(account.id, account);
    this.calendars.set(account.id, []);
    this.events.set(account.id, []);
  }

  async removeAccount(accountId: string): Promise<void> {
    this.accounts.delete(accountId);
    this.calendars.delete(accountId);
    this.events.delete(accountId);
  }

  getAccount(accountId: string): CalendarAccount | undefined {
    return this.accounts.get(accountId);
  }

  getAccounts(): CalendarAccount[] {
    return Array.from(this.accounts.values());
  }

  async getCalendars(accountId: string): Promise<Calendar[]> {
    return this.calendars.get(accountId) || [];
  }

  async getEvents(accountId: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    const events = this.events.get(accountId) || [];
    
    if (startDate && endDate) {
      return events.filter(event => 
        event.startTime >= startDate && event.endTime <= endDate
      );
    }
    
    return events;
  }

  async createEvent(data: {
    calendarId: string;
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    isAllDay?: boolean;
    attendees?: string[];
  }): Promise<CalendarEvent> {
    const eventId = `event-${Date.now()}`;
    const newEvent: CalendarEvent = {
      id: eventId,
      calendarId: data.calendarId,
      title: data.title,
      description: data.description,
      location: data.location,
      startTime: data.startTime,
      endTime: data.endTime,
      isAllDay: data.isAllDay || false,
      attendees: data.attendees || []
    };

    // Find the account for this calendar
    for (const [accountId, accountEvents] of this.events.entries()) {
      const calendars = this.calendars.get(accountId) || [];
      if (calendars.some(cal => cal.id === data.calendarId)) {
        accountEvents.push(newEvent);
        break;
      }
    }

    return newEvent;
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    for (const events of this.events.values()) {
      const event = events.find(e => e.id === eventId);
      if (event) {
        Object.assign(event, updates);
        return event;
      }
    }
    throw new Error(`Event ${eventId} not found`);
  }

  async deleteEvent(eventId: string): Promise<void> {
    for (const events of this.events.values()) {
      const index = events.findIndex(e => e.id === eventId);
      if (index !== -1) {
        events.splice(index, 1);
        break;
      }
    }
  }
}

export const calendarEngine = new CalendarEngine();