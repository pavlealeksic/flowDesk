/**
 * Plugin Event Bus - Manages inter-plugin communication and system events
 * 
 * Provides a secure, typed event system for plugins to communicate with
 * each other and with the main application.
 */

import { EventEmitter } from 'events';
import { PluginLogger } from '../utils/PluginLogger';

export interface PluginEvent {
  /** Event type/name */
  type: string;
  /** Event data payload */
  data: any;
  /** Source plugin ID */
  source: string;
  /** Target plugin ID (optional, for direct messaging) */
  target?: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event ID for tracking */
  id: string;
  /** Event metadata */
  metadata?: Record<string, any>;
}

export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Plugin ID that subscribed */
  pluginId: string;
  /** Event type pattern */
  eventType: string;
  /** Event handler */
  handler: (event: PluginEvent) => void;
  /** Subscription options */
  options: EventSubscriptionOptions;
}

export interface EventSubscriptionOptions {
  /** Only receive events from specific plugins */
  fromPlugins?: string[];
  /** Ignore events from specific plugins */
  ignorePlugins?: string[];
  /** Filter events by data properties */
  filter?: (data: any) => boolean;
  /** Maximum number of events to receive */
  maxEvents?: number;
  /** Auto-unsubscribe after timeout (ms) */
  timeout?: number;
  /** Priority level (higher priority handlers execute first) */
  priority?: number;
}

export interface EventPermission {
  /** Plugin ID */
  pluginId: string;
  /** Allowed event types to emit (patterns supported) */
  canEmit: string[];
  /** Allowed event types to listen to (patterns supported) */
  canListen: string[];
  /** Can listen to system events */
  canListenSystem: boolean;
  /** Can emit system events */
  canEmitSystem: boolean;
}

/**
 * Plugin Event Bus
 * 
 * Secure event system for plugin communication with permission controls.
 */
export class PluginEventBus extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly subscriptions = new Map<string, EventSubscription>();
  private readonly permissions = new Map<string, EventPermission>();
  private readonly eventHistory: PluginEvent[] = [];
  private readonly maxHistorySize = 1000;
  private eventIdCounter = 0;

  constructor() {
    super();
    this.logger = new PluginLogger('PluginEventBus');
    
    // Set max listeners to avoid warnings
    this.setMaxListeners(1000);
  }

  /**
   * Set event permissions for a plugin
   */
  setPluginPermissions(pluginId: string, permissions: Omit<EventPermission, 'pluginId'>): void {
    this.permissions.set(pluginId, {
      pluginId,
      ...permissions
    });
    
    this.logger.debug(`Set permissions for plugin ${pluginId}`, permissions);
  }

  /**
   * Emit an event from a plugin
   */
  emitPluginEvent(
    sourcePluginId: string,
    eventType: string,
    data: any,
    options: { target?: string; metadata?: Record<string, any> } = {}
  ): void {
    // Check permissions
    if (!this.canEmitEvent(sourcePluginId, eventType)) {
      this.logger.warn(`Plugin ${sourcePluginId} not permitted to emit event type: ${eventType}`);
      return;
    }

    // Create event object
    const event: PluginEvent = {
      id: this.generateEventId(),
      type: eventType,
      data: this.sanitizeEventData(data),
      source: sourcePluginId,
      target: options.target,
      timestamp: new Date(),
      metadata: options.metadata || {}
    };

    // Add to history
    this.addToHistory(event);

    // Emit to subscribed handlers
    this.dispatchEvent(event);

    this.logger.debug(`Event emitted: ${eventType} from ${sourcePluginId}`, {
      eventId: event.id,
      target: options.target
    });
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents(
    pluginId: string,
    eventType: string,
    handler: (event: PluginEvent) => void,
    options: EventSubscriptionOptions = {}
  ): string {
    // Check permissions
    if (!this.canListenToEvent(pluginId, eventType)) {
      throw new Error(`Plugin ${pluginId} not permitted to listen to event type: ${eventType}`);
    }

    const subscriptionId = this.generateSubscriptionId(pluginId, eventType);
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      pluginId,
      eventType,
      handler: this.wrapHandler(handler, subscriptionId, options),
      options
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Set up timeout if specified
    if (options.timeout) {
      setTimeout(() => {
        this.unsubscribeFromEvents(subscriptionId);
      }, options.timeout);
    }

    this.logger.debug(`Plugin ${pluginId} subscribed to ${eventType}`, {
      subscriptionId,
      options
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribeFromEvents(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn(`Subscription not found: ${subscriptionId}`);
      return;
    }

    this.subscriptions.delete(subscriptionId);
    
    this.logger.debug(`Unsubscribed: ${subscriptionId}`, {
      pluginId: subscription.pluginId,
      eventType: subscription.eventType
    });
  }

  /**
   * Unsubscribe all events for a plugin
   */
  unsubscribePlugin(pluginId: string): void {
    const pluginSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.pluginId === pluginId);

    for (const subscription of pluginSubscriptions) {
      this.subscriptions.delete(subscription.id);
    }

    this.logger.debug(`Unsubscribed all events for plugin ${pluginId}`, {
      count: pluginSubscriptions.length
    });
  }

  /**
   * Get event history
   */
  getEventHistory(
    pluginId?: string,
    eventType?: string,
    limit?: number
  ): PluginEvent[] {
    let history = [...this.eventHistory];

    // Filter by plugin if specified
    if (pluginId) {
      history = history.filter(event => 
        event.source === pluginId || event.target === pluginId
      );
    }

    // Filter by event type if specified
    if (eventType) {
      history = history.filter(event => 
        this.matchesEventPattern(event.type, eventType)
      );
    }

    // Apply limit
    if (limit && limit > 0) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * Get active subscriptions for a plugin
   */
  getPluginSubscriptions(pluginId: string): EventSubscription[] {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.pluginId === pluginId);
  }

  /**
   * Get event statistics
   */
  getEventStats(): {
    totalEvents: number;
    activeSubscriptions: number;
    eventsByType: Record<string, number>;
    eventsByPlugin: Record<string, number>;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByPlugin: Record<string, number> = {};

    for (const event of this.eventHistory) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByPlugin[event.source] = (eventsByPlugin[event.source] || 0) + 1;
    }

    return {
      totalEvents: this.eventHistory.length,
      activeSubscriptions: this.subscriptions.size,
      eventsByType,
      eventsByPlugin
    };
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
    this.logger.debug('Event history cleared');
  }

  /**
   * Emit system event (internal use only)
   */
  emitSystemEvent(eventType: string, data: any): void {
    this.emitPluginEvent('system', `system:${eventType}`, data);
  }

  /**
   * Private: Generate unique event ID
   */
  private generateEventId(): string {
    return `event-${++this.eventIdCounter}-${Date.now()}`;
  }

  /**
   * Private: Generate subscription ID
   */
  private generateSubscriptionId(pluginId: string, eventType: string): string {
    return `sub-${pluginId}-${eventType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Check if plugin can emit event type
   */
  private canEmitEvent(pluginId: string, eventType: string): boolean {
    const permissions = this.permissions.get(pluginId);
    if (!permissions) {
      this.logger.warn(`No permissions found for plugin ${pluginId}`);
      return false;
    }

    // System events require special permission
    if (eventType.startsWith('system:') && !permissions.canEmitSystem) {
      return false;
    }

    // Check against allowed patterns
    return permissions.canEmit.some(pattern => 
      this.matchesEventPattern(eventType, pattern)
    );
  }

  /**
   * Private: Check if plugin can listen to event type
   */
  private canListenToEvent(pluginId: string, eventType: string): boolean {
    const permissions = this.permissions.get(pluginId);
    if (!permissions) {
      this.logger.warn(`No permissions found for plugin ${pluginId}`);
      return false;
    }

    // System events require special permission
    if (eventType.startsWith('system:') && !permissions.canListenSystem) {
      return false;
    }

    // Check against allowed patterns
    return permissions.canListen.some(pattern => 
      this.matchesEventPattern(eventType, pattern)
    );
  }

  /**
   * Private: Check if event type matches pattern
   */
  private matchesEventPattern(eventType: string, pattern: string): boolean {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(eventType);
  }

  /**
   * Private: Sanitize event data to prevent security issues
   */
  private sanitizeEventData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Remove function references and other potentially dangerous objects
    if (typeof data === 'function') {
      return '[Function]';
    }

    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack
      };
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeEventData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Skip potentially dangerous properties
        if (key.startsWith('__') || key === 'constructor' || key === 'prototype') {
          continue;
        }
        
        sanitized[key] = this.sanitizeEventData(value);
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * Private: Wrap event handler with error handling and options
   */
  private wrapHandler(
    originalHandler: (event: PluginEvent) => void,
    subscriptionId: string,
    options: EventSubscriptionOptions
  ): (event: PluginEvent) => void {
    let eventCount = 0;

    return (event: PluginEvent) => {
      try {
        // Check event count limit
        if (options.maxEvents && ++eventCount > options.maxEvents) {
          this.unsubscribeFromEvents(subscriptionId);
          return;
        }

        // Apply source filtering
        if (options.fromPlugins && !options.fromPlugins.includes(event.source)) {
          return;
        }

        if (options.ignorePlugins && options.ignorePlugins.includes(event.source)) {
          return;
        }

        // Apply data filtering
        if (options.filter && !options.filter(event.data)) {
          return;
        }

        // Call original handler
        originalHandler(event);
      } catch (error) {
        this.logger.error(`Error in event handler for subscription ${subscriptionId}`, error);
        
        // Emit error event
        this.emitSystemEvent('eventHandlerError', {
          subscriptionId,
          error: (error as Error).message,
          event: {
            id: event.id,
            type: event.type,
            source: event.source
          }
        });
      }
    };
  }

  /**
   * Private: Dispatch event to all matching subscriptions
   */
  private dispatchEvent(event: PluginEvent): void {
    // Get matching subscriptions, sorted by priority
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => {
        // Check event type pattern match
        if (!this.matchesEventPattern(event.type, sub.eventType)) {
          return false;
        }

        // Check target filtering
        if (event.target && sub.pluginId !== event.target) {
          return false;
        }

        return true;
      })
      .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

    // Dispatch to handlers
    for (const subscription of matchingSubscriptions) {
      try {
        subscription.handler(event);
      } catch (error) {
        this.logger.error(`Error dispatching event to subscription ${subscription.id}`, error);
      }
    }

    // Emit to EventEmitter listeners (for internal system use)
    this.emit(event.type, event);
    this.emit('*', event);
  }

  /**
   * Private: Add event to history
   */
  private addToHistory(event: PluginEvent): void {
    this.eventHistory.push(event);
    
    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
}