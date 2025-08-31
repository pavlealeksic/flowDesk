/**
 * Slack Plugin - Main Entry Point
 * 
 * This is the main plugin file that registers triggers, actions, and initializes
 * the Slack integration for Flow Desk.
 */

// Check if we're in the plugin runtime environment
if (typeof FlowDeskAPI === 'undefined') {
  throw new Error('Slack Plugin requires Flow Desk Plugin Runtime');
}

// Plugin state
let slackAPI = null;
let isAuthenticated = false;
let connectionState = 'disconnected';
let messagePollingInterval = null;

/**
 * Plugin initialization
 */
async function initialize(context) {
  FlowDeskAPI.logger.info('Initializing Slack Plugin');
  
  try {
    // Register automation triggers
    registerTriggers();
    
    // Register automation actions
    registerActions();
    
    // Register quick actions
    registerQuickActions();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize Slack connection if configured
    const config = await FlowDeskAPI.storage.get('config') || {};
    if (config.workspaceUrl) {
      await initializeSlackConnection(config);
    }
    
    FlowDeskAPI.logger.info('Slack Plugin initialized successfully');
    
  } catch (error) {
    FlowDeskAPI.logger.error('Failed to initialize Slack Plugin', error);
    throw error;
  }
}

/**
 * Plugin cleanup
 */
async function cleanup() {
  FlowDeskAPI.logger.info('Cleaning up Slack Plugin');
  
  // Stop message polling
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
    messagePollingInterval = null;
  }
  
  // Clear connection state
  connectionState = 'disconnected';
  isAuthenticated = false;
  slackAPI = null;
  
  FlowDeskAPI.logger.info('Slack Plugin cleanup completed');
}

/**
 * Register automation triggers
 */
function registerTriggers() {
  // Trigger: New Message Received
  registerAction('trigger-new-message', {
    id: 'new-message',
    name: 'New Message Received',
    description: 'Triggered when a new message is received in Slack',
    configSchema: {
      type: 'object',
      properties: {
        channels: {
          type: 'array',
          items: { type: 'string' },
          title: 'Channels to Monitor',
          description: 'List of channel names or IDs to monitor (empty = all channels)'
        },
        messageTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['direct-message', 'mention', 'all']
          },
          title: 'Message Types',
          description: 'Types of messages to trigger on'
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          title: 'Keywords',
          description: 'Trigger only on messages containing these keywords'
        }
      }
    },
    handler: async (config, context) => {
      // Check if the message matches the trigger criteria
      const message = context.data;
      
      // Check channel filter
      if (config.channels && config.channels.length > 0) {
        if (!config.channels.includes(message.channel)) {
          return false;
        }
      }
      
      // Check message type filter
      if (config.messageTypes && config.messageTypes.length > 0) {
        const messageType = message.is_direct ? 'direct-message' : 
                           message.mentions_user ? 'mention' : 'all';
        
        if (!config.messageTypes.includes(messageType) && !config.messageTypes.includes('all')) {
          return false;
        }
      }
      
      // Check keyword filter
      if (config.keywords && config.keywords.length > 0) {
        const hasKeyword = config.keywords.some(keyword => 
          message.text.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!hasKeyword) {
          return false;
        }
      }
      
      return true;
    }
  });

  // Trigger: Status Changed
  registerAction('trigger-status-changed', {
    id: 'status-changed',
    name: 'Status Changed',
    description: 'Triggered when user status changes in Slack',
    configSchema: {
      type: 'object',
      properties: {
        statusTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['active', 'away', 'busy', 'offline']
          },
          title: 'Status Types',
          description: 'Trigger on these status changes'
        }
      }
    },
    handler: async (config, context) => {
      const statusChange = context.data;
      
      if (config.statusTypes && config.statusTypes.length > 0) {
        return config.statusTypes.includes(statusChange.new_status);
      }
      
      return true;
    }
  });

  FlowDeskAPI.logger.debug('Registered Slack automation triggers');
}

/**
 * Register automation actions
 */
function registerActions() {
  // Action: Send Message
  registerAction('action-send-message', {
    id: 'send-message',
    name: 'Send Message',
    description: 'Send a message to a Slack channel or user',
    configSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          title: 'Channel or User',
          description: 'Channel name (#general) or user (@username) to send message to'
        },
        message: {
          type: 'string',
          title: 'Message Text',
          description: 'The message to send (supports Slack markdown)'
        },
        asBot: {
          type: 'boolean',
          title: 'Send as Bot',
          description: 'Send the message as a bot rather than as yourself',
          default: false
        }
      },
      required: ['channel', 'message']
    },
    handler: async (config, context) => {
      if (!isAuthenticated) {
        throw new Error('Slack not authenticated');
      }
      
      const result = await slackAPI.chat.postMessage({
        channel: config.channel,
        text: config.message,
        as_user: !config.asBot
      });
      
      FlowDeskAPI.logger.info(`Message sent to ${config.channel}: ${result.ts}`);
      
      return {
        success: true,
        messageId: result.ts,
        channel: config.channel
      };
    }
  });

  // Action: Update Status
  registerAction('action-update-status', {
    id: 'update-status',
    name: 'Update Status',
    description: 'Update your Slack status',
    configSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'away', 'busy'],
          title: 'Status',
          description: 'Your new status'
        },
        statusText: {
          type: 'string',
          title: 'Status Text',
          description: 'Custom status message'
        },
        statusEmoji: {
          type: 'string',
          title: 'Status Emoji',
          description: 'Status emoji (e.g., :coffee:)'
        },
        expiration: {
          type: 'number',
          title: 'Expiration (minutes)',
          description: 'How long to keep this status (0 = permanent)',
          minimum: 0,
          default: 0
        }
      },
      required: ['status']
    },
    handler: async (config, context) => {
      if (!isAuthenticated) {
        throw new Error('Slack not authenticated');
      }
      
      const profile = {};
      
      if (config.statusText) {
        profile.status_text = config.statusText;
      }
      
      if (config.statusEmoji) {
        profile.status_emoji = config.statusEmoji;
      }
      
      if (config.expiration > 0) {
        profile.status_expiration = Math.floor(Date.now() / 1000) + (config.expiration * 60);
      }
      
      await slackAPI.users.profile.set({ profile });
      
      if (config.status !== 'active') {
        await slackAPI.users.setPresence({ presence: config.status === 'busy' ? 'away' : config.status });
      }
      
      FlowDeskAPI.logger.info(`Status updated to: ${config.status}`);
      
      return {
        success: true,
        status: config.status,
        statusText: config.statusText
      };
    }
  });

  FlowDeskAPI.logger.debug('Registered Slack automation actions');
}

/**
 * Register quick actions for command palette
 */
function registerQuickActions() {
  // Quick Action: Open Slack
  FlowDeskAPI.ui.addCommand({
    id: 'slack-open',
    title: 'Open Slack',
    description: 'Open your Slack workspace',
    shortcut: 'Cmd+Shift+S',
    handler: async () => {
      const config = await FlowDeskAPI.storage.get('config') || {};
      if (config.workspaceUrl) {
        const url = config.workspaceUrl.startsWith('http') 
          ? config.workspaceUrl 
          : `https://${config.workspaceUrl}`;
        
        // Open in system browser or create panel
        FlowDeskAPI.ui.createPanel({
          title: 'Slack',
          location: 'sidebar',
          content: `<webview src="${url}" style="width: 100%; height: 100%;"></webview>`
        });
      } else {
        FlowDeskAPI.ui.showNotification({
          title: 'Slack Not Configured',
          body: 'Please configure your Slack workspace URL in plugin settings'
        });
      }
    }
  });

  // Quick Action: Set Status
  FlowDeskAPI.ui.addCommand({
    id: 'slack-set-status',
    title: 'Set Slack Status',
    description: 'Quickly change your Slack status',
    handler: async () => {
      const result = await FlowDeskAPI.ui.showDialog({
        title: 'Set Slack Status',
        content: `
          <div>
            <label for="status">Status:</label>
            <select id="status" name="status">
              <option value="active">Active</option>
              <option value="away">Away</option>
              <option value="busy">Busy</option>
            </select>
          </div>
          <div>
            <label for="statusText">Status Message:</label>
            <input type="text" id="statusText" name="statusText" placeholder="Working from home">
          </div>
          <div>
            <label for="statusEmoji">Status Emoji:</label>
            <input type="text" id="statusEmoji" name="statusEmoji" placeholder=":house:">
          </div>
        `,
        buttons: [
          { label: 'Cancel', value: null },
          { label: 'Set Status', value: 'ok', variant: 'primary' }
        ]
      });
      
      if (result === 'ok') {
        // This would normally get the form values from the dialog
        // For demo purposes, we'll use default values
        await updateSlackStatus({
          status: 'busy',
          statusText: 'In a meeting',
          statusEmoji: ':calendar:'
        });
      }
    }
  });

  FlowDeskAPI.logger.debug('Registered Slack quick actions');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for configuration changes
  FlowDeskAPI.events.on('plugin:config:changed', async (data) => {
    FlowDeskAPI.logger.info('Configuration changed, reinitializing connection');
    
    const config = await FlowDeskAPI.storage.get('config') || {};
    if (config.workspaceUrl) {
      await initializeSlackConnection(config);
    }
  });

  // Listen for system events that might affect Slack status
  FlowDeskAPI.events.on('system:focus:changed', async (data) => {
    const config = await FlowDeskAPI.storage.get('config') || {};
    if (config.autoAwayStatus && !data.focused) {
      await updateSlackStatus({ status: 'away', statusText: 'Away from desk' });
    }
  });

  FlowDeskAPI.logger.debug('Event listeners set up');
}

/**
 * Initialize Slack connection
 */
async function initializeSlackConnection(config) {
  try {
    FlowDeskAPI.logger.info('Initializing Slack connection');
    
    // In a real implementation, this would set up the Slack Web API client
    // For demo purposes, we'll simulate the connection
    connectionState = 'connecting';
    
    // Simulate OAuth flow if needed
    const accessToken = await FlowDeskAPI.storage.get('slack_access_token');
    if (!accessToken) {
      FlowDeskAPI.logger.info('Starting Slack OAuth flow');
      
      // Start OAuth flow
      const authCode = await FlowDeskAPI.oauth.startFlow('slack', [
        'channels:read',
        'chat:write',
        'users:read',
        'users:write'
      ]);
      
      const tokens = await FlowDeskAPI.oauth.exchangeCode(authCode);
      await FlowDeskAPI.storage.set('slack_access_token', tokens.accessToken);
    }
    
    // Initialize mock Slack API
    slackAPI = {
      chat: {
        postMessage: async (params) => ({
          ok: true,
          ts: Date.now().toString(),
          channel: params.channel
        })
      },
      users: {
        profile: {
          set: async (params) => ({ ok: true })
        },
        setPresence: async (params) => ({ ok: true })
      }
    };
    
    isAuthenticated = true;
    connectionState = 'connected';
    
    // Start message polling if enabled
    if (config.syncInterval && config.syncInterval > 0) {
      startMessagePolling(config.syncInterval);
    }
    
    FlowDeskAPI.logger.info('Slack connection established');
    
    // Show connection status
    FlowDeskAPI.ui.showNotification({
      title: 'Slack Connected',
      body: `Connected to ${config.workspaceUrl}`
    });
    
  } catch (error) {
    connectionState = 'error';
    isAuthenticated = false;
    
    FlowDeskAPI.logger.error('Failed to initialize Slack connection', error);
    
    FlowDeskAPI.ui.showNotification({
      title: 'Slack Connection Failed',
      body: error.message,
      timeout: 10000
    });
  }
}

/**
 * Start message polling
 */
function startMessagePolling(intervalSeconds) {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
  }
  
  messagePollingInterval = setInterval(async () => {
    try {
      await pollForMessages();
    } catch (error) {
      FlowDeskAPI.logger.error('Error polling for messages', error);
    }
  }, intervalSeconds * 1000);
  
  FlowDeskAPI.logger.debug(`Started message polling (${intervalSeconds}s interval)`);
}

/**
 * Poll for new messages
 */
async function pollForMessages() {
  if (!isAuthenticated) return;
  
  // In a real implementation, this would fetch new messages from Slack
  // For demo purposes, we'll simulate receiving a message occasionally
  
  if (Math.random() < 0.1) { // 10% chance of "receiving" a message
    const mockMessage = {
      id: 'msg_' + Date.now(),
      channel: '#general',
      user: 'alice',
      text: 'Hello from the Slack plugin demo!',
      timestamp: Date.now(),
      is_direct: false,
      mentions_user: false
    };
    
    // Emit event for automation system
    FlowDeskAPI.events.emit('slack:message-received', mockMessage);
    
    // Show notification if configured
    const config = await FlowDeskAPI.storage.get('config') || {};
    if (config.enableNotifications) {
      FlowDeskAPI.ui.showNotification({
        title: `New message in ${mockMessage.channel}`,
        body: `${mockMessage.user}: ${mockMessage.text}`,
        actions: [
          { action: 'reply', title: 'Reply' },
          { action: 'view', title: 'View Channel' }
        ]
      });
    }
  }
}

/**
 * Update Slack status
 */
async function updateSlackStatus(statusConfig) {
  if (!isAuthenticated) {
    throw new Error('Slack not authenticated');
  }
  
  try {
    await slackAPI.users.profile.set({
      profile: {
        status_text: statusConfig.statusText || '',
        status_emoji: statusConfig.statusEmoji || ''
      }
    });
    
    if (statusConfig.status !== 'active') {
      await slackAPI.users.setPresence({
        presence: statusConfig.status === 'busy' ? 'away' : statusConfig.status
      });
    }
    
    FlowDeskAPI.logger.info('Slack status updated', statusConfig);
    
  } catch (error) {
    FlowDeskAPI.logger.error('Failed to update Slack status', error);
    throw error;
  }
}

/**
 * Get connection status
 */
function getConnectionStatus() {
  return {
    state: connectionState,
    authenticated: isAuthenticated,
    lastSync: messagePollingInterval ? new Date() : null
  };
}

// Export plugin interface
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    initialize,
    cleanup,
    getConnectionStatus
  };
} else {
  // Browser/plugin environment
  window.SlackPlugin = {
    initialize,
    cleanup,
    getConnectionStatus
  };
}

FlowDeskAPI.logger.info('Slack Plugin loaded');