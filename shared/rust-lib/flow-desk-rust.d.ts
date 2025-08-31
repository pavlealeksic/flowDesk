/**
 * Flow Desk Rust Library TypeScript Declarations
 */

// FFI approach classes
export declare class FlowDeskRust {
  constructor();
  init(): void;
  getVersion(): string;
  test(): string;
  encryptData(data: string, key: string): string;
  decryptData(encryptedData: string, key: string): string;
  hashPassword(password: string): string;
}

export declare class RustSearchEngine {
  constructor();
  addDocument(id: string, title: string, content: string, source?: string): boolean;
  search(query: string, limit?: number): SearchResult[];
  destroy(): void;
}

export declare class RustMailEngine {
  constructor();
  addAccount(accountId: string, email: string, provider: string, displayName: string): boolean;
  destroy(): void;
}

export declare class RustCalendarEngine {
  constructor();
  addAccount(accountId: string, email: string, provider: string, displayName: string): boolean;
  destroy(): void;
}

// Search result interface
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  score: number;
  metadata: string;
}

// Default export
declare const flowDeskRust: FlowDeskRust;
export default flowDeskRust;

// NAPI approach (if available)
export declare function hello(): string;

// Crypto functions (NAPI style)
export declare namespace crypto {
  export function encryptData(data: string, key: string): Promise<string>;
  export function decryptData(encryptedData: string, key: string): Promise<string>;
  export function hashPassword(password: string): Promise<string>;
}

// Search functions (NAPI style) 
export declare namespace search {
  export class SearchEngine {
    constructor();
    initialize(): Promise<void>;
    indexDocument(id: string, title: string, content: string, source: string, metadata: string): Promise<void>;
    search(query: string, limit: number): Promise<SearchResult[]>;
    removeDocument(id: string): Promise<void>;
    clearIndex(): Promise<void>;
    indexSampleData(): Promise<void>;
  }
}

// Mail functions (NAPI style)
export declare namespace mail {
  export interface MailAccount {
    id: string;
    email: string;
    provider: string;
    displayName: string;
    isEnabled: boolean;
  }

  export interface MailMessage {
    id: string;
    accountId: string;
    folder: string;
    subject: string;
    fromAddress: string;
    fromName: string;
    toAddresses: string[];
    ccAddresses: string[];
    bccAddresses: string[];
    bodyText?: string;
    bodyHtml?: string;
    isRead: boolean;
    isStarred: boolean;
    receivedAt: Date;
    attachments: MailAttachment[];
  }

  export interface MailAttachment {
    id: string;
    filename: string;
    contentType: string;
    size: number;
  }

  export interface MailSyncStatus {
    accountId: string;
    isSyncing: boolean;
    lastSync?: Date;
    totalMessages: number;
    unreadMessages: number;
    errorMessage?: string;
  }

  export class MailEngine {
    constructor();
    addAccount(account: MailAccount): Promise<void>;
    removeAccount(accountId: string): Promise<void>;
    getAccounts(): MailAccount[];
    getAccount(accountId: string): MailAccount | null;
    syncAccount(accountId: string): Promise<MailSyncStatus>;
    getMessages(accountId: string): MailMessage[];
    markMessageRead(accountId: string, messageId: string): Promise<void>;
    searchMessages(query: string): MailMessage[];
  }
}

// Calendar functions (NAPI style)
export declare namespace calendar {
  export interface CalendarAccount {
    id: string;
    email: string;
    provider: string;
    displayName: string;
    isEnabled: boolean;
  }

  export interface Calendar {
    id: string;
    accountId: string;
    name: string;
    description?: string;
    color: string;
    isPrimary: boolean;
    isWritable: boolean;
  }

  export interface CalendarEvent {
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
    recurrenceRule?: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface CalendarSyncStatus {
    accountId: string;
    isSyncing: boolean;
    lastSync?: Date;
    totalCalendars: number;
    totalEvents: number;
    errorMessage?: string;
  }

  export interface PrivacySyncConfig {
    enabled: boolean;
    syncTitle: boolean;
    syncDescription: boolean;
    syncAttendees: boolean;
    placeholderTitle: string;
  }

  export class CalendarEngine {
    constructor();
    addAccount(account: CalendarAccount): Promise<void>;
    removeAccount(accountId: string): Promise<void>;
    getAccounts(): CalendarAccount[];
    getAccount(accountId: string): CalendarAccount | null;
    syncAccount(accountId: string): Promise<CalendarSyncStatus>;
    getCalendars(accountId: string): Calendar[];
    getEvents(accountId: string): CalendarEvent[];
    getEventsInRange(accountId: string, start: Date, end: Date): CalendarEvent[];
    createEvent(calendarId: string, title: string, startTime: Date, endTime: Date): Promise<string>;
    setPrivacyConfig(accountId: string, config: PrivacySyncConfig): void;
    getPrivacyConfig(accountId: string): PrivacySyncConfig;
    expandRecurringEvents(event: CalendarEvent, start: Date, end: Date): CalendarEvent[];
  }
}