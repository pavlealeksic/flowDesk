/**
 * TypeScript bindings for the Flow Desk unified search engine
 *
 * This module provides a high-level interface to the Rust-based search engine,
 * with proper TypeScript types and error handling.
 */
import { SearchQuery, SearchResponse, SearchDocument as SearchDocumentType, SearchConfiguration, SearchAnalytics } from '../types/search';
/**
 * Search engine error types
 */
export declare class SearchEngineError extends Error {
    code: string;
    cause?: Error | undefined;
    constructor(message: string, code?: string, cause?: Error | undefined);
}
export declare class SearchEngineNotInitializedError extends SearchEngineError {
    constructor();
}
export declare class SearchEngineIndexError extends SearchEngineError {
    constructor(message: string, cause?: Error);
}
export declare class SearchEngineQueryError extends SearchEngineError {
    constructor(message: string, cause?: Error);
}
/**
 * Main search engine class providing TypeScript interface to Rust engine
 */
export declare class SearchEngine {
    private native;
    private initialized;
    private config;
    constructor();
    /**
     * Initialize the search engine with configuration
     */
    initialize(config: SearchConfiguration): Promise<void>;
    /**
     * Execute a search query
     */
    search(query: SearchQuery): Promise<SearchResponse>;
    /**
     * Index a single document
     */
    indexDocument(document: SearchDocumentType): Promise<void>;
    /**
     * Index multiple documents in batch
     */
    indexDocuments(documents: SearchDocumentType[]): Promise<number>;
    /**
     * Delete a document from the index
     */
    deleteDocument(documentId: string): Promise<boolean>;
    /**
     * Get search suggestions for a partial query
     */
    getSuggestions(partialQuery: string, limit?: number): Promise<string[]>;
    /**
     * Get search analytics
     */
    getAnalytics(): Promise<SearchAnalytics>;
    /**
     * Optimize search indices
     */
    optimizeIndices(): Promise<void>;
    /**
     * Clear search cache
     */
    clearCache(): Promise<void>;
    /**
     * Check if the search engine is initialized
     */
    isInitialized(): boolean;
    /**
     * Get current configuration
     */
    getConfiguration(): SearchConfiguration | null;
    private ensureInitialized;
    private loadNativeModule;
    private createMockNativeModule;
    private convertToNativeConfig;
    private convertToNativeQuery;
    private convertToNativeDocument;
    private convertFromNativeResponse;
    private convertFromNativeAnalytics;
}
/**
 * Get the global search engine instance
 */
export declare function getSearchEngine(): SearchEngine;
/**
 * Initialize the global search engine
 */
export declare function initializeSearchEngine(config: SearchConfiguration): Promise<void>;
export * from '../types/search';
export { SearchEngineError, SearchEngineNotInitializedError, SearchEngineIndexError, SearchEngineQueryError, };
//# sourceMappingURL=index.d.ts.map