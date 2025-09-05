"use strict";
/**
 * Search System Types for Flow Desk
 *
 * Defines comprehensive types for unified search, providers, indexing,
 * and search result management following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchProviderSchema = exports.SearchResultSchema = exports.SearchQuerySchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.SearchQuerySchema = zod_1.z.object({
    query: zod_1.z.string(),
    contentTypes: zod_1.z.array(zod_1.z.string()).optional(),
    providers: zod_1.z.array(zod_1.z.string()).optional(),
    filters: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        operator: zod_1.z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'in', 'not_in', 'exists', 'not_exists', 'range', 'regex', 'fuzzy']),
        value: zod_1.z.any(),
        boost: zod_1.z.number().optional()
    })).optional(),
    sort: zod_1.z.object({
        field: zod_1.z.string(),
        direction: zod_1.z.enum(['asc', 'desc']),
        boost: zod_1.z.number().optional()
    }).optional(),
    limit: zod_1.z.number().optional(),
    offset: zod_1.z.number().optional(),
    options: zod_1.z.object({
        fuzzy: zod_1.z.boolean().optional(),
        fuzzyThreshold: zod_1.z.number().min(0).max(1).optional(),
        semantic: zod_1.z.boolean().optional(),
        facets: zod_1.z.boolean().optional(),
        highlighting: zod_1.z.boolean().optional(),
        suggestions: zod_1.z.boolean().optional(),
        timeout: zod_1.z.number().optional(),
        debug: zod_1.z.boolean().optional(),
        useCache: zod_1.z.boolean().optional(),
        cacheTtl: zod_1.z.number().optional()
    }).optional()
});
exports.SearchResultSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
    url: zod_1.z.string().url().optional(),
    icon: zod_1.z.string().optional(),
    thumbnail: zod_1.z.string().optional(),
    contentType: zod_1.z.string(),
    provider: zod_1.z.string(),
    providerType: zod_1.z.string(),
    score: zod_1.z.number().min(0).max(1),
    metadata: zod_1.z.object({
        size: zod_1.z.number().optional(),
        fileType: zod_1.z.string().optional(),
        mimeType: zod_1.z.string().optional(),
        author: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        categories: zod_1.z.array(zod_1.z.string()).optional(),
        location: zod_1.z.object({
            path: zod_1.z.string().optional(),
            folder: zod_1.z.string().optional(),
            workspace: zod_1.z.string().optional(),
            project: zod_1.z.string().optional()
        }).optional(),
        collaboration: zod_1.z.object({
            shared: zod_1.z.boolean(),
            collaborators: zod_1.z.array(zod_1.z.string()).optional(),
            permissions: zod_1.z.string().optional()
        }).optional(),
        activity: zod_1.z.object({
            views: zod_1.z.number().optional(),
            edits: zod_1.z.number().optional(),
            comments: zod_1.z.number().optional(),
            lastActivity: zod_1.z.date().optional()
        }).optional(),
        custom: zod_1.z.record(zod_1.z.any()).optional()
    }),
    highlights: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        fragments: zod_1.z.array(zod_1.z.string()),
        positions: zod_1.z.array(zod_1.z.object({
            start: zod_1.z.number(),
            end: zod_1.z.number()
        })).optional()
    })).optional(),
    actions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        label: zod_1.z.string(),
        icon: zod_1.z.string().optional(),
        type: zod_1.z.enum(['open', 'download', 'share', 'edit', 'delete', 'custom']),
        url: zod_1.z.string().optional(),
        handler: zod_1.z.string().optional(),
        params: zod_1.z.record(zod_1.z.any()).optional()
    })).optional(),
    createdAt: zod_1.z.date(),
    lastModified: zod_1.z.date()
});
exports.SearchProviderSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    icon: zod_1.z.string().optional(),
    enabled: zod_1.z.boolean(),
    config: zod_1.z.object({
        settings: zod_1.z.record(zod_1.z.any()),
        auth: zod_1.z.object({
            type: zod_1.z.enum(['oauth2', 'api_key', 'basic', 'custom']),
            oauth2: zod_1.z.object({
                clientId: zod_1.z.string(),
                clientSecret: zod_1.z.string(),
                scopes: zod_1.z.array(zod_1.z.string()),
                authUrl: zod_1.z.string().url(),
                tokenUrl: zod_1.z.string().url()
            }).optional(),
            apiKey: zod_1.z.object({
                key: zod_1.z.string(),
                header: zod_1.z.string()
            }).optional(),
            basic: zod_1.z.object({
                username: zod_1.z.string(),
                password: zod_1.z.string()
            }).optional(),
            custom: zod_1.z.record(zod_1.z.any()).optional()
        }).optional(),
        rateLimit: zod_1.z.object({
            requestsPerMinute: zod_1.z.number(),
            burstLimit: zod_1.z.number(),
            retryAfterMs: zod_1.z.number()
        }).optional(),
        indexing: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            batchSize: zod_1.z.number(),
            intervalMinutes: zod_1.z.number(),
            fullSyncIntervalHours: zod_1.z.number(),
            retentionDays: zod_1.z.number()
        }).optional(),
        search: zod_1.z.object({
            timeout: zod_1.z.number(),
            maxResults: zod_1.z.number(),
            enableFacets: zod_1.z.boolean(),
            enableHighlighting: zod_1.z.boolean()
        }).optional()
    }),
    capabilities: zod_1.z.object({
        textSearch: zod_1.z.boolean(),
        semanticSearch: zod_1.z.boolean(),
        realTime: zod_1.z.boolean(),
        facets: zod_1.z.boolean(),
        suggestions: zod_1.z.boolean(),
        autocomplete: zod_1.z.boolean(),
        highlighting: zod_1.z.boolean(),
        sorting: zod_1.z.boolean(),
        filtering: zod_1.z.boolean(),
        contentTypes: zod_1.z.array(zod_1.z.string()),
        maxResults: zod_1.z.number(),
        avgResponseTime: zod_1.z.number()
    }),
    stats: zod_1.z.object({
        totalQueries: zod_1.z.number(),
        successfulQueries: zod_1.z.number(),
        failedQueries: zod_1.z.number(),
        avgResponseTime: zod_1.z.number(),
        indexedItems: zod_1.z.number(),
        lastSuccessfulQuery: zod_1.z.date().optional(),
        lastIndexing: zod_1.z.date().optional(),
        errorRate: zod_1.z.number().min(0).max(1)
    }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
//# sourceMappingURL=search.js.map