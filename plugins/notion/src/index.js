/**
 * Notion Plugin Entry Point
 * Main entry point for the Notion plugin with lifecycle management
 */

import { NotionPlugin } from './NotionPlugin.js';

class NotionPluginEntry {
  constructor() {
    this.plugin = null;
    this.isActive = false;
  }

  // Plugin lifecycle methods
  async activate(api, context) {
    try {
      console.log('Activating Notion plugin...');
      
      this.plugin = new NotionPlugin(api, context);
      await this.plugin.onActivate();
      
      this.isActive = true;
      
      // Expose public API to global scope for panel access
      if (typeof window !== 'undefined') {
        window.notionPlugin = this.plugin.getPublicAPI();
      }
      
      console.log('Notion plugin activated successfully');
      return true;
    } catch (error) {
      console.error('Failed to activate Notion plugin:', error);
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
        delete window.notionPlugin;
      }
      
      console.log('Notion plugin deactivated');
      return true;
    } catch (error) {
      console.error('Failed to deactivate Notion plugin:', error);
      return false;
    }
  }

  async onConfigChanged(newConfig) {
    if (this.plugin) {
      try {
        await this.plugin.onConfigChanged(newConfig);
        console.log('Notion plugin config updated');
      } catch (error) {
        console.error('Failed to update Notion plugin config:', error);
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
      id: 'com.flowdesk.notion',
      name: 'Notion',
      version: '2.0.0',
      active: this.isActive,
      healthy: this.isHealthy()
    };
  }
}

// Create and export plugin instance
const notionPluginEntry = new NotionPluginEntry();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = notionPluginEntry;
} else if (typeof define === 'function' && define.amd) {
  // AMD
  define(() => notionPluginEntry);
} else {
  // Global
  window.NotionPlugin = notionPluginEntry;
}

// Auto-activate if API is already available
if (typeof window !== 'undefined' && window.pluginAPI && window.pluginContext) {
  notionPluginEntry.activate(window.pluginAPI, window.pluginContext);
}