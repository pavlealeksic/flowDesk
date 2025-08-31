/**
 * Plugin Automation Engine - Manages automation workflows and rules
 * 
 * Provides a comprehensive automation system that allows plugins to define
 * triggers and actions, and manages the execution of automation workflows.
 */

import { EventEmitter } from 'events';
import { 
  TriggerDefinition, 
  ActionDefinition,
  PluginInstallation 
} from '@flow-desk/shared';
import { PluginLogger } from '../utils/PluginLogger';
import { PluginEventBus } from '../events/PluginEventBus';
import { PluginSecurityManager } from '../security/PluginSecurityManager';

export interface AutomationRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** User ID who created the rule */
  userId: string;
  /** Workspace ID (optional) */
  workspaceId?: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Trigger configuration */
  trigger: {
    /** Plugin ID that provides the trigger */
    pluginId: string;
    /** Trigger type */
    type: string;
    /** Trigger configuration */
    config: Record<string, any>;
  };
  /** Actions to execute */
  actions: Array<{
    /** Plugin ID that provides the action */
    pluginId: string;
    /** Action type */
    type: string;
    /** Action configuration */
    config: Record<string, any>;
    /** Execution order */
    order: number;
  }>;
  /** Rule metadata */
  metadata: {
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
    /** Last execution timestamp */
    lastExecuted?: Date;
    /** Execution count */
    executionCount: number;
    /** Success count */
    successCount: number;
    /** Error count */
    errorCount: number;
  };
}

export interface AutomationExecution {
  /** Execution ID */
  id: string;
  /** Rule ID */
  ruleId: string;
  /** Execution status */
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  /** Start timestamp */
  startedAt: Date;
  /** End timestamp */
  completedAt?: Date;
  /** Trigger context */
  triggerContext: any;
  /** Action results */
  actionResults: Array<{
    pluginId: string;
    actionType: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
  }>;
  /** Error details */
  error?: string;
}

export interface AutomationMetrics {
  /** Total rules */
  totalRules: number;
  /** Active rules */
  activeRules: number;
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Average execution time */
  averageExecutionTime: number;
  /** Executions by rule */
  executionsByRule: Record<string, number>;
  /** Most used triggers */
  topTriggers: Array<{ type: string; count: number }>;
  /** Most used actions */
  topActions: Array<{ type: string; count: number }>;
}

/**
 * Plugin Automation Engine
 * 
 * Manages automation workflows, triggers, and actions across plugins.
 */
export class PluginAutomationEngine extends EventEmitter {
  private readonly logger: PluginLogger;
  private readonly eventBus: PluginEventBus;
  private readonly securityManager: PluginSecurityManager;
  
  private readonly triggers = new Map<string, Map<string, TriggerDefinition>>();
  private readonly actions = new Map<string, Map<string, ActionDefinition>>();
  private readonly rules = new Map<string, AutomationRule>();
  private readonly executions = new Map<string, AutomationExecution>();
  
  private readonly maxExecutionHistory = 1000;
  private isInitialized = false;

  constructor(
    eventBus: PluginEventBus,
    securityManager: PluginSecurityManager
  ) {
    super();
    
    this.logger = new PluginLogger('PluginAutomationEngine');
    this.eventBus = eventBus;
    this.securityManager = securityManager;
  }

  /**
   * Initialize the automation engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Automation engine already initialized');
    }

    this.logger.info('Initializing plugin automation engine');

    try {
      // Set up event listeners for triggers
      this.setupEventListeners();
      
      this.isInitialized = true;
      this.logger.info('Plugin automation engine initialized');
    } catch (error) {
      this.logger.error('Failed to initialize automation engine', error);
      throw error;
    }
  }

  /**
   * Shutdown the automation engine
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    this.logger.info('Shutting down automation engine');
    
    // Cancel running executions
    const runningExecutions = Array.from(this.executions.values())
      .filter(exec => exec.status === 'running');
    
    for (const execution of runningExecutions) {
      await this.cancelExecution(execution.id);
    }
    
    // Clear data
    this.triggers.clear();
    this.actions.clear();
    this.rules.clear();
    this.executions.clear();
    
    this.isInitialized = false;
    this.logger.info('Automation engine shut down');
  }

  /**
   * Register a trigger from a plugin
   */
  registerTrigger(pluginId: string, trigger: TriggerDefinition): void {
    if (!this.triggers.has(pluginId)) {
      this.triggers.set(pluginId, new Map());
    }
    
    const pluginTriggers = this.triggers.get(pluginId)!;
    pluginTriggers.set(trigger.id, trigger);
    
    this.logger.info(`Registered trigger: ${trigger.id} from plugin ${pluginId}`);
    this.emit('triggerRegistered', pluginId, trigger);
  }

  /**
   * Register an action from a plugin
   */
  registerAction(pluginId: string, action: ActionDefinition): void {
    if (!this.actions.has(pluginId)) {
      this.actions.set(pluginId, new Map());
    }
    
    const pluginActions = this.actions.get(pluginId)!;
    pluginActions.set(action.id, action);
    
    this.logger.info(`Registered action: ${action.id} from plugin ${pluginId}`);
    this.emit('actionRegistered', pluginId, action);
  }

  /**
   * Unregister all triggers and actions for a plugin
   */
  unregisterPlugin(pluginId: string): void {
    this.triggers.delete(pluginId);
    this.actions.delete(pluginId);
    
    // Disable rules that use this plugin
    for (const rule of this.rules.values()) {
      if (rule.trigger.pluginId === pluginId || 
          rule.actions.some(action => action.pluginId === pluginId)) {
        rule.enabled = false;
        this.logger.warn(`Disabled rule ${rule.id} due to plugin ${pluginId} unregistration`);
      }
    }
    
    this.logger.info(`Unregistered plugin ${pluginId} from automation engine`);
  }

  /**
   * Create an automation rule
   */
  async createRule(rule: Omit<AutomationRule, 'id' | 'metadata'>): Promise<AutomationRule> {
    // Validate trigger exists
    const triggerPlugin = this.triggers.get(rule.trigger.pluginId);
    if (!triggerPlugin || !triggerPlugin.has(rule.trigger.type)) {
      throw new Error(`Trigger ${rule.trigger.type} not found in plugin ${rule.trigger.pluginId}`);
    }

    // Validate all actions exist
    for (const action of rule.actions) {
      const actionPlugin = this.actions.get(action.pluginId);
      if (!actionPlugin || !actionPlugin.has(action.type)) {
        throw new Error(`Action ${action.type} not found in plugin ${action.pluginId}`);
      }
    }

    // Create rule
    const newRule: AutomationRule = {
      ...rule,
      id: this.generateRuleId(),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        successCount: 0,
        errorCount: 0
      }
    };

    this.rules.set(newRule.id, newRule);
    
    this.logger.info(`Created automation rule: ${newRule.name} (${newRule.id})`);
    this.emit('ruleCreated', newRule);
    
    return newRule;
  }

  /**
   * Update an automation rule
   */
  async updateRule(ruleId: string, updates: Partial<AutomationRule>): Promise<AutomationRule> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    // Validate updates if they affect trigger or actions
    if (updates.trigger) {
      const triggerPlugin = this.triggers.get(updates.trigger.pluginId);
      if (!triggerPlugin || !triggerPlugin.has(updates.trigger.type)) {
        throw new Error(`Trigger ${updates.trigger.type} not found in plugin ${updates.trigger.pluginId}`);
      }
    }

    if (updates.actions) {
      for (const action of updates.actions) {
        const actionPlugin = this.actions.get(action.pluginId);
        if (!actionPlugin || !actionPlugin.has(action.type)) {
          throw new Error(`Action ${action.type} not found in plugin ${action.pluginId}`);
        }
      }
    }

    // Apply updates
    const updatedRule = {
      ...rule,
      ...updates,
      metadata: {
        ...rule.metadata,
        updatedAt: new Date()
      }
    };

    this.rules.set(ruleId, updatedRule);
    
    this.logger.info(`Updated automation rule: ${updatedRule.name} (${ruleId})`);
    this.emit('ruleUpdated', updatedRule);
    
    return updatedRule;
  }

  /**
   * Delete an automation rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    this.rules.delete(ruleId);
    
    this.logger.info(`Deleted automation rule: ${rule.name} (${ruleId})`);
    this.emit('ruleDeleted', rule);
  }

  /**
   * Get all automation rules
   */
  getRules(userId?: string, workspaceId?: string): AutomationRule[] {
    const rules = Array.from(this.rules.values());
    
    if (userId) {
      return rules.filter(rule => rule.userId === userId && 
        (!workspaceId || rule.workspaceId === workspaceId));
    }
    
    return rules;
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): AutomationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get available triggers
   */
  getAvailableTriggers(): Array<{ pluginId: string; trigger: TriggerDefinition }> {
    const triggers: Array<{ pluginId: string; trigger: TriggerDefinition }> = [];
    
    for (const [pluginId, pluginTriggers] of this.triggers.entries()) {
      for (const trigger of pluginTriggers.values()) {
        triggers.push({ pluginId, trigger });
      }
    }
    
    return triggers;
  }

  /**
   * Get available actions
   */
  getAvailableActions(): Array<{ pluginId: string; action: ActionDefinition }> {
    const actions: Array<{ pluginId: string; action: ActionDefinition }> = [];
    
    for (const [pluginId, pluginActions] of this.actions.entries()) {
      for (const action of pluginActions.values()) {
        actions.push({ pluginId, action });
      }
    }
    
    return actions;
  }

  /**
   * Execute a rule manually
   */
  async executeRule(ruleId: string, context: any = {}): Promise<AutomationExecution> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    if (!rule.enabled) {
      throw new Error(`Rule ${ruleId} is disabled`);
    }

    return this.executeAutomationRule(rule, context);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(ruleId?: string, limit?: number): AutomationExecution[] {
    let executions = Array.from(this.executions.values());
    
    if (ruleId) {
      executions = executions.filter(exec => exec.ruleId === ruleId);
    }
    
    // Sort by start time (most recent first)
    executions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    
    if (limit) {
      executions = executions.slice(0, limit);
    }
    
    return executions;
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') {
      throw new Error(`Execution ${executionId} not found or not running`);
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date();
    
    this.logger.info(`Cancelled execution: ${executionId}`);
    this.emit('executionCancelled', execution);
  }

  /**
   * Get automation metrics
   */
  getMetrics(): AutomationMetrics {
    const executions = Array.from(this.executions.values());
    const rules = Array.from(this.rules.values());
    
    const executionsByRule: Record<string, number> = {};
    const triggerCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();
    let totalExecutionTime = 0;
    let completedExecutions = 0;

    for (const execution of executions) {
      executionsByRule[execution.ruleId] = (executionsByRule[execution.ruleId] || 0) + 1;
      
      if (execution.completedAt) {
        const executionTime = execution.completedAt.getTime() - execution.startedAt.getTime();
        totalExecutionTime += executionTime;
        completedExecutions++;
      }

      // Count trigger usage
      const rule = this.rules.get(execution.ruleId);
      if (rule) {
        const triggerKey = `${rule.trigger.pluginId}:${rule.trigger.type}`;
        triggerCounts.set(triggerKey, (triggerCounts.get(triggerKey) || 0) + 1);
        
        // Count action usage
        for (const action of rule.actions) {
          const actionKey = `${action.pluginId}:${action.type}`;
          actionCounts.set(actionKey, (actionCounts.get(actionKey) || 0) + 1);
        }
      }
    }

    const topTriggers = Array.from(triggerCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topActions = Array.from(actionCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRules: rules.length,
      activeRules: rules.filter(rule => rule.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(exec => exec.status === 'completed').length,
      failedExecutions: executions.filter(exec => exec.status === 'failed').length,
      averageExecutionTime: completedExecutions > 0 ? totalExecutionTime / completedExecutions : 0,
      executionsByRule,
      topTriggers,
      topActions
    };
  }

  /**
   * Private: Setup event listeners for triggers
   */
  private setupEventListeners(): void {
    // Listen for system events that might trigger automation
    this.eventBus.on('*', (event) => {
      this.handlePotentialTrigger(event);
    });
  }

  /**
   * Private: Handle potential trigger events
   */
  private async handlePotentialTrigger(event: any): Promise<void> {
    // Find rules that might be triggered by this event
    const matchingRules = Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;
      
      const triggerPlugin = this.triggers.get(rule.trigger.pluginId);
      if (!triggerPlugin) return false;
      
      const trigger = triggerPlugin.get(rule.trigger.type);
      if (!trigger) return false;
      
      // Check if this event matches the trigger
      // This would be more sophisticated in a real implementation
      return this.eventMatchesTrigger(event, trigger, rule.trigger.config);
    });

    // Execute matching rules
    for (const rule of matchingRules) {
      try {
        await this.executeAutomationRule(rule, event);
      } catch (error) {
        this.logger.error(`Failed to execute rule ${rule.id}`, error);
      }
    }
  }

  /**
   * Private: Check if event matches trigger
   */
  private eventMatchesTrigger(event: any, trigger: TriggerDefinition, config: any): boolean {
    // This is a simplified implementation
    // In reality, you'd call the trigger's handler function
    try {
      return trigger.handler(config, event);
    } catch (error) {
      this.logger.error(`Error checking trigger match`, error);
      return false;
    }
  }

  /**
   * Private: Execute an automation rule
   */
  private async executeAutomationRule(rule: AutomationRule, triggerContext: any): Promise<AutomationExecution> {
    const executionId = this.generateExecutionId();
    
    const execution: AutomationExecution = {
      id: executionId,
      ruleId: rule.id,
      status: 'running',
      startedAt: new Date(),
      triggerContext,
      actionResults: rule.actions.map(action => ({
        pluginId: action.pluginId,
        actionType: action.type,
        status: 'pending',
        startedAt: new Date()
      }))
    };

    this.executions.set(executionId, execution);
    
    // Trim execution history if needed
    if (this.executions.size > this.maxExecutionHistory) {
      const oldestExecutions = Array.from(this.executions.entries())
        .sort(([,a], [,b]) => a.startedAt.getTime() - b.startedAt.getTime())
        .slice(0, this.executions.size - this.maxExecutionHistory);
      
      for (const [id] of oldestExecutions) {
        this.executions.delete(id);
      }
    }

    this.logger.info(`Started execution: ${executionId} for rule ${rule.name}`);
    this.emit('executionStarted', execution);

    try {
      // Execute actions in order
      const sortedActions = [...rule.actions].sort((a, b) => a.order - b.order);
      
      for (let i = 0; i < sortedActions.length; i++) {
        const action = sortedActions[i];
        const actionResult = execution.actionResults[i];
        
        actionResult.status = 'running';
        actionResult.startedAt = new Date();
        
        try {
          const actionPlugin = this.actions.get(action.pluginId);
          const actionDef = actionPlugin?.get(action.type);
          
          if (!actionDef) {
            throw new Error(`Action ${action.type} not found in plugin ${action.pluginId}`);
          }

          const result = await actionDef.handler(action.config, triggerContext);
          
          actionResult.status = 'completed';
          actionResult.result = result;
          actionResult.completedAt = new Date();
          
        } catch (error) {
          actionResult.status = 'failed';
          actionResult.error = error.message;
          actionResult.completedAt = new Date();
          
          this.logger.error(`Action failed in execution ${executionId}`, error);
        }
      }

      // Determine overall execution status
      const hasFailedActions = execution.actionResults.some(result => result.status === 'failed');
      execution.status = hasFailedActions ? 'failed' : 'completed';
      execution.completedAt = new Date();

      // Update rule metrics
      rule.metadata.executionCount++;
      rule.metadata.lastExecuted = new Date();
      
      if (execution.status === 'completed') {
        rule.metadata.successCount++;
      } else {
        rule.metadata.errorCount++;
      }

      this.logger.info(`Completed execution: ${executionId} with status ${execution.status}`);
      this.emit('executionCompleted', execution);
      
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date();
      
      rule.metadata.executionCount++;
      rule.metadata.errorCount++;
      
      this.logger.error(`Execution failed: ${executionId}`, error);
      this.emit('executionFailed', execution);
    }

    return execution;
  }

  /**
   * Private: Generate rule ID
   */
  private generateRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Private: Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}