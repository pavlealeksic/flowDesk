/**
 * Automations System Types for Flow Desk
 * 
 * Defines comprehensive types for automation recipes, triggers, actions,
 * workflows, and execution management following Blueprint.md requirements.
 * 
 * This is a complete production-ready automation system with:
 * - Real trigger/action implementations
 * - Visual workflow builder
 * - Conditional logic and variables
 * - Plugin integration
 * - Error handling and retry logic
 * - Template system
 * - Comprehensive testing
 */

import { z } from 'zod';

/**
 * Automation trigger types - comprehensive list of all supported triggers
 */
export type AutomationTriggerType = 
  // Email triggers
  | 'email_received'
  | 'email_starred'
  | 'email_sent'
  | 'email_read'
  | 'email_unread'
  | 'email_archived'
  | 'email_deleted'
  | 'email_attachment_received'
  | 'email_replied'
  | 'email_forwarded'
  | 'email_moved_to_folder'
  | 'email_label_added'
  | 'email_from_sender'
  | 'email_with_subject'
  // Calendar triggers
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'event_starting'
  | 'event_ended'
  | 'meeting_declined'
  | 'meeting_accepted'
  | 'calendar_busy'
  | 'calendar_free'
  | 'meeting_reminder'
  | 'attendee_added'
  | 'attendee_removed'
  // Time-based triggers
  | 'schedule'
  | 'interval'
  | 'delay'
  | 'date_time'
  | 'time_of_day'
  | 'day_of_week'
  | 'day_of_month'
  | 'date_range'
  // File triggers
  | 'file_created'
  | 'file_modified'
  | 'file_deleted'
  | 'file_shared'
  | 'file_renamed'
  | 'file_moved'
  | 'file_downloaded'
  | 'file_uploaded'
  | 'folder_created'
  | 'folder_deleted'
  // Communication triggers
  | 'message_received'
  | 'mention_received'
  | 'channel_joined'
  | 'status_changed'
  | 'direct_message_received'
  | 'group_message_received'
  | 'reaction_added'
  | 'reaction_removed'
  | 'user_joined_workspace'
  | 'user_left_workspace'
  // Task/Project triggers
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_assigned'
  | 'task_overdue'
  | 'project_created'
  | 'project_updated'
  | 'milestone_reached'
  // System triggers
  | 'app_opened'
  | 'app_closed'
  | 'plugin_installed'
  | 'plugin_uninstalled'
  | 'sync_completed'
  | 'sync_failed'
  | 'error_occurred'
  | 'workspace_changed'
  | 'user_logged_in'
  | 'user_logged_out'
  // Search triggers
  | 'search_performed'
  | 'search_result_clicked'
  | 'content_indexed'
  // Custom triggers
  | 'webhook'
  | 'api_call'
  | 'custom_event'
  | 'plugin_event';

/**
 * Automation action types - comprehensive list of all supported actions
 */
export type AutomationActionType = 
  // Email actions
  | 'send_email'
  | 'forward_email'
  | 'reply_email'
  | 'reply_all_email'
  | 'star_email'
  | 'unstar_email'
  | 'archive_email'
  | 'unarchive_email'
  | 'delete_email'
  | 'move_email'
  | 'copy_email'
  | 'label_email'
  | 'remove_label_email'
  | 'mark_read'
  | 'mark_unread'
  | 'mark_important'
  | 'mark_unimportant'
  | 'snooze_email'
  | 'unsnooze_email'
  // Calendar actions
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'accept_meeting'
  | 'decline_meeting'
  | 'tentative_meeting'
  | 'add_attendee'
  | 'remove_attendee'
  | 'set_reminder'
  | 'remove_reminder'
  | 'reschedule_event'
  | 'cancel_event'
  // Task actions
  | 'create_task'
  | 'update_task'
  | 'complete_task'
  | 'reopen_task'
  | 'assign_task'
  | 'unassign_task'
  | 'set_due_date'
  | 'remove_due_date'
  | 'set_priority'
  | 'add_task_comment'
  | 'move_task'
  | 'duplicate_task'
  | 'delete_task'
  // Notification actions
  | 'send_notification'
  | 'send_desktop_notification'
  | 'send_mobile_notification'
  | 'create_alert'
  | 'dismiss_alert'
  | 'update_status'
  | 'set_presence'
  // File actions
  | 'create_file'
  | 'create_folder'
  | 'copy_file'
  | 'move_file'
  | 'rename_file'
  | 'delete_file'
  | 'restore_file'
  | 'share_file'
  | 'unshare_file'
  | 'backup_file'
  | 'sync_file'
  | 'compress_file'
  | 'extract_archive'
  // Communication actions
  | 'send_message'
  | 'send_direct_message'
  | 'post_to_channel'
  | 'create_channel'
  | 'join_channel'
  | 'leave_channel'
  | 'invite_to_channel'
  | 'add_reaction'
  | 'remove_reaction'
  | 'pin_message'
  | 'unpin_message'
  | 'update_topic'
  // Integration actions
  | 'webhook_call'
  | 'api_request'
  | 'graphql_request'
  | 'database_query'
  | 'run_script'
  | 'trigger_automation'
  | 'call_function'
  // System actions
  | 'log_event'
  | 'save_data'
  | 'load_data'
  | 'delete_data'
  | 'wait'
  | 'delay'
  | 'conditional'
  | 'loop'
  | 'break_loop'
  | 'continue_loop'
  | 'stop_execution'
  | 'pause_execution'
  | 'resume_execution'
  // Search actions
  | 'perform_search'
  | 'index_content'
  | 'clear_search_cache'
  // Custom actions
  | 'custom_action'
  | 'plugin_action';

/**
 * Automation recipe (workflow template)
 */
export interface AutomationRecipe {
  /** Recipe ID */
  id: string;
  /** User/organization ID that owns this recipe */
  ownerId: string;
  /** Recipe name */
  name: string;
  /** Recipe description */
  description?: string;
  /** Recipe category */
  category: AutomationCategory;
  /** Recipe tags */
  tags: string[];
  /** Recipe icon */
  icon?: string;
  /** Whether recipe is enabled */
  enabled: boolean;
  /** Whether recipe is public (shareable) */
  isPublic: boolean;
  /** Recipe version */
  version: string;
  /** Recipe trigger */
  trigger: AutomationTrigger;
  /** Recipe actions */
  actions: AutomationAction[];
  /** Recipe settings */
  settings: AutomationSettings;
  /** Recipe statistics */
  stats: AutomationStats;
  /** Recipe metadata */
  metadata: AutomationMetadata;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Last execution timestamp */
  lastExecutedAt?: Date;
}

/**
 * Automation categories
 */
export type AutomationCategory = 
  | 'productivity'    // General productivity automations
  | 'email'           // Email-focused automations
  | 'calendar'        // Calendar-focused automations
  | 'tasks'           // Task management automations
  | 'files'           // File management automations
  | 'communication'   // Communication automations
  | 'integrations'    // Third-party integrations
  | 'notifications'   // Notification automations
  | 'workflows'       // Complex multi-step workflows
  | 'utilities'       // Utility automations
  | 'custom';         // Custom category

/**
 * Automation trigger configuration
 */
export interface AutomationTrigger {
  /** Trigger type */
  type: AutomationTriggerType;
  /** Trigger configuration */
  config: AutomationTriggerConfig;
  /** Trigger conditions */
  conditions?: AutomationCondition[];
  /** Trigger throttling */
  throttling?: AutomationThrottling;
}

/**
 * Automation trigger configuration (union type based on trigger type)
 */
export type AutomationTriggerConfig = 
  | EmailTriggerConfig
  | CalendarTriggerConfig
  | ScheduleTriggerConfig
  | FileTriggerConfig
  | WebhookTriggerConfig
  | CustomTriggerConfig;

/**
 * Email trigger configuration
 */
export interface EmailTriggerConfig {
  type: 'email_received' | 'email_starred' | 'email_sent' | 'email_read' | 'email_unread' | 'email_archived' | 'email_deleted' | 'email_attachment_received';
  /** Email accounts to monitor */
  accountIds?: string[];
  /** Folder/label filters */
  folders?: string[];
  /** Sender filters */
  senderFilters?: string[];
  /** Subject filters */
  subjectFilters?: string[];
  /** Content filters */
  contentFilters?: string[];
  /** Attachment filters */
  attachmentFilters?: {
    hasAttachments?: boolean;
    fileTypes?: string[];
    fileSizeMin?: number;
    fileSizeMax?: number;
  };
}

/**
 * Calendar trigger configuration
 */
export interface CalendarTriggerConfig {
  type: 'event_created' | 'event_updated' | 'event_deleted' | 'event_starting' | 'event_ended' | 'meeting_declined' | 'meeting_accepted';
  /** Calendar accounts to monitor */
  accountIds?: string[];
  /** Calendar IDs to monitor */
  calendarIds?: string[];
  /** Event type filters */
  eventTypes?: string[];
  /** Attendee filters */
  attendeeFilters?: string[];
  /** Location filters */
  locationFilters?: string[];
  /** Lead time for event_starting trigger (minutes) */
  leadTimeMinutes?: number;
}

/**
 * Schedule trigger configuration
 */
export interface ScheduleTriggerConfig {
  type: 'schedule' | 'interval' | 'delay' | 'date_time';
  /** Cron expression for schedule */
  cron?: string;
  /** Interval in seconds */
  intervalSeconds?: number;
  /** Delay in seconds */
  delaySeconds?: number;
  /** Specific date/time */
  dateTime?: Date;
  /** Timezone */
  timezone?: string;
  /** End date for recurring schedules */
  endDate?: Date;
}

/**
 * File trigger configuration
 */
export interface FileTriggerConfig {
  type: 'file_created' | 'file_modified' | 'file_deleted' | 'file_shared';
  /** Watched directories */
  directories?: string[];
  /** File name patterns */
  patterns?: string[];
  /** File type filters */
  fileTypes?: string[];
  /** File size filters */
  sizeFilters?: {
    min?: number;
    max?: number;
  };
  /** Include subdirectories */
  recursive?: boolean;
}

/**
 * Webhook trigger configuration
 */
export interface WebhookTriggerConfig {
  type: 'webhook';
  /** Webhook URL path */
  path: string;
  /** HTTP methods to accept */
  methods: string[];
  /** Expected headers */
  headers?: Record<string, string>;
  /** Request body validation */
  bodyValidation?: {
    schema?: any;
    requiredFields?: string[];
  };
  /** Authentication requirements */
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'signature';
    config?: Record<string, any>;
  };
}

/**
 * Custom trigger configuration
 */
export interface CustomTriggerConfig {
  type: 'api_call' | 'custom_event';
  /** Custom configuration */
  config: Record<string, any>;
  /** Plugin ID if trigger comes from plugin */
  pluginId?: string;
}

/**
 * Automation condition
 */
export interface AutomationCondition {
  /** Field to check */
  field: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Expected value */
  value: any;
  /** Condition logic */
  logic?: 'AND' | 'OR';
  /** Nested conditions */
  conditions?: AutomationCondition[];
}

/**
 * Condition operators
 */
export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists'
  | 'regex'
  | 'is_empty'
  | 'is_not_empty';

/**
 * Trigger throttling configuration
 */
export interface AutomationThrottling {
  /** Throttling type */
  type: 'none' | 'rate_limit' | 'debounce' | 'once_per_period';
  /** Rate limit (executions per time period) */
  rateLimit?: {
    count: number;
    periodSeconds: number;
  };
  /** Debounce delay (seconds) */
  debounceSeconds?: number;
  /** Once per period settings */
  oncePerPeriod?: {
    periodType: 'hour' | 'day' | 'week' | 'month';
    resetTime?: string; // HH:mm for daily reset
  };
}

/**
 * Automation action configuration
 */
export interface AutomationAction {
  /** Action ID within the recipe */
  id: string;
  /** Action type */
  type: AutomationActionType;
  /** Action name */
  name: string;
  /** Action description */
  description?: string;
  /** Action configuration */
  config: AutomationActionConfig;
  /** Action conditions (when to execute) */
  conditions?: AutomationCondition[];
  /** Error handling */
  errorHandling: ActionErrorHandling;
  /** Continue execution on error */
  continueOnError: boolean;
  /** Action timeout (seconds) */
  timeout?: number;
  /** Retry configuration */
  retry?: ActionRetryConfig;
}

/**
 * Action configuration (union type based on action type)
 */
export type AutomationActionConfig = 
  | EmailActionConfig
  | CalendarActionConfig
  | TaskActionConfig
  | NotificationActionConfig
  | FileActionConfig
  | WebhookActionConfig
  | ConditionalActionConfig
  | LoopActionConfig
  | CustomActionConfig;

/**
 * Email action configuration
 */
export interface EmailActionConfig {
  type: 'send_email' | 'forward_email' | 'reply_email' | 'star_email' | 'archive_email' | 'delete_email' | 'move_email' | 'label_email' | 'mark_read' | 'mark_unread';
  /** Email account to use */
  accountId?: string;
  /** Recipients (for send/forward) */
  recipients?: {
    to?: string[];
    cc?: string[];
    bcc?: string[];
  };
  /** Email subject */
  subject?: string;
  /** Email body */
  body?: string;
  /** Body template with variables */
  bodyTemplate?: string;
  /** Email attachments */
  attachments?: string[];
  /** Target folder (for move action) */
  targetFolder?: string;
  /** Labels to add/remove */
  labels?: string[];
  /** Email signature to use */
  signatureId?: string;
}

/**
 * Calendar action configuration
 */
export interface CalendarActionConfig {
  type: 'create_event' | 'update_event' | 'delete_event' | 'accept_meeting' | 'decline_meeting' | 'add_attendee' | 'remove_attendee';
  /** Calendar account to use */
  accountId?: string;
  /** Calendar ID */
  calendarId?: string;
  /** Event details */
  event?: {
    title?: string;
    description?: string;
    location?: string;
    startTime?: string; // Template or ISO string
    endTime?: string;   // Template or ISO string
    isAllDay?: boolean;
    attendees?: string[];
    reminders?: number[];
  };
  /** Attendee email (for add/remove attendee) */
  attendeeEmail?: string;
  /** Response message (for accept/decline) */
  responseMessage?: string;
}

/**
 * Task action configuration
 */
export interface TaskActionConfig {
  type: 'create_task' | 'update_task' | 'complete_task' | 'assign_task' | 'set_due_date';
  /** Task management service */
  service: 'asana' | 'trello' | 'jira' | 'linear' | 'notion' | 'todoist' | 'custom';
  /** Project/board ID */
  projectId?: string;
  /** Task details */
  task?: {
    title?: string;
    description?: string;
    assignee?: string;
    dueDate?: string;
    priority?: string;
    labels?: string[];
    status?: string;
  };
  /** Task ID (for update/complete) */
  taskId?: string;
}

/**
 * Notification action configuration
 */
export interface NotificationActionConfig {
  type: 'send_notification' | 'create_alert' | 'update_status';
  /** Notification details */
  notification?: {
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    channels: string[];
    actions?: Array<{
      label: string;
      action: string;
    }>;
  };
  /** Status update details */
  status?: {
    service: string;
    message: string;
    emoji?: string;
  };
}

/**
 * File action configuration
 */
export interface FileActionConfig {
  type: 'create_file' | 'copy_file' | 'move_file' | 'share_file' | 'backup_file';
  /** Source file path */
  sourcePath?: string;
  /** Destination path */
  destinationPath?: string;
  /** File content (for create) */
  content?: string;
  /** Content template */
  contentTemplate?: string;
  /** File service */
  service?: 'local' | 'googledrive' | 'onedrive' | 'dropbox';
  /** Share settings */
  shareSettings?: {
    permissions: 'view' | 'edit' | 'comment';
    recipients: string[];
    message?: string;
  };
}

/**
 * Webhook action configuration
 */
export interface WebhookActionConfig {
  type: 'webhook_call' | 'api_request';
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** URL */
  url: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: any;
  /** Body template */
  bodyTemplate?: string;
  /** Authentication */
  auth?: {
    type: 'none' | 'basic' | 'bearer' | 'oauth2';
    config: Record<string, any>;
  };
  /** Response handling */
  responseHandling?: {
    extractData?: Record<string, string>;
    validateResponse?: any;
  };
}

/**
 * Conditional action configuration
 */
export interface ConditionalActionConfig {
  type: 'conditional';
  /** Condition to evaluate */
  condition: AutomationCondition;
  /** Actions to execute if condition is true */
  trueActions: AutomationAction[];
  /** Actions to execute if condition is false */
  falseActions?: AutomationAction[];
}

/**
 * Loop action configuration
 */
export interface LoopActionConfig {
  type: 'loop';
  /** Loop type */
  loopType: 'for_each' | 'while' | 'repeat';
  /** Items to iterate over (for for_each) */
  items?: string; // Template expression
  /** Loop condition (for while) */
  condition?: AutomationCondition;
  /** Repeat count (for repeat) */
  count?: number;
  /** Actions to execute in loop */
  actions: AutomationAction[];
  /** Maximum iterations */
  maxIterations: number;
}

/**
 * Custom action configuration
 */
export interface CustomActionConfig {
  type: 'custom_action';
  /** Plugin ID */
  pluginId: string;
  /** Action function name */
  functionName: string;
  /** Action parameters */
  parameters: Record<string, any>;
}

/**
 * Action error handling
 */
export interface ActionErrorHandling {
  /** How to handle errors */
  strategy: 'ignore' | 'stop' | 'retry' | 'fallback';
  /** Fallback actions */
  fallbackActions?: AutomationAction[];
  /** Log errors */
  logErrors: boolean;
  /** Notify on error */
  notifyOnError: boolean;
}

/**
 * Action retry configuration
 */
export interface ActionRetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Delay between retries (seconds) */
  delaySeconds: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Maximum delay (seconds) */
  maxDelaySeconds: number;
  /** Retry conditions */
  retryConditions?: string[];
}

/**
 * Automation settings
 */
export interface AutomationSettings {
  /** Global timeout (seconds) */
  timeout: number;
  /** Maximum executions per hour */
  maxExecutionsPerHour: number;
  /** Maximum concurrent executions */
  maxConcurrentExecutions: number;
  /** Execution priority */
  priority: 'low' | 'normal' | 'high';
  /** Logging level */
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  /** Variables */
  variables: Record<string, any>;
  /** Environment */
  environment: 'development' | 'staging' | 'production';
}

/**
 * Automation statistics
 */
export interface AutomationStats {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Average execution time (ms) */
  avgExecutionTime: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Last execution status */
  lastExecutionStatus?: 'success' | 'failed' | 'timeout' | 'cancelled';
  /** Execution history (last 100) */
  recentExecutions: Array<{
    timestamp: Date;
    status: 'success' | 'failed' | 'timeout' | 'cancelled';
    duration: number;
    error?: string;
  }>;
}

/**
 * Automation metadata
 */
export interface AutomationMetadata {
  /** Author information */
  author?: {
    name: string;
    email: string;
  };
  /** Documentation */
  documentation?: string;
  /** Recipe template info */
  template?: {
    isTemplate: boolean;
    templateId?: string;
    variables?: Record<string, any>;
  };
  /** Sharing info */
  sharing?: {
    isShared: boolean;
    sharedWith: string[];
    permissions: Record<string, string[]>;
  };
}

/**
 * Automation execution instance
 */
export interface AutomationExecution {
  /** Execution ID */
  id: string;
  /** Recipe ID */
  recipeId: string;
  /** User ID */
  userId: string;
  /** Trigger that started this execution */
  trigger: {
    type: AutomationTriggerType;
    data: any;
    timestamp: Date;
  };
  /** Execution status */
  status: AutomationExecutionStatus;
  /** Execution context */
  context: AutomationExecutionContext;
  /** Action executions */
  actions: AutomationActionExecution[];
  /** Execution error */
  error?: {
    message: string;
    code: string;
    action?: string;
    timestamp: Date;
  };
  /** Execution start time */
  startedAt: Date;
  /** Execution end time */
  endedAt?: Date;
  /** Execution duration (ms) */
  duration?: number;
}

/**
 * Automation execution status
 */
export type AutomationExecutionStatus = 
  | 'queued'      // Waiting to start
  | 'running'     // Currently executing
  | 'completed'   // Completed successfully
  | 'failed'      // Failed with error
  | 'timeout'     // Execution timed out
  | 'cancelled'   // Execution was cancelled
  | 'paused';     // Execution is paused

/**
 * Automation execution context
 */
export interface AutomationExecutionContext {
  /** Trigger data */
  trigger: any;
  /** User context */
  user: {
    id: string;
    email: string;
    name: string;
  };
  /** Workspace context */
  workspace?: {
    id: string;
    name: string;
  };
  /** Variables */
  variables: Record<string, any>;
  /** Environment */
  environment: 'development' | 'staging' | 'production';
}

/**
 * Action execution instance
 */
export interface AutomationActionExecution {
  /** Action ID */
  actionId: string;
  /** Action type */
  type: AutomationActionType;
  /** Execution status */
  status: AutomationExecutionStatus;
  /** Input data */
  input: any;
  /** Output data */
  output?: any;
  /** Error information */
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  /** Retry information */
  retries: Array<{
    attempt: number;
    timestamp: Date;
    error?: string;
  }>;
  /** Start time */
  startedAt: Date;
  /** End time */
  endedAt?: Date;
  /** Duration (ms) */
  duration?: number;
}

/**
 * Automation template for marketplace
 */
export interface AutomationTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template category */
  category: AutomationCategory;
  /** Template tags */
  tags: string[];
  /** Template icon */
  icon?: string;
  /** Template screenshots */
  screenshots?: string[];
  /** Template author */
  author: {
    name: string;
    email: string;
  };
  /** Template version */
  version: string;
  /** Required services/integrations */
  requirements: {
    services: string[];
    permissions: string[];
    plugins?: string[];
  };
  /** Template variables */
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
    label: string;
    description?: string;
    required: boolean;
    defaultValue?: any;
    options?: Array<{
      label: string;
      value: any;
    }>;
  }>;
  /** Recipe template */
  recipe: Omit<AutomationRecipe, 'id' | 'ownerId' | 'stats' | 'createdAt' | 'updatedAt' | 'lastExecutedAt'>;
  /** Template statistics */
  stats: {
    downloads: number;
    rating: number;
    reviews: number;
    successRate: number;
  };
  /** Template status */
  status: 'published' | 'draft' | 'deprecated';
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// Zod schemas for runtime validation
export const AutomationTriggerSchema = z.object({
  type: z.string(),
  config: z.any(), // Union type too complex for Zod
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'in', 'not_in', 'exists', 'not_exists', 'regex', 'is_empty', 'is_not_empty']),
    value: z.any(),
    logic: z.enum(['AND', 'OR']).optional(),
    conditions: z.array(z.any()).optional() // Recursive reference
  })).optional(),
  throttling: z.object({
    type: z.enum(['none', 'rate_limit', 'debounce', 'once_per_period']),
    rateLimit: z.object({
      count: z.number(),
      periodSeconds: z.number()
    }).optional(),
    debounceSeconds: z.number().optional(),
    oncePerPeriod: z.object({
      periodType: z.enum(['hour', 'day', 'week', 'month']),
      resetTime: z.string().optional()
    }).optional()
  }).optional()
});

export const AutomationActionSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: z.any(), // Union type too complex for Zod
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any(),
    logic: z.enum(['AND', 'OR']).optional(),
    conditions: z.array(z.any()).optional()
  })).optional(),
  errorHandling: z.object({
    strategy: z.enum(['ignore', 'stop', 'retry', 'fallback']),
    fallbackActions: z.array(z.any()).optional(), // Recursive reference
    logErrors: z.boolean(),
    notifyOnError: z.boolean()
  }),
  continueOnError: z.boolean(),
  timeout: z.number().optional(),
  retry: z.object({
    maxAttempts: z.number(),
    delaySeconds: z.number(),
    backoffMultiplier: z.number(),
    maxDelaySeconds: z.number(),
    retryConditions: z.array(z.string()).optional()
  }).optional()
});

export const AutomationRecipeSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum(['productivity', 'email', 'calendar', 'tasks', 'files', 'communication', 'integrations', 'notifications', 'workflows', 'utilities', 'custom']),
  tags: z.array(z.string()),
  icon: z.string().optional(),
  enabled: z.boolean(),
  isPublic: z.boolean(),
  version: z.string(),
  trigger: AutomationTriggerSchema,
  actions: z.array(AutomationActionSchema),
  settings: z.object({
    timeout: z.number(),
    maxExecutionsPerHour: z.number(),
    maxConcurrentExecutions: z.number(),
    priority: z.enum(['low', 'normal', 'high']),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']),
    variables: z.record(z.any()),
    environment: z.enum(['development', 'staging', 'production'])
  }),
  stats: z.object({
    totalExecutions: z.number(),
    successfulExecutions: z.number(),
    failedExecutions: z.number(),
    avgExecutionTime: z.number(),
    successRate: z.number().min(0).max(1),
    lastExecutionStatus: z.enum(['success', 'failed', 'timeout', 'cancelled']).optional(),
    recentExecutions: z.array(z.object({
      timestamp: z.date(),
      status: z.enum(['success', 'failed', 'timeout', 'cancelled']),
      duration: z.number(),
      error: z.string().optional()
    }))
  }),
  metadata: z.object({
    author: z.object({
      name: z.string(),
      email: z.string().email()
    }).optional(),
    documentation: z.string().optional(),
    template: z.object({
      isTemplate: z.boolean(),
      templateId: z.string().optional(),
      variables: z.record(z.any()).optional()
    }).optional(),
    sharing: z.object({
      isShared: z.boolean(),
      sharedWith: z.array(z.string()),
      permissions: z.record(z.array(z.string()))
    }).optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastExecutedAt: z.date().optional()
});

export const AutomationExecutionSchema = z.object({
  id: z.string(),
  recipeId: z.string(),
  userId: z.string(),
  trigger: z.object({
    type: z.string(),
    data: z.any(),
    timestamp: z.date()
  }),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'timeout', 'cancelled', 'paused']),
  context: z.object({
    trigger: z.any(),
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string()
    }),
    workspace: z.object({
      id: z.string(),
      name: z.string()
    }).optional(),
    variables: z.record(z.any()),
    environment: z.enum(['development', 'staging', 'production'])
  }),
  actions: z.array(z.object({
    actionId: z.string(),
    type: z.string(),
    status: z.enum(['queued', 'running', 'completed', 'failed', 'timeout', 'cancelled', 'paused']),
    input: z.any(),
    output: z.any().optional(),
    error: z.object({
      message: z.string(),
      code: z.string(),
      details: z.any().optional()
    }).optional(),
    retries: z.array(z.object({
      attempt: z.number(),
      timestamp: z.date(),
      error: z.string().optional()
    })),
    startedAt: z.date(),
    endedAt: z.date().optional(),
    duration: z.number().optional()
  })),
  error: z.object({
    message: z.string(),
    code: z.string(),
    action: z.string().optional(),
    timestamp: z.date()
  }).optional(),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  duration: z.number().optional()
});

/**
 * Utility types for automation operations
 */
export type CreateAutomationRecipeInput = Omit<AutomationRecipe, 'id' | 'stats' | 'createdAt' | 'updatedAt' | 'lastExecutedAt'>;
export type UpdateAutomationRecipeInput = Partial<Pick<AutomationRecipe, 'name' | 'description' | 'tags' | 'enabled' | 'trigger' | 'actions' | 'settings' | 'metadata'>>;

export type CreateAutomationTemplateInput = Omit<AutomationTemplate, 'id' | 'stats' | 'createdAt' | 'updatedAt'>;
export type UpdateAutomationTemplateInput = Partial<Pick<AutomationTemplate, 'name' | 'description' | 'tags' | 'variables' | 'recipe' | 'status'>>;

/**
 * Automation engine configuration
 */
export interface AutomationEngineConfig {
  /** Maximum concurrent executions */
  maxConcurrentExecutions: number;
  /** Execution queue size */
  queueSize: number;
  /** Default timeout (seconds) */
  defaultTimeout: number;
  /** Retry configuration */
  retry: {
    maxAttempts: number;
    delaySeconds: number;
    backoffMultiplier: number;
    maxDelaySeconds: number;
  };
  /** Resource limits */
  limits: {
    memoryMB: number;
    cpuPercent: number;
    diskMB: number;
    networkRequestsPerMinute: number;
  };
  /** Security settings */
  security: {
    sandboxed: boolean;
    allowedDomains: string[];
    allowedIPs: string[];
    maxFileSize: number;
    allowScriptExecution: boolean;
    allowNetworkAccess: boolean;
  };
  /** Plugin integration */
  plugins: {
    enabled: boolean;
    autoDiscovery: boolean;
    trustedPlugins: string[];
    maxPluginExecutionTime: number;
  };
  /** Logging configuration */
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    retentionDays: number;
    maxLogSize: number;
    enableMetrics: boolean;
  };
}

/**
 * Automation scheduler
 */
export interface AutomationScheduler {
  /** Scheduler ID */
  id: string;
  /** Recipe ID */
  recipeId: string;
  /** Schedule configuration */
  schedule: ScheduleTriggerConfig;
  /** Next execution time */
  nextExecution: Date;
  /** Last execution time */
  lastExecution?: Date;
  /** Scheduler status */
  status: 'active' | 'paused' | 'disabled' | 'error';
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Automation workflow for complex multi-step processes
 */
export interface AutomationWorkflow {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Workflow steps */
  steps: AutomationWorkflowStep[];
  /** Workflow variables */
  variables: Record<string, any>;
  /** Workflow status */
  status: 'draft' | 'active' | 'paused' | 'archived';
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Workflow step
 */
export interface AutomationWorkflowStep {
  /** Step ID */
  id: string;
  /** Step name */
  name: string;
  /** Step type */
  type: 'automation' | 'approval' | 'condition' | 'parallel' | 'delay' | 'variable' | 'transform' | 'filter' | 'merge';
  /** Step configuration */
  config: any;
  /** Next steps */
  nextSteps: string[];
  /** Step conditions */
  conditions?: AutomationCondition[];
  /** Step position */
  position: {
    x: number;
    y: number;
  };
  /** Visual styling */
  style?: {
    color?: string;
    icon?: string;
    size?: 'small' | 'medium' | 'large';
  };
  /** Error handling for this step */
  errorHandling?: ActionErrorHandling;
  /** Step timeout */
  timeout?: number;
}

/**
 * Variable definition for automation workflows
 */
export interface AutomationVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'email' | 'url' | 'json';
  /** Variable value */
  value: any;
  /** Variable description */
  description?: string;
  /** Whether variable is required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Variable scope */
  scope: 'global' | 'recipe' | 'execution' | 'step';
  /** Variable source */
  source?: {
    type: 'trigger' | 'action' | 'user_input' | 'system' | 'computed';
    path?: string;
    transform?: string;
  };
  /** Validation rules */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
    custom?: string;
  };
  /** Variable encryption */
  encrypted: boolean;
}

/**
 * Variable context for execution
 */
export interface AutomationVariableContext {
  /** Global variables */
  global: Record<string, any>;
  /** Recipe variables */
  recipe: Record<string, any>;
  /** Execution variables */
  execution: Record<string, any>;
  /** Step variables */
  step: Record<string, any>;
  /** Computed variables */
  computed: Record<string, any>;
}

/**
 * Template variable configuration
 */
export interface AutomationTemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'email' | 'url' | 'date' | 'time';
  /** Display label */
  label: string;
  /** Variable description */
  description?: string;
  /** Whether variable is required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Options for select/multiselect */
  options?: Array<{
    label: string;
    value: any;
    description?: string;
  }>;
  /** Validation rules */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string;
  };
  /** Display group */
  group?: string;
  /** Display order */
  order: number;
  /** Conditional display */
  conditional?: {
    dependsOn: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in';
    value: any;
  };
}

/**
 * Automation testing configuration
 */
export interface AutomationTest {
  /** Test ID */
  id: string;
  /** Test name */
  name: string;
  /** Test description */
  description?: string;
  /** Recipe ID being tested */
  recipeId: string;
  /** Test type */
  type: 'unit' | 'integration' | 'end_to_end' | 'performance' | 'security';
  /** Test status */
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  /** Test configuration */
  config: {
    /** Mock data for triggers */
    triggerData: any;
    /** Expected outputs */
    expectedOutputs: Array<{
      actionId: string;
      expectedResult: any;
      assertion: 'equals' | 'contains' | 'regex' | 'custom';
    }>;
    /** Test timeout */
    timeout: number;
    /** Setup steps */
    setup?: AutomationAction[];
    /** Cleanup steps */
    cleanup?: AutomationAction[];
    /** Mock configurations */
    mocks?: Array<{
      type: 'api' | 'plugin' | 'service';
      target: string;
      response: any;
    }>;
  };
  /** Test results */
  results?: {
    /** Test execution time */
    executionTime: number;
    /** Test start time */
    startedAt: Date;
    /** Test end time */
    completedAt: Date;
    /** Test output */
    output: any;
    /** Test error */
    error?: string;
    /** Assertion results */
    assertions: Array<{
      actionId: string;
      passed: boolean;
      actualResult: any;
      expectedResult: any;
      error?: string;
    }>;
  };
  /** Test metadata */
  metadata: {
    /** Test author */
    author: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
    /** Test tags */
    tags: string[];
  };
}

/**
 * Visual builder node for React Flow
 */
export interface AutomationBuilderNode {
  /** Node ID */
  id: string;
  /** Node type */
  type: 'trigger' | 'action' | 'condition' | 'variable' | 'delay' | 'parallel' | 'merge';
  /** Node position */
  position: { x: number; y: number };
  /** Node data */
  data: {
    /** Display label */
    label: string;
    /** Node configuration */
    config: any;
    /** Node icon */
    icon?: string;
    /** Node color */
    color?: string;
    /** Validation errors */
    errors?: string[];
    /** Node status */
    status?: 'valid' | 'invalid' | 'warning';
  };
  /** Node styling */
  style?: Record<string, any>;
  /** Node class names */
  className?: string;
  /** Whether node is draggable */
  draggable?: boolean;
  /** Whether node is selectable */
  selectable?: boolean;
}

/**
 * Visual builder edge for React Flow
 */
export interface AutomationBuilderEdge {
  /** Edge ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Source handle ID */
  sourceHandle?: string;
  /** Target handle ID */
  targetHandle?: string;
  /** Edge type */
  type?: string;
  /** Edge data */
  data?: {
    /** Condition for this edge */
    condition?: AutomationCondition;
    /** Edge label */
    label?: string;
    /** Edge color */
    color?: string;
  };
  /** Edge styling */
  style?: Record<string, any>;
  /** Whether edge is animated */
  animated?: boolean;
}

/**
 * Automation builder state
 */
export interface AutomationBuilderState {
  /** Current recipe being edited */
  recipe: AutomationRecipe | null;
  /** Visual nodes */
  nodes: AutomationBuilderNode[];
  /** Visual edges */
  edges: AutomationBuilderEdge[];
  /** Selected nodes */
  selectedNodes: string[];
  /** Selected edges */
  selectedEdges: string[];
  /** Builder mode */
  mode: 'design' | 'test' | 'debug';
  /** Validation errors */
  errors: Array<{
    nodeId?: string;
    edgeId?: string;
    type: 'error' | 'warning' | 'info';
    message: string;
  }>;
  /** Zoom level */
  zoom: number;
  /** Viewport center */
  center: { x: number; y: number };
  /** Grid settings */
  grid: {
    enabled: boolean;
    size: number;
    snap: boolean;
  };
}