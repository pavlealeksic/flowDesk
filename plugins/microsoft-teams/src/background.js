/**
 * Microsoft Teams Plugin Background Script
 * 
 * Handles background tasks, real-time updates, and webhook processing
 */

let teamsPlugin = null;
let isInitialized = false;

/**
 * Background script initialization
 */
async function initializeBackground(api) {
  try {
    if (!teamsPlugin) {
      const { TeamsPlugin } = await import('./TeamsPlugin');
      teamsPlugin = new TeamsPlugin(api);
    }

    if (!isInitialized) {
      await teamsPlugin.initialize();
      isInitialized = true;
      
      // Start background services
      startBackgroundServices(api);
      
      api.logger.info('Teams background script initialized');
    }
  } catch (error) {
    api.logger.error('Failed to initialize Teams background script:', error);
  }
}

/**
 * Start background services
 */
function startBackgroundServices(api) {
  // Webhook handler for Microsoft Graph notifications
  setupWebhookHandler(api);
  
  // Periodic health checks
  startHealthMonitoring(api);
  
  // Presence synchronization
  startPresenceSync(api);
  
  // Message sync for offline support
  startMessageSync(api);
  
  api.logger.info('Teams background services started');
}

/**
 * Set up webhook handling for Microsoft Graph notifications
 */
function setupWebhookHandler(api) {
  api.events.on('webhook-received', async (data) => {
    const { source, payload, headers } = data;
    
    if (source !== 'microsoft-teams') {
      return;
    }
    
    try {
      await handleGraphNotification(api, payload, headers);
    } catch (error) {
      api.logger.error('Failed to handle Teams webhook:', error);
    }
  });
}

/**
 * Handle Microsoft Graph notification
 */
async function handleGraphNotification(api, notification, headers) {
  // Validate webhook signature if required
  if (!validateWebhookSignature(notification, headers)) {
    api.logger.warn('Invalid webhook signature received');
    return;
  }

  const { changeType, resource, resourceData } = notification;
  
  switch (resource) {
    case '/me/chats/getAllMessages':
      await handleMessageNotification(api, changeType, resourceData);
      break;
      
    case '/me/presence':
      await handlePresenceNotification(api, changeType, resourceData);
      break;
      
    case '/me/events':
      await handleCalendarNotification(api, changeType, resourceData);
      break;
      
    default:
      api.logger.debug(`Unhandled resource type: ${resource}`);
  }
}

/**
 * Handle message notifications
 */
async function handleMessageNotification(api, changeType, resourceData) {
  if (changeType !== 'created') {
    return;
  }

  try {
    // Get full message details
    const messageId = resourceData.id;
    const message = await teamsPlugin.getMessageDetails(messageId);
    
    // Check if this message should trigger notifications
    const shouldNotify = await checkMessageNotificationRules(message);
    
    if (shouldNotify) {
      // Show desktop notification
      const notificationOptions = {
        title: 'New Teams Message',
        body: `${message.from.user?.displayName}: ${message.body.content.substring(0, 100)}...`,
        icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
        actions: [
          { action: 'reply', title: 'Reply' },
          { action: 'view', title: 'View in Teams' },
          { action: 'mark-read', title: 'Mark as Read' }
        ],
        timeout: 10000,
        data: {
          messageId: message.id,
          chatId: message.chatId,
          channelId: message.channelIdentity?.channelId,
          teamId: message.channelIdentity?.teamId
        }
      };
      
      api.ui.showNotification(notificationOptions);
      
      // Update unread count
      await updateUnreadCount(api, message);
    }
    
    // Index message for search
    await teamsPlugin.indexMessage(message);
    
    // Trigger automation events
    api.events.emit('teams-message-received', { data: message });
    
    // Check for mentions
    if (message.mentions && message.mentions.length > 0) {
      const currentUser = await teamsPlugin.getCurrentUser();
      const isMentioned = message.mentions.some(mention => 
        mention.mentioned.user?.id === currentUser.id
      );
      
      if (isMentioned) {
        api.events.emit('teams-mention-received', { data: message });
        
        // Special handling for mentions
        api.ui.showNotification({
          title: '🔔 You were mentioned in Teams',
          body: `${message.from.user?.displayName} mentioned you: ${message.body.content.substring(0, 80)}...`,
          icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
          actions: [
            { action: 'reply', title: 'Reply' },
            { action: 'view', title: 'View' }
          ]
        });
      }
    }
    
  } catch (error) {
    api.logger.error('Failed to handle message notification:', error);
  }
}

/**
 * Handle presence notifications
 */
async function handlePresenceNotification(api, changeType, resourceData) {
  if (changeType !== 'updated') {
    return;
  }

  try {
    // Get updated presence
    const presence = await teamsPlugin.getUserPresence();
    
    // Cache the presence
    await api.storage.set('current_presence', presence);
    
    // Notify UI of presence change
    api.events.emit('teams-presence-changed', { data: presence });
    
    // Trigger automation events
    api.events.emit('teams-presence-updated', { data: presence });
    
    api.logger.debug(`Presence updated: ${presence.availability}`);
  } catch (error) {
    api.logger.error('Failed to handle presence notification:', error);
  }
}

/**
 * Handle calendar notifications
 */
async function handleCalendarNotification(api, changeType, resourceData) {
  try {
    const eventId = resourceData.id;
    
    if (changeType === 'created') {
      // Get event details
      const event = await teamsPlugin.getCalendarEvent(eventId);
      
      // Check if it's a Teams meeting
      if (event.isOnlineMeeting && event.onlineMeetingProvider === 'teamsForBusiness') {
        // Show meeting notification
        api.ui.showNotification({
          title: 'New Teams Meeting',
          body: `Meeting: ${event.subject}`,
          icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
          actions: [
            { action: 'join', title: 'Join Meeting' },
            { action: 'copy-link', title: 'Copy Link' },
            { action: 'view-calendar', title: 'View in Calendar' }
          ],
          data: {
            eventId: event.id,
            meetingUrl: event.onlineMeetingUrl,
            startTime: event.start?.dateTime
          }
        });
        
        // Schedule meeting reminder
        scheduleMeetingReminder(api, event);
        
        // Trigger automation
        api.events.emit('teams-meeting-created', { data: event });
      }
    } else if (changeType === 'updated') {
      // Handle meeting updates
      const event = await teamsPlugin.getCalendarEvent(eventId);
      api.events.emit('teams-meeting-updated', { data: event });
    } else if (changeType === 'deleted') {
      // Handle meeting cancellation
      api.events.emit('teams-meeting-cancelled', { data: { eventId } });
    }
    
  } catch (error) {
    api.logger.error('Failed to handle calendar notification:', error);
  }
}

/**
 * Start health monitoring
 */
function startHealthMonitoring(api) {
  setInterval(async () => {
    try {
      if (!teamsPlugin || !teamsPlugin.authTokens) {
        return;
      }
      
      // Check token expiration
      if (teamsPlugin.isTokenExpired(teamsPlugin.authTokens)) {
        api.logger.info('Teams token expired, refreshing...');
        await teamsPlugin.refreshAccessToken();
      }
      
      // Health check API call
      await teamsPlugin.getCurrentUser();
      
      // Update connection status
      api.events.emit('teams-connection-status', { connected: true });
      
    } catch (error) {
      api.logger.error('Teams health check failed:', error);
      api.events.emit('teams-connection-status', { connected: false });
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Start presence synchronization
 */
function startPresenceSync(api) {
  setInterval(async () => {
    try {
      if (!teamsPlugin || !teamsPlugin.authTokens) {
        return;
      }
      
      // Get current presence
      const presence = await teamsPlugin.getUserPresence();
      
      // Check if presence should be updated based on calendar
      const config = await api.storage.get('config') || {};
      if (config.customStatus?.syncWithCalendar) {
        await teamsPlugin.updatePresenceFromCalendar();
      }
      
    } catch (error) {
      api.logger.error('Presence sync failed:', error);
    }
  }, 60 * 1000); // Every minute
}

/**
 * Start message synchronization for offline support
 */
function startMessageSync(api) {
  setInterval(async () => {
    try {
      if (!teamsPlugin || !teamsPlugin.authTokens) {
        return;
      }
      
      // Sync recent messages
      await teamsPlugin.syncRecentMessages();
      
    } catch (error) {
      api.logger.error('Message sync failed:', error);
    }
  }, 2 * 60 * 1000); // Every 2 minutes
}

/**
 * Check if message should trigger notification
 */
async function checkMessageNotificationRules(message) {
  try {
    const config = await api.storage.get('config') || {};
    
    if (!config.enableNotifications) {
      return false;
    }
    
    const notificationTypes = config.notificationTypes || [];
    
    // Check if user is mentioned
    if (message.mentions && message.mentions.length > 0) {
      return notificationTypes.includes('mentions');
    }
    
    // Check if it's a direct message
    if (message.chatId && !message.channelIdentity) {
      return notificationTypes.includes('direct-messages');
    }
    
    // Check if it's a channel message
    if (message.channelIdentity) {
      return notificationTypes.includes('channel-messages');
    }
    
    return false;
  } catch (error) {
    api.logger.error('Failed to check notification rules:', error);
    return false;
  }
}

/**
 * Update unread message count
 */
async function updateUnreadCount(api, message) {
  try {
    const currentCounts = await api.storage.get('unread_counts') || {};
    
    if (message.chatId) {
      currentCounts[`chat:${message.chatId}`] = (currentCounts[`chat:${message.chatId}`] || 0) + 1;
    } else if (message.channelIdentity) {
      const key = `channel:${message.channelIdentity.teamId}:${message.channelIdentity.channelId}`;
      currentCounts[key] = (currentCounts[key] || 0) + 1;
    }
    
    await api.storage.set('unread_counts', currentCounts);
    
    // Notify UI of updated counts
    api.events.emit('teams-unread-updated', { counts: currentCounts });
    
  } catch (error) {
    api.logger.error('Failed to update unread count:', error);
  }
}

/**
 * Schedule meeting reminder
 */
function scheduleMeetingReminder(api, event) {
  const startTime = new Date(event.start?.dateTime || '');
  const reminderTime = new Date(startTime.getTime() - 5 * 60 * 1000); // 5 minutes before
  
  const now = new Date();
  const timeUntilReminder = reminderTime.getTime() - now.getTime();
  
  if (timeUntilReminder > 0) {
    setTimeout(() => {
      api.ui.showNotification({
        title: '🕐 Meeting Starting Soon',
        body: `"${event.subject}" starts in 5 minutes`,
        icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
        actions: [
          { action: 'join-now', title: 'Join Now' },
          { action: 'snooze', title: 'Remind in 2 min' }
        ],
        data: {
          eventId: event.id,
          meetingUrl: event.onlineMeetingUrl
        }
      });
      
      // Auto-join if configured
      const config = teamsPlugin?.config;
      if (config?.autoJoinMeetings) {
        // Open meeting URL
        api.system.openUrl(event.onlineMeetingUrl);
      }
      
    }, timeUntilReminder);
  }
}

/**
 * Validate webhook signature (if Microsoft Graph webhook validation is implemented)
 */
function validateWebhookSignature(notification, headers) {
  // Implementation would depend on Microsoft's webhook signature validation
  // For now, return true (in production, implement proper validation)
  return true;
}

/**
 * Handle notification actions from the UI
 */
async function handleNotificationAction(api, action, data) {
  switch (action) {
    case 'reply':
      // Open reply dialog or panel
      api.events.emit('teams-open-reply', { 
        chatId: data.chatId,
        channelId: data.channelId,
        teamId: data.teamId,
        messageId: data.messageId
      });
      break;
      
    case 'view':
    case 'view-in-teams':
      // Open Teams app or web interface
      let teamsUrl;
      if (data.chatId) {
        teamsUrl = `https://teams.microsoft.com/l/chat/0/0?users=${data.chatId}`;
      } else if (data.channelId && data.teamId) {
        teamsUrl = `https://teams.microsoft.com/l/channel/${data.channelId}/General?groupId=${data.teamId}`;
      }
      
      if (teamsUrl) {
        api.system.openUrl(teamsUrl);
      }
      break;
      
    case 'mark-read':
      // Mark message as read
      try {
        await teamsPlugin.markMessageAsRead(data.messageId);
      } catch (error) {
        api.logger.error('Failed to mark message as read:', error);
      }
      break;
      
    case 'join':
    case 'join-now':
      // Join meeting
      if (data.meetingUrl) {
        api.system.openUrl(data.meetingUrl);
      }
      break;
      
    case 'copy-link':
      // Copy meeting link to clipboard
      if (data.meetingUrl) {
        api.system.copyToClipboard(data.meetingUrl);
        api.ui.showNotification({
          title: 'Link Copied',
          body: 'Meeting link copied to clipboard',
          timeout: 3000
        });
      }
      break;
      
    case 'snooze':
      // Snooze meeting reminder
      setTimeout(() => {
        api.ui.showNotification({
          title: '🕐 Meeting Starting Now',
          body: 'Your Teams meeting is starting',
          actions: [
            { action: 'join-now', title: 'Join Now' }
          ],
          data: data
        });
      }, 2 * 60 * 1000); // 2 minutes
      break;
      
    default:
      api.logger.warn(`Unhandled notification action: ${action}`);
  }
}

/**
 * Cleanup background services
 */
async function cleanup(api) {
  try {
    if (teamsPlugin) {
      await teamsPlugin.disconnect();
    }
    
    api.logger.info('Teams background script cleaned up');
  } catch (error) {
    api.logger.error('Error during Teams background cleanup:', error);
  }
}

// Export functions for the plugin system
export {
  initializeBackground,
  handleNotificationAction,
  cleanup
};

// Auto-initialize if this script is loaded in a background context
if (typeof self !== 'undefined' && self.addEventListener) {
  self.addEventListener('message', async (event) => {
    const { type, data } = event.data;
    
    switch (type) {
      case 'initialize':
        await initializeBackground(data.api);
        break;
        
      case 'notification-action':
        await handleNotificationAction(data.api, data.action, data.data);
        break;
        
      case 'cleanup':
        await cleanup(data.api);
        break;
    }
  });
}