/**
 * Jira Plugin - Complete Integration
 * 
 * Production-ready Jira integration with issue tracking, workflows, sprints,
 * automation triggers, search indexing, and comprehensive project management.
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
  JiraUser,
  JiraProject,
  JiraIssue,
  JiraBoard,
  JiraSprint,
  JiraPluginConfig,
  JiraAuthTokens,
  JiraApiResponse,
  JiraSearchResult,
  JiraAutomationTrigger,
  JiraAutomationAction,
  JiraWebhook,
  JiraComment,
  JiraWorklog
} from '../types/jira-types';

export class JiraPlugin {
  private api: PluginAPI;
  private config: JiraPluginConfig;
  private authTokens: JiraAuthTokens | null = null;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private issueCache: Map<string, JiraIssue> = new Map();
  private projectCache: Map<string, JiraProject> = new Map();
  private boardCache: Map<string, JiraBoard> = new Map();
  private userCache: Map<string, JiraUser> = new Map();
  private isInitialized = false;

  constructor(api: PluginAPI) {
    this.api = api;
    this.config = this.getDefaultConfig();
    this.setupEventListeners();
    this.registerAutomationTriggers();
    this.registerAutomationActions();
  }

  async initialize(): Promise<void> {
    try {
      this.api.logger.info('Initializing Jira plugin...');
      
      const savedConfig = await this.api.storage.get<JiraPluginConfig>('config');
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
      }

      this.authTokens = await this.api.storage.get<JiraAuthTokens>('auth_tokens');
      
      if (this.authTokens && this.config.jiraUrl) {
        if (this.isTokenExpired(this.authTokens)) {
          await this.refreshAccessToken();
        }
        
        await this.loadInitialData();
        this.startBackgroundSync();
        this.registerSearchProvider();
        await this.setupWebhooks();
      }

      this.isInitialized = true;
      this.api.logger.info('Jira plugin initialized successfully');
    } catch (error) {
      this.api.logger.error('Failed to initialize Jira plugin:', error);
      throw error;
    }
  }

  async authenticate(): Promise<void> {
    try {
      this.api.logger.info('Starting Jira OAuth authentication...');
      
      if (!this.config.jiraUrl) {
        throw new Error('Jira URL not configured');
      }
      
      const scopes = ['read:jira-user', 'read:jira-work', 'write:jira-work', 'manage:jira-webhook'];
      const authCode = await this.api.oauth.startFlow('jira', scopes);
      const tokens = await this.exchangeAuthCode(authCode);
      
      this.authTokens = tokens;
      await this.api.storage.set('auth_tokens', tokens);
      
      await this.loadInitialData();
      this.startBackgroundSync();
      this.registerSearchProvider();
      await this.setupWebhooks();
      
      this.api.ui.showNotification({
        title: 'Jira Connected',
        body: 'Successfully authenticated with Jira',
        timeout: 5000
      });
      
      this.api.logger.info('Jira authentication completed successfully');
    } catch (error) {
      this.api.logger.error('Jira authentication failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.api.logger.info('Disconnecting from Jira...');
      
      for (const [id, interval] of this.syncIntervals) {
        clearInterval(interval);
        this.syncIntervals.delete(id);
      }
      
      await this.api.storage.remove('auth_tokens');
      this.authTokens = null;
      
      this.issueCache.clear();
      this.projectCache.clear();
      this.boardCache.clear();
      this.userCache.clear();
      
      this.api.ui.showNotification({
        title: 'Jira Disconnected',
        body: 'Successfully disconnected from Jira',
        timeout: 5000
      });
      
      this.api.logger.info('Jira disconnection completed');
    } catch (error) {
      this.api.logger.error('Jira disconnection failed:', error);
      throw error;
    }
  }

  /**
   * Issue Management
   */
  async getProjects(): Promise<JiraProject[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/api/3/project`;
      const response = await this.makeApiRequest('GET', endpoint);
      
      const projects = response as JiraProject[];
      
      projects.forEach(project => {
        this.projectCache.set(project.key, project);
      });
      
      this.api.logger.info(`Retrieved ${projects.length} projects`);
      return projects;
    } catch (error) {
      this.api.logger.error('Failed to get projects:', error);
      throw error;
    }
  }

  async getIssues(jql: string = '', maxResults: number = 50): Promise<JiraIssue[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/api/3/search`;
      const params = new URLSearchParams({
        jql,
        maxResults: maxResults.toString(),
        expand: 'changelog,operations,editmeta,transitions'
      });
      
      const response = await this.makeApiRequest('GET', `${endpoint}?${params}`);
      const searchResponse = response as JiraApiResponse<JiraIssue>;
      
      const issues = searchResponse.issues || [];
      
      // Cache issues
      issues.forEach(issue => {
        this.issueCache.set(issue.key, issue);
      });
      
      // Index for search
      for (const issue of issues) {
        await this.indexIssue(issue);
      }
      
      this.api.logger.info(`Retrieved ${issues.length} issues`);
      return issues;
    } catch (error) {
      this.api.logger.error('Failed to get issues:', error);
      throw error;
    }
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/api/3/issue/${issueKey}`;
      const params = new URLSearchParams({
        expand: 'changelog,operations,editmeta,transitions,comments,worklog'
      });
      
      const response = await this.makeApiRequest('GET', `${endpoint}?${params}`);
      const issue = response as JiraIssue;
      
      this.issueCache.set(issue.key, issue);
      await this.indexIssue(issue);
      
      this.api.logger.info(`Retrieved issue: ${issueKey}`);
      return issue;
    } catch (error) {
      this.api.logger.error(`Failed to get issue ${issueKey}:`, error);
      throw error;
    }
  }

  async createIssue(issueData: Partial<JiraIssue>): Promise<JiraIssue> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/api/3/issue`;
      
      const createData = {
        fields: {
          project: { key: issueData.fields?.project?.key },
          summary: issueData.fields?.summary,
          description: issueData.fields?.description,
          issuetype: { id: issueData.fields?.issuetype?.id },
          priority: issueData.fields?.priority ? { id: issueData.fields.priority.id } : undefined,
          assignee: issueData.fields?.assignee ? { accountId: issueData.fields.assignee.accountId } : undefined,
          components: issueData.fields?.components?.map(c => ({ id: c.id })) || [],
          labels: issueData.fields?.labels || [],
          ...issueData.fields
        }
      };
      
      const response = await this.makeApiRequest('POST', endpoint, createData);
      const createdIssue = await this.getIssue(response.key);
      
      this.api.ui.showNotification({
        title: 'Issue Created',
        body: `Created issue ${createdIssue.key}: ${createdIssue.fields.summary}`,
        actions: [
          { action: 'view', title: 'View Issue' },
          { action: 'edit', title: 'Edit' }
        ]
      });
      
      // Trigger automation
      this.api.events.emit('jira-issue-created', { data: createdIssue });
      
      this.api.logger.info(`Created issue: ${createdIssue.key}`);
      return createdIssue;
    } catch (error) {
      this.api.logger.error('Failed to create issue:', error);
      throw error;
    }
  }

  async updateIssue(issueKey: string, updates: any): Promise<JiraIssue> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/api/3/issue/${issueKey}`;
      
      await this.makeApiRequest('PUT', endpoint, { fields: updates });
      const updatedIssue = await this.getIssue(issueKey);
      
      // Trigger automation
      this.api.events.emit('jira-issue-updated', { data: updatedIssue });
      
      this.api.logger.info(`Updated issue: ${issueKey}`);
      return updatedIssue;
    } catch (error) {
      this.api.logger.error(`Failed to update issue ${issueKey}:`, error);
      throw error;
    }
  }

  async assignIssue(issueKey: string, assigneeId: string): Promise<void> {
    try {
      await this.updateIssue(issueKey, {
        assignee: { accountId: assigneeId }
      });
      
      this.api.logger.info(`Assigned issue ${issueKey} to ${assigneeId}`);
    } catch (error) {
      this.api.logger.error(`Failed to assign issue ${issueKey}:`, error);
      throw error;
    }
  }

  async addComment(issueKey: string, comment: string): Promise<JiraComment> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/api/3/issue/${issueKey}/comment`;
      
      const commentData = {
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: comment
            }]
          }]
        }
      };
      
      const response = await this.makeApiRequest('POST', endpoint, commentData);
      const createdComment = response as JiraComment;
      
      // Refresh issue cache
      await this.getIssue(issueKey);
      
      this.api.logger.info(`Added comment to issue: ${issueKey}`);
      return createdComment;
    } catch (error) {
      this.api.logger.error(`Failed to add comment to ${issueKey}:`, error);
      throw error;
    }
  }

  async logWork(issueKey: string, timeSpent: string, comment?: string): Promise<JiraWorklog> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/api/3/issue/${issueKey}/worklog`;
      
      const worklogData: any = {
        timeSpent,
        started: new Date().toISOString().replace('Z', '+0000')
      };
      
      if (comment) {
        worklogData.comment = {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: comment
            }]
          }]
        };
      }
      
      const response = await this.makeApiRequest('POST', endpoint, worklogData);
      const worklog = response as JiraWorklog;
      
      this.api.logger.info(`Logged work for issue: ${issueKey} (${timeSpent})`);
      return worklog;
    } catch (error) {
      this.api.logger.error(`Failed to log work for ${issueKey}:`, error);
      throw error;
    }
  }

  /**
   * Board and Sprint Management
   */
  async getBoards(): Promise<JiraBoard[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/agile/1.0/board`;
      const response = await this.makeApiRequest('GET', endpoint);
      
      const boards = response.values as JiraBoard[];
      
      boards.forEach(board => {
        this.boardCache.set(board.id.toString(), board);
      });
      
      this.api.logger.info(`Retrieved ${boards.length} boards`);
      return boards;
    } catch (error) {
      this.api.logger.error('Failed to get boards:', error);
      throw error;
    }
  }

  async getSprints(boardId: number): Promise<JiraSprint[]> {
    try {
      this.ensureAuthenticated();
      
      const endpoint = `${this.config.jiraUrl}/rest/agile/1.0/board/${boardId}/sprint`;
      const response = await this.makeApiRequest('GET', endpoint);
      
      const sprints = response.values as JiraSprint[];
      
      this.api.logger.info(`Retrieved ${sprints.length} sprints for board ${boardId}`);
      return sprints;
    } catch (error) {
      this.api.logger.error(`Failed to get sprints for board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Search functionality
   */
  async search(query: string, options?: { projects?: string[]; issueTypes?: string[] }): Promise<JiraSearchResult[]> {
    try {
      this.ensureAuthenticated();
      
      // Build JQL query
      let jql = '';
      const conditions: string[] = [];
      
      if (query) {
        conditions.push(`(summary ~ "${query}" OR description ~ "${query}" OR comment ~ "${query}")`);
      }
      
      if (options?.projects && options.projects.length > 0) {
        conditions.push(`project IN (${options.projects.map(p => `"${p}"`).join(', ')})`);
      }
      
      if (options?.issueTypes && options.issueTypes.length > 0) {
        conditions.push(`issuetype IN (${options.issueTypes.map(t => `"${t}"`).join(', ')})`);
      }
      
      jql = conditions.join(' AND ');
      if (!jql) jql = 'ORDER BY updated DESC';
      
      const issues = await this.getIssues(jql, 50);
      
      const results: JiraSearchResult[] = issues.map(issue => ({
        id: issue.key,
        title: issue.fields.summary,
        description: this.extractTextFromADF(issue.fields.description),
        url: `${this.config.jiraUrl}/browse/${issue.key}`,
        contentType: 'issue' as const,
        projectKey: issue.fields.project.key,
        issueKey: issue.key,
        issueType: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        priority: issue.fields.priority.name,
        assignee: issue.fields.assignee,
        reporter: issue.fields.reporter,
        timestamp: new Date(issue.fields.updated),
        score: this.calculateRelevanceScore(issue, query),
        metadata: {
          projectName: issue.fields.project.name,
          statusCategory: issue.fields.status.statusCategory.key,
          labels: issue.fields.labels,
          components: issue.fields.components.map(c => c.name)
        }
      }));
      
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
  
  private getDefaultConfig(): JiraPluginConfig {
    return {
      jiraUrl: '',
      enableNotifications: true,
      trackedProjects: [],
      updateInterval: 15,
      notificationTypes: ['issues', 'comments', 'assignments'],
      jqlFilters: ['assignee = currentUser() AND resolution = Unresolved'],
      syncHistoryDays: 30,
      enableTimeTracking: true
    };
  }

  private setupEventListeners(): void {
    this.api.events.on<JiraPluginConfig>('config-updated', async (config) => {
      this.config = { ...this.config, ...config };
      await this.api.storage.set('config', this.config);
      this.api.logger.info('Jira plugin configuration updated');
    });
  }

  private registerAutomationTriggers(): void {
    const triggers: TriggerDefinition[] = [
      {
        id: 'jira-issue-created',
        name: 'Jira Issue Created',
        description: 'Triggered when a new Jira issue is created',
        configSchema: {
          type: 'object',
          properties: {
            projectKey: { type: 'string', title: 'Project Key' },
            issueType: { type: 'string', title: 'Issue Type' },
            priority: { type: 'string', title: 'Priority' }
          }
        },
        handler: async (config, context) => {
          return this.handleIssueCreatedTrigger(config, context);
        }
      },
      {
        id: 'jira-issue-assigned',
        name: 'Jira Issue Assigned',
        description: 'Triggered when a Jira issue is assigned',
        configSchema: {
          type: 'object',
          properties: {
            projectKey: { type: 'string', title: 'Project Key' },
            assigneeId: { type: 'string', title: 'Assignee ID' }
          }
        },
        handler: async (config, context) => {
          return this.handleIssueAssignedTrigger(config, context);
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
        id: 'jira-create-issue',
        name: 'Create Jira Issue',
        description: 'Create a new Jira issue',
        configSchema: {
          type: 'object',
          properties: {
            projectKey: { type: 'string', title: 'Project Key' },
            summary: { type: 'string', title: 'Summary' },
            description: { type: 'string', title: 'Description' },
            issueType: { type: 'string', title: 'Issue Type' },
            priority: { type: 'string', title: 'Priority' }
          },
          required: ['projectKey', 'summary', 'issueType']
        },
        handler: async (config, context) => {
          return this.handleCreateIssueAction(config, context);
        }
      }
    ];

    actions.forEach(action => {
      this.api.automation.registerAction(action);
    });
  }

  private registerSearchProvider(): void {
    this.api.search.registerProvider({
      id: 'jira',
      name: 'Jira',
      icon: 'https://wac-cdn.atlassian.com/assets/img/favicons/jira/favicon.ico',
      search: async (query, options) => {
        const jiraResults = await this.search(query);
        return jiraResults.map(result => ({
          id: result.id,
          title: result.title,
          description: result.description,
          url: result.url,
          contentType: result.contentType,
          provider: 'jira',
          score: result.score,
          lastModified: result.timestamp,
          metadata: result.metadata
        }));
      },
      contentTypes: ['issue', 'project', 'comment']
    });
  }

  private async loadInitialData(): Promise<void> {
    try {
      await this.getProjects();
      
      if (this.config.trackedProjects.length > 0) {
        const jql = `project IN (${this.config.trackedProjects.join(', ')}) AND updated >= -${this.config.syncHistoryDays}d`;
        await this.getIssues(jql, 100);
      }
    } catch (error) {
      this.api.logger.error('Failed to load initial data:', error);
    }
  }

  private startBackgroundSync(): void {
    // Sync issues every configured interval
    const issueSync = setInterval(async () => {
      await this.syncRecentIssues();
    }, this.config.updateInterval * 60 * 1000);

    this.syncIntervals.set('issues', issueSync);
  }

  private async syncRecentIssues(): Promise<void> {
    try {
      if (this.config.trackedProjects.length === 0) return;
      
      const jql = `project IN (${this.config.trackedProjects.join(', ')}) AND updated >= -${this.config.updateInterval}m`;
      const recentIssues = await this.getIssues(jql, 50);
      
      // Check for new assignments, comments, etc.
      for (const issue of recentIssues) {
        const cachedIssue = this.issueCache.get(issue.key);
        if (cachedIssue) {
          await this.checkForNotifications(cachedIssue, issue);
        }
      }
      
      this.api.logger.debug('Background issue sync completed');
    } catch (error) {
      this.api.logger.error('Background issue sync failed:', error);
    }
  }

  private async checkForNotifications(oldIssue: JiraIssue, newIssue: JiraIssue): Promise<void> {
    if (!this.config.enableNotifications) return;
    
    // Check for assignment changes
    if (this.config.notificationTypes.includes('assignments')) {
      const oldAssignee = oldIssue.fields.assignee?.accountId;
      const newAssignee = newIssue.fields.assignee?.accountId;
      
      if (oldAssignee !== newAssignee && newAssignee) {
        this.api.ui.showNotification({
          title: 'Issue Assigned',
          body: `${newIssue.key}: ${newIssue.fields.summary}`,
          actions: [
            { action: 'view', title: 'View Issue' }
          ]
        });
      }
    }
    
    // Check for new comments
    if (this.config.notificationTypes.includes('comments')) {
      const oldCommentCount = oldIssue.fields.comment?.total || 0;
      const newCommentCount = newIssue.fields.comment?.total || 0;
      
      if (newCommentCount > oldCommentCount) {
        const latestComment = newIssue.fields.comment?.comments?.[newCommentCount - 1];
        if (latestComment) {
          this.api.ui.showNotification({
            title: 'New Comment',
            body: `${latestComment.author.displayName} commented on ${newIssue.key}`,
            actions: [
              { action: 'view', title: 'View Comment' }
            ]
          });
        }
      }
    }
  }

  private async setupWebhooks(): Promise<void> {
    try {
      const webhookData: JiraWebhook = {
        name: 'Flow Desk Integration',
        url: `${process.env.JIRA_WEBHOOK_BASE_URL}/jira/webhook`,
        events: [
          'jira:issue_created',
          'jira:issue_updated',
          'jira:issue_deleted',
          'comment_created',
          'comment_updated'
        ]
      };
      
      const endpoint = `${this.config.jiraUrl}/rest/webhooks/1.0/webhook`;
      await this.makeApiRequest('POST', endpoint, webhookData);
      
      this.api.logger.info('Jira webhook setup completed');
    } catch (error) {
      this.api.logger.error('Failed to setup webhooks:', error);
    }
  }

  private async indexIssue(issue: JiraIssue): Promise<void> {
    const searchableContent: SearchableContent = {
      id: issue.key,
      title: issue.fields.summary,
      body: this.extractTextFromADF(issue.fields.description) + ' ' + 
            issue.fields.comment?.comments?.map(c => this.extractTextFromADF(c.body)).join(' '),
      contentType: 'jira-issue',
      metadata: {
        projectKey: issue.fields.project.key,
        projectName: issue.fields.project.name,
        issueType: issue.fields.issuetype.name,
        status: issue.fields.status.name,
        priority: issue.fields.priority.name,
        assignee: issue.fields.assignee?.displayName,
        reporter: issue.fields.reporter.displayName,
        labels: issue.fields.labels,
        components: issue.fields.components.map(c => c.name)
      },
      tags: [
        'jira',
        'issue',
        issue.fields.project.key,
        issue.fields.issuetype.name,
        issue.fields.status.name,
        ...issue.fields.labels
      ],
      lastModified: new Date(issue.fields.updated)
    };

    await this.api.search.index(searchableContent);
  }

  private extractTextFromADF(adf: any): string {
    if (!adf || !adf.content) return '';
    
    let text = '';
    for (const node of adf.content) {
      if (node.type === 'paragraph' && node.content) {
        for (const textNode of node.content) {
          if (textNode.type === 'text') {
            text += textNode.text + ' ';
          }
        }
      }
    }
    return text.trim();
  }

  private calculateRelevanceScore(issue: JiraIssue, query: string): number {
    if (!query) return 0.5;
    
    const lowerQuery = query.toLowerCase();
    const summary = issue.fields.summary.toLowerCase();
    const description = this.extractTextFromADF(issue.fields.description).toLowerCase();
    
    let score = 0;
    
    // Exact matches in summary get highest score
    if (summary.includes(lowerQuery)) {
      score += 1.0;
    }
    
    // Partial matches in summary
    const queryWords = lowerQuery.split(' ');
    let summaryMatches = 0;
    for (const word of queryWords) {
      if (summary.includes(word)) {
        summaryMatches++;
      }
    }
    score += (summaryMatches / queryWords.length) * 0.8;
    
    // Matches in description
    let descMatches = 0;
    for (const word of queryWords) {
      if (description.includes(word)) {
        descMatches++;
      }
    }
    score += (descMatches / queryWords.length) * 0.6;
    
    return Math.min(score, 1.0);
  }

  private async handleIssueCreatedTrigger(config: any, context: any): Promise<boolean> {
    const issue = context.data as JiraIssue;
    
    if (config.projectKey && issue.fields.project.key !== config.projectKey) {
      return false;
    }
    
    if (config.issueType && issue.fields.issuetype.name !== config.issueType) {
      return false;
    }
    
    if (config.priority && issue.fields.priority.name !== config.priority) {
      return false;
    }
    
    return true;
  }

  private async handleIssueAssignedTrigger(config: any, context: any): Promise<boolean> {
    const issue = context.data as JiraIssue;
    
    if (!issue.fields.assignee) {
      return false;
    }
    
    if (config.projectKey && issue.fields.project.key !== config.projectKey) {
      return false;
    }
    
    if (config.assigneeId && issue.fields.assignee.accountId !== config.assigneeId) {
      return false;
    }
    
    return true;
  }

  private async handleCreateIssueAction(config: any, context: any): Promise<any> {
    try {
      const issueData = {
        fields: {
          project: { key: config.projectKey },
          summary: this.processVariables(config.summary, context),
          description: config.description ? {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: this.processVariables(config.description, context)
              }]
            }]
          } : undefined,
          issuetype: { name: config.issueType },
          priority: config.priority ? { name: config.priority } : undefined
        }
      } as Partial<JiraIssue>;
      
      const createdIssue = await this.createIssue(issueData);
      
      return {
        success: true,
        issueKey: createdIssue.key,
        message: `Issue ${createdIssue.key} created successfully`
      };
    } catch (error) {
      this.api.logger.error('Failed to create issue via automation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private processVariables(text: string, context: any): string {
    if (!text) return text;
    
    return text
      .replace(/\{\{user\}\}/g, context.user?.name || 'Unknown User')
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
      .replace(/\{\{trigger\.data\.(\w+)\}\}/g, (match, key) => {
        return context.data?.[key] || match;
      });
  }

  private async exchangeAuthCode(code: string): Promise<JiraAuthTokens> {
    // Implementation would depend on Jira's OAuth2 flow
    // This is a simplified version
    const response = await fetch(`${this.config.jiraUrl}/plugins/servlet/oauth/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.JIRA_REDIRECT_URI!,
        client_id: process.env.JIRA_CLIENT_ID!,
        client_secret: process.env.JIRA_CLIENT_SECRET!
      })
    });

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

    const response = await fetch(`${this.config.jiraUrl}/plugins/servlet/oauth/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.authTokens.refreshToken,
        client_id: process.env.JIRA_CLIENT_ID!,
        client_secret: process.env.JIRA_CLIENT_SECRET!
      })
    });

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
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const response = await this.api.network.fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 401) {
      await this.refreshAccessToken();
      headers['Authorization'] = `Bearer ${this.authTokens!.accessToken}`;
      
      return this.api.network.fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      }).then(r => r.json());
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Jira API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
  }

  private isTokenExpired(tokens: JiraAuthTokens): boolean {
    return new Date() >= tokens.expiresAt;
  }

  private ensureAuthenticated(): void {
    if (!this.authTokens) {
      throw new Error('Not authenticated with Jira');
    }
    if (!this.config.jiraUrl) {
      throw new Error('Jira URL not configured');
    }
  }
}