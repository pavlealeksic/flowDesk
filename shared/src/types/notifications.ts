/**
 * Notifications System Types for Flow Desk
 * 
 * Defines comprehensive types for notification management, rules, digests,
 * channels, and delivery systems following Blueprint.md requirements.
 */

import { z } from 'zod';

/**
 * Notification types
 */
export type NotificationType = 
  // Email notifications
  | 'email_received'
  | 'email_urgent'
  | 'email_mentions'
  | 'email_vip'
  // Calendar notifications
  | 'meeting_reminder'
  | 'meeting_starting'
  | 'meeting_invitation'
  | 'meeting_updated'
  | 'meeting_cancelled'
  // Chat/messaging notifications
  | 'message_received'
  | 'mention_received'
  | 'direct_message'
  | 'channel_activity'
  // Task/project notifications
  | 'task_assigned'
  | 'task_due'
  | 'task_completed'
  | 'project_update'
  | 'deadline_approaching'
  // System notifications
  | 'sync_completed'
  | 'sync_failed'
  | 'plugin_update'
  | 'security_alert'
  | 'quota_warning'
  // Custom notifications
  | 'custom';

/**
 * Notification priority levels
 */
export type NotificationPriority = 
  | 'low'       // Background notifications, batched
  | 'normal'    // Standard notifications
  | 'high'      // Important notifications, shown immediately
  | 'urgent'    // Critical notifications, bypass DND
  | 'critical'; // System-critical, always shown

/**
 * Notification delivery channels
 */
export type NotificationChannel = 
  | 'desktop'     // Desktop notification
  | 'mobile'      // Mobile push notification
  | 'email'       // Email notification
  | 'sms'         // SMS notification
  | 'in_app'      // In-app notification
  | 'badge'       // App badge/counter
  | 'sound'       // Audio notification
  | 'webhook';    // Webhook delivery

/**
 * Notification status
 */
export type NotificationStatus = 
  | 'pending'     // Queued for delivery
  | 'sent'        // Successfully sent
  | 'delivered'   // Delivered to recipient
  | 'read'        // Read by recipient
  | 'dismissed'   // Dismissed by recipient
  | 'failed'      // Delivery failed
  | 'expired';    // Notification expired

/**
 * Core notification entity
 */
export interface Notification {
  /** Notification ID */
  id: string;
  /** User ID */
  userId: string;
  /** Workspace ID */
  workspaceId?: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Notification priority */
  priority: NotificationPriority;
  /** Notification data */
  data: NotificationData;
  /** Notification metadata */
  metadata: NotificationMetadata;
  /** Notification status */
  status: NotificationStatus;
  /** Delivery channels used */
  channels: NotificationChannel[];
  /** Notification actions */
  actions: NotificationAction[];
  /** Expiry date */
  expiresAt?: Date;
  /** Scheduled delivery time */
  scheduledFor?: Date;
  /** Actual delivery time */
  deliveredAt?: Date;
  /** Read timestamp */
  readAt?: Date;
  /** Dismissed timestamp */
  dismissedAt?: Date;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Notification data payload
 */
export interface NotificationData {
  /** Source application/service */
  source: string;
  /** Source entity ID */
  sourceId?: string;
  /** Source entity type */
  sourceType?: string;
  /** Deep link URL */
  url?: string;
  /** Notification icon */
  icon?: string;
  /** Notification image */
  image?: string;
  /** Additional payload data */
  payload?: Record<string, any>;
  /** Context information */
  context?: {
    accountId?: string;
    calendarId?: string;
    pluginId?: string;
    automationId?: string;
  };
}

/**
 * Notification metadata
 */
export interface NotificationMetadata {
  /** Notification category */
  category?: string;
  /** Notification tags */
  tags: string[];
  /** Notification group ID */
  groupId?: string;
  /** Thread ID for grouping */
  threadId?: string;
  /** Tracking information */
  tracking?: {
    campaign?: string;
    source?: string;
    medium?: string;
  };
  /** Localization */
  localization?: {
    locale: string;
    timezone: string;
  };
  /** A/B testing */
  experiment?: {
    id: string;
    variant: string;
  };
}

/**
 * Notification action
 */
export interface NotificationAction {
  /** Action ID */
  id: string;
  /** Action label */
  label: string;
  /** Action type */
  type: 'button' | 'inline' | 'quick_reply';
  /** Action style */
  style?: 'primary' | 'secondary' | 'destructive';
  /** Action icon */
  icon?: string;
  /** Action URL */
  url?: string;
  /** Action command */
  command?: string;
  /** Action payload */
  payload?: Record<string, any>;
  /** Whether action dismisses notification */
  dismissOnAction: boolean;
}

/**
 * Notification rule for filtering and routing
 */
export interface NotificationRule {
  /** Rule ID */
  id: string;
  /** User ID */
  userId: string;
  /** Workspace ID */
  workspaceId?: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description?: string;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Rule priority (lower number = higher priority) */
  priority: number;
  /** Rule conditions */
  conditions: NotificationCondition[];
  /** Rule actions */
  actions: NotificationRuleAction[];
  /** Rule statistics */
  stats: NotificationRuleStats;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Notification rule condition
 */
export interface NotificationCondition {
  /** Condition field */
  field: NotificationConditionField;
  /** Condition operator */
  operator: NotificationConditionOperator;
  /** Condition value */
  value: any;
  /** Case sensitive matching */
  caseSensitive?: boolean;
}

/**
 * Notification condition fields
 */
export type NotificationConditionField = 
  | 'type'
  | 'priority'
  | 'title'
  | 'message'
  | 'source'
  | 'category'
  | 'tags'
  | 'time_of_day'
  | 'day_of_week'
  | 'user_status'
  | 'device_type';

/**
 * Notification condition operators
 */
export type NotificationConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'regex';

/**
 * Notification rule action
 */
export interface NotificationRuleAction {
  /** Action type */
  type: NotificationRuleActionType;
  /** Action parameters */
  params: Record<string, any>;
}

/**
 * Notification rule action types
 */
export type NotificationRuleActionType = 
  | 'allow'           // Allow notification through
  | 'block'           // Block notification
  | 'modify_priority' // Change notification priority
  | 'modify_channels' // Change delivery channels
  | 'group'           // Group with other notifications
  | 'delay'           // Delay delivery
  | 'forward'         // Forward to another user
  | 'digest'          // Add to digest
  | 'custom';         // Custom action

/**
 * Notification rule statistics
 */
export interface NotificationRuleStats {
  /** Number of times rule was triggered */
  triggerCount: number;
  /** Number of notifications affected */
  affectedNotifications: number;
  /** Last trigger timestamp */
  lastTriggered?: Date;
  /** Success rate */
  successRate: number;
}

/**
 * Notification digest configuration
 */
export interface NotificationDigest {
  /** Digest ID */
  id: string;
  /** User ID */
  userId: string;
  /** Digest name */
  name: string;
  /** Digest description */
  description?: string;
  /** Whether digest is enabled */
  enabled: boolean;
  /** Digest schedule */
  schedule: DigestSchedule;
  /** Digest filters */
  filters: NotificationCondition[];
  /** Digest template */
  template: DigestTemplate;
  /** Delivery channels */
  channels: NotificationChannel[];
  /** Digest statistics */
  stats: DigestStats;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Digest schedule configuration
 */
export interface DigestSchedule {
  /** Schedule type */
  type: 'immediate' | 'scheduled' | 'batch';
  /** Frequency for scheduled digests */
  frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  /** Time of day for daily digests (HH:mm) */
  timeOfDay?: string;
  /** Day of week for weekly digests (0-6, Sunday=0) */
  dayOfWeek?: number;
  /** Day of month for monthly digests (1-31) */
  dayOfMonth?: number;
  /** Batch size for batch digests */
  batchSize?: number;
  /** Batch timeout in minutes */
  batchTimeout?: number;
  /** Timezone for scheduling */
  timezone: string;
}

/**
 * Digest template configuration
 */
export interface DigestTemplate {
  /** Template format */
  format: 'html' | 'text' | 'markdown';
  /** Template subject (for email) */
  subject: string;
  /** Template header */
  header?: string;
  /** Template footer */
  footer?: string;
  /** Item template */
  itemTemplate: string;
  /** Grouping configuration */
  grouping?: {
    enabled: boolean;
    groupBy: 'type' | 'source' | 'priority' | 'date';
    maxGroups: number;
  };
  /** Styling configuration */
  styling?: {
    theme: 'light' | 'dark';
    accentColor: string;
    fontSize: 'small' | 'medium' | 'large';
  };
}

/**
 * Digest statistics
 */
export interface DigestStats {
  /** Total digests sent */
  totalSent: number;
  /** Total notifications included */
  totalNotifications: number;
  /** Average notifications per digest */
  avgNotificationsPerDigest: number;
  /** Last digest sent */
  lastSent?: Date;
  /** Open rate (for email digests) */
  openRate?: number;
  /** Click rate (for email digests) */
  clickRate?: number;
}

/**
 * Do Not Disturb configuration
 */
export interface DoNotDisturb {
  /** Whether DND is enabled */
  enabled: boolean;
  /** DND schedule */
  schedule: DNDSchedule;
  /** Priority exceptions */
  exceptions: {
    /** Allow urgent notifications */
    urgent: boolean;
    /** Allow critical notifications */
    critical: boolean;
    /** Allow notifications from VIP contacts */
    vipContacts: boolean;
    /** Allow notifications from specific sources */
    allowedSources: string[];
    /** Allow notifications with specific types */
    allowedTypes: NotificationType[];
  };
  /** Auto-reply settings */
  autoReply?: {
    enabled: boolean;
    message: string;
    channels: NotificationChannel[];
  };
}

/**
 * DND schedule configuration
 */
export interface DNDSchedule {
  /** Schedule type */
  type: 'always' | 'scheduled' | 'calendar_based' | 'smart';
  /** Scheduled DND times */
  scheduled?: Array<{
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    days: number[];    // 0-6, Sunday=0
  }>;
  /** Calendar-based DND */
  calendarBased?: {
    calendarIds: string[];
    busyOnly: boolean;
    includeAllDay: boolean;
  };
  /** Smart DND settings */
  smart?: {
    learnFromBehavior: boolean;
    considerWorkHours: boolean;
    considerLocation: boolean;
  };
  /** Timezone */
  timezone: string;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  /** User ID */
  userId: string;
  /** Global preferences */
  global: {
    /** Master notification toggle */
    enabled: boolean;
    /** Default channels */
    defaultChannels: NotificationChannel[];
    /** Default priority threshold */
    minPriority: NotificationPriority;
    /** Quiet hours */
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      days: number[];
    };
  };
  /** Channel-specific preferences */
  channels: Record<NotificationChannel, ChannelPreferences>;
  /** Type-specific preferences */
  types: Record<NotificationType, TypePreferences>;
  /** Source-specific preferences */
  sources: Record<string, SourcePreferences>;
  /** Do Not Disturb settings */
  doNotDisturb: DoNotDisturb;
}

/**
 * Channel-specific preferences
 */
export interface ChannelPreferences {
  /** Whether channel is enabled */
  enabled: boolean;
  /** Minimum priority for this channel */
  minPriority: NotificationPriority;
  /** Throttling settings */
  throttling?: {
    enabled: boolean;
    maxPerHour: number;
    burstLimit: number;
  };
  /** Channel-specific settings */
  settings?: Record<string, any>;
}

/**
 * Type-specific preferences
 */
export interface TypePreferences {
  /** Whether type is enabled */
  enabled: boolean;
  /** Preferred channels for this type */
  channels: NotificationChannel[];
  /** Priority for this type */
  priority: NotificationPriority;
  /** Grouping settings */
  grouping?: {
    enabled: boolean;
    maxAge: number; // minutes
    maxSize: number;
  };
}

/**
 * Source-specific preferences
 */
export interface SourcePreferences {
  /** Whether source is enabled */
  enabled: boolean;
  /** Preferred channels for this source */
  channels: NotificationChannel[];
  /** Priority adjustment */
  priorityAdjustment: number; // -2 to +2
  /** VIP status */
  vip: boolean;
}

/**
 * Notification delivery log
 */
export interface NotificationDeliveryLog {
  /** Log entry ID */
  id: string;
  /** Notification ID */
  notificationId: string;
  /** Delivery channel */
  channel: NotificationChannel;
  /** Delivery status */
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
  /** Delivery attempt number */
  attempt: number;
  /** Delivery details */
  details: {
    /** Delivery provider */
    provider?: string;
    /** Provider message ID */
    providerMessageId?: string;
    /** Delivery timestamp */
    deliveredAt?: Date;
    /** Error information */
    error?: {
      code: string;
      message: string;
      retryable: boolean;
    };
    /** Response metadata */
    metadata?: Record<string, any>;
  };
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Notification analytics
 */
export interface NotificationAnalytics {
  /** Analytics period */
  period: {
    start: Date;
    end: Date;
  };
  /** Overall statistics */
  overview: {
    totalNotifications: number;
    deliveredNotifications: number;
    readNotifications: number;
    dismissedNotifications: number;
    deliveryRate: number;
    readRate: number;
    avgDeliveryTime: number;
  };
  /** Channel performance */
  channels: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
    avgDeliveryTime: number;
  }>;
  /** Type breakdown */
  types: Record<NotificationType, {
    sent: number;
    readRate: number;
    dismissRate: number;
    avgTimeToRead: number;
  }>;
  /** Priority breakdown */
  priorities: Record<NotificationPriority, {
    sent: number;
    deliveryRate: number;
    readRate: number;
  }>;
  /** Hourly distribution */
  hourlyDistribution: Array<{
    hour: number;
    count: number;
    deliveryRate: number;
  }>;
  /** User engagement */
  engagement: {
    activeUsers: number;
    avgNotificationsPerUser: number;
    topEngagedUsers: Array<{
      userId: string;
      readRate: number;
      responseTime: number;
    }>;
  };
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Notification type */
  type: NotificationType;
  /** Template title */
  title: string;
  /** Template message */
  message: string;
  /** Template variables */
  variables: TemplateVariable[];
  /** Localization support */
  localizations: Record<string, {
    title: string;
    message: string;
  }>;
  /** Template actions */
  actions: NotificationAction[];
  /** Template settings */
  settings: {
    priority: NotificationPriority;
    channels: NotificationChannel[];
    expirationMinutes?: number;
  };
  /** Template statistics */
  stats: {
    usageCount: number;
    deliveryRate: number;
    readRate: number;
    lastUsed?: Date;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  /** Variable description */
  description?: string;
  /** Whether variable is required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Validation rules */
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

// Zod schemas for runtime validation
export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string().optional(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'critical']),
  data: z.object({
    source: z.string(),
    sourceId: z.string().optional(),
    sourceType: z.string().optional(),
    url: z.string().url().optional(),
    icon: z.string().optional(),
    image: z.string().optional(),
    payload: z.record(z.any()).optional(),
    context: z.object({
      accountId: z.string().optional(),
      calendarId: z.string().optional(),
      pluginId: z.string().optional(),
      automationId: z.string().optional()
    }).optional()
  }),
  metadata: z.object({
    category: z.string().optional(),
    tags: z.array(z.string()),
    groupId: z.string().optional(),
    threadId: z.string().optional(),
    tracking: z.object({
      campaign: z.string().optional(),
      source: z.string().optional(),
      medium: z.string().optional()
    }).optional(),
    localization: z.object({
      locale: z.string(),
      timezone: z.string()
    }).optional(),
    experiment: z.object({
      id: z.string(),
      variant: z.string()
    }).optional()
  }),
  status: z.enum(['pending', 'sent', 'delivered', 'read', 'dismissed', 'failed', 'expired']),
  channels: z.array(z.string()),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['button', 'inline', 'quick_reply']),
    style: z.enum(['primary', 'secondary', 'destructive']).optional(),
    icon: z.string().optional(),
    url: z.string().url().optional(),
    command: z.string().optional(),
    payload: z.record(z.any()).optional(),
    dismissOnAction: z.boolean()
  })),
  expiresAt: z.date().optional(),
  scheduledFor: z.date().optional(),
  deliveredAt: z.date().optional(),
  readAt: z.date().optional(),
  dismissedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const NotificationRuleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workspaceId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  priority: z.number(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'greater_than', 'less_than', 'regex']),
    value: z.any(),
    caseSensitive: z.boolean().optional()
  })),
  actions: z.array(z.object({
    type: z.string(),
    params: z.record(z.any())
  })),
  stats: z.object({
    triggerCount: z.number(),
    affectedNotifications: z.number(),
    lastTriggered: z.date().optional(),
    successRate: z.number()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const NotificationDigestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  schedule: z.object({
    type: z.enum(['immediate', 'scheduled', 'batch']),
    frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
    timeOfDay: z.string().optional(),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    batchSize: z.number().optional(),
    batchTimeout: z.number().optional(),
    timezone: z.string()
  }),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any(),
    caseSensitive: z.boolean().optional()
  })),
  template: z.object({
    format: z.enum(['html', 'text', 'markdown']),
    subject: z.string(),
    header: z.string().optional(),
    footer: z.string().optional(),
    itemTemplate: z.string(),
    grouping: z.object({
      enabled: z.boolean(),
      groupBy: z.enum(['type', 'source', 'priority', 'date']),
      maxGroups: z.number()
    }).optional(),
    styling: z.object({
      theme: z.enum(['light', 'dark']),
      accentColor: z.string(),
      fontSize: z.enum(['small', 'medium', 'large'])
    }).optional()
  }),
  channels: z.array(z.string()),
  stats: z.object({
    totalSent: z.number(),
    totalNotifications: z.number(),
    avgNotificationsPerDigest: z.number(),
    lastSent: z.date().optional(),
    openRate: z.number().optional(),
    clickRate: z.number().optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Utility types for notification operations
 */
export type CreateNotificationInput = Omit<Notification, 'id' | 'status' | 'deliveredAt' | 'readAt' | 'dismissedAt' | 'createdAt' | 'updatedAt'>;
export type UpdateNotificationInput = Partial<Pick<Notification, 'status' | 'readAt' | 'dismissedAt'>>;

export type CreateNotificationRuleInput = Omit<NotificationRule, 'id' | 'stats' | 'createdAt' | 'updatedAt'>;
export type UpdateNotificationRuleInput = Partial<Pick<NotificationRule, 'name' | 'description' | 'enabled' | 'conditions' | 'actions'>>;

export type CreateNotificationDigestInput = Omit<NotificationDigest, 'id' | 'stats' | 'createdAt' | 'updatedAt'>;
export type UpdateNotificationDigestInput = Partial<Pick<NotificationDigest, 'name' | 'description' | 'enabled' | 'schedule' | 'filters' | 'template' | 'channels'>>;

/**
 * Notification queue management
 */
export interface NotificationQueue {
  /** Queue ID */
  id: string;
  /** Queue name */
  name: string;
  /** Queue priority */
  priority: number;
  /** Queue configuration */
  config: {
    /** Maximum queue size */
    maxSize: number;
    /** Processing rate (per minute) */
    processingRate: number;
    /** Retry attempts */
    retryAttempts: number;
    /** Retry backoff multiplier */
    retryBackoff: number;
    /** Dead letter queue */
    deadLetterQueue?: string;
  };
  /** Queue statistics */
  stats: {
    /** Pending notifications */
    pending: number;
    /** Processing notifications */
    processing: number;
    /** Completed notifications */
    completed: number;
    /** Failed notifications */
    failed: number;
    /** Average processing time */
    avgProcessingTime: number;
  };
  /** Queue status */
  status: 'active' | 'paused' | 'stopped';
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Notification provider configuration
 */
export interface NotificationProvider {
  /** Provider ID */
  id: string;
  /** Provider type */
  type: 'email' | 'sms' | 'push' | 'webhook' | 'custom';
  /** Provider name */
  name: string;
  /** Provider configuration */
  config: Record<string, any>;
  /** Provider capabilities */
  capabilities: {
    /** Supported channels */
    channels: NotificationChannel[];
    /** Batch sending support */
    batchSending: boolean;
    /** Template support */
    templateSupport: boolean;
    /** Rich content support */
    richContent: boolean;
    /** Delivery tracking */
    deliveryTracking: boolean;
  };
  /** Provider limits */
  limits: {
    /** Rate limit (per minute) */
    rateLimit: number;
    /** Daily quota */
    dailyQuota?: number;
    /** Monthly quota */
    monthlyQuota?: number;
    /** Message size limit */
    messageSizeLimit?: number;
  };
  /** Provider status */
  status: 'active' | 'inactive' | 'error';
  /** Last health check */
  lastHealthCheck?: Date;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}