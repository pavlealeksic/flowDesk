/**
 * API & Utility Types for Flow Desk
 * 
 * Defines common patterns for API communication, pagination, sorting,
 * filtering, and other utility types used throughout the application.
 */

import { z } from 'zod';
import { FlowDeskError } from './errors';

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
export type FilterOperator = 
  | 'eq'        // equals
  | 'neq'       // not equals
  | 'gt'        // greater than
  | 'gte'       // greater than or equal
  | 'lt'        // less than
  | 'lte'       // less than or equal
  | 'in'        // in array
  | 'nin'       // not in array
  | 'contains'  // contains substring
  | 'startsWith'// starts with
  | 'endsWith'  // ends with
  | 'regex'     // regex match
  | 'exists'    // field exists
  | 'null'      // field is null
  | 'empty';    // field is empty

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

// Zod schemas for API types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  meta: z.object({
    version: z.string(),
    requestId: z.string(),
    processingTime: z.number(),
    rateLimit: z.object({
      limit: z.number(),
      remaining: z.number(),
      resetTime: z.date()
    }).optional(),
    pagination: z.object({
      currentPage: z.number(),
      pageSize: z.number(),
      totalItems: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrevious: z.boolean(),
      nextCursor: z.string().optional(),
      previousCursor: z.string().optional()
    }).optional(),
    totalCount: z.number().optional()
  }).optional(),
  timestamp: z.date(),
  correlationId: z.string().optional()
});

export const ListParamsSchema = z.object({
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(1000).optional(),
  cursor: z.string().optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  sort: z.array(z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc'])
  })).optional(),
  filters: z.record(z.any()).optional(),
  search: z.string().optional(),
  dateRange: z.object({
    field: z.string(),
    start: z.date(),
    end: z.date()
  }).optional(),
  where: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'startsWith', 'endsWith', 'regex', 'exists', 'null', 'empty']),
    value: z.any(),
    logic: z.enum(['AND', 'OR']).optional()
  })).optional(),
  select: z.array(z.string()).optional(),
  include: z.array(z.string()).optional(),
  includeSoftDeleted: z.boolean().optional()
});

export const BulkOperationParamsSchema = z.object({
  operation: z.enum(['create', 'update', 'delete', 'upsert']),
  items: z.array(z.any()),
  options: z.object({
    continueOnError: z.boolean().optional(),
    returnResults: z.boolean().optional(),
    batchSize: z.number().positive().optional()
  }).optional()
});

/**
 * Utility functions for API responses
 */
export class ApiResponseBuilder {
  /**
   * Create successful response
   */
  static success<T>(data: T, meta?: Partial<ApiResponseMeta>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: meta as ApiResponseMeta,
      timestamp: new Date()
    };
  }

  /**
   * Create error response
   */
  static error(
    code: string,
    message: string,
    details?: any,
    meta?: Partial<ApiResponseMeta>
  ): ApiResponse {
    return {
      success: false,
      error: { code, message, details },
      meta: meta as ApiResponseMeta,
      timestamp: new Date()
    };
  }

  /**
   * Create paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    meta?: Partial<ApiResponseMeta>
  ): ListResponse<T> {
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
      } as ApiResponseMeta & { pagination: PaginationMeta },
      timestamp: new Date()
    };
  }
}

/**
 * Pagination utility functions
 */
export class PaginationHelper {
  /**
   * Calculate pagination metadata
   */
  static calculateMeta(
    totalItems: number,
    page: number = 1,
    pageSize: number = 20
  ): PaginationMeta {
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
  static calculateOffset(page: number = 1, pageSize: number = 20): number {
    return (page - 1) * pageSize;
  }

  /**
   * Generate cursor from entity
   */
  static generateCursor(entity: BaseEntity): string {
    return Buffer.from(JSON.stringify({
      id: entity.id,
      createdAt: entity.createdAt.toISOString()
    })).toString('base64');
  }

  /**
   * Parse cursor
   */
  static parseCursor(cursor: string): { id: string; createdAt: Date } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      return {
        id: parsed.id,
        createdAt: new Date(parsed.createdAt)
      };
    } catch {
      return null;
    }
  }
}

/**
 * Query builder utility
 */
export class QueryBuilder {
  private filters: FilterExpression[] = [];
  private sortCriteria: Array<{ field: string; order: 'asc' | 'desc' }> = [];
  private selectFields: string[] = [];
  private includeRelations: string[] = [];

  /**
   * Add filter
   */
  where(field: string, operator: FilterOperator, value: any): this {
    this.filters.push({ field, operator, value });
    return this;
  }

  /**
   * Add AND filter
   */
  and(field: string, operator: FilterOperator, value: any): this {
    this.filters.push({ field, operator, value, logic: 'AND' });
    return this;
  }

  /**
   * Add OR filter
   */
  or(field: string, operator: FilterOperator, value: any): this {
    this.filters.push({ field, operator, value, logic: 'OR' });
    return this;
  }

  /**
   * Add sort criteria
   */
  orderBy(field: string, order: 'asc' | 'desc' = 'asc'): this {
    this.sortCriteria.push({ field, order });
    return this;
  }

  /**
   * Select specific fields
   */
  select(...fields: string[]): this {
    this.selectFields.push(...fields);
    return this;
  }

  /**
   * Include relations
   */
  include(...relations: string[]): this {
    this.includeRelations.push(...relations);
    return this;
  }

  /**
   * Build query parameters
   */
  build(): Partial<ListParams> {
    const params: Partial<ListParams> = {};

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
  // User events
  'user.created': { userId: string; user: any };
  'user.updated': { userId: string; changes: any };
  'user.deleted': { userId: string };
  
  // Organization events
  'organization.created': { organizationId: string; organization: any };
  'organization.updated': { organizationId: string; changes: any };
  'organization.member.added': { organizationId: string; userId: string };
  'organization.member.removed': { organizationId: string; userId: string };
  
  // Mail events
  'mail.received': { accountId: string; messageId: string };
  'mail.sent': { accountId: string; messageId: string };
  'mail.sync.completed': { accountId: string; stats: any };
  
  // Calendar events
  'calendar.event.created': { calendarId: string; eventId: string };
  'calendar.event.updated': { calendarId: string; eventId: string; changes: any };
  'calendar.event.deleted': { calendarId: string; eventId: string };
  
  // Plugin events
  'plugin.installed': { pluginId: string; userId: string };
  'plugin.uninstalled': { pluginId: string; userId: string };
  'plugin.error': { pluginId: string; error: string };
  
  // System events
  'system.maintenance.start': { scheduledDuration: number };
  'system.maintenance.end': { actualDuration: number };
  'system.backup.completed': { backupId: string; size: number };
  
  // Security events
  'security.login': { userId: string; ip: string; userAgent: string };
  'security.logout': { userId: string; sessionId: string };
  'security.breach.detected': { type: string; severity: string; details: any };
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