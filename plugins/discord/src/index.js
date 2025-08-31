/**
 * Discord Plugin Entry Point
 * 
 * Main entry point for the Discord plugin integration
 */

import { DiscordPlugin } from './DiscordPlugin';

let discordPlugin;

/**
 * Plugin initialization function called by Flow Desk
 * @param {PluginAPI} api - The plugin API instance
 */
export async function initialize(api) {
  try {
    api.logger.info('Initializing Discord plugin...');
    
    discordPlugin = new DiscordPlugin(api);
    await discordPlugin.initialize();
    
    // Register commands
    registerCommands(api);
    
    // Set up event listeners
    setupEventListeners(api);
    
    api.logger.info('Discord plugin initialized successfully');
  } catch (error) {
    api.logger.error('Failed to initialize Discord plugin:', error);
    throw error;
  }
}

/**
 * Plugin cleanup function called by Flow Desk
 */
export async function cleanup() {
  try {
    if (discordPlugin) {
      await discordPlugin.disconnect();
    }
  } catch (error) {
    console.error('Error during Discord plugin cleanup:', error);
  }
}

/**
 * Get plugin status
 */
export function getStatus() {
  return {
    connected: discordPlugin && discordPlugin.authTokens !== null,
    initialized: discordPlugin && discordPlugin.isInitialized,
    version: '1.0.0'
  };
}

/**
 * Register Discord-specific commands
 */
function registerCommands(api) {
  // Connect to Discord command
  api.ui.addCommand({
    id: 'discord.connect',
    title: 'Connect to Discord',
    description: 'Authenticate and connect to Discord',
    icon: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a69f118df70ad7828d4_icon_clyde_blurple_RGB.svg',
    handler: async () => {
      try {
        if (!discordPlugin) {
          throw new Error('Discord plugin not initialized');
        }
        await discordPlugin.authenticate();
      } catch (error) {
        api.ui.showNotification({
          title: 'Discord Connection Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });

  // Quick send message command
  api.ui.addCommand({
    id: 'discord.quick-message',
    title: 'Send Discord Message',
    description: 'Quickly send a message to a Discord channel',
    shortcut: 'Cmd+Shift+D',
    handler: async () => {
      try {
        if (!discordPlugin) {
          throw new Error('Discord plugin not initialized');
        }

        const result = await api.ui.showDialog({
          title: 'Send Discord Message',
          content: `
            <div class="discord-quick-message">
              <div class="form-group">
                <label for="channel-id">Channel ID:</label>
                <input type="text" id="channel-id" placeholder="Channel or DM ID" required />
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
          const channelId = document.getElementById('channel-id').value;
          const message = document.getElementById('message').value;

          if (channelId && message) {
            await discordPlugin.sendMessage(channelId, message);
            api.ui.showNotification({
              title: 'Message Sent',
              body: 'Your Discord message has been sent successfully',
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

  // Join voice channel command
  api.ui.addCommand({
    id: 'discord.join-voice',
    title: 'Join Discord Voice Channel',
    description: 'Join a Discord voice channel',
    handler: async () => {
      try {
        if (!discordPlugin) {
          throw new Error('Discord plugin not initialized');
        }

        const result = await api.ui.showDialog({
          title: 'Join Voice Channel',
          content: `
            <div class="discord-join-voice">
              <div class="form-group">
                <label for="guild-id">Server ID:</label>
                <input type="text" id="guild-id" placeholder="Discord server ID" required />
              </div>
              <div class="form-group">
                <label for="voice-channel-id">Voice Channel ID:</label>
                <input type="text" id="voice-channel-id" placeholder="Voice channel ID" required />
              </div>
              <div class="form-group">
                <label><input type="checkbox" id="mute" /> Join muted</label>
                <label><input type="checkbox" id="deaf" /> Join deafened</label>
              </div>
            </div>
          `,
          buttons: [
            { label: 'Cancel', value: null },
            { label: 'Join', value: 'join', variant: 'primary' }
          ]
        });

        if (result === 'join') {
          const guildId = document.getElementById('guild-id').value;
          const channelId = document.getElementById('voice-channel-id').value;
          const mute = document.getElementById('mute').checked;
          const deaf = document.getElementById('deaf').checked;

          if (guildId && channelId) {
            await discordPlugin.joinVoiceChannel(guildId, channelId, mute, deaf);
          }
        }
      } catch (error) {
        api.ui.showNotification({
          title: 'Join Voice Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });

  // Update status command
  api.ui.addCommand({
    id: 'discord.update-status',
    title: 'Update Discord Status',
    description: 'Update your Discord presence status',
    handler: async () => {
      try {
        if (!discordPlugin) {
          throw new Error('Discord plugin not initialized');
        }

        const result = await api.ui.showDialog({
          title: 'Update Discord Status',
          content: `
            <div class="discord-update-status">
              <div class="form-group">
                <label for="status">Status:</label>
                <select id="status" required>
                  <option value="online">Online</option>
                  <option value="idle">Idle</option>
                  <option value="dnd">Do Not Disturb</option>
                  <option value="invisible">Invisible</option>
                </select>
              </div>
              <div class="form-group">
                <label for="activity-name">Activity Name:</label>
                <input type="text" id="activity-name" placeholder="What are you doing?" />
              </div>
              <div class="form-group">
                <label for="activity-type">Activity Type:</label>
                <select id="activity-type">
                  <option value="0">Playing</option>
                  <option value="1">Streaming</option>
                  <option value="2">Listening to</option>
                  <option value="3">Watching</option>
                  <option value="4">Custom</option>
                  <option value="5">Competing in</option>
                </select>
              </div>
            </div>
          `,
          buttons: [
            { label: 'Cancel', value: null },
            { label: 'Update', value: 'update', variant: 'primary' }
          ]
        });

        if (result === 'update') {
          const status = document.getElementById('status').value;
          const activityName = document.getElementById('activity-name').value;
          const activityType = parseInt(document.getElementById('activity-type').value);

          const activity = activityName ? {
            name: activityName,
            type: activityType
          } : undefined;

          await discordPlugin.updatePresence(status, activity);
          api.ui.showNotification({
            title: 'Status Updated',
            body: `Discord status updated to ${status}`,
            timeout: 3000
          });
        }
      } catch (error) {
        api.ui.showNotification({
          title: 'Update Status Failed',
          body: error.message,
          timeout: 5000
        });
      }
    }
  });
}

/**
 * Set up event listeners for the Discord plugin
 */
function setupEventListeners(api) {
  // Handle notification actions
  api.events.on('notification-action', async (data) => {
    const { action, notificationId } = data;
    
    switch (action) {
      case 'reply':
        // Open reply interface
        break;
      case 'view':
        // Open Discord or channel
        break;
    }
  });

  // Handle gateway events
  api.events.on('discord-message-received', async (data) => {
    // Handle new Discord message
  });

  api.events.on('discord-voice-state-update', async (data) => {
    // Handle voice state changes
  });
}

// Export plugin metadata
export const pluginInfo = {
  id: 'com.flowdesk.discord',
  name: 'Discord',
  version: '1.0.0',
  description: 'Complete Discord integration with real-time messaging, voice channels, and automation',
  author: 'Flow Desk Team',
  capabilities: [
    'real-time messaging',
    'voice channel integration',
    'OAuth2 authentication', 
    'search integration',
    'automation triggers',
    'rich presence',
    'bot interactions',
    'webhook notifications'
  ]
};