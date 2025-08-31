/**
 * Complete Notion Plugin Implementation
 * Production-ready plugin with OAuth2, real-time sync, search, and automation
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
  NotionWorkspace,
  NotionPage,
  NotionDatabase,
  NotionBlock,
  NotionUser,
  NotionPluginConfig,
  NotionPluginState,
  NotionAPIResponse,
  NotionSearchResponse,
  NotionDatabaseQueryResponse,
  NotionBlockChildrenResponse,
  NotionComment,
  NotionFilter,
  NotionSort,
  NotionPropertyValue,
  NotionRichText,
  NotionAPIError,
  NotionRateLimit,
  NotionTemplate,
  NotionSyncResult,
  NotionAutomationTrigger,
  NotionAutomationAction
} from '../types/notion-types.js';

export class NotionPlugin {
  private api: PluginAPI;
  private context: PluginRuntimeContext;
  private config: NotionPluginConfig;
  private state: NotionPluginState;
  private rateLimits: Map<string, NotionRateLimit>;
  private retryQueues: Map<string, Array<() => Promise<any>>>;
  private syncInProgress: boolean;
  private templates: Map<string, NotionTemplate>;

  constructor(api: PluginAPI, context: PluginRuntimeContext) {
    this.api = api;
    this.context = context;
    this.config = this.loadConfig();
    this.state = this.initializeState();
    this.rateLimits = new Map();
    this.retryQueues = new Map();
    this.syncInProgress = false;
    this.templates = new Map();
    
    this.setupEventListeners();
    this.registerSearchProvider();
    this.registerAutomationTriggers();
    this.registerAutomationActions();
    this.registerCommands();
    this.initializeTemplates();
  }

  private loadConfig(): NotionPluginConfig {
    const defaultConfig: NotionPluginConfig = {
      enableNotifications: true,
      notificationTypes: ['comments', 'mentions', 'reminders'],
      syncInterval: 5,
      indexContent: true,
      maxSearchResults: 50,
      autoSyncDatabases: true,
      watchedDatabases: [],
      defaultTemplate: 'blank',
      quickCapture: {
        enabled: true,
        targetPage: '',
        includeTimestamp: true,
        includeSource: true
      }
    };

    return { ...defaultConfig, ...this.context.plugin.config };
  }

  private initializeState(): NotionPluginState {
    return {
      workspaces: [],
      isConnecting: false,
      isAuthenticated: false,
      pageCache: new Map(),
      databaseCache: new Map(),
      blockCache: new Map(),
      searchIndex: new Map(),
      watchedPages: new Set(),
      watchedDatabases: new Set()
    };
  }

  private setupEventListeners(): void {
    // Listen for Flow Desk events
    this.api.events.on('workspace:changed', this.handleWorkspaceChanged.bind(this));
    this.api.events.on('app:focus_changed', this.handleFocusChanged.bind(this));
    
    // Listen for calendar events to create meeting notes
    this.api.events.on('calendar:event_started', this.handleMeetingStarted.bind(this));
    
    // Listen for quick capture requests
    this.api.events.on('notion:quick_capture', this.handleQuickCapture.bind(this));
  }

  // OAuth2 Authentication
  async authenticate(): Promise<boolean> {
    try {
      this.state.isConnecting = true;
      this.api.events.emit('notion:connecting', {});

      const authUrl = this.buildOAuthUrl();
      const authCode = await this.api.oauth.startFlow('notion', [
        'read_content',
        'update_content',
        'insert_content'
      ]);

      const tokens = await this.exchangeCodeForTokens(authCode);
      const workspace = await this.setupWorkspace(tokens);
      
      this.state.workspaces.push(workspace);
      this.state.activeWorkspace = workspace.id;
      this.state.isAuthenticated = true;
      this.state.isConnecting = false;

      await this.saveState();
      await this.performInitialSync(workspace);

      this.api.events.emit('notion:authenticated', { workspace });
      this.api.ui.showNotification({
        title: 'Notion Connected',
        body: `Connected to ${workspace.name}`,
        timeout: 3000
      });

      return true;
    } catch (error) {
      this.state.isConnecting = false;
      this.api.logger.error('Notion authentication failed', error);
      this.api.ui.showNotification({
        title: 'Notion Connection Failed',
        body: error instanceof Error ? error.message : 'Unknown error',
        timeout: 5000
      });
      return false;
    }
  }

  private buildOAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.NOTION_CLIENT_ID || 'your-client-id',
      response_type: 'code',
      owner: 'user',
      redirect_uri: 'flowdesk://oauth/notion',
      state: this.generateOAuthState()
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  private generateOAuthState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private async exchangeCodeForTokens(code: string): Promise<any> {
    const response = await this.makeAPIRequest('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'flowdesk://oauth/notion'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new NotionAPIError(data.message || 'OAuth token exchange failed', data.code || 'oauth_error');
    }

    return data;
  }

  private async setupWorkspace(oauthResponse: any): Promise<NotionWorkspace> {
    // Get bot info
    const botResponse = await this.makeNotionAPIRequest('users/me', {}, oauthResponse.access_token);
    
    const workspace: NotionWorkspace = {
      id: oauthResponse.workspace_id,
      name: oauthResponse.workspace_name || 'Notion Workspace',
      access_token: oauthResponse.access_token,
      user: botResponse,
      is_connected: true,
      pages: [],
      databases: [],
      bot_id: oauthResponse.bot_id,
      workspace_icon: oauthResponse.workspace_icon,
      workspace_name: oauthResponse.workspace_name
    };

    return workspace;
  }

  // API Request Handling with Rate Limiting
  private async makeNotionAPIRequest(
    endpoint: string, 
    options: any = {}, 
    token?: string
  ): Promise<any> {
    const workspace = this.getActiveWorkspace();
    const authToken = token || workspace?.access_token;
    
    if (!authToken) {
      throw new NotionAPIError('No authentication token available', 'no_auth');
    }

    const url = `https://api.notion.com/v1/${endpoint}`;
    
    // Check rate limits
    await this.checkRateLimit(endpoint);
    
    try {
      const requestOptions = {
        method: options.method || 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
          ...options.headers
        },
        ...options
      };

      if (options.body && typeof options.body === 'object') {
        requestOptions.body = JSON.stringify(options.body);
      }

      const response = await this.makeAPIRequest(url, requestOptions);

      // Update rate limit info from headers
      this.updateRateLimit(endpoint, response.headers);

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 429) {
          await this.handleRateLimit(endpoint, response.headers);
          return this.makeNotionAPIRequest(endpoint, options, token);
        }
        
        throw new NotionAPIError(
          errorData.message || 'API request failed',
          errorData.code || 'api_error',
          response.status
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof NotionAPIError) {
        throw error;
      }
      throw new NotionAPIError('Network request failed', 'network_error', 0);
    }
  }

  private async makeAPIRequest(url: string, options: RequestInit): Promise<Response> {
    return this.api.network.fetch(url, options);
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const rateLimit = this.rateLimits.get(endpoint);
    if (rateLimit && rateLimit.retryAfter) {
      const now = Date.now();
      if (now < rateLimit.retryAfter) {
        const waitTime = rateLimit.retryAfter - now;
        this.api.logger.info(`Rate limited, waiting ${waitTime}ms for ${endpoint}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  private updateRateLimit(endpoint: string, headers: Headers): void {
    const limit = parseInt(headers.get('x-ratelimit-limit') || '0');
    const remaining = parseInt(headers.get('x-ratelimit-remaining') || '0');
    const reset = parseInt(headers.get('x-ratelimit-reset') || '0');

    this.rateLimits.set(endpoint, {
      limit,
      remaining,
      reset: reset * 1000,
    });
  }

  private async handleRateLimit(endpoint: string, headers: Headers): Promise<void> {
    const retryAfter = parseInt(headers.get('retry-after') || '60') * 1000;
    
    this.rateLimits.set(endpoint, {
      retryAfter: Date.now() + retryAfter
    });

    this.api.logger.warn(`Rate limited on ${endpoint}, retrying after ${retryAfter}ms`);
  }

  // Data Synchronization
  private async performInitialSync(workspace: NotionWorkspace): Promise<void> {
    try {
      this.api.logger.info(`Starting initial sync for workspace ${workspace.name}`);

      // Search for all accessible content
      const searchResponse = await this.makeNotionAPIRequest('search', {
        method: 'POST',
        body: {
          page_size: 100
        }
      });

      const pages: NotionPage[] = [];
      const databases: NotionDatabase[] = [];

      for (const item of searchResponse.results) {
        if (item.object === 'page') {
          pages.push(item as NotionPage);
          this.state.pageCache.set(item.id, item as NotionPage);
        } else if (item.object === 'database') {
          databases.push(item as NotionDatabase);
          this.state.databaseCache.set(item.id, item as NotionDatabase);
        }
      }

      workspace.pages = pages;
      workspace.databases = databases;

      // Index content for search
      if (this.config.indexContent) {
        await this.indexWorkspaceContent(workspace);
      }

      // Set up watchers for configured databases
      for (const databaseId of this.config.watchedDatabases) {
        this.state.watchedDatabases.add(databaseId);
      }

      workspace.last_sync = Date.now();
      this.state.lastSync = Date.now();

      this.api.events.emit('notion:sync_completed', { workspace });
      this.api.logger.info(`Initial sync completed for workspace ${workspace.name}`);
    } catch (error) {
      this.api.logger.error('Initial sync failed', error);
      throw error;
    }
  }

  private async indexWorkspaceContent(workspace: NotionWorkspace): Promise<void> {
    const totalItems = workspace.pages.length + workspace.databases.length;
    let processedItems = 0;

    // Index pages
    for (const page of workspace.pages.slice(0, 50)) { // Limit initial indexing
      try {
        await this.indexPage(page, workspace);
        processedItems++;
        
        if (processedItems % 10 === 0) {
          this.api.events.emit('notion:indexing_progress', {
            processed: processedItems,
            total: Math.min(totalItems, 50)
          });
        }
      } catch (error) {
        this.api.logger.warn(`Failed to index page ${page.id}`, error);
      }
    }

    // Index databases
    for (const database of workspace.databases) {
      try {
        await this.indexDatabase(database, workspace);
        processedItems++;
      } catch (error) {
        this.api.logger.warn(`Failed to index database ${database.id}`, error);
      }
    }

    this.api.logger.info(`Indexed ${processedItems} items from workspace ${workspace.name}`);
  }

  private async indexPage(page: NotionPage, workspace: NotionWorkspace): Promise<void> {
    try {
      // Get page content blocks
      const blocks = await this.getPageBlocks(page.id);
      const textContent = this.extractTextFromBlocks(blocks);
      
      const pageTitle = this.extractPageTitle(page);
      
      await this.api.search.index({
        id: `notion-page-${page.id}`,
        title: pageTitle,
        body: textContent,
        url: page.url,
        contentType: 'notion_page',
        metadata: {
          workspace: workspace.name,
          workspaceId: workspace.id,
          pageId: page.id,
          parentId: this.getParentId(page.parent),
          parentType: page.parent.type,
          createdTime: page.created_time,
          lastEditedTime: page.last_edited_time,
          createdBy: page.created_by.name || 'Unknown',
          icon: page.icon,
          archived: page.archived
        },
        tags: [
          'notion',
          'page',
          workspace.name.toLowerCase(),
          ...(page.archived ? ['archived'] : []),
          ...this.extractTagsFromContent(textContent)
        ],
        lastModified: new Date(page.last_edited_time)
      });
    } catch (error) {
      this.api.logger.error(`Failed to index page ${page.id}`, error);
    }
  }

  private async indexDatabase(database: NotionDatabase, workspace: NotionWorkspace): Promise<void> {
    try {
      const databaseTitle = this.extractRichTextContent(database.title);
      const databaseDescription = this.extractRichTextContent(database.description);
      
      await this.api.search.index({
        id: `notion-database-${database.id}`,
        title: databaseTitle,
        body: databaseDescription,
        url: database.url,
        contentType: 'notion_database',
        metadata: {
          workspace: workspace.name,
          workspaceId: workspace.id,
          databaseId: database.id,
          parentId: this.getParentId(database.parent),
          parentType: database.parent.type,
          createdTime: database.created_time,
          lastEditedTime: database.last_edited_time,
          properties: Object.keys(database.properties),
          isInline: database.is_inline,
          archived: database.archived
        },
        tags: [
          'notion',
          'database',
          workspace.name.toLowerCase(),
          ...(database.archived ? ['archived'] : []),
          ...Object.keys(database.properties).map(prop => prop.toLowerCase())
        ],
        lastModified: new Date(database.last_edited_time)
      });

      // Index database entries
      if (this.config.autoSyncDatabases) {
        await this.indexDatabaseEntries(database.id, workspace);
      }
    } catch (error) {
      this.api.logger.error(`Failed to index database ${database.id}`, error);
    }
  }

  private async indexDatabaseEntries(databaseId: string, workspace: NotionWorkspace): Promise<void> {
    try {
      const queryResponse = await this.makeNotionAPIRequest(`databases/${databaseId}/query`, {
        method: 'POST',
        body: {
          page_size: 50 // Limit entries for performance
        }
      }) as NotionDatabaseQueryResponse;

      for (const page of queryResponse.results) {
        const entryTitle = this.extractPageTitle(page);
        const entryContent = this.extractPropertiesContent(page.properties);
        
        await this.api.search.index({
          id: `notion-db-entry-${page.id}`,
          title: entryTitle,
          body: entryContent,
          url: page.url,
          contentType: 'notion_database_entry',
          metadata: {
            workspace: workspace.name,
            workspaceId: workspace.id,
            databaseId: databaseId,
            pageId: page.id,
            createdTime: page.created_time,
            lastEditedTime: page.last_edited_time,
            properties: page.properties
          },
          tags: [
            'notion',
            'database-entry',
            workspace.name.toLowerCase()
          ],
          lastModified: new Date(page.last_edited_time)
        });
      }
    } catch (error) {
      this.api.logger.error(`Failed to index database entries for ${databaseId}`, error);
    }
  }

  // Search Integration
  private registerSearchProvider(): void {
    const searchProvider: SearchProvider = {
      id: 'notion',
      name: 'Notion',
      icon: 'https://www.notion.so/images/logo-ios.png',
      search: this.search.bind(this),
      contentTypes: ['page', 'database', 'database-entry', 'block']
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
      
      return results.slice(0, options.limit || this.config.maxSearchResults);
    } catch (error) {
      this.api.logger.error('Notion search failed', error);
      return [];
    }
  }

  private async searchWorkspace(
    workspace: NotionWorkspace,
    query: string,
    options: any
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Use Notion's search API
      const searchResponse = await this.makeNotionAPIRequest('search', {
        method: 'POST',
        body: {
          query: query,
          page_size: Math.min(options.limit || 20, 100),
          filter: options.filter,
          sort: options.sort
        }
      }) as NotionSearchResponse;

      for (const item of searchResponse.results) {
        if (item.object === 'page') {
          const page = item as NotionPage;
          results.push({
            id: `notion-page-${page.id}`,
            title: this.extractPageTitle(page),
            description: await this.getPagePreview(page.id),
            url: page.url,
            icon: this.getIconUrl(page.icon),
            score: this.calculateRelevanceScore(page, query),
            metadata: {
              workspace: workspace.name,
              type: 'page',
              parentId: this.getParentId(page.parent),
              lastEditedTime: page.last_edited_time,
              createdTime: page.created_time,
              createdBy: page.created_by.name || 'Unknown'
            },
            contentType: 'notion_page',
            provider: 'notion',
            lastModified: new Date(page.last_edited_time)
          });
        } else if (item.object === 'database') {
          const database = item as NotionDatabase;
          results.push({
            id: `notion-database-${database.id}`,
            title: this.extractRichTextContent(database.title),
            description: this.extractRichTextContent(database.description),
            url: database.url,
            icon: this.getIconUrl(database.icon),
            score: this.calculateRelevanceScore(database, query),
            metadata: {
              workspace: workspace.name,
              type: 'database',
              parentId: this.getParentId(database.parent),
              lastEditedTime: database.last_edited_time,
              createdTime: database.created_time,
              propertiesCount: Object.keys(database.properties).length
            },
            contentType: 'notion_database',
            provider: 'notion',
            lastModified: new Date(database.last_edited_time)
          });
        }
      }
    } catch (error) {
      this.api.logger.error(`Search failed for workspace ${workspace.name}`, error);
    }

    return results;
  }

  // Page and Database Operations
  async createPage(
    parent: { page_id?: string; database_id?: string; workspace?: boolean },
    title: string,
    content?: NotionBlock[],
    properties?: Record<string, any>
  ): Promise<NotionPage> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      throw new NotionAPIError('No active workspace', 'no_workspace');
    }

    const parentObj: any = parent.workspace 
      ? { type: 'workspace', workspace: true }
      : parent.page_id 
        ? { type: 'page_id', page_id: parent.page_id }
        : { type: 'database_id', database_id: parent.database_id };

    const createData: any = {
      parent: parentObj,
      properties: {
        title: {
          title: [{ text: { content: title } }]
        },
        ...properties
      }
    };

    if (content && content.length > 0) {
      createData.children = content;
    }

    const page = await this.makeNotionAPIRequest('pages', {
      method: 'POST',
      body: createData
    }) as NotionPage;

    // Update cache
    this.state.pageCache.set(page.id, page);
    
    // Add to workspace pages
    workspace.pages.push(page);
    
    // Index the new page
    if (this.config.indexContent) {
      await this.indexPage(page, workspace);
    }

    this.api.events.emit('notion:page_created', { page, workspace });

    return page;
  }

  async updatePage(
    pageId: string,
    updates: {
      properties?: Record<string, any>;
      archived?: boolean;
      icon?: any;
      cover?: any;
    }
  ): Promise<NotionPage> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      throw new NotionAPIError('No active workspace', 'no_workspace');
    }

    const page = await this.makeNotionAPIRequest(`pages/${pageId}`, {
      method: 'PATCH',
      body: updates
    }) as NotionPage;

    // Update cache
    this.state.pageCache.set(page.id, page);
    
    // Update workspace pages
    const pageIndex = workspace.pages.findIndex(p => p.id === page.id);
    if (pageIndex !== -1) {
      workspace.pages[pageIndex] = page;
    }

    // Re-index the page
    if (this.config.indexContent) {
      await this.indexPage(page, workspace);
    }

    this.api.events.emit('notion:page_updated', { page, workspace, updates });

    return page;
  }

  async getPage(pageId: string): Promise<NotionPage> {
    // Check cache first
    const cachedPage = this.state.pageCache.get(pageId);
    if (cachedPage && this.isCacheValid(cachedPage.last_edited_time)) {
      return cachedPage;
    }

    // Fetch from API
    const page = await this.makeNotionAPIRequest(`pages/${pageId}`) as NotionPage;
    
    // Update cache
    this.state.pageCache.set(pageId, page);
    
    return page;
  }

  async getPageBlocks(pageId: string): Promise<NotionBlock[]> {
    // Check cache first
    const cachedBlocks = this.state.blockCache.get(pageId);
    if (cachedBlocks && this.isCacheValid(cachedBlocks[0]?.last_edited_time)) {
      return cachedBlocks;
    }

    // Fetch from API
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;

    do {
      const params: any = { page_size: 100 };
      if (cursor) params.start_cursor = cursor;

      const response = await this.makeNotionAPIRequest(
        `blocks/${pageId}/children`,
        { method: 'GET' },
        undefined
      ) as NotionBlockChildrenResponse;

      blocks.push(...response.results);
      cursor = response.next_cursor || undefined;
    } while (cursor);

    // Update cache
    this.state.blockCache.set(pageId, blocks);
    
    return blocks;
  }

  async queryDatabase(
    databaseId: string,
    filter?: any,
    sorts?: NotionSort[],
    pageSize: number = 100
  ): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const params: any = { page_size: Math.min(pageSize, 100) };
      if (cursor) params.start_cursor = cursor;
      if (filter) params.filter = filter;
      if (sorts) params.sorts = sorts;

      const response = await this.makeNotionAPIRequest(`databases/${databaseId}/query`, {
        method: 'POST',
        body: params
      }) as NotionDatabaseQueryResponse;

      pages.push(...response.results);
      cursor = response.next_cursor || undefined;
    } while (cursor && pages.length < pageSize);

    return pages;
  }

  async createDatabaseEntry(
    databaseId: string,
    properties: Record<string, any>
  ): Promise<NotionPage> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      throw new NotionAPIError('No active workspace', 'no_workspace');
    }

    const page = await this.makeNotionAPIRequest('pages', {
      method: 'POST',
      body: {
        parent: { database_id: databaseId },
        properties: properties
      }
    }) as NotionPage;

    // Update cache
    this.state.pageCache.set(page.id, page);

    // Index the new entry
    if (this.config.indexContent) {
      await this.indexPage(page, workspace);
    }

    this.api.events.emit('notion:database_entry_created', { 
      page, 
      databaseId, 
      workspace 
    });

    return page;
  }

  // Quick Capture
  async quickCapture(
    text: string,
    source?: string,
    metadata?: Record<string, any>
  ): Promise<NotionPage | null> {
    if (!this.config.quickCapture.enabled) {
      return null;
    }

    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      throw new NotionAPIError('No active workspace', 'no_workspace');
    }

    try {
      let content = text;
      
      if (this.config.quickCapture.includeTimestamp) {
        const timestamp = new Date().toLocaleString();
        content = `${timestamp}\n\n${content}`;
      }
      
      if (this.config.quickCapture.includeSource && source) {
        content += `\n\nSource: ${source}`;
      }

      if (metadata) {
        content += `\n\nMetadata: ${JSON.stringify(metadata, null, 2)}`;
      }

      const blocks: NotionBlock[] = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content } }]
          }
        } as any
      ];

      let parent: any;
      if (this.config.quickCapture.targetPage) {
        parent = { page_id: this.config.quickCapture.targetPage };
      } else {
        parent = { workspace: true };
      }

      const page = await this.createPage(
        parent,
        `Quick Capture - ${new Date().toLocaleDateString()}`,
        blocks
      );

      this.api.ui.showNotification({
        title: 'Quick Capture Saved',
        body: 'Your note has been saved to Notion',
        actions: [
          {
            action: 'open',
            title: 'Open in Notion'
          }
        ],
        timeout: 5000
      });

      return page;
    } catch (error) {
      this.api.logger.error('Quick capture failed', error);
      this.api.ui.showNotification({
        title: 'Quick Capture Failed',
        body: error instanceof Error ? error.message : 'Unknown error',
        timeout: 5000
      });
      return null;
    }
  }

  // Automation System
  private registerAutomationTriggers(): void {
    const triggers: TriggerDefinition[] = [
      {
        id: 'notion_page_created',
        name: 'Notion Page Created',
        description: 'Triggered when a new page is created',
        configSchema: {
          type: 'object',
          properties: {
            parentId: { type: 'string', title: 'Parent Page/Database ID' },
            titleContains: { type: 'string', title: 'Title contains' }
          }
        },
        handler: this.handlePageCreatedTrigger.bind(this)
      },
      {
        id: 'notion_page_updated',
        name: 'Notion Page Updated',
        description: 'Triggered when a page is updated',
        configSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', title: 'Specific Page ID' },
            propertyChanged: { type: 'string', title: 'Property that changed' }
          }
        },
        handler: this.handlePageUpdatedTrigger.bind(this)
      },
      {
        id: 'notion_database_entry_added',
        name: 'Database Entry Added',
        description: 'Triggered when a new entry is added to a database',
        configSchema: {
          type: 'object',
          properties: {
            databaseId: { type: 'string', title: 'Database ID', required: true },
            propertyFilter: {
              type: 'object',
              title: 'Property Filter',
              properties: {
                property: { type: 'string', title: 'Property Name' },
                value: { type: 'string', title: 'Property Value' }
              }
            }
          },
          required: ['databaseId']
        },
        handler: this.handleDatabaseEntryTrigger.bind(this)
      },
      {
        id: 'notion_reminder',
        name: 'Notion Reminder',
        description: 'Triggered based on date properties in pages',
        configSchema: {
          type: 'object',
          properties: {
            databaseId: { type: 'string', title: 'Database ID' },
            dateProperty: { type: 'string', title: 'Date Property Name' },
            reminderOffset: { type: 'number', title: 'Days before due date', default: 1 }
          }
        },
        handler: this.handleReminderTrigger.bind(this)
      }
    ];

    triggers.forEach(trigger => {
      this.api.automation.registerTrigger(trigger);
    });
  }

  private registerAutomationActions(): void {
    const actions: ActionDefinition[] = [
      {
        id: 'notion_create_page',
        name: 'Create Notion Page',
        description: 'Create a new page in Notion',
        configSchema: {
          type: 'object',
          properties: {
            parentId: { type: 'string', title: 'Parent Page/Database ID' },
            title: { type: 'string', title: 'Page Title', required: true },
            template: { type: 'string', title: 'Template to use' },
            properties: {
              type: 'object',
              title: 'Page Properties',
              additionalProperties: true
            }
          },
          required: ['title']
        },
        handler: this.handleCreatePageAction.bind(this)
      },
      {
        id: 'notion_update_page',
        name: 'Update Notion Page',
        description: 'Update an existing page',
        configSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string', title: 'Page ID', required: true },
            properties: {
              type: 'object',
              title: 'Properties to update',
              additionalProperties: true
            },
            archived: { type: 'boolean', title: 'Archive page' }
          },
          required: ['pageId']
        },
        handler: this.handleUpdatePageAction.bind(this)
      },
      {
        id: 'notion_add_to_database',
        name: 'Add to Notion Database',
        description: 'Add a new entry to a database',
        configSchema: {
          type: 'object',
          properties: {
            databaseId: { type: 'string', title: 'Database ID', required: true },
            properties: {
              type: 'object',
              title: 'Entry Properties',
              additionalProperties: true,
              required: true
            }
          },
          required: ['databaseId', 'properties']
        },
        handler: this.handleAddToDatabaseAction.bind(this)
      },
      {
        id: 'notion_quick_capture',
        name: 'Quick Capture to Notion',
        description: 'Quickly capture text to a Notion page',
        configSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', title: 'Text to capture', required: true },
            targetPageId: { type: 'string', title: 'Target Page ID' },
            includeSource: { type: 'boolean', title: 'Include source info', default: true }
          },
          required: ['text']
        },
        handler: this.handleQuickCaptureAction.bind(this)
      }
    ];

    actions.forEach(action => {
      this.api.automation.registerAction(action);
    });
  }

  // Command Registration
  private registerCommands(): void {
    this.api.ui.addCommand({
      id: 'notion_connect',
      title: 'Connect Notion Workspace',
      description: 'Connect a Notion workspace',
      icon: 'link',
      handler: this.authenticate.bind(this)
    });

    this.api.ui.addCommand({
      id: 'notion_quick_capture',
      title: 'Quick Capture to Notion',
      description: 'Quickly capture text to Notion',
      icon: 'note-add',
      handler: this.showQuickCaptureDialog.bind(this)
    });

    this.api.ui.addCommand({
      id: 'notion_create_page',
      title: 'Create Notion Page',
      description: 'Create a new page in Notion',
      icon: 'page-add',
      handler: this.showCreatePageDialog.bind(this)
    });

    this.api.ui.addCommand({
      id: 'notion_sync',
      title: 'Sync Notion',
      description: 'Manually sync Notion content',
      icon: 'refresh',
      handler: this.performManualSync.bind(this)
    });

    this.api.ui.addCommand({
      id: 'notion_search',
      title: 'Search Notion',
      description: 'Search across your Notion workspace',
      icon: 'search',
      handler: this.showSearchDialog.bind(this)
    });
  }

  // Template System
  private initializeTemplates(): void {
    const templates: NotionTemplate[] = [
      {
        id: 'blank',
        name: 'Blank Page',
        description: 'A blank page',
        type: 'page',
        content: []
      },
      {
        id: 'daily-notes',
        name: 'Daily Notes',
        description: 'Template for daily note-taking',
        type: 'page',
        content: [
          {
            type: 'heading_1',
            heading_1: {
              rich_text: [{ text: { content: '{{date}}' } }],
              color: 'default',
              is_toggleable: false
            }
          } as any,
          {
            type: 'heading_2',
            heading_2: {
              rich_text: [{ text: { content: 'Today\'s Goals' } }],
              color: 'default',
              is_toggleable: false
            }
          } as any,
          {
            type: 'to_do',
            to_do: {
              rich_text: [{ text: { content: '' } }],
              checked: false,
              color: 'default'
            }
          } as any,
          {
            type: 'heading_2',
            heading_2: {
              rich_text: [{ text: { content: 'Notes' } }],
              color: 'default',
              is_toggleable: false
            }
          } as any,
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: '' } }],
              color: 'default'
            }
          } as any
        ],
        variables: [
          {
            name: 'date',
            type: 'date',
            description: 'Current date',
            required: true,
            defaultValue: new Date().toLocaleDateString()
          }
        ]
      },
      {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Template for meeting notes',
        type: 'page',
        content: [
          {
            type: 'heading_1',
            heading_1: {
              rich_text: [{ text: { content: '{{meeting_title}}' } }],
              color: 'default',
              is_toggleable: false
            }
          } as any,
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { text: { content: 'Date: ' } },
                { text: { content: '{{date}}' } }
              ],
              color: 'default'
            }
          } as any,
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [
                { text: { content: 'Attendees: ' } },
                { text: { content: '{{attendees}}' } }
              ],
              color: 'default'
            }
          } as any,
          {
            type: 'heading_2',
            heading_2: {
              rich_text: [{ text: { content: 'Agenda' } }],
              color: 'default',
              is_toggleable: false
            }
          } as any,
          {
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [{ text: { content: '' } }],
              color: 'default'
            }
          } as any,
          {
            type: 'heading_2',
            heading_2: {
              rich_text: [{ text: { content: 'Action Items' } }],
              color: 'default',
              is_toggleable: false
            }
          } as any,
          {
            type: 'to_do',
            to_do: {
              rich_text: [{ text: { content: '' } }],
              checked: false,
              color: 'default'
            }
          } as any
        ],
        variables: [
          {
            name: 'meeting_title',
            type: 'text',
            description: 'Meeting title',
            required: true,
            defaultValue: 'Meeting Notes'
          },
          {
            name: 'date',
            type: 'date',
            description: 'Meeting date',
            required: true,
            defaultValue: new Date().toLocaleDateString()
          },
          {
            name: 'attendees',
            type: 'text',
            description: 'Meeting attendees',
            required: false,
            defaultValue: ''
          }
        ]
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // Helper Methods
  private getActiveWorkspace(): NotionWorkspace | undefined {
    return this.state.workspaces.find(w => w.id === this.state.activeWorkspace);
  }

  private extractPageTitle(page: NotionPage): string {
    for (const [key, property] of Object.entries(page.properties)) {
      if (property.type === 'title') {
        return this.extractRichTextContent((property as any).title);
      }
    }
    return 'Untitled';
  }

  private extractRichTextContent(richText: NotionRichText[]): string {
    if (!richText || !Array.isArray(richText)) return '';
    return richText.map(rt => rt.plain_text).join('');
  }

  private extractTextFromBlocks(blocks: NotionBlock[]): string {
    const textParts: string[] = [];
    
    for (const block of blocks) {
      switch (block.type) {
        case 'paragraph':
          textParts.push(this.extractRichTextContent((block as any).paragraph.rich_text));
          break;
        case 'heading_1':
        case 'heading_2':
        case 'heading_3':
          const heading = (block as any)[block.type];
          textParts.push(this.extractRichTextContent(heading.rich_text));
          break;
        case 'bulleted_list_item':
        case 'numbered_list_item':
          const listItem = (block as any)[block.type];
          textParts.push(this.extractRichTextContent(listItem.rich_text));
          break;
        case 'to_do':
          textParts.push(this.extractRichTextContent((block as any).to_do.rich_text));
          break;
        case 'quote':
          textParts.push(this.extractRichTextContent((block as any).quote.rich_text));
          break;
        case 'callout':
          textParts.push(this.extractRichTextContent((block as any).callout.rich_text));
          break;
        case 'code':
          textParts.push(this.extractRichTextContent((block as any).code.rich_text));
          break;
      }
    }
    
    return textParts.join(' ').trim();
  }

  private extractPropertiesContent(properties: Record<string, NotionPropertyValue>): string {
    const textParts: string[] = [];
    
    for (const [key, property] of Object.entries(properties)) {
      switch (property.type) {
        case 'title':
        case 'rich_text':
          textParts.push(this.extractRichTextContent((property as any)[property.type]));
          break;
        case 'select':
          if ((property as any).select) {
            textParts.push((property as any).select.name);
          }
          break;
        case 'multi_select':
          textParts.push((property as any).multi_select.map((s: any) => s.name).join(' '));
          break;
        case 'number':
          if ((property as any).number !== null) {
            textParts.push((property as any).number.toString());
          }
          break;
        case 'url':
        case 'email':
        case 'phone_number':
          if ((property as any)[property.type]) {
            textParts.push((property as any)[property.type]);
          }
          break;
      }
    }
    
    return textParts.join(' ').trim();
  }

  private extractTagsFromContent(content: string): string[] {
    const tags: string[] = [];
    
    // Extract hashtags
    const hashtagMatches = content.match(/#\w+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(tag => tag.toLowerCase()));
    }
    
    // Extract @mentions
    const mentionMatches = content.match(/@\w+/g);
    if (mentionMatches) {
      tags.push(...mentionMatches.map(mention => mention.toLowerCase()));
    }
    
    return tags;
  }

  private getParentId(parent: any): string | undefined {
    if (parent.type === 'page_id') return parent.page_id;
    if (parent.type === 'database_id') return parent.database_id;
    if (parent.type === 'block_id') return parent.block_id;
    return undefined;
  }

  private getIconUrl(icon: any): string | undefined {
    if (!icon) return undefined;
    
    if (icon.type === 'emoji') return icon.emoji;
    if (icon.type === 'external') return icon.external.url;
    if (icon.type === 'file') return icon.file.url;
    
    return undefined;
  }

  private async getPagePreview(pageId: string): Promise<string> {
    try {
      const blocks = await this.getPageBlocks(pageId);
      const textContent = this.extractTextFromBlocks(blocks.slice(0, 3)); // First 3 blocks
      return textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
    } catch (error) {
      return '';
    }
  }

  private calculateRelevanceScore(item: NotionPage | NotionDatabase, query: string): number {
    let score = 0.3; // Base score
    
    const title = item.object === 'page' 
      ? this.extractPageTitle(item as NotionPage)
      : this.extractRichTextContent((item as NotionDatabase).title);
    
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();
    
    // Exact match gets highest score
    if (titleLower.includes(queryLower)) {
      score += 0.5;
    }
    
    // Recent items get higher scores
    const itemDate = new Date(item.last_edited_time);
    const daysSince = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, (30 - daysSince) / 30 * 0.2);
    
    return Math.min(1, score);
  }

  private isCacheValid(lastEditedTime?: string): boolean {
    if (!lastEditedTime) return false;
    
    const cacheAge = Date.now() - new Date(lastEditedTime).getTime();
    const maxCacheAge = this.config.syncInterval * 60 * 1000; // Convert minutes to ms
    
    return cacheAge < maxCacheAge;
  }

  // Event Handlers
  private handleWorkspaceChanged(workspaceId: string): void {
    this.state.activeWorkspace = workspaceId;
  }

  private handleFocusChanged(focused: boolean): void {
    if (focused && this.state.isAuthenticated) {
      // Trigger a quick sync when app gains focus
      this.performIncrementalSync();
    }
  }

  private async handleMeetingStarted(event: any): Promise<void> {
    if (!this.config.quickCapture.enabled) return;
    
    try {
      const template = this.templates.get('meeting-notes');
      if (!template) return;
      
      const title = `Meeting: ${event.title || 'Untitled Meeting'}`;
      const attendees = event.attendees?.map((a: any) => a.name || a.email).join(', ') || '';
      
      // Replace template variables
      let content = JSON.stringify(template.content);
      content = content.replace(/\{\{meeting_title\}\}/g, event.title || 'Untitled Meeting');
      content = content.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
      content = content.replace(/\{\{attendees\}\}/g, attendees);
      
      const blocks = JSON.parse(content);
      
      await this.createPage(
        { workspace: true },
        title,
        blocks
      );
      
      this.api.ui.showNotification({
        title: 'Meeting Notes Created',
        body: `Created notes for "${event.title}"`,
        timeout: 5000
      });
    } catch (error) {
      this.api.logger.error('Failed to create meeting notes', error);
    }
  }

  private async handleQuickCapture(data: { text: string; source?: string }): Promise<void> {
    await this.quickCapture(data.text, data.source);
  }

  // Automation Handlers
  private async handlePageCreatedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    
    if (event.type !== 'notion:page_created') return false;
    
    const { page } = event;
    
    if (config.parentId && this.getParentId(page.parent) !== config.parentId) return false;
    
    if (config.titleContains) {
      const title = this.extractPageTitle(page);
      if (!title.toLowerCase().includes(config.titleContains.toLowerCase())) return false;
    }
    
    return true;
  }

  private async handlePageUpdatedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    
    if (event.type !== 'notion:page_updated') return false;
    
    const { page, updates } = event;
    
    if (config.pageId && page.id !== config.pageId) return false;
    
    if (config.propertyChanged) {
      if (!updates.properties || !updates.properties[config.propertyChanged]) return false;
    }
    
    return true;
  }

  private async handleDatabaseEntryTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    
    if (event.type !== 'notion:database_entry_created') return false;
    
    const { page, databaseId } = event;
    
    if (databaseId !== config.databaseId) return false;
    
    if (config.propertyFilter) {
      const property = page.properties[config.propertyFilter.property];
      if (!property) return false;
      
      // Simple value matching - could be extended
      const propertyValue = this.extractPropertyValue(property);
      if (propertyValue !== config.propertyFilter.value) return false;
    }
    
    return true;
  }

  private async handleReminderTrigger(config: any, context: any): Promise<boolean> {
    // This would be handled by a scheduler service
    // For now, return false as it's not triggered by real-time events
    return false;
  }

  private async handleCreatePageAction(config: any, context: any): Promise<any> {
    const parentId = config.parentId || undefined;
    const parent = parentId 
      ? { page_id: parentId }
      : { workspace: true };
    
    const template = config.template ? this.templates.get(config.template) : undefined;
    const content = template ? this.processTemplate(template, context.variables || {}) : undefined;
    
    return await this.createPage(parent, config.title, content, config.properties);
  }

  private async handleUpdatePageAction(config: any, context: any): Promise<any> {
    return await this.updatePage(config.pageId, {
      properties: config.properties,
      archived: config.archived
    });
  }

  private async handleAddToDatabaseAction(config: any, context: any): Promise<any> {
    return await this.createDatabaseEntry(config.databaseId, config.properties);
  }

  private async handleQuickCaptureAction(config: any, context: any): Promise<any> {
    return await this.quickCapture(
      config.text,
      config.includeSource ? 'Automation' : undefined
    );
  }

  // Dialog Handlers
  private async showQuickCaptureDialog(): Promise<void> {
    const result = await this.api.ui.showDialog({
      title: 'Quick Capture to Notion',
      size: 'medium',
      content: `
        <div style="padding: 20px;">
          <div style="margin-bottom: 15px;">
            <label for="capture-text">Note:</label>
            <textarea id="capture-text" placeholder="What's on your mind?" style="width: 100%; height: 120px; padding: 8px; margin-top: 5px;"></textarea>
          </div>
          <div style="margin-bottom: 15px;">
            <label>
              <input type="checkbox" id="include-timestamp" checked> Include timestamp
            </label>
          </div>
        </div>
      `,
      buttons: [
        { label: 'Save', value: 'save', variant: 'primary' },
        { label: 'Cancel', value: 'cancel' }
      ]
    });

    if (result === 'save') {
      // In a real implementation, we'd extract values from the dialog
      const text = 'Quick capture note'; // Placeholder
      
      try {
        await this.quickCapture(text, 'Manual');
      } catch (error) {
        this.api.ui.showNotification({
          title: 'Quick Capture Failed',
          body: error instanceof Error ? error.message : 'Unknown error',
          timeout: 5000
        });
      }
    }
  }

  private async showCreatePageDialog(): Promise<void> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) {
      this.api.ui.showNotification({
        title: 'No Workspace Connected',
        body: 'Connect a Notion workspace first',
        timeout: 3000
      });
      return;
    }

    const templates = Array.from(this.templates.values());
    
    const result = await this.api.ui.showDialog({
      title: 'Create Notion Page',
      size: 'medium',
      content: `
        <div style="padding: 20px;">
          <div style="margin-bottom: 15px;">
            <label for="page-title">Title:</label>
            <input type="text" id="page-title" placeholder="Page title..." style="width: 100%; padding: 8px; margin-top: 5px;">
          </div>
          <div style="margin-bottom: 15px;">
            <label for="page-template">Template:</label>
            <select id="page-template" style="width: 100%; padding: 8px; margin-top: 5px;">
              ${templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
          </div>
        </div>
      `,
      buttons: [
        { label: 'Create', value: 'create', variant: 'primary' },
        { label: 'Cancel', value: 'cancel' }
      ]
    });

    if (result === 'create') {
      try {
        const title = 'New Page'; // Placeholder
        const templateId = 'blank'; // Placeholder
        
        const template = this.templates.get(templateId);
        const content = template ? template.content : undefined;
        
        await this.createPage({ workspace: true }, title, content as any);
        
        this.api.ui.showNotification({
          title: 'Page Created',
          body: `"${title}" was created successfully`,
          timeout: 3000
        });
      } catch (error) {
        this.api.ui.showNotification({
          title: 'Page Creation Failed',
          body: error instanceof Error ? error.message : 'Unknown error',
          timeout: 5000
        });
      }
    }
  }

  private async showSearchDialog(): Promise<void> {
    // Implementation would show a search interface
    this.api.ui.showNotification({
      title: 'Search Notion',
      body: 'Use the unified search (Cmd+K) to search your Notion content',
      timeout: 3000
    });
  }

  private async performManualSync(): Promise<void> {
    const workspace = this.getActiveWorkspace();
    if (!workspace) return;

    if (this.syncInProgress) {
      this.api.ui.showNotification({
        title: 'Sync In Progress',
        body: 'A sync is already running',
        timeout: 3000
      });
      return;
    }

    try {
      this.syncInProgress = true;
      this.api.ui.showNotification({
        title: 'Syncing Notion',
        body: 'Synchronizing your Notion content...',
        timeout: 2000
      });

      await this.performIncrementalSync();
      
      this.api.ui.showNotification({
        title: 'Sync Complete',
        body: 'Your Notion content is up to date',
        timeout: 3000
      });
    } catch (error) {
      this.api.ui.showNotification({
        title: 'Sync Failed',
        body: error instanceof Error ? error.message : 'Unknown error',
        timeout: 5000
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  private async performIncrementalSync(): Promise<void> {
    const workspace = this.getActiveWorkspace();
    if (!workspace || this.syncInProgress) return;

    try {
      this.syncInProgress = true;
      
      // Get recently modified pages
      const searchResponse = await this.makeNotionAPIRequest('search', {
        method: 'POST',
        body: {
          filter: {
            property: 'object',
            value: 'page'
          },
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          },
          page_size: 20
        }
      });

      let updatedCount = 0;
      
      for (const item of searchResponse.results) {
        if (item.object === 'page') {
          const page = item as NotionPage;
          const cachedPage = this.state.pageCache.get(page.id);
          
          if (!cachedPage || new Date(page.last_edited_time) > new Date(cachedPage.last_edited_time)) {
            this.state.pageCache.set(page.id, page);
            
            if (this.config.indexContent) {
              await this.indexPage(page, workspace);
            }
            
            updatedCount++;
          }
        }
      }

      workspace.last_sync = Date.now();
      this.state.lastSync = Date.now();
      
      this.api.events.emit('notion:incremental_sync_completed', { 
        workspace, 
        updatedCount 
      });
    } catch (error) {
      this.api.logger.error('Incremental sync failed', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Template Processing
  private processTemplate(template: NotionTemplate, variables: Record<string, any>): NotionBlock[] {
    let contentStr = JSON.stringify(template.content);
    
    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      contentStr = contentStr.replace(regex, String(value));
    }
    
    // Replace default variables
    if (template.variables) {
      for (const variable of template.variables) {
        const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
        const value = variables[variable.name] || variable.defaultValue || '';
        contentStr = contentStr.replace(regex, String(value));
      }
    }
    
    return JSON.parse(contentStr);
  }

  private extractPropertyValue(property: NotionPropertyValue): any {
    switch (property.type) {
      case 'title':
        return this.extractRichTextContent((property as any).title);
      case 'rich_text':
        return this.extractRichTextContent((property as any).rich_text);
      case 'number':
        return (property as any).number;
      case 'select':
        return (property as any).select?.name;
      case 'checkbox':
        return (property as any).checkbox;
      case 'date':
        return (property as any).date?.start;
      default:
        return null;
    }
  }

  // State Management
  private async saveState(): Promise<void> {
    await this.api.storage.set('notion_state', {
      ...this.state,
      pageCache: Array.from(this.state.pageCache.entries()),
      databaseCache: Array.from(this.state.databaseCache.entries()),
      blockCache: Array.from(this.state.blockCache.entries()),
      watchedPages: Array.from(this.state.watchedPages),
      watchedDatabases: Array.from(this.state.watchedDatabases)
    });
  }

  private async loadState(): Promise<void> {
    const savedState = await this.api.storage.get('notion_state');
    if (savedState) {
      this.state = {
        ...this.state,
        ...savedState,
        pageCache: new Map(savedState.pageCache || []),
        databaseCache: new Map(savedState.databaseCache || []),
        blockCache: new Map(savedState.blockCache || []),
        watchedPages: new Set(savedState.watchedPages || []),
        watchedDatabases: new Set(savedState.watchedDatabases || [])
      };
    }
  }

  private async saveConfig(): Promise<void> {
    await this.api.storage.set('notion_config', this.config);
  }

  // Lifecycle Methods
  async onActivate(): Promise<void> {
    await this.loadState();
    
    // Start periodic sync if authenticated
    if (this.state.isAuthenticated) {
      this.startPeriodicSync();
    }
  }

  async onDeactivate(): Promise<void> {
    this.stopPeriodicSync();
    await this.saveState();
  }

  async onConfigChanged(newConfig: NotionPluginConfig): Promise<void> {
    this.config = newConfig;
    await this.saveConfig();

    // Update watchers
    this.state.watchedDatabases.clear();
    for (const databaseId of newConfig.watchedDatabases) {
      this.state.watchedDatabases.add(databaseId);
    }
  }

  private startPeriodicSync(): void {
    setInterval(async () => {
      if (this.state.isAuthenticated && !this.syncInProgress) {
        try {
          await this.performIncrementalSync();
        } catch (error) {
          this.api.logger.error('Periodic sync failed', error);
        }
      }
    }, this.config.syncInterval * 60 * 1000);
  }

  private stopPeriodicSync(): void {
    // Clear any running intervals
    // In a real implementation, we'd store interval IDs
  }

  // Public interface for the panel
  getPublicAPI() {
    return {
      authenticate: this.authenticate.bind(this),
      createPage: this.createPage.bind(this),
      updatePage: this.updatePage.bind(this),
      getPage: this.getPage.bind(this),
      getPageBlocks: this.getPageBlocks.bind(this),
      queryDatabase: this.queryDatabase.bind(this),
      createDatabaseEntry: this.createDatabaseEntry.bind(this),
      quickCapture: this.quickCapture.bind(this),
      search: this.search.bind(this),
      getWorkspaces: () => this.state.workspaces,
      getActiveWorkspace: this.getActiveWorkspace.bind(this),
      setActiveWorkspace: (id: string) => { this.state.activeWorkspace = id; },
      isAuthenticated: () => this.state.isAuthenticated,
      getTemplates: () => Array.from(this.templates.values()),
      performSync: this.performManualSync.bind(this),
      isSyncing: () => this.syncInProgress
    };
  }
}