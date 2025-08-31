/**
 * API & Utility Types for Flow Desk
 *
 * Defines common patterns for API communication, pagination, sorting,
 * filtering, and other utility types used throughout the application.
 */
import { z } from 'zod';
/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
/**
 * API response wrapper for all endpoints
 */
export interface ApiResponse<T = any> {
    /** Whether the request was successful */
    success: boolean;
    /** Response data (present when success = true) */
    data?: T;
    /** Error information (present when success = false) */
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    /** Response metadata */
    meta?: ApiResponseMeta;
    /** Response timestamp */
    timestamp: Date;
    /** Request correlation ID */
    correlationId?: string;
}
/**
 * API response metadata
 */
export interface ApiResponseMeta {
    /** API version */
    version: string;
    /** Request ID */
    requestId: string;
    /** Processing time in milliseconds */
    processingTime: number;
    /** Rate limiting information */
    rateLimit?: {
        /** Rate limit per hour */
        limit: number;
        /** Remaining requests */
        remaining: number;
        /** Reset timestamp */
        resetTime: Date;
    };
    /** Pagination information (for paginated responses) */
    pagination?: PaginationMeta;
    /** Total count (for list responses) */
    totalCount?: number;
    /** Additional metadata */
    [key: string]: any;
}
/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
    /** Page number (1-based) */
    page?: number;
    /** Number of items per page */
    limit?: number;
    /** Cursor for cursor-based pagination */
    cursor?: string;
    /** Offset for offset-based pagination */
    offset?: number;
}
/**
 * Pagination metadata in responses
 */
export interface PaginationMeta {
    /** Current page number */
    currentPage: number;
    /** Number of items per page */
    pageSize: number;
    /** Total number of items */
    totalItems: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there is a next page */
    hasNext: boolean;
    /** Whether there is a previous page */
    hasPrevious: boolean;
    /** Next page cursor (for cursor-based pagination) */
    nextCursor?: string;
    /** Previous page cursor (for cursor-based pagination) */
    previousCursor?: string;
}
/**
 * Sorting parameters
 */
export interface SortParams {
    /** Field to sort by */
    sortBy?: string;
    /** Sort direction */
    sortOrder?: 'asc' | 'desc';
    /** Multiple sort criteria */
    sort?: Array<{
        field: string;
        order: 'asc' | 'desc';
    }>;
}
/**
 * Filter parameters
 */
export interface FilterParams {
    /** Simple filters (field: value) */
    filters?: Record<string, any>;
    /** Search query */
    search?: string;
    /** Date range filter */
    dateRange?: {
        field: string;
        start: Date;
        end: Date;
    };
    /** Complex filter expressions */
    where?: FilterExpression[];
}
/**
 * Filter expression for complex filtering
 */
export interface FilterExpression {
    /** Field to filter on */
    field: string;
    /** Filter operator */
    operator: FilterOperator;
    /** Filter value */
    value: any;
    /** Logical operator for combining with other expressions */
    logic?: 'AND' | 'OR';
}
/**
 * Filter operators
 */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'exists' | 'null' | 'empty';
/**
 * List request parameters combining pagination, sorting, and filtering
 */
export interface ListParams extends PaginationParams, SortParams, FilterParams {
    /** Fields to include in response */
    select?: string[];
    /** Relations to include */
    include?: string[];
    /** Whether to include soft-deleted records */
    includeSoftDeleted?: boolean;
}
/**
 * List response wrapper
 */
export interface ListResponse<T> extends ApiResponse<T[]> {
    /** Pagination metadata */
    meta: ApiResponseMeta & {
        pagination: PaginationMeta;
    };
}
/**
 * Generic create input type
 */
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
/**
 * Generic update input type
 */
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt'>>;
/**
 * Generic entity with timestamps
 */
export interface BaseEntity {
    /** Unique identifier */
    id: string;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Entity with soft delete support
 */
export interface SoftDeletableEntity extends BaseEntity {
    /** Deletion timestamp */
    deletedAt?: Date;
}
/**
 * Entity with user tracking
 */
export interface UserTrackedEntity extends BaseEntity {
    /** User who created the entity */
    createdBy: string;
    /** User who last updated the entity */
    updatedBy?: string;
}
/**
 * Bulk operation parameters
 */
export interface BulkOperationParams<T> {
    /** Operation type */
    operation: 'create' | 'update' | 'delete' | 'upsert';
    /** Items to operate on */
    items: T[];
    /** Options for the operation */
    options?: {
        /** Continue on error */
        continueOnError?: boolean;
        /** Return detailed results */
        returnResults?: boolean;
        /** Batch size */
        batchSize?: number;
    };
}
/**
 * Bulk operation response
 */
export interface BulkOperationResponse<T> {
    /** Total items processed */
    totalProcessed: number;
    /** Successfully processed items */
    successful: number;
    /** Failed items */
    failed: number;
    /** Detailed results (if requested) */
    results?: Array<{
        item: T;
        status: 'success' | 'error';
        error?: string;
    }>;
    /** Summary of errors */
    errors?: Array<{
        index: number;
        error: string;
    }>;
}
/**
 * WebSocket message types
 */
export interface WebSocketMessage<T = any> {
    /** Message type */
    type: string;
    /** Message payload */
    payload: T;
    /** Message ID */
    id?: string;
    /** Timestamp */
    timestamp: Date;
    /** Target user/room */
    target?: string;
    /** Message metadata */
    meta?: Record<string, any>;
}
/**
 * Real-time subscription parameters
 */
export interface SubscriptionParams {
    /** Resource type to subscribe to */
    resource: string;
    /** Resource ID (optional, for specific resource) */
    resourceId?: string;
    /** Event types to subscribe to */
    events?: string[];
    /** Subscription filters */
    filters?: FilterExpression[];
    /** Subscription metadata */
    meta?: Record<string, any>;
}
/**
 * File upload parameters
 */
export interface FileUploadParams {
    /** File data */
    file: File | Buffer;
    /** Original filename */
    filename: string;
    /** MIME type */
    mimeType: string;
    /** File size in bytes */
    size: number;
    /** Upload destination */
    destination?: string;
    /** Upload metadata */
    metadata?: Record<string, any>;
    /** Upload options */
    options?: {
        /** Whether to create thumbnail */
        createThumbnail?: boolean;
        /** Maximum file size */
        maxSize?: number;
        /** Allowed MIME types */
        allowedTypes?: string[];
        /** Whether to scan for viruses */
        virusScan?: boolean;
    };
}
/**
 * File upload response
 */
export interface FileUploadResponse {
    /** File ID */
    id: string;
    /** Original filename */
    filename: string;
    /** File URL */
    url: string;
    /** File size */
    size: number;
    /** MIME type */
    mimeType: string;
    /** Upload timestamp */
    uploadedAt: Date;
    /** File metadata */
    metadata?: Record<string, any>;
    /** Thumbnail URL (if created) */
    thumbnailUrl?: string;
    /** CDN URLs for different sizes */
    variants?: Record<string, string>;
}
/**
 * Search parameters
 */
export interface SearchParams {
    /** Search query */
    query: string;
    /** Content types to search */
    types?: string[];
    /** Search providers to use */
    providers?: string[];
    /** Search filters */
    filters?: FilterExpression[];
    /** Search sorting */
    sort?: SortParams;
    /** Pagination */
    pagination?: PaginationParams;
    /** Search options */
    options?: {
        /** Enable fuzzy search */
        fuzzy?: boolean;
        /** Fuzzy threshold */
        fuzzyThreshold?: number;
        /** Enable highlighting */
        highlighting?: boolean;
        /** Enable facets */
        facets?: boolean;
        /** Search timeout */
        timeout?: number;
    };
}
/**
 * Export parameters
 */
export interface ExportParams {
    /** Export format */
    format: 'json' | 'csv' | 'xlsx' | 'pdf' | 'xml';
    /** Data to export */
    data?: {
        /** Resource type */
        resource: string;
        /** Query filters */
        filters?: FilterExpression[];
        /** Fields to include */
        fields?: string[];
        /** Date range */
        dateRange?: {
            start: Date;
            end: Date;
        };
    };
    /** Export options */
    options?: {
        /** Include headers (for CSV/XLSX) */
        includeHeaders?: boolean;
        /** Compression */
        compress?: boolean;
        /** Email when complete */
        emailWhenComplete?: boolean;
        /** Custom filename */
        filename?: string;
    };
}
/**
 * Export response
 */
export interface ExportResponse {
    /** Export job ID */
    jobId: string;
    /** Export status */
    status: 'pending' | 'processing' | 'completed' | 'failed';
    /** Download URL (when completed) */
    downloadUrl?: string;
    /** Export metadata */
    metadata: {
        /** Record count */
        recordCount?: number;
        /** File size */
        fileSize?: number;
        /** Export format */
        format: string;
        /** Created timestamp */
        createdAt: Date;
        /** Expires at */
        expiresAt?: Date;
    };
    /** Progress information */
    progress?: {
        /** Percentage complete */
        percentage: number;
        /** Current step */
        currentStep: string;
        /** Estimated completion time */
        estimatedCompletion?: Date;
    };
    /** Error information */
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
/**
 * Health check response
 */
export interface HealthCheckResponse {
    /** Service status */
    status: 'healthy' | 'degraded' | 'unhealthy';
    /** Service version */
    version: string;
    /** Uptime in seconds */
    uptime: number;
    /** Timestamp */
    timestamp: Date;
    /** Detailed checks */
    checks: Record<string, {
        status: 'healthy' | 'degraded' | 'unhealthy';
        responseTime?: number;
        error?: string;
    }>;
    /** System information */
    system?: {
        /** Memory usage */
        memory: {
            used: number;
            free: number;
            total: number;
        };
        /** CPU usage */
        cpu: {
            usage: number;
            cores: number;
        };
        /** Disk usage */
        disk: {
            used: number;
            free: number;
            total: number;
        };
    };
}
/**
 * Event log entry
 */
export interface EventLogEntry {
    /** Event ID */
    id: string;
    /** Event type */
    type: string;
    /** Event category */
    category: string;
    /** Event description */
    description: string;
    /** Event data */
    data: Record<string, any>;
    /** User ID (if applicable) */
    userId?: string;
    /** Organization ID */
    organizationId?: string;
    /** Event timestamp */
    timestamp: Date;
    /** Event metadata */
    metadata?: Record<string, any>;
}
/**
 * Webhook payload
 */
export interface WebhookPayload<T = any> {
    /** Webhook event type */
    event: string;
    /** Event data */
    data: T;
    /** Event timestamp */
    timestamp: Date;
    /** Webhook version */
    version: string;
    /** Event ID */
    eventId: string;
    /** Organization ID */
    organizationId?: string;
    /** Additional metadata */
    metadata?: Record<string, any>;
}
/**
 * API key information
 */
export interface ApiKey {
    /** API key ID */
    id: string;
    /** API key name */
    name: string;
    /** Masked key value */
    keyMasked: string;
    /** Key permissions */
    permissions: string[];
    /** Key status */
    status: 'active' | 'inactive' | 'revoked';
    /** Usage statistics */
    usage: {
        /** Total requests */
        totalRequests: number;
        /** Last used timestamp */
        lastUsed?: Date;
        /** Current month usage */
        monthlyUsage: number;
        /** Rate limit */
        rateLimit: number;
    };
    /** Key expiry */
    expiresAt?: Date;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Cache configuration
 */
export interface CacheConfig {
    /** Cache key */
    key: string;
    /** TTL in seconds */
    ttl: number;
    /** Cache tags for invalidation */
    tags?: string[];
    /** Whether to compress cached data */
    compress?: boolean;
    /** Cache options */
    options?: {
        /** Stale while revalidate */
        staleWhileRevalidate?: boolean;
        /** Background refresh */
        backgroundRefresh?: boolean;
    };
}
/**
 * Retry configuration
 */
export interface RetryConfig {
    /** Maximum retry attempts */
    maxRetries: number;
    /** Initial delay in milliseconds */
    initialDelay: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
    /** Maximum delay in milliseconds */
    maxDelay: number;
    /** Jitter to add randomness */
    jitter: boolean;
    /** Retry conditions */
    retryIf?: (error: Error) => boolean;
}
export declare const ApiResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
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
    meta: z.ZodOptional<z.ZodObject<{
        version: z.ZodString;
        requestId: z.ZodString;
        processingTime: z.ZodNumber;
        rateLimit: z.ZodOptional<z.ZodObject<{
            limit: z.ZodNumber;
            remaining: z.ZodNumber;
            resetTime: z.ZodDate;
        }, "strip", z.ZodTypeAny, {
            limit: number;
            remaining: number;
            resetTime: Date;
        }, {
            limit: number;
            remaining: number;
            resetTime: Date;
        }>>;
        pagination: z.ZodOptional<z.ZodObject<{
            currentPage: z.ZodNumber;
            pageSize: z.ZodNumber;
            totalItems: z.ZodNumber;
            totalPages: z.ZodNumber;
            hasNext: z.ZodBoolean;
            hasPrevious: z.ZodBoolean;
            nextCursor: z.ZodOptional<z.ZodString>;
            previousCursor: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            currentPage: number;
            pageSize: number;
            totalItems: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
            nextCursor?: string | undefined;
            previousCursor?: string | undefined;
        }, {
            currentPage: number;
            pageSize: number;
            totalItems: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
            nextCursor?: string | undefined;
            previousCursor?: string | undefined;
        }>>;
        totalCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        version: string;
        requestId: string;
        processingTime: number;
        rateLimit?: {
            limit: number;
            remaining: number;
            resetTime: Date;
        } | undefined;
        pagination?: {
            currentPage: number;
            pageSize: number;
            totalItems: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
            nextCursor?: string | undefined;
            previousCursor?: string | undefined;
        } | undefined;
        totalCount?: number | undefined;
    }, {
        version: string;
        requestId: string;
        processingTime: number;
        rateLimit?: {
            limit: number;
            remaining: number;
            resetTime: Date;
        } | undefined;
        pagination?: {
            currentPage: number;
            pageSize: number;
            totalItems: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
            nextCursor?: string | undefined;
            previousCursor?: string | undefined;
        } | undefined;
        totalCount?: number | undefined;
    }>>;
    timestamp: z.ZodDate;
    correlationId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    timestamp: Date;
    error?: {
        code: string;
        message: string;
        details?: any;
    } | undefined;
    data?: any;
    correlationId?: string | undefined;
    meta?: {
        version: string;
        requestId: string;
        processingTime: number;
        rateLimit?: {
            limit: number;
            remaining: number;
            resetTime: Date;
        } | undefined;
        pagination?: {
            currentPage: number;
            pageSize: number;
            totalItems: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
            nextCursor?: string | undefined;
            previousCursor?: string | undefined;
        } | undefined;
        totalCount?: number | undefined;
    } | undefined;
}, {
    success: boolean;
    timestamp: Date;
    error?: {
        code: string;
        message: string;
        details?: any;
    } | undefined;
    data?: any;
    correlationId?: string | undefined;
    meta?: {
        version: string;
        requestId: string;
        processingTime: number;
        rateLimit?: {
            limit: number;
            remaining: number;
            resetTime: Date;
        } | undefined;
        pagination?: {
            currentPage: number;
            pageSize: number;
            totalItems: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
            nextCursor?: string | undefined;
            previousCursor?: string | undefined;
        } | undefined;
        totalCount?: number | undefined;
    } | undefined;
}>;
export declare const ListParamsSchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
    offset: z.ZodOptional<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
    sort: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        order: z.ZodEnum<["asc", "desc"]>;
    }, "strip", z.ZodTypeAny, {
        order: "asc" | "desc";
        field: string;
    }, {
        order: "asc" | "desc";
        field: string;
    }>, "many">>;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    search: z.ZodOptional<z.ZodString>;
    dateRange: z.ZodOptional<z.ZodObject<{
        field: z.ZodString;
        start: z.ZodDate;
        end: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        end: Date;
        start: Date;
        field: string;
    }, {
        end: Date;
        start: Date;
        field: string;
    }>>;
    where: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["eq", "neq", "gt", "gte", "lt", "lte", "in", "nin", "contains", "startsWith", "endsWith", "regex", "exists", "null", "empty"]>;
        value: z.ZodAny;
        logic: z.ZodOptional<z.ZodEnum<["AND", "OR"]>>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "endsWith" | "startsWith" | "null" | "contains" | "regex" | "in" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "nin" | "exists" | "empty";
        value?: any;
        logic?: "OR" | "AND" | undefined;
    }, {
        field: string;
        operator: "endsWith" | "startsWith" | "null" | "contains" | "regex" | "in" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "nin" | "exists" | "empty";
        value?: any;
        logic?: "OR" | "AND" | undefined;
    }>, "many">>;
    select: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    includeSoftDeleted: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    sort?: {
        order: "asc" | "desc";
        field: string;
    }[] | undefined;
    search?: string | undefined;
    filters?: Record<string, any> | undefined;
    page?: number | undefined;
    cursor?: string | undefined;
    offset?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    dateRange?: {
        end: Date;
        start: Date;
        field: string;
    } | undefined;
    where?: {
        field: string;
        operator: "endsWith" | "startsWith" | "null" | "contains" | "regex" | "in" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "nin" | "exists" | "empty";
        value?: any;
        logic?: "OR" | "AND" | undefined;
    }[] | undefined;
    select?: string[] | undefined;
    include?: string[] | undefined;
    includeSoftDeleted?: boolean | undefined;
}, {
    limit?: number | undefined;
    sort?: {
        order: "asc" | "desc";
        field: string;
    }[] | undefined;
    search?: string | undefined;
    filters?: Record<string, any> | undefined;
    page?: number | undefined;
    cursor?: string | undefined;
    offset?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    dateRange?: {
        end: Date;
        start: Date;
        field: string;
    } | undefined;
    where?: {
        field: string;
        operator: "endsWith" | "startsWith" | "null" | "contains" | "regex" | "in" | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "nin" | "exists" | "empty";
        value?: any;
        logic?: "OR" | "AND" | undefined;
    }[] | undefined;
    select?: string[] | undefined;
    include?: string[] | undefined;
    includeSoftDeleted?: boolean | undefined;
}>;
export declare const BulkOperationParamsSchema: z.ZodObject<{
    operation: z.ZodEnum<["create", "update", "delete", "upsert"]>;
    items: z.ZodArray<z.ZodAny, "many">;
    options: z.ZodOptional<z.ZodObject<{
        continueOnError: z.ZodOptional<z.ZodBoolean>;
        returnResults: z.ZodOptional<z.ZodBoolean>;
        batchSize: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        batchSize?: number | undefined;
        continueOnError?: boolean | undefined;
        returnResults?: boolean | undefined;
    }, {
        batchSize?: number | undefined;
        continueOnError?: boolean | undefined;
        returnResults?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    operation: "delete" | "create" | "update" | "upsert";
    items: any[];
    options?: {
        batchSize?: number | undefined;
        continueOnError?: boolean | undefined;
        returnResults?: boolean | undefined;
    } | undefined;
}, {
    operation: "delete" | "create" | "update" | "upsert";
    items: any[];
    options?: {
        batchSize?: number | undefined;
        continueOnError?: boolean | undefined;
        returnResults?: boolean | undefined;
    } | undefined;
}>;
/**
 * Utility functions for API responses
 */
export declare class ApiResponseBuilder {
    /**
     * Create successful response
     */
    static success<T>(data: T, meta?: Partial<ApiResponseMeta>): ApiResponse<T>;
    /**
     * Create error response
     */
    static error(code: string, message: string, details?: any, meta?: Partial<ApiResponseMeta>): ApiResponse;
    /**
     * Create paginated response
     */
    static paginated<T>(data: T[], pagination: PaginationMeta, meta?: Partial<ApiResponseMeta>): ListResponse<T>;
}
/**
 * Pagination utility functions
 */
export declare class PaginationHelper {
    /**
     * Calculate pagination metadata
     */
    static calculateMeta(totalItems: number, page?: number, pageSize?: number): PaginationMeta;
    /**
     * Calculate offset from page
     */
    static calculateOffset(page?: number, pageSize?: number): number;
    /**
     * Generate cursor from entity
     */
    static generateCursor(entity: BaseEntity): string;
    /**
     * Parse cursor
     */
    static parseCursor(cursor: string): {
        id: string;
        createdAt: Date;
    } | null;
}
/**
 * Query builder utility
 */
export declare class QueryBuilder {
    private filters;
    private sortCriteria;
    private selectFields;
    private includeRelations;
    /**
     * Add filter
     */
    where(field: string, operator: FilterOperator, value: any): this;
    /**
     * Add AND filter
     */
    and(field: string, operator: FilterOperator, value: any): this;
    /**
     * Add OR filter
     */
    or(field: string, operator: FilterOperator, value: any): this;
    /**
     * Add sort criteria
     */
    orderBy(field: string, order?: 'asc' | 'desc'): this;
    /**
     * Select specific fields
     */
    select(...fields: string[]): this;
    /**
     * Include relations
     */
    include(...relations: string[]): this;
    /**
     * Build query parameters
     */
    build(): Partial<ListParams>;
}
/**
 * Rate limiter utility
 */
export interface RateLimiterConfig {
    /** Window size in milliseconds */
    windowMs: number;
    /** Maximum requests per window */
    maxRequests: number;
    /** Key generator function */
    keyGenerator?: (request: any) => string;
    /** Skip function */
    skip?: (request: any) => boolean;
}
/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    /** Failure threshold */
    failureThreshold: number;
    /** Recovery timeout in milliseconds */
    recoveryTimeout: number;
    /** Monitor interval in milliseconds */
    monitoringPeriod: number;
    /** Expected error types */
    expectedErrors?: string[];
}
/**
 * Event types for type-safe event handling
 */
export interface EventMap {
    'user.created': {
        userId: string;
        user: any;
    };
    'user.updated': {
        userId: string;
        changes: any;
    };
    'user.deleted': {
        userId: string;
    };
    'organization.created': {
        organizationId: string;
        organization: any;
    };
    'organization.updated': {
        organizationId: string;
        changes: any;
    };
    'organization.member.added': {
        organizationId: string;
        userId: string;
    };
    'organization.member.removed': {
        organizationId: string;
        userId: string;
    };
    'mail.received': {
        accountId: string;
        messageId: string;
    };
    'mail.sent': {
        accountId: string;
        messageId: string;
    };
    'mail.sync.completed': {
        accountId: string;
        stats: any;
    };
    'calendar.event.created': {
        calendarId: string;
        eventId: string;
    };
    'calendar.event.updated': {
        calendarId: string;
        eventId: string;
        changes: any;
    };
    'calendar.event.deleted': {
        calendarId: string;
        eventId: string;
    };
    'plugin.installed': {
        pluginId: string;
        userId: string;
    };
    'plugin.uninstalled': {
        pluginId: string;
        userId: string;
    };
    'plugin.error': {
        pluginId: string;
        error: string;
    };
    'system.maintenance.start': {
        scheduledDuration: number;
    };
    'system.maintenance.end': {
        actualDuration: number;
    };
    'system.backup.completed': {
        backupId: string;
        size: number;
    };
    'security.login': {
        userId: string;
        ip: string;
        userAgent: string;
    };
    'security.logout': {
        userId: string;
        sessionId: string;
    };
    'security.breach.detected': {
        type: string;
        severity: string;
        details: any;
    };
}
/**
 * Type-safe event emitter
 */
export type EventHandler<T extends keyof EventMap> = (data: EventMap[T]) => void | Promise<void>;
/**
 * Strongly typed event emitter interface
 */
export interface TypedEventEmitter {
    emit<T extends keyof EventMap>(event: T, data: EventMap[T]): void;
    on<T extends keyof EventMap>(event: T, handler: EventHandler<T>): void;
    off<T extends keyof EventMap>(event: T, handler: EventHandler<T>): void;
    once<T extends keyof EventMap>(event: T, handler: EventHandler<T>): void;
}
/**
 * Environment configuration
 */
export interface EnvironmentConfig {
    /** Environment name */
    NODE_ENV: 'development' | 'staging' | 'production';
    /** API base URL */
    API_BASE_URL: string;
    /** Database connection string */
    DATABASE_URL: string;
    /** Redis connection string */
    REDIS_URL?: string;
    /** JWT secret */
    JWT_SECRET: string;
    /** Encryption key */
    ENCRYPTION_KEY: string;
    /** External service URLs */
    services: {
        auth: string;
        billing: string;
        search: string;
        notifications: string;
    };
    /** Feature flags */
    features: Record<string, boolean>;
}
/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    /** Response time in milliseconds */
    responseTime: number;
    /** Memory usage */
    memory: {
        used: number;
        free: number;
        total: number;
    };
    /** CPU usage percentage */
    cpu: number;
    /** Active connections */
    connections: number;
    /** Requests per second */
    rps: number;
    /** Error rate */
    errorRate: number;
    /** Cache hit rate */
    cacheHitRate: number;
}
//# sourceMappingURL=api.d.ts.map