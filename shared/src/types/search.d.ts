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
export type SearchProviderType = 'gmail' | 'outlook' | 'exchange' | 'imap' | 'slack' | 'teams' | 'discord' | 'telegram' | 'whatsapp' | 'signal' | 'notion' | 'confluence' | 'asana' | 'trello' | 'jira' | 'linear' | 'monday' | 'googledrive' | 'onedrive' | 'dropbox' | 'box' | 'github' | 'gitlab' | 'bitbucket' | 'zoom' | 'meet' | 'webex' | 'local_files' | 'local_mail' | 'local_calendar' | 'local_contacts' | 'plugin';
/**
 * Content types for search indexing
 */
export type SearchContentType = 'email' | 'calendar_event' | 'contact' | 'file' | 'document' | 'message' | 'channel' | 'thread' | 'task' | 'project' | 'issue' | 'pull_request' | 'commit' | 'meeting' | 'note' | 'bookmark' | 'custom';
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
export type SearchFilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'range' | 'regex' | 'fuzzy';
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
export declare const SearchQuerySchema: z.ZodObject<{
    query: z.ZodString;
    contentTypes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    providers: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        operator: z.ZodEnum<["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal", "in", "not_in", "exists", "not_exists", "range", "regex", "fuzzy"]>;
        value: z.ZodAny;
        boost: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        operator: "fuzzy" | "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "range";
        value?: any;
        boost?: number | undefined;
    }, {
        field: string;
        operator: "fuzzy" | "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "range";
        value?: any;
        boost?: number | undefined;
    }>, "many">>;
    sort: z.ZodOptional<z.ZodObject<{
        field: z.ZodString;
        direction: z.ZodEnum<["asc", "desc"]>;
        boost: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        direction: "asc" | "desc";
        boost?: number | undefined;
    }, {
        field: string;
        direction: "asc" | "desc";
        boost?: number | undefined;
    }>>;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
    options: z.ZodOptional<z.ZodObject<{
        fuzzy: z.ZodOptional<z.ZodBoolean>;
        fuzzyThreshold: z.ZodOptional<z.ZodNumber>;
        semantic: z.ZodOptional<z.ZodBoolean>;
        facets: z.ZodOptional<z.ZodBoolean>;
        highlighting: z.ZodOptional<z.ZodBoolean>;
        suggestions: z.ZodOptional<z.ZodBoolean>;
        timeout: z.ZodOptional<z.ZodNumber>;
        debug: z.ZodOptional<z.ZodBoolean>;
        useCache: z.ZodOptional<z.ZodBoolean>;
        cacheTtl: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        debug?: boolean | undefined;
        fuzzy?: boolean | undefined;
        timeout?: number | undefined;
        suggestions?: boolean | undefined;
        fuzzyThreshold?: number | undefined;
        semantic?: boolean | undefined;
        facets?: boolean | undefined;
        highlighting?: boolean | undefined;
        useCache?: boolean | undefined;
        cacheTtl?: number | undefined;
    }, {
        debug?: boolean | undefined;
        fuzzy?: boolean | undefined;
        timeout?: number | undefined;
        suggestions?: boolean | undefined;
        fuzzyThreshold?: number | undefined;
        semantic?: boolean | undefined;
        facets?: boolean | undefined;
        highlighting?: boolean | undefined;
        useCache?: boolean | undefined;
        cacheTtl?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit?: number | undefined;
    sort?: {
        field: string;
        direction: "asc" | "desc";
        boost?: number | undefined;
    } | undefined;
    options?: {
        debug?: boolean | undefined;
        fuzzy?: boolean | undefined;
        timeout?: number | undefined;
        suggestions?: boolean | undefined;
        fuzzyThreshold?: number | undefined;
        semantic?: boolean | undefined;
        facets?: boolean | undefined;
        highlighting?: boolean | undefined;
        useCache?: boolean | undefined;
        cacheTtl?: number | undefined;
    } | undefined;
    filters?: {
        field: string;
        operator: "fuzzy" | "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "range";
        value?: any;
        boost?: number | undefined;
    }[] | undefined;
    offset?: number | undefined;
    contentTypes?: string[] | undefined;
    providers?: string[] | undefined;
}, {
    query: string;
    limit?: number | undefined;
    sort?: {
        field: string;
        direction: "asc" | "desc";
        boost?: number | undefined;
    } | undefined;
    options?: {
        debug?: boolean | undefined;
        fuzzy?: boolean | undefined;
        timeout?: number | undefined;
        suggestions?: boolean | undefined;
        fuzzyThreshold?: number | undefined;
        semantic?: boolean | undefined;
        facets?: boolean | undefined;
        highlighting?: boolean | undefined;
        useCache?: boolean | undefined;
        cacheTtl?: number | undefined;
    } | undefined;
    filters?: {
        field: string;
        operator: "fuzzy" | "equals" | "contains" | "starts_with" | "ends_with" | "regex" | "greater_than" | "less_than" | "not_equals" | "not_contains" | "in" | "not_in" | "exists" | "greater_than_or_equal" | "less_than_or_equal" | "not_exists" | "range";
        value?: any;
        boost?: number | undefined;
    }[] | undefined;
    offset?: number | undefined;
    contentTypes?: string[] | undefined;
    providers?: string[] | undefined;
}>;
export declare const SearchResultSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    thumbnail: z.ZodOptional<z.ZodString>;
    contentType: z.ZodString;
    provider: z.ZodString;
    providerType: z.ZodString;
    score: z.ZodNumber;
    metadata: z.ZodObject<{
        size: z.ZodOptional<z.ZodNumber>;
        fileType: z.ZodOptional<z.ZodString>;
        mimeType: z.ZodOptional<z.ZodString>;
        author: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        location: z.ZodOptional<z.ZodObject<{
            path: z.ZodOptional<z.ZodString>;
            folder: z.ZodOptional<z.ZodString>;
            workspace: z.ZodOptional<z.ZodString>;
            project: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            folder?: string | undefined;
            workspace?: string | undefined;
            path?: string | undefined;
            project?: string | undefined;
        }, {
            folder?: string | undefined;
            workspace?: string | undefined;
            path?: string | undefined;
            project?: string | undefined;
        }>>;
        collaboration: z.ZodOptional<z.ZodObject<{
            shared: z.ZodBoolean;
            collaborators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            permissions: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            shared: boolean;
            permissions?: string | undefined;
            collaborators?: string[] | undefined;
        }, {
            shared: boolean;
            permissions?: string | undefined;
            collaborators?: string[] | undefined;
        }>>;
        activity: z.ZodOptional<z.ZodObject<{
            views: z.ZodOptional<z.ZodNumber>;
            edits: z.ZodOptional<z.ZodNumber>;
            comments: z.ZodOptional<z.ZodNumber>;
            lastActivity: z.ZodOptional<z.ZodDate>;
        }, "strip", z.ZodTypeAny, {
            views?: number | undefined;
            edits?: number | undefined;
            comments?: number | undefined;
            lastActivity?: Date | undefined;
        }, {
            views?: number | undefined;
            edits?: number | undefined;
            comments?: number | undefined;
            lastActivity?: Date | undefined;
        }>>;
        custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        location?: {
            folder?: string | undefined;
            workspace?: string | undefined;
            path?: string | undefined;
            project?: string | undefined;
        } | undefined;
        custom?: Record<string, any> | undefined;
        mimeType?: string | undefined;
        size?: number | undefined;
        author?: string | undefined;
        tags?: string[] | undefined;
        fileType?: string | undefined;
        categories?: string[] | undefined;
        collaboration?: {
            shared: boolean;
            permissions?: string | undefined;
            collaborators?: string[] | undefined;
        } | undefined;
        activity?: {
            views?: number | undefined;
            edits?: number | undefined;
            comments?: number | undefined;
            lastActivity?: Date | undefined;
        } | undefined;
    }, {
        location?: {
            folder?: string | undefined;
            workspace?: string | undefined;
            path?: string | undefined;
            project?: string | undefined;
        } | undefined;
        custom?: Record<string, any> | undefined;
        mimeType?: string | undefined;
        size?: number | undefined;
        author?: string | undefined;
        tags?: string[] | undefined;
        fileType?: string | undefined;
        categories?: string[] | undefined;
        collaboration?: {
            shared: boolean;
            permissions?: string | undefined;
            collaborators?: string[] | undefined;
        } | undefined;
        activity?: {
            views?: number | undefined;
            edits?: number | undefined;
            comments?: number | undefined;
            lastActivity?: Date | undefined;
        } | undefined;
    }>;
    highlights: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        fragments: z.ZodArray<z.ZodString, "many">;
        positions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            end: number;
            start: number;
        }, {
            end: number;
            start: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        field: string;
        fragments: string[];
        positions?: {
            end: number;
            start: number;
        }[] | undefined;
    }, {
        field: string;
        fragments: string[];
        positions?: {
            end: number;
            start: number;
        }[] | undefined;
    }>, "many">>;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        icon: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["open", "download", "share", "edit", "delete", "custom"]>;
        url: z.ZodOptional<z.ZodString>;
        handler: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "custom" | "delete" | "open" | "download" | "share" | "edit";
        label: string;
        url?: string | undefined;
        icon?: string | undefined;
        params?: Record<string, any> | undefined;
        handler?: string | undefined;
    }, {
        id: string;
        type: "custom" | "delete" | "open" | "download" | "share" | "edit";
        label: string;
        url?: string | undefined;
        icon?: string | undefined;
        params?: Record<string, any> | undefined;
        handler?: string | undefined;
    }>, "many">>;
    createdAt: z.ZodDate;
    lastModified: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    provider: string;
    title: string;
    score: number;
    metadata: {
        location?: {
            folder?: string | undefined;
            workspace?: string | undefined;
            path?: string | undefined;
            project?: string | undefined;
        } | undefined;
        custom?: Record<string, any> | undefined;
        mimeType?: string | undefined;
        size?: number | undefined;
        author?: string | undefined;
        tags?: string[] | undefined;
        fileType?: string | undefined;
        categories?: string[] | undefined;
        collaboration?: {
            shared: boolean;
            permissions?: string | undefined;
            collaborators?: string[] | undefined;
        } | undefined;
        activity?: {
            views?: number | undefined;
            edits?: number | undefined;
            comments?: number | undefined;
            lastActivity?: Date | undefined;
        } | undefined;
    };
    lastModified: Date;
    contentType: string;
    providerType: string;
    description?: string | undefined;
    content?: string | undefined;
    url?: string | undefined;
    highlights?: {
        field: string;
        fragments: string[];
        positions?: {
            end: number;
            start: number;
        }[] | undefined;
    }[] | undefined;
    icon?: string | undefined;
    actions?: {
        id: string;
        type: "custom" | "delete" | "open" | "download" | "share" | "edit";
        label: string;
        url?: string | undefined;
        icon?: string | undefined;
        params?: Record<string, any> | undefined;
        handler?: string | undefined;
    }[] | undefined;
    thumbnail?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    provider: string;
    title: string;
    score: number;
    metadata: {
        location?: {
            folder?: string | undefined;
            workspace?: string | undefined;
            path?: string | undefined;
            project?: string | undefined;
        } | undefined;
        custom?: Record<string, any> | undefined;
        mimeType?: string | undefined;
        size?: number | undefined;
        author?: string | undefined;
        tags?: string[] | undefined;
        fileType?: string | undefined;
        categories?: string[] | undefined;
        collaboration?: {
            shared: boolean;
            permissions?: string | undefined;
            collaborators?: string[] | undefined;
        } | undefined;
        activity?: {
            views?: number | undefined;
            edits?: number | undefined;
            comments?: number | undefined;
            lastActivity?: Date | undefined;
        } | undefined;
    };
    lastModified: Date;
    contentType: string;
    providerType: string;
    description?: string | undefined;
    content?: string | undefined;
    url?: string | undefined;
    highlights?: {
        field: string;
        fragments: string[];
        positions?: {
            end: number;
            start: number;
        }[] | undefined;
    }[] | undefined;
    icon?: string | undefined;
    actions?: {
        id: string;
        type: "custom" | "delete" | "open" | "download" | "share" | "edit";
        label: string;
        url?: string | undefined;
        icon?: string | undefined;
        params?: Record<string, any> | undefined;
        handler?: string | undefined;
    }[] | undefined;
    thumbnail?: string | undefined;
}>;
export declare const SearchProviderSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    icon: z.ZodOptional<z.ZodString>;
    enabled: z.ZodBoolean;
    config: z.ZodObject<{
        settings: z.ZodRecord<z.ZodString, z.ZodAny>;
        auth: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["oauth2", "api_key", "basic", "custom"]>;
            oauth2: z.ZodOptional<z.ZodObject<{
                clientId: z.ZodString;
                clientSecret: z.ZodString;
                scopes: z.ZodArray<z.ZodString, "many">;
                authUrl: z.ZodString;
                tokenUrl: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            }, {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            }>>;
            apiKey: z.ZodOptional<z.ZodObject<{
                key: z.ZodString;
                header: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                header: string;
                key: string;
            }, {
                header: string;
                key: string;
            }>>;
            basic: z.ZodOptional<z.ZodObject<{
                username: z.ZodString;
                password: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                password: string;
                username: string;
            }, {
                password: string;
                username: string;
            }>>;
            custom: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            type: "custom" | "api_key" | "oauth2" | "basic";
            custom?: Record<string, any> | undefined;
            oauth2?: {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            } | undefined;
            basic?: {
                password: string;
                username: string;
            } | undefined;
            apiKey?: {
                header: string;
                key: string;
            } | undefined;
        }, {
            type: "custom" | "api_key" | "oauth2" | "basic";
            custom?: Record<string, any> | undefined;
            oauth2?: {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            } | undefined;
            basic?: {
                password: string;
                username: string;
            } | undefined;
            apiKey?: {
                header: string;
                key: string;
            } | undefined;
        }>>;
        rateLimit: z.ZodOptional<z.ZodObject<{
            requestsPerMinute: z.ZodNumber;
            burstLimit: z.ZodNumber;
            retryAfterMs: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            requestsPerMinute: number;
            burstLimit: number;
            retryAfterMs: number;
        }, {
            requestsPerMinute: number;
            burstLimit: number;
            retryAfterMs: number;
        }>>;
        indexing: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            batchSize: z.ZodNumber;
            intervalMinutes: z.ZodNumber;
            fullSyncIntervalHours: z.ZodNumber;
            retentionDays: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            batchSize: number;
            enabled: boolean;
            intervalMinutes: number;
            fullSyncIntervalHours: number;
            retentionDays: number;
        }, {
            batchSize: number;
            enabled: boolean;
            intervalMinutes: number;
            fullSyncIntervalHours: number;
            retentionDays: number;
        }>>;
        search: z.ZodOptional<z.ZodObject<{
            timeout: z.ZodNumber;
            maxResults: z.ZodNumber;
            enableFacets: z.ZodBoolean;
            enableHighlighting: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            maxResults: number;
            timeout: number;
            enableFacets: boolean;
            enableHighlighting: boolean;
        }, {
            maxResults: number;
            timeout: number;
            enableFacets: boolean;
            enableHighlighting: boolean;
        }>>;
    }, "strip", z.ZodTypeAny, {
        settings: Record<string, any>;
        auth?: {
            type: "custom" | "api_key" | "oauth2" | "basic";
            custom?: Record<string, any> | undefined;
            oauth2?: {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            } | undefined;
            basic?: {
                password: string;
                username: string;
            } | undefined;
            apiKey?: {
                header: string;
                key: string;
            } | undefined;
        } | undefined;
        search?: {
            maxResults: number;
            timeout: number;
            enableFacets: boolean;
            enableHighlighting: boolean;
        } | undefined;
        rateLimit?: {
            requestsPerMinute: number;
            burstLimit: number;
            retryAfterMs: number;
        } | undefined;
        indexing?: {
            batchSize: number;
            enabled: boolean;
            intervalMinutes: number;
            fullSyncIntervalHours: number;
            retentionDays: number;
        } | undefined;
    }, {
        settings: Record<string, any>;
        auth?: {
            type: "custom" | "api_key" | "oauth2" | "basic";
            custom?: Record<string, any> | undefined;
            oauth2?: {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            } | undefined;
            basic?: {
                password: string;
                username: string;
            } | undefined;
            apiKey?: {
                header: string;
                key: string;
            } | undefined;
        } | undefined;
        search?: {
            maxResults: number;
            timeout: number;
            enableFacets: boolean;
            enableHighlighting: boolean;
        } | undefined;
        rateLimit?: {
            requestsPerMinute: number;
            burstLimit: number;
            retryAfterMs: number;
        } | undefined;
        indexing?: {
            batchSize: number;
            enabled: boolean;
            intervalMinutes: number;
            fullSyncIntervalHours: number;
            retentionDays: number;
        } | undefined;
    }>;
    capabilities: z.ZodObject<{
        textSearch: z.ZodBoolean;
        semanticSearch: z.ZodBoolean;
        realTime: z.ZodBoolean;
        facets: z.ZodBoolean;
        suggestions: z.ZodBoolean;
        autocomplete: z.ZodBoolean;
        highlighting: z.ZodBoolean;
        sorting: z.ZodBoolean;
        filtering: z.ZodBoolean;
        contentTypes: z.ZodArray<z.ZodString, "many">;
        maxResults: z.ZodNumber;
        avgResponseTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxResults: number;
        realTime: boolean;
        avgResponseTime: number;
        suggestions: boolean;
        contentTypes: string[];
        facets: boolean;
        highlighting: boolean;
        textSearch: boolean;
        semanticSearch: boolean;
        autocomplete: boolean;
        sorting: boolean;
        filtering: boolean;
    }, {
        maxResults: number;
        realTime: boolean;
        avgResponseTime: number;
        suggestions: boolean;
        contentTypes: string[];
        facets: boolean;
        highlighting: boolean;
        textSearch: boolean;
        semanticSearch: boolean;
        autocomplete: boolean;
        sorting: boolean;
        filtering: boolean;
    }>;
    stats: z.ZodObject<{
        totalQueries: z.ZodNumber;
        successfulQueries: z.ZodNumber;
        failedQueries: z.ZodNumber;
        avgResponseTime: z.ZodNumber;
        indexedItems: z.ZodNumber;
        lastSuccessfulQuery: z.ZodOptional<z.ZodDate>;
        lastIndexing: z.ZodOptional<z.ZodDate>;
        errorRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        avgResponseTime: number;
        errorRate: number;
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        indexedItems: number;
        lastSuccessfulQuery?: Date | undefined;
        lastIndexing?: Date | undefined;
    }, {
        avgResponseTime: number;
        errorRate: number;
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        indexedItems: number;
        lastSuccessfulQuery?: Date | undefined;
        lastIndexing?: Date | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    config: {
        settings: Record<string, any>;
        auth?: {
            type: "custom" | "api_key" | "oauth2" | "basic";
            custom?: Record<string, any> | undefined;
            oauth2?: {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            } | undefined;
            basic?: {
                password: string;
                username: string;
            } | undefined;
            apiKey?: {
                header: string;
                key: string;
            } | undefined;
        } | undefined;
        search?: {
            maxResults: number;
            timeout: number;
            enableFacets: boolean;
            enableHighlighting: boolean;
        } | undefined;
        rateLimit?: {
            requestsPerMinute: number;
            burstLimit: number;
            retryAfterMs: number;
        } | undefined;
        indexing?: {
            batchSize: number;
            enabled: boolean;
            intervalMinutes: number;
            fullSyncIntervalHours: number;
            retentionDays: number;
        } | undefined;
    };
    stats: {
        avgResponseTime: number;
        errorRate: number;
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        indexedItems: number;
        lastSuccessfulQuery?: Date | undefined;
        lastIndexing?: Date | undefined;
    };
    type: string;
    capabilities: {
        maxResults: number;
        realTime: boolean;
        avgResponseTime: number;
        suggestions: boolean;
        contentTypes: string[];
        facets: boolean;
        highlighting: boolean;
        textSearch: boolean;
        semanticSearch: boolean;
        autocomplete: boolean;
        sorting: boolean;
        filtering: boolean;
    };
    enabled: boolean;
    description?: string | undefined;
    icon?: string | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    config: {
        settings: Record<string, any>;
        auth?: {
            type: "custom" | "api_key" | "oauth2" | "basic";
            custom?: Record<string, any> | undefined;
            oauth2?: {
                clientId: string;
                scopes: string[];
                clientSecret: string;
                authUrl: string;
                tokenUrl: string;
            } | undefined;
            basic?: {
                password: string;
                username: string;
            } | undefined;
            apiKey?: {
                header: string;
                key: string;
            } | undefined;
        } | undefined;
        search?: {
            maxResults: number;
            timeout: number;
            enableFacets: boolean;
            enableHighlighting: boolean;
        } | undefined;
        rateLimit?: {
            requestsPerMinute: number;
            burstLimit: number;
            retryAfterMs: number;
        } | undefined;
        indexing?: {
            batchSize: number;
            enabled: boolean;
            intervalMinutes: number;
            fullSyncIntervalHours: number;
            retentionDays: number;
        } | undefined;
    };
    stats: {
        avgResponseTime: number;
        errorRate: number;
        totalQueries: number;
        successfulQueries: number;
        failedQueries: number;
        indexedItems: number;
        lastSuccessfulQuery?: Date | undefined;
        lastIndexing?: Date | undefined;
    };
    type: string;
    capabilities: {
        maxResults: number;
        realTime: boolean;
        avgResponseTime: number;
        suggestions: boolean;
        contentTypes: string[];
        facets: boolean;
        highlighting: boolean;
        textSearch: boolean;
        semanticSearch: boolean;
        autocomplete: boolean;
        sorting: boolean;
        filtering: boolean;
    };
    enabled: boolean;
    description?: string | undefined;
    icon?: string | undefined;
}>;
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
//# sourceMappingURL=search.d.ts.map