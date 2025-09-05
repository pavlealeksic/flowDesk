"use strict";
/**
 * API & Utility Types for Flow Desk
 *
 * Defines common patterns for API communication, pagination, sorting,
 * filtering, and other utility types used throughout the application.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = exports.PaginationHelper = exports.ApiResponseBuilder = exports.BulkOperationParamsSchema = exports.ListParamsSchema = exports.ApiResponseSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for API types
exports.ApiResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.any().optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.any().optional()
    }).optional(),
    meta: zod_1.z.object({
        version: zod_1.z.string(),
        requestId: zod_1.z.string(),
        processingTime: zod_1.z.number(),
        rateLimit: zod_1.z.object({
            limit: zod_1.z.number(),
            remaining: zod_1.z.number(),
            resetTime: zod_1.z.date()
        }).optional(),
        pagination: zod_1.z.object({
            currentPage: zod_1.z.number(),
            pageSize: zod_1.z.number(),
            totalItems: zod_1.z.number(),
            totalPages: zod_1.z.number(),
            hasNext: zod_1.z.boolean(),
            hasPrevious: zod_1.z.boolean(),
            nextCursor: zod_1.z.string().optional(),
            previousCursor: zod_1.z.string().optional()
        }).optional(),
        totalCount: zod_1.z.number().optional()
    }).optional(),
    timestamp: zod_1.z.date(),
    correlationId: zod_1.z.string().optional()
});
exports.ListParamsSchema = zod_1.z.object({
    page: zod_1.z.number().min(1).optional(),
    limit: zod_1.z.number().min(1).max(1000).optional(),
    cursor: zod_1.z.string().optional(),
    offset: zod_1.z.number().min(0).optional(),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional(),
    sort: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        order: zod_1.z.enum(['asc', 'desc'])
    })).optional(),
    filters: zod_1.z.record(zod_1.z.any()).optional(),
    search: zod_1.z.string().optional(),
    dateRange: zod_1.z.object({
        field: zod_1.z.string(),
        start: zod_1.z.date(),
        end: zod_1.z.date()
    }).optional(),
    where: zod_1.z.array(zod_1.z.object({
        field: zod_1.z.string(),
        operator: zod_1.z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'startsWith', 'endsWith', 'regex', 'exists', 'null', 'empty']),
        value: zod_1.z.any(),
        logic: zod_1.z.enum(['AND', 'OR']).optional()
    })).optional(),
    select: zod_1.z.array(zod_1.z.string()).optional(),
    include: zod_1.z.array(zod_1.z.string()).optional(),
    includeSoftDeleted: zod_1.z.boolean().optional()
});
exports.BulkOperationParamsSchema = zod_1.z.object({
    operation: zod_1.z.enum(['create', 'update', 'delete', 'upsert']),
    items: zod_1.z.array(zod_1.z.any()),
    options: zod_1.z.object({
        continueOnError: zod_1.z.boolean().optional(),
        returnResults: zod_1.z.boolean().optional(),
        batchSize: zod_1.z.number().positive().optional()
    }).optional()
});
/**
 * Utility functions for API responses
 */
class ApiResponseBuilder {
    /**
     * Create successful response
     */
    static success(data, meta) {
        return {
            success: true,
            data,
            meta: meta,
            timestamp: new Date()
        };
    }
    /**
     * Create error response
     */
    static error(code, message, details, meta) {
        return {
            success: false,
            error: { code, message, details },
            meta: meta,
            timestamp: new Date()
        };
    }
    /**
     * Create paginated response
     */
    static paginated(data, pagination, meta) {
        return {
            success: true,
            data,
            meta: {
                ...meta,
                pagination,
                totalCount: pagination.totalItems,
                version: meta?.version || '1.0',
                requestId: meta?.requestId || '',
                processingTime: meta?.processingTime || 0
            },
            timestamp: new Date()
        };
    }
}
exports.ApiResponseBuilder = ApiResponseBuilder;
/**
 * Pagination utility functions
 */
class PaginationHelper {
    /**
     * Calculate pagination metadata
     */
    static calculateMeta(totalItems, page = 1, pageSize = 20) {
        const totalPages = Math.ceil(totalItems / pageSize);
        return {
            currentPage: page,
            pageSize,
            totalItems,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
        };
    }
    /**
     * Calculate offset from page
     */
    static calculateOffset(page = 1, pageSize = 20) {
        return (page - 1) * pageSize;
    }
    /**
     * Generate cursor from entity
     */
    static generateCursor(entity) {
        return Buffer.from(JSON.stringify({
            id: entity.id,
            createdAt: entity.createdAt.toISOString()
        })).toString('base64');
    }
    /**
     * Parse cursor
     */
    static parseCursor(cursor) {
        try {
            const decoded = Buffer.from(cursor, 'base64').toString('utf8');
            const parsed = JSON.parse(decoded);
            return {
                id: parsed.id,
                createdAt: new Date(parsed.createdAt)
            };
        }
        catch {
            return null;
        }
    }
}
exports.PaginationHelper = PaginationHelper;
/**
 * Query builder utility
 */
class QueryBuilder {
    constructor() {
        this.filters = [];
        this.sortCriteria = [];
        this.selectFields = [];
        this.includeRelations = [];
    }
    /**
     * Add filter
     */
    where(field, operator, value) {
        this.filters.push({ field, operator, value });
        return this;
    }
    /**
     * Add AND filter
     */
    and(field, operator, value) {
        this.filters.push({ field, operator, value, logic: 'AND' });
        return this;
    }
    /**
     * Add OR filter
     */
    or(field, operator, value) {
        this.filters.push({ field, operator, value, logic: 'OR' });
        return this;
    }
    /**
     * Add sort criteria
     */
    orderBy(field, order = 'asc') {
        this.sortCriteria.push({ field, order });
        return this;
    }
    /**
     * Select specific fields
     */
    select(...fields) {
        this.selectFields.push(...fields);
        return this;
    }
    /**
     * Include relations
     */
    include(...relations) {
        this.includeRelations.push(...relations);
        return this;
    }
    /**
     * Build query parameters
     */
    build() {
        const params = {};
        if (this.filters.length > 0) {
            params.where = this.filters;
        }
        if (this.sortCriteria.length > 0) {
            params.sort = this.sortCriteria;
        }
        if (this.selectFields.length > 0) {
            params.select = this.selectFields;
        }
        if (this.includeRelations.length > 0) {
            params.include = this.includeRelations;
        }
        return params;
    }
}
exports.QueryBuilder = QueryBuilder;
//# sourceMappingURL=api.js.map