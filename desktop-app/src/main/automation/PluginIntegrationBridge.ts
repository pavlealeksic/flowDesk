/**
 * Plugin Integration Bridge - Connects automation system with plugins
 * 
 * This bridge provides:
 * - Dynamic discovery of plugin triggers and actions
 * - Plugin lifecycle integration
 * - Event routing between plugins and automation engine
 * - Security validation and sandboxing
 * - Performance monitoring and error handling
 */

import { EventEmitter } from 'events';
import { 
  AutomationTriggerType,
  AutomationActionType,
  TriggerDefinition,
  ActionDefinition
} from '@flow-desk/shared';

import { PluginManager } from '../plugin-runtime/PluginManager';
import { PluginSecurityManager } from '../plugin-runtime/security/PluginSecurityManager';
import { AutomationEngine } from './AutomationEngine';
import { TriggerRegistry } from './TriggerRegistry';
import { ActionRegistry } from './ActionRegistry';

interface PluginCapability {
  pluginId: string;
  pluginName: string;
  version: string;
  triggers: TriggerDefinition[];
  actions: ActionDefinition[];
  status: 'active' | 'inactive' | 'error';
  permissions: string[];
  lastUpdate: Date;
}

interface PluginEventMapping {
  pluginId: string;
  eventType: string;
  automationTrigger: AutomationTriggerType;
  transform?: (data: any) => any;
}

interface PluginActionMapping {
  pluginId: string;
  actionName: string;
  automationAction: AutomationActionType;
  transform?: (config: any) => any;
}

export class PluginIntegrationBridge extends EventEmitter {
  private readonly pluginManager: PluginManager;
  private readonly securityManager: PluginSecurityManager;
  private readonly automationEngine: AutomationEngine;
  private readonly triggerRegistry: TriggerRegistry;
  private readonly actionRegistry: ActionRegistry;

  private readonly pluginCapabilities = new Map<string, PluginCapability>();
  private readonly eventMappings = new Map<string, PluginEventMapping[]>();
  private readonly actionMappings = new Map<string, PluginActionMapping[]>();
  private readonly activeSubscriptions = new Map<string, Set<string>>();

  private isInitialized = false;

  constructor(
    pluginManager: PluginManager,
    securityManager: PluginSecurityManager,
    automationEngine: AutomationEngine,
    triggerRegistry: TriggerRegistry,
    actionRegistry: ActionRegistry
  ) {
    super();
    
    this.pluginManager = pluginManager;
    this.securityManager = securityManager;
    this.automationEngine = automationEngine;
    this.triggerRegistry = triggerRegistry;
    this.actionRegistry = actionRegistry;

    this.setupPluginEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Discover existing plugins
      await this.discoverPluginCapabilities();
      
      // Register plugin-based triggers and actions
      await this.registerPluginTriggersAndActions();
      
      // Set up event routing
      this.setupEventRouting();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize PluginIntegrationBridge: ${error.message}`);
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Unsubscribe from all plugin events
      for (const [pluginId, subscriptions] of this.activeSubscriptions) {
        for (const eventType of subscriptions) {
          await this.unsubscribeFromPluginEvent(pluginId, eventType);
        }
      }

      this.pluginCapabilities.clear();
      this.eventMappings.clear();
      this.actionMappings.clear();
      this.activeSubscriptions.clear();
      
      this.isInitialized = false;
      this.emit('shutdown');
    } catch (error) {
      throw new Error(`Error during PluginIntegrationBridge shutdown: ${error.message}`);
    }
  }

  /**
   * Get all available plugin capabilities
   */
  getPluginCapabilities(): PluginCapability[] {
    return Array.from(this.pluginCapabilities.values());
  }

  /**
   * Get capabilities for a specific plugin
   */
  getPluginCapability(pluginId: string): PluginCapability | undefined {
    return this.pluginCapabilities.get(pluginId);
  }

  /**
   * Get all available triggers from plugins
   */
  getPluginTriggers(): Array<TriggerDefinition & { pluginId: string }> {
    const triggers: Array<TriggerDefinition & { pluginId: string }> = [];
    
    for (const capability of this.pluginCapabilities.values()) {
      if (capability.status === 'active') {
        for (const trigger of capability.triggers) {
          triggers.push({
            ...trigger,
            pluginId: capability.pluginId
          });
        }
      }
    }
    
    return triggers;
  }

  /**
   * Get all available actions from plugins
   */
  getPluginActions(): Array<ActionDefinition & { pluginId: string }> {
    const actions: Array<ActionDefinition & { pluginId: string }> = [];
    
    for (const capability of this.pluginCapabilities.values()) {
      if (capability.status === 'active') {
        for (const action of capability.actions) {
          actions.push({
            ...action,
            pluginId: capability.pluginId
          });
        }
      }
    }
    
    return actions;
  }

  /**
   * Execute a plugin action
   */
  async executePluginAction(
    pluginId: string,
    actionName: string,
    config: any,
    context: any
  ): Promise<any> {
    const capability = this.pluginCapabilities.get(pluginId);
    if (!capability) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (capability.status !== 'active') {
      throw new Error(`Plugin ${pluginId} is not active`);
    }

    const action = capability.actions.find(a => a.id === actionName);
    if (!action) {
      throw new Error(`Action ${actionName} not found in plugin ${pluginId}`);
    }

    // Security validation
    await this.validatePluginActionExecution(pluginId, actionName, config);

    try {
      // Transform config if needed
      const mapping = this.actionMappings.get(pluginId)?.find(m => m.actionName === actionName);
      const transformedConfig = mapping?.transform ? mapping.transform(config) : config;

      // Execute through plugin manager
      const result = await this.pluginManager.executePluginAction(
        pluginId,
        actionName,
        transformedConfig,
        context
      );

      this.emit('pluginActionExecuted', {
        pluginId,
        actionName,
        config: transformedConfig,
        result,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      this.emit('pluginActionError', {
        pluginId,
        actionName,
        config,
        error: error.message,
        timestamp: new Date()
      });
      
      throw new Error(`Plugin action execution failed: ${error.message}`);
    }
  }

  /**
   * Subscribe to plugin events for automation triggers
   */
  async subscribeToPluginEvent(
    pluginId: string,
    eventType: string,
    triggerType: AutomationTriggerType,
    transform?: (data: any) => any
  ): Promise<void> {
    const capability = this.pluginCapabilities.get(pluginId);
    if (!capability) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Add event mapping
    if (!this.eventMappings.has(pluginId)) {
      this.eventMappings.set(pluginId, []);
    }

    const mappings = this.eventMappings.get(pluginId)!;
    mappings.push({
      pluginId,
      eventType,
      automationTrigger: triggerType,
      transform
    });

    // Subscribe to plugin events
    await this.pluginManager.subscribeToPluginEvent(pluginId, eventType, (data: any) => {
      this.handlePluginEvent(pluginId, eventType, data);
    });

    // Track subscription
    if (!this.activeSubscriptions.has(pluginId)) {
      this.activeSubscriptions.set(pluginId, new Set());
    }
    this.activeSubscriptions.get(pluginId)!.add(eventType);
  }

  /**
   * Unsubscribe from plugin event
   */
  async unsubscribeFromPluginEvent(pluginId: string, eventType: string): Promise<void> {
    // Remove from plugin manager
    await this.pluginManager.unsubscribeFromPluginEvent(pluginId, eventType);

    // Remove mapping
    const mappings = this.eventMappings.get(pluginId);
    if (mappings) {
      const index = mappings.findIndex(m => m.eventType === eventType);
      if (index >= 0) {
        mappings.splice(index, 1);
      }
    }

    // Remove from active subscriptions
    const subscriptions = this.activeSubscriptions.get(pluginId);
    if (subscriptions) {
      subscriptions.delete(eventType);
      if (subscriptions.size === 0) {
        this.activeSubscriptions.delete(pluginId);
      }
    }
  }

  /**
   * Refresh plugin capabilities
   */
  async refreshPluginCapabilities(pluginId?: string): Promise<void> {
    if (pluginId) {
      await this.discoverPluginCapability(pluginId);
    } else {
      await this.discoverPluginCapabilities();
    }

    await this.registerPluginTriggersAndActions();
  }

  // Private methods

  private setupPluginEventListeners(): void {
    // Listen for plugin lifecycle events
    this.pluginManager.on('pluginInstalled', async (plugin) => {
      await this.handlePluginInstalled(plugin);
    });

    this.pluginManager.on('pluginUninstalled', async (pluginId) => {
      await this.handlePluginUninstalled(pluginId);
    });

    this.pluginManager.on('pluginActivated', async (pluginId) => {
      await this.handlePluginActivated(pluginId);
    });

    this.pluginManager.on('pluginDeactivated', async (pluginId) => {
      await this.handlePluginDeactivated(pluginId);
    });

    this.pluginManager.on('pluginError', (pluginId, error) => {
      this.handlePluginError(pluginId, error);
    });
  }

  private async discoverPluginCapabilities(): Promise<void> {
    const installedPlugins = await this.pluginManager.getInstalledPlugins();
    
    for (const plugin of installedPlugins) {
      await this.discoverPluginCapability(plugin.id);
    }
  }

  private async discoverPluginCapability(pluginId: string): Promise<void> {
    try {
      const plugin = await this.pluginManager.getPlugin(pluginId);
      if (!plugin) {
        return;
      }

      // Get plugin manifest to discover capabilities
      const manifest = await this.pluginManager.getPluginManifest(pluginId);
      if (!manifest) {
        return;
      }

      // Extract automation capabilities from manifest
      const capabilities = manifest.automation || { triggers: [], actions: [] };
      
      const pluginCapability: PluginCapability = {
        pluginId,
        pluginName: manifest.name,
        version: manifest.version,
        triggers: capabilities.triggers || [],
        actions: capabilities.actions || [],
        status: plugin.status === 'active' ? 'active' : 'inactive',
        permissions: manifest.permissions || [],
        lastUpdate: new Date()
      };

      this.pluginCapabilities.set(pluginId, pluginCapability);
      this.emit('pluginCapabilityDiscovered', pluginCapability);
    } catch (error) {
      console.error(`Failed to discover capabilities for plugin ${pluginId}:`, error);
      
      // Mark plugin as error state
      const existingCapability = this.pluginCapabilities.get(pluginId);
      if (existingCapability) {
        existingCapability.status = 'error';
        existingCapability.lastUpdate = new Date();
      }
    }
  }

  private async registerPluginTriggersAndActions(): Promise<void> {
    // Register triggers
    for (const capability of this.pluginCapabilities.values()) {
      if (capability.status === 'active') {
        for (const trigger of capability.triggers) {
          await this.registerPluginTrigger(capability.pluginId, trigger);
        }

        for (const action of capability.actions) {
          await this.registerPluginAction(capability.pluginId, action);
        }
      }
    }
  }

  private async registerPluginTrigger(pluginId: string, trigger: TriggerDefinition): Promise<void> {
    // Create automation trigger that delegates to plugin
    const automationTrigger = {
      type: trigger.id as AutomationTriggerType,
      name: trigger.name,
      description: trigger.description,
      schema: trigger.configSchema,
      executor: async (config: any, context: any) => {
        return this.executePluginTrigger(pluginId, trigger.id, config, context);
      },
      validator: (config: any) => {
        return this.validatePluginTriggerConfig(pluginId, trigger.id, config);
      }
    };

    this.triggerRegistry.registerTrigger(automationTrigger);

    // Set up event subscription if this is an event-based trigger
    if (trigger.eventType) {
      await this.subscribeToPluginEvent(
        pluginId,
        trigger.eventType,
        trigger.id as AutomationTriggerType,
        trigger.eventTransform
      );
    }
  }

  private async registerPluginAction(pluginId: string, action: ActionDefinition): Promise<void> {
    // Create automation action that delegates to plugin
    const automationAction = {
      type: action.id as AutomationActionType,
      name: action.name,
      description: action.description,
      schema: action.configSchema,
      executor: async (config: any, context: any) => {
        return this.executePluginAction(pluginId, action.id, config, context);
      },
      validator: (config: any) => {
        return this.validatePluginActionConfig(pluginId, action.id, config);
      }
    };

    this.actionRegistry.registerAction(automationAction);

    // Add action mapping
    if (!this.actionMappings.has(pluginId)) {
      this.actionMappings.set(pluginId, []);
    }

    this.actionMappings.get(pluginId)!.push({
      pluginId,
      actionName: action.id,
      automationAction: action.id as AutomationActionType,
      transform: action.configTransform
    });
  }

  private async executePluginTrigger(
    pluginId: string,
    triggerId: string,
    config: any,
    context: any
  ): Promise<boolean> {
    try {
      // This would call the plugin's trigger evaluation function
      const result = await this.pluginManager.evaluatePluginTrigger(
        pluginId,
        triggerId,
        config,
        context
      );

      return result;
    } catch (error) {
      throw new Error(`Plugin trigger execution failed: ${error.message}`);
    }
  }

  private validatePluginTriggerConfig(pluginId: string, triggerId: string, config: any): boolean {
    // Basic validation - would be more comprehensive in real implementation
    const capability = this.pluginCapabilities.get(pluginId);
    if (!capability) return false;

    const trigger = capability.triggers.find(t => t.id === triggerId);
    if (!trigger) return false;

    // Validate against schema if available
    if (trigger.configSchema) {
      // Would use JSON Schema validation here
      return true;
    }

    return true;
  }

  private validatePluginActionConfig(pluginId: string, actionId: string, config: any): boolean {
    // Basic validation - would be more comprehensive in real implementation
    const capability = this.pluginCapabilities.get(pluginId);
    if (!capability) return false;

    const action = capability.actions.find(a => a.id === actionId);
    if (!action) return false;

    // Validate against schema if available
    if (action.configSchema) {
      // Would use JSON Schema validation here
      return true;
    }

    return true;
  }

  private async validatePluginActionExecution(
    pluginId: string,
    actionName: string,
    config: any
  ): Promise<void> {
    const capability = this.pluginCapabilities.get(pluginId);
    if (!capability) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Check security permissions
    const requiredPermissions = this.getActionRequiredPermissions(actionName);
    for (const permission of requiredPermissions) {
      if (!capability.permissions.includes(permission)) {
        throw new Error(`Plugin ${pluginId} lacks required permission: ${permission}`);
      }
    }

    // Additional security validation through security manager
    await this.securityManager.validatePluginOperation(pluginId, 'action', actionName, config);
  }

  private getActionRequiredPermissions(actionName: string): string[] {
    // Map action names to required permissions
    const permissionMap: Record<string, string[]> = {
      'send_email': ['email:write'],
      'create_task': ['tasks:write'],
      'send_message': ['communication:write'],
      'create_file': ['files:write'],
      'api_request': ['network:access']
    };

    return permissionMap[actionName] || [];
  }

  private setupEventRouting(): void {
    // Set up routing for plugin events to automation triggers
    this.on('pluginEvent', (data) => {
      this.routePluginEventToAutomation(data);
    });
  }

  private handlePluginEvent(pluginId: string, eventType: string, data: any): void {
    const mappings = this.eventMappings.get(pluginId);
    if (!mappings) return;

    for (const mapping of mappings) {
      if (mapping.eventType === eventType) {
        // Transform data if needed
        const transformedData = mapping.transform ? mapping.transform(data) : data;
        
        // Emit automation trigger event
        this.automationEngine.emit('trigger', mapping.automationTrigger, {
          pluginId,
          eventType,
          data: transformedData,
          timestamp: new Date()
        });
      }
    }
  }

  private routePluginEventToAutomation(eventData: any): void {
    // Route plugin events to automation system
    const { pluginId, eventType, data } = eventData;
    
    const mappings = this.eventMappings.get(pluginId);
    if (mappings) {
      for (const mapping of mappings) {
        if (mapping.eventType === eventType) {
          this.automationEngine.emit('pluginTrigger', {
            triggerType: mapping.automationTrigger,
            data: mapping.transform ? mapping.transform(data) : data,
            pluginId,
            eventType
          });
        }
      }
    }
  }

  // Plugin lifecycle event handlers

  private async handlePluginInstalled(plugin: any): Promise<void> {
    await this.discoverPluginCapability(plugin.id);
    await this.registerPluginTriggersAndActions();
    this.emit('pluginIntegrated', plugin.id);
  }

  private async handlePluginUninstalled(pluginId: string): Promise<void> {
    // Remove capabilities
    this.pluginCapabilities.delete(pluginId);
    
    // Remove mappings
    this.eventMappings.delete(pluginId);
    this.actionMappings.delete(pluginId);
    
    // Unregister triggers and actions
    // Note: This would need to be implemented in the registries
    
    this.emit('pluginDisintegrated', pluginId);
  }

  private async handlePluginActivated(pluginId: string): Promise<void> {
    await this.refreshPluginCapabilities(pluginId);
    this.emit('pluginActivated', pluginId);
  }

  private async handlePluginDeactivated(pluginId: string): Promise<void> {
    const capability = this.pluginCapabilities.get(pluginId);
    if (capability) {
      capability.status = 'inactive';
      capability.lastUpdate = new Date();
    }
    
    this.emit('pluginDeactivated', pluginId);
  }

  private handlePluginError(pluginId: string, error: Error): void {
    const capability = this.pluginCapabilities.get(pluginId);
    if (capability) {
      capability.status = 'error';
      capability.lastUpdate = new Date();
    }
    
    this.emit('pluginError', { pluginId, error: error.message });
  }
}