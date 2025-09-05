"use strict";
/**
 * Plugin System Types for Flow Desk
 *
 * Defines comprehensive types for plugin manifests, permissions, runtime environment,
 * marketplace, and plugin SDK following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginInstallationSchema = exports.PluginManifestSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.PluginManifestSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    version: zod_1.z.string(),
    description: zod_1.z.string(),
    author: zod_1.z.string(),
    authorEmail: zod_1.z.string().email().optional(),
    homepage: zod_1.z.string().url().optional(),
    repository: zod_1.z.string().url().optional(),
    documentation: zod_1.z.string().url().optional(),
    license: zod_1.z.string(),
    type: zod_1.z.enum(['connector', 'panel', 'view', 'automation', 'widget', 'theme', 'integration']),
    category: zod_1.z.enum(['communication', 'productivity', 'meetings', 'development', 'storage', 'crm', 'support', 'marketing', 'finance', 'ai', 'utilities', 'themes', 'other']),
    tags: zod_1.z.array(zod_1.z.string()),
    icon: zod_1.z.string().url().optional(),
    screenshots: zod_1.z.array(zod_1.z.string().url()).optional(),
    minFlowDeskVersion: zod_1.z.string(),
    maxFlowDeskVersion: zod_1.z.string().optional(),
    platforms: zod_1.z.array(zod_1.z.enum(['desktop', 'mobile', 'web'])),
    permissions: zod_1.z.array(zod_1.z.string()),
    scopes: zod_1.z.array(zod_1.z.string()),
    entrypoints: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['main', 'background', 'content', 'popup', 'panel', 'automation']),
        file: zod_1.z.string(),
        platforms: zod_1.z.record(zod_1.z.string()).optional()
    })),
    configSchema: zod_1.z.object({
        schema: zod_1.z.record(zod_1.z.any()),
        uiSchema: zod_1.z.record(zod_1.z.any()).optional(),
        defaults: zod_1.z.record(zod_1.z.any()).optional()
    }).optional(),
    dependencies: zod_1.z.array(zod_1.z.object({
        pluginId: zod_1.z.string(),
        version: zod_1.z.string(),
        optional: zod_1.z.boolean()
    })).optional(),
    capabilities: zod_1.z.object({
        search: zod_1.z.boolean().optional(),
        notifications: zod_1.z.boolean().optional(),
        automations: zod_1.z.boolean().optional(),
        oauth: zod_1.z.boolean().optional(),
        webhooks: zod_1.z.boolean().optional(),
        filePreviews: zod_1.z.boolean().optional(),
        quickActions: zod_1.z.boolean().optional(),
        contextualData: zod_1.z.boolean().optional(),
        realTime: zod_1.z.boolean().optional(),
        offline: zod_1.z.boolean().optional()
    }),
    marketplace: zod_1.z.object({
        published: zod_1.z.boolean(),
        pricing: zod_1.z.object({
            model: zod_1.z.enum(['free', 'paid', 'subscription', 'freemium']),
            price: zod_1.z.number().optional(),
            currency: zod_1.z.string().optional(),
            billingPeriod: zod_1.z.enum(['monthly', 'yearly']).optional(),
            trialDays: zod_1.z.number().optional(),
            freeTierLimits: zod_1.z.record(zod_1.z.any()).optional()
        }),
        regions: zod_1.z.array(zod_1.z.string()).optional(),
        ageRating: zod_1.z.enum(['everyone', 'teen', 'mature']).optional(),
        contentRating: zod_1.z.array(zod_1.z.string()).optional(),
        privacyPolicy: zod_1.z.string().url().optional(),
        termsOfService: zod_1.z.string().url().optional(),
        support: zod_1.z.object({
            email: zod_1.z.string().email().optional(),
            url: zod_1.z.string().url().optional(),
            phone: zod_1.z.string().optional()
        }).optional()
    }).optional(),
    build: zod_1.z.object({
        buildTime: zod_1.z.string(),
        environment: zod_1.z.enum(['development', 'staging', 'production']),
        commit: zod_1.z.string().optional(),
        bundleSize: zod_1.z.number().optional(),
        buildTools: zod_1.z.array(zod_1.z.string()).optional(),
        csp: zod_1.z.string().optional()
    })
});
exports.PluginInstallationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    workspaceId: zod_1.z.string().optional(),
    pluginId: zod_1.z.string(),
    version: zod_1.z.string(),
    status: zod_1.z.enum(['installing', 'active', 'disabled', 'updating', 'error', 'uninstalling']),
    config: zod_1.z.record(zod_1.z.any()),
    settings: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        autoUpdate: zod_1.z.boolean(),
        visible: zod_1.z.boolean(),
        order: zod_1.z.number(),
        notifications: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            types: zod_1.z.array(zod_1.z.string())
        })
    }),
    grantedPermissions: zod_1.z.array(zod_1.z.string()),
    grantedScopes: zod_1.z.array(zod_1.z.string()),
    installedAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastUsedAt: zod_1.z.date().optional(),
    usageStats: zod_1.z.object({
        totalInvocations: zod_1.z.number(),
        recentInvocations: zod_1.z.number(),
        avgResponseTime: zod_1.z.number(),
        errorRate: zod_1.z.number().min(0).max(1),
        topFeatures: zod_1.z.array(zod_1.z.object({
            feature: zod_1.z.string(),
            count: zod_1.z.number()
        }))
    }).optional()
});
//# sourceMappingURL=plugin.js.map