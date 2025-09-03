/**
 * Trigger Registry - Manages all automation triggers
 * 
 * This registry handles:
 * - Built-in system triggers (email, calendar, file system, etc.)
 * - Plugin-provided triggers
 * - Trigger validation and execution
 * - Event listener management
 */

import { EventEmitter } from 'events';
import { AutomationTriggerType } from '@flow-desk/shared';
import { AutomationEngine } from './AutomationEngine';
import { EmailEngine } from '../email/EmailEngine';
import { CalendarEngine } from '../calendar/CalendarEngine';
import { LocalSearchEngine as SearchEngine } from '../search/SearchEngine';
import { FileSystemWatcher } from './FileSystemWatcher';
import * as fs from 'fs';
import * as path from 'path';

interface TriggerDefinition {
  type: AutomationTriggerType;
  name: string;
  description: string;
  schema: any;
  executor: (config: any, context: any) => Promise<boolean>;
  validator: (config: any) => boolean;
}

export class TriggerRegistry extends EventEmitter {
  private readonly triggers = new Map<AutomationTriggerType, TriggerDefinition>();
  private readonly automationEngine: AutomationEngine;
  private readonly fileWatcher: FileSystemWatcher;
  private readonly activeListeners = new Map<string, () => void>();

  constructor(automationEngine: AutomationEngine) {
    super();
    this.automationEngine = automationEngine;
    this.fileWatcher = new FileSystemWatcher();
  }

  async initialize(): Promise<void> {
    await this.fileWatcher.initialize();
    this.setupFileWatcherEvents();
  }

  async shutdown(): Promise<void> {
    await this.fileWatcher.shutdown();
    this.removeAllListeners();
  }

  /**
   * Register built-in triggers
   */
  async registerBuiltInTriggers(): Promise<void> {
    // Email triggers
    this.registerTrigger({
      type: 'email_received',
      name: 'Email Received',
      description: 'Triggered when a new email is received',
      schema: {
        type: 'object',
        properties: {
          accountIds: { type: 'array', items: { type: 'string' } },
          senderFilters: { type: 'array', items: { type: 'string' } },
          subjectFilters: { type: 'array', items: { type: 'string' } },
          hasAttachments: { type: 'boolean' }
        }
      },
      executor: this.executeEmailReceivedTrigger.bind(this),
      validator: this.validateEmailTrigger.bind(this)
    });

    this.registerTrigger({
      type: 'email_starred',
      name: 'Email Starred',
      description: 'Triggered when an email is starred',
      schema: {
        type: 'object',
        properties: {
          accountIds: { type: 'array', items: { type: 'string' } }
        }
      },
      executor: this.executeEmailStarredTrigger.bind(this),
      validator: this.validateEmailTrigger.bind(this)
    });

    // Calendar triggers
    this.registerTrigger({
      type: 'event_created',
      name: 'Event Created',
      description: 'Triggered when a calendar event is created',
      schema: {
        type: 'object',
        properties: {
          calendarIds: { type: 'array', items: { type: 'string' } },
          attendeeFilters: { type: 'array', items: { type: 'string' } },
          locationFilters: { type: 'array', items: { type: 'string' } }
        }
      },
      executor: this.executeEventCreatedTrigger.bind(this),
      validator: this.validateCalendarTrigger.bind(this)
    });

    this.registerTrigger({
      type: 'event_starting',
      name: 'Event Starting',
      description: 'Triggered when a calendar event is about to start',
      schema: {
        type: 'object',
        properties: {
          calendarIds: { type: 'array', items: { type: 'string' } },
          leadTimeMinutes: { type: 'number', minimum: 0, maximum: 1440 }
        }
      },
      executor: this.executeEventStartingTrigger.bind(this),
      validator: this.validateCalendarTrigger.bind(this)
    });

    // File system triggers
    this.registerTrigger({
      type: 'file_created',
      name: 'File Created',
      description: 'Triggered when a file is created',
      schema: {
        type: 'object',
        properties: {
          directories: { type: 'array', items: { type: 'string' } },
          patterns: { type: 'array', items: { type: 'string' } },
          fileTypes: { type: 'array', items: { type: 'string' } },
          recursive: { type: 'boolean' }
        },
        required: ['directories']
      },
      executor: this.executeFileCreatedTrigger.bind(this),
      validator: this.validateFileTrigger.bind(this)
    });

    this.registerTrigger({
      type: 'file_modified',
      name: 'File Modified',
      description: 'Triggered when a file is modified',
      schema: {
        type: 'object',
        properties: {
          directories: { type: 'array', items: { type: 'string' } },
          patterns: { type: 'array', items: { type: 'string' } },
          fileTypes: { type: 'array', items: { type: 'string' } },
          recursive: { type: 'boolean' }
        },
        required: ['directories']
      },
      executor: this.executeFileModifiedTrigger.bind(this),
      validator: this.validateFileTrigger.bind(this)
    });

    // Time-based triggers
    this.registerTrigger({
      type: 'schedule',
      name: 'Schedule',
      description: 'Triggered on a cron schedule',
      schema: {
        type: 'object',
        properties: {
          cron: { type: 'string', pattern: '^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\\d+(ns|us|µs|ms|s|m|h))+)|((((\\d+,)+\\d+|(\\d+([\/\\-])\\d+)|\\d+|\\*) ?){5,7})$' },
          timezone: { type: 'string' }
        },
        required: ['cron']
      },
      executor: this.executeScheduleTrigger.bind(this),
      validator: this.validateScheduleTrigger.bind(this)
    });

    this.registerTrigger({
      type: 'date_time',
      name: 'Date/Time',
      description: 'Triggered at a specific date and time',
      schema: {
        type: 'object',
        properties: {
          dateTime: { type: 'string', format: 'date-time' },
          timezone: { type: 'string' }
        },
        required: ['dateTime']
      },
      executor: this.executeDateTimeTrigger.bind(this),
      validator: this.validateDateTimeTrigger.bind(this)
    });

    // Communication triggers
    this.registerTrigger({
      type: 'message_received',
      name: 'Message Received',
      description: 'Triggered when a message is received',
      schema: {
        type: 'object',
        properties: {
          platforms: { type: 'array', items: { type: 'string' } },
          channels: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'array', items: { type: 'string' } }
        }
      },
      executor: this.executeMessageReceivedTrigger.bind(this),
      validator: this.validateMessageTrigger.bind(this)
    });

    // System triggers
    this.registerTrigger({
      type: 'app_opened',
      name: 'App Opened',
      description: 'Triggered when Flow Desk is opened',
      schema: {
        type: 'object',
        properties: {}
      },
      executor: this.executeAppOpenedTrigger.bind(this),
      validator: () => true
    });

    this.registerTrigger({
      type: 'search_performed',
      name: 'Search Performed',
      description: 'Triggered when a search is performed',
      schema: {
        type: 'object',
        properties: {
          queryFilters: { type: 'array', items: { type: 'string' } },
          minResultCount: { type: 'number', minimum: 0 }
        }
      },
      executor: this.executeSearchPerformedTrigger.bind(this),
      validator: this.validateSearchTrigger.bind(this)
    });

    // Webhook trigger
    this.registerTrigger({
      type: 'webhook',
      name: 'Webhook',
      description: 'Triggered by HTTP webhook',
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', pattern: '^/[a-zA-Z0-9/_-]+$' },
          methods: { type: 'array', items: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] } },
          headers: { type: 'object' },
          auth: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['none', 'basic', 'bearer', 'signature'] },
              config: { type: 'object' }
            }
          }
        },
        required: ['path']
      },
      executor: this.executeWebhookTrigger.bind(this),
      validator: this.validateWebhookTrigger.bind(this)
    });
  }

  /**
   * Register a trigger
   */
  registerTrigger(trigger: TriggerDefinition): void {
    this.triggers.set(trigger.type, trigger);
    this.emit('triggerRegistered', trigger);
  }

  /**
   * Unregister a trigger
   */
  unregisterTrigger(type: AutomationTriggerType): void {
    const trigger = this.triggers.get(type);
    if (trigger) {
      this.triggers.delete(type);
      this.emit('triggerUnregistered', trigger);
    }
  }

  /**
   * Get all triggers
   */
  getAllTriggers(): Array<{ type: AutomationTriggerType; name: string; description: string; schema: any }> {
    return Array.from(this.triggers.values()).map(trigger => ({
      type: trigger.type,
      name: trigger.name,
      description: trigger.description,
      schema: trigger.schema
    }));
  }

  /**
   * Check if a trigger type is valid
   */
  isValidTrigger(type: AutomationTriggerType): boolean {
    return this.triggers.has(type);
  }

  /**
   * Validate trigger configuration
   */
  validateTriggerConfig(type: AutomationTriggerType, config: any): boolean {
    const trigger = this.triggers.get(type);
    if (!trigger) return false;
    
    return trigger.validator(config);
  }

  /**
   * Execute trigger check
   */
  async executeTrigger(type: AutomationTriggerType, config: any, context: any): Promise<boolean> {
    const trigger = this.triggers.get(type);
    if (!trigger) {
      throw new Error(`Unknown trigger type: ${type}`);
    }

    return trigger.executor(config, context);
  }

  // Trigger executor implementations

  private async executeEmailReceivedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'emailReceived') return false;

    const email = event.data;

    // Check account filters
    if (config.accountIds && config.accountIds.length > 0) {
      if (!config.accountIds.includes(email.accountId)) return false;
    }

    // Check sender filters
    if (config.senderFilters && config.senderFilters.length > 0) {
      const senderMatch = config.senderFilters.some((filter: string) => 
        email.sender.toLowerCase().includes(filter.toLowerCase())
      );
      if (!senderMatch) return false;
    }

    // Check subject filters
    if (config.subjectFilters && config.subjectFilters.length > 0) {
      const subjectMatch = config.subjectFilters.some((filter: string) => 
        email.subject.toLowerCase().includes(filter.toLowerCase())
      );
      if (!subjectMatch) return false;
    }

    // Check attachments
    if (config.hasAttachments !== undefined) {
      if (config.hasAttachments && (!email.attachments || email.attachments.length === 0)) return false;
      if (!config.hasAttachments && email.attachments && email.attachments.length > 0) return false;
    }

    return true;
  }

  private async executeEmailStarredTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'emailStarred') return false;

    const email = event.data;

    // Check account filters
    if (config.accountIds && config.accountIds.length > 0) {
      if (!config.accountIds.includes(email.accountId)) return false;
    }

    return true;
  }

  private async executeEventCreatedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'eventCreated') return false;

    const calendarEvent = event.data;

    // Check calendar filters
    if (config.calendarIds && config.calendarIds.length > 0) {
      if (!config.calendarIds.includes(calendarEvent.calendarId)) return false;
    }

    // Check attendee filters
    if (config.attendeeFilters && config.attendeeFilters.length > 0) {
      const attendeeMatch = config.attendeeFilters.some((filter: string) => 
        calendarEvent.attendees?.some((attendee: any) => 
          attendee.email.toLowerCase().includes(filter.toLowerCase())
        )
      );
      if (!attendeeMatch) return false;
    }

    // Check location filters
    if (config.locationFilters && config.locationFilters.length > 0) {
      const locationMatch = config.locationFilters.some((filter: string) => 
        calendarEvent.location?.toLowerCase().includes(filter.toLowerCase())
      );
      if (!locationMatch) return false;
    }

    return true;
  }

  private async executeEventStartingTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'eventStarting') return false;

    const calendarEvent = event.data;
    const leadTime = config.leadTimeMinutes || 15;
    
    const now = new Date();
    const eventStart = new Date(calendarEvent.startTime);
    const timeDiff = (eventStart.getTime() - now.getTime()) / (1000 * 60); // minutes

    // Check if we're within the lead time
    if (timeDiff > leadTime || timeDiff < 0) return false;

    // Check calendar filters
    if (config.calendarIds && config.calendarIds.length > 0) {
      if (!config.calendarIds.includes(calendarEvent.calendarId)) return false;
    }

    return true;
  }

  private async executeFileCreatedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'fileCreated') return false;

    return this.matchesFileConfig(config, event.data);
  }

  private async executeFileModifiedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'fileModified') return false;

    return this.matchesFileConfig(config, event.data);
  }

  private matchesFileConfig(config: any, fileData: any): boolean {
    const { filepath } = fileData;
    
    // Check directory filters
    const matchesDirectory = config.directories.some((dir: string) => {
      if (config.recursive) {
        return filepath.startsWith(path.resolve(dir));
      } else {
        return path.dirname(filepath) === path.resolve(dir);
      }
    });
    
    if (!matchesDirectory) return false;

    // Check pattern filters
    if (config.patterns && config.patterns.length > 0) {
      const filename = path.basename(filepath);
      const matchesPattern = config.patterns.some((pattern: string) => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
        return regex.test(filename);
      });
      if (!matchesPattern) return false;
    }

    // Check file type filters
    if (config.fileTypes && config.fileTypes.length > 0) {
      const ext = path.extname(filepath).toLowerCase().substring(1);
      if (!config.fileTypes.includes(ext)) return false;
    }

    return true;
  }

  private async executeScheduleTrigger(config: any, context: any): Promise<boolean> {
    // Cron triggers are handled by the CronJobManager
    return true;
  }

  private async executeDateTimeTrigger(config: any, context: any): Promise<boolean> {
    // Date/time triggers are handled by the scheduler
    return true;
  }

  private async executeMessageReceivedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'messageReceived') return false;

    const message = event.data;

    // Check platform filters
    if (config.platforms && config.platforms.length > 0) {
      if (!config.platforms.includes(message.platform)) return false;
    }

    // Check channel filters
    if (config.channels && config.channels.length > 0) {
      if (!config.channels.includes(message.channel)) return false;
    }

    // Check keyword filters
    if (config.keywords && config.keywords.length > 0) {
      const keywordMatch = config.keywords.some((keyword: string) => 
        message.text.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!keywordMatch) return false;
    }

    return true;
  }

  private async executeAppOpenedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    return event.type === 'appOpened';
  }

  private async executeSearchPerformedTrigger(config: any, context: any): Promise<boolean> {
    const { event } = context;
    if (event.type !== 'searchPerformed') return false;

    const searchData = event.data;

    // Check query filters
    if (config.queryFilters && config.queryFilters.length > 0) {
      const queryMatch = config.queryFilters.some((filter: string) => 
        searchData.query.toLowerCase().includes(filter.toLowerCase())
      );
      if (!queryMatch) return false;
    }

    // Check minimum result count
    if (config.minResultCount !== undefined) {
      if (searchData.results.length < config.minResultCount) return false;
    }

    return true;
  }

  private async executeWebhookTrigger(config: any, context: any): Promise<boolean> {
    // Webhook triggers are handled by the webhook server
    return true;
  }

  // Trigger validators

  private validateEmailTrigger(config: any): boolean {
    // Validate email trigger configuration
    if (config.accountIds && !Array.isArray(config.accountIds)) return false;
    if (config.senderFilters && !Array.isArray(config.senderFilters)) return false;
    if (config.subjectFilters && !Array.isArray(config.subjectFilters)) return false;
    return true;
  }

  private validateCalendarTrigger(config: any): boolean {
    // Validate calendar trigger configuration
    if (config.calendarIds && !Array.isArray(config.calendarIds)) return false;
    if (config.attendeeFilters && !Array.isArray(config.attendeeFilters)) return false;
    if (config.locationFilters && !Array.isArray(config.locationFilters)) return false;
    return true;
  }

  private validateFileTrigger(config: any): boolean {
    // Validate file trigger configuration
    if (!config.directories || !Array.isArray(config.directories)) return false;
    if (config.directories.length === 0) return false;
    
    // Check if directories exist
    for (const dir of config.directories) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return false;
      }
    }
    
    if (config.patterns && !Array.isArray(config.patterns)) return false;
    if (config.fileTypes && !Array.isArray(config.fileTypes)) return false;
    return true;
  }

  private validateScheduleTrigger(config: any): boolean {
    // Validate cron expression
    if (!config.cron || typeof config.cron !== 'string') return false;
    
    // Basic cron validation (would use a proper cron library in production)
    const cronRegex = /^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\d+(ns|us|µs|ms|s|m|h))+)|((((\\d+,)+\\d+|(\\d+([\/\\-])\\d+)|\\d+|\\*) ?){5,7})$/;
    return cronRegex.test(config.cron);
  }

  private validateDateTimeTrigger(config: any): boolean {
    // Validate date/time
    if (!config.dateTime) return false;
    const date = new Date(config.dateTime);
    return !isNaN(date.getTime()) && date > new Date();
  }

  private validateMessageTrigger(config: any): boolean {
    // Validate message trigger configuration
    if (config.platforms && !Array.isArray(config.platforms)) return false;
    if (config.channels && !Array.isArray(config.channels)) return false;
    if (config.keywords && !Array.isArray(config.keywords)) return false;
    return true;
  }

  private validateSearchTrigger(config: any): boolean {
    // Validate search trigger configuration
    if (config.queryFilters && !Array.isArray(config.queryFilters)) return false;
    if (config.minResultCount !== undefined && typeof config.minResultCount !== 'number') return false;
    return true;
  }

  private validateWebhookTrigger(config: any): boolean {
    // Validate webhook configuration
    if (!config.path || typeof config.path !== 'string') return false;
    if (!config.path.startsWith('/')) return false;
    if (config.methods && !Array.isArray(config.methods)) return false;
    return true;
  }

  // File system watcher setup

  private setupFileWatcherEvents(): void {
    this.fileWatcher.on('fileCreated', (data: any) => {
      this.automationEngine.emit('trigger', 'file_created', data);
    });

    this.fileWatcher.on('fileModified', (data: any) => {
      this.automationEngine.emit('trigger', 'file_modified', data);
    });

    this.fileWatcher.on('fileDeleted', (data: any) => {
      this.automationEngine.emit('trigger', 'file_deleted', data);
    });
  }

  /**
   * Start watching directories for file triggers
   */
  async startWatching(directories: string[], options: any = {}): Promise<void> {
    for (const directory of directories) {
      this.fileWatcher.watch(directory, options);
    }
  }

  /**
   * Stop watching directories
   */
  async stopWatching(directories?: string[]): Promise<void> {
    if (directories) {
      for (const directory of directories) {
        // Find and remove watchers for this directory
        // This is a simplified implementation
        console.log(`Stopping watch for ${directory}`);
      }
    }
  }
}