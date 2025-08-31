/**
 * Slack Plugin Background Script
 * Handles background operations, sync, and push notifications
 */

class SlackBackgroundService {
  constructor() {
    this.api = null;
    this.context = null;
    this.syncInterval = null;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.baseRetryDelay = 1000; // 1 second
  }

  async initialize(api, context) {
    this.api = api;
    this.context = context;
    
    console.log('Slack background service initialized');
    
    // Start periodic sync
    this.startPeriodicSync();
    
    // Listen for network changes
    this.setupNetworkHandlers();
    
    // Listen for app events
    this.setupAppEventHandlers();
    
    return true;
  }

  startPeriodicSync() {
    // Sync every 30 seconds when active
    this.syncInterval = setInterval(async () => {
      try {
        await this.performBackgroundSync();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, 30000);
    
    console.log('Periodic sync started');
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Periodic sync stopped');
    }
  }

  async performBackgroundSync() {
    const slackState = await this.api.storage.get('slack_state');
    
    if (!slackState || !slackState.workspaces) {
      return;
    }

    const activeWorkspaces = slackState.workspaces.filter(w => w.is_connected);
    
    for (const workspace of activeWorkspaces) {
      try {
        await this.syncWorkspace(workspace);
      } catch (error) {
        console.error(`Failed to sync workspace ${workspace.name}:`, error);
        await this.handleSyncError(workspace.id, error);
      }
    }
  }

  async syncWorkspace(workspace) {
    const workspaceKey = `sync_${workspace.id}`;
    
    try {
      // Check for new messages in key channels
      const importantChannels = await this.getImportantChannels(workspace);
      
      for (const channel of importantChannels) {
        await this.syncChannelMessages(workspace, channel);
      }
      
      // Update presence info for key users
      await this.updatePresenceInfo(workspace);
      
      // Check for unread counts
      await this.updateUnreadCounts(workspace);
      
      // Mark successful sync
      await this.api.storage.set(`${workspaceKey}_last_sync`, Date.now());
      this.retryAttempts.delete(workspaceKey);
      
    } catch (error) {
      throw error;
    }
  }

  async getImportantChannels(workspace) {
    // Get channels with recent activity or user is member of
    const allChannels = workspace.channels || [];
    
    return allChannels.filter(channel => 
      channel.is_member || 
      channel.is_im || 
      channel.unread_count > 0
    ).slice(0, 10); // Limit to most important channels
  }

  async syncChannelMessages(workspace, channel) {
    try {
      // Get last message timestamp
      const lastSyncKey = `last_sync_${workspace.id}_${channel.id}`;
      const lastSync = await this.api.storage.get(lastSyncKey) || (Date.now() - 86400000); // 24h ago
      
      const response = await this.makeSlackAPIRequest(workspace.access_token, 'conversations.history', {
        channel: channel.id,
        oldest: (lastSync / 1000).toString(),
        limit: 20
      });
      
      if (response.messages && response.messages.length > 0) {
        // Process new messages
        for (const message of response.messages) {
          await this.processNewMessage(workspace, channel, message);
        }
        
        // Update last sync timestamp
        const latestMessage = response.messages[0];
        await this.api.storage.set(lastSyncKey, parseFloat(latestMessage.ts) * 1000);
      }
      
    } catch (error) {
      console.error(`Failed to sync messages for channel ${channel.id}:`, error);
    }
  }

  async processNewMessage(workspace, channel, message) {
    // Check if message warrants a notification
    const shouldNotify = await this.shouldNotifyForMessage(workspace, channel, message);
    
    if (shouldNotify) {
      await this.sendNotification(workspace, channel, message);
    }
    
    // Index message for search
    await this.indexMessage(workspace, channel, message);
    
    // Trigger automation events
    this.api.events.emit('slack:new_message', {
      workspaceId: workspace.id,
      channelId: channel.id,
      message: message
    });
  }

  async shouldNotifyForMessage(workspace, channel, message) {
    // Don't notify for own messages
    if (message.user === workspace.user.id) return false;
    
    // Don't notify for old messages (more than 5 minutes)
    const messageAge = Date.now() - (parseFloat(message.ts) * 1000);
    if (messageAge > 300000) return false;
    
    const config = await this.api.storage.get('slack_config') || {};
    
    if (!config.enableNotifications) return false;
    
    const notificationTypes = config.notificationTypes || ['mentions', 'direct-messages'];
    
    // Check for direct messages
    if (notificationTypes.includes('direct-messages') && channel.is_im) {
      return true;
    }
    
    // Check for mentions
    if (notificationTypes.includes('mentions')) {
      const userId = workspace.user.id;
      if (message.text.includes(`<@${userId}>`) || 
          message.text.includes('@channel') || 
          message.text.includes('@here')) {
        return true;
      }
    }
    
    // Check for keywords
    if (notificationTypes.includes('keyword-alerts')) {
      const keywords = config.keywords || [];
      const messageText = message.text.toLowerCase();
      
      for (const keyword of keywords) {
        if (messageText.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }
    
    // Check for all messages in specific channels
    if (notificationTypes.includes('all-messages')) {
      return true;
    }
    
    return false;
  }

  async sendNotification(workspace, channel, message) {
    try {
      const user = workspace.users?.find(u => u.id === message.user);
      
      const notification = {
        title: this.getNotificationTitle(workspace, channel, user),
        body: this.stripSlackFormatting(message.text).substring(0, 100),
        icon: user?.profile?.image_48 || 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/slack/slack-original.svg',
        tag: `slack-${workspace.id}-${channel.id}`,
        data: {
          workspaceId: workspace.id,
          channelId: channel.id,
          messageTs: message.ts,
          action: 'open_channel'
        },
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
        timeout: 10000,
        requireInteraction: false
      };
      
      // Send via plugin API
      this.api.ui.showNotification(notification);
      
      // Also send system notification for background
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          tag: notification.tag,
          data: notification.data
        });
      }
      
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async indexMessage(workspace, channel, message) {
    try {
      const user = workspace.users?.find(u => u.id === message.user);
      
      await this.api.search.index({
        id: `${workspace.id}-${message.ts}`,
        title: this.getMessageTitle(message, channel, user),
        body: this.stripSlackFormatting(message.text),
        url: message.permalink || `slack://channel?team=${workspace.id}&id=${channel.id}&message=${message.ts}`,
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
      
    } catch (error) {
      console.error('Failed to index message:', error);
    }
  }

  async updatePresenceInfo(workspace) {
    try {
      // Get presence for key users (those in recent conversations)
      const keyUsers = this.getKeyUsers(workspace);
      
      for (const userId of keyUsers.slice(0, 20)) { // Limit to 20 users
        const presence = await this.makeSlackAPIRequest(workspace.access_token, 'users.getPresence', {
          user: userId
        });
        
        if (presence.ok) {
          // Update cached user presence
          const user = workspace.users?.find(u => u.id === userId);
          if (user) {
            user.presence = presence.presence;
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to update presence info:', error);
    }
  }

  getKeyUsers(workspace) {
    // Get users from recent DM channels and active channels
    const keyUsers = new Set();
    
    // Add users from IM channels
    workspace.channels?.forEach(channel => {
      if (channel.is_im && channel.user) {
        keyUsers.add(channel.user);
      }
    });
    
    // Add self
    keyUsers.add(workspace.user.id);
    
    return Array.from(keyUsers);
  }

  async updateUnreadCounts(workspace) {
    try {
      // Get unread counts for all channels
      const response = await this.makeSlackAPIRequest(workspace.access_token, 'conversations.list', {
        types: 'public_channel,private_channel,mpim,im',
        exclude_archived: true
      });
      
      if (response.channels) {
        let totalUnread = 0;
        let totalMentions = 0;
        
        for (const channel of response.channels) {
          if (channel.unread_count && channel.unread_count > 0) {
            totalUnread += channel.unread_count;
          }
          
          if (channel.unread_count_display && channel.unread_count_display > 0) {
            totalMentions += channel.unread_count_display;
          }
        }
        
        // Update workspace counts
        workspace.unread_count = totalUnread;
        workspace.mention_count = totalMentions;
        
        // Emit event for UI updates
        this.api.events.emit('slack:unread_updated', {
          workspaceId: workspace.id,
          unreadCount: totalUnread,
          mentionCount: totalMentions
        });
      }
      
    } catch (error) {
      console.error('Failed to update unread counts:', error);
    }
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

  async handleSyncError(workspaceId, error) {
    const workspaceKey = `sync_${workspaceId}`;
    const attempts = this.retryAttempts.get(workspaceKey) || 0;
    
    if (attempts < this.maxRetries) {
      this.retryAttempts.set(workspaceKey, attempts + 1);
      
      // Exponential backoff
      const delay = this.baseRetryDelay * Math.pow(2, attempts);
      
      setTimeout(async () => {
        try {
          const slackState = await this.api.storage.get('slack_state');
          const workspace = slackState?.workspaces?.find(w => w.id === workspaceId);
          
          if (workspace) {
            await this.syncWorkspace(workspace);
          }
        } catch (retryError) {
          console.error(`Retry ${attempts + 1} failed for workspace ${workspaceId}:`, retryError);
        }
      }, delay);
      
      console.log(`Scheduling retry ${attempts + 1}/${this.maxRetries} for workspace ${workspaceId} in ${delay}ms`);
    } else {
      console.error(`Max retries exceeded for workspace ${workspaceId}, giving up`);
      this.retryAttempts.delete(workspaceKey);
      
      // Emit error event
      this.api.events.emit('slack:sync_failed', {
        workspaceId,
        error: error.message,
        maxRetriesExceeded: true
      });
    }
  }

  setupNetworkHandlers() {
    // Listen for network connectivity changes
    if ('navigator' in window && 'onLine' in navigator) {
      window.addEventListener('online', () => {
        console.log('Network came back online, resuming sync');
        this.performBackgroundSync();
      });
      
      window.addEventListener('offline', () => {
        console.log('Network went offline, pausing sync');
      });
    }
  }

  setupAppEventHandlers() {
    // Listen for app visibility changes
    if ('document' in window) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // App became visible, do a quick sync
          this.performBackgroundSync();
        }
      });
    }
    
    // Listen for plugin events
    this.api.events.on('slack:force_sync', async (data) => {
      try {
        await this.performBackgroundSync();
      } catch (error) {
        console.error('Forced sync failed:', error);
      }
    });
  }

  // Helper methods
  stripSlackFormatting(text) {
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

  getNotificationTitle(workspace, channel, user) {
    const userName = user?.real_name || user?.name || 'Someone';
    const channelName = channel.name || 'unknown';
    
    if (channel.is_im) {
      return `${userName} (${workspace.name})`;
    }
    
    return `${userName} in #${channelName} (${workspace.name})`;
  }

  getMessageTitle(message, channel, user) {
    const channelName = channel?.name || 'unknown';
    const userName = user?.real_name || user?.name || 'Unknown User';
    
    if (channel?.is_im) {
      return `Direct message from ${userName}`;
    }
    
    return `${userName} in #${channelName}`;
  }

  // Cleanup
  async destroy() {
    this.stopPeriodicSync();
    
    // Clear retry attempts
    this.retryAttempts.clear();
    
    console.log('Slack background service destroyed');
  }
}

// Create and initialize background service
const slackBackground = new SlackBackgroundService();

// Auto-initialize if API is available
if (typeof window !== 'undefined' && window.pluginAPI && window.pluginContext) {
  slackBackground.initialize(window.pluginAPI, window.pluginContext);
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = slackBackground;
} else if (typeof window !== 'undefined') {
  window.slackBackground = slackBackground;
}