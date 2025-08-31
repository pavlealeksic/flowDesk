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
export type NotificationType = 'email_received' | 'email_urgent' | 'email_mentions' | 'email_vip' | 'meeting_reminder' | 'meeting_starting' | 'meeting_invitation' | 'meeting_updated' | 'meeting_cancelled' | 'message_received' | 'mention_received' | 'direct_message' | 'channel_activity' | 'task_assigned' | 'task_due' | 'task_completed' | 'project_update' | 'deadline_approaching' | 'sync_completed' | 'sync_failed' | 'plugin_update' | 'security_alert' | 'quota_warning' | 'custom';
/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
/**
 * Notification delivery channels
 */
export type NotificationChannel = 'desktop' | 'mobile' | 'email' | 'sms' | 'in_app' | 'badge' | 'sound' | 'webhook';
/**
 * Notification status
 */
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'dismissed' | 'failed' | 'expired';
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
export type NotificationConditionField = 'type' | 'priority' | 'title' | 'message' | 'source' | 'category' | 'tags' | 'time_of_day' | 'day_of_week' | 'user_status' | 'device_type';
/**
 * Notification condition operators
 */
export type NotificationConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'greater_than' | 'less_than' | 'regex';
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
export type NotificationRuleActionType = 'allow' | 'block' | 'modify_priority' | 'modify_channels' | 'group' | 'delay' | 'forward' | 'digest' | 'custom';
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
        startTime: string;
        endTime: string;
        days: number[];
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
        maxAge: number;
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
    priorityAdjustment: number;
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
export declare const NotificationSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodOptional<z.ZodString>;
    type: z.ZodString;
    title: z.ZodString;
    message: z.ZodString;
    priority: z.ZodEnum<["low", "normal", "high", "urgent", "critical"]>;
    data: z.ZodObject<{
        source: z.ZodString;
        sourceId: z.ZodOptional<z.ZodString>;
        sourceType: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
        payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        context: z.ZodOptional<z.ZodObject<{
            accountId: z.ZodOptional<z.ZodString>;
            calendarId: z.ZodOptional<z.ZodString>;
            pluginId: z.ZodOptional<z.ZodString>;
            automationId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            calendarId?: string | undefined;
            accountId?: string | undefined;
            pluginId?: string | undefined;
            automationId?: string | undefined;
        }, {
            calendarId?: string | undefined;
            accountId?: string | undefined;
            pluginId?: string | undefined;
            automationId?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        source: string;
        url?: string | undefined;
        icon?: string | undefined;
        image?: string | undefined;
        context?: {
            calendarId?: string | undefined;
            accountId?: string | undefined;
            pluginId?: string | undefined;
            automationId?: string | undefined;
        } | undefined;
        sourceId?: string | undefined;
        sourceType?: string | undefined;
        payload?: Record<string, any> | undefined;
    }, {
        source: string;
        url?: string | undefined;
        icon?: string | undefined;
        image?: string | undefined;
        context?: {
            calendarId?: string | undefined;
            accountId?: string | undefined;
            pluginId?: string | undefined;
            automationId?: string | undefined;
        } | undefined;
        sourceId?: string | undefined;
        sourceType?: string | undefined;
        payload?: Record<string, any> | undefined;
    }>;
    metadata: z.ZodObject<{
        category: z.ZodOptional<z.ZodString>;
        tags: z.ZodArray<z.ZodString, "many">;
        groupId: z.ZodOptional<z.ZodString>;
        threadId: z.ZodOptional<z.ZodString>;
        tracking: z.ZodOptional<z.ZodObject<{
            campaign: z.ZodOptional<z.ZodString>;
            source: z.ZodOptional<z.ZodString>;
            medium: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            source?: string | undefined;
            medium?: string | undefined;
            campaign?: string | undefined;
        }, {
            source?: string | undefined;
            medium?: string | undefined;
            campaign?: string | undefined;
        }>>;
        localization: z.ZodOptional<z.ZodObject<{
            locale: z.ZodString;
            timezone: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            timezone: string;
            locale: string;
        }, {
            timezone: string;
            locale: string;
        }>>;
        experiment: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            variant: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            variant: string;
        }, {
            id: string;
            variant: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        threadId?: string | undefined;
        category?: string | undefined;
        groupId?: string | undefined;
        tracking?: {
            source?: string | undefined;
            medium?: string | undefined;
            campaign?: string | undefined;
        } | undefined;
        localization?: {
            timezone: string;
            locale: string;
        } | undefined;
        experiment?: {
            id: string;
            variant: string;
        } | undefined;
    }, {
        tags: string[];
        threadId?: string | undefined;
        category?: string | undefined;
        groupId?: string | undefined;
        tracking?: {
            source?: string | undefined;
            medium?: string | undefined;
            campaign?: string | undefined;
        } | undefined;
        localization?: {
            timezone: string;
            locale: string;
        } | undefined;
        experiment?: {
            id: string;
            variant: string;
        } | undefined;
    }>;
    status: z.ZodEnum<["pending", "sent", "delivered", "read", "dismissed", "failed", "expired"]>;
    channels: z.ZodArray<z.ZodString, "many">;
    actions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        type: z.ZodEnum<["button", "inline", "quick_reply"]>;
        style: z.ZodOptional<z.ZodEnum<["primary", "secondary", "destructive"]>>;
        icon: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        command: z.ZodOptional<z.ZodString>;
        payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        dismissOnAction: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "button" | "inline" | "quick_reply";
        label: string;
        dismissOnAction: boolean;
        url?: string | undefined;
        icon?: string | undefined;
        command?: string | undefined;
        payload?: Record<string, any> | undefined;
        style?: "primary" | "secondary" | "destructive" | undefined;
    }, {
        id: string;
        type: "button" | "inline" | "quick_reply";
        label: string;
        dismissOnAction: boolean;
        url?: string | undefined;
        icon?: string | undefined;
        command?: string | undefined;
        payload?: Record<string, any> | undefined;
        style?: "primary" | "secondary" | "destructive" | undefined;
    }>, "many">;
    expiresAt: z.ZodOptional<z.ZodDate>;
    scheduledFor: z.ZodOptional<z.ZodDate>;
    deliveredAt: z.ZodOptional<z.ZodDate>;
    readAt: z.ZodOptional<z.ZodDate>;
    dismissedAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    status: "read" | "sent" | "failed" | "pending" | "expired" | "delivered" | "dismissed";
    title: string;
    data: {
        source: string;
        url?: string | undefined;
        icon?: string | undefined;
        image?: string | undefined;
        context?: {
            calendarId?: string | undefined;
            accountId?: string | undefined;
            pluginId?: string | undefined;
            automationId?: string | undefined;
        } | undefined;
        sourceId?: string | undefined;
        sourceType?: string | undefined;
        payload?: Record<string, any> | undefined;
    };
    type: string;
    priority: "normal" | "low" | "high" | "critical" | "urgent";
    message: string;
    metadata: {
        tags: string[];
        threadId?: string | undefined;
        category?: string | undefined;
        groupId?: string | undefined;
        tracking?: {
            source?: string | undefined;
            medium?: string | undefined;
            campaign?: string | undefined;
        } | undefined;
        localization?: {
            timezone: string;
            locale: string;
        } | undefined;
        experiment?: {
            id: string;
            variant: string;
        } | undefined;
    };
    actions: {
        id: string;
        type: "button" | "inline" | "quick_reply";
        label: string;
        dismissOnAction: boolean;
        url?: string | undefined;
        icon?: string | undefined;
        command?: string | undefined;
        payload?: Record<string, any> | undefined;
        style?: "primary" | "secondary" | "destructive" | undefined;
    }[];
    channels: string[];
    workspaceId?: string | undefined;
    expiresAt?: Date | undefined;
    scheduledFor?: Date | undefined;
    deliveredAt?: Date | undefined;
    readAt?: Date | undefined;
    dismissedAt?: Date | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    status: "read" | "sent" | "failed" | "pending" | "expired" | "delivered" | "dismissed";
    title: string;
    data: {
        source: string;
        url?: string | undefined;
        icon?: string | undefined;
        image?: string | undefined;
        context?: {
            calendarId?: string | undefined;
            accountId?: string | undefined;
            pluginId?: string | undefined;
            automationId?: string | undefined;
        } | undefined;
        sourceId?: string | undefined;
        sourceType?: string | undefined;
        payload?: Record<string, any> | undefined;
    };
    type: string;
    priority: "normal" | "low" | "high" | "critical" | "urgent";
    message: string;
    metadata: {
        tags: string[];
        threadId?: string | undefined;
        category?: string | undefined;
        groupId?: string | undefined;
        tracking?: {
            source?: string | undefined;
            medium?: string | undefined;
            campaign?: string | undefined;
        } | undefined;
        localization?: {
            timezone: string;
            locale: string;
        } | undefined;
        experiment?: {
            id: string;
            variant: string;
        } | undefined;
    };
    actions: {
        id: string;
        type: "button" | "inline" | "quick_reply";
        label: string;
        dismissOnAction: boolean;
        url?: string | undefined;
        icon?: string | undefined;
        command?: string | undefined;
        payload?: Record<string, any> | undefined;
        style?: "primary" | "secondary" | "destructive" | undefined;
    }[];
    channels: string[];
    workspaceId?: string | undefined;
    expiresAt?: Date | undefined;
    scheduledFor?: Date | undefined;
    deliveredAt?: Date | undefined;
    readAt?: Date | undefined;
    dismissedAt?: Date | undefined;
}>;
export declare const NotificationRuleSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    workspaceId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    enabled: z.ZodBoolean;
    priority: z.ZodNumber;
    conditions: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "in", "not_in", "greater_than", "less_than", "regex"]>;
        value: z.ZodAny;
        caseSensitive: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in";
        value?: any;
        caseSensitive?: boolean | undefined;
    }, {
        field: string;
        operator: "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in";
        value?: any;
        caseSensitive?: boolean | undefined;
    }>, "many">;
    actions: z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        params: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        params: Record<string, any>;
    }, {
        type: string;
        params: Record<string, any>;
    }>, "many">;
    stats: z.ZodObject<{
        triggerCount: z.ZodNumber;
        affectedNotifications: z.ZodNumber;
        lastTriggered: z.ZodOptional<z.ZodDate>;
        successRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        triggerCount: number;
        affectedNotifications: number;
        successRate: number;
        lastTriggered?: Date | undefined;
    }, {
        triggerCount: number;
        affectedNotifications: number;
        successRate: number;
        lastTriggered?: Date | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    stats: {
        triggerCount: number;
        affectedNotifications: number;
        successRate: number;
        lastTriggered?: Date | undefined;
    };
    priority: number;
    conditions: {
        field: string;
        operator: "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in";
        value?: any;
        caseSensitive?: boolean | undefined;
    }[];
    actions: {
        type: string;
        params: Record<string, any>;
    }[];
    enabled: boolean;
    description?: string | undefined;
    workspaceId?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    stats: {
        triggerCount: number;
        affectedNotifications: number;
        successRate: number;
        lastTriggered?: Date | undefined;
    };
    priority: number;
    conditions: {
        field: string;
        operator: "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in";
        value?: any;
        caseSensitive?: boolean | undefined;
    }[];
    actions: {
        type: string;
        params: Record<string, any>;
    }[];
    enabled: boolean;
    description?: string | undefined;
    workspaceId?: string | undefined;
}>;
export declare const NotificationDigestSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    enabled: z.ZodBoolean;
    schedule: z.ZodObject<{
        type: z.ZodEnum<["immediate", "scheduled", "batch"]>;
        frequency: z.ZodOptional<z.ZodEnum<["hourly", "daily", "weekly", "monthly"]>>;
        timeOfDay: z.ZodOptional<z.ZodString>;
        dayOfWeek: z.ZodOptional<z.ZodNumber>;
        dayOfMonth: z.ZodOptional<z.ZodNumber>;
        batchSize: z.ZodOptional<z.ZodNumber>;
        batchTimeout: z.ZodOptional<z.ZodNumber>;
        timezone: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timezone: string;
        type: "scheduled" | "immediate" | "batch";
        frequency?: "monthly" | "hourly" | "daily" | "weekly" | undefined;
        batchSize?: number | undefined;
        timeOfDay?: string | undefined;
        dayOfWeek?: number | undefined;
        dayOfMonth?: number | undefined;
        batchTimeout?: number | undefined;
    }, {
        timezone: string;
        type: "scheduled" | "immediate" | "batch";
        frequency?: "monthly" | "hourly" | "daily" | "weekly" | undefined;
        batchSize?: number | undefined;
        timeOfDay?: string | undefined;
        dayOfWeek?: number | undefined;
        dayOfMonth?: number | undefined;
        batchTimeout?: number | undefined;
    }>;
    filters: z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodString;
        value: z.ZodAny;
        caseSensitive: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: string;
        value?: any;
        caseSensitive?: boolean | undefined;
    }, {
        field: string;
        operator: string;
        value?: any;
        caseSensitive?: boolean | undefined;
    }>, "many">;
    template: z.ZodObject<{
        format: z.ZodEnum<["html", "text", "markdown"]>;
        subject: z.ZodString;
        header: z.ZodOptional<z.ZodString>;
        footer: z.ZodOptional<z.ZodString>;
        itemTemplate: z.ZodString;
        grouping: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            groupBy: z.ZodEnum<["type", "source", "priority", "date"]>;
            maxGroups: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            groupBy: "source" | "type" | "priority" | "date";
            maxGroups: number;
        }, {
            enabled: boolean;
            groupBy: "source" | "type" | "priority" | "date";
            maxGroups: number;
        }>>;
        styling: z.ZodOptional<z.ZodObject<{
            theme: z.ZodEnum<["light", "dark"]>;
            accentColor: z.ZodString;
            fontSize: z.ZodEnum<["small", "medium", "large"]>;
        }, "strip", z.ZodTypeAny, {
            theme: "light" | "dark";
            accentColor: string;
            fontSize: "small" | "medium" | "large";
        }, {
            theme: "light" | "dark";
            accentColor: string;
            fontSize: "small" | "medium" | "large";
        }>>;
    }, "strip", z.ZodTypeAny, {
        format: "text" | "html" | "markdown";
        subject: string;
        itemTemplate: string;
        header?: string | undefined;
        footer?: string | undefined;
        grouping?: {
            enabled: boolean;
            groupBy: "source" | "type" | "priority" | "date";
            maxGroups: number;
        } | undefined;
        styling?: {
            theme: "light" | "dark";
            accentColor: string;
            fontSize: "small" | "medium" | "large";
        } | undefined;
    }, {
        format: "text" | "html" | "markdown";
        subject: string;
        itemTemplate: string;
        header?: string | undefined;
        footer?: string | undefined;
        grouping?: {
            enabled: boolean;
            groupBy: "source" | "type" | "priority" | "date";
            maxGroups: number;
        } | undefined;
        styling?: {
            theme: "light" | "dark";
            accentColor: string;
            fontSize: "small" | "medium" | "large";
        } | undefined;
    }>;
    channels: z.ZodArray<z.ZodString, "many">;
    stats: z.ZodObject<{
        totalSent: z.ZodNumber;
        totalNotifications: z.ZodNumber;
        avgNotificationsPerDigest: z.ZodNumber;
        lastSent: z.ZodOptional<z.ZodDate>;
        openRate: z.ZodOptional<z.ZodNumber>;
        clickRate: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        totalSent: number;
        totalNotifications: number;
        avgNotificationsPerDigest: number;
        lastSent?: Date | undefined;
        openRate?: number | undefined;
        clickRate?: number | undefined;
    }, {
        totalSent: number;
        totalNotifications: number;
        avgNotificationsPerDigest: number;
        lastSent?: Date | undefined;
        openRate?: number | undefined;
        clickRate?: number | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    stats: {
        totalSent: number;
        totalNotifications: number;
        avgNotificationsPerDigest: number;
        lastSent?: Date | undefined;
        openRate?: number | undefined;
        clickRate?: number | undefined;
    };
    filters: {
        field: string;
        operator: string;
        value?: any;
        caseSensitive?: boolean | undefined;
    }[];
    enabled: boolean;
    channels: string[];
    schedule: {
        timezone: string;
        type: "scheduled" | "immediate" | "batch";
        frequency?: "monthly" | "hourly" | "daily" | "weekly" | undefined;
        batchSize?: number | undefined;
        timeOfDay?: string | undefined;
        dayOfWeek?: number | undefined;
        dayOfMonth?: number | undefined;
        batchTimeout?: number | undefined;
    };
    template: {
        format: "text" | "html" | "markdown";
        subject: string;
        itemTemplate: string;
        header?: string | undefined;
        footer?: string | undefined;
        grouping?: {
            enabled: boolean;
            groupBy: "source" | "type" | "priority" | "date";
            maxGroups: number;
        } | undefined;
        styling?: {
            theme: "light" | "dark";
            accentColor: string;
            fontSize: "small" | "medium" | "large";
        } | undefined;
    };
    description?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    name: string;
    stats: {
        totalSent: number;
        totalNotifications: number;
        avgNotificationsPerDigest: number;
        lastSent?: Date | undefined;
        openRate?: number | undefined;
        clickRate?: number | undefined;
    };
    filters: {
        field: string;
        operator: string;
        value?: any;
        caseSensitive?: boolean | undefined;
    }[];
    enabled: boolean;
    channels: string[];
    schedule: {
        timezone: string;
        type: "scheduled" | "immediate" | "batch";
        frequency?: "monthly" | "hourly" | "daily" | "weekly" | undefined;
        batchSize?: number | undefined;
        timeOfDay?: string | undefined;
        dayOfWeek?: number | undefined;
        dayOfMonth?: number | undefined;
        batchTimeout?: number | undefined;
    };
    template: {
        format: "text" | "html" | "markdown";
        subject: string;
        itemTemplate: string;
        header?: string | undefined;
        footer?: string | undefined;
        grouping?: {
            enabled: boolean;
            groupBy: "source" | "type" | "priority" | "date";
            maxGroups: number;
        } | undefined;
        styling?: {
            theme: "light" | "dark";
            accentColor: string;
            fontSize: "small" | "medium" | "large";
        } | undefined;
    };
    description?: string | undefined;
}>;
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
//# sourceMappingURL=notifications.d.ts.map