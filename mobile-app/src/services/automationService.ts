/**
 * Mobile Automation Service - Background execution and mobile-specific automation handling
 * 
 * This service provides:
 * - Background automation execution
 * - Mobile notification triggers
 * - Contact and calendar integration
 * - Offline automation queuing
 * - Battery and performance optimization
 * - Native mobile features integration
 */

import { EventEmitter } from 'events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import BackgroundJob from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import Contacts from 'react-native-contacts';
import { Linking, AppState, AppStateStatus } from 'react-native';

import {
  AutomationRecipe,
  AutomationExecution,
  AutomationTriggerType,
  AutomationActionType,
  AutomationExecutionStatus
} from '@flow-desk/shared';

import { notificationService } from './notificationService';
import { networkMonitor } from './networkMonitor';

interface QueuedExecution {
  id: string;
  recipeId: string;
  triggerType: AutomationTriggerType;
  triggerData: any;
  timestamp: Date;
  retries: number;
}

interface MobileAutomationConfig {
  backgroundExecution: boolean;
  batterySaver: boolean;
  wifiOnly: boolean;
  maxRetries: number;
  executionTimeout: number;
  notificationTriggers: boolean;
  contactIntegration: boolean;
  calendarIntegration: boolean;
}

export class MobileAutomationService extends EventEmitter {
  private recipes = new Map<string, AutomationRecipe>();
  private executions = new Map<string, AutomationExecution>();
  private executionQueue: QueuedExecution[] = [];
  private isOnline = true;
  private appState: AppStateStatus = 'active';
  private config: MobileAutomationConfig;
  private backgroundTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    super();
    
    this.config = {
      backgroundExecution: true,
      batterySaver: false,
      wifiOnly: false,
      maxRetries: 3,
      executionTimeout: 30000,
      notificationTriggers: true,
      contactIntegration: true,
      calendarIntegration: true
    };
    
    this.setupEventListeners();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load persisted data
      await this.loadPersistedData();
      
      // Set up network monitoring
      this.setupNetworkMonitoring();
      
      // Set up app state monitoring
      this.setupAppStateMonitoring();
      
      // Set up notification listeners
      this.setupNotificationListeners();
      
      // Start background execution if enabled
      if (this.config.backgroundExecution) {
        this.startBackgroundExecution();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize automation service:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop background execution
      this.stopBackgroundExecution();
      
      // Persist data
      await this.persistData();
      
      // Remove listeners
      this.removeAllListeners();
      
      this.isInitialized = false;
      this.emit('shutdown');
    } catch (error) {
      console.error('Failed to shutdown automation service:', error);
      throw error;
    }
  }

  // Recipe Management

  async createRecipe(recipeData: Omit<AutomationRecipe, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<AutomationRecipe> {
    const recipe: AutomationRecipe = {
      ...recipeData,
      id: `recipe_${Date.now()}`,
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
    await this.persistRecipe(recipe);
    
    // Set up mobile-specific triggers
    await this.setupMobileTriggers(recipe);
    
    this.emit('recipeCreated', recipe);
    return recipe;
  }

  async updateRecipe(recipeId: string, updates: Partial<AutomationRecipe>): Promise<AutomationRecipe> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    const updatedRecipe = { ...recipe, ...updates, updatedAt: new Date() };
    this.recipes.set(recipeId, updatedRecipe);
    await this.persistRecipe(updatedRecipe);
    
    this.emit('recipeUpdated', updatedRecipe);
    return updatedRecipe;
  }

  async deleteRecipe(recipeId: string): Promise<void> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    // Clean up mobile triggers
    await this.cleanupMobileTriggers(recipe);
    
    // Remove from memory and storage
    this.recipes.delete(recipeId);
    await this.deletePersistedRecipe(recipeId);
    
    this.emit('recipeDeleted', recipe);
  }

  getRecipes(): AutomationRecipe[] {
    return Array.from(this.recipes.values());
  }

  getRecipe(recipeId: string): AutomationRecipe | undefined {
    return this.recipes.get(recipeId);
  }

  // Execution Management

  async executeRecipe(recipeId: string, triggerData: any = {}): Promise<AutomationExecution> {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeId}`);
    }

    if (!recipe.enabled) {
      throw new Error(`Recipe is disabled: ${recipeId}`);
    }

    const execution: AutomationExecution = {
      id: `execution_${Date.now()}`,
      recipeId,
      userId: recipe.ownerId,
      trigger: {
        type: 'manual',
        data: triggerData,
        timestamp: new Date()
      },
      status: 'queued',
      context: {
        trigger: triggerData,
        user: { id: recipe.ownerId, email: '', name: '' },
        variables: {},
        environment: 'mobile'
      },
      actions: [],
      startedAt: new Date()
    };

    this.executions.set(execution.id, execution);
    
    // Execute immediately if online and in foreground, otherwise queue
    if (this.canExecuteImmediately()) {
      await this.executeAutomation(execution);
    } else {
      await this.queueExecution(execution);
    }
    
    return execution;
  }

  private async executeAutomation(execution: AutomationExecution): Promise<void> {
    const recipe = this.recipes.get(execution.recipeId);
    if (!recipe) {
      execution.status = 'failed';
      execution.error = { message: 'Recipe not found', code: 'RECIPE_NOT_FOUND', timestamp: new Date() };
      return;
    }

    execution.status = 'running';
    this.emit('executionStarted', execution);

    try {
      // Execute actions sequentially
      for (const action of recipe.actions) {
        const actionResult = await this.executeAction(action, execution);
        execution.actions.push(actionResult);
        
        // Stop on failure unless configured to continue
        if (actionResult.status === 'failed' && !action.continueOnError) {
          throw new Error(`Action failed: ${actionResult.error?.message}`);
        }
      }

      execution.status = 'completed';
      execution.endedAt = new Date();
      execution.duration = execution.endedAt.getTime() - execution.startedAt.getTime();
      
      // Update recipe stats
      this.updateRecipeStats(recipe, execution);
      
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
      this.emit('executionFailed', execution);
    }
  }

  private async executeAction(action: any, execution: AutomationExecution): Promise<any> {
    const actionExecution = {
      actionId: action.id,
      type: action.type,
      status: 'running' as AutomationExecutionStatus,
      input: action.config,
      startedAt: new Date()
    };

    try {
      let result;
      
      switch (action.type) {
        case 'send_notification':
          result = await this.executeSendNotificationAction(action.config);
          break;
          
        case 'send_message':
          result = await this.executeSendMessageAction(action.config);
          break;
          
        case 'create_contact':
          result = await this.executeCreateContactAction(action.config);
          break;
          
        case 'create_calendar_event':
          result = await this.executeCreateCalendarEventAction(action.config);
          break;
          
        case 'open_url':
          result = await this.executeOpenUrlAction(action.config);
          break;
          
        case 'wait':
          result = await this.executeWaitAction(action.config);
          break;
          
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }

      actionExecution.status = 'completed';
      actionExecution.output = result;
      actionExecution.endedAt = new Date();
      actionExecution.duration = actionExecution.endedAt.getTime() - actionExecution.startedAt.getTime();
      
      return actionExecution;
      
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

  // Mobile-specific Action Implementations

  private async executeSendNotificationAction(config: any): Promise<any> {
    await notificationService.show({
      title: config.title,
      body: config.body,
      priority: config.priority || 'normal',
      timeout: config.timeout || 5000
    });

    return {
      success: true,
      title: config.title,
      timestamp: new Date().toISOString()
    };
  }

  private async executeSendMessageAction(config: any): Promise<any> {
    // This would integrate with messaging apps through deep links or APIs
    const messageUrl = this.buildMessageUrl(config.platform, config.message);
    await Linking.openURL(messageUrl);

    return {
      success: true,
      platform: config.platform,
      messageUrl,
      timestamp: new Date().toISOString()
    };
  }

  private async executeCreateContactAction(config: any): Promise<any> {
    if (!this.config.contactIntegration) {
      throw new Error('Contact integration is disabled');
    }

    const contact = {
      recordID: '',
      backTitle: '',
      company: config.company || '',
      emailAddresses: [{
        label: 'work',
        email: config.email || ''
      }],
      familyName: config.lastName || '',
      givenName: config.firstName || '',
      phoneNumbers: [{
        label: 'work',
        number: config.phone || ''
      }]
    };

    const newContact = await Contacts.addContact(contact);

    return {
      success: true,
      contactId: newContact.recordID,
      name: `${config.firstName} ${config.lastName}`,
      timestamp: new Date().toISOString()
    };
  }

  private async executeCreateCalendarEventAction(config: any): Promise<any> {
    // This would integrate with the calendar service
    const eventUrl = this.buildCalendarEventUrl(config);
    await Linking.openURL(eventUrl);

    return {
      success: true,
      title: config.title,
      startTime: config.startTime,
      timestamp: new Date().toISOString()
    };
  }

  private async executeOpenUrlAction(config: any): Promise<any> {
    const canOpen = await Linking.canOpenURL(config.url);
    if (!canOpen) {
      throw new Error(`Cannot open URL: ${config.url}`);
    }

    await Linking.openURL(config.url);

    return {
      success: true,
      url: config.url,
      timestamp: new Date().toISOString()
    };
  }

  private async executeWaitAction(config: any): Promise<any> {
    let duration = config.duration;
    
    // Convert to milliseconds
    switch (config.unit) {
      case 'seconds':
        duration *= 1000;
        break;
      case 'minutes':
        duration *= 60000;
        break;
    }

    await new Promise(resolve => setTimeout(resolve, duration));

    return {
      success: true,
      waited: duration,
      unit: 'milliseconds',
      timestamp: new Date().toISOString()
    };
  }

  // Background Execution

  private startBackgroundExecution(): void {
    this.backgroundTimer = setInterval(async () => {
      if (this.executionQueue.length === 0) return;
      if (!this.canExecuteInBackground()) return;

      const queuedExecution = this.executionQueue.shift();
      if (queuedExecution) {
        await this.processQueuedExecution(queuedExecution);
      }
    }, 5000); // Check every 5 seconds
  }

  private stopBackgroundExecution(): void {
    if (this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }
  }

  private async queueExecution(execution: AutomationExecution): Promise<void> {
    const queuedExecution: QueuedExecution = {
      id: execution.id,
      recipeId: execution.recipeId,
      triggerType: execution.trigger.type,
      triggerData: execution.trigger.data,
      timestamp: execution.startedAt,
      retries: 0
    };

    this.executionQueue.push(queuedExecution);
    await this.persistExecutionQueue();
    
    this.emit('executionQueued', execution);
  }

  private async processQueuedExecution(queuedExecution: QueuedExecution): Promise<void> {
    try {
      const execution = this.executions.get(queuedExecution.id);
      if (!execution) return;

      await this.executeAutomation(execution);
    } catch (error) {
      queuedExecution.retries++;
      
      if (queuedExecution.retries < this.config.maxRetries) {
        // Re-queue for retry
        this.executionQueue.push(queuedExecution);
      } else {
        // Mark as failed
        const execution = this.executions.get(queuedExecution.id);
        if (execution) {
          execution.status = 'failed';
          execution.error = {
            message: 'Max retries exceeded',
            code: 'MAX_RETRIES_EXCEEDED',
            timestamp: new Date()
          };
          this.emit('executionFailed', execution);
        }
      }
    }
  }

  // Mobile Trigger Setup

  private async setupMobileTriggers(recipe: AutomationRecipe): Promise<void> {
    switch (recipe.trigger.type) {
      case 'notification_received':
        await this.setupNotificationTrigger(recipe);
        break;
        
      case 'app_opened':
        await this.setupAppOpenedTrigger(recipe);
        break;
        
      case 'location_entered':
      case 'location_exited':
        await this.setupLocationTrigger(recipe);
        break;
        
      case 'time_of_day':
        await this.setupTimeOfDayTrigger(recipe);
        break;
    }
  }

  private async cleanupMobileTriggers(recipe: AutomationRecipe): Promise<void> {
    // Clean up any mobile-specific triggers
    // This would vary based on trigger type
  }

  private async setupNotificationTrigger(recipe: AutomationRecipe): Promise<void> {
    // Set up notification listener for this recipe
    // This would integrate with the notification service
  }

  private async setupAppOpenedTrigger(recipe: AutomationRecipe): Promise<void> {
    // This trigger fires when the app comes to foreground
    // Already handled in app state monitoring
  }

  private async setupLocationTrigger(recipe: AutomationRecipe): Promise<void> {
    // Set up geofencing for location-based triggers
    // This would require location permissions and geofencing setup
  }

  private async setupTimeOfDayTrigger(recipe: AutomationRecipe): Promise<void> {
    // Set up scheduled notification for time-based triggers
    const config = recipe.trigger.config;
    
    PushNotification.localNotificationSchedule({
      title: 'Automation Trigger',
      message: `Time to run: ${recipe.name}`,
      date: new Date(config.time),
      repeatType: config.repeat || 'day',
      userInfo: { recipeId: recipe.id, triggerType: 'time_of_day' }
    });
  }

  // Event Listeners Setup

  private setupEventListeners(): void {
    // Set up various event listeners for mobile-specific events
  }

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      
      if (this.isOnline) {
        // Process queued executions when coming back online
        this.processQueuedExecutionsOnline();
      }
      
      this.emit('networkStateChanged', state);
    });
  }

  private setupAppStateMonitoring(): void {
    AppState.addEventListener('change', (nextAppState) => {
      const previousState = this.appState;
      this.appState = nextAppState;
      
      if (previousState === 'background' && nextAppState === 'active') {
        // App came to foreground
        this.handleAppOpened();
      }
      
      this.emit('appStateChanged', nextAppState);
    });
  }

  private setupNotificationListeners(): void {
    PushNotification.configure({
      onNotification: (notification) => {
        if (notification.userInfo?.recipeId) {
          // This is an automation trigger notification
          this.handleAutomationTrigger(
            notification.userInfo.recipeId,
            notification.userInfo.triggerType,
            notification
          );
        }
      },
    });
  }

  private async handleAppOpened(): Promise<void> {
    // Find recipes with app_opened triggers
    const appOpenedRecipes = Array.from(this.recipes.values())
      .filter(r => r.enabled && r.trigger.type === 'app_opened');
    
    for (const recipe of appOpenedRecipes) {
      await this.executeRecipe(recipe.id, { timestamp: new Date() });
    }
  }

  private async handleAutomationTrigger(
    recipeId: string,
    triggerType: string,
    triggerData: any
  ): Promise<void> {
    try {
      await this.executeRecipe(recipeId, triggerData);
    } catch (error) {
      console.error(`Failed to execute triggered automation ${recipeId}:`, error);
    }
  }

  private async processQueuedExecutionsOnline(): Promise<void> {
    // Process any queued executions when coming back online
    const queueCopy = [...this.executionQueue];
    this.executionQueue = [];
    
    for (const queuedExecution of queueCopy) {
      await this.processQueuedExecution(queuedExecution);
    }
  }

  // Helper Methods

  private canExecuteImmediately(): boolean {
    if (!this.isOnline && this.config.wifiOnly) return false;
    if (this.config.batterySaver && this.appState === 'background') return false;
    return true;
  }

  private canExecuteInBackground(): boolean {
    if (!this.config.backgroundExecution) return false;
    if (!this.isOnline && this.config.wifiOnly) return false;
    return true;
  }

  private buildMessageUrl(platform: string, message: string): string {
    switch (platform) {
      case 'whatsapp':
        return `whatsapp://send?text=${encodeURIComponent(message)}`;
      case 'telegram':
        return `tg://msg?text=${encodeURIComponent(message)}`;
      case 'sms':
        return `sms:?body=${encodeURIComponent(message)}`;
      default:
        throw new Error(`Unsupported messaging platform: ${platform}`);
    }
  }

  private buildCalendarEventUrl(config: any): string {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: config.title,
      dates: `${config.startTime}/${config.endTime}`,
      details: config.description || ''
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
    
    if (recipe.stats.recentExecutions.length > 50) {
      recipe.stats.recentExecutions = recipe.stats.recentExecutions.slice(0, 50);
    }

    // Persist updated recipe
    this.persistRecipe(recipe);
  }

  // Persistence Methods

  private async loadPersistedData(): Promise<void> {
    try {
      const [recipesData, executionsData, queueData] = await Promise.all([
        AsyncStorage.getItem('automation_recipes'),
        AsyncStorage.getItem('automation_executions'),
        AsyncStorage.getItem('automation_queue')
      ]);

      if (recipesData) {
        const recipes: AutomationRecipe[] = JSON.parse(recipesData);
        recipes.forEach(recipe => {
          // Convert date strings back to Date objects
          recipe.createdAt = new Date(recipe.createdAt);
          recipe.updatedAt = new Date(recipe.updatedAt);
          if (recipe.lastExecutedAt) {
            recipe.lastExecutedAt = new Date(recipe.lastExecutedAt);
          }
          this.recipes.set(recipe.id, recipe);
        });
      }

      if (executionsData) {
        const executions: AutomationExecution[] = JSON.parse(executionsData);
        executions.forEach(execution => {
          execution.startedAt = new Date(execution.startedAt);
          if (execution.endedAt) {
            execution.endedAt = new Date(execution.endedAt);
          }
          execution.trigger.timestamp = new Date(execution.trigger.timestamp);
          this.executions.set(execution.id, execution);
        });
      }

      if (queueData) {
        this.executionQueue = JSON.parse(queueData).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load persisted automation data:', error);
    }
  }

  private async persistData(): Promise<void> {
    try {
      await Promise.all([
        this.persistRecipes(),
        this.persistExecutions(),
        this.persistExecutionQueue()
      ]);
    } catch (error) {
      console.error('Failed to persist automation data:', error);
    }
  }

  private async persistRecipes(): Promise<void> {
    const recipes = Array.from(this.recipes.values());
    await AsyncStorage.setItem('automation_recipes', JSON.stringify(recipes));
  }

  private async persistRecipe(recipe: AutomationRecipe): Promise<void> {
    // Update the recipe in the map and persist all recipes
    this.recipes.set(recipe.id, recipe);
    await this.persistRecipes();
  }

  private async deletePersistedRecipe(recipeId: string): Promise<void> {
    await this.persistRecipes(); // This will exclude the deleted recipe
  }

  private async persistExecutions(): Promise<void> {
    const executions = Array.from(this.executions.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 100); // Keep only last 100 executions
    
    await AsyncStorage.setItem('automation_executions', JSON.stringify(executions));
  }

  private async persistExecutionQueue(): Promise<void> {
    await AsyncStorage.setItem('automation_queue', JSON.stringify(this.executionQueue));
  }

  // Public API Methods

  getExecutions(recipeId?: string, limit: number = 50): AutomationExecution[] {
    let executions = Array.from(this.executions.values());
    
    if (recipeId) {
      executions = executions.filter(e => e.recipeId === recipeId);
    }
    
    return executions
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  getStats(): any {
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
      queuedExecutions: this.executionQueue.length
    };
  }

  updateConfig(config: Partial<MobileAutomationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Apply config changes
    if (config.backgroundExecution !== undefined) {
      if (config.backgroundExecution && !this.backgroundTimer) {
        this.startBackgroundExecution();
      } else if (!config.backgroundExecution && this.backgroundTimer) {
        this.stopBackgroundExecution();
      }
    }
  }

  getConfig(): MobileAutomationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const automationService = new MobileAutomationService();