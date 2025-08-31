/**
 * Microsoft Teams Plugin - Complete Integration
 * 
 * Production-ready Microsoft Teams integration with real-time messaging,
 * OAuth2 authentication, search indexing, automation triggers, and comprehensive API coverage.
 */

import {
  PluginAPI,
  SearchResult,
  NotificationOptions,
  TriggerDefinition,
  ActionDefinition,
  SearchableContent
} from '../../../shared/src/types/plugin';

import {
  TeamsUser,
  TeamsTeam,
  TeamsChannel,
  TeamsMessage,
  TeamsChat,
  TeamsOnlineMeeting,
  TeamsCalendarEvent,
  TeamsPresence,
  TeamsNotification,
  TeamsSubscription,
  TeamsPluginConfig,
  TeamsAuthTokens,
  TeamsApiResponse,
  TeamsSearchResult,
  TeamsRateLimitInfo,
  TeamsWebSocketMessage,
  TeamsAutomationTrigger,
  TeamsAutomationAction,
  TeamsFile
} from '../types/teams-types';

export class TeamsPlugin {
  private api: PluginAPI;
  private config: TeamsPluginConfig;
  private authTokens: TeamsAuthTokens | null = null;
  private rateLimitInfo: Map<string, TeamsRateLimitInfo> = new Map();
  private subscriptions: Map<string, TeamsSubscription> = new Map();
  private websocketConnections: Map<string, WebSocket> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private messageCache: Map<string, TeamsMessage[]> = new Map();
  private presenceCache: Map<string, TeamsPresence> = new Map();
  private retryQueues: Map<string, Array<() => Promise<void>>> = new Map();
  private isInitialized = false;

  // Microsoft Graph API endpoints
  private readonly GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
  private readonly GRAPH_API_BETA = 'https://graph.microsoft.com/beta';
  private readonly AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
  private readonly TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  // Required scopes for comprehensive Teams integration
  private readonly OAUTH_SCOPES = [
    'https://graph.microsoft.com/User.Read',
    'https://graph.microsoft.com/User.Read.All',
    'https://graph.microsoft.com/Presence.Read',
    'https://graph.microsoft.com/Presence.Read.All',
    'https://graph.microsoft.com/Presence.ReadWrite',
    'https://graph.microsoft.com/Team.ReadBasic.All',
    'https://graph.microsoft.com/TeamMember.Read.All',
    'https://graph.microsoft.com/Channel.ReadBasic.All',
    'https://graph.microsoft.com/ChannelMessage.Read.All',
    'https://graph.microsoft.com/ChannelMessage.Send',
    'https://graph.microsoft.com/Chat.Read',
    'https://graph.microsoft.com/Chat.ReadWrite',
    'https://graph.microsoft.com/ChatMessage.Read',
    'https://graph.microsoft.com/ChatMessage.Send',
    'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'https://graph.microsoft.com/Files.ReadWrite.All',
    'https://graph.microsoft.com/Directory.Read.All',
    'offline_access'
  ];

  constructor(api: PluginAPI) {
    this.api = api;
    this.config = this.getDefaultConfig();
    this.setupEventListeners();
    this.registerAutomationTriggers();
    this.registerAutomationActions();
  }

  /**
   * Initialize the plugin
   */
  async initialize(): Promise<void> {
    try {
      this.api.logger.info('Initializing Microsoft Teams plugin...');
      
      // Load configuration
      const savedConfig = await this.api.storage.get<TeamsPluginConfig>('config');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }

      // Load authentication tokens
      this.authTokens = await this.api.storage.get<TeamsAuthTokens>('auth_tokens');
      
      if (this.authTokens) {
        // Check if tokens are valid
        if (this.isTokenExpired(this.authTokens)) {
          await this.refreshAccessToken();
        }
        
        // Initialize real-time connections
        await this.initializeRealTimeConnections();
        
        // Start background sync
        this.startBackgroundSync();
        
        // Register search provider
        this.registerSearchProvider();
      }

      this.isInitialized = true;
      this.api.logger.info('Microsoft Teams plugin initialized successfully');
    } catch (error) {
      this.api.logger.error('Failed to initialize Microsoft Teams plugin:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Microsoft Teams using OAuth2
   */
  async authenticate(): Promise<void> {
    try {
      this.api.logger.info('Starting Teams OAuth authentication...');
      
      const authUrl = await this.buildAuthUrl();
      const authCode = await this.api.oauth.startFlow('microsoft', this.OAUTH_SCOPES);
      
      const tokens = await this.exchangeAuthCode(authCode);
      this.authTokens = tokens;
      
      await this.api.storage.set('auth_tokens', tokens);
      
      // Initialize post-authentication setup
      await this.initializeRealTimeConnections();
      this.startBackgroundSync();
      this.registerSearchProvider();
      
      this.api.ui.showNotification({
        title: 'Microsoft Teams Connected',
        body: 'Successfully authenticated with Microsoft Teams',
        timeout: 5000
      });
      
      this.api.logger.info('Teams authentication completed successfully');
    } catch (error) {
      this.api.logger.error('Teams authentication failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Microsoft Teams
   */
  async disconnect(): Promise<void> {
    try {
      this.api.logger.info('Disconnecting from Microsoft Teams...');
      
      // Close WebSocket connections
      for (const [id, ws] of this.websocketConnections) {
        ws.close();
        this.websocketConnections.delete(id);
      }
      
      // Clear intervals
      for (const [id, interval] of this.syncIntervals) {
        clearInterval(interval);
        this.syncIntervals.delete(id);
      }
      
      // Delete subscriptions
      for (const [id, subscription] of this.subscriptions) {
        await this.deleteSubscription(subscription.id);
      }
      
      // Clear stored data
      await this.api.storage.remove('auth_tokens');
      this.authTokens = null;
      
      // Clear caches
      this.messageCache.clear();
      this.presenceCache.clear();
      this.rateLimitInfo.clear();
      
      this.api.ui.showNotification({
        title: 'Microsoft Teams Disconnected',
        body: 'Successfully disconnected from Microsoft Teams',
        timeout: 5000
      });
      
      this.api.logger.info('Teams disconnection completed');
    } catch (error) {
      this.api.logger.error('Teams disconnection failed:', error);
      throw error;
    }
  }

  /**
   * Send a message to a Teams channel or chat
   */
  async sendMessage(targetId: string, content: string, targetType: 'channel' | 'chat' = 'channel'): Promise<TeamsMessage> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = targetType === 'channel' 
        ? `${this.GRAPH_API_BASE}/teams/{team-id}/channels/${targetId}/messages`
        : `${this.GRAPH_API_BASE}/chats/${targetId}/messages`;
      
      const messageBody = {
        body: {
          contentType: 'html',
          content: this.sanitizeMessageContent(content)
        }
      };
      
      const response = await this.makeApiRequest('POST', endpoint, messageBody);
      const message = response as TeamsMessage;
      
      // Update cache
      this.updateMessageCache(targetId, message);
      
      // Index for search
      await this.indexMessage(message);
      
      this.api.logger.info(`Message sent to ${targetType}: ${targetId}`);
      return message;
    } catch (error) {
      this.api.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Get teams for the authenticated user
   */
  async getTeams(): Promise<TeamsTeam[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.GRAPH_API_BASE}/me/joinedTeams`;
      const response = await this.makeApiRequest('GET', endpoint);
      
      const teams = (response as TeamsApiResponse<TeamsTeam>).value || [];
      
      this.api.logger.info(`Retrieved ${teams.length} teams`);
      return teams;
    } catch (error) {
      this.api.logger.error('Failed to get teams:', error);
      throw error;
    }
  }

  /**
   * Get channels for a specific team
   */
  async getChannels(teamId: string): Promise<TeamsChannel[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.GRAPH_API_BASE}/teams/${teamId}/channels`;
      const response = await this.makeApiRequest('GET', endpoint);
      
      const channels = (response as TeamsApiResponse<TeamsChannel>).value || [];
      
      // Update channels with team ID
      channels.forEach(channel => {
        channel.teamId = teamId;
      });
      
      this.api.logger.info(`Retrieved ${channels.length} channels for team: ${teamId}`);
      return channels;
    } catch (error) {
      this.api.logger.error(`Failed to get channels for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Get messages from a channel
   */
  async getChannelMessages(teamId: string, channelId: string, limit: number = 50): Promise<TeamsMessage[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.GRAPH_API_BASE}/teams/${teamId}/channels/${channelId}/messages`;
      const params = new URLSearchParams({
        '$top': limit.toString(),
        '$expand': 'replies',
        '$orderby': 'createdDateTime desc'
      });
      
      const response = await this.makeApiRequest('GET', `${endpoint}?${params}`);
      const messages = (response as TeamsApiResponse<TeamsMessage>).value || [];
      
      // Update cache
      this.messageCache.set(channelId, messages);
      
      // Index messages for search
      for (const message of messages) {
        await this.indexMessage(message);
      }
      
      this.api.logger.info(`Retrieved ${messages.length} messages from channel: ${channelId}`);
      return messages;
    } catch (error) {
      this.api.logger.error(`Failed to get messages for channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Get chats for the authenticated user
   */
  async getChats(): Promise<TeamsChat[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.GRAPH_API_BASE}/me/chats`;
      const params = new URLSearchParams({
        '$expand': 'members,lastMessagePreview',
        '$orderby': 'lastUpdatedDateTime desc'
      });
      
      const response = await this.makeApiRequest('GET', `${endpoint}?${params}`);
      const chats = (response as TeamsApiResponse<TeamsChat>).value || [];
      
      this.api.logger.info(`Retrieved ${chats.length} chats`);
      return chats;
    } catch (error) {
      this.api.logger.error('Failed to get chats:', error);
      throw error;
    }
  }

  /**
   * Get messages from a chat
   */
  async getChatMessages(chatId: string, limit: number = 50): Promise<TeamsMessage[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.GRAPH_API_BASE}/chats/${chatId}/messages`;
      const params = new URLSearchParams({
        '$top': limit.toString(),
        '$orderby': 'createdDateTime desc'
      });
      
      const response = await this.makeApiRequest('GET', `${endpoint}?${params}`);
      const messages = (response as TeamsApiResponse<TeamsMessage>).value || [];
      
      // Update cache
      this.messageCache.set(chatId, messages);
      
      // Index messages for search
      for (const message of messages) {
        await this.indexMessage(message);
      }
      
      this.api.logger.info(`Retrieved ${messages.length} messages from chat: ${chatId}`);
      return messages;
    } catch (error) {
      this.api.logger.error(`Failed to get messages for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Create an online meeting
   */
  async createOnlineMeeting(meeting: Partial<TeamsOnlineMeeting>): Promise<TeamsOnlineMeeting> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.GRAPH_API_BASE}/me/onlineMeetings`;
      
      const meetingData = {
        startDateTime: meeting.startDateTime || new Date(),
        endDateTime: meeting.endDateTime || new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        subject: meeting.subject || 'Flow Desk Meeting',
        ...meeting
      };
      
      const response = await this.makeApiRequest('POST', endpoint, meetingData);
      const createdMeeting = response as TeamsOnlineMeeting;
      
      this.api.ui.showNotification({
        title: 'Meeting Created',
        body: `Meeting "${createdMeeting.subject}" created successfully`,
        actions: [
          {
            action: 'join',
            title: 'Join Meeting'
          },
          {
            action: 'copy_link',
            title: 'Copy Link'
          }
        ]
      });
      
      this.api.logger.info(`Created online meeting: ${createdMeeting.id}`);
      return createdMeeting;
    } catch (error) {
      this.api.logger.error('Failed to create online meeting:', error);
      throw error;
    }
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId?: string): Promise<TeamsPresence> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = userId 
        ? `${this.GRAPH_API_BASE}/users/${userId}/presence`
        : `${this.GRAPH_API_BASE}/me/presence`;
      
      const response = await this.makeApiRequest('GET', endpoint);
      const presence = response as TeamsPresence;
      
      // Update cache
      this.presenceCache.set(userId || 'me', presence);
      
      return presence;
    } catch (error) {
      this.api.logger.error(`Failed to get presence for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user presence
   */
  async updatePresence(availability: string, activity: string, message?: string): Promise<void> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.GRAPH_API_BASE}/me/presence/setUserPreferredPresence`;
      
      const presenceData: any = {
        availability,
        activity
      };
      
      if (message) {
        presenceData.statusMessage = {
          message: {
            content: message,
            contentType: 'text'
          }
        };
      }
      
      await this.makeApiRequest('POST', endpoint, presenceData);
      
      // Update cache
      const updatedPresence = await this.getUserPresence();
      this.presenceCache.set('me', updatedPresence);
      
      this.api.logger.info(`Updated presence: ${availability} - ${activity}`);
    } catch (error) {
      this.api.logger.error('Failed to update presence:', error);
      throw error;
    }
  }

  /**
   * Search across Teams content
   */
  async search(query: string, contentTypes: string[] = ['message', 'channel', 'team', 'chat']): Promise<TeamsSearchResult[]> {
    try {
      this.ensureAuthenticated();
      
      const results: TeamsSearchResult[] = [];
      
      // Search messages
      if (contentTypes.includes('message')) {
        const messageResults = await this.searchMessages(query);
        results.push(...messageResults);
      }
      
      // Search teams
      if (contentTypes.includes('team')) {
        const teamResults = await this.searchTeams(query);
        results.push(...teamResults);
      }
      
      // Search channels
      if (contentTypes.includes('channel')) {
        const channelResults = await this.searchChannels(query);
        results.push(...channelResults);
      }
      
      // Search chats
      if (contentTypes.includes('chat')) {
        const chatResults = await this.searchChats(query);
        results.push(...chatResults);
      }
      
      // Sort by relevance score
      results.sort((a, b) => b.score - a.score);
      
      this.api.logger.info(`Search query "${query}" returned ${results.length} results`);
      return results;
    } catch (error) {
      this.api.logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Private Methods
   */

  private getDefaultConfig(): TeamsPluginConfig {
    return {
      enableNotifications: true,
      notificationTypes: ['mentions', 'direct-messages', 'meeting-invites'],
      autoJoinMeetings: false,
      syncChannels: [],
      syncHistoryDays: 30,
      enablePresence: true,
      customStatus: {
        syncWithCalendar: true,
        busyMessage: 'In a meeting',
        awayAfterMinutes: 15
      },
      meetingSettings: {
        defaultCamera: false,
        defaultMicrophone: false,
        showMeetingPreview: true
      }
    };
  }

  private setupEventListeners(): void {
    // Listen for configuration updates
    this.api.events.on<TeamsPluginConfig>('config-updated', async (config) => {
      this.config = { ...this.config, ...config };
      await this.api.storage.set('config', this.config);
      this.api.logger.info('Teams plugin configuration updated');
    });

    // Listen for notification actions
    this.api.events.on<string>('notification-action', async (action) => {
      await this.handleNotificationAction(action);
    });
  }

  private registerAutomationTriggers(): void {
    const triggers: TriggerDefinition[] = [
      {
        id: 'teams-message-received',
        name: 'Teams Message Received',
        description: 'Triggered when a new message is received in Teams',
        configSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', title: 'Team ID' },
            channelId: { type: 'string', title: 'Channel ID' },
            keywords: { type: 'array', items: { type: 'string' }, title: 'Keywords' }
          }
        },
        handler: async (config, context) => {
          return this.handleMessageTrigger(config, context);
        }
      },
      {
        id: 'teams-mention-received',
        name: 'Teams Mention Received',
        description: 'Triggered when you are mentioned in Teams',
        configSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', title: 'Team ID' },
            channelId: { type: 'string', title: 'Channel ID' }
          }
        },
        handler: async (config, context) => {
          return this.handleMentionTrigger(config, context);
        }
      },
      {
        id: 'teams-meeting-started',
        name: 'Teams Meeting Started',
        description: 'Triggered when a Teams meeting starts',
        configSchema: {
          type: 'object',
          properties: {
            autoJoin: { type: 'boolean', title: 'Auto-join meeting' }
          }
        },
        handler: async (config, context) => {
          return this.handleMeetingStartedTrigger(config, context);
        }
      }
    ];

    triggers.forEach(trigger => {
      this.api.automation.registerTrigger(trigger);
    });
  }

  private registerAutomationActions(): void {
    const actions: ActionDefinition[] = [
      {
        id: 'teams-send-message',
        name: 'Send Teams Message',
        description: 'Send a message to a Teams channel or chat',
        configSchema: {
          type: 'object',
          properties: {
            targetId: { type: 'string', title: 'Target ID (Channel or Chat)' },
            targetType: { type: 'string', enum: ['channel', 'chat'], title: 'Target Type' },
            message: { type: 'string', title: 'Message' }
          },
          required: ['targetId', 'targetType', 'message']
        },
        handler: async (config, context) => {
          return this.sendMessage(config.targetId, config.message, config.targetType);
        }
      },
      {
        id: 'teams-create-meeting',
        name: 'Create Teams Meeting',
        description: 'Create a new Teams meeting',
        configSchema: {
          type: 'object',
          properties: {
            subject: { type: 'string', title: 'Meeting Subject' },
            startDateTime: { type: 'string', format: 'date-time', title: 'Start Date/Time' },
            endDateTime: { type: 'string', format: 'date-time', title: 'End Date/Time' }
          },
          required: ['subject']
        },
        handler: async (config, context) => {
          return this.createOnlineMeeting({
            subject: config.subject,
            startDateTime: config.startDateTime ? new Date(config.startDateTime) : undefined,
            endDateTime: config.endDateTime ? new Date(config.endDateTime) : undefined
          });
        }
      },
      {
        id: 'teams-update-presence',
        name: 'Update Teams Presence',
        description: 'Update your Teams presence status',
        configSchema: {
          type: 'object',
          properties: {
            availability: { 
              type: 'string', 
              enum: ['Available', 'Busy', 'DoNotDisturb', 'BeRightBack', 'Away'],
              title: 'Availability' 
            },
            activity: { type: 'string', title: 'Activity' },
            message: { type: 'string', title: 'Status Message' }
          },
          required: ['availability', 'activity']
        },
        handler: async (config, context) => {
          return this.updatePresence(config.availability, config.activity, config.message);
        }
      }
    ];

    actions.forEach(action => {
      this.api.automation.registerAction(action);
    });
  }

  private registerSearchProvider(): void {
    this.api.search.registerProvider({
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
      search: async (query, options) => {
        const teamsResults = await this.search(query, options?.contentTypes);
        return teamsResults.map(result => ({
          id: result.id,
          title: result.title,
          description: result.description,
          url: result.url,
          contentType: result.contentType,
          provider: 'microsoft-teams',
          score: result.score,
          lastModified: result.timestamp,
          metadata: result.metadata
        }));
      },
      contentTypes: ['message', 'channel', 'team', 'chat', 'meeting', 'file']
    });
  }

  private async buildAuthUrl(): Promise<string> {
    const params = new URLSearchParams({
      client_id: process.env.TEAMS_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.TEAMS_REDIRECT_URI!,
      scope: this.OAUTH_SCOPES.join(' '),
      response_mode: 'query',
      state: this.generateRandomState()
    });

    return `${this.AUTH_ENDPOINT}?${params}`;
  }

  private async exchangeAuthCode(code: string): Promise<TeamsAuthTokens> {
    const response = await fetch(this.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.TEAMS_CLIENT_ID!,
        client_secret: process.env.TEAMS_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.TEAMS_REDIRECT_URI!,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
      scope: data.scope,
      idToken: data.id_token
    };
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.authTokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(this.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.TEAMS_CLIENT_ID!,
        client_secret: process.env.TEAMS_CLIENT_SECRET!,
        refresh_token: this.authTokens.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    this.authTokens = {
      ...this.authTokens,
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      refreshToken: data.refresh_token || this.authTokens.refreshToken
    };

    await this.api.storage.set('auth_tokens', this.authTokens);
  }

  private async makeApiRequest(method: string, url: string, body?: any): Promise<any> {
    this.ensureAuthenticated();

    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.authTokens!.accessToken}`,
      'Content-Type': 'application/json'
    };

    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      try {
        // Check rate limiting
        await this.handleRateLimit(url);

        const response = await this.api.network.fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });

        // Update rate limit info
        this.updateRateLimitInfo(url, response);

        if (response.status === 401) {
          // Token expired, refresh and retry
          await this.refreshAccessToken();
          headers['Authorization'] = `Bearer ${this.authTokens!.accessToken}`;
          continue;
        }

        if (response.status === 429) {
          // Rate limited, retry after delay
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          await this.delay(retryAfter * 1000);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        return response.json();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    }
  }

  private async initializeRealTimeConnections(): Promise<void> {
    try {
      // Create webhooks for real-time updates
      await this.setupWebhooks();
      
      // Initialize presence monitoring
      if (this.config.enablePresence) {
        await this.startPresenceMonitoring();
      }
      
      this.api.logger.info('Real-time connections initialized');
    } catch (error) {
      this.api.logger.error('Failed to initialize real-time connections:', error);
    }
  }

  private async setupWebhooks(): Promise<void> {
    const subscriptions = [
      {
        resource: '/me/chats/getAllMessages',
        changeType: 'created',
        notificationUrl: `${process.env.TEAMS_WEBHOOK_BASE_URL}/teams/webhook/messages`,
        expirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      },
      {
        resource: '/me/presence',
        changeType: 'updated',
        notificationUrl: `${process.env.TEAMS_WEBHOOK_BASE_URL}/teams/webhook/presence`,
        expirationDateTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      },
      {
        resource: '/me/events',
        changeType: 'created,updated,deleted',
        notificationUrl: `${process.env.TEAMS_WEBHOOK_BASE_URL}/teams/webhook/calendar`,
        expirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    ];

    for (const subscription of subscriptions) {
      try {
        const endpoint = `${this.GRAPH_API_BASE}/subscriptions`;
        const createdSubscription = await this.makeApiRequest('POST', endpoint, subscription);
        this.subscriptions.set(createdSubscription.id, createdSubscription);
        this.api.logger.info(`Created subscription: ${createdSubscription.id}`);
      } catch (error) {
        this.api.logger.error('Failed to create subscription:', error);
      }
    }
  }

  private startBackgroundSync(): void {
    // Sync messages every 5 minutes
    const messageSync = setInterval(async () => {
      await this.syncRecentMessages();
    }, 5 * 60 * 1000);

    this.syncIntervals.set('messages', messageSync);

    // Sync presence every minute
    if (this.config.enablePresence) {
      const presenceSync = setInterval(async () => {
        await this.syncPresence();
      }, 60 * 1000);

      this.syncIntervals.set('presence', presenceSync);
    }
  }

  private async syncRecentMessages(): Promise<void> {
    try {
      const teams = await this.getTeams();
      
      for (const team of teams) {
        const channels = await this.getChannels(team.id);
        
        for (const channel of channels) {
          if (this.config.syncChannels.length === 0 || this.config.syncChannels.includes(channel.id)) {
            const messages = await this.getChannelMessages(team.id, channel.id, 20);
            // Messages are automatically cached and indexed in getChannelMessages
          }
        }
      }
      
      // Sync chat messages
      const chats = await this.getChats();
      for (const chat of chats.slice(0, 10)) { // Limit to first 10 chats
        const messages = await this.getChatMessages(chat.id, 20);
        // Messages are automatically cached and indexed in getChatMessages
      }
      
      this.api.logger.debug('Background message sync completed');
    } catch (error) {
      this.api.logger.error('Background message sync failed:', error);
    }
  }

  private async syncPresence(): Promise<void> {
    try {
      const presence = await this.getUserPresence();
      
      // Handle calendar integration
      if (this.config.customStatus.syncWithCalendar) {
        await this.updatePresenceFromCalendar();
      }
      
      this.api.logger.debug('Presence sync completed');
    } catch (error) {
      this.api.logger.error('Presence sync failed:', error);
    }
  }

  private async updatePresenceFromCalendar(): Promise<void> {
    try {
      // Get current calendar events
      const now = new Date();
      const calendarEndpoint = `${this.GRAPH_API_BASE}/me/calendar/calendarView`;
      const params = new URLSearchParams({
        startDateTime: now.toISOString(),
        endDateTime: new Date(now.getTime() + 15 * 60 * 1000).toISOString(), // Next 15 minutes
        '$select': 'subject,start,end,showAs'
      });

      const response = await this.makeApiRequest('GET', `${calendarEndpoint}?${params}`);
      const events = (response as TeamsApiResponse<TeamsCalendarEvent>).value || [];

      // Check if currently in a meeting
      const currentMeetings = events.filter(event => {
        const startTime = new Date(event.start?.dateTime || '');
        const endTime = new Date(event.end?.dateTime || '');
        return startTime <= now && now <= endTime;
      });

      if (currentMeetings.length > 0) {
        await this.updatePresence('Busy', 'InAMeeting', this.config.customStatus.busyMessage);
      }
    } catch (error) {
      this.api.logger.error('Failed to update presence from calendar:', error);
    }
  }

  private async indexMessage(message: TeamsMessage): Promise<void> {
    const searchableContent: SearchableContent = {
      id: message.id,
      title: message.subject || `Message from ${message.from.user?.displayName || 'Unknown'}`,
      body: message.body.content,
      contentType: 'teams-message',
      metadata: {
        messageType: message.messageType,
        teamId: message.channelIdentity?.teamId,
        channelId: message.channelIdentity?.channelId,
        chatId: message.chatId,
        author: message.from.user?.displayName,
        authorId: message.from.user?.id,
        importance: message.importance,
        hasAttachments: (message.attachments?.length || 0) > 0,
        mentionCount: message.mentions?.length || 0
      },
      tags: [
        'teams',
        'message',
        message.messageType,
        ...(message.mentions?.map(m => `mention:${m.mentioned.user?.displayName}`) || [])
      ],
      lastModified: message.createdDateTime
    };

    await this.api.search.index(searchableContent);
  }

  private async searchMessages(query: string): Promise<TeamsSearchResult[]> {
    const searchResults = await this.api.search.search(query, {
      contentTypes: ['teams-message'],
      limit: 50
    });

    return searchResults
      .filter(result => result.provider === 'microsoft-teams')
      .map(result => ({
        id: result.id,
        title: result.title,
        description: result.description || '',
        contentType: 'message' as const,
        timestamp: result.lastModified || new Date(),
        score: result.score,
        metadata: result.metadata,
        teamId: result.metadata?.teamId,
        channelId: result.metadata?.channelId,
        chatId: result.metadata?.chatId,
        author: result.metadata?.author ? { displayName: result.metadata.author } as TeamsUser : undefined,
        snippet: result.description
      }));
  }

  private async searchTeams(query: string): Promise<TeamsSearchResult[]> {
    try {
      const teams = await this.getTeams();
      const filteredTeams = teams.filter(team =>
        team.displayName.toLowerCase().includes(query.toLowerCase()) ||
        (team.description && team.description.toLowerCase().includes(query.toLowerCase()))
      );

      return filteredTeams.map(team => ({
        id: team.id,
        title: team.displayName,
        description: team.description || '',
        contentType: 'team' as const,
        teamId: team.id,
        timestamp: new Date(),
        score: 0.8,
        metadata: {
          visibility: team.visibility,
          isArchived: team.isArchived,
          classification: team.classification
        }
      }));
    } catch (error) {
      this.api.logger.error('Failed to search teams:', error);
      return [];
    }
  }

  private async searchChannels(query: string): Promise<TeamsSearchResult[]> {
    try {
      const teams = await this.getTeams();
      const results: TeamsSearchResult[] = [];

      for (const team of teams) {
        const channels = await this.getChannels(team.id);
        const filteredChannels = channels.filter(channel =>
          channel.displayName.toLowerCase().includes(query.toLowerCase()) ||
          (channel.description && channel.description.toLowerCase().includes(query.toLowerCase()))
        );

        results.push(...filteredChannels.map(channel => ({
          id: channel.id,
          title: `#${channel.displayName}`,
          description: channel.description || `Channel in ${team.displayName}`,
          contentType: 'channel' as const,
          teamId: team.id,
          channelId: channel.id,
          timestamp: channel.createdDateTime,
          score: 0.7,
          metadata: {
            teamName: team.displayName,
            membershipType: channel.membershipType,
            isFavorite: channel.isFavoriteByDefault
          }
        })));
      }

      return results;
    } catch (error) {
      this.api.logger.error('Failed to search channels:', error);
      return [];
    }
  }

  private async searchChats(query: string): Promise<TeamsSearchResult[]> {
    try {
      const chats = await this.getChats();
      const filteredChats = chats.filter(chat =>
        (chat.topic && chat.topic.toLowerCase().includes(query.toLowerCase())) ||
        chat.members?.some(member =>
          member.displayName?.toLowerCase().includes(query.toLowerCase())
        )
      );

      return filteredChats.map(chat => ({
        id: chat.id,
        title: chat.topic || `Chat with ${chat.members?.map(m => m.displayName).join(', ')}`,
        description: `${chat.chatType} chat`,
        contentType: 'chat' as const,
        chatId: chat.id,
        timestamp: chat.lastUpdatedDateTime,
        score: 0.6,
        metadata: {
          chatType: chat.chatType,
          memberCount: chat.members?.length || 0,
          hasOnlineMeeting: !!chat.onlineMeetingInfo
        }
      }));
    } catch (error) {
      this.api.logger.error('Failed to search chats:', error);
      return [];
    }
  }

  private async handleNotificationAction(action: string): Promise<void> {
    switch (action) {
      case 'join':
        // Handle join meeting action
        break;
      case 'copy_link':
        // Handle copy meeting link action
        break;
      default:
        this.api.logger.warn(`Unknown notification action: ${action}`);
    }
  }

  private async handleMessageTrigger(config: any, context: any): Promise<boolean> {
    const message = context.data as TeamsMessage;
    
    // Check if message matches criteria
    if (config.teamId && message.channelIdentity?.teamId !== config.teamId) {
      return false;
    }
    
    if (config.channelId && message.channelIdentity?.channelId !== config.channelId) {
      return false;
    }
    
    if (config.keywords?.length > 0) {
      const messageText = message.body.content.toLowerCase();
      const hasKeyword = config.keywords.some((keyword: string) =>
        messageText.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }
    
    return true;
  }

  private async handleMentionTrigger(config: any, context: any): Promise<boolean> {
    const message = context.data as TeamsMessage;
    
    // Check if message contains mentions
    if (!message.mentions || message.mentions.length === 0) {
      return false;
    }
    
    // Check if current user is mentioned
    const currentUser = await this.getCurrentUser();
    const isMentioned = message.mentions.some(mention =>
      mention.mentioned.user?.id === currentUser.id
    );
    
    return isMentioned;
  }

  private async handleMeetingStartedTrigger(config: any, context: any): Promise<boolean> {
    const meeting = context.data as TeamsOnlineMeeting;
    
    // Check if meeting is starting now (within 5 minutes)
    const now = new Date();
    const startTime = new Date(meeting.startDateTime);
    const timeDiff = startTime.getTime() - now.getTime();
    
    return timeDiff >= 0 && timeDiff <= 5 * 60 * 1000; // 5 minutes
  }

  private async getCurrentUser(): Promise<TeamsUser> {
    const endpoint = `${this.GRAPH_API_BASE}/me`;
    const response = await this.makeApiRequest('GET', endpoint);
    return response as TeamsUser;
  }

  private async startPresenceMonitoring(): Promise<void> {
    // Implementation for presence monitoring
    // This would typically involve WebSocket connections or polling
  }

  private async deleteSubscription(subscriptionId: string): Promise<void> {
    try {
      const endpoint = `${this.GRAPH_API_BASE}/subscriptions/${subscriptionId}`;
      await this.makeApiRequest('DELETE', endpoint);
      this.subscriptions.delete(subscriptionId);
    } catch (error) {
      this.api.logger.error(`Failed to delete subscription ${subscriptionId}:`, error);
    }
  }

  private sanitizeMessageContent(content: string): string {
    // Basic HTML sanitization and formatting
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  private updateMessageCache(targetId: string, message: TeamsMessage): void {
    const cached = this.messageCache.get(targetId) || [];
    cached.unshift(message);
    
    // Keep only recent messages in cache
    const maxCacheSize = 100;
    if (cached.length > maxCacheSize) {
      cached.splice(maxCacheSize);
    }
    
    this.messageCache.set(targetId, cached);
  }

  private isTokenExpired(tokens: TeamsAuthTokens): boolean {
    return new Date() >= tokens.expiresAt;
  }

  private ensureAuthenticated(): void {
    if (!this.authTokens) {
      throw new Error('Not authenticated with Microsoft Teams');
    }
  }

  private generateRandomState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private async handleRateLimit(url: string): Promise<void> {
    const rateLimitInfo = this.rateLimitInfo.get(url);
    if (rateLimitInfo && rateLimitInfo.remaining <= 0 && new Date() < rateLimitInfo.resetTime) {
      const waitTime = rateLimitInfo.resetTime.getTime() - Date.now();
      await this.delay(waitTime);
    }
  }

  private updateRateLimitInfo(url: string, response: Response): void {
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '100');
    const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '100');
    const resetTime = new Date(response.headers.get('X-RateLimit-Reset') || Date.now() + 60000);

    this.rateLimitInfo.set(url, {
      remaining,
      limit,
      resetTime,
      retryAfter: parseInt(response.headers.get('Retry-After') || '0')
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}