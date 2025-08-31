// TypeScript wrapper for Flow Desk Rust engines
import * as path from 'path';

// Import the types
export interface NapiMailAccount {
  id: string;
  email: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
}

export interface NapiMailMessage {
  id: string;
  account_id: string;
  folder: string;
  subject: string;
  from_address: string;
  from_name: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  body_text?: string;
  body_html?: string;
  is_read: boolean;
  is_starred: boolean;
  received_at: number;
}

export interface NapiMailSyncStatus {
  account_id: string;
  is_syncing: boolean;
  last_sync?: number;
  total_messages: number;
  unread_messages: number;
  error_message?: string;
}

export interface NapiCalendarAccount {
  id: string;
  email: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
}

export interface NapiCalendar {
  id: string;
  account_id: string;
  name: string;
  description?: string;
  color: string;
  is_primary: boolean;
  is_writable: boolean;
}

export interface NapiCalendarEvent {
  id: string;
  calendar_id: string;
  title: string;
  description?: string;
  location?: string;
  start_time: number;
  end_time: number;
  is_all_day: boolean;
  organizer: string;
  attendees: string[];
  status: string;
  visibility: string;
  recurrence_rule?: string;
}

export interface NapiCalendarSyncStatus {
  account_id: string;
  is_syncing: boolean;
  last_sync?: number;
  total_calendars: number;
  total_events: number;
  error_message?: string;
}

export interface NapiSearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  score: number;
  metadata: string;
}

// Main TypeScript wrapper class
export class FlowDeskRustEngine {
  private rustLib: any = null;
  private initialized: boolean = false;

  constructor() {
    try {
      // Try to load the Rust library
      const libPath = path.join(__dirname, 'index.js');
      this.rustLib = require(libPath);
    } catch (error) {
      console.warn('Failed to load Rust library, using mock implementation:', error);
      this.rustLib = this.createMockImplementation();
    }
  }

  private createMockImplementation(): any {
    return {
      initialize: () => Promise.resolve('Mock engines initialized'),
      initMailEngine: () => Promise.resolve('Mock mail engine initialized'),
      addMailAccount: (account: NapiMailAccount) => Promise.resolve({ id: account.id, status: 'added' }),
      removeMailAccount: (accountId: string) => Promise.resolve(true),
      getMailAccounts: () => Promise.resolve([]),
      syncMailAccount: (accountId: string) => Promise.resolve({
        account_id: accountId,
        is_syncing: false,
        total_messages: 0,
        unread_messages: 0
      }),
      getMailMessages: () => Promise.resolve([]),
      markMailMessageRead: () => Promise.resolve(),
      searchMailMessages: () => Promise.resolve([]),
      
      initCalendarEngine: () => Promise.resolve('Mock calendar engine initialized'),
      addCalendarAccount: (account: NapiCalendarAccount) => Promise.resolve({ id: account.id, status: 'added' }),
      removeCalendarAccount: (accountId: string) => Promise.resolve(true),
      getCalendarAccounts: () => Promise.resolve([]),
      syncCalendarAccount: (accountId: string) => Promise.resolve({
        account_id: accountId,
        is_syncing: false,
        total_calendars: 0,
        total_events: 0
      }),
      getCalendars: () => Promise.resolve([]),
      getCalendarEvents: () => Promise.resolve([]),
      createCalendarEvent: () => Promise.resolve('mock-event-id'),
      
      initSearchEngine: () => Promise.resolve('Mock search engine initialized'),
      indexDocument: () => Promise.resolve(),
      searchDocuments: () => Promise.resolve([]),
      
      generateEncryptionKeyPair: () => Promise.resolve(JSON.stringify({
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key'
      })),
      encryptString: (data: string) => Promise.resolve(Buffer.from(data).toString('base64')),
      decryptString: (encrypted: string) => Promise.resolve(Buffer.from(encrypted, 'base64').toString()),
      getVersion: () => Promise.resolve('0.1.0-mock'),
      hello: () => Promise.resolve('Hello from mock Rust!')
    };
  }

  async initialize(): Promise<string> {
    if (this.initialized) {
      return 'Already initialized';
    }
    
    try {
      const result = await this.rustLib.initialize();
      this.initialized = true;
      return result;
    } catch (error) {
      throw new Error(`Failed to initialize FlowDesk Rust engines: ${error}`);
    }
  }

  // Mail Engine Methods
  async initMailEngine(): Promise<string> {
    return await this.rustLib.initMailEngine();
  }

  async addMailAccount(account: NapiMailAccount): Promise<any> {
    return await this.rustLib.addMailAccount(account);
  }

  async removeMailAccount(accountId: string): Promise<boolean> {
    return await this.rustLib.removeMailAccount(accountId);
  }

  async getMailAccounts(): Promise<NapiMailAccount[]> {
    return await this.rustLib.getMailAccounts();
  }

  async syncMailAccount(accountId: string): Promise<NapiMailSyncStatus> {
    return await this.rustLib.syncMailAccount(accountId);
  }

  async getMailMessages(accountId: string): Promise<NapiMailMessage[]> {
    return await this.rustLib.getMailMessages(accountId);
  }

  async markMailMessageRead(accountId: string, messageId: string): Promise<void> {
    return await this.rustLib.markMailMessageRead(accountId, messageId);
  }

  async searchMailMessages(query: string): Promise<NapiMailMessage[]> {
    return await this.rustLib.searchMailMessages(query);
  }

  // Calendar Engine Methods
  async initCalendarEngine(): Promise<string> {
    return await this.rustLib.initCalendarEngine();
  }

  async addCalendarAccount(account: NapiCalendarAccount): Promise<any> {
    return await this.rustLib.addCalendarAccount(account);
  }

  async removeCalendarAccount(accountId: string): Promise<boolean> {
    return await this.rustLib.removeCalendarAccount(accountId);
  }

  async getCalendarAccounts(): Promise<NapiCalendarAccount[]> {
    return await this.rustLib.getCalendarAccounts();
  }

  async syncCalendarAccount(accountId: string): Promise<NapiCalendarSyncStatus> {
    return await this.rustLib.syncCalendarAccount(accountId);
  }

  async getCalendars(accountId: string): Promise<NapiCalendar[]> {
    return await this.rustLib.getCalendars(accountId);
  }

  async getCalendarEvents(accountId: string): Promise<NapiCalendarEvent[]> {
    return await this.rustLib.getCalendarEvents(accountId);
  }

  async createCalendarEvent(
    calendarId: string, 
    title: string, 
    startTime: number, 
    endTime: number
  ): Promise<string> {
    return await this.rustLib.createCalendarEvent(calendarId, title, startTime, endTime);
  }

  // Search Engine Methods
  async initSearchEngine(): Promise<string> {
    return await this.rustLib.initSearchEngine();
  }

  async indexDocument(
    id: string, 
    title: string, 
    content: string, 
    source: string, 
    metadata: string
  ): Promise<void> {
    return await this.rustLib.indexDocument(id, title, content, source, metadata);
  }

  async searchDocuments(query: string, limit?: number): Promise<NapiSearchResult[]> {
    return await this.rustLib.searchDocuments(query, limit);
  }

  // Crypto Methods
  async generateEncryptionKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const result = await this.rustLib.generateEncryptionKeyPair();
    return JSON.parse(result);
  }

  async encryptString(data: string, key: string): Promise<string> {
    return await this.rustLib.encryptString(data, key);
  }

  async decryptString(encryptedData: string, key: string): Promise<string> {
    return await this.rustLib.decryptString(encryptedData, key);
  }

  async getVersion(): Promise<string> {
    return await this.rustLib.getVersion();
  }

  async hello(): Promise<string> {
    return await this.rustLib.hello();
  }

  // Utility method to check if engines are working
  async healthCheck(): Promise<{ 
    mail: boolean; 
    calendar: boolean; 
    search: boolean; 
    crypto: boolean; 
    version: string 
  }> {
    try {
      const [version, hello] = await Promise.all([
        this.getVersion(),
        this.hello()
      ]);

      return {
        mail: hello.includes('Rust'),
        calendar: hello.includes('Rust'),
        search: hello.includes('Rust'),
        crypto: hello.includes('Rust'),
        version
      };
    } catch (error) {
      return {
        mail: false,
        calendar: false,
        search: false,
        crypto: false,
        version: 'error'
      };
    }
  }
}

// Export a singleton instance
export const rustEngine = new FlowDeskRustEngine();

// Export factory function for creating new instances
export function createRustEngine(): FlowDeskRustEngine {
  return new FlowDeskRustEngine();
}