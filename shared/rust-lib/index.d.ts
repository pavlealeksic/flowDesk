// TypeScript definitions for Flow Desk Rust library

// Mail Types
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
  received_at: number; // Unix timestamp
}

export interface NapiMailSyncStatus {
  account_id: string;
  is_syncing: boolean;
  last_sync?: number;
  total_messages: number;
  unread_messages: number;
  error_message?: string;
}

// Calendar Types
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

// Search Types
export interface NapiSearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  score: number;
  metadata: string; // JSON string
}

// Main Engine Class
export class RustEngineWrapper {
  constructor();
  
  // Mail Engine Methods
  initMailEngine(): Promise<string>;
  addMailAccount(account: NapiMailAccount): Promise<any>;
  removeMailAccount(accountId: string): Promise<any>;
  getMailAccounts(): Promise<NapiMailAccount[]>;
  syncMailAccount(accountId: string): Promise<NapiMailSyncStatus>;
  getMailMessages(accountId: string): Promise<NapiMailMessage[]>;
  markMailMessageRead(accountId: string, messageId: string): Promise<void>;
  searchMailMessages(query: string): Promise<NapiMailMessage[]>;
  
  // Calendar Engine Methods
  initCalendarEngine(): Promise<string>;
  addCalendarAccount(account: NapiCalendarAccount): Promise<any>;
  removeCalendarAccount(accountId: string): Promise<any>;
  getCalendarAccounts(): Promise<NapiCalendarAccount[]>;
  syncCalendarAccount(accountId: string): Promise<NapiCalendarSyncStatus>;
  getCalendars(accountId: string): Promise<NapiCalendar[]>;
  getCalendarEvents(accountId: string): Promise<NapiCalendarEvent[]>;
  createCalendarEvent(calendarId: string, title: string, startTime: number, endTime: number): Promise<string>;
  
  // Search Engine Methods
  initSearchEngine(): Promise<string>;
  indexDocument(id: string, title: string, content: string, source: string, metadata: string): Promise<void>;
  searchDocuments(query: string, limit?: number): Promise<NapiSearchResult[]>;
  
  // Crypto Methods
  generateEncryptionKeyPair(): Promise<string>;
  encryptString(data: string, key: string): Promise<string>;
  decryptString(encryptedData: string, key: string): Promise<string>;
  getVersion(): Promise<string>;
}

// Main exports
export const engine: RustEngineWrapper;

// Mail Engine Functions
export function initMailEngine(): Promise<string>;
export function addMailAccount(account: NapiMailAccount): Promise<any>;
export function removeMailAccount(accountId: string): Promise<any>;
export function getMailAccounts(): Promise<NapiMailAccount[]>;
export function syncMailAccount(accountId: string): Promise<NapiMailSyncStatus>;
export function getMailMessages(accountId: string): Promise<NapiMailMessage[]>;
export function markMailMessageRead(accountId: string, messageId: string): Promise<void>;
export function searchMailMessages(query: string): Promise<NapiMailMessage[]>;

// Calendar Engine Functions
export function initCalendarEngine(): Promise<string>;
export function addCalendarAccount(account: NapiCalendarAccount): Promise<any>;
export function removeCalendarAccount(accountId: string): Promise<any>;
export function getCalendarAccounts(): Promise<NapiCalendarAccount[]>;
export function syncCalendarAccount(accountId: string): Promise<NapiCalendarSyncStatus>;
export function getCalendars(accountId: string): Promise<NapiCalendar[]>;
export function getCalendarEvents(accountId: string): Promise<NapiCalendarEvent[]>;
export function createCalendarEvent(calendarId: string, title: string, startTime: number, endTime: number): Promise<string>;

// Search Engine Functions
export function initSearchEngine(indexDir?: string): Promise<string>;
export function indexDocument(id: string, title: string, content: string, source: string, metadata: string): Promise<void>;
export function searchDocuments(query: any): Promise<{ results: NapiSearchResult[], total_count: number, execution_time_ms: number, suggestions?: string[] }>;
export function searchSimple(query: string, limit?: number): Promise<NapiSearchResult[]>;
export function getSearchSuggestions(partialQuery: string, limit?: number): Promise<string[]>;
export function indexEmailMessage(messageId: string, accountId: string, subject: string, fromAddress: string, fromName: string | null, toAddresses: string[], bodyText: string | null, bodyHtml: string | null, receivedAt: number, folder: string | null): Promise<void>;
export function indexCalendarEvent(eventId: string, calendarId: string, title: string, description: string | null, location: string | null, startTime: number, endTime: number, isAllDay: boolean, organizer: string | null, attendees: string[], status: string): Promise<void>;
export function deleteDocumentFromIndex(documentId: string): Promise<boolean>;
export function optimizeSearchIndex(): Promise<void>;
export function getSearchAnalytics(): Promise<{ total_documents: number, total_searches: number, avg_response_time_ms: number, success_rate: number, error_rate: number, popular_queries: string[] }>;
export function clearSearchCache(): Promise<void>;

// Crypto Functions
export function generateEncryptionKeyPair(): Promise<string>;
export function encryptString(data: string, key: string): Promise<string>;
export function decryptString(encryptedData: string, key: string): Promise<string>;
export function getVersion(): Promise<string>;

// OAuth Types
export interface NapiOAuthProviderConfig {
  provider: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  requiresClientSecret: boolean;
  supportsPkce: boolean;
}

export interface NapiOAuthFlowOptions {
  provider: string;
  interactive?: boolean;
  forceConsent?: boolean;
  loginHint?: string;
  usePkce?: boolean;
  additionalScopes?: string[];
}

export interface NapiOAuthAuthUrl {
  url: string;
  state: string;
  codeVerifier?: string;
  codeChallenge?: string;
}

export interface NapiOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
}

export interface NapiOAuthUserInfo {
  email: string;
  name?: string;
  picture?: string;
  verifiedEmail?: boolean;
}

export interface NapiOAuthCallbackResult {
  tokens: NapiOAuthTokens;
  userInfo: NapiOAuthUserInfo;
}

// OAuth Functions
export function initProductionOauthManager(storagePath?: string): Promise<void>;
export function configureOauthProvider(config: NapiOAuthProviderConfig): Promise<void>;
export function startOauthFlow(options: NapiOAuthFlowOptions): Promise<NapiOAuthAuthUrl>;
export function handleOauthCallbackExchange(provider: string, code: string, state: string, redirectUri: string): Promise<NapiOAuthCallbackResult>;
export function refreshOauthTokenProduction(provider: string, refreshToken: string): Promise<NapiOAuthTokens>;
export function revokeOauthTokenProduction(provider: string, accessToken: string): Promise<void>;
export function needsOauthTokenRefresh(expiresAt?: number): Promise<boolean>;
export function validateOauthToken(token: string): Promise<boolean>;
export function cleanupExpiredPkceSessions(): Promise<number>;

// Utility Functions
export function hello(): Promise<string>;
export function initialize(): Promise<string>;

// Export types
export const types: {
  NapiMailAccount: string;
  NapiMailMessage: string;
  NapiMailSyncStatus: string;
  NapiCalendarAccount: string;
  NapiCalendar: string;
  NapiCalendarEvent: string;
  NapiCalendarSyncStatus: string;
  NapiSearchResult: string;
};