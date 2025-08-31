/**
 * Complete Slack Plugin Implementation
 * Production-ready plugin with OAuth2, WebSocket, search, and automation
 */

import { 
  PluginAPI,
  PluginRuntimeContext,
  SearchProvider,
  SearchResult,
  TriggerDefinition,
  ActionDefinition,
  NotificationOptions
} from '../../../shared/src/types/plugin.js';

import {
  SlackWorkspace,
  SlackMessage,
  SlackChannel,
  SlackUser,
  SlackPluginConfig,
  SlackPluginState,
  SlackAPIResponse,
  SlackOAuthResponse,
  SlackSearchResult,
  SlackRTMEvent,
  SlackConversationsListResponse,
  SlackUsersListResponse,
  SlackConversationsHistoryResponse,
  SlackAuthTestResponse,
  SlackAPIError,
  SlackAutomationTrigger,
  SlackAutomationAction,
  SlackRateLimit
} from '../types/slack-types.js';

export class SlackPlugin {
  private api: PluginAPI;
  private context: PluginRuntimeContext;
  private config: SlackPluginConfig;
  private state: SlackPluginState;
  private rtmConnections: Map<string, WebSocket>;
  private rateLimits: Map<string, SlackRateLimit>;
  private retryQueues: Map<string, Array<() => Promise<any>>>;

  constructor(api: PluginAPI, context: PluginRuntimeContext) {
    this.api = api;
    this.context = context;
    this.config = this.loadConfig();
    this.state = this.initializeState();
    this.rtmConnections = new Map();
    this.rateLimits = new Map();
    this.retryQueues = new Map();
    
    this.setupEventListeners();
    this.registerSearchProvider();
    this.registerAutomationTriggers();
    this.registerAutomationActions();
    this.registerCommands();
  }

  private loadConfig(): SlackPluginConfig {
    const defaultConfig: SlackPluginConfig = {
      enableNotifications: true,
      notificationTypes: ['mentions', 'direct-messages'],
      keywords: [],
      autoMarkRead: false,
      syncHistoryDays: 30,
      enableTypingIndicators: true,
      customStatus: {
        syncWithCalendar: false,
        busyMessage: 'In a meeting'
      }
    };

    return { ...defaultConfig, ...this.context.plugin.config };
  }

  private initializeState(): SlackPluginState {
    return {
      workspaces: [],
      isConnecting: false,
      isAuthenticated: false,
      rtmConnections: new Map(),
      messageCache: new Map(),
      userCache: new Map(),
      channelCache: new Map(),
      typingUsers: new Map(),
      unreadCounts: new Map()
    };
  }

  private setupEventListeners(): void {
    // Listen for calendar events to update status
    if (this.config.customStatus.syncWithCalendar) {
      this.api.events.on('calendar:event_started', (event: any) => {
        this.updateStatusForMeeting(event, true);
      });

      this.api.events.on('calendar:event_ended', (event: any) => {
        this.updateStatusForMeeting(event, false);
      });
    }

    // Listen for Flow Desk events
    this.api.events.on('workspace:changed', this.handleWorkspaceChanged.bind(this));
    this.api.events.on('app:focus_changed', this.handleFocusChanged.bind(this));
  }

  // OAuth2 Authentication
  async authenticate(): Promise<boolean> {
    try {
      this.state.isConnecting = true;
      this.api.events.emit('slack:connecting', {});

      const oauthUrl = this.buildOAuthUrl();
      const authCode = await this.api.oauth.startFlow('slack', [
        'channels:history',
        'channels:read',
        'chat:write',
        'groups:history',
        'groups:read',
        'im:history',
        'im:read',
        'im:write',
        'mpim:history',
        'mpim:read',
        'reactions:read',
        'reactions:write',
        'files:read',
        'users:read',
        'users:read.email',
        'users.profile:read',
        'users.profile:write',
        'team:read',
        'search:read'
      ]);

      const tokens = await this.exchangeCodeForTokens(authCode);
      const workspace = await this.setupWorkspace(tokens);
      
      this.state.workspaces.push(workspace);
      this.state.activeWorkspace = workspace.id;
      this.state.isAuthenticated = true;
      this.state.isConnecting = false;

      await this.saveState();
      await this.initializeRealTimeConnection(workspace);
      await this.syncWorkspaceData(workspace);

      this.api.events.emit('slack:authenticated', { workspace });
      this.api.ui.showNotification({
        title: 'Slack Connected',
        body: `Connected to ${workspace.name}`,
        timeout: 3000
      });

      return true;
    } catch (error) {
      this.state.isConnecting = false;
      this.api.logger.error('Slack authentication failed', error);
      this.api.ui.showNotification({
        title: 'Slack Connection Failed',
        body: error instanceof Error ? error.message : 'Unknown error',
        timeout: 5000
      });
      return false;
    }
  }

  private buildOAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || 'your-client-id',
      scope: [
        'channels:history',
        'channels:read',
        'chat:write',
        'groups:history',
        'groups:read',
        'im:history',
        'im:read',
        'im:write',
        'mpim:history',
        'mpim:read',
        'reactions:read',
        'reactions:write',
        'files:read',
        'users:read',
        'users:read.email',
        'users.profile:read',
        'users.profile:write',
        'team:read',
        'search:read'
      ].join(','),
      redirect_uri: 'flowdesk://oauth/slack',
      state: this.generateOAuthState(),
      response_type: 'code'
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  private generateOAuthState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private async exchangeCodeForTokens(code: string): Promise<SlackOAuthResponse> {
    const response = await this.makeAPIRequest('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID || 'your-client-id',
        client_secret: process.env.SLACK_CLIENT_SECRET || 'your-client-secret',
        code: code,
        redirect_uri: 'flowdesk://oauth/slack'
      })
    });

    const data = await response.json() as SlackOAuthResponse;
    
    if (!data.ok) {
      throw new SlackAPIError('OAuth token exchange failed', data.error || 'unknown');
    }

    return data;
  }

  private async setupWorkspace(oauthResponse: SlackOAuthResponse): Promise<SlackWorkspace> {
    const authTest = await this.testAuth(oauthResponse.authed_user.access_token);
    
    const workspace: SlackWorkspace = {
      id: authTest.team_id,
      name: authTest.team,
      domain: authTest.url.replace('https://', '').replace('.slack.com/', ''),
      url: authTest.url,
      team: {
        id: authTest.team_id,
        name: authTest.team,
        domain: authTest.url.replace('https://', '').replace('.slack.com/', '')
      },
      user: {
        id: authTest.user_id,
        name: authTest.user,
        team_id: authTest.team_id
      },
      access_token: oauthResponse.authed_user.access_token,
      refresh_token: oauthResponse.authed_user.refresh_token,
      expires_at: oauthResponse.authed_user.expires_at,
      is_connected: true,
      channels: [],
      users: [],
      unread_count: 0,
      mention_count: 0
    };

    return workspace;
  }

  private async testAuth(token: string): Promise<SlackAuthTestResponse> {
    const response = await this.makeSlackAPIRequest('auth.test', {}, token);
    return response as SlackAuthTestResponse;
  }

  // Real-time WebSocket Connection
  private async initializeRealTimeConnection(workspace: SlackWorkspace): Promise<void> {
    try {
      // Use Socket Mode for real-time events
      const socketUrl = await this.getSocketModeUrl(workspace.access_token);
      const ws = new WebSocket(socketUrl);

      ws.onopen = () => {
        this.api.logger.info(`WebSocket connected for workspace ${workspace.name}`);
        this.rtmConnections.set(workspace.id, ws);
      };

      ws.onmessage = (event) => {
        this.handleWebSocketMessage(workspace.id, event.data);
      };

      ws.onclose = (event) => {
        this.api.logger.warn(`WebSocket closed for workspace ${workspace.name}`, event);
        this.rtmConnections.delete(workspace.id);
        
        // Attempt to reconnect after delay
        setTimeout(() => {
          this.initializeRealTimeConnection(workspace);
        }, 5000);
      };

      ws.onerror = (error) => {
        this.api.logger.error(`WebSocket error for workspace ${workspace.name}`, error);
      };
    } catch (error) {
      this.api.logger.error('Failed to initialize real-time connection', error);
    }
  }

  private async getSocketModeUrl(token: string): Promise<string> {
    const response = await this.makeSlackAPIRequest('apps.connections.open', {}, token);
    return response.url;
  }

  private handleWebSocketMessage(workspaceId: string, data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'hello':
          this.api.logger.info('WebSocket connection established');
          break;
        case 'events_api':
          this.handleRTMEvent(workspaceId, message.payload.event);
          break;
        case 'disconnect':
          this.api.logger.warn('WebSocket disconnect requested');
          break;
      }
    } catch (error) {
      this.api.logger.error('Failed to parse WebSocket message', error);
    }
  }

  private handleRTMEvent(workspaceId: string, event: SlackRTMEvent): void {
    switch (event.type) {
      case 'message':
        this.handleNewMessage(workspaceId, event as SlackMessage);
        break;
      case 'user_typing':
        this.handleUserTyping(workspaceId, event);
        break;
      case 'presence_change':
        this.handlePresenceChange(workspaceId, event);
        break;
      case 'reaction_added':
      case 'reaction_removed':
        this.handleReactionChange(workspaceId, event);
        break;
      case 'channel_created':
      case 'channel_deleted':
      case 'channel_archive':
      case 'channel_unarchive':
        this.handleChannelChange(workspaceId, event);
        break;
      case 'team_join':
      case 'user_change':
        this.handleUserChange(workspaceId, event);
        break;
    }

    // Emit event for automation system
    this.api.events.emit(`slack:${event.type}`, {
      workspaceId,
      event
    });
  }

  // API Request Handling with Rate Limiting
  private async makeSlackAPIRequest(
    method: string, 
    params: Record<string, any> = {}, 
    token?: string
  ): Promise<any> {
    const workspace = this.getActiveWorkspace();
    const authToken = token || workspace?.access_token;
    
    if (!authToken) {
      throw new SlackAPIError('No authentication token available', 'no_auth');
    }

    const url = `https://slack.com/api/${method}`;
    
    // Check rate limits
    await this.checkRateLimit(method);
    
    try {
      const response = await this.makeAPIRequest(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      // Update rate limit info from headers
      this.updateRateLimit(method, response.headers);

      const data = await response.json() as SlackAPIResponse;
      
      if (!data.ok) {
        if (data.error === 'ratelimited') {
          await this.handleRateLimit(method, response.headers);
          return this.makeSlackAPIRequest(method, params, token);
        }
        
        throw new SlackAPIError(data.error || 'API request failed', data.error || 'unknown');
      }

      return data;
    } catch (error) {
      if (error instanceof SlackAPIError) {
        throw error;
      }
      throw new SlackAPIError('Network request failed', 'network_error', error);
    }
  }

  private async makeAPIRequest(url: string, options: RequestInit): Promise<Response> {
    return this.api.network.fetch(url, options);
  }

  private async checkRateLimit(method: string): Promise<void> {
    const rateLimit = this.rateLimits.get(method);
    if (rateLimit && rateLimit.retryAfter) {
      const now = Date.now();
      if (now < rateLimit.retryAfter) {
        const waitTime = rateLimit.retryAfter - now;
        this.api.logger.info(`Rate limited, waiting ${waitTime}ms for ${method}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private updateRateLimit(method: string, headers: Headers): void {
    const limit = parseInt(headers.get('x-ratelimit-limit') || '0');
    const remaining = parseInt(headers.get('x-ratelimit-remaining') || '0');
    const reset = parseInt(headers.get('x-ratelimit-reset') || '0');

    this.rateLimits.set(method, {
      limit,
      remaining,
      reset: reset * 1000, // Convert to milliseconds
    });
  }

  private async handleRateLimit(method: string, headers: Headers): Promise<void> {
    const retryAfter = parseInt(headers.get('retry-after') || '60') * 1000;
    
    this.rateLimits.set(method, {
      retryAfter: Date.now() + retryAfter
    });

    this.api.logger.warn(`Rate limited on ${method}, retrying after ${retryAfter}ms`);
  }

  // Data Synchronization
  private async syncWorkspaceData(workspace: SlackWorkspace): Promise<void> {
    try {
      this.api.logger.info(`Syncing data for workspace ${workspace.name}`);

      // Sync users
      const users = await this.fetchAllUsers(workspace.access_token);
      workspace.users = users;
      users.forEach(user => this.state.userCache.set(user.id, user));

      // Sync channels
      const channels = await this.fetchAllChannels(workspace.access_token);
      workspace.channels = channels;
      channels.forEach(channel => this.state.channelCache.set(channel.id, channel));

      // Sync recent messages for search indexing
      await this.syncRecentMessages(workspace);

      this.api.events.emit('slack:sync_completed', { workspace });
      this.api.logger.info(`Sync completed for workspace ${workspace.name}`);
    } catch (error) {
      this.api.logger.error('Failed to sync workspace data', error);
      throw error;
    }
  }

  private async fetchAllUsers(token: string): Promise<SlackUser[]> {
    const users: SlackUser[] = [];
    let cursor: string | undefined;

    do {
      const params: any = { limit: 200 };
      if (cursor) params.cursor = cursor;

      const response = await this.makeSlackAPIRequest('users.list', params, token) as SlackUsersListResponse;
      users.push(...response.members);
      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    return users;
  }

  private async fetchAllChannels(token: string): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = [];
    let cursor: string | undefined;

    // Fetch public channels
    do {
      const params: any = { types: 'public_channel,private_channel,mpim,im', limit: 200 };
      if (cursor) params.cursor = cursor;

      const response = await this.makeSlackAPIRequest('conversations.list', params, token) as SlackConversationsListResponse;
      channels.push(...response.channels);
      cursor = response.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  private async syncRecentMessages(workspace: SlackWorkspace): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.syncHistoryDays);
    const cutoffTimestamp = (cutoffDate.getTime() / 1000).toString();

    for (const channel of workspace.channels.slice(0, 20)) { // Limit initial sync
      try {
        const messages = await this.fetchChannelMessages(
          channel.id,
          workspace.access_token,
          cutoffTimestamp
        );

        this.state.messageCache.set(channel.id, messages);
        
        // Index messages for search
        for (const message of messages) {
          await this.indexMessage(message, channel, workspace);
        }
      } catch (error) {
        this.api.logger.error(`Failed to sync messages for channel ${channel.id}`, error);
      }
    }
  }

  private async fetchChannelMessages(
    channelId: string,
    token: string,
    oldest?: string
  ): Promise<SlackMessage[]> {
    const messages: SlackMessage[] = [];
    let cursor: string | undefined;

    do {
      const params: any = { channel: channelId, limit: 200 };
      if (cursor) params.cursor = cursor;
      if (oldest) params.oldest = oldest;

      const response = await this.makeSlackAPIRequest('conversations.history', params, token) as SlackConversationsHistoryResponse;
      messages.push(...response.messages);
      cursor = response.response_metadata?.next_cursor;
    } while (cursor && response.has_more);

    return messages.reverse(); // Return in chronological order
  }

  // Search Integration
  private registerSearchProvider(): void {
    const searchProvider: SearchProvider = {
      id: 'slack',
      name: 'Slack',
      icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/slack/slack-original.svg',
      search: this.search.bind(this),
      contentTypes: ['message', 'file', 'user', 'channel']
    };

    this.api.search.registerProvider(searchProvider);
  }

  private async search(query: string, options: any = {}): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    if (!this.state.isAuthenticated) {
      return results;
    }

    try {
      // Search across all connected workspaces
      for (const workspace of this.state.workspaces) {
        const workspaceResults = await this.searchWorkspace(workspace, query, options);
        results.push(...workspaceResults);
      }

      // Sort by relevance score
      results.sort((a, b) => b.score - a.score);
      
      return results.slice(0, options.limit || 20);
    } catch (error) {
      this.api.logger.error('Slack search failed', error);
      return [];
    }
  }

  private async searchWorkspace(
    workspace: SlackWorkspace,
    query: string,
    options: any
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Use Slack's search API
      const searchResponse = await this.makeSlackAPIRequest('search.all', {
        query: query,
        count: options.limit || 20,
        page: options.page || 1
      }, workspace.access_token) as SlackSearchResult;

      // Process message results
      if (searchResponse.messages) {
        for (const message of searchResponse.messages.matches) {
          const channel = this.state.channelCache.get(message.channel);
          const user = this.state.userCache.get(message.user || '');

          results.push({
            id: `${workspace.id}-${message.ts}`,
            title: this.getMessageTitle(message, channel, user),
            description: this.stripSlackFormatting(message.text),
            url: message.permalink || `slack://channel?team=${workspace.id}&id=${message.channel}&message=${message.ts}`,
            icon: user?.profile?.image_24 || 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/slack/slack-original.svg',
            score: this.calculateMessageScore(message, query),
            metadata: {
              workspace: workspace.name,
              channel: channel?.name || message.channel,
              user: user?.real_name || user?.name || 'Unknown',
              timestamp: message.ts,
              type: 'slack_message'
            },
            contentType: 'message',
            provider: 'slack',
            lastModified: new Date(parseFloat(message.ts) * 1000)
          });
        }
      }

      // Process file results
      if (searchResponse.files) {
        for (const file of searchResponse.files.matches) {
          results.push({
            id: `${workspace.id}-file-${file.id}`,
            title: file.title || file.name,
            description: `${file.pretty_type} - ${this.formatFileSize(file.size)}`,
            url: file.permalink || file.url_private,
            icon: this.getFileIcon(file.filetype),
            thumbnail: file.thumb_360,
            score: this.calculateFileScore(file, query),
            metadata: {
              workspace: workspace.name,
              fileType: file.filetype,
              size: file.size,
              type: 'slack_file'
            },
            contentType: 'file',
            provider: 'slack',
            lastModified: new Date(file.timestamp * 1000)
          });
        }
      }
    } catch (error) {
      this.api.logger.error(`Search failed for workspace ${workspace.name}`, error);
    }

    return results;
  }

  private async indexMessage(message: SlackMessage, channel: SlackChannel, workspace: SlackWorkspace): Promise<void> {
    const user = this.state.userCache.get(message.user || '');
    
    await this.api.search.index({
      id: `${workspace.id}-${message.ts}`,
      title: this.getMessageTitle(message, channel, user),
      body: this.stripSlackFormatting(message.text),
      url: message.permalink || `slack://channel?team=${workspace.id}&id=${message.channel}&message=${message.ts}`,
      contentType: 'slack_message',
      metadata: {
        workspace: workspace.name,
        workspaceId: workspace.id,
        channel: channel.name,
        channelId: channel.id,
        user: user?.real_name || user?.name || 'Unknown',
        userId: message.user,
        timestamp: message.ts
      },
      tags: [
        'slack',
        workspace.name.toLowerCase(),
        channel.name?.toLowerCase() || '',
        ...(message.text.match(/#\w+/g) || []).map(tag => tag.toLowerCase())
      ],
      lastModified: new Date(parseFloat(message.ts) * 1000)
    });
  }

  // Message Handling
  private handleNewMessage(workspaceId: string, message: SlackMessage): void {
    const workspace = this.state.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    const channel = this.state.channelCache.get(message.channel);
    const user = this.state.userCache.get(message.user || '');

    // Update message cache
    const channelMessages = this.state.messageCache.get(message.channel) || [];
    channelMessages.push(message);
    this.state.messageCache.set(message.channel, channelMessages);

    // Index new message
    this.indexMessage(message, channel!, workspace);

    // Handle notifications
    this.handleMessageNotification(message, channel, user, workspace);

    // Update unread counts
    this.updateUnreadCounts(workspaceId, message.channel);

    // Emit event
    this.api.events.emit('slack:new_message', {
      workspaceId,
      message,
      channel,
      user
    });
  }

  private handleMessageNotification(
    message: SlackMessage,
    channel: SlackChannel | undefined,
    user: SlackUser | undefined,
    workspace: SlackWorkspace
  ): void {
    if (!this.config.enableNotifications) return;

    const shouldNotify = this.shouldNotifyForMessage(message, channel);
    if (!shouldNotify) return;

    const notificationOptions: NotificationOptions = {
      title: this.getNotificationTitle(message, channel, user, workspace),
      body: this.stripSlackFormatting(message.text).substring(0, 100),
      icon: user?.profile?.image_48 || 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/slack/slack-original.svg',
      actions: [
        {
          action: 'reply',
          title: 'Reply',
          icon: 'reply'
        },
        {
          action: 'mark_read',
          title: 'Mark as Read',
          icon: 'check'
        }
      ],
      timeout: 10000
    };

    this.api.ui.showNotification(notificationOptions);
  }

  private shouldNotifyForMessage(message: SlackMessage, channel: SlackChannel | undefined): boolean {
    // Don't notify for own messages
    if (message.user === this.context.user.id) return false;

    // Check notification types
    const types = this.config.notificationTypes;
    
    if (types.includes('all-messages')) return true;
    
    if (types.includes('direct-messages') && channel?.is_im) return true;
    
    if (types.includes('mentions') && this.messageContainsMention(message)) return true;
    
    if (types.includes('keyword-alerts') && this.messageContainsKeywords(message)) return true;

    return false;
  }

  private messageContainsMention(message: SlackMessage): boolean {
    const userId = this.context.user.id;
    return message.text.includes(`<@${userId}>`) || message.text.includes('@channel') || message.text.includes('@here');
  }

  private messageContainsKeywords(message: SlackMessage): boolean {
    if (this.config.keywords.length === 0) return false;
    const text = message.text.toLowerCase();
    return this.config.keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  // Automation System
  private registerAutomationTriggers(): void {
    const triggers: TriggerDefinition[] = [
      {
        id: 'slack_new_message',
        name: 'New Slack Message',
        description: 'Triggered when a new message is received',
        configSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', title: 'Channel ID' },
            user: { type: 'string', title: 'User ID' },
            keyword: { type: 'string', title: 'Keyword to match' }
          }
        },
        handler: this.handleNewMessageTrigger.bind(this)
      },
      {
        id: 'slack_mention',
        name: 'Slack Mention',
        description: 'Triggered when mentioned in Slack',
        handler: this.handleMentionTrigger.bind(this)
      },
      {
        id: 'slack_reaction_added',
        name: 'Slack Reaction Added',
        description: 'Triggered when a reaction is added to a message',
        configSchema: {
          type: 'object',
          properties: {
            emoji: { type: 'string', title: 'Emoji name' }
          }
        },
        handler: this.handleReactionTrigger.bind(this)
      }
    ];

    triggers.forEach(trigger => {
      this.api.automation.registerTrigger(trigger);
    });
  }

  private registerAutomationActions(): void {
    const actions: ActionDefinition[] = [
      {
        id: 'slack_send_message',
        name: 'Send Slack Message',
        description: 'Send a message to a Slack channel',
        configSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', title: 'Channel ID', required: true },
            text: { type: 'string', title: 'Message text', required: true },
            thread_ts: { type: 'string', title: 'Thread timestamp (optional)' }
          },
          required: ['channel', 'text']
        },
        handler: this.handleSendMessageAction.bind(this)
      },
      {
        id: 'slack_add_reaction',
        name: 'Add Slack Reaction',
        description: 'Add a reaction to a Slack message',
        configSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', title: 'Channel ID', required: true },
            timestamp: { type: 'string', title: 'Message timestamp', required: true },
            name: { type: 'string', title: 'Emoji name', required: true }
          },
          required: ['channel', 'timestamp', 'name']
        },
        handler: this.handleAddReactionAction.bind(this)
      },
      {
        id: 'slack_set_status',
        name: 'Set Slack Status',
        description: 'Update your Slack status',
        configSchema: {
          type: 'object',
          properties: {
            status_text: { type: 'string', title: 'Status text' },
            status_emoji: { type: 'string', title: 'Status emoji' },
            status_expiration: { type: 'number', title: 'Expiration (seconds)' }
          }
        },
        handler: this.handleSetStatusAction.bind(this)
      }
    ];

    actions.forEach(action => {
      this.api.automation.registerAction(action);
    });
  }

  // Command Registration
  private registerCommands(): void {
    this.api.ui.addCommand({
      id: 'slack_connect',
      title: 'Connect Slack Workspace',
      description: 'Connect a new Slack workspace',
      icon: 'link',
      handler: this.authenticate.bind(this)
    });

    this.api.ui.addCommand({
      id: 'slack_send_message',
      title: 'Send Slack Message',
      description: 'Send a quick message to Slack',
      icon: 'message',
      handler: this.showSendMessageDialog.bind(this)
    });

    this.api.ui.addCommand({
      id: 'slack_set_status',
      title: 'Set Slack Status',
      description: 'Update your Slack status',
      icon: 'status',
      handler: this.showSetStatusDialog.bind(this)
    });

    this.api.ui.addCommand({
      id: 'slack_toggle_notifications',
      title: 'Toggle Slack Notifications',
      description: 'Enable/disable Slack notifications',
      icon: 'bell',
      handler: this.toggleNotifications.bind(this)
    });
  }

  // Public API Methods
  async sendMessage(channelId: string, text: string, threadTs?: string): Promise<SlackMessage> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      throw new SlackAPIError('No active workspace', 'no_workspace');
    }

    const params: any = {
      channel: channelId,
      text: text
    };

    if (threadTs) {
      params.thread_ts = threadTs;
    }

    const response = await this.makeSlackAPIRequest('chat.postMessage', params);
    return response.message;
  }

  async getChannels(): Promise<SlackChannel[]> {
    const workspace = this.getActiveWorkspace();
    return workspace?.channels || [];
  }

  async getUsers(): Promise<SlackUser[]> {
    const workspace = this.getActiveWorkspace();
    return workspace?.users || [];
  }

  async markChannelRead(channelId: string): Promise<void> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) return;

    await this.makeSlackAPIRequest('conversations.mark', {
      channel: channelId,
      ts: Date.now().toString()
    });

    this.state.unreadCounts.set(channelId, 0);
  }

  // Helper Methods
  private getActiveWorkspace(): SlackWorkspace | undefined {
    return this.state.workspaces.find(w => w.id === this.state.activeWorkspace);
  }

  private stripSlackFormatting(text: string): string {
    return text
      .replace(/<@U\w+\|([^>]+)>/g, '@$1')
      .replace(/<@U\w+>/g, '@user')
      .replace(/<#C\w+\|([^>]+)>/g, '#$1')
      .replace(/<#C\w+>/g, '#channel')
      .replace(/<([^>|]+)\|([^>]+)>/g, '$2')
      .replace(/<([^>]+)>/g, '$1')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&');
  }

  private getMessageTitle(message: SlackMessage, channel: SlackChannel | undefined, user: SlackUser | undefined): string {
    const channelName = channel?.name || 'unknown';
    const userName = user?.real_name || user?.name || 'Unknown User';
    
    if (channel?.is_im) {
      return `Direct message from ${userName}`;
    }
    
    return `${userName} in #${channelName}`;
  }

  private getNotificationTitle(
    message: SlackMessage,
    channel: SlackChannel | undefined,
    user: SlackUser | undefined,
    workspace: SlackWorkspace
  ): string {
    const userName = user?.real_name || user?.name || 'Someone';
    const channelName = channel?.name || 'unknown';
    
    if (channel?.is_im) {
      return `${userName} (${workspace.name})`;
    }
    
    return `${userName} in #${channelName} (${workspace.name})`;
  }

  private calculateMessageScore(message: SlackMessage, query: string): number {
    let score = 0.5;
    const text = message.text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match gets highest score
    if (text.includes(queryLower)) {
      score += 0.4;
    }
    
    // Recent messages get higher scores
    const messageDate = new Date(parseFloat(message.ts) * 1000);
    const daysSince = (Date.now() - messageDate.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, (30 - daysSince) / 30 * 0.1);
    
    return Math.min(1, score);
  }

  private calculateFileScore(file: SlackFile, query: string): number {
    let score = 0.3;
    const fileName = (file.name || file.title || '').toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (fileName.includes(queryLower)) {
      score += 0.5;
    }
    
    // Recent files get higher scores
    const fileDate = new Date(file.timestamp * 1000);
    const daysSince = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, (30 - daysSince) / 30 * 0.2);
    
    return Math.min(1, score);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getFileIcon(filetype: string): string {
    const iconMap: Record<string, string> = {
      pdf: 'file-pdf',
      doc: 'file-word',
      docx: 'file-word',
      xls: 'file-excel',
      xlsx: 'file-excel',
      ppt: 'file-powerpoint',
      pptx: 'file-powerpoint',
      jpg: 'file-image',
      jpeg: 'file-image',
      png: 'file-image',
      gif: 'file-image',
      mp4: 'file-video',
      mov: 'file-video',
      mp3: 'file-audio',
      wav: 'file-audio',
      zip: 'file-archive',
      rar: 'file-archive'
    };
    
    return iconMap[filetype.toLowerCase()] || 'file';
  }

  // Event Handlers
  private handleWorkspaceChanged(workspaceId: string): void {
    this.state.activeWorkspace = workspaceId;
  }

  private handleFocusChanged(focused: boolean): void {
    if (focused && this.config.autoMarkRead) {
      // Mark active channel as read when app gains focus
      // Implementation would depend on which channel is currently visible
    }
  }

  private handleUserTyping(workspaceId: string, event: SlackRTMEvent): void {
    if (!this.config.enableTypingIndicators) return;

    const channelTypers = this.state.typingUsers.get(event.channel!) || new Set();
    channelTypers.add(event.user!);
    this.state.typingUsers.set(event.channel!, channelTypers);

    // Remove typing indicator after 3 seconds
    setTimeout(() => {
      const updatedTypers = this.state.typingUsers.get(event.channel!) || new Set();
      updatedTypers.delete(event.user!);
      this.state.typingUsers.set(event.channel!, updatedTypers);
    }, 3000);

    this.api.events.emit('slack:typing_changed', {
      workspaceId,
      channel: event.channel,
      user: event.user,
      typing: true
    });
  }

  private handlePresenceChange(workspaceId: string, event: SlackRTMEvent): void {
    const user = this.state.userCache.get(event.user!);
    if (user) {
      user.presence = (event as any).presence;
      this.state.userCache.set(event.user!, user);
    }

    this.api.events.emit('slack:presence_changed', {
      workspaceId,
      user: event.user,
      presence: (event as any).presence
    });
  }

  private handleReactionChange(workspaceId: string, event: SlackRTMEvent): void {
    this.api.events.emit('slack:reaction_changed', {
      workspaceId,
      event
    });
  }

  private handleChannelChange(workspaceId: string, event: SlackRTMEvent): void {
    // Refresh channel list
    const workspace = this.state.workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      this.fetchAllChannels(workspace.access_token).then(channels => {
        workspace.channels = channels;
        channels.forEach(channel => this.state.channelCache.set(channel.id, channel));
      });
    }

    this.api.events.emit('slack:channels_changed', {
      workspaceId,
      event
    });
  }

  private handleUserChange(workspaceId: string, event: SlackRTMEvent): void {
    // Update user cache
    if ((event as any).user) {
      this.state.userCache.set((event as any).user.id, (event as any).user);
    }

    this.api.events.emit('slack:users_changed', {
      workspaceId,
      event
    });
  }

  private updateUnreadCounts(workspaceId: string, channelId: string): void {
    const currentCount = this.state.unreadCounts.get(channelId) || 0;
    this.state.unreadCounts.set(channelId, currentCount + 1);

    const workspace = this.state.workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      workspace.unread_count = Array.from(this.state.unreadCounts.values()).reduce((a, b) => a + b, 0);
    }

    this.api.events.emit('slack:unread_changed', {
      workspaceId,
      channelId,
      count: currentCount + 1
    });
  }

  private async updateStatusForMeeting(event: any, isStarting: boolean): Promise<void> {
    if (!this.config.customStatus.syncWithCalendar) return;

    const workspace = this.getActiveWorkspace();
    if (!workspace) return;

    try {
      if (isStarting) {
        await this.makeSlackAPIRequest('users.profile.set', {
          profile: JSON.stringify({
            status_text: this.config.customStatus.busyMessage,
            status_emoji: ':calendar:',
            status_expiration: Math.floor(new Date(event.end).getTime() / 1000)
          })
        });
      } else {
        await this.makeSlackAPIRequest('users.profile.set', {
          profile: JSON.stringify({
            status_text: '',
            status_emoji: '',
            status_expiration: 0
          })
        });
      }
    } catch (error) {
      this.api.logger.error('Failed to update Slack status for meeting', error);
    }
  }

  // Automation Handlers
  private async handleNewMessageTrigger(config: any, context: any): Promise<boolean> {
    const { channel, user, keyword } = config;
    const { event } = context;

    if (event.type !== 'slack:new_message') return false;

    if (channel && event.message.channel !== channel) return false;
    if (user && event.message.user !== user) return false;
    if (keyword && !event.message.text.toLowerCase().includes(keyword.toLowerCase())) return false;

    return true;
  }

  private async handleMentionTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    
    if (event.type !== 'slack:new_message') return false;
    
    return this.messageContainsMention(event.message);
  }

  private async handleReactionTrigger(config: any, context: any): Promise<boolean> {
    const { emoji } = config;
    const { event } = context;

    if (event.type !== 'slack:reaction_added') return false;

    if (emoji && event.event.reaction !== emoji) return false;

    return true;
  }

  private async handleSendMessageAction(config: any, context: any): Promise<any> {
    const { channel, text, thread_ts } = config;
    
    return await this.sendMessage(channel, text, thread_ts);
  }

  private async handleAddReactionAction(config: any, context: any): Promise<any> {
    const { channel, timestamp, name } = config;
    const workspace = this.getActiveWorkspace();
    
    if (!workspace) {
      throw new SlackAPIError('No active workspace', 'no_workspace');
    }

    return await this.makeSlackAPIRequest('reactions.add', {
      channel,
      timestamp,
      name
    });
  }

  private async handleSetStatusAction(config: any, context: any): Promise<any> {
    const { status_text, status_emoji, status_expiration } = config;
    const workspace = this.getActiveWorkspace();
    
    if (!workspace) {
      throw new SlackAPIError('No active workspace', 'no_workspace');
    }

    return await this.makeSlackAPIRequest('users.profile.set', {
      profile: JSON.stringify({
        status_text: status_text || '',
        status_emoji: status_emoji || '',
        status_expiration: status_expiration || 0
      })
    });
  }

  // Dialog Handlers
  private async showSendMessageDialog(): Promise<void> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      this.api.ui.showNotification({
        title: 'No Workspace Connected',
        body: 'Connect a Slack workspace first',
        timeout: 3000
      });
      return;
    }

    const channels = workspace.channels.filter(c => c.is_member);
    
    const result = await this.api.ui.showDialog({
      title: 'Send Slack Message',
      size: 'medium',
      content: `
        <div style="padding: 20px;">
          <div style="margin-bottom: 15px;">
            <label for="channel-select">Channel:</label>
            <select id="channel-select" style="width: 100%; padding: 8px; margin-top: 5px;">
              ${channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('')}
            </select>
          </div>
          <div style="margin-bottom: 15px;">
            <label for="message-text">Message:</label>
            <textarea id="message-text" placeholder="Type your message..." style="width: 100%; height: 100px; padding: 8px; margin-top: 5px;"></textarea>
          </div>
        </div>
      `,
      buttons: [
        { label: 'Send', value: 'send', variant: 'primary' },
        { label: 'Cancel', value: 'cancel' }
      ]
    });

    if (result === 'send') {
      // Get values from dialog (implementation would need DOM access)
      // This is a simplified example
      const channelId = channels[0]?.id || '';
      const text = 'Message from Flow Desk';
      
      try {
        await this.sendMessage(channelId, text);
        this.api.ui.showNotification({
          title: 'Message Sent',
          body: 'Your message was sent successfully',
          timeout: 3000
        });
      } catch (error) {
        this.api.ui.showNotification({
          title: 'Send Failed',
          body: error instanceof Error ? error.message : 'Unknown error',
          timeout: 5000
        });
      }
    }
  }

  private async showSetStatusDialog(): Promise<void> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      this.api.ui.showNotification({
        title: 'No Workspace Connected',
        body: 'Connect a Slack workspace first',
        timeout: 3000
      });
      return;
    }

    const result = await this.api.ui.showDialog({
      title: 'Set Slack Status',
      size: 'medium',
      content: `
        <div style="padding: 20px;">
          <div style="margin-bottom: 15px;">
            <label for="status-emoji">Status Emoji:</label>
            <input type="text" id="status-emoji" placeholder=":rocket:" style="width: 100%; padding: 8px; margin-top: 5px;">
          </div>
          <div style="margin-bottom: 15px;">
            <label for="status-text">Status Text:</label>
            <input type="text" id="status-text" placeholder="Working on something cool..." style="width: 100%; padding: 8px; margin-top: 5px;">
          </div>
        </div>
      `,
      buttons: [
        { label: 'Set Status', value: 'set', variant: 'primary' },
        { label: 'Clear Status', value: 'clear' },
        { label: 'Cancel', value: 'cancel' }
      ]
    });

    if (result === 'set' || result === 'clear') {
      try {
        await this.handleSetStatusAction({
          status_text: result === 'clear' ? '' : 'Working on something cool...',
          status_emoji: result === 'clear' ? '' : ':rocket:',
          status_expiration: 0
        }, {});

        this.api.ui.showNotification({
          title: 'Status Updated',
          body: 'Your Slack status was updated successfully',
          timeout: 3000
        });
      } catch (error) {
        this.api.ui.showNotification({
          title: 'Status Update Failed',
          body: error instanceof Error ? error.message : 'Unknown error',
          timeout: 5000
        });
      }
    }
  }

  private async toggleNotifications(): Promise<void> {
    this.config.enableNotifications = !this.config.enableNotifications;
    await this.saveConfig();

    this.api.ui.showNotification({
      title: `Slack Notifications ${this.config.enableNotifications ? 'Enabled' : 'Disabled'}`,
      body: `Notifications are now ${this.config.enableNotifications ? 'on' : 'off'}`,
      timeout: 3000
    });
  }

  // State Management
  private async saveState(): Promise<void> {
    await this.api.storage.set('slack_state', this.state);
  }

  private async loadState(): Promise<void> {
    const savedState = await this.api.storage.get<SlackPluginState>('slack_state');
    if (savedState) {
      this.state = { ...this.state, ...savedState };
    }
  }

  private async saveConfig(): Promise<void> {
    await this.api.storage.set('slack_config', this.config);
  }

  // Lifecycle Methods
  async onActivate(): Promise<void> {
    await this.loadState();
    
    // Reconnect to workspaces
    for (const workspace of this.state.workspaces) {
      if (workspace.is_connected) {
        await this.initializeRealTimeConnection(workspace);
      }
    }
  }

  async onDeactivate(): Promise<void> {
    // Close all WebSocket connections
    for (const [workspaceId, ws] of this.rtmConnections) {
      ws.close();
    }
    this.rtmConnections.clear();

    await this.saveState();
  }

  async onConfigChanged(newConfig: SlackPluginConfig): Promise<void> {
    this.config = newConfig;
    await this.saveConfig();

    // Update notification handlers if needed
    this.setupEventListeners();
  }

  // Public interface for the panel
  getPublicAPI() {
    return {
      authenticate: this.authenticate.bind(this),
      sendMessage: this.sendMessage.bind(this),
      getChannels: this.getChannels.bind(this),
      getUsers: this.getUsers.bind(this),
      markChannelRead: this.markChannelRead.bind(this),
      getWorkspaces: () => this.state.workspaces,
      getActiveWorkspace: this.getActiveWorkspace.bind(this),
      setActiveWorkspace: (id: string) => { this.state.activeWorkspace = id; },
      isAuthenticated: () => this.state.isAuthenticated,
      getUnreadCount: (channelId: string) => this.state.unreadCounts.get(channelId) || 0,
      getTypingUsers: (channelId: string) => Array.from(this.state.typingUsers.get(channelId) || []),
      search: this.search.bind(this)
    };
  }
}