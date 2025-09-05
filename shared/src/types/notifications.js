"use strict";
/**
 * Notifications System Types for Flow Desk
 *
 * Defines comprehensive types for notification management, rules, digests,
 * channels, and delivery systems following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDigestSchema = exports.NotificationRuleSchema = exports.NotificationSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.NotificationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    workspaceId: zod_1.z.string().optional(),
    type: zod_1.z.string(),
    title: zod_1.z.string(),
    message: zod_1.z.string(),
    priority: zod_1.z.enum(['low', 'normal', 'high', 'urgent', 'critical']),
    data: zod_1.z.object({
        source: zod_1.z.string(),
        sourceId: zod_1.z.string().optional(),
        sourceType: zod_1.z.string().optional(),
        url: zod_1.z.string().url().optional(),
        icon: zod_1.z.string().optional(),
        image: zod_1.z.string().optional(),
        payload: zod_1.z.record(zod_1.z.any()).optional(),
        context: zod_1.z.object({
            accountId: zod_1.z.string().optional(),
            calendarId: zod_1.z.string().optional(),
            pluginId: zod_1.z.string().optional(),
            automationId: zod_1.z.string().optional()
        }).optional()
    }),
    metadata: zod_1.z.object({
        category: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()),
        groupId: zod_1.z.string().optional(),
        threadId: zod_1.z.string().optional(),
        tracking: zod_1.z.object({
            campaign: zod_1.z.string().optional(),
            source: zod_1.z.string().optional(),
            medium: zod_1.z.string().optional()
        }).optional(),
        localization: zod_1.z.object({
            locale: zod_1.z.string(),
            timezone: zod_1.z.string()
        }).optional(),
        experiment: zod_1.z.object({
            id: zod_1.z.string(),
            variant: zod_1.z.string()
        }).optional()
    }),
    status: zod_1.z.enum(['pending', 'sent', 'delivered', 'read', 'dismissed', 'failed', 'expired']),
    channels: zod_1.z.array(zod_1.z.string()),
    actions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        type: zod_1.z.enum(['button', 'inline', 'quick_reply']),
        style: zod_1.z.enum(['primary', 'secondary', 'destructive']).optional(),
        icon: zod_1.z.string().optional(),
        url: zod_1.z.string().url().optional(),
        command: zod_1.z.string().optional(),
        payload: zod_1.z.record(zod_1.z.any()).optional(),
        dismissOnAction: zod_1.z.boolean()
    })),
    expiresAt: zod_1.z.date().optional(),
    scheduledFor: zod_1.z.date().optional(),
    deliveredAt: zod_1.z.date().optional(),
    readAt: zod_1.z.date().optional(),
    dismissedAt: zod_1.z.date().optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.NotificationRuleSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    workspaceId: zod_1.z.string().optional(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    enabled: zod_1.z.boolean(),
    priority: zod_1.z.number(),
    conditions: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        operator: zod_1.z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'greater_than', 'less_than', 'regex']),
        value: zod_1.z.any(),
        caseSensitive: zod_1.z.boolean().optional()
    })),
    actions: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.string(),
        params: zod_1.z.record(zod_1.z.any())
    })),
    stats: zod_1.z.object({
        triggerCount: zod_1.z.number(),
        affectedNotifications: zod_1.z.number(),
        lastTriggered: zod_1.z.date().optional(),
        successRate: zod_1.z.number()
    }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.NotificationDigestSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    enabled: zod_1.z.boolean(),
    schedule: zod_1.z.object({
        type: zod_1.z.enum(['immediate', 'scheduled', 'batch']),
        frequency: zod_1.z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
        timeOfDay: zod_1.z.string().optional(),
        dayOfWeek: zod_1.z.number().min(0).max(6).optional(),
        dayOfMonth: zod_1.z.number().min(1).max(31).optional(),
        batchSize: zod_1.z.number().optional(),
        batchTimeout: zod_1.z.number().optional(),
        timezone: zod_1.z.string()
    }),
    filters: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        operator: zod_1.z.string(),
        value: zod_1.z.any(),
        caseSensitive: zod_1.z.boolean().optional()
    })),
    template: zod_1.z.object({
        format: zod_1.z.enum(['html', 'text', 'markdown']),
        subject: zod_1.z.string(),
        header: zod_1.z.string().optional(),
        footer: zod_1.z.string().optional(),
        itemTemplate: zod_1.z.string(),
        grouping: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            groupBy: zod_1.z.enum(['type', 'source', 'priority', 'date']),
            maxGroups: zod_1.z.number()
        }).optional(),
        styling: zod_1.z.object({
            theme: zod_1.z.enum(['light', 'dark']),
            accentColor: zod_1.z.string(),
            fontSize: zod_1.z.enum(['small', 'medium', 'large'])
        }).optional()
    }),
    channels: zod_1.z.array(zod_1.z.string()),
    stats: zod_1.z.object({
        totalSent: zod_1.z.number(),
        totalNotifications: zod_1.z.number(),
        avgNotificationsPerDigest: zod_1.z.number(),
        lastSent: zod_1.z.date().optional(),
        openRate: zod_1.z.number().optional(),
        clickRate: zod_1.z.number().optional()
    }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
//# sourceMappingURL=notifications.js.map