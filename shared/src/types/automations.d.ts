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
export type AutomationTriggerType = 'email_received' | 'email_starred' | 'email_sent' | 'email_read' | 'email_unread' | 'email_archived' | 'email_deleted' | 'email_attachment_received' | 'email_replied' | 'email_forwarded' | 'email_moved_to_folder' | 'email_label_added' | 'email_from_sender' | 'email_with_subject' | 'event_created' | 'event_updated' | 'event_deleted' | 'event_starting' | 'event_ended' | 'meeting_declined' | 'meeting_accepted' | 'calendar_busy' | 'calendar_free' | 'meeting_reminder' | 'attendee_added' | 'attendee_removed' | 'schedule' | 'interval' | 'delay' | 'date_time' | 'time_of_day' | 'day_of_week' | 'day_of_month' | 'date_range' | 'file_created' | 'file_modified' | 'file_deleted' | 'file_shared' | 'file_renamed' | 'file_moved' | 'file_downloaded' | 'file_uploaded' | 'folder_created' | 'folder_deleted' | 'message_received' | 'mention_received' | 'channel_joined' | 'status_changed' | 'direct_message_received' | 'group_message_received' | 'reaction_added' | 'reaction_removed' | 'user_joined_workspace' | 'user_left_workspace' | 'task_created' | 'task_updated' | 'task_completed' | 'task_assigned' | 'task_overdue' | 'project_created' | 'project_updated' | 'milestone_reached' | 'app_opened' | 'app_closed' | 'plugin_installed' | 'plugin_uninstalled' | 'sync_completed' | 'sync_failed' | 'error_occurred' | 'workspace_changed' | 'user_logged_in' | 'user_logged_out' | 'search_performed' | 'search_result_clicked' | 'content_indexed' | 'webhook' | 'api_call' | 'custom_event' | 'plugin_event';
/**
 * Automation action types - comprehensive list of all supported actions
 */
export type AutomationActionType = 'send_email' | 'forward_email' | 'reply_email' | 'reply_all_email' | 'star_email' | 'unstar_email' | 'archive_email' | 'unarchive_email' | 'delete_email' | 'move_email' | 'copy_email' | 'label_email' | 'remove_label_email' | 'mark_read' | 'mark_unread' | 'mark_important' | 'mark_unimportant' | 'snooze_email' | 'unsnooze_email' | 'create_event' | 'update_event' | 'delete_event' | 'accept_meeting' | 'decline_meeting' | 'tentative_meeting' | 'add_attendee' | 'remove_attendee' | 'set_reminder' | 'remove_reminder' | 'reschedule_event' | 'cancel_event' | 'create_task' | 'update_task' | 'complete_task' | 'reopen_task' | 'assign_task' | 'unassign_task' | 'set_due_date' | 'remove_due_date' | 'set_priority' | 'add_task_comment' | 'move_task' | 'duplicate_task' | 'delete_task' | 'send_notification' | 'send_desktop_notification' | 'send_mobile_notification' | 'create_alert' | 'dismiss_alert' | 'update_status' | 'set_presence' | 'create_file' | 'create_folder' | 'copy_file' | 'move_file' | 'rename_file' | 'delete_file' | 'restore_file' | 'share_file' | 'unshare_file' | 'backup_file' | 'sync_file' | 'compress_file' | 'extract_archive' | 'send_message' | 'send_direct_message' | 'post_to_channel' | 'create_channel' | 'join_channel' | 'leave_channel' | 'invite_to_channel' | 'add_reaction' | 'remove_reaction' | 'pin_message' | 'unpin_message' | 'update_topic' | 'webhook_call' | 'api_request' | 'graphql_request' | 'database_query' | 'run_script' | 'trigger_automation' | 'call_function' | 'log_event' | 'save_data' | 'load_data' | 'delete_data' | 'wait' | 'delay' | 'conditional' | 'loop' | 'break_loop' | 'continue_loop' | 'stop_execution' | 'pause_execution' | 'resume_execution' | 'perform_search' | 'index_content' | 'clear_search_cache' | 'custom_action' | 'plugin_action';
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
export type AutomationCategory = 'productivity' | 'email' | 'calendar' | 'tasks' | 'files' | 'communication' | 'integrations' | 'notifications' | 'workflows' | 'utilities' | 'custom';
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
export type AutomationTriggerConfig = EmailTriggerConfig | CalendarTriggerConfig | ScheduleTriggerConfig | FileTriggerConfig | WebhookTriggerConfig | CustomTriggerConfig;
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
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'regex' | 'is_empty' | 'is_not_empty';
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
        resetTime?: string;
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
export type AutomationActionConfig = EmailActionConfig | CalendarActionConfig | TaskActionConfig | NotificationActionConfig | FileActionConfig | WebhookActionConfig | ConditionalActionConfig | LoopActionConfig | CustomActionConfig;
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
        startTime?: string;
        endTime?: string;
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
    items?: string;
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
export type AutomationExecutionStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled' | 'paused';
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
export declare const AutomationTriggerSchema: z.ZodObject<{
    type: z.ZodString;
    config: z.ZodAny;
    conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "in", "not_in", "exists", "not_exists", "regex", "is_empty", "is_not_empty"]>;
        value: z.ZodAny;
        logic: z.ZodOptional<z.ZodEnum<["AND", "OR"]>>;
        conditions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }, {
        field: string;
        operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }>, "many">>;
    throttling: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["none", "rate_limit", "debounce", "once_per_period"]>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            count: z.ZodNumber;
            periodSeconds: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            count: number;
            periodSeconds: number;
        }, {
            count: number;
            periodSeconds: number;
        }>>;
        debounceSeconds: z.ZodOptional<z.ZodNumber>;
        oncePerPeriod: z.ZodOptional<z.ZodObject<{
            periodType: z.ZodEnum<["hour", "day", "week", "month"]>;
            resetTime: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            periodType: "day" | "week" | "month" | "hour";
            resetTime?: string | undefined;
        }, {
            periodType: "day" | "week" | "month" | "hour";
            resetTime?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "none" | "rate_limit" | "debounce" | "once_per_period";
        rateLimit?: {
            count: number;
            periodSeconds: number;
        } | undefined;
        debounceSeconds?: number | undefined;
        oncePerPeriod?: {
            periodType: "day" | "week" | "month" | "hour";
            resetTime?: string | undefined;
        } | undefined;
    }, {
        type: "none" | "rate_limit" | "debounce" | "once_per_period";
        rateLimit?: {
            count: number;
            periodSeconds: number;
        } | undefined;
        debounceSeconds?: number | undefined;
        oncePerPeriod?: {
            periodType: "day" | "week" | "month" | "hour";
            resetTime?: string | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    conditions?: {
        field: string;
        operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }[] | undefined;
    config?: any;
    throttling?: {
        type: "none" | "rate_limit" | "debounce" | "once_per_period";
        rateLimit?: {
            count: number;
            periodSeconds: number;
        } | undefined;
        debounceSeconds?: number | undefined;
        oncePerPeriod?: {
            periodType: "day" | "week" | "month" | "hour";
            resetTime?: string | undefined;
        } | undefined;
    } | undefined;
}, {
    type: string;
    conditions?: {
        field: string;
        operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }[] | undefined;
    config?: any;
    throttling?: {
        type: "none" | "rate_limit" | "debounce" | "once_per_period";
        rateLimit?: {
            count: number;
            periodSeconds: number;
        } | undefined;
        debounceSeconds?: number | undefined;
        oncePerPeriod?: {
            periodType: "day" | "week" | "month" | "hour";
            resetTime?: string | undefined;
        } | undefined;
    } | undefined;
}>;
export declare const AutomationActionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    config: z.ZodAny;
    conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodString;
        value: z.ZodAny;
        logic: z.ZodOptional<z.ZodEnum<["AND", "OR"]>>;
        conditions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: string;
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }, {
        field: string;
        operator: string;
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }>, "many">>;
    errorHandling: z.ZodObject<{
        strategy: z.ZodEnum<["ignore", "stop", "retry", "fallback"]>;
        fallbackActions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        logErrors: z.ZodBoolean;
        notifyOnError: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        strategy: "ignore" | "stop" | "retry" | "fallback";
        logErrors: boolean;
        notifyOnError: boolean;
        fallbackActions?: any[] | undefined;
    }, {
        strategy: "ignore" | "stop" | "retry" | "fallback";
        logErrors: boolean;
        notifyOnError: boolean;
        fallbackActions?: any[] | undefined;
    }>;
    continueOnError: z.ZodBoolean;
    timeout: z.ZodOptional<z.ZodNumber>;
    retry: z.ZodOptional<z.ZodObject<{
        maxAttempts: z.ZodNumber;
        delaySeconds: z.ZodNumber;
        backoffMultiplier: z.ZodNumber;
        maxDelaySeconds: z.ZodNumber;
        retryConditions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        maxAttempts: number;
        delaySeconds: number;
        backoffMultiplier: number;
        maxDelaySeconds: number;
        retryConditions?: string[] | undefined;
    }, {
        maxAttempts: number;
        delaySeconds: number;
        backoffMultiplier: number;
        maxDelaySeconds: number;
        retryConditions?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: string;
    continueOnError: boolean;
    errorHandling: {
        strategy: "ignore" | "stop" | "retry" | "fallback";
        logErrors: boolean;
        notifyOnError: boolean;
        fallbackActions?: any[] | undefined;
    };
    conditions?: {
        field: string;
        operator: string;
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }[] | undefined;
    config?: any;
    description?: string | undefined;
    timeout?: number | undefined;
    retry?: {
        maxAttempts: number;
        delaySeconds: number;
        backoffMultiplier: number;
        maxDelaySeconds: number;
        retryConditions?: string[] | undefined;
    } | undefined;
}, {
    id: string;
    name: string;
    type: string;
    continueOnError: boolean;
    errorHandling: {
        strategy: "ignore" | "stop" | "retry" | "fallback";
        logErrors: boolean;
        notifyOnError: boolean;
        fallbackActions?: any[] | undefined;
    };
    conditions?: {
        field: string;
        operator: string;
        value?: any;
        conditions?: any[] | undefined;
        logic?: "AND" | "OR" | undefined;
    }[] | undefined;
    config?: any;
    description?: string | undefined;
    timeout?: number | undefined;
    retry?: {
        maxAttempts: number;
        delaySeconds: number;
        backoffMultiplier: number;
        maxDelaySeconds: number;
        retryConditions?: string[] | undefined;
    } | undefined;
}>;
export declare const AutomationRecipeSchema: z.ZodObject<{
    id: z.ZodString;
    ownerId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodEnum<["productivity", "email", "calendar", "tasks", "files", "communication", "integrations", "notifications", "workflows", "utilities", "custom"]>;
    tags: z.ZodArray<z.ZodString, "many">;
    icon: z.ZodOptional<z.ZodString>;
    enabled: z.ZodBoolean;
    isPublic: z.ZodBoolean;
    version: z.ZodString;
    trigger: z.ZodObject<{
        type: z.ZodString;
        config: z.ZodAny;
        conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            operator: z.ZodEnum<["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "in", "not_in", "exists", "not_exists", "regex", "is_empty", "is_not_empty"]>;
            value: z.ZodAny;
            logic: z.ZodOptional<z.ZodEnum<["AND", "OR"]>>;
            conditions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }, {
            field: string;
            operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }>, "many">>;
        throttling: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["none", "rate_limit", "debounce", "once_per_period"]>;
            rateLimit: z.ZodOptional<z.ZodObject<{
                count: z.ZodNumber;
                periodSeconds: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                count: number;
                periodSeconds: number;
            }, {
                count: number;
                periodSeconds: number;
            }>>;
            debounceSeconds: z.ZodOptional<z.ZodNumber>;
            oncePerPeriod: z.ZodOptional<z.ZodObject<{
                periodType: z.ZodEnum<["hour", "day", "week", "month"]>;
                resetTime: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            }, {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            type: "none" | "rate_limit" | "debounce" | "once_per_period";
            rateLimit?: {
                count: number;
                periodSeconds: number;
            } | undefined;
            debounceSeconds?: number | undefined;
            oncePerPeriod?: {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            } | undefined;
        }, {
            type: "none" | "rate_limit" | "debounce" | "once_per_period";
            rateLimit?: {
                count: number;
                periodSeconds: number;
            } | undefined;
            debounceSeconds?: number | undefined;
            oncePerPeriod?: {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        throttling?: {
            type: "none" | "rate_limit" | "debounce" | "once_per_period";
            rateLimit?: {
                count: number;
                periodSeconds: number;
            } | undefined;
            debounceSeconds?: number | undefined;
            oncePerPeriod?: {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            } | undefined;
        } | undefined;
    }, {
        type: string;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        throttling?: {
            type: "none" | "rate_limit" | "debounce" | "once_per_period";
            rateLimit?: {
                count: number;
                periodSeconds: number;
            } | undefined;
            debounceSeconds?: number | undefined;
            oncePerPeriod?: {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            } | undefined;
        } | undefined;
    }>;
    actions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        config: z.ZodAny;
        conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            operator: z.ZodString;
            value: z.ZodAny;
            logic: z.ZodOptional<z.ZodEnum<["AND", "OR"]>>;
            conditions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            operator: string;
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }, {
            field: string;
            operator: string;
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }>, "many">>;
        errorHandling: z.ZodObject<{
            strategy: z.ZodEnum<["ignore", "stop", "retry", "fallback"]>;
            fallbackActions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
            logErrors: z.ZodBoolean;
            notifyOnError: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            strategy: "ignore" | "stop" | "retry" | "fallback";
            logErrors: boolean;
            notifyOnError: boolean;
            fallbackActions?: any[] | undefined;
        }, {
            strategy: "ignore" | "stop" | "retry" | "fallback";
            logErrors: boolean;
            notifyOnError: boolean;
            fallbackActions?: any[] | undefined;
        }>;
        continueOnError: z.ZodBoolean;
        timeout: z.ZodOptional<z.ZodNumber>;
        retry: z.ZodOptional<z.ZodObject<{
            maxAttempts: z.ZodNumber;
            delaySeconds: z.ZodNumber;
            backoffMultiplier: z.ZodNumber;
            maxDelaySeconds: z.ZodNumber;
            retryConditions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            maxAttempts: number;
            delaySeconds: number;
            backoffMultiplier: number;
            maxDelaySeconds: number;
            retryConditions?: string[] | undefined;
        }, {
            maxAttempts: number;
            delaySeconds: number;
            backoffMultiplier: number;
            maxDelaySeconds: number;
            retryConditions?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        type: string;
        continueOnError: boolean;
        errorHandling: {
            strategy: "ignore" | "stop" | "retry" | "fallback";
            logErrors: boolean;
            notifyOnError: boolean;
            fallbackActions?: any[] | undefined;
        };
        conditions?: {
            field: string;
            operator: string;
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        description?: string | undefined;
        timeout?: number | undefined;
        retry?: {
            maxAttempts: number;
            delaySeconds: number;
            backoffMultiplier: number;
            maxDelaySeconds: number;
            retryConditions?: string[] | undefined;
        } | undefined;
    }, {
        id: string;
        name: string;
        type: string;
        continueOnError: boolean;
        errorHandling: {
            strategy: "ignore" | "stop" | "retry" | "fallback";
            logErrors: boolean;
            notifyOnError: boolean;
            fallbackActions?: any[] | undefined;
        };
        conditions?: {
            field: string;
            operator: string;
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        description?: string | undefined;
        timeout?: number | undefined;
        retry?: {
            maxAttempts: number;
            delaySeconds: number;
            backoffMultiplier: number;
            maxDelaySeconds: number;
            retryConditions?: string[] | undefined;
        } | undefined;
    }>, "many">;
    settings: z.ZodObject<{
        timeout: z.ZodNumber;
        maxExecutionsPerHour: z.ZodNumber;
        maxConcurrentExecutions: z.ZodNumber;
        priority: z.ZodEnum<["low", "normal", "high"]>;
        logLevel: z.ZodEnum<["error", "warn", "info", "debug"]>;
        variables: z.ZodRecord<z.ZodString, z.ZodAny>;
        environment: z.ZodEnum<["development", "staging", "production"]>;
    }, "strip", z.ZodTypeAny, {
        priority: "normal" | "high" | "low";
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        timeout: number;
        maxExecutionsPerHour: number;
        maxConcurrentExecutions: number;
        logLevel: "error" | "info" | "warn" | "debug";
    }, {
        priority: "normal" | "high" | "low";
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        timeout: number;
        maxExecutionsPerHour: number;
        maxConcurrentExecutions: number;
        logLevel: "error" | "info" | "warn" | "debug";
    }>;
    stats: z.ZodObject<{
        totalExecutions: z.ZodNumber;
        successfulExecutions: z.ZodNumber;
        failedExecutions: z.ZodNumber;
        avgExecutionTime: z.ZodNumber;
        successRate: z.ZodNumber;
        lastExecutionStatus: z.ZodOptional<z.ZodEnum<["success", "failed", "timeout", "cancelled"]>>;
        recentExecutions: z.ZodArray<z.ZodObject<{
            timestamp: z.ZodDate;
            status: z.ZodEnum<["success", "failed", "timeout", "cancelled"]>;
            duration: z.ZodNumber;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "failed" | "cancelled" | "success" | "timeout";
            duration: number;
            timestamp: Date;
            error?: string | undefined;
        }, {
            status: "failed" | "cancelled" | "success" | "timeout";
            duration: number;
            timestamp: Date;
            error?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        successRate: number;
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        avgExecutionTime: number;
        recentExecutions: {
            status: "failed" | "cancelled" | "success" | "timeout";
            duration: number;
            timestamp: Date;
            error?: string | undefined;
        }[];
        lastExecutionStatus?: "failed" | "cancelled" | "success" | "timeout" | undefined;
    }, {
        successRate: number;
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        avgExecutionTime: number;
        recentExecutions: {
            status: "failed" | "cancelled" | "success" | "timeout";
            duration: number;
            timestamp: Date;
            error?: string | undefined;
        }[];
        lastExecutionStatus?: "failed" | "cancelled" | "success" | "timeout" | undefined;
    }>;
    metadata: z.ZodObject<{
        author: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            email: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
            name: string;
        }, {
            email: string;
            name: string;
        }>>;
        documentation: z.ZodOptional<z.ZodString>;
        template: z.ZodOptional<z.ZodObject<{
            isTemplate: z.ZodBoolean;
            templateId: z.ZodOptional<z.ZodString>;
            variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            isTemplate: boolean;
            variables?: Record<string, any> | undefined;
            templateId?: string | undefined;
        }, {
            isTemplate: boolean;
            variables?: Record<string, any> | undefined;
            templateId?: string | undefined;
        }>>;
        sharing: z.ZodOptional<z.ZodObject<{
            isShared: z.ZodBoolean;
            sharedWith: z.ZodArray<z.ZodString, "many">;
            permissions: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            permissions: Record<string, string[]>;
            isShared: boolean;
            sharedWith: string[];
        }, {
            permissions: Record<string, string[]>;
            isShared: boolean;
            sharedWith: string[];
        }>>;
    }, "strip", z.ZodTypeAny, {
        author?: {
            email: string;
            name: string;
        } | undefined;
        documentation?: string | undefined;
        template?: {
            isTemplate: boolean;
            variables?: Record<string, any> | undefined;
            templateId?: string | undefined;
        } | undefined;
        sharing?: {
            permissions: Record<string, string[]>;
            isShared: boolean;
            sharedWith: string[];
        } | undefined;
    }, {
        author?: {
            email: string;
            name: string;
        } | undefined;
        documentation?: string | undefined;
        template?: {
            isTemplate: boolean;
            variables?: Record<string, any> | undefined;
            templateId?: string | undefined;
        } | undefined;
        sharing?: {
            permissions: Record<string, string[]>;
            isShared: boolean;
            sharedWith: string[];
        } | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastExecutedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    actions: {
        id: string;
        name: string;
        type: string;
        continueOnError: boolean;
        errorHandling: {
            strategy: "ignore" | "stop" | "retry" | "fallback";
            logErrors: boolean;
            notifyOnError: boolean;
            fallbackActions?: any[] | undefined;
        };
        conditions?: {
            field: string;
            operator: string;
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        description?: string | undefined;
        timeout?: number | undefined;
        retry?: {
            maxAttempts: number;
            delaySeconds: number;
            backoffMultiplier: number;
            maxDelaySeconds: number;
            retryConditions?: string[] | undefined;
        } | undefined;
    }[];
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    tags: string[];
    enabled: boolean;
    settings: {
        priority: "normal" | "high" | "low";
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        timeout: number;
        maxExecutionsPerHour: number;
        maxConcurrentExecutions: number;
        logLevel: "error" | "info" | "warn" | "debug";
    };
    category: "notifications" | "email" | "calendar" | "custom" | "communication" | "productivity" | "utilities" | "tasks" | "files" | "integrations" | "workflows";
    version: string;
    metadata: {
        author?: {
            email: string;
            name: string;
        } | undefined;
        documentation?: string | undefined;
        template?: {
            isTemplate: boolean;
            variables?: Record<string, any> | undefined;
            templateId?: string | undefined;
        } | undefined;
        sharing?: {
            permissions: Record<string, string[]>;
            isShared: boolean;
            sharedWith: string[];
        } | undefined;
    };
    ownerId: string;
    stats: {
        successRate: number;
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        avgExecutionTime: number;
        recentExecutions: {
            status: "failed" | "cancelled" | "success" | "timeout";
            duration: number;
            timestamp: Date;
            error?: string | undefined;
        }[];
        lastExecutionStatus?: "failed" | "cancelled" | "success" | "timeout" | undefined;
    };
    isPublic: boolean;
    trigger: {
        type: string;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        throttling?: {
            type: "none" | "rate_limit" | "debounce" | "once_per_period";
            rateLimit?: {
                count: number;
                periodSeconds: number;
            } | undefined;
            debounceSeconds?: number | undefined;
            oncePerPeriod?: {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            } | undefined;
        } | undefined;
    };
    icon?: string | undefined;
    description?: string | undefined;
    lastExecutedAt?: Date | undefined;
}, {
    actions: {
        id: string;
        name: string;
        type: string;
        continueOnError: boolean;
        errorHandling: {
            strategy: "ignore" | "stop" | "retry" | "fallback";
            logErrors: boolean;
            notifyOnError: boolean;
            fallbackActions?: any[] | undefined;
        };
        conditions?: {
            field: string;
            operator: string;
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        description?: string | undefined;
        timeout?: number | undefined;
        retry?: {
            maxAttempts: number;
            delaySeconds: number;
            backoffMultiplier: number;
            maxDelaySeconds: number;
            retryConditions?: string[] | undefined;
        } | undefined;
    }[];
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    tags: string[];
    enabled: boolean;
    settings: {
        priority: "normal" | "high" | "low";
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        timeout: number;
        maxExecutionsPerHour: number;
        maxConcurrentExecutions: number;
        logLevel: "error" | "info" | "warn" | "debug";
    };
    category: "notifications" | "email" | "calendar" | "custom" | "communication" | "productivity" | "utilities" | "tasks" | "files" | "integrations" | "workflows";
    version: string;
    metadata: {
        author?: {
            email: string;
            name: string;
        } | undefined;
        documentation?: string | undefined;
        template?: {
            isTemplate: boolean;
            variables?: Record<string, any> | undefined;
            templateId?: string | undefined;
        } | undefined;
        sharing?: {
            permissions: Record<string, string[]>;
            isShared: boolean;
            sharedWith: string[];
        } | undefined;
    };
    ownerId: string;
    stats: {
        successRate: number;
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        avgExecutionTime: number;
        recentExecutions: {
            status: "failed" | "cancelled" | "success" | "timeout";
            duration: number;
            timestamp: Date;
            error?: string | undefined;
        }[];
        lastExecutionStatus?: "failed" | "cancelled" | "success" | "timeout" | undefined;
    };
    isPublic: boolean;
    trigger: {
        type: string;
        conditions?: {
            field: string;
            operator: "contains" | "equals" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "is_empty" | "is_not_empty";
            value?: any;
            conditions?: any[] | undefined;
            logic?: "AND" | "OR" | undefined;
        }[] | undefined;
        config?: any;
        throttling?: {
            type: "none" | "rate_limit" | "debounce" | "once_per_period";
            rateLimit?: {
                count: number;
                periodSeconds: number;
            } | undefined;
            debounceSeconds?: number | undefined;
            oncePerPeriod?: {
                periodType: "day" | "week" | "month" | "hour";
                resetTime?: string | undefined;
            } | undefined;
        } | undefined;
    };
    icon?: string | undefined;
    description?: string | undefined;
    lastExecutedAt?: Date | undefined;
}>;
export declare const AutomationExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    recipeId: z.ZodString;
    userId: z.ZodString;
    trigger: z.ZodObject<{
        type: z.ZodString;
        data: z.ZodAny;
        timestamp: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        type: string;
        timestamp: Date;
        data?: any;
    }, {
        type: string;
        timestamp: Date;
        data?: any;
    }>;
    status: z.ZodEnum<["queued", "running", "completed", "failed", "timeout", "cancelled", "paused"]>;
    context: z.ZodObject<{
        trigger: z.ZodAny;
        user: z.ZodObject<{
            id: z.ZodString;
            email: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            email: string;
            id: string;
            name: string;
        }, {
            email: string;
            id: string;
            name: string;
        }>;
        workspace: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
        }, {
            id: string;
            name: string;
        }>>;
        variables: z.ZodRecord<z.ZodString, z.ZodAny>;
        environment: z.ZodEnum<["development", "staging", "production"]>;
    }, "strip", z.ZodTypeAny, {
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        user: {
            email: string;
            id: string;
            name: string;
        };
        workspace?: {
            id: string;
            name: string;
        } | undefined;
        trigger?: any;
    }, {
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        user: {
            email: string;
            id: string;
            name: string;
        };
        workspace?: {
            id: string;
            name: string;
        } | undefined;
        trigger?: any;
    }>;
    actions: z.ZodArray<z.ZodObject<{
        actionId: z.ZodString;
        type: z.ZodString;
        status: z.ZodEnum<["queued", "running", "completed", "failed", "timeout", "cancelled", "paused"]>;
        input: z.ZodAny;
        output: z.ZodOptional<z.ZodAny>;
        error: z.ZodOptional<z.ZodObject<{
            message: z.ZodString;
            code: z.ZodString;
            details: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            message: string;
            details?: any;
        }, {
            code: string;
            message: string;
            details?: any;
        }>>;
        retries: z.ZodArray<z.ZodObject<{
            attempt: z.ZodNumber;
            timestamp: z.ZodDate;
            error: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            timestamp: Date;
            attempt: number;
            error?: string | undefined;
        }, {
            timestamp: Date;
            attempt: number;
            error?: string | undefined;
        }>, "many">;
        startedAt: z.ZodDate;
        endedAt: z.ZodOptional<z.ZodDate>;
        duration: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: "failed" | "cancelled" | "paused" | "timeout" | "completed" | "queued" | "running";
        type: string;
        actionId: string;
        retries: {
            timestamp: Date;
            attempt: number;
            error?: string | undefined;
        }[];
        startedAt: Date;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        duration?: number | undefined;
        input?: any;
        output?: any;
        endedAt?: Date | undefined;
    }, {
        status: "failed" | "cancelled" | "paused" | "timeout" | "completed" | "queued" | "running";
        type: string;
        actionId: string;
        retries: {
            timestamp: Date;
            attempt: number;
            error?: string | undefined;
        }[];
        startedAt: Date;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        duration?: number | undefined;
        input?: any;
        output?: any;
        endedAt?: Date | undefined;
    }>, "many">;
    error: z.ZodOptional<z.ZodObject<{
        message: z.ZodString;
        code: z.ZodString;
        action: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        timestamp: Date;
        action?: string | undefined;
    }, {
        code: string;
        message: string;
        timestamp: Date;
        action?: string | undefined;
    }>>;
    startedAt: z.ZodDate;
    endedAt: z.ZodOptional<z.ZodDate>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    actions: {
        status: "failed" | "cancelled" | "paused" | "timeout" | "completed" | "queued" | "running";
        type: string;
        actionId: string;
        retries: {
            timestamp: Date;
            attempt: number;
            error?: string | undefined;
        }[];
        startedAt: Date;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        duration?: number | undefined;
        input?: any;
        output?: any;
        endedAt?: Date | undefined;
    }[];
    id: string;
    status: "failed" | "cancelled" | "paused" | "timeout" | "completed" | "queued" | "running";
    userId: string;
    context: {
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        user: {
            email: string;
            id: string;
            name: string;
        };
        workspace?: {
            id: string;
            name: string;
        } | undefined;
        trigger?: any;
    };
    trigger: {
        type: string;
        timestamp: Date;
        data?: any;
    };
    recipeId: string;
    startedAt: Date;
    error?: {
        code: string;
        message: string;
        timestamp: Date;
        action?: string | undefined;
    } | undefined;
    duration?: number | undefined;
    endedAt?: Date | undefined;
}, {
    actions: {
        status: "failed" | "cancelled" | "paused" | "timeout" | "completed" | "queued" | "running";
        type: string;
        actionId: string;
        retries: {
            timestamp: Date;
            attempt: number;
            error?: string | undefined;
        }[];
        startedAt: Date;
        error?: {
            code: string;
            message: string;
            details?: any;
        } | undefined;
        duration?: number | undefined;
        input?: any;
        output?: any;
        endedAt?: Date | undefined;
    }[];
    id: string;
    status: "failed" | "cancelled" | "paused" | "timeout" | "completed" | "queued" | "running";
    userId: string;
    context: {
        variables: Record<string, any>;
        environment: "development" | "staging" | "production";
        user: {
            email: string;
            id: string;
            name: string;
        };
        workspace?: {
            id: string;
            name: string;
        } | undefined;
        trigger?: any;
    };
    trigger: {
        type: string;
        timestamp: Date;
        data?: any;
    };
    recipeId: string;
    startedAt: Date;
    error?: {
        code: string;
        message: string;
        timestamp: Date;
        action?: string | undefined;
    } | undefined;
    duration?: number | undefined;
    endedAt?: Date | undefined;
}>;
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
    position: {
        x: number;
        y: number;
    };
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
    center: {
        x: number;
        y: number;
    };
    /** Grid settings */
    grid: {
        enabled: boolean;
        size: number;
        snap: boolean;
    };
}
//# sourceMappingURL=automations.d.ts.map