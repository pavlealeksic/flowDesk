/**
 * Slack Plugin Entry Point
 * Main entry point for the Slack plugin with lifecycle management
 */

import { SlackPlugin } from './SlackPlugin.js';

class SlackPluginEntry {
  constructor() {
    this.plugin = null;
    this.isActive = false;
  }

  // Plugin lifecycle methods
  async activate(api, context) {
    try {
      console.log('Activating Slack plugin...');
      
      this.plugin = new SlackPlugin(api, context);
      await this.plugin.onActivate();
      
      this.isActive = true;
      
      // Expose public API to global scope for panel access
      if (typeof window !== 'undefined') {
        window.slackPlugin = this.plugin.getPublicAPI();
      }
      
      console.log('Slack plugin activated successfully');
      return true;
    } catch (error) {
      console.error('Failed to activate Slack plugin:', error);
      return false;
    }
  }

  async deactivate() {
    try {
      if (this.plugin) {
        await this.plugin.onDeactivate();
        this.plugin = null;
      }
      
      this.isActive = false;
      
      // Clean up global API
      if (typeof window !== 'undefined') {
        delete window.slackPlugin;
      }
      
      console.log('Slack plugin deactivated');
      return true;
    } catch (error) {
      console.error('Failed to deactivate Slack plugin:', error);
      return false;
    }
  }

  async onConfigChanged(newConfig) {
    if (this.plugin) {
      try {
        await this.plugin.onConfigChanged(newConfig);
        console.log('Slack plugin config updated');
      } catch (error) {
        console.error('Failed to update Slack plugin config:', error);
      }
    }
  }

  // Health check
  isHealthy() {
    return this.isActive && this.plugin !== null;
  }

  // Get plugin info
  getInfo() {
    return {
      id: 'com.flowdesk.slack',
      name: 'Slack',
      version: '2.0.0',
      active: this.isActive,
      healthy: this.isHealthy()
    };
  }
}

// Create and export plugin instance
const slackPluginEntry = new SlackPluginEntry();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = slackPluginEntry;
} else if (typeof define === 'function' && define.amd) {
  // AMD
  define(() => slackPluginEntry);
} else {
  // Global
  window.SlackPlugin = slackPluginEntry;
}

// Auto-activate if API is already available
if (typeof window !== 'undefined' && window.pluginAPI && window.pluginContext) {
  slackPluginEntry.activate(window.pluginAPI, window.pluginContext);
}