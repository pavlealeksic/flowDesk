/**
 * Plugin Preload Script - Provides secure bridge between plugin UI and main process
 * 
 * This preload script runs in the plugin's renderer process and provides
 * a secure interface to communicate with the main process while maintaining
 * the security sandbox.
 */

const { contextBridge, ipcRenderer } = require('electron');
import { createLogger } from '../shared/logging/LoggerFactory';

// Security check - ensure we're in the right context
if (!process.contextIsolated) {
  throw new Error('Plugin preload script requires context isolation');
}

/**
 * Plugin API exposed to the renderer process
 */
const pluginAPI = {
  // Plugin information
  getPluginInfo: () => ipcRenderer.invoke('plugin:getInfo'),
  
  // Storage API
  storage: {
    get: (key) => ipcRenderer.invoke('plugin:storage:get', key),
    set: (key, value) => ipcRenderer.invoke('plugin:storage:set', key, value),
    remove: (key) => ipcRenderer.invoke('plugin:storage:remove', key),
    clear: () => ipcRenderer.invoke('plugin:storage:clear'),
    keys: () => ipcRenderer.invoke('plugin:storage:keys'),
    getUsage: () => ipcRenderer.invoke('plugin:storage:getUsage')
  },

  // Events API
  events: {
    emit: (type, data) => ipcRenderer.send('plugin:events:emit', type, data),
    on: (type, callback) => {
      const wrappedCallback = (event, data) => callback(data);
      ipcRenderer.on(`plugin:events:${type}`, wrappedCallback);
      
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(`plugin:events:${type}`, wrappedCallback);
      };
    },
    off: (type, callback) => {
      // Note: This is simplified - in production you'd need better listener management
      ipcRenderer.removeAllListeners(`plugin:events:${type}`);
    },
    once: (type, callback) => {
      const wrappedCallback = (event, data) => callback(data);
      ipcRenderer.once(`plugin:events:${type}`, wrappedCallback);
    }
  },

  // UI API
  ui: {
    showNotification: (options) => ipcRenderer.invoke('plugin:ui:showNotification', options),
    showDialog: (options) => ipcRenderer.invoke('plugin:ui:showDialog', options),
    addCommand: (command) => ipcRenderer.invoke('plugin:ui:addCommand', command),
    removeCommand: (commandId) => ipcRenderer.invoke('plugin:ui:removeCommand', commandId),
    addMenuItem: (item) => ipcRenderer.invoke('plugin:ui:addMenuItem', item),
    showContextMenu: (items) => ipcRenderer.invoke('plugin:ui:showContextMenu', items),
    
    // Theme API
    getTheme: () => ipcRenderer.invoke('plugin:ui:getTheme'),
    onThemeChange: (callback) => {
      const wrappedCallback = (event, theme) => callback(theme);
      ipcRenderer.on('plugin:ui:themeChanged', wrappedCallback);
      return () => ipcRenderer.removeListener('plugin:ui:themeChanged', wrappedCallback);
    }
  },

  // Network API (if permitted)
  network: {
    fetch: (url, options) => ipcRenderer.invoke('plugin:network:fetch', url, options),
    websocket: (url) => ipcRenderer.invoke('plugin:network:websocket', url)
  },

  // Logger API
  logger: {
    debug: (message, ...args) => ipcRenderer.send('plugin:logger:debug', message, args),
    info: (message, ...args) => ipcRenderer.send('plugin:logger:info', message, args),
    warn: (message, ...args) => ipcRenderer.send('plugin:logger:warn', message, args),
    error: (message, ...args) => ipcRenderer.send('plugin:logger:error', message, args)
  },

  // Lifecycle API
  lifecycle: {
    ready: () => ipcRenderer.send('plugin:lifecycle:ready'),
    unload: () => ipcRenderer.send('plugin:lifecycle:unload'),
    onUnload: (callback) => {
      ipcRenderer.on('plugin:lifecycle:unload', callback);
      return () => ipcRenderer.removeListener('plugin:lifecycle:unload', callback);
    }
  },

  // Security API
  security: {
    sanitizeHTML: (html) => ipcRenderer.invoke('plugin:security:sanitizeHTML', html),
    validateCSP: (csp) => ipcRenderer.invoke('plugin:security:validateCSP', csp)
  }
};

/**
 * Flow Desk UI Components - Styled components that match the main app
 */
const flowDeskUI = {
  // Create a styled button
  createButton: (options = {}) => {
    const button = document.createElement('button');
    button.className = `
      inline-flex items-center justify-center rounded-md text-sm font-medium 
      transition-colors focus-visible:outline-none focus-visible:ring-2 
      focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 
      disabled:pointer-events-none ring-offset-background
      ${options.variant === 'outline' 
        ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground' 
        : 'bg-primary text-primary-foreground hover:bg-primary/90'
      }
      ${options.size === 'sm' 
        ? 'h-9 px-3' 
        : options.size === 'lg' 
        ? 'h-11 px-8' 
        : 'h-10 px-4 py-2'
      }
    `.replace(/\s+/g, ' ').trim();
    
    button.textContent = options.text || 'Button';
    
    if (options.onClick) {
      button.addEventListener('click', options.onClick);
    }
    
    return button;
  },

  // Create a styled input
  createInput: (options = {}) => {
    const input = document.createElement('input');
    input.className = `
      flex h-10 w-full rounded-md border border-input bg-background 
      px-3 py-2 text-sm ring-offset-background file:border-0 
      file:bg-transparent file:text-sm file:font-medium 
      placeholder:text-muted-foreground focus-visible:outline-none 
      focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
      disabled:cursor-not-allowed disabled:opacity-50
    `.replace(/\s+/g, ' ').trim();
    
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.value) input.value = options.value;
    if (options.type) input.type = options.type;
    
    return input;
  },

  // Create a styled card
  createCard: (options = {}) => {
    const card = document.createElement('div');
    card.className = 'rounded-lg border bg-card text-card-foreground shadow-sm';
    
    if (options.padding !== false) {
      card.classList.add('p-6');
    }
    
    if (options.title) {
      const header = document.createElement('div');
      header.className = 'flex flex-col space-y-1.5 p-6';
      
      const title = document.createElement('h3');
      title.className = 'text-2xl font-semibold leading-none tracking-tight';
      title.textContent = options.title;
      header.appendChild(title);
      
      if (options.description) {
        const desc = document.createElement('p');
        desc.className = 'text-sm text-muted-foreground';
        desc.textContent = options.description;
        header.appendChild(desc);
      }
      
      card.appendChild(header);
      
      if (options.content) {
        const content = document.createElement('div');
        content.className = 'p-6 pt-0';
        if (typeof options.content === 'string') {
          content.innerHTML = options.content;
        } else {
          content.appendChild(options.content);
        }
        card.appendChild(content);
      }
    } else if (options.content) {
      if (typeof options.content === 'string') {
        card.innerHTML = options.content;
      } else {
        card.appendChild(options.content);
      }
    }
    
    return card;
  },

  // Create a notification/toast
  createNotification: (options = {}) => {
    const notification = document.createElement('div');
    notification.className = `
      fixed top-4 right-4 z-50 w-96 rounded-md border bg-background 
      p-4 shadow-lg transition-all duration-300 transform
      ${options.type === 'error' 
        ? 'border-destructive/50 text-destructive' 
        : options.type === 'warning'
        ? 'border-yellow-500/50 text-yellow-600'
        : options.type === 'success'
        ? 'border-green-500/50 text-green-600'
        : 'border-border'
      }
    `.replace(/\s+/g, ' ').trim();
    
    const title = document.createElement('div');
    title.className = 'font-medium';
    title.textContent = options.title || 'Notification';
    
    const message = document.createElement('div');
    message.className = 'mt-1 text-sm opacity-90';
    message.textContent = options.message || '';
    
    notification.appendChild(title);
    if (options.message) notification.appendChild(message);
    
    // Auto-remove after delay
    const delay = options.duration || 4000;
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, delay);
    
    return notification;
  },

  // Show notification
  showNotification: (options) => {
    const notification = flowDeskUI.createNotification(options);
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    return notification;
  }
};

// Expose secure API to plugin context
contextBridge.exposeInMainWorld('FlowDeskAPI', pluginAPI);
contextBridge.exposeInMainWorld('FlowDeskUI', flowDeskUI);

// Provide some polyfills for common APIs
contextBridge.exposeInMainWorld('addEventListener', (event, callback) => {
  window.addEventListener(event, callback);
});

contextBridge.exposeInMainWorld('removeEventListener', (event, callback) => {
  window.removeEventListener(event, callback);
});

// Initialize plugin environment
document.addEventListener('DOMContentLoaded', () => {
  // Apply Flow Desk theme classes to plugin document
  document.body.classList.add('flow-desk-plugin');
  
  // Set up CSS custom properties for theming
  const root = document.documentElement;
  root.style.setProperty('--background', '0 0% 100%');
  root.style.setProperty('--foreground', '222.2 84% 4.9%');
  root.style.setProperty('--card', '0 0% 100%');
  root.style.setProperty('--card-foreground', '222.2 84% 4.9%');
  root.style.setProperty('--popover', '0 0% 100%');
  root.style.setProperty('--popover-foreground', '222.2 84% 4.9%');
  root.style.setProperty('--primary', '222.2 47.4% 11.2%');
  root.style.setProperty('--primary-foreground', '210 40% 98%');
  root.style.setProperty('--secondary', '210 40% 96%');
  root.style.setProperty('--secondary-foreground', '222.2 84% 4.9%');
  root.style.setProperty('--muted', '210 40% 96%');
  root.style.setProperty('--muted-foreground', '215.4 16.3% 46.9%');
  root.style.setProperty('--accent', '210 40% 96%');
  root.style.setProperty('--accent-foreground', '222.2 84% 4.9%');
  root.style.setProperty('--destructive', '0 84.2% 60.2%');
  root.style.setProperty('--destructive-foreground', '210 40% 98%');
  root.style.setProperty('--border', '214.3 31.8% 91.4%');
  root.style.setProperty('--input', '214.3 31.8% 91.4%');
  root.style.setProperty('--ring', '222.2 84% 4.9%');
  root.style.setProperty('--radius', '0.5rem');
  
  // Load theme and apply dark mode if needed
  pluginAPI.ui.getTheme().then(theme => {
    if (theme.mode === 'dark') {
      root.classList.add('dark');
      // Update CSS custom properties for dark mode
      root.style.setProperty('--background', '222.2 84% 4.9%');
      root.style.setProperty('--foreground', '210 40% 98%');
      // ... (other dark mode properties would be set here)
    }
  });
  
  // Listen for theme changes
  pluginAPI.ui.onThemeChange(theme => {
    if (theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  });

  // Notify that plugin is ready
  pluginAPI.lifecycle.ready();
});

// Handle unload cleanup
window.addEventListener('beforeunload', () => {
  pluginAPI.lifecycle.unload();
});

// Error handling
window.addEventListener('error', (event) => {
  pluginAPI.logger.error('Plugin error:', event.error?.message || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  pluginAPI.logger.error('Unhandled promise rejection:', event.reason);
});

logger.debug('Console log', undefined, { originalArgs: ['Flow Desk Plugin Environment Loaded'], method: 'console.log' });