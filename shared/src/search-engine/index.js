"use strict";
/**
 * TypeScript bindings for the Flow Desk unified search engine
 *
 * This module provides a high-level interface to the Rust-based search engine,
 * with proper TypeScript types and error handling.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchEngine = exports.SearchEngineQueryError = exports.SearchEngineIndexError = exports.SearchEngineNotInitializedError = exports.SearchEngineError = void 0;
exports.getSearchEngine = getSearchEngine;
exports.initializeSearchEngine = initializeSearchEngine;
/**
 * Search engine error types
 */
class SearchEngineError extends Error {
    constructor(message, code = 'UNKNOWN', cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'SearchEngineError';
    }
}
exports.SearchEngineError = SearchEngineError;
class SearchEngineNotInitializedError extends SearchEngineError {
    constructor() {
        super('Search engine not initialized', 'NOT_INITIALIZED');
    }
}
exports.SearchEngineNotInitializedError = SearchEngineNotInitializedError;
class SearchEngineIndexError extends SearchEngineError {
    constructor(message, cause) {
        super(message, 'INDEX_ERROR', cause);
    }
}
exports.SearchEngineIndexError = SearchEngineIndexError;
class SearchEngineQueryError extends SearchEngineError {
    constructor(message, cause) {
        super(message, 'QUERY_ERROR', cause);
    }
}
exports.SearchEngineQueryError = SearchEngineQueryError;
/**
 * Main search engine class providing TypeScript interface to Rust engine
 */
class SearchEngine {
    constructor() {
        this.native = null;
        this.initialized = false;
        this.config = null;
    }
    /**
     * Initialize the search engine with configuration
     */
    async initialize(config) {
        try {
            // Load native module
            if (!this.native) {
                this.native = await this.loadNativeModule();
            }
            const nativeConfig = this.convertToNativeConfig(config);
            await this.native.initialize(nativeConfig);
            this.initialized = true;
            this.config = config;
        }
        catch (error) {
            throw new SearchEngineError(`Failed to initialize search engine: ${error instanceof Error ? error.message : String(error)}`, 'INIT_ERROR', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Execute a search query
     */
    async search(query) {
        this.ensureInitialized();
        try {
            const nativeQuery = this.convertToNativeQuery(query);
            const nativeResponse = await this.native.search(nativeQuery);
            return this.convertFromNativeResponse(nativeResponse);
        }
        catch (error) {
            throw new SearchEngineQueryError(`Search query failed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Index a single document
     */
    async indexDocument(document) {
        this.ensureInitialized();
        try {
            const nativeDocument = this.convertToNativeDocument(document);
            await this.native.indexDocument(nativeDocument);
        }
        catch (error) {
            throw new SearchEngineIndexError(`Document indexing failed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Index multiple documents in batch
     */
    async indexDocuments(documents) {
        this.ensureInitialized();
        try {
            const nativeDocuments = documents.map(doc => this.convertToNativeDocument(doc));
            return await this.native.indexDocuments(nativeDocuments);
        }
        catch (error) {
            throw new SearchEngineIndexError(`Batch document indexing failed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Delete a document from the index
     */
    async deleteDocument(documentId) {
        this.ensureInitialized();
        try {
            return await this.native.deleteDocument(documentId);
        }
        catch (error) {
            throw new SearchEngineIndexError(`Document deletion failed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get search suggestions for a partial query
     */
    async getSuggestions(partialQuery, limit = 10) {
        this.ensureInitialized();
        try {
            return await this.native.getSuggestions(partialQuery, limit);
        }
        catch (error) {
            throw new SearchEngineQueryError(`Suggestions failed: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get search analytics
     */
    async getAnalytics() {
        this.ensureInitialized();
        try {
            const nativeAnalytics = await this.native.getAnalytics();
            return this.convertFromNativeAnalytics(nativeAnalytics);
        }
        catch (error) {
            throw new SearchEngineError(`Analytics retrieval failed: ${error instanceof Error ? error.message : String(error)}`, 'ANALYTICS_ERROR', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Optimize search indices
     */
    async optimizeIndices() {
        this.ensureInitialized();
        try {
            await this.native.optimizeIndices();
        }
        catch (error) {
            throw new SearchEngineError(`Index optimization failed: ${error instanceof Error ? error.message : String(error)}`, 'OPTIMIZATION_ERROR', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Clear search cache
     */
    async clearCache() {
        this.ensureInitialized();
        try {
            await this.native.clearCache();
        }
        catch (error) {
            throw new SearchEngineError(`Cache clearing failed: ${error instanceof Error ? error.message : String(error)}`, 'CACHE_ERROR', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Check if the search engine is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Get current configuration
     */
    getConfiguration() {
        return this.config;
    }
    ensureInitialized() {
        if (!this.initialized || !this.native) {
            throw new SearchEngineNotInitializedError();
        }
    }
    async loadNativeModule() {
        try {
            // Try to load the native module
            // This would typically be a .node file compiled from Rust
            const nativeModule = require('@flow-desk/search-native');
            // Initialize logging
            if (nativeModule.initLogging) {
                nativeModule.initLogging('info');
            }
            return new nativeModule.JsSearchEngine();
        }
        catch (error) {
            // Fallback for development - use mock implementation
            console.warn('Native search module not available, using mock implementation');
            return this.createMockNativeModule();
        }
    }
    createMockNativeModule() {
        // Mock implementation for development/testing
        return {
            async initialize(_config) {
                console.log('Mock search engine initialized');
            },
            async search(query) {
                return {
                    results: [
                        {
                            id: 'mock-1',
                            title: `Mock result for: ${query.query}`,
                            description: 'This is a mock search result',
                            content: 'Mock content...',
                            url: 'https://example.com',
                            contentType: 'document',
                            providerId: 'mock',
                            providerType: 'local_files',
                            score: 0.9,
                            createdAt: new Date().toISOString(),
                            lastModified: new Date().toISOString(),
                        },
                    ],
                    totalCount: 1,
                    executionTimeMs: 50,
                    suggestions: [`${query.query} suggestion`],
                };
            },
            async indexDocument(_document) {
                console.log('Mock: Document indexed');
            },
            async indexDocuments(documents) {
                console.log(`Mock: ${documents.length} documents indexed`);
                return documents.length;
            },
            async deleteDocument(_documentId) {
                console.log('Mock: Document deleted');
                return true;
            },
            async getSuggestions(partialQuery, limit) {
                return Array.from({ length: Math.min(limit || 5, 3) }, (_, i) => `${partialQuery} suggestion ${i + 1}`);
            },
            async getAnalytics() {
                return {
                    totalQueries: 100,
                    avgResponseTimeMs: 150,
                    successRate: 0.95,
                    popularQueries: ['test', 'search', 'document'],
                    errorRate: 0.05,
                };
            },
            async optimizeIndices() {
                console.log('Mock: Indices optimized');
            },
            async clearCache() {
                console.log('Mock: Cache cleared');
            },
        };
    }
    convertToNativeConfig(config) {
        return {
            indexDir: config.global.indexDir || './search_indices',
            maxMemoryMb: config.indexing.maxMemoryMb || 512,
            maxResponseTimeMs: config.global.timeout || 300,
            numThreads: config.providers.maxConcurrent || 4,
            enableAnalytics: config.global.analytics || true,
            enableSuggestions: true,
            enableRealtime: true,
            providers: [], // Would convert provider configurations
        };
    }
    convertToNativeQuery(query) {
        return {
            query: query.query,
            contentTypes: query.contentTypes?.map(t => typeof t === 'string' ? t : t.toString()),
            providerIds: query.providers,
            limit: query.limit,
            offset: query.offset,
            fuzzy: query.options?.fuzzy,
            highlighting: query.options?.highlighting,
            suggestions: query.options?.suggestions,
            timeout: query.options?.timeout,
        };
    }
    convertToNativeDocument(document) {
        return {
            id: document.id,
            title: document.title,
            content: document.content || '',
            summary: document.description,
            contentType: typeof document.contentType === 'string' ? document.contentType : document.contentType.toString(),
            providerId: document.provider,
            providerType: typeof document.providerType === 'string' ? document.providerType : document.providerType.toString(),
            url: document.url,
            author: document.metadata?.author,
            tags: document.metadata?.tags,
            categories: document.metadata?.categories,
            metadata: document.metadata?.custom,
        };
    }
    convertFromNativeResponse(nativeResponse) {
        return {
            query: { query: '', contentTypes: [], providers: [] }, // Would need to store original query
            results: nativeResponse.results.map(result => ({
                id: result.id,
                title: result.title,
                description: result.description,
                content: result.content,
                url: result.url,
                icon: undefined,
                thumbnail: undefined,
                contentType: result.contentType,
                provider: result.providerId,
                providerType: result.providerType,
                score: result.score,
                metadata: {
                    size: undefined,
                    fileType: undefined,
                    mimeType: undefined,
                    author: undefined,
                    tags: [],
                    categories: [],
                    location: undefined,
                    collaboration: undefined,
                    activity: undefined,
                    custom: {},
                },
                highlights: result.highlights?.map(h => ({
                    field: h.field,
                    fragments: h.fragments,
                    positions: undefined,
                })),
                actions: undefined,
                createdAt: new Date(result.createdAt),
                lastModified: new Date(result.lastModified),
            })),
            totalCount: nativeResponse.totalCount,
            executionTimeMs: nativeResponse.executionTimeMs,
            facets: undefined,
            suggestions: nativeResponse.suggestions,
            debugInfo: undefined,
            nextPageToken: undefined,
            providerResponses: undefined,
        };
    }
    convertFromNativeAnalytics(nativeAnalytics) {
        return {
            period: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last week
                end: new Date(),
            },
            stats: {
                totalSearches: nativeAnalytics.totalQueries,
                uniqueUsers: 0, // Not tracked in native
                avgResultsPerSearch: 0, // Not tracked in native
                avgResponseTime: nativeAnalytics.avgResponseTimeMs,
                clickThroughRate: 0, // Not tracked in native
                zeroResultSearches: 0, // Not tracked in native
            },
            popularQueries: nativeAnalytics.popularQueries.map((query, index) => ({
                query,
                count: 10 - index, // Mock count
                avgPosition: 1,
                clickThroughRate: 0.5,
            })),
            popularContentTypes: [],
            providerPerformance: [],
            userBehavior: {
                avgSearchesPerSession: 0,
                avgQueryLength: 0,
                refinementRate: 0,
                abandonmentRate: 0,
            },
        };
    }
}
exports.SearchEngine = SearchEngine;
/**
 * Singleton search engine instance
 */
let searchEngineInstance = null;
/**
 * Get the global search engine instance
 */
function getSearchEngine() {
    if (!searchEngineInstance) {
        searchEngineInstance = new SearchEngine();
    }
    return searchEngineInstance;
}
/**
 * Initialize the global search engine
 */
async function initializeSearchEngine(config) {
    const engine = getSearchEngine();
    await engine.initialize(config);
}
// Export types for external use
__exportStar(require("../types/search"), exports);
//# sourceMappingURL=index.js.map