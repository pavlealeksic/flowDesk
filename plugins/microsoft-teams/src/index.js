/**
 * Microsoft Teams Plugin Entry Point
 * 
 * Main entry point for the Microsoft Teams plugin integration
 */

import { TeamsPlugin } from './TeamsPlugin';

let teamsPlugin;

/**
 * Plugin initialization function called by Flow Desk
 * @param {PluginAPI} api - The plugin API instance
 */
export async function initialize(api) {
  try {
    api.logger.info('Initializing Microsoft Teams plugin...');
    
    teamsPlugin = new TeamsPlugin(api);
    await teamsPlugin.initialize();
    
    // Register commands
    registerCommands(api);
    
    // Set up event listeners
    setupEventListeners(api);
    
    api.logger.info('Microsoft Teams plugin initialized successfully');
  } catch (error) {
    api.logger.error('Failed to initialize Microsoft Teams plugin:', error);
    throw error;
  }
}

/**
 * Plugin cleanup function called by Flow Desk
 */
export async function cleanup() {
  try {
    if (teamsPlugin) {
      await teamsPlugin.disconnect();
    }
  } catch (error) {
    console.error('Error during Teams plugin cleanup:', error);
  }
}

/**
 * Get plugin status
 */
export function getStatus() {
  return {
    connected: teamsPlugin && teamsPlugin.authTokens !== null,
    initialized: teamsPlugin && teamsPlugin.isInitialized,
    version: '1.0.0'
  };
}

/**
 * Register Teams-specific commands
 */
function registerCommands(api) {
  // Connect to Teams command
  api.ui.addCommand({
    id: 'teams.connect',
    title: 'Connect to Microsoft Teams',
    description: 'Authenticate and connect to Microsoft Teams',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
    handler: async () => {
      try {
        if (!teamsPlugin) {
          throw new Error('Teams plugin not initialized');
        }
        await teamsPlugin.authenticate();
      } catch (error) {
        api.ui.showNotification({
          title: 'Teams Connection Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });

  // Disconnect from Teams command
  api.ui.addCommand({
    id: 'teams.disconnect',
    title: 'Disconnect from Microsoft Teams',
    description: 'Disconnect from Microsoft Teams',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
    handler: async () => {
      try {
        if (!teamsPlugin) {
          throw new Error('Teams plugin not initialized');
        }
        await teamsPlugin.disconnect();
        api.ui.showNotification({
          title: 'Teams Disconnected',
          body: 'Successfully disconnected from Microsoft Teams',
          timeout: 3000
        });
      } catch (error) {
        api.ui.showNotification({
          title: 'Teams Disconnection Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });

  // Quick send message command
  api.ui.addCommand({
    id: 'teams.quick-message',
    title: 'Send Teams Message',
    description: 'Quickly send a message to a Teams channel or chat',
    shortcut: 'Cmd+Shift+T',
    handler: async () => {
      try {
        if (!teamsPlugin) {
          throw new Error('Teams plugin not initialized');
        }

        const result = await api.ui.showDialog({
          title: 'Send Teams Message',
          content: `
            <div class="teams-quick-message">
              <div class="form-group">
                <label for="target-type">Target Type:</label>
                <select id="target-type" required>
                  <option value="channel">Channel</option>
                  <option value="chat">Chat</option>
                </select>
              </div>
              <div class="form-group">
                <label for="target-id">Target ID:</label>
                <input type="text" id="target-id" placeholder="Channel or Chat ID" required />
              </div>
              <div class="form-group">
                <label for="message">Message:</label>
                <textarea id="message" placeholder="Type your message here..." rows="4" required></textarea>
              </div>
            </div>
          `,
          buttons: [
            { label: 'Cancel', value: null },
            { label: 'Send', value: 'send', variant: 'primary' }
          ]
        });

        if (result === 'send') {
          const targetType = document.getElementById('target-type').value;
          const targetId = document.getElementById('target-id').value;
          const message = document.getElementById('message').value;

          if (targetId && message) {
            await teamsPlugin.sendMessage(targetId, message, targetType);
            api.ui.showNotification({
              title: 'Message Sent',
              body: 'Your message has been sent successfully',
              timeout: 3000
            });
          }
        }
      } catch (error) {
        api.ui.showNotification({
          title: 'Send Message Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });

  // Create meeting command
  api.ui.addCommand({
    id: 'teams.create-meeting',
    title: 'Create Teams Meeting',
    description: 'Create a new Microsoft Teams meeting',
    handler: async () => {
      try {
        if (!teamsPlugin) {
          throw new Error('Teams plugin not initialized');
        }

        const result = await api.ui.showDialog({
          title: 'Create Teams Meeting',
          content: `
            <div class="teams-create-meeting">
              <div class="form-group">
                <label for="subject">Subject:</label>
                <input type="text" id="subject" placeholder="Meeting subject" required />
              </div>
              <div class="form-group">
                <label for="start-time">Start Time:</label>
                <input type="datetime-local" id="start-time" required />
              </div>
              <div class="form-group">
                <label for="end-time">End Time:</label>
                <input type="datetime-local" id="end-time" required />
              </div>
            </div>
          `,
          buttons: [
            { label: 'Cancel', value: null },
            { label: 'Create', value: 'create', variant: 'primary' }
          ]
        });

        if (result === 'create') {
          const subject = document.getElementById('subject').value;
          const startTime = new Date(document.getElementById('start-time').value);
          const endTime = new Date(document.getElementById('end-time').value);

          if (subject && startTime && endTime) {
            const meeting = await teamsPlugin.createOnlineMeeting({
              subject,
              startDateTime: startTime,
              endDateTime: endTime
            });

            api.ui.showNotification({
              title: 'Meeting Created',
              body: `Meeting "${subject}" created successfully`,
              actions: [
                { action: 'copy-link', title: 'Copy Link' },
                { action: 'open', title: 'Open' }
              ],
              timeout: 10000
            });
          }
        }
      } catch (error) {
        api.ui.showNotification({
          title: 'Create Meeting Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });

  // Update presence command
  api.ui.addCommand({
    id: 'teams.update-presence',
    title: 'Update Teams Presence',
    description: 'Update your Microsoft Teams presence status',
    handler: async () => {
      try {
        if (!teamsPlugin) {
          throw new Error('Teams plugin not initialized');
        }

        const result = await api.ui.showDialog({
          title: 'Update Teams Presence',
          content: `
            <div class="teams-update-presence">
              <div class="form-group">
                <label for="availability">Availability:</label>
                <select id="availability" required>
                  <option value="Available">Available</option>
                  <option value="Busy">Busy</option>
                  <option value="DoNotDisturb">Do Not Disturb</option>
                  <option value="BeRightBack">Be Right Back</option>
                  <option value="Away">Away</option>
                </select>
              </div>
              <div class="form-group">
                <label for="activity">Activity:</label>
                <input type="text" id="activity" placeholder="What are you doing?" required />
              </div>
              <div class="form-group">
                <label for="message">Status Message (optional):</label>
                <input type="text" id="message" placeholder="Custom status message" />
              </div>
            </div>
          `,
          buttons: [
            { label: 'Cancel', value: null },
            { label: 'Update', value: 'update', variant: 'primary' }
          ]
        });

        if (result === 'update') {
          const availability = document.getElementById('availability').value;
          const activity = document.getElementById('activity').value;
          const message = document.getElementById('message').value;

          if (availability && activity) {
            await teamsPlugin.updatePresence(availability, activity, message || undefined);
            api.ui.showNotification({
              title: 'Presence Updated',
              body: `Status updated to ${availability}: ${activity}`,
              timeout: 3000
            });
          }
        }
      } catch (error) {
        api.ui.showNotification({
          title: 'Update Presence Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });

  // Search Teams command
  api.ui.addCommand({
    id: 'teams.search',
    title: 'Search Microsoft Teams',
    description: 'Search across Teams messages, channels, and teams',
    shortcut: 'Cmd+Shift+F',
    handler: async () => {
      try {
        if (!teamsPlugin) {
          throw new Error('Teams plugin not initialized');
        }

        const query = await api.ui.showDialog({
          title: 'Search Microsoft Teams',
          content: `
            <div class="teams-search">
              <div class="form-group">
                <label for="search-query">Search Query:</label>
                <input type="text" id="search-query" placeholder="Enter your search terms..." required />
              </div>
              <div class="form-group">
                <label>Content Types:</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" id="messages" value="message" checked /> Messages</label>
                  <label><input type="checkbox" id="channels" value="channel" checked /> Channels</label>
                  <label><input type="checkbox" id="teams" value="team" checked /> Teams</label>
                  <label><input type="checkbox" id="chats" value="chat" checked /> Chats</label>
                </div>
              </div>
            </div>
          `,
          buttons: [
            { label: 'Cancel', value: null },
            { label: 'Search', value: 'search', variant: 'primary' }
          ]
        });

        if (query === 'search') {
          const searchQuery = document.getElementById('search-query').value;
          const contentTypes = [];
          
          if (document.getElementById('messages').checked) contentTypes.push('message');
          if (document.getElementById('channels').checked) contentTypes.push('channel');
          if (document.getElementById('teams').checked) contentTypes.push('team');
          if (document.getElementById('chats').checked) contentTypes.push('chat');

          if (searchQuery && contentTypes.length > 0) {
            const results = await teamsPlugin.search(searchQuery, contentTypes);
            
            // Display results in a new panel
            const panel = await api.ui.createPanel({
              title: `Teams Search Results: ${searchQuery}`,
              icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
              location: 'sidebar',
              content: generateSearchResultsHTML(results),
              resizable: true
            });

            panel.show();
          }
        }
      } catch (error) {
        api.ui.showNotification({
          title: 'Search Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });
}

/**
 * Set up event listeners for the Teams plugin
 */
function setupEventListeners(api) {
  // Handle notification actions
  api.events.on('notification-action', async (data) => {
    const { action, notificationId } = data;
    
    switch (action) {
      case 'copy-link':
        // Copy meeting link to clipboard
        break;
      case 'open':
        // Open meeting or Teams app
        break;
      case 'join':
        // Join meeting directly
        break;
    }
  });

  // Handle webhook events
  api.events.on('teams-webhook', async (data) => {
    const { type, payload } = data;
    
    switch (type) {
      case 'message':
        await handleMessageNotification(api, payload);
        break;
      case 'presence':
        await handlePresenceUpdate(api, payload);
        break;
      case 'calendar':
        await handleCalendarEvent(api, payload);
        break;
    }
  });
}

/**
 * Handle incoming message notifications
 */
async function handleMessageNotification(api, message) {
  // Check if notifications are enabled
  if (!teamsPlugin || !teamsPlugin.config.enableNotifications) {
    return;
  }

  const notificationTypes = teamsPlugin.config.notificationTypes;
  
  // Check if this message type should trigger a notification
  let shouldNotify = false;
  
  if (message.mentions && message.mentions.length > 0) {
    shouldNotify = notificationTypes.includes('mentions');
  } else if (message.chatId) {
    shouldNotify = notificationTypes.includes('direct-messages');
  } else if (message.channelIdentity) {
    shouldNotify = notificationTypes.includes('channel-messages');
  }

  if (shouldNotify) {
    api.ui.showNotification({
      title: `New Teams Message`,
      body: `${message.from.user?.displayName}: ${message.body.content.substring(0, 100)}...`,
      icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
      actions: [
        { action: 'reply', title: 'Reply' },
        { action: 'view', title: 'View' }
      ]
    });
  }

  // Trigger automation
  api.events.emit('teams-message-received', { data: message });
}

/**
 * Handle presence updates
 */
async function handlePresenceUpdate(api, presence) {
  // Trigger automation
  api.events.emit('teams-presence-changed', { data: presence });
}

/**
 * Handle calendar events
 */
async function handleCalendarEvent(api, event) {
  if (event.changeType === 'created' && event.isOnlineMeeting) {
    const shouldNotify = teamsPlugin.config.notificationTypes.includes('meeting-invites');
    
    if (shouldNotify) {
      api.ui.showNotification({
        title: 'New Teams Meeting',
        body: `Meeting: ${event.subject}`,
        actions: [
          { action: 'join', title: 'Join' },
          { action: 'copy-link', title: 'Copy Link' }
        ]
      });
    }
  }

  // Trigger automation
  api.events.emit('teams-calendar-event', { data: event });
}

/**
 * Generate HTML for search results
 */
function generateSearchResultsHTML(results) {
  if (results.length === 0) {
    return '<div class="no-results">No results found</div>';
  }

  return `
    <div class="search-results">
      <div class="results-count">${results.length} result(s) found</div>
      ${results.map(result => `
        <div class="result-item" data-id="${result.id}">
          <div class="result-header">
            <span class="result-type">${result.contentType}</span>
            <span class="result-score">${Math.round(result.score * 100)}%</span>
          </div>
          <div class="result-title">${result.title}</div>
          <div class="result-description">${result.description}</div>
          <div class="result-meta">
            <span class="result-date">${new Date(result.timestamp).toLocaleString()}</span>
            ${result.author ? `<span class="result-author">${result.author.displayName}</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Export plugin metadata
export const pluginInfo = {
  id: 'com.flowdesk.microsoft-teams',
  name: 'Microsoft Teams',
  version: '1.0.0',
  description: 'Complete Microsoft Teams integration with real-time messaging, OAuth2, search, and automation',
  author: 'Flow Desk Team',
  capabilities: [
    'real-time messaging',
    'OAuth2 authentication', 
    'search integration',
    'automation triggers',
    'presence management',
    'meeting creation',
    'webhook notifications'
  ]
};