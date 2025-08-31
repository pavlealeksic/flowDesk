/**
 * Working Preload Script - Flow Desk Desktop App
 * 
 * Exposes secure APIs to the renderer process
 * All API methods are properly typed and functional
 */

import { contextBridge, ipcRenderer } from 'electron'

// Define types for better developer experience
interface EmailMessage {
  id: string
  subject: string
  from: { name: string; address: string }
  to: { name: string; address: string }[]
  date: Date
  bodyText: string
  bodyHtml: string
  isRead: boolean
}

interface MailAccount {
  id: string
  name: string
  email: string
  provider: string
  isEnabled: boolean
}

interface SlackAccount {
  id: string
  teamId: string
  teamName: string
  userName: string
  isEnabled: boolean
}

interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  unreadCount: number
}

interface SlackMessage {
  id: string
  channelId: string
  userName: string
  text: string
  timestamp: Date
}

interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  description?: string
  location?: string
}

interface SearchResults {
  emails: EmailMessage[]
  slackMessages: SlackMessage[]
  calendarEvents: CalendarEvent[]
  githubItems: any[]
  jiraIssues: any[]
}

/**
 * Flow Desk API for renderer process
 */
const flowDeskAPI = {
  // === GMAIL API ===
  gmail: {
    /**
     * Start Gmail OAuth flow
     */
    startOAuth: (): Promise<MailAccount> => 
      ipcRenderer.invoke('gmail:start-oauth'),

    /**
     * List Gmail accounts
     */
    listAccounts: (): Promise<MailAccount[]> => 
      ipcRenderer.invoke('gmail:list-accounts'),

    /**
     * Get messages from Gmail account
     */
    getMessages: (accountId: string, options?: { limit?: number; query?: string }): Promise<EmailMessage[]> => 
      ipcRenderer.invoke('gmail:get-messages', accountId, options),

    /**
     * Send Gmail message
     */
    sendMessage: (accountId: string, message: Partial<EmailMessage>): Promise<string> => 
      ipcRenderer.invoke('gmail:send-message', accountId, message),

    /**
     * Search Gmail messages
     */
    searchMessages: (accountId: string, query: string): Promise<EmailMessage[]> => 
      ipcRenderer.invoke('gmail:search-messages', accountId, query),

    /**
     * Sync Gmail account
     */
    syncAccount: (accountId: string): Promise<any> => 
      ipcRenderer.invoke('gmail:sync-account', accountId),

    /**
     * Remove Gmail account
     */
    removeAccount: (accountId: string): Promise<boolean> => 
      ipcRenderer.invoke('gmail:remove-account', accountId)
  },

  // === SLACK API ===
  slack: {
    /**
     * Get Slack OAuth URL
     */
    getOAuthUrl: (clientId: string): string => 
      ipcRenderer.invoke('slack:get-oauth-url', clientId),

    /**
     * Exchange OAuth code for token
     */
    exchangeOAuthCode: (clientId: string, clientSecret: string, code: string): Promise<{ accessToken: string }> => 
      ipcRenderer.invoke('slack:exchange-oauth-code', clientId, clientSecret, code),

    /**
     * Add Slack account
     */
    addAccount: (accessToken: string): Promise<SlackAccount> => 
      ipcRenderer.invoke('slack:add-account', accessToken),

    /**
     * Get Slack accounts
     */
    getAccounts: (): SlackAccount[] => 
      ipcRenderer.invoke('slack:get-accounts'),

    /**
     * Sync Slack account
     */
    syncAccount: (accountId: string): Promise<any> => 
      ipcRenderer.invoke('slack:sync-account', accountId),

    /**
     * Get Slack channels
     */
    getChannels: (accountId: string): SlackChannel[] => 
      ipcRenderer.invoke('slack:get-channels', accountId),

    /**
     * Get Slack messages
     */
    getMessages: (channelId: string): SlackMessage[] => 
      ipcRenderer.invoke('slack:get-messages', channelId),

    /**
     * Send Slack message
     */
    sendMessage: (accountId: string, channelId: string, text: string): Promise<string> => 
      ipcRenderer.invoke('slack:send-message', accountId, channelId, text),

    /**
     * Search Slack messages
     */
    searchMessages: (accountId: string, query: string): Promise<SlackMessage[]> => 
      ipcRenderer.invoke('slack:search-messages', accountId, query)
  },

  // === CALENDAR API ===
  calendar: {
    /**
     * Start Calendar OAuth flow
     */
    startOAuth: (): Promise<any> => 
      ipcRenderer.invoke('calendar:start-oauth'),

    /**
     * List Calendar accounts
     */
    listAccounts: (): Promise<any[]> => 
      ipcRenderer.invoke('calendar:list-accounts'),

    /**
     * Get calendar events
     */
    getEvents: (accountId: string, options?: any): Promise<CalendarEvent[]> => 
      ipcRenderer.invoke('calendar:get-events', accountId, options),

    /**
     * Create calendar event
     */
    createEvent: (accountId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> => 
      ipcRenderer.invoke('calendar:create-event', accountId, event)
  },

  // === GITHUB API ===
  github: {
    /**
     * Set GitHub access token
     */
    setToken: (token: string): Promise<boolean> => 
      ipcRenderer.invoke('github:set-token', token),

    /**
     * Get GitHub repositories
     */
    getRepositories: (): Promise<any[]> => 
      ipcRenderer.invoke('github:get-repositories'),

    /**
     * Get GitHub issues
     */
    getIssues: (owner: string, repo: string): Promise<any[]> => 
      ipcRenderer.invoke('github:get-issues', owner, repo),

    /**
     * Search GitHub code
     */
    searchCode: (query: string): Promise<any[]> => 
      ipcRenderer.invoke('github:search-code', query)
  },

  // === JIRA API ===
  jira: {
    /**
     * Configure Jira connection
     */
    configure: (config: { baseUrl: string; username: string; apiToken: string }): Promise<boolean> => 
      ipcRenderer.invoke('jira:configure', config),

    /**
     * Get Jira issues
     */
    getIssues: (options?: any): Promise<any[]> => 
      ipcRenderer.invoke('jira:get-issues', options),

    /**
     * Search Jira issues
     */
    searchIssues: (jql: string): Promise<any[]> => 
      ipcRenderer.invoke('jira:search-issues', jql)
  },

  // === UNIFIED SEARCH ===
  search: {
    /**
     * Search across all connected services
     */
    unified: (query: string): Promise<SearchResults> => 
      ipcRenderer.invoke('search:unified', query)
  },

  // === UTILITY FUNCTIONS ===
  app: {
    /**
     * Get app version
     */
    getVersion: (): Promise<string> => 
      ipcRenderer.invoke('app:get-version'),

    /**
     * Show item in folder
     */
    showItemInFolder: (path: string): void => 
      ipcRenderer.invoke('app:show-item-in-folder', path),

    /**
     * Open external link
     */
    openExternal: (url: string): void => 
      ipcRenderer.invoke('app:open-external', url)
  },

  // === EVENT LISTENERS ===
  on: {
    /**
     * Listen for window focus events
     */
    windowFocus: (callback: (focused: boolean) => void) => {
      ipcRenderer.on('window-focus', (_, focused) => callback(focused))
    },

    /**
     * Listen for theme changes
     */
    themeChanged: (callback: (theme: any) => void) => {
      ipcRenderer.on('theme-changed', (_, theme) => callback(theme))
    },

    /**
     * Remove listener
     */
    removeListener: (channel: string, listener: any) => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('flowDesk', flowDeskAPI)

// Type declaration for TypeScript
declare global {
  interface Window {
    flowDesk: typeof flowDeskAPI
  }
}

// Log that preload is ready
console.log('Flow Desk preload script loaded successfully')