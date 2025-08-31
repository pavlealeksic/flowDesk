/**
 * Slack Plugin Automation Engine
 * Handles automation triggers, actions, and workflows
 */

class SlackAutomationEngine {
  constructor() {
    this.api = null;
    this.triggers = new Map();
    this.actions = new Map();
    this.activeAutomations = new Map();
    this.executionQueue = [];
    this.isProcessingQueue = false;
  }

  async initialize(api, context) {
    this.api = api;
    this.context = context;
    
    // Register built-in triggers and actions
    await this.registerBuiltInTriggers();
    await this.registerBuiltInActions();
    
    // Start processing automation queue
    this.startQueueProcessor();
    
    // Listen for Slack events
    this.setupEventListeners();
    
    console.log('Slack automation engine initialized');
    return true;
  }

  async registerBuiltInTriggers() {
    // New message trigger
    this.triggers.set('new_message', {
      id: 'new_message',
      name: 'New Message',
      description: 'Triggers when a new message is received',
      configSchema: {
        type: 'object',
        properties: {
          workspace: {
            type: 'string',
            title: 'Workspace',
            description: 'Workspace ID (leave empty for all workspaces)'
          },
          channel: {
            type: 'string',
            title: 'Channel',
            description: 'Channel ID (leave empty for all channels)'
          },
          user: {
            type: 'string',
            title: 'User',
            description: 'User ID (leave empty for all users)'
          },
          keyword: {
            type: 'string',
            title: 'Contains Keyword',
            description: 'Message must contain this keyword'
          },
          channelType: {
            type: 'string',
            title: 'Channel Type',
            enum: ['any', 'public', 'private', 'dm', 'group'],
            default: 'any'
          },
          excludeBot: {
            type: 'boolean',
            title: 'Exclude Bot Messages',
            default: true
          }
        }
      },
      handler: this.handleNewMessageTrigger.bind(this)
    });

    // Mention trigger
    this.triggers.set('mention', {
      id: 'mention',
      name: 'Mentioned',
      description: 'Triggers when you are mentioned',
      configSchema: {
        type: 'object',
        properties: {
          workspace: {
            type: 'string',
            title: 'Workspace',
            description: 'Workspace ID (leave empty for all workspaces)'
          },
          includeChannelMentions: {
            type: 'boolean',
            title: 'Include @channel/@here',
            description: 'Also trigger on @channel and @here mentions',
            default: true
          }
        }
      },
      handler: this.handleMentionTrigger.bind(this)
    });

    // Reaction added trigger
    this.triggers.set('reaction_added', {
      id: 'reaction_added',
      name: 'Reaction Added',
      description: 'Triggers when a reaction is added to a message',
      configSchema: {
        type: 'object',
        properties: {
          emoji: {
            type: 'string',
            title: 'Emoji',
            description: 'Specific emoji name (leave empty for any)'
          },
          onMyMessages: {
            type: 'boolean',
            title: 'Only My Messages',
            description: 'Only trigger when reactions are added to your messages',
            default: false
          }
        }
      },
      handler: this.handleReactionTrigger.bind(this)
    });

    // File shared trigger
    this.triggers.set('file_shared', {
      id: 'file_shared',
      name: 'File Shared',
      description: 'Triggers when a file is shared',
      configSchema: {
        type: 'object',
        properties: {
          fileType: {
            type: 'string',
            title: 'File Type',
            description: 'Specific file type (e.g., pdf, doc, image)'
          },
          channel: {
            type: 'string',
            title: 'Channel',
            description: 'Channel ID (leave empty for all channels)'
          }
        }
      },
      handler: this.handleFileSharedTrigger.bind(this)
    });

    // User joined trigger
    this.triggers.set('user_joined', {
      id: 'user_joined',
      name: 'User Joined',
      description: 'Triggers when a user joins a channel or workspace',
      configSchema: {
        type: 'object',
        properties: {
          channelOnly: {
            type: 'boolean',
            title: 'Channel Joins Only',
            description: 'Only trigger on channel joins, not workspace joins',
            default: false
          }
        }
      },
      handler: this.handleUserJoinedTrigger.bind(this)
    });

    // Scheduled message trigger
    this.triggers.set('scheduled', {
      id: 'scheduled',
      name: 'Scheduled',
      description: 'Triggers at specified times',
      configSchema: {
        type: 'object',
        properties: {
          schedule: {
            type: 'string',
            title: 'Schedule',
            description: 'Cron expression (e.g., "0 9 * * 1-5" for 9 AM weekdays)',
            pattern: '^[0-9*,/-]+ [0-9*,/-]+ [0-9*,/-]+ [0-9*,/-]+ [0-9*,/-]+$'
          },
          timezone: {
            type: 'string',
            title: 'Timezone',
            default: 'UTC'
          }
        },
        required: ['schedule']
      },
      handler: this.handleScheduledTrigger.bind(this)
    });

    console.log(`Registered ${this.triggers.size} automation triggers`);
  }

  async registerBuiltInActions() {
    // Send message action
    this.actions.set('send_message', {
      id: 'send_message',
      name: 'Send Message',
      description: 'Send a message to a Slack channel',
      configSchema: {
        type: 'object',
        properties: {
          workspace: {
            type: 'string',
            title: 'Workspace',
            description: 'Target workspace ID'
          },
          channel: {
            type: 'string',
            title: 'Channel',
            description: 'Target channel ID or name',
            required: true
          },
          text: {
            type: 'string',
            title: 'Message',
            description: 'Message text (supports variables like {{user}}, {{channel}})',
            required: true
          },
          asUser: {
            type: 'boolean',
            title: 'Send as User',
            description: 'Send as authenticated user instead of bot',
            default: true
          },
          threadTs: {
            type: 'string',
            title: 'Thread Timestamp',
            description: 'Reply to thread (use {{thread_ts}} from trigger)'
          }
        },
        required: ['channel', 'text']
      },
      handler: this.handleSendMessageAction.bind(this)
    });

    // Add reaction action
    this.actions.set('add_reaction', {
      id: 'add_reaction',
      name: 'Add Reaction',
      description: 'Add a reaction emoji to a message',
      configSchema: {
        type: 'object',
        properties: {
          emoji: {
            type: 'string',
            title: 'Emoji',
            description: 'Emoji name (without colons)',
            required: true
          },
          channel: {
            type: 'string',
            title: 'Channel',
            description: 'Channel ID (use {{channel}} from trigger)'
          },
          timestamp: {
            type: 'string',
            title: 'Message Timestamp',
            description: 'Message timestamp (use {{ts}} from trigger)'
          }
        },
        required: ['emoji']
      },
      handler: this.handleAddReactionAction.bind(this)
    });

    // Set status action
    this.actions.set('set_status', {
      id: 'set_status',
      name: 'Set Status',
      description: 'Update your Slack status',
      configSchema: {
        type: 'object',
        properties: {
          statusText: {
            type: 'string',
            title: 'Status Text',
            description: 'Status text (supports variables)'
          },
          statusEmoji: {
            type: 'string',
            title: 'Status Emoji',
            description: 'Status emoji (e.g., :rocket:)'
          },
          expiration: {
            type: 'number',
            title: 'Expiration (minutes)',
            description: 'Status expiration in minutes (0 for no expiration)',
            default: 0
          }
        }
      },
      handler: this.handleSetStatusAction.bind(this)
    });

    // Create channel action
    this.actions.set('create_channel', {
      id: 'create_channel',
      name: 'Create Channel',
      description: 'Create a new Slack channel',
      configSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Channel Name',
            description: 'Channel name (supports variables)',
            required: true
          },
          isPrivate: {
            type: 'boolean',
            title: 'Private Channel',
            default: false
          },
          topic: {
            type: 'string',
            title: 'Topic',
            description: 'Channel topic (optional)'
          },
          purpose: {
            type: 'string',
            title: 'Purpose',
            description: 'Channel purpose (optional)'
          },
          inviteUsers: {
            type: 'array',
            title: 'Invite Users',
            description: 'User IDs to invite to the channel',
            items: {
              type: 'string'
            }
          }
        },
        required: ['name']
      },
      handler: this.handleCreateChannelAction.bind(this)
    });

    // Forward to email action
    this.actions.set('forward_email', {
      id: 'forward_email',
      name: 'Forward to Email',
      description: 'Forward Slack message to email',
      configSchema: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            title: 'To Email',
            description: 'Recipient email address',
            required: true,
            format: 'email'
          },
          subject: {
            type: 'string',
            title: 'Subject',
            description: 'Email subject (supports variables)',
            default: 'Slack message from {{user}} in {{channel}}'
          },
          includeContext: {
            type: 'boolean',
            title: 'Include Context',
            description: 'Include channel and user information',
            default: true
          }
        },
        required: ['to']
      },
      handler: this.handleForwardEmailAction.bind(this)
    });

    // Create task action (integrates with task management)
    this.actions.set('create_task', {
      id: 'create_task',
      name: 'Create Task',
      description: 'Create a task in your task management system',
      configSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: 'Task Title',
            description: 'Task title (supports variables)',
            required: true
          },
          description: {
            type: 'string',
            title: 'Description',
            description: 'Task description (supports variables)'
          },
          project: {
            type: 'string',
            title: 'Project',
            description: 'Project name or ID'
          },
          assignee: {
            type: 'string',
            title: 'Assignee',
            description: 'Assignee email or ID'
          },
          dueDate: {
            type: 'string',
            title: 'Due Date',
            description: 'Due date (YYYY-MM-DD format or relative like "+3 days")'
          },
          priority: {
            type: 'string',
            title: 'Priority',
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium'
          }
        },
        required: ['title']
      },
      handler: this.handleCreateTaskAction.bind(this)
    });

    // Log to file action
    this.actions.set('log_to_file', {
      id: 'log_to_file',
      name: 'Log to File',
      description: 'Log message details to a file',
      configSchema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            title: 'Filename',
            description: 'Log filename (supports variables)',
            default: 'slack-log-{{date}}.txt'
          },
          format: {
            type: 'string',
            title: 'Format',
            enum: ['text', 'json', 'csv'],
            default: 'text'
          },
          includeTimestamp: {
            type: 'boolean',
            title: 'Include Timestamp',
            default: true
          }
        }
      },
      handler: this.handleLogToFileAction.bind(this)
    });

    console.log(`Registered ${this.actions.size} automation actions`);
  }

  setupEventListeners() {
    // Listen to Slack events and trigger automations
    this.api.events.on('slack:new_message', this.handleSlackEvent.bind(this));
    this.api.events.on('slack:reaction_added', this.handleSlackEvent.bind(this));
    this.api.events.on('slack:file_shared', this.handleSlackEvent.bind(this));
    this.api.events.on('slack:user_joined', this.handleSlackEvent.bind(this));
    this.api.events.on('slack:channel_created', this.handleSlackEvent.bind(this));
    this.api.events.on('slack:presence_changed', this.handleSlackEvent.bind(this));
  }

  async handleSlackEvent(eventData) {
    const { type } = eventData;
    
    // Find automations that should trigger for this event
    const triggeredAutomations = await this.findTriggeredAutomations(type, eventData);
    
    // Queue automations for execution
    for (const automation of triggeredAutomations) {
      this.queueAutomationExecution(automation, eventData);
    }
  }

  async findTriggeredAutomations(eventType, eventData) {
    const triggeredAutomations = [];
    
    // Get all active automations
    const automations = await this.getActiveAutomations();
    
    for (const automation of automations) {
      try {
        // Check if trigger matches the event
        const triggerConfig = this.triggers.get(automation.trigger.type);
        if (triggerConfig && await triggerConfig.handler(automation.trigger.config, eventData)) {
          triggeredAutomations.push(automation);
        }
      } catch (error) {
        console.error(`Error checking automation trigger ${automation.id}:`, error);
      }
    }
    
    return triggeredAutomations;
  }

  async getActiveAutomations() {
    // Get automations from storage
    const automations = await this.api.storage.get('slack_automations') || [];
    return automations.filter(automation => automation.enabled);
  }

  queueAutomationExecution(automation, eventData) {
    this.executionQueue.push({
      automation,
      eventData,
      timestamp: Date.now(),
      retryCount: 0
    });
    
    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processExecutionQueue();
    }
  }

  async processExecutionQueue() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.executionQueue.length > 0) {
      const execution = this.executionQueue.shift();
      
      try {
        await this.executeAutomation(execution);
      } catch (error) {
        console.error(`Automation execution failed:`, error);
        
        // Retry logic
        if (execution.retryCount < 3) {
          execution.retryCount++;
          execution.timestamp = Date.now() + (execution.retryCount * 5000); // Exponential backoff
          
          // Re-queue for retry
          this.executionQueue.push(execution);
        } else {
          // Log failure
          await this.logAutomationFailure(execution, error);
        }
      }
      
      // Small delay between executions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessingQueue = false;
  }

  async executeAutomation(execution) {
    const { automation, eventData } = execution;
    
    console.log(`Executing automation: ${automation.name}`);
    
    // Create execution context
    const context = {
      trigger: eventData,
      variables: this.extractVariables(eventData),
      workspace: await this.getWorkspaceInfo(eventData.workspaceId),
      timestamp: Date.now()
    };
    
    // Execute each action in sequence
    for (const actionConfig of automation.actions) {
      const actionHandler = this.actions.get(actionConfig.type);
      
      if (actionHandler) {
        // Replace variables in action config
        const processedConfig = this.replaceVariables(actionConfig.config, context.variables);
        
        // Execute action
        await actionHandler.handler(processedConfig, context);
        
        console.log(`Executed action: ${actionConfig.type}`);
      } else {
        console.warn(`Unknown action type: ${actionConfig.type}`);
      }
    }
    
    // Log successful execution
    await this.logAutomationExecution(automation, context, 'success');
  }

  extractVariables(eventData) {
    const variables = {
      date: new Date().toISOString().split('T')[0],
      datetime: new Date().toISOString(),
      timestamp: Date.now(),
      user_id: this.context.user.id,
      user_name: this.context.user.name,
      user_email: this.context.user.email
    };
    
    // Extract event-specific variables
    if (eventData.message) {
      variables.text = eventData.message.text;
      variables.message_ts = eventData.message.ts;
      variables.thread_ts = eventData.message.thread_ts;
      variables.message_user = eventData.message.user;
      variables.message_user_name = eventData.user?.real_name || eventData.user?.name;
    }
    
    if (eventData.channel) {
      variables.channel = eventData.channel.id;
      variables.channel_name = eventData.channel.name;
      variables.channel_type = this.getChannelType(eventData.channel);
    }
    
    if (eventData.workspace) {
      variables.workspace = eventData.workspace.id;
      variables.workspace_name = eventData.workspace.name;
    }
    
    if (eventData.file) {
      variables.file_name = eventData.file.name;
      variables.file_type = eventData.file.filetype;
      variables.file_url = eventData.file.url_private;
    }
    
    return variables;
  }

  replaceVariables(config, variables) {
    const processedConfig = JSON.parse(JSON.stringify(config));
    
    const replaceInValue = (value) => {
      if (typeof value === 'string') {
        return value.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return variables[key] || match;
        });
      }
      return value;
    };
    
    const replaceRecursive = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(replaceRecursive);
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = replaceRecursive(value);
        }
        return result;
      } else {
        return replaceInValue(obj);
      }
    };
    
    return replaceRecursive(processedConfig);
  }

  // Trigger handlers
  async handleNewMessageTrigger(config, eventData) {
    if (eventData.type !== 'slack:new_message') return false;
    
    const { message, channel, user, workspace } = eventData;
    
    // Check workspace filter
    if (config.workspace && workspace?.id !== config.workspace) return false;
    
    // Check channel filter
    if (config.channel && message.channel !== config.channel) return false;
    
    // Check user filter
    if (config.user && message.user !== config.user) return false;
    
    // Check keyword filter
    if (config.keyword && !message.text.toLowerCase().includes(config.keyword.toLowerCase())) return false;
    
    // Check channel type filter
    if (config.channelType && config.channelType !== 'any') {
      const channelType = this.getChannelType(channel);
      if (channelType !== config.channelType) return false;
    }
    
    // Check bot message filter
    if (config.excludeBot && (message.bot_id || message.subtype === 'bot_message')) return false;
    
    return true;
  }

  async handleMentionTrigger(config, eventData) {
    if (eventData.type !== 'slack:new_message') return false;
    
    const { message, workspace } = eventData;
    const userId = workspace?.user?.id || this.context.user.id;
    
    // Check for direct mention
    if (message.text.includes(`<@${userId}>`)) return true;
    
    // Check for channel mentions if enabled
    if (config.includeChannelMentions && 
        (message.text.includes('@channel') || message.text.includes('@here'))) {
      return true;
    }
    
    return false;
  }

  async handleReactionTrigger(config, eventData) {
    if (eventData.type !== 'slack:reaction_added') return false;
    
    const { event } = eventData;
    
    // Check emoji filter
    if (config.emoji && event.reaction !== config.emoji) return false;
    
    // Check if it's on user's message
    if (config.onMyMessages) {
      const workspace = await this.getWorkspaceInfo(eventData.workspaceId);
      const userId = workspace?.user?.id || this.context.user.id;
      
      // Would need to fetch the message to check if it's from the user
      // This is a simplified check
      if (event.item_user !== userId) return false;
    }
    
    return true;
  }

  async handleFileSharedTrigger(config, eventData) {
    if (eventData.type !== 'slack:file_shared') return false;
    
    const { file, message } = eventData;
    
    // Check file type filter
    if (config.fileType && file.filetype !== config.fileType) return false;
    
    // Check channel filter
    if (config.channel && message.channel !== config.channel) return false;
    
    return true;
  }

  async handleUserJoinedTrigger(config, eventData) {
    const validTypes = ['slack:user_joined', 'slack:team_join'];
    if (!validTypes.includes(eventData.type)) return false;
    
    // Check if it's workspace join vs channel join
    if (config.channelOnly && eventData.type !== 'slack:user_joined') return false;
    
    return true;
  }

  async handleScheduledTrigger(config, eventData) {
    // This would be handled by a separate scheduler service
    // For now, just return false as it's not triggered by Slack events
    return false;
  }

  // Action handlers
  async handleSendMessageAction(config, context) {
    const workspace = context.workspace || await this.getActiveWorkspace();
    if (!workspace) {
      throw new Error('No active workspace available');
    }
    
    const params = {
      channel: config.channel,
      text: config.text,
      as_user: config.asUser
    };
    
    if (config.threadTs) {
      params.thread_ts = config.threadTs;
    }
    
    const response = await this.makeSlackAPIRequest(workspace.access_token, 'chat.postMessage', params);
    return response;
  }

  async handleAddReactionAction(config, context) {
    const workspace = context.workspace || await this.getActiveWorkspace();
    if (!workspace) {
      throw new Error('No active workspace available');
    }
    
    const params = {
      channel: config.channel || context.variables.channel,
      timestamp: config.timestamp || context.variables.message_ts,
      name: config.emoji
    };
    
    const response = await this.makeSlackAPIRequest(workspace.access_token, 'reactions.add', params);
    return response;
  }

  async handleSetStatusAction(config, context) {
    const workspace = context.workspace || await this.getActiveWorkspace();
    if (!workspace) {
      throw new Error('No active workspace available');
    }
    
    const profile = {
      status_text: config.statusText || '',
      status_emoji: config.statusEmoji || ''
    };
    
    if (config.expiration > 0) {
      profile.status_expiration = Math.floor(Date.now() / 1000) + (config.expiration * 60);
    }
    
    const response = await this.makeSlackAPIRequest(workspace.access_token, 'users.profile.set', {
      profile: JSON.stringify(profile)
    });
    return response;
  }

  async handleCreateChannelAction(config, context) {
    const workspace = context.workspace || await this.getActiveWorkspace();
    if (!workspace) {
      throw new Error('No active workspace available');
    }
    
    const params = {
      name: config.name.toLowerCase().replace(/\s+/g, '-'),
      is_private: config.isPrivate
    };
    
    const response = await this.makeSlackAPIRequest(workspace.access_token, 'conversations.create', params);
    
    // Set topic and purpose if provided
    if (response.ok && response.channel) {
      const channelId = response.channel.id;
      
      if (config.topic) {
        await this.makeSlackAPIRequest(workspace.access_token, 'conversations.setTopic', {
          channel: channelId,
          topic: config.topic
        });
      }
      
      if (config.purpose) {
        await this.makeSlackAPIRequest(workspace.access_token, 'conversations.setPurpose', {
          channel: channelId,
          purpose: config.purpose
        });
      }
      
      // Invite users if specified
      if (config.inviteUsers && config.inviteUsers.length > 0) {
        await this.makeSlackAPIRequest(workspace.access_token, 'conversations.invite', {
          channel: channelId,
          users: config.inviteUsers.join(',')
        });
      }
    }
    
    return response;
  }

  async handleForwardEmailAction(config, context) {
    const emailBody = this.formatEmailBody(context, config.includeContext);
    
    // Use the mail API to send email
    await this.api.data.mail.sendMessage('default', {
      to: config.to,
      subject: config.subject,
      html: emailBody,
      text: this.stripHtml(emailBody)
    });
  }

  async handleCreateTaskAction(config, context) {
    // This would integrate with task management plugins
    // For now, we'll emit an event that other plugins can listen to
    
    const taskData = {
      title: config.title,
      description: config.description,
      project: config.project,
      assignee: config.assignee,
      dueDate: this.parseDueDate(config.dueDate),
      priority: config.priority,
      source: 'slack_automation',
      sourceData: {
        workspace: context.workspace?.name,
        channel: context.variables.channel_name,
        user: context.variables.message_user_name,
        message: context.variables.text
      }
    };
    
    this.api.events.emit('task:create', taskData);
    
    return taskData;
  }

  async handleLogToFileAction(config, context) {
    const filename = config.filename;
    let logEntry;
    
    switch (config.format) {
      case 'json':
        logEntry = JSON.stringify({
          timestamp: config.includeTimestamp ? new Date().toISOString() : undefined,
          workspace: context.workspace?.name,
          channel: context.variables.channel_name,
          user: context.variables.message_user_name,
          message: context.variables.text,
          context: context.variables
        }, null, 2);
        break;
      case 'csv':
        logEntry = [
          config.includeTimestamp ? new Date().toISOString() : '',
          context.workspace?.name || '',
          context.variables.channel_name || '',
          context.variables.message_user_name || '',
          `"${(context.variables.text || '').replace(/"/g, '""')}"`,
        ].join(',');
        break;
      default: // text
        logEntry = `${config.includeTimestamp ? `[${new Date().toISOString()}] ` : ''}${context.variables.message_user_name} in #${context.variables.channel_name}: ${context.variables.text}`;
    }
    
    // Append to file
    try {
      const existingContent = await this.api.data.files.readFile(`logs/${filename}`).catch(() => '');
      const newContent = existingContent + logEntry + '\n';
      await this.api.data.files.writeFile(`logs/${filename}`, Buffer.from(newContent, 'utf8'));
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
  }

  // Helper methods
  async getActiveWorkspace() {
    const slackState = await this.api.storage.get('slack_state');
    if (!slackState || !slackState.workspaces) return null;
    
    return slackState.workspaces.find(w => w.id === slackState.activeWorkspace) || slackState.workspaces[0];
  }

  async getWorkspaceInfo(workspaceId) {
    const slackState = await this.api.storage.get('slack_state');
    if (!slackState || !slackState.workspaces) return null;
    
    return slackState.workspaces.find(w => w.id === workspaceId);
  }

  getChannelType(channel) {
    if (channel.is_im) return 'dm';
    if (channel.is_mpim) return 'group';
    if (channel.is_private) return 'private';
    return 'public';
  }

  formatEmailBody(context, includeContext) {
    let body = `<h3>Slack Message</h3>\n`;
    
    if (includeContext) {
      body += `<p><strong>Workspace:</strong> ${context.workspace?.name || 'Unknown'}</p>\n`;
      body += `<p><strong>Channel:</strong> #${context.variables.channel_name || 'Unknown'}</p>\n`;
      body += `<p><strong>User:</strong> ${context.variables.message_user_name || 'Unknown'}</p>\n`;
      body += `<p><strong>Time:</strong> ${new Date(context.timestamp).toLocaleString()}</p>\n`;
    }
    
    body += `<hr>\n`;
    body += `<p>${this.escapeHtml(context.variables.text || '')}</p>\n`;
    
    if (context.variables.message_ts) {
      body += `<p><a href="slack://channel?team=${context.workspace?.id}&id=${context.variables.channel}&message=${context.variables.message_ts}">View in Slack</a></p>\n`;
    }
    
    return body;
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  parseDueDate(dueDateStr) {
    if (!dueDateStr) return null;
    
    // Handle relative dates like "+3 days", "+1 week"
    const relativeMatch = dueDateStr.match(/^\+(\d+)\s*(day|days|week|weeks|month|months)$/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      const date = new Date();
      
      switch (unit) {
        case 'day':
        case 'days':
          date.setDate(date.getDate() + amount);
          break;
        case 'week':
        case 'weeks':
          date.setDate(date.getDate() + (amount * 7));
          break;
        case 'month':
        case 'months':
          date.setMonth(date.getMonth() + amount);
          break;
      }
      
      return date.toISOString().split('T')[0];
    }
    
    // Handle absolute dates
    const dateMatch = dueDateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateMatch) {
      return dueDateStr;
    }
    
    // Try to parse as date
    try {
      const date = new Date(dueDateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // Invalid date
    }
    
    return null;
  }

  async makeSlackAPIRequest(token, method, params = {}) {
    const url = `https://slack.com/api/${method}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Slack API Error: ${data.error}`);
    }
    
    return data;
  }

  async logAutomationExecution(automation, context, status) {
    const logEntry = {
      automationId: automation.id,
      automationName: automation.name,
      status: status,
      timestamp: Date.now(),
      workspace: context.workspace?.name,
      trigger: context.trigger.type,
      variables: context.variables
    };
    
    // Store execution log
    const logs = await this.api.storage.get('automation_logs') || [];
    logs.push(logEntry);
    
    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }
    
    await this.api.storage.set('automation_logs', logs);
  }

  async logAutomationFailure(execution, error) {
    await this.logAutomationExecution(
      execution.automation,
      { workspace: null, trigger: { type: 'error' }, variables: {} },
      `failed: ${error.message}`
    );
  }

  startQueueProcessor() {
    // Process queue every second
    setInterval(() => {
      if (!this.isProcessingQueue && this.executionQueue.length > 0) {
        this.processExecutionQueue();
      }
    }, 1000);
  }

  // Public API for managing automations
  async createAutomation(automation) {
    const automations = await this.getActiveAutomations();
    
    const newAutomation = {
      id: Date.now().toString(),
      name: automation.name,
      description: automation.description,
      trigger: automation.trigger,
      actions: automation.actions,
      enabled: automation.enabled !== false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    automations.push(newAutomation);
    await this.api.storage.set('slack_automations', automations);
    
    return newAutomation;
  }

  async updateAutomation(id, updates) {
    const automations = await this.api.storage.get('slack_automations') || [];
    const index = automations.findIndex(a => a.id === id);
    
    if (index === -1) {
      throw new Error('Automation not found');
    }
    
    automations[index] = {
      ...automations[index],
      ...updates,
      updatedAt: Date.now()
    };
    
    await this.api.storage.set('slack_automations', automations);
    return automations[index];
  }

  async deleteAutomation(id) {
    const automations = await this.api.storage.get('slack_automations') || [];
    const filtered = automations.filter(a => a.id !== id);
    
    await this.api.storage.set('slack_automations', filtered);
    return true;
  }

  async getAllAutomations() {
    return await this.api.storage.get('slack_automations') || [];
  }

  getTriggerTypes() {
    return Array.from(this.triggers.values()).map(trigger => ({
      id: trigger.id,
      name: trigger.name,
      description: trigger.description,
      configSchema: trigger.configSchema
    }));
  }

  getActionTypes() {
    return Array.from(this.actions.values()).map(action => ({
      id: action.id,
      name: action.name,
      description: action.description,
      configSchema: action.configSchema
    }));
  }

  async getExecutionLogs(limit = 100) {
    const logs = await this.api.storage.get('automation_logs') || [];
    return logs.slice(-limit).reverse(); // Return most recent first
  }
}

// Initialize automation engine
const slackAutomation = new SlackAutomationEngine();

// Auto-initialize if API is available
if (typeof window !== 'undefined' && window.pluginAPI && window.pluginContext) {
  slackAutomation.initialize(window.pluginAPI, window.pluginContext);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = slackAutomation;
} else if (typeof window !== 'undefined') {
  window.slackAutomation = slackAutomation;
}