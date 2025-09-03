/**
 * Search System Types for Flow Desk
 * 
 * Defines comprehensive types for unified search, providers, indexing,
 * and search result management following Blueprint.md requirements.
 */

import { z } from 'zod';

/**
 * Search provider types
 */
export type SearchProviderType = 
  // Email providers
  | 'gmail'
  | 'outlook'
  | 'exchange'
  | 'imap'
  // Communication providers
  | 'slack'
  | 'teams'
  | 'discord'
  | 'telegram'
  | 'whatsapp'
  | 'signal'
  // Productivity providers
  | 'notion'
  | 'confluence'
  | 'asana'
  | 'trello'
  | 'jira'
  | 'linear'
  | 'monday'
  // File storage providers
  | 'googledrive'
  | 'onedrive'
  | 'dropbox'
  | 'box'
  // Development providers
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  // Meeting providers
  | 'zoom'
  | 'meet'
  | 'webex'
  // Local providers
  | 'local_files'
  | 'local_mail'
  | 'local_calendar'
  | 'local_contacts'
  // Plugin providers
  | 'plugin';

/**
 * Content types for search indexing
 */
export type SearchContentType = 
  | 'email'
  | 'calendar_event'
  | 'contact'
  | 'file'
  | 'document'
  | 'message' // Chat message
  | 'channel'
  | 'thread'
  | 'task'
  | 'project'
  | 'issue'
  | 'pull_request'
  | 'commit'
  | 'meeting'
  | 'note'
  | 'bookmark'
  | 'custom';

/**
 * Search provider configuration
 */
export interface SearchProvider {
  /** Provider ID */
  id: string;
  /** Provider type */
  type: SearchProviderType;
  /** Provider name */
  name: string;
  /** Provider description */
  description?: string;
  /** Provider icon */
  icon?: string;
  /** Whether provider is enabled */
  enabled: boolean;
  /** Provider configuration */
  config: SearchProviderConfig;
  /** Provider capabilities */
  capabilities: SearchProviderCapabilities;
  /** Provider statistics */
  stats: SearchProviderStats;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Search provider configuration
 */
export interface SearchProviderConfig {
  /** Provider-specific settings */
  settings: Record<string, any>;
  /** Authentication configuration */
  auth?: SearchProviderAuth;
  /** Rate limiting configuration */
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
    retryAfterMs: number;
  };
  /** Indexing configuration */
  indexing?: {
    enabled: boolean;
    batchSize: number;
    intervalMinutes: number;
    fullSyncIntervalHours: number;
    retentionDays: number;
  };
  /** Search configuration */
  search?: {
    timeout: number;
    maxResults: number;
    enableFacets: boolean;
    enableHighlighting: boolean;
  };
}

/**
 * Search provider authentication
 */
export interface SearchProviderAuth {
  /** Authentication type */
  type: 'oauth2' | 'api_key' | 'basic' | 'custom';
  /** OAuth2 configuration */
  oauth2?: {
    clientId: string;
    clientSecret: string;
    scopes: string[];
    authUrl: string;
    tokenUrl: string;
  };
  /** API key configuration */
  apiKey?: {
    key: string;
    header: string;
  };
  /** Basic auth configuration */
  basic?: {
    username: string;
    password: string;
  };
  /** Custom auth configuration */
  custom?: Record<string, any>;
}

/**
 * Search provider capabilities
 */
export interface SearchProviderCapabilities {
  /** Can perform text search */
  textSearch: boolean;
  /** Can perform semantic search */
  semanticSearch: boolean;
  /** Can provide real-time results */
  realTime: boolean;
  /** Can provide faceted search */
  facets: boolean;
  /** Can provide search suggestions */
  suggestions: boolean;
  /** Can provide autocomplete */
  autocomplete: boolean;
  /** Can highlight search terms */
  highlighting: boolean;
  /** Can sort results */
  sorting: boolean;
  /** Can filter results */
  filtering: boolean;
  /** Supported content types */
  contentTypes: SearchContentType[];
  /** Maximum results per query */
  maxResults: number;
  /** Search response time (ms) */
  avgResponseTime: number;
}

/**
 * Search provider statistics
 */
export interface SearchProviderStats {
  /** Total number of queries */
  totalQueries: number;
  /** Successful queries */
  successfulQueries: number;
  /** Failed queries */
  failedQueries: number;
  /** Average response time (ms) */
  avgResponseTime: number;
  /** Total indexed items */
  indexedItems: number;
  /** Last successful query */
  lastSuccessfulQuery?: Date;
  /** Last indexing run */
  lastIndexing?: Date;
  /** Error rate (0-1) */
  errorRate: number;
}

/**
 * Search query interface
 */
export interface SearchQuery {
  /** Search query string */
  query: string;
  /** Content types to search */
  contentTypes?: SearchContentType[];
  /** Search providers to use */
  providers?: string[];
  /** Search filters */
  filters?: SearchFilter[];
  /** Search sorting */
  sort?: SearchSort;
  /** Maximum results */
  limit?: number;
  /** Result offset */
  offset?: number;
  /** Search options */
  options?: SearchOptions;
}

/**
 * Search filter
 */
export interface SearchFilter {
  /** Filter field */
  field: string;
  /** Filter operator */
  operator: SearchFilterOperator;
  /** Filter value */
  value: any;
  /** Filter boost (for relevance) */
  boost?: number;
}

/**
 * Search filter operators
 */
export type SearchFilterOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists'
  | 'range'
  | 'regex'
  | 'fuzzy';

/**
 * Search sorting
 */
export interface SearchSort {
  /** Sort field */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Sort boost */
  boost?: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Enable fuzzy matching */
  fuzzy?: boolean;
  /** Fuzzy threshold (0-1) */
  fuzzyThreshold?: number;
  /** Enable semantic search */
  semantic?: boolean;
  /** Enable faceted search */
  facets?: boolean;
  /** Enable highlighting */
  highlighting?: boolean;
  /** Enable suggestions */
  suggestions?: boolean;
  /** Search timeout (ms) */
  timeout?: number;
  /** Include debug information */
  debug?: boolean;
  /** Use cached results */
  useCache?: boolean;
  /** Cache TTL (seconds) */
  cacheTtl?: number;
}

/**
 * Search result interface
 */
export interface SearchResult {
  /** Result ID */
  id: string;
  /** Result title */
  title: string;
  /** Result description/snippet */
  description?: string;
  /** Result content */
  content?: string;
  /** Result URL */
  url?: string;
  /** Result icon */
  icon?: string;
  /** Result thumbnail */
  thumbnail?: string;
  /** Content type */
  contentType: SearchContentType;
  /** Source provider */
  provider: string;
  /** Provider type */
  providerType: SearchProviderType;
  /** Search relevance score (0-1) */
  score: number;
  /** Result metadata */
  metadata: SearchResultMetadata;
  /** Highlighted snippets */
  highlights?: SearchHighlight[];
  /** Result actions */
  actions?: SearchResultAction[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  lastModified: Date;
}

/**
 * Search result metadata
 */
export interface SearchResultMetadata {
  /** File size (for files) */
  size?: number;
  /** File type (for files) */
  fileType?: string;
  /** MIME type (for files) */
  mimeType?: string;
  /** Author/creator */
  author?: string;
  /** Tags */
  tags?: string[];
  /** Categories */
  categories?: string[];
  /** Location information */
  location?: {
    path?: string;
    folder?: string;
    workspace?: string;
    project?: string;
  };
  /** Collaboration information */
  collaboration?: {
    shared: boolean;
    collaborators?: string[];
    permissions?: string;
  };
  /** Activity information */
  activity?: {
    views?: number;
    edits?: number;
    comments?: number;
    lastActivity?: Date;
  };
  /** Custom metadata */
  custom?: Record<string, any>;
}

/**
 * Search highlight
 */
export interface SearchHighlight {
  /** Field that was highlighted */
  field: string;
  /** Highlighted text segments */
  fragments: string[];
  /** Start/end positions in original text */
  positions?: Array<{
    start: number;
    end: number;
  }>;
}

/**
 * Search result action
 */
export interface SearchResultAction {
  /** Action ID */
  id: string;
  /** Action label */
  label: string;
  /** Action icon */
  icon?: string;
  /** Action type */
  type: 'open' | 'download' | 'share' | 'edit' | 'delete' | 'custom';
  /** Action URL */
  url?: string;
  /** Custom action handler */
  handler?: string;
  /** Action parameters */
  params?: Record<string, any>;
}

/**
 * Search response
 */
export interface SearchResponse {
  /** Search query */
  query: SearchQuery;
  /** Search results */
  results: SearchResult[];
  /** Total number of results */
  total: number;
  /** Search execution time (ms) */
  took: number;
  /** Search facets */
  facets?: SearchFacet[];
  /** Search suggestions */
  suggestions?: string[];
  /** Search debug information */
  debug?: SearchDebugInfo;
  /** Next page token */
  nextPageToken?: string;
  /** Provider responses */
  providerResponses?: SearchProviderResponse[];
}

/**
 * Search facet
 */
export interface SearchFacet {
  /** Facet name */
  name: string;
  /** Facet field */
  field: string;
  /** Facet values */
  values: SearchFacetValue[];
  /** Facet type */
  type: 'terms' | 'range' | 'date' | 'numeric';
}

/**
 * Search facet value
 */
export interface SearchFacetValue {
  /** Facet value */
  value: any;
  /** Number of results with this value */
  count: number;
  /** Whether this value is selected */
  selected: boolean;
}

/**
 * Search debug information
 */
export interface SearchDebugInfo {
  /** Query parsing information */
  parsing?: {
    originalQuery: string;
    parsedQuery: any;
    warnings?: string[];
  };
  /** Execution information */
  execution?: {
    totalTime: number;
    indexTime: number;
    searchTime: number;
    mergeTime: number;
  };
  /** Provider performance */
  providers?: Array<{
    id: string;
    took: number;
    resultCount: number;
    errors?: string[];
  }>;
}

/**
 * Search provider response
 */
export interface SearchProviderResponse {
  /** Provider ID */
  providerId: string;
  /** Provider type */
  providerType: SearchProviderType;
  /** Provider results */
  results: SearchResult[];
  /** Execution time (ms) */
  took: number;
  /** Provider errors */
  errors?: string[];
  /** Provider warnings */
  warnings?: string[];
}

/**
 * Search index document
 */
export interface SearchIndexDocument {
  /** Document ID */
  id: string;
  /** Document title */
  title: string;
  /** Document content */
  content: string;
  /** Document summary */
  summary?: string;
  /** Content type */
  contentType: SearchContentType;
  /** Source provider */
  provider: string;
  /** Provider type */
  providerType: SearchProviderType;
  /** Document URL */
  url?: string;
  /** Document metadata */
  metadata: Record<string, any>;
  /** Document tags */
  tags: string[];
  /** Document categories */
  categories: string[];
  /** Document author */
  author?: string;
  /** Access permissions */
  permissions: {
    read: string[];
    write: string[];
    admin: string[];
    public: boolean;
  };
  /** Indexing information */
  indexing: {
    indexed_at: Date;
    version: number;
    checksum: string;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  lastModified: Date;
}

/**
 * Search indexing job
 */
export interface SearchIndexingJob {
  /** Job ID */
  id: string;
  /** Job type */
  type: 'full' | 'incremental' | 'delete' | 'optimize';
  /** Provider ID */
  providerId: string;
  /** Job status */
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Job progress (0-1) */
  progress: number;
  /** Job configuration */
  config: {
    batchSize: number;
    timeout: number;
    retries: number;
  };
  /** Job statistics */
  stats: {
    totalDocuments: number;
    processedDocuments: number;
    indexedDocuments: number;
    skippedDocuments: number;
    errorDocuments: number;
  };
  /** Job errors */
  errors: Array<{
    documentId: string;
    error: string;
    timestamp: Date;
  }>;
  /** Job start time */
  startedAt?: Date;
  /** Job completion time */
  completedAt?: Date;
  /** Job creation time */
  createdAt: Date;
}

/**
 * Search analytics
 */
export interface SearchAnalytics {
  /** Time period */
  period: {
    start: Date;
    end: Date;
  };
  /** Search statistics */
  stats: {
    totalSearches: number;
    uniqueUsers: number;
    avgResultsPerSearch: number;
    avgResponseTime: number;
    clickThroughRate: number;
    zeroResultSearches: number;
  };
  /** Popular queries */
  popularQueries: Array<{
    query: string;
    count: number;
    avgPosition: number;
    clickThroughRate: number;
  }>;
  /** Popular content types */
  popularContentTypes: Array<{
    contentType: SearchContentType;
    count: number;
    percentage: number;
  }>;
  /** Provider performance */
  providerPerformance: Array<{
    providerId: string;
    searches: number;
    avgResponseTime: number;
    errorRate: number;
    resultQuality: number;
  }>;
  /** User behavior */
  userBehavior: {
    avgSearchesPerSession: number;
    avgQueryLength: number;
    refinementRate: number;
    abandonmentRate: number;
  };
}

/**
 * Search suggestion
 */
export interface SearchSuggestion {
  /** Suggestion text */
  text: string;
  /** Suggestion type */
  type: 'query' | 'entity' | 'correction' | 'completion';
  /** Suggestion score */
  score: number;
  /** Suggestion metadata */
  metadata?: {
    contentType?: SearchContentType;
    provider?: string;
    category?: string;
    popularity?: number;
  };
}

/**
 * Search saved query
 */
export interface SavedSearchQuery {
  /** Query ID */
  id: string;
  /** User ID */
  userId: string;
  /** Query name */
  name: string;
  /** Query description */
  description?: string;
  /** Search query */
  query: SearchQuery;
  /** Query tags */
  tags: string[];
  /** Whether query is favorite */
  favorite: boolean;
  /** Alert settings */
  alerts?: {
    enabled: boolean;
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
    threshold: number;
    lastAlert?: Date;
  };
  /** Usage statistics */
  stats: {
    useCount: number;
    lastUsed?: Date;
    avgResults: number;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// Zod schemas for runtime validation
export const SearchQuerySchema = z.object({
  query: z.string(),
  contentTypes: z.array(z.string()).optional(),
  providers: z.array(z.string()).optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'in', 'not_in', 'exists', 'not_exists', 'range', 'regex', 'fuzzy']),
    value: z.any(),
    boost: z.number().optional()
  })).optional(),
  sort: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
    boost: z.number().optional()
  }).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  options: z.object({
    fuzzy: z.boolean().optional(),
    fuzzyThreshold: z.number().min(0).max(1).optional(),
    semantic: z.boolean().optional(),
    facets: z.boolean().optional(),
    highlighting: z.boolean().optional(),
    suggestions: z.boolean().optional(),
    timeout: z.number().optional(),
    debug: z.boolean().optional(),
    useCache: z.boolean().optional(),
    cacheTtl: z.number().optional()
  }).optional()
});

export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  url: z.string().url().optional(),
  icon: z.string().optional(),
  thumbnail: z.string().optional(),
  contentType: z.string(),
  provider: z.string(),
  providerType: z.string(),
  score: z.number().min(0).max(1),
  metadata: z.object({
    size: z.number().optional(),
    fileType: z.string().optional(),
    mimeType: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    location: z.object({
      path: z.string().optional(),
      folder: z.string().optional(),
      workspace: z.string().optional(),
      project: z.string().optional()
    }).optional(),
    collaboration: z.object({
      shared: z.boolean(),
      collaborators: z.array(z.string()).optional(),
      permissions: z.string().optional()
    }).optional(),
    activity: z.object({
      views: z.number().optional(),
      edits: z.number().optional(),
      comments: z.number().optional(),
      lastActivity: z.date().optional()
    }).optional(),
    custom: z.record(z.any()).optional()
  }),
  highlights: z.array(z.object({
    field: z.string(),
    fragments: z.array(z.string()),
    positions: z.array(z.object({
      start: z.number(),
      end: z.number()
    })).optional()
  })).optional(),
  actions: z.array(z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string().optional(),
    type: z.enum(['open', 'download', 'share', 'edit', 'delete', 'custom']),
    url: z.string().optional(),
    handler: z.string().optional(),
    params: z.record(z.any()).optional()
  })).optional(),
  createdAt: z.date(),
  lastModified: z.date()
});

export const SearchProviderSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  enabled: z.boolean(),
  config: z.object({
    settings: z.record(z.any()),
    auth: z.object({
      type: z.enum(['oauth2', 'api_key', 'basic', 'custom']),
      oauth2: z.object({
        clientId: z.string(),
        clientSecret: z.string(),
        scopes: z.array(z.string()),
        authUrl: z.string().url(),
        tokenUrl: z.string().url()
      }).optional(),
      apiKey: z.object({
        key: z.string(),
        header: z.string()
      }).optional(),
      basic: z.object({
        username: z.string(),
        password: z.string()
      }).optional(),
      custom: z.record(z.any()).optional()
    }).optional(),
    rateLimit: z.object({
      requestsPerMinute: z.number(),
      burstLimit: z.number(),
      retryAfterMs: z.number()
    }).optional(),
    indexing: z.object({
      enabled: z.boolean(),
      batchSize: z.number(),
      intervalMinutes: z.number(),
      fullSyncIntervalHours: z.number(),
      retentionDays: z.number()
    }).optional(),
    search: z.object({
      timeout: z.number(),
      maxResults: z.number(),
      enableFacets: z.boolean(),
      enableHighlighting: z.boolean()
    }).optional()
  }),
  capabilities: z.object({
    textSearch: z.boolean(),
    semanticSearch: z.boolean(),
    realTime: z.boolean(),
    facets: z.boolean(),
    suggestions: z.boolean(),
    autocomplete: z.boolean(),
    highlighting: z.boolean(),
    sorting: z.boolean(),
    filtering: z.boolean(),
    contentTypes: z.array(z.string()),
    maxResults: z.number(),
    avgResponseTime: z.number()
  }),
  stats: z.object({
    totalQueries: z.number(),
    successfulQueries: z.number(),
    failedQueries: z.number(),
    avgResponseTime: z.number(),
    indexedItems: z.number(),
    lastSuccessfulQuery: z.date().optional(),
    lastIndexing: z.date().optional(),
    errorRate: z.number().min(0).max(1)
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Type aliases for compatibility with existing code
 */
export type ContentType = SearchContentType;
export type ProviderType = SearchProviderType;
export type SearchDocument = SearchIndexDocument;

/**
 * Utility types for search operations
 */
export type CreateSearchProviderInput = Omit<SearchProvider, 'id' | 'stats' | 'createdAt' | 'updatedAt'>;
export type UpdateSearchProviderInput = Partial<Pick<SearchProvider, 'name' | 'description' | 'enabled' | 'config'>>;

export type CreateSavedSearchQueryInput = Omit<SavedSearchQuery, 'id' | 'stats' | 'createdAt' | 'updatedAt'>;
export type UpdateSavedSearchQueryInput = Partial<Pick<SavedSearchQuery, 'name' | 'description' | 'query' | 'tags' | 'favorite' | 'alerts'>>;

/**
 * Search configuration
 */
export interface SearchConfiguration {
  /** Global search settings */
  global: {
    /** Maximum results per query */
    maxResults: number;
    /** Search timeout (ms) */
    timeout: number;
    /** Enable caching */
    caching: boolean;
    /** Cache TTL (seconds) */
    cacheTtl: number;
    /** Enable analytics */
    analytics: boolean;
  };
  /** Index settings */
  indexing: {
    /** Batch size for indexing */
    batchSize: number;
    /** Index refresh interval (seconds) */
    refreshInterval: number;
    /** Maximum index size (bytes) */
    maxIndexSize: number;
    /** Index optimization schedule */
    optimizationSchedule: string;
  };
  /** Provider settings */
  providers: {
    /** Maximum concurrent providers */
    maxConcurrent: number;
    /** Provider timeout (ms) */
    timeout: number;
    /** Retry attempts */
    retryAttempts: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
  };
}

/**
 * Search health check
 */
export interface SearchHealthCheck {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Health check timestamp */
  timestamp: Date;
  /** Provider health */
  providers: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    errorRate: number;
    lastCheck: Date;
    errors?: string[];
  }>;
  /** Index health */
  index: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    size: number;
    documents: number;
    lastOptimization: Date;
    errors?: string[];
  };
  /** Performance metrics */
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}