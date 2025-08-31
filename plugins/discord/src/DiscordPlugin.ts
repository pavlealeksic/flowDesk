/**
 * Discord Plugin - Complete Integration
 * 
 * Production-ready Discord integration with real-time messaging, voice channels,
 * OAuth2 authentication, search indexing, automation triggers, and bot interactions.
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
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
  DiscordMessage,
  DiscordVoiceState,
  DiscordPresence,
  DiscordPluginConfig,
  DiscordAuthTokens,
  DiscordApiResponse,
  DiscordSearchResult,
  DiscordRateLimitInfo,
  DiscordWebSocketMessage,
  DiscordAutomationTrigger,
  DiscordAutomationAction,
  DiscordGatewayPayload,
  DiscordGatewayOpcode,
  DiscordChannelType,
  DiscordMessageType
} from '../types/discord-types';

export class DiscordPlugin {
  private api: PluginAPI;
  private config: DiscordPluginConfig;
  private authTokens: DiscordAuthTokens | null = null;
  private rateLimitInfo: Map<string, DiscordRateLimitInfo> = new Map();
  private gatewayConnection: WebSocket | null = null;
  private voiceConnections: Map<string, WebSocket> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private messageCache: Map<string, DiscordMessage[]> = new Map();
  private guildCache: Map<string, DiscordGuild> = new Map();
  private channelCache: Map<string, DiscordChannel> = new Map();
  private userCache: Map<string, DiscordUser> = new Map();
  private presenceCache: Map<string, DiscordPresence> = new Map();
  private retryQueues: Map<string, Array<() => Promise<void>>> = new Map();
  private isInitialized = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private sequenceNumber: number | null = null;

  // Discord API endpoints
  private readonly API_BASE = 'https://discord.com/api/v10';
  private readonly CDN_BASE = 'https://cdn.discordapp.com';
  private readonly GATEWAY_BASE = 'wss://gateway.discord.gg';
  private readonly AUTH_ENDPOINT = 'https://discord.com/api/oauth2/authorize';
  private readonly TOKEN_ENDPOINT = 'https://discord.com/api/oauth2/token';

  // OAuth scopes for comprehensive Discord integration
  private readonly OAUTH_SCOPES = [
    'identify',
    'email',
    'guilds',
    'guilds.join',
    'guilds.members.read',
    'gdm.join',
    'messages.read',
    'rpc',
    'rpc.notifications.read',
    'rpc.voice.read',
    'rpc.voice.write',
    'rpc.activities.write',
    'webhook.incoming',
    'applications.commands',
    'applications.commands.permissions.update'
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
      this.api.logger.info('Initializing Discord plugin...');
      
      // Load configuration
      const savedConfig = await this.api.storage.get<DiscordPluginConfig>('config');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }

      // Load authentication tokens
      this.authTokens = await this.api.storage.get<DiscordAuthTokens>('auth_tokens');
      
      if (this.authTokens) {
        if (this.isTokenExpired(this.authTokens)) {
          await this.refreshAccessToken();
        }
        
        await this.initializeGatewayConnection();
        this.startBackgroundSync();
        this.registerSearchProvider();
      }

      this.isInitialized = true;
      this.api.logger.info('Discord plugin initialized successfully');
    } catch (error) {
      this.api.logger.error('Failed to initialize Discord plugin:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Discord using OAuth2
   */
  async authenticate(): Promise<void> {
    try {
      this.api.logger.info('Starting Discord OAuth authentication...');
      
      const authCode = await this.api.oauth.startFlow('discord', this.OAUTH_SCOPES);
      const tokens = await this.exchangeAuthCode(authCode);
      
      this.authTokens = tokens;
      await this.api.storage.set('auth_tokens', tokens);
      
      await this.initializeGatewayConnection();
      this.startBackgroundSync();
      this.registerSearchProvider();
      
      this.api.ui.showNotification({
        title: 'Discord Connected',
        body: 'Successfully authenticated with Discord',
        timeout: 5000
      });
      
      this.api.logger.info('Discord authentication completed successfully');
    } catch (error) {
      this.api.logger.error('Discord authentication failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    try {
      this.api.logger.info('Disconnecting from Discord...');
      
      // Close Gateway connection
      if (this.gatewayConnection) {
        this.gatewayConnection.close();
        this.gatewayConnection = null;
      }
      
      // Close voice connections
      for (const [guildId, voiceWs] of this.voiceConnections) {
        voiceWs.close();
        this.voiceConnections.delete(guildId);
      }
      
      // Clear intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      
      for (const [id, interval] of this.syncIntervals) {
        clearInterval(interval);
        this.syncIntervals.delete(id);
      }
      
      // Clear stored data
      await this.api.storage.remove('auth_tokens');
      this.authTokens = null;
      
      // Clear caches
      this.messageCache.clear();
      this.guildCache.clear();
      this.channelCache.clear();
      this.userCache.clear();
      this.presenceCache.clear();
      this.rateLimitInfo.clear();
      
      this.api.ui.showNotification({
        title: 'Discord Disconnected',
        body: 'Successfully disconnected from Discord',
        timeout: 5000
      });
      
      this.api.logger.info('Discord disconnection completed');
    } catch (error) {
      this.api.logger.error('Discord disconnection failed:', error);
      throw error;
    }
  }

  /**
   * Send a message to a Discord channel or DM
   */
  async sendMessage(channelId: string, content: string, embeds?: any[]): Promise<DiscordMessage> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.API_BASE}/channels/${channelId}/messages`;
      const messageBody: any = { content };
      
      if (embeds && embeds.length > 0) {
        messageBody.embeds = embeds;
      }
      
      const response = await this.makeApiRequest('POST', endpoint, messageBody);
      const message = response as DiscordMessage;
      
      this.updateMessageCache(channelId, message);
      await this.indexMessage(message);
      
      this.api.logger.info(`Message sent to channel: ${channelId}`);
      return message;
    } catch (error) {
      this.api.logger.error('Failed to send Discord message:', error);
      throw error;
    }
  }

  /**
   * Get user's guilds (servers)
   */
  async getUserGuilds(): Promise<DiscordGuild[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.API_BASE}/users/@me/guilds`;
      const response = await this.makeApiRequest('GET', endpoint);
      
      const guilds = response as DiscordGuild[];
      
      // Cache guilds
      guilds.forEach(guild => {
        this.guildCache.set(guild.id, guild);
      });
      
      this.api.logger.info(`Retrieved ${guilds.length} guilds`);
      return guilds;
    } catch (error) {
      this.api.logger.error('Failed to get user guilds:', error);
      throw error;
    }
  }

  /**
   * Get guild channels
   */
  async getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.API_BASE}/guilds/${guildId}/channels`;
      const response = await this.makeApiRequest('GET', endpoint);
      
      const channels = response as DiscordChannel[];
      
      // Cache channels
      channels.forEach(channel => {
        this.channelCache.set(channel.id, channel);
      });
      
      this.api.logger.info(`Retrieved ${channels.length} channels for guild: ${guildId}`);
      return channels;
    } catch (error) {
      this.api.logger.error(`Failed to get channels for guild ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Get channel messages
   */
  async getChannelMessages(channelId: string, limit: number = 50, before?: string): Promise<DiscordMessage[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.API_BASE}/channels/${channelId}/messages`;
      const params = new URLSearchParams({ limit: limit.toString() });
      
      if (before) {
        params.append('before', before);
      }
      
      const response = await this.makeApiRequest('GET', `${endpoint}?${params}`);
      const messages = response as DiscordMessage[];
      
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
   * Join a voice channel
   */
  async joinVoiceChannel(guildId: string, channelId: string, mute = false, deaf = false): Promise<void> {
    try {
      this.ensureAuthenticated();
      
      if (!this.gatewayConnection) {
        throw new Error('Gateway connection not established');
      }
      
      // Send voice state update
      const payload: DiscordGatewayPayload = {
        op: DiscordGatewayOpcode.VOICE_STATE_UPDATE,
        d: {
          guild_id: guildId,
          channel_id: channelId,
          self_mute: mute,
          self_deaf: deaf
        }
      };
      
      this.gatewayConnection.send(JSON.stringify(payload));
      
      this.api.ui.showNotification({
        title: 'Voice Channel Joined',
        body: `Joined voice channel in ${this.guildCache.get(guildId)?.name || 'server'}`,
        timeout: 3000
      });
      
      this.api.logger.info(`Joined voice channel: ${channelId} in guild: ${guildId}`);
    } catch (error) {
      this.api.logger.error('Failed to join voice channel:', error);
      throw error;
    }
  }

  /**
   * Leave voice channel
   */
  async leaveVoiceChannel(guildId: string): Promise<void> {
    try {
      if (!this.gatewayConnection) {
        throw new Error('Gateway connection not established');
      }
      
      // Send voice state update to leave
      const payload: DiscordGatewayPayload = {
        op: DiscordGatewayOpcode.VOICE_STATE_UPDATE,
        d: {
          guild_id: guildId,
          channel_id: null,
          self_mute: false,
          self_deaf: false
        }
      };
      
      this.gatewayConnection.send(JSON.stringify(payload));
      
      // Close voice connection if exists
      const voiceWs = this.voiceConnections.get(guildId);
      if (voiceWs) {
        voiceWs.close();
        this.voiceConnections.delete(guildId);
      }
      
      this.api.logger.info(`Left voice channel in guild: ${guildId}`);
    } catch (error) {
      this.api.logger.error('Failed to leave voice channel:', error);
      throw error;
    }
  }

  /**
   * Update user presence/activity
   */
  async updatePresence(status: 'online' | 'idle' | 'dnd' | 'invisible', activity?: any): Promise<void> {
    try {
      if (!this.gatewayConnection) {
        throw new Error('Gateway connection not established');
      }
      
      const payload: DiscordGatewayPayload = {
        op: DiscordGatewayOpcode.PRESENCE_UPDATE,
        d: {
          since: null,
          status,
          afk: status === 'idle',
          activities: activity ? [activity] : []
        }
      };
      
      this.gatewayConnection.send(JSON.stringify(payload));
      
      this.api.logger.info(`Updated Discord presence to: ${status}`);
    } catch (error) {
      this.api.logger.error('Failed to update presence:', error);
      throw error;
    }
  }

  /**
   * Search Discord content
   */
  async search(query: string, guildId?: string, channelId?: string): Promise<DiscordSearchResult[]> {
    try {
      this.ensureAuthenticated();
      
      // Discord doesn't have a dedicated search API, so we'll search cached content
      const results: DiscordSearchResult[] = [];
      
      // Search messages
      for (const [cacheChannelId, messages] of this.messageCache) {
        if (channelId && cacheChannelId !== channelId) continue;
        
        const channel = this.channelCache.get(cacheChannelId);
        if (guildId && channel?.guild_id !== guildId) continue;
        
        const matchingMessages = messages.filter(message =>
          message.content.toLowerCase().includes(query.toLowerCase()) ||
          message.author.username.toLowerCase().includes(query.toLowerCase())
        );
        
        results.push(...matchingMessages.map(message => ({
          id: message.id,
          title: `Message from ${message.author.username}`,
          description: message.content.substring(0, 200),
          contentType: 'message' as const,
          channelId: message.channel_id,
          serverId: channel?.guild_id,
          authorId: message.author.id,
          author: message.author,
          timestamp: new Date(message.timestamp),
          score: this.calculateRelevanceScore(message.content, query),
          metadata: {
            messageType: message.type,
            hasAttachments: message.attachments.length > 0,
            hasEmbeds: message.embeds.length > 0,
            channelName: channel?.name
          }
        })));
      }
      
      // Sort by relevance
      results.sort((a, b) => b.score - a.score);
      
      this.api.logger.info(`Search query "${query}" returned ${results.length} results`);
      return results.slice(0, 50); // Limit results
    } catch (error) {
      this.api.logger.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * Private Methods
   */

  private getDefaultConfig(): DiscordPluginConfig {
    return {
      enableNotifications: true,
      notificationTypes: ['mentions', 'direct-messages', 'voice-events'],
      monitoredServers: [],
      syncHistoryDays: 14,
      enableRichPresence: true,
      autoJoinVoice: false,
      soundSettings: {
        enableSounds: true,
        messageSound: 'discord_notification',
        voiceSound: 'discord_voice'
      },
      privacySettings: {
        indexPrivateMessages: false,
        shareOnlineStatus: true
      },
      botSettings: {
        enableBotCommands: true,
        botCommandPrefix: '!'
      }
    };
  }

  private setupEventListeners(): void {
    this.api.events.on<DiscordPluginConfig>('config-updated', async (config) => {
      this.config = { ...this.config, ...config };
      await this.api.storage.set('config', this.config);
      this.api.logger.info('Discord plugin configuration updated');
    });
  }

  private registerAutomationTriggers(): void {
    const triggers: TriggerDefinition[] = [
      {
        id: 'discord-message-received',
        name: 'Discord Message Received',
        description: 'Triggered when a new message is received in Discord',
        configSchema: {
          type: 'object',
          properties: {
            guildId: { type: 'string', title: 'Server ID' },
            channelId: { type: 'string', title: 'Channel ID' },
            keywords: { type: 'array', items: { type: 'string' }, title: 'Keywords' }
          }
        },
        handler: async (config, context) => {
          return this.handleMessageTrigger(config, context);
        }
      },
      {
        id: 'discord-voice-joined',
        name: 'Discord Voice Channel Joined',
        description: 'Triggered when someone joins a voice channel',
        configSchema: {
          type: 'object',
          properties: {
            guildId: { type: 'string', title: 'Server ID' },
            channelId: { type: 'string', title: 'Voice Channel ID' }
          }
        },
        handler: async (config, context) => {
          return this.handleVoiceJoinTrigger(config, context);
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
        id: 'discord-send-message',
        name: 'Send Discord Message',
        description: 'Send a message to a Discord channel',
        configSchema: {
          type: 'object',
          properties: {
            channelId: { type: 'string', title: 'Channel ID' },
            message: { type: 'string', title: 'Message' }
          },
          required: ['channelId', 'message']
        },
        handler: async (config, context) => {
          return this.sendMessage(config.channelId, config.message);
        }
      }
    ];

    actions.forEach(action => {
      this.api.automation.registerAction(action);
    });
  }

  private registerSearchProvider(): void {
    this.api.search.registerProvider({
      id: 'discord',
      name: 'Discord',
      icon: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a69f118df70ad7828d4_icon_clyde_blurple_RGB.svg',
      search: async (query, options) => {
        const discordResults = await this.search(query);
        return discordResults.map(result => ({
          id: result.id,
          title: result.title,
          description: result.description,
          url: result.url,
          contentType: result.contentType,
          provider: 'discord',
          score: result.score,
          lastModified: result.timestamp,
          metadata: result.metadata
        }));
      },
      contentTypes: ['message', 'channel', 'server', 'user']
    });
  }

  private async initializeGatewayConnection(): Promise<void> {
    try {
      // Get Gateway URL
      const gatewayResponse = await this.makeApiRequest('GET', `${this.API_BASE}/gateway/bot`);
      const gatewayUrl = gatewayResponse.url;
      
      this.gatewayConnection = new WebSocket(`${gatewayUrl}?v=10&encoding=json`);
      
      this.gatewayConnection.onopen = () => {
        this.api.logger.info('Discord Gateway connection established');
      };
      
      this.gatewayConnection.onmessage = (event) => {
        this.handleGatewayMessage(JSON.parse(event.data));
      };
      
      this.gatewayConnection.onclose = (event) => {
        this.api.logger.warn(`Gateway connection closed: ${event.code} ${event.reason}`);
        
        // Attempt to reconnect
        setTimeout(() => {
          this.initializeGatewayConnection();
        }, 5000);
      };
      
      this.gatewayConnection.onerror = (error) => {
        this.api.logger.error('Gateway connection error:', error);
      };
      
    } catch (error) {
      this.api.logger.error('Failed to initialize Gateway connection:', error);
      throw error;
    }
  }

  private handleGatewayMessage(payload: DiscordGatewayPayload): void {
    const { op, d, s, t } = payload;
    
    // Update sequence number
    if (s !== null) {
      this.sequenceNumber = s;
    }
    
    switch (op) {
      case DiscordGatewayOpcode.HELLO:
        this.startHeartbeat(d.heartbeat_interval);
        this.identify();
        break;
        
      case DiscordGatewayOpcode.HEARTBEAT_ACK:
        // Heartbeat acknowledged
        break;
        
      case DiscordGatewayOpcode.RECONNECT:
        this.api.logger.info('Gateway requested reconnection');
        this.gatewayConnection?.close();
        break;
        
      case DiscordGatewayOpcode.INVALID_SESSION:
        this.api.logger.warn('Invalid session, re-identifying');
        setTimeout(() => this.identify(), Math.random() * 5000);
        break;
        
      case DiscordGatewayOpcode.DISPATCH:
        this.handleGatewayEvent(t!, d);
        break;
    }
  }

  private startHeartbeat(interval: number): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.gatewayConnection?.readyState === WebSocket.OPEN) {
        this.gatewayConnection.send(JSON.stringify({
          op: DiscordGatewayOpcode.HEARTBEAT,
          d: this.sequenceNumber
        }));
      }
    }, interval);
  }

  private identify(): void {
    if (this.gatewayConnection?.readyState === WebSocket.OPEN) {
      this.gatewayConnection.send(JSON.stringify({
        op: DiscordGatewayOpcode.IDENTIFY,
        d: {
          token: this.authTokens!.accessToken,
          properties: {
            $os: 'Flow Desk',
            $browser: 'Flow Desk',
            $device: 'Flow Desk'
          },
          intents: 0b11111111111111 // All intents for comprehensive integration
        }
      }));
    }
  }

  private handleGatewayEvent(eventType: string, data: any): void {
    switch (eventType) {
      case 'READY':
        this.handleReadyEvent(data);
        break;
        
      case 'MESSAGE_CREATE':
        this.handleMessageCreate(data);
        break;
        
      case 'VOICE_STATE_UPDATE':
        this.handleVoiceStateUpdate(data);
        break;
        
      case 'GUILD_CREATE':
        this.handleGuildCreate(data);
        break;
        
      case 'PRESENCE_UPDATE':
        this.handlePresenceUpdate(data);
        break;
        
      default:
        this.api.logger.debug(`Unhandled gateway event: ${eventType}`);
    }
  }

  private handleReadyEvent(data: any): void {
    this.api.logger.info(`Discord Ready: Logged in as ${data.user.username}#${data.user.discriminator}`);
    
    // Cache user data
    this.userCache.set(data.user.id, data.user);
    
    // Set rich presence if enabled
    if (this.config.enableRichPresence) {
      this.updatePresence('online', {
        name: 'Flow Desk',
        type: 0, // Playing
        details: 'Managing productivity',
        state: 'Connected'
      });
    }
  }

  private async handleMessageCreate(message: DiscordMessage): Promise<void> {
    // Update cache
    this.updateMessageCache(message.channel_id, message);
    
    // Index for search if allowed
    if (this.shouldIndexMessage(message)) {
      await this.indexMessage(message);
    }
    
    // Check for notifications
    if (this.shouldNotifyForMessage(message)) {
      this.showMessageNotification(message);
    }
    
    // Trigger automation
    this.api.events.emit('discord-message-received', { data: message });
  }

  private handleVoiceStateUpdate(voiceState: DiscordVoiceState): void {
    this.api.events.emit('discord-voice-state-update', { data: voiceState });
    
    // Show notification for voice events if configured
    if (this.config.notificationTypes.includes('voice-events')) {
      const user = this.userCache.get(voiceState.user_id);
      if (user && voiceState.channel_id) {
        this.api.ui.showNotification({
          title: 'Voice Channel Activity',
          body: `${user.username} joined a voice channel`,
          timeout: 3000
        });
      }
    }
  }

  private handleGuildCreate(guild: DiscordGuild): void {
    this.guildCache.set(guild.id, guild);
    this.api.logger.info(`Guild loaded: ${guild.name}`);
  }

  private handlePresenceUpdate(presence: DiscordPresence): void {
    this.presenceCache.set(presence.user.id!, presence);
  }

  private startBackgroundSync(): void {
    // Sync messages every 2 minutes
    const messageSync = setInterval(async () => {
      await this.syncRecentMessages();
    }, 2 * 60 * 1000);

    this.syncIntervals.set('messages', messageSync);
  }

  private async syncRecentMessages(): Promise<void> {
    try {
      for (const guildId of this.config.monitoredServers) {
        const channels = await this.getGuildChannels(guildId);
        
        for (const channel of channels) {
          if (channel.type === DiscordChannelType.GUILD_TEXT) {
            const messages = await this.getChannelMessages(channel.id, 20);
            // Messages are automatically cached and indexed
          }
        }
      }
    } catch (error) {
      this.api.logger.error('Background message sync failed:', error);
    }
  }

  private shouldIndexMessage(message: DiscordMessage): boolean {
    // Check privacy settings
    const channel = this.channelCache.get(message.channel_id);
    if (channel?.type === DiscordChannelType.DM && !this.config.privacySettings.indexPrivateMessages) {
      return false;
    }
    
    // Don't index bot messages
    if (message.author.bot) {
      return false;
    }
    
    return true;
  }

  private shouldNotifyForMessage(message: DiscordMessage): boolean {
    if (!this.config.enableNotifications) return false;
    
    // Don't notify for own messages
    if (message.author.id === this.userCache.get('@me')?.id) return false;
    
    // Check notification types
    const channel = this.channelCache.get(message.channel_id);
    
    if (channel?.type === DiscordChannelType.DM) {
      return this.config.notificationTypes.includes('direct-messages');
    }
    
    // Check for mentions
    const currentUser = this.userCache.get('@me');
    if (currentUser && message.mentions.some(user => user.id === currentUser.id)) {
      return this.config.notificationTypes.includes('mentions');
    }
    
    // Check for server messages if configured
    if (channel?.guild_id && this.config.monitoredServers.includes(channel.guild_id)) {
      return this.config.notificationTypes.includes('server-messages');
    }
    
    return false;
  }

  private showMessageNotification(message: DiscordMessage): void {
    const channel = this.channelCache.get(message.channel_id);
    const guild = channel?.guild_id ? this.guildCache.get(channel.guild_id) : null;
    
    const title = guild 
      ? `${message.author.username} in #${channel?.name} (${guild.name})`
      : `${message.author.username}`;
    
    this.api.ui.showNotification({
      title,
      body: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      icon: message.author.avatar 
        ? `${this.CDN_BASE}/avatars/${message.author.id}/${message.author.avatar}.png`
        : undefined,
      actions: [
        { action: 'reply', title: 'Reply' },
        { action: 'view', title: 'View Channel' }
      ],
      timeout: 10000
    });
  }

  private async indexMessage(message: DiscordMessage): Promise<void> {
    const channel = this.channelCache.get(message.channel_id);
    const guild = channel?.guild_id ? this.guildCache.get(channel.guild_id) : null;
    
    const searchableContent: SearchableContent = {
      id: message.id,
      title: `Message from ${message.author.username}`,
      body: message.content,
      contentType: 'discord-message',
      metadata: {
        authorId: message.author.id,
        authorName: message.author.username,
        channelId: message.channel_id,
        channelName: channel?.name,
        guildId: guild?.id,
        guildName: guild?.name,
        messageType: message.type,
        hasAttachments: message.attachments.length > 0,
        hasEmbeds: message.embeds.length > 0
      },
      tags: [
        'discord',
        'message',
        message.author.username,
        ...(guild ? [guild.name] : []),
        ...(channel?.name ? [channel.name] : [])
      ],
      lastModified: new Date(message.timestamp)
    };

    await this.api.search.index(searchableContent);
  }

  private calculateRelevanceScore(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerText.includes(lowerQuery)) {
      // Exact match gets higher score
      const index = lowerText.indexOf(lowerQuery);
      return 1.0 - (index / lowerText.length) * 0.5; // Earlier matches score higher
    }
    
    // Partial matches
    const words = lowerQuery.split(' ');
    let matches = 0;
    for (const word of words) {
      if (lowerText.includes(word)) {
        matches++;
      }
    }
    
    return matches / words.length * 0.7; // Lower score for partial matches
  }

  private updateMessageCache(channelId: string, message: DiscordMessage): void {
    const cached = this.messageCache.get(channelId) || [];
    
    // Add to beginning of array
    cached.unshift(message);
    
    // Keep cache size manageable
    const maxCacheSize = 100;
    if (cached.length > maxCacheSize) {
      cached.splice(maxCacheSize);
    }
    
    this.messageCache.set(channelId, cached);
  }

  private async handleMessageTrigger(config: any, context: any): Promise<boolean> {
    const message = context.data as DiscordMessage;
    
    if (config.guildId) {
      const channel = this.channelCache.get(message.channel_id);
      if (channel?.guild_id !== config.guildId) {
        return false;
      }
    }
    
    if (config.channelId && message.channel_id !== config.channelId) {
      return false;
    }
    
    if (config.keywords?.length > 0) {
      const messageText = message.content.toLowerCase();
      const hasKeyword = config.keywords.some((keyword: string) =>
        messageText.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }
    
    return true;
  }

  private async handleVoiceJoinTrigger(config: any, context: any): Promise<boolean> {
    const voiceState = context.data as DiscordVoiceState;
    
    if (config.guildId && voiceState.guild_id !== config.guildId) {
      return false;
    }
    
    if (config.channelId && voiceState.channel_id !== config.channelId) {
      return false;
    }
    
    return voiceState.channel_id !== null; // User joined (not left)
  }

  private async exchangeAuthCode(code: string): Promise<DiscordAuthTokens> {
    const response = await fetch(this.TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
        scope: this.OAUTH_SCOPES.join(' ')
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
      scope: data.scope
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
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: this.authTokens.refreshToken
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
        await this.handleRateLimit(url);

        const response = await this.api.network.fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });

        this.updateRateLimitInfo(url, response);

        if (response.status === 401) {
          await this.refreshAccessToken();
          headers['Authorization'] = `Bearer ${this.authTokens!.accessToken}`;
          continue;
        }

        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
          await this.delay(retryAfter * 1000);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Discord API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        return response.json();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          throw error;
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  private isTokenExpired(tokens: DiscordAuthTokens): boolean {
    return new Date() >= tokens.expiresAt;
  }

  private ensureAuthenticated(): void {
    if (!this.authTokens) {
      throw new Error('Not authenticated with Discord');
    }
  }

  private async handleRateLimit(url: string): Promise<void> {
    const rateLimitInfo = this.rateLimitInfo.get(url);
    if (rateLimitInfo && rateLimitInfo.remaining <= 0 && new Date() < rateLimitInfo.reset) {
      const waitTime = rateLimitInfo.reset.getTime() - Date.now();
      await this.delay(waitTime);
    }
  }

  private updateRateLimitInfo(url: string, response: Response): void {
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '10');
    const reset = new Date((parseInt(response.headers.get('X-RateLimit-Reset') || '0') || Date.now() / 1000 + 60) * 1000);
    const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '10');

    this.rateLimitInfo.set(url, {
      remaining,
      reset,
      limit,
      bucket: response.headers.get('X-RateLimit-Bucket') || undefined,
      global: response.headers.get('X-RateLimit-Global') === 'true',
      retryAfter: parseInt(response.headers.get('Retry-After') || '0')
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}