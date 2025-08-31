"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationExecutionSchema = exports.AutomationRecipeSchema = exports.AutomationActionSchema = exports.AutomationTriggerSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.AutomationTriggerSchema = zod_1.z.object({
    type: zod_1.z.string(),
    config: zod_1.z.any(), // Union type too complex for Zod
    conditions: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        operator: zod_1.z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'in', 'not_in', 'exists', 'not_exists', 'regex', 'is_empty', 'is_not_empty']),
        value: zod_1.z.any(),
        logic: zod_1.z.enum(['AND', 'OR']).optional(),
        conditions: zod_1.z.array(zod_1.z.any()).optional() // Recursive reference
    })).optional(),
    throttling: zod_1.z.object({
        type: zod_1.z.enum(['none', 'rate_limit', 'debounce', 'once_per_period']),
        rateLimit: zod_1.z.object({
            count: zod_1.z.number(),
            periodSeconds: zod_1.z.number()
        }).optional(),
        debounceSeconds: zod_1.z.number().optional(),
        oncePerPeriod: zod_1.z.object({
            periodType: zod_1.z.enum(['hour', 'day', 'week', 'month']),
            resetTime: zod_1.z.string().optional()
        }).optional()
    }).optional()
});
exports.AutomationActionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    config: zod_1.z.any(), // Union type too complex for Zod
    conditions: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        operator: zod_1.z.string(),
        value: zod_1.z.any(),
        logic: zod_1.z.enum(['AND', 'OR']).optional(),
        conditions: zod_1.z.array(zod_1.z.any()).optional()
    })).optional(),
    errorHandling: zod_1.z.object({
        strategy: zod_1.z.enum(['ignore', 'stop', 'retry', 'fallback']),
        fallbackActions: zod_1.z.array(zod_1.z.any()).optional(), // Recursive reference
        logErrors: zod_1.z.boolean(),
        notifyOnError: zod_1.z.boolean()
    }),
    continueOnError: zod_1.z.boolean(),
    timeout: zod_1.z.number().optional(),
    retry: zod_1.z.object({
        maxAttempts: zod_1.z.number(),
        delaySeconds: zod_1.z.number(),
        backoffMultiplier: zod_1.z.number(),
        maxDelaySeconds: zod_1.z.number(),
        retryConditions: zod_1.z.array(zod_1.z.string()).optional()
    }).optional()
});
exports.AutomationRecipeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    ownerId: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum(['productivity', 'email', 'calendar', 'tasks', 'files', 'communication', 'integrations', 'notifications', 'workflows', 'utilities', 'custom']),
    tags: zod_1.z.array(zod_1.z.string()),
    icon: zod_1.z.string().optional(),
    enabled: zod_1.z.boolean(),
    isPublic: zod_1.z.boolean(),
    version: zod_1.z.string(),
    trigger: exports.AutomationTriggerSchema,
    actions: zod_1.z.array(exports.AutomationActionSchema),
    settings: zod_1.z.object({
        timeout: zod_1.z.number(),
        maxExecutionsPerHour: zod_1.z.number(),
        maxConcurrentExecutions: zod_1.z.number(),
        priority: zod_1.z.enum(['low', 'normal', 'high']),
        logLevel: zod_1.z.enum(['error', 'warn', 'info', 'debug']),
        variables: zod_1.z.record(zod_1.z.any()),
        environment: zod_1.z.enum(['development', 'staging', 'production'])
    }),
    stats: zod_1.z.object({
        totalExecutions: zod_1.z.number(),
        successfulExecutions: zod_1.z.number(),
        failedExecutions: zod_1.z.number(),
        avgExecutionTime: zod_1.z.number(),
        successRate: zod_1.z.number().min(0).max(1),
        lastExecutionStatus: zod_1.z.enum(['success', 'failed', 'timeout', 'cancelled']).optional(),
        recentExecutions: zod_1.z.array(zod_1.z.object({
            timestamp: zod_1.z.date(),
            status: zod_1.z.enum(['success', 'failed', 'timeout', 'cancelled']),
            duration: zod_1.z.number(),
            error: zod_1.z.string().optional()
        }))
    }),
    metadata: zod_1.z.object({
        author: zod_1.z.object({
            name: zod_1.z.string(),
            email: zod_1.z.string().email()
        }).optional(),
        documentation: zod_1.z.string().optional(),
        template: zod_1.z.object({
            isTemplate: zod_1.z.boolean(),
            templateId: zod_1.z.string().optional(),
            variables: zod_1.z.record(zod_1.z.any()).optional()
        }).optional(),
        sharing: zod_1.z.object({
            isShared: zod_1.z.boolean(),
            sharedWith: zod_1.z.array(zod_1.z.string()),
            permissions: zod_1.z.record(zod_1.z.array(zod_1.z.string()))
        }).optional()
    }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastExecutedAt: zod_1.z.date().optional()
});
exports.AutomationExecutionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    recipeId: zod_1.z.string(),
    userId: zod_1.z.string(),
    trigger: zod_1.z.object({
        type: zod_1.z.string(),
        data: zod_1.z.any(),
        timestamp: zod_1.z.date()
    }),
    status: zod_1.z.enum(['queued', 'running', 'completed', 'failed', 'timeout', 'cancelled', 'paused']),
    context: zod_1.z.object({
        trigger: zod_1.z.any(),
        user: zod_1.z.object({
            id: zod_1.z.string(),
            email: zod_1.z.string(),
            name: zod_1.z.string()
        }),
        workspace: zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string()
        }).optional(),
        variables: zod_1.z.record(zod_1.z.any()),
        environment: zod_1.z.enum(['development', 'staging', 'production'])
    }),
    actions: zod_1.z.array(zod_1.z.object({
        actionId: zod_1.z.string(),
        type: zod_1.z.string(),
        status: zod_1.z.enum(['queued', 'running', 'completed', 'failed', 'timeout', 'cancelled', 'paused']),
        input: zod_1.z.any(),
        output: zod_1.z.any().optional(),
        error: zod_1.z.object({
            message: zod_1.z.string(),
            code: zod_1.z.string(),
            details: zod_1.z.any().optional()
        }).optional(),
        retries: zod_1.z.array(zod_1.z.object({
            attempt: zod_1.z.number(),
            timestamp: zod_1.z.date(),
            error: zod_1.z.string().optional()
        })),
        startedAt: zod_1.z.date(),
        endedAt: zod_1.z.date().optional(),
        duration: zod_1.z.number().optional()
    })),
    error: zod_1.z.object({
        message: zod_1.z.string(),
        code: zod_1.z.string(),
        action: zod_1.z.string().optional(),
        timestamp: zod_1.z.date()
    }).optional(),
    startedAt: zod_1.z.date(),
    endedAt: zod_1.z.date().optional(),
    duration: zod_1.z.number().optional()
});
//# sourceMappingURL=automations.js.map