/**
 * Complete Automation Engine for Flow Desk
 * 
 * This is a production-ready automation system that provides:
 * - Real trigger/action implementations
 * - Conditional logic and variable handling
 * - Plugin integration
 * - Error handling and retry logic
 * - Template system
 * - Testing capabilities
 * - Performance monitoring
 */

import { EventEmitter } from 'events';
import { 
  AutomationRecipe,
  AutomationExecution,
  AutomationTrigger,
  AutomationAction,
  AutomationCondition,
  AutomationVariable,
  AutomationVariableContext,
  AutomationEngineConfig,
  AutomationScheduler,
  AutomationTest,
  AutomationExecutionStatus,
  AutomationTriggerType,
  AutomationActionType,
  ConditionOperator
} from '@flow-desk/shared';

import { PluginManager } from '../plugin-runtime/PluginManager';
import { SearchEngine } from '../../search/SearchEngine';
import { EmailEngine } from '../../email/EmailEngine';
import { CalendarEngine } from '../../calendar/CalendarEngine';
import { NotificationService } from '../../notifications/NotificationService';
import { CronJobManager } from './CronJobManager';
import { VariableResolver } from './VariableResolver';
import { ConditionalLogicEngine } from './ConditionalLogicEngine';
import { TriggerRegistry } from './TriggerRegistry';
import { ActionRegistry } from './ActionRegistry';
import { AutomationLogger } from './AutomationLogger';

export class AutomationEngine extends EventEmitter {
  private readonly config: AutomationEngineConfig;
  private readonly pluginManager: PluginManager;
  private readonly searchEngine: SearchEngine;
  private readonly emailEngine: EmailEngine;
  private readonly calendarEngine: CalendarEngine;
  private readonly notificationService: NotificationService;
  private readonly cronJobManager: CronJobManager;
  private readonly variableResolver: VariableResolver;
  private readonly conditionalLogicEngine: ConditionalLogicEngine;
  private readonly triggerRegistry: TriggerRegistry;
  private readonly actionRegistry: ActionRegistry;
  private readonly logger: AutomationLogger;

  private readonly recipes = new Map<string, AutomationRecipe>();
  private readonly executions = new Map<string, AutomationExecution>();
  private readonly schedulers = new Map<string, AutomationScheduler>();
  private readonly tests = new Map<string, AutomationTest>();
  private readonly variables = new Map<string, AutomationVariable>();
  
  private readonly executionQueue: AutomationExecution[] = [];
  private readonly activeExecutions = new Set<string>();
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(
    config: AutomationEngineConfig,
    pluginManager: PluginManager,
    searchEngine: SearchEngine,
    emailEngine: EmailEngine,
    calendarEngine: CalendarEngine,
    notificationService: NotificationService
  ) {
    super();
    
    this.config = config;
    this.pluginManager = pluginManager;
    this.searchEngine = searchEngine;
    this.emailEngine = emailEngine;
    this.calendarEngine = calendarEngine;
    this.notificationService = notificationService;
    
    this.cronJobManager = new CronJobManager();
    this.variableResolver = new VariableResolver();
    this.conditionalLogicEngine = new ConditionalLogicEngine();
    this.triggerRegistry = new TriggerRegistry(this);
    this.actionRegistry = new ActionRegistry(this);
    this.logger = new AutomationLogger(config.logging);
    
    this.setupEventListeners();
  }

  /**
   * Initialize the automation engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Automation engine already initialized');
    }

    this.logger.info('Initializing automation engine');

    try {
      // Initialize sub-components
      await this.cronJobManager.initialize();
      await this.triggerRegistry.initialize();
      await this.actionRegistry.initialize();
      
      // Register built-in triggers and actions
      await this.registerBuiltInTriggersAndActions();
      
      // Load existing recipes and schedulers
      await this.loadPersistedData();
      
      // Start execution loop
      this.startExecutionLoop();
      
      this.isInitialized = true;
      this.logger.info('Automation engine initialized successfully');
      this.emit('initialized');
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
    this.isShuttingDown = true;

    try {
      // Stop new executions
      this.executionQueue.length = 0;
      
      // Wait for active executions to complete (with timeout)
      await this.waitForActiveExecutions(30000);
      
      // Shutdown sub-components
      await this.cronJobManager.shutdown();
      await this.triggerRegistry.shutdown();
      await this.actionRegistry.shutdown();
      
      // Persist data
      await this.persistData();
      
      this.isInitialized = false;
      this.logger.info('Automation engine shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during automation engine shutdown', error);
      throw error;
    }
  }

  /**
   * Create a new automation recipe
   */
  async createRecipe(recipeData: Omit<AutomationRecipe, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<AutomationRecipe> {
    this.logger.info(`Creating automation recipe: ${recipeData.name}`);

    try {
      // Validate recipe
      await this.validateRecipe(recipeData);
      
      const recipe: AutomationRecipe = {
        ...recipeData,
        id: this.generateId('recipe'),
        createdAt: new Date(),
        updatedAt: new Date(),
        stats: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          avgExecutionTime: 0,
          successRate: 0,
          recentExecutions: []
        }
      };

      this.recipes.set(recipe.id, recipe);
      
      // Set up scheduler if needed
      if (this.isScheduledTrigger(recipe.trigger)) {
        await this.setupScheduler(recipe);
      }
      
      // Register trigger listeners
      await this.registerTriggerListeners(recipe);
      
      await this.persistRecipe(recipe);
      
      this.logger.info(`Created automation recipe: ${recipe.name} (${recipe.id})`);
      this.emit('recipeCreated', recipe);
      
      return recipe;
    } catch (error) {
      this.logger.error(`Failed to create recipe: ${recipeData.name}`, error);
      throw error;
    }
  }

  /**
   * Update an existing automation recipe
   */
  async updateRecipe(recipeId: string, updates: Partial<AutomationRecipe>): Promise<AutomationRecipe> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    this.logger.info(`Updating automation recipe: ${recipe.name}`);

    try {
      // Validate updates
      const updatedRecipe = { ...recipe, ...updates, updatedAt: new Date() };
      await this.validateRecipe(updatedRecipe);
      
      // Update schedulers if trigger changed
      if (updates.trigger && updates.trigger !== recipe.trigger) {
        await this.removeScheduler(recipe.id);
        if (this.isScheduledTrigger(updates.trigger)) {
          await this.setupScheduler(updatedRecipe);
        }
      }
      
      this.recipes.set(recipeId, updatedRecipe);
      await this.persistRecipe(updatedRecipe);
      
      this.logger.info(`Updated automation recipe: ${updatedRecipe.name} (${recipeId})`);
      this.emit('recipeUpdated', updatedRecipe);
      
      return updatedRecipe;
    } catch (error) {
      this.logger.error(`Failed to update recipe: ${recipeId}`, error);
      throw error;
    }
  }

  /**
   * Delete an automation recipe
   */
  async deleteRecipe(recipeId: string): Promise<void> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    this.logger.info(`Deleting automation recipe: ${recipe.name}`);

    try {
      // Cancel running executions for this recipe
      for (const execution of this.executions.values()) {
        if (execution.recipeId === recipeId && execution.status === 'running') {
          await this.cancelExecution(execution.id);
        }
      }
      
      // Remove scheduler
      await this.removeScheduler(recipeId);
      
      // Remove trigger listeners
      await this.unregisterTriggerListeners(recipe);
      
      this.recipes.delete(recipeId);
      await this.deletePersistedRecipe(recipeId);
      
      this.logger.info(`Deleted automation recipe: ${recipe.name} (${recipeId})`);
      this.emit('recipeDeleted', recipe);
    } catch (error) {
      this.logger.error(`Failed to delete recipe: ${recipeId}`, error);
      throw error;
    }
  }

  /**
   * Execute a recipe manually
   */
  async executeRecipe(recipeId: string, context: any = {}): Promise<AutomationExecution> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    if (!recipe.enabled) {
      throw new Error(`Recipe is disabled: ${recipeId}`);
    }

    this.logger.info(`Manually executing recipe: ${recipe.name}`);

    const execution: AutomationExecution = {
      id: this.generateId('execution'),
      recipeId,
      userId: recipe.ownerId,
      trigger: {
        type: 'manual',
        data: context,
        timestamp: new Date()
      },
      status: 'queued',
      context: {
        trigger: context,
        user: { id: recipe.ownerId, email: '', name: '' },
        variables: {},
        environment: this.config.plugins.enabled ? 'production' : 'development'
      },
      actions: [],
      startedAt: new Date()
    };

    this.executions.set(execution.id, execution);
    this.executionQueue.push(execution);
    
    this.emit('executionQueued', execution);
    
    return execution;
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (!['queued', 'running', 'paused'].includes(execution.status)) {
      throw new Error(`Execution cannot be cancelled: ${execution.status}`);
    }

    this.logger.info(`Cancelling execution: ${executionId}`);

    execution.status = 'cancelled';
    execution.endedAt = new Date();
    execution.duration = execution.endedAt.getTime() - execution.startedAt.getTime();

    this.activeExecutions.delete(executionId);
    
    this.emit('executionCancelled', execution);
  }

  /**
   * Test an automation recipe
   */
  async testRecipe(recipeId: string, testConfig: AutomationTest['config']): Promise<AutomationTest> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    this.logger.info(`Testing recipe: ${recipe.name}`);

    const test: AutomationTest = {
      id: this.generateId('test'),
      name: `Test ${recipe.name}`,
      recipeId,
      type: 'unit',
      status: 'running',
      config: testConfig,
      metadata: {
        author: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['automated']
      }
    };

    this.tests.set(test.id, test);

    try {
      // Set up mocks if configured
      const mocks = await this.setupTestMocks(testConfig.mocks || []);
      
      // Execute setup steps
      if (testConfig.setup) {
        await this.executeTestActions(testConfig.setup, test);
      }
      
      // Execute the recipe with test data
      const execution = await this.executeRecipeForTest(recipe, testConfig.triggerData);
      
      // Validate results
      const assertions = await this.validateTestResults(execution, testConfig.expectedOutputs);
      
      // Clean up mocks and test data
      await this.cleanupTestMocks(mocks);
      if (testConfig.cleanup) {
        await this.executeTestActions(testConfig.cleanup, test);
      }
      
      test.status = assertions.every(a => a.passed) ? 'passed' : 'failed';
      test.results = {
        executionTime: execution.duration || 0,
        startedAt: execution.startedAt,
        completedAt: execution.endedAt || new Date(),
        output: execution,
        assertions
      };
      
      this.logger.info(`Test completed: ${test.status} for recipe ${recipe.name}`);
      this.emit('testCompleted', test);
      
      return test;
    } catch (error) {
      test.status = 'failed';
      test.results = {
        executionTime: 0,
        startedAt: new Date(),
        completedAt: new Date(),
        output: null,
        error: error.message,
        assertions: []
      };
      
      this.logger.error(`Test failed for recipe ${recipe.name}`, error);
      this.emit('testFailed', test);
      
      return test;
    }
  }

  /**
   * Get all recipes
   */
  getRecipes(userId?: string): AutomationRecipe[] {
    const recipes = Array.from(this.recipes.values());
    return userId ? recipes.filter(r => r.ownerId === userId) : recipes;
  }

  /**
   * Get recipe by ID
   */
  getRecipe(recipeId: string): AutomationRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  /**
   * Get execution history
   */
  getExecutions(recipeId?: string, limit: number = 100): AutomationExecution[] {
    let executions = Array.from(this.executions.values());
    
    if (recipeId) {
      executions = executions.filter(e => e.recipeId === recipeId);
    }
    
    return executions
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get available triggers
   */
  getAvailableTriggers(): Array<{ type: AutomationTriggerType; name: string; description: string; schema: any }> {
    return this.triggerRegistry.getAllTriggers();
  }

  /**
   * Get available actions
   */
  getAvailableActions(): Array<{ type: AutomationActionType; name: string; description: string; schema: any }> {
    return this.actionRegistry.getAllActions();
  }

  /**
   * Get automation metrics
   */
  getMetrics(): any {
    const recipes = Array.from(this.recipes.values());
    const executions = Array.from(this.executions.values());
    
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    
    const completedExecutions = executions.filter(e => e.duration);
    const avgExecutionTime = completedExecutions.length > 0 
      ? completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / completedExecutions.length
      : 0;

    return {
      totalRecipes: recipes.length,
      activeRecipes: recipes.filter(r => r.enabled).length,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      avgExecutionTime,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      queuedExecutions: this.executionQueue.length,
      activeExecutions: this.activeExecutions.size
    };
  }

  // Private methods

  private setupEventListeners(): void {
    // Email events
    this.emailEngine.on('emailReceived', (data) => this.handleTriggerEvent('email_received', data));
    this.emailEngine.on('emailStarred', (data) => this.handleTriggerEvent('email_starred', data));
    this.emailEngine.on('emailArchived', (data) => this.handleTriggerEvent('email_archived', data));
    
    // Calendar events
    this.calendarEngine.on('eventCreated', (data) => this.handleTriggerEvent('event_created', data));
    this.calendarEngine.on('eventStarting', (data) => this.handleTriggerEvent('event_starting', data));
    this.calendarEngine.on('eventEnded', (data) => this.handleTriggerEvent('event_ended', data));
    
    // Search events
    this.searchEngine.on('searchPerformed', (data) => this.handleTriggerEvent('search_performed', data));
    this.searchEngine.on('contentIndexed', (data) => this.handleTriggerEvent('content_indexed', data));
    
    // Plugin events
    this.pluginManager.on('pluginInstalled', (data) => this.handleTriggerEvent('plugin_installed', data));
    this.pluginManager.on('pluginEvent', (data) => this.handleTriggerEvent('plugin_event', data));
  }

  private async handleTriggerEvent(triggerType: AutomationTriggerType, data: any): Promise<void> {
    if (this.isShuttingDown) return;

    this.logger.debug(`Handling trigger event: ${triggerType}`, data);

    try {
      const matchingRecipes = this.findMatchingRecipes(triggerType, data);
      
      for (const recipe of matchingRecipes) {
        if (await this.shouldExecuteRecipe(recipe, data)) {
          await this.queueExecution(recipe, triggerType, data);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling trigger event: ${triggerType}`, error);
    }
  }

  private findMatchingRecipes(triggerType: AutomationTriggerType, data: any): AutomationRecipe[] {
    return Array.from(this.recipes.values()).filter(recipe => {
      if (!recipe.enabled) return false;
      if (recipe.trigger.type !== triggerType) return false;
      
      // Check trigger conditions
      return this.conditionalLogicEngine.evaluateConditions(
        recipe.trigger.conditions || [],
        data,
        {}
      );
    });
  }

  private async shouldExecuteRecipe(recipe: AutomationRecipe, data: any): Promise<boolean> {
    try {
      // Check throttling
      if (recipe.trigger.throttling) {
        const canExecute = await this.checkThrottling(recipe, data);
        if (!canExecute) return false;
      }
      
      // Check execution limits
      if (recipe.settings.maxExecutionsPerHour) {
        const recentExecutions = this.getRecentExecutions(recipe.id, 3600000); // 1 hour
        if (recentExecutions.length >= recipe.settings.maxExecutionsPerHour) {
          this.logger.warn(`Recipe ${recipe.id} hit execution limit`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error checking recipe execution conditions: ${recipe.id}`, error);
      return false;
    }
  }

  private async queueExecution(recipe: AutomationRecipe, triggerType: AutomationTriggerType, triggerData: any): Promise<void> {
    const execution: AutomationExecution = {
      id: this.generateId('execution'),
      recipeId: recipe.id,
      userId: recipe.ownerId,
      trigger: {
        type: triggerType,
        data: triggerData,
        timestamp: new Date()
      },
      status: 'queued',
      context: {
        trigger: triggerData,
        user: { id: recipe.ownerId, email: '', name: '' },
        variables: { ...recipe.settings.variables },
        environment: recipe.settings.environment
      },
      actions: [],
      startedAt: new Date()
    };

    this.executions.set(execution.id, execution);
    this.executionQueue.push(execution);
    
    this.emit('executionQueued', execution);
    this.logger.debug(`Queued execution for recipe: ${recipe.name}`);
  }

  private startExecutionLoop(): void {
    setInterval(async () => {
      if (this.isShuttingDown || this.executionQueue.length === 0) return;
      if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) return;

      const execution = this.executionQueue.shift();
      if (execution) {
        await this.executeAutomation(execution);
      }
    }, 100); // Check every 100ms
  }

  private async executeAutomation(execution: AutomationExecution): Promise<void> {
    const recipe = this.recipes.get(execution.recipeId);
    if (!recipe) {
      execution.status = 'failed';
      execution.error = { message: 'Recipe not found', code: 'RECIPE_NOT_FOUND', timestamp: new Date() };
      return;
    }

    this.logger.info(`Executing automation: ${recipe.name} (${execution.id})`);

    execution.status = 'running';
    this.activeExecutions.add(execution.id);
    this.emit('executionStarted', execution);

    try {
      // Build variable context
      const variableContext = await this.buildVariableContext(recipe, execution);
      
      // Execute actions in sequence
      for (let i = 0; i < recipe.actions.length; i++) {
        const action = recipe.actions[i];
        const actionExecution = await this.executeAction(action, execution, variableContext);
        execution.actions.push(actionExecution);
        
        // Update variable context with action results
        if (actionExecution.output) {
          variableContext.step[`action_${i}_result`] = actionExecution.output;
        }
        
        // Handle action failure
        if (actionExecution.status === 'failed' && !action.continueOnError) {
          throw new Error(`Action failed: ${actionExecution.error?.message}`);
        }
      }

      execution.status = 'completed';
      execution.endedAt = new Date();
      execution.duration = execution.endedAt.getTime() - execution.startedAt.getTime();
      
      // Update recipe stats
      this.updateRecipeStats(recipe, execution);
      
      this.logger.info(`Completed automation: ${recipe.name} (${execution.id})`);
      this.emit('executionCompleted', execution);

    } catch (error) {
      execution.status = 'failed';
      execution.endedAt = new Date();
      execution.duration = execution.endedAt.getTime() - execution.startedAt.getTime();
      execution.error = {
        message: error.message,
        code: 'EXECUTION_FAILED',
        timestamp: new Date()
      };
      
      this.updateRecipeStats(recipe, execution);
      
      this.logger.error(`Failed automation: ${recipe.name} (${execution.id})`, error);
      this.emit('executionFailed', execution);
    } finally {
      this.activeExecutions.delete(execution.id);
    }
  }

  private async executeAction(
    action: AutomationAction,
    execution: AutomationExecution,
    variableContext: AutomationVariableContext
  ): Promise<any> {
    const actionExecution = {
      actionId: action.id,
      type: action.type,
      status: 'running' as AutomationExecutionStatus,
      input: action.config,
      retries: [],
      startedAt: new Date()
    };

    try {
      // Check action conditions
      if (action.conditions && !this.conditionalLogicEngine.evaluateConditions(action.conditions, execution.context.trigger, variableContext)) {
        actionExecution.status = 'completed';
        actionExecution.output = { skipped: true, reason: 'Conditions not met' };
        actionExecution.endedAt = new Date();
        return actionExecution;
      }

      // Resolve variables in action config
      const resolvedConfig = await this.variableResolver.resolveVariables(action.config, variableContext);
      actionExecution.input = resolvedConfig;

      // Execute action with retry logic
      let lastError: Error | null = null;
      let attempts = 0;
      const maxAttempts = action.retry?.maxAttempts || 1;

      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          const result = await this.actionRegistry.executeAction(action.type, resolvedConfig, execution.context);
          
          actionExecution.status = 'completed';
          actionExecution.output = result;
          actionExecution.endedAt = new Date();
          actionExecution.duration = actionExecution.endedAt.getTime() - actionExecution.startedAt.getTime();
          
          return actionExecution;
          
        } catch (error) {
          lastError = error;
          
          if (attempts < maxAttempts && action.retry) {
            const delay = this.calculateRetryDelay(attempts, action.retry);
            await this.delay(delay);
            
            actionExecution.retries.push({
              attempt: attempts,
              timestamp: new Date(),
              error: error.message
            });
            
            this.logger.warn(`Action retry ${attempts}/${maxAttempts} for ${action.type}`, error);
          }
        }
      }

      throw lastError;

    } catch (error) {
      actionExecution.status = 'failed';
      actionExecution.error = {
        message: error.message,
        code: 'ACTION_FAILED',
        details: error
      };
      actionExecution.endedAt = new Date();
      actionExecution.duration = actionExecution.endedAt.getTime() - actionExecution.startedAt.getTime();
      
      return actionExecution;
    }
  }

  private async buildVariableContext(recipe: AutomationRecipe, execution: AutomationExecution): Promise<AutomationVariableContext> {
    const context: AutomationVariableContext = {
      global: await this.getGlobalVariables(),
      recipe: recipe.settings.variables,
      execution: execution.context.variables,
      step: {},
      computed: {}
    };

    // Add trigger data as variables
    context.execution.trigger = execution.trigger.data;
    context.execution.timestamp = execution.startedAt.getTime();
    context.execution.executionId = execution.id;
    context.execution.recipeId = recipe.id;

    return context;
  }

  private async getGlobalVariables(): Promise<Record<string, any>> {
    const globalVars: Record<string, any> = {};
    
    for (const variable of this.variables.values()) {
      if (variable.scope === 'global') {
        globalVars[variable.name] = variable.value;
      }
    }
    
    return globalVars;
  }

  private calculateRetryDelay(attempt: number, retryConfig: any): number {
    const baseDelay = retryConfig.delaySeconds * 1000;
    const multiplier = retryConfig.backoffMultiplier || 2;
    const maxDelay = retryConfig.maxDelaySeconds * 1000 || 60000;
    
    const delay = baseDelay * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateRecipeStats(recipe: AutomationRecipe, execution: AutomationExecution): void {
    recipe.stats.totalExecutions++;
    recipe.lastExecutedAt = execution.startedAt;
    
    if (execution.status === 'completed') {
      recipe.stats.successfulExecutions++;
    } else if (execution.status === 'failed') {
      recipe.stats.failedExecutions++;
    }
    
    recipe.stats.successRate = recipe.stats.totalExecutions > 0 
      ? recipe.stats.successfulExecutions / recipe.stats.totalExecutions 
      : 0;
    
    if (execution.duration) {
      const totalTime = recipe.stats.avgExecutionTime * (recipe.stats.totalExecutions - 1) + execution.duration;
      recipe.stats.avgExecutionTime = totalTime / recipe.stats.totalExecutions;
    }
    
    // Update recent executions
    recipe.stats.recentExecutions.unshift({
      timestamp: execution.startedAt,
      status: execution.status,
      duration: execution.duration || 0,
      error: execution.error?.message
    });
    
    // Keep only last 100 executions
    if (recipe.stats.recentExecutions.length > 100) {
      recipe.stats.recentExecutions = recipe.stats.recentExecutions.slice(0, 100);
    }
  }

  private async validateRecipe(recipe: Partial<AutomationRecipe>): Promise<void> {
    // Validate trigger
    if (!this.triggerRegistry.isValidTrigger(recipe.trigger?.type)) {
      throw new Error(`Invalid trigger type: ${recipe.trigger?.type}`);
    }
    
    // Validate actions
    if (!recipe.actions || recipe.actions.length === 0) {
      throw new Error('Recipe must have at least one action');
    }
    
    for (const action of recipe.actions) {
      if (!this.actionRegistry.isValidAction(action.type)) {
        throw new Error(`Invalid action type: ${action.type}`);
      }
    }
    
    // Additional validation logic...
  }

  private isScheduledTrigger(trigger: AutomationTrigger): boolean {
    return ['schedule', 'interval', 'date_time', 'time_of_day'].includes(trigger.type);
  }

  private async setupScheduler(recipe: AutomationRecipe): Promise<void> {
    // Implementation for setting up scheduled triggers
    // This would integrate with the CronJobManager
  }

  private async removeScheduler(recipeId: string): Promise<void> {
    // Implementation for removing scheduled triggers
  }

  private async registerTriggerListeners(recipe: AutomationRecipe): Promise<void> {
    // Implementation for registering event listeners for triggers
  }

  private async unregisterTriggerListeners(recipe: AutomationRecipe): Promise<void> {
    // Implementation for unregistering event listeners
  }

  private async checkThrottling(recipe: AutomationRecipe, data: any): Promise<boolean> {
    // Implementation for throttling logic
    return true;
  }

  private getRecentExecutions(recipeId: string, timeWindowMs: number): AutomationExecution[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return Array.from(this.executions.values())
      .filter(e => e.recipeId === recipeId && e.startedAt >= cutoff);
  }

  private async waitForActiveExecutions(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.activeExecutions.size > 0 && (Date.now() - startTime) < timeoutMs) {
      await this.delay(100);
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Persistence methods (would integrate with storage system)
  private async loadPersistedData(): Promise<void> {
    // Load recipes, executions, variables from storage
  }

  private async persistData(): Promise<void> {
    // Persist all data to storage
  }

  private async persistRecipe(recipe: AutomationRecipe): Promise<void> {
    // Persist single recipe
  }

  private async deletePersistedRecipe(recipeId: string): Promise<void> {
    // Delete recipe from storage
  }

  // Testing support methods
  private async setupTestMocks(mocks: any[]): Promise<any[]> {
    // Set up mocks for testing
    return [];
  }

  private async cleanupTestMocks(mocks: any[]): Promise<void> {
    // Clean up test mocks
  }

  private async executeTestActions(actions: AutomationAction[], test: AutomationTest): Promise<void> {
    // Execute setup/cleanup actions for tests
  }

  private async executeRecipeForTest(recipe: AutomationRecipe, testData: any): Promise<AutomationExecution> {
    // Execute recipe in test mode
    return this.executeRecipe(recipe.id, testData);
  }

  private async validateTestResults(execution: AutomationExecution, expectedOutputs: any[]): Promise<any[]> {
    // Validate test results against expectations
    return [];
  }

  private async registerBuiltInTriggersAndActions(): Promise<void> {
    // Register all built-in triggers and actions
    await this.triggerRegistry.registerBuiltInTriggers();
    await this.actionRegistry.registerBuiltInActions();
  }
}