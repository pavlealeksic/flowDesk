/**
 * TypeScript bindings for the Flow Desk unified search engine
 * 
 * This module provides a high-level interface to the Rust-based search engine,
 * with proper TypeScript types and error handling.
 */

import { 
  SearchQuery, 
  SearchResponse, 
  SearchDocument as SearchDocumentType,
  SearchProvider,
  SearchConfiguration,
  SearchAnalytics,
  ContentType,
  ProviderType,
} from '../types/search';

// Native bindings interface (will be loaded dynamically)
interface NativeSearchEngine {
  initialize(config: NativeSearchConfig): Promise<void>;
  search(query: NativeSearchQuery): Promise<NativeSearchResponse>;
  indexDocument(document: NativeSearchDocument): Promise<void>;
  indexDocuments(documents: NativeSearchDocument[]): Promise<number>;
  deleteDocument(documentId: string): Promise<boolean>;
  getSuggestions(partialQuery: string, limit?: number): Promise<string[]>;
  getAnalytics(): Promise<NativeSearchAnalytics>;
  optimizeIndices(): Promise<void>;
  clearCache(): Promise<void>;
}

interface NativeSearchConfig {
  indexDir: string;
  maxMemoryMb?: number;
  maxResponseTimeMs?: number;
  numThreads?: number;
  enableAnalytics?: boolean;
  enableSuggestions?: boolean;
  enableRealtime?: boolean;
  providers?: NativeProviderConfig[];
}

interface NativeProviderConfig {
  id: string;
  providerType: string;
  enabled: boolean;
  weight?: number;
  config?: any;
}

interface NativeSearchQuery {
  query: string;
  contentTypes?: string[];
  providerIds?: string[];
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  highlighting?: boolean;
  suggestions?: boolean;
  timeout?: number;
}

interface NativeSearchDocument {
  id: string;
  title: string;
  content: string;
  summary?: string;
  contentType: string;
  providerId: string;
  providerType: string;
  url?: string;
  author?: string;
  tags?: string[];
  categories?: string[];
  metadata?: any;
}

interface NativeSearchResponse {
  results: NativeSearchResult[];
  totalCount: number;
  executionTimeMs: number;
  suggestions?: string[];
}

interface NativeSearchResult {
  id: string;
  title: string;
  description?: string;
  content?: string;
  url?: string;
  contentType: string;
  providerId: string;
  providerType: string;
  score: number;
  highlights?: NativeSearchHighlight[];
  createdAt: string;
  lastModified: string;
}

interface NativeSearchHighlight {
  field: string;
  fragments: string[];
}

interface NativeSearchAnalytics {
  totalQueries: number;
  avgResponseTimeMs: number;
  successRate: number;
  popularQueries: string[];
  errorRate: number;
}

/**
 * Search engine error types
 */
export class SearchEngineError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN',
    public cause?: Error
  ) {
    super(message);
    this.name = 'SearchEngineError';
  }
}

export class SearchEngineNotInitializedError extends SearchEngineError {
  constructor() {
    super('Search engine not initialized', 'NOT_INITIALIZED');
  }
}

export class SearchEngineIndexError extends SearchEngineError {
  constructor(message: string, cause?: Error) {
    super(message, 'INDEX_ERROR', cause);
  }
}

export class SearchEngineQueryError extends SearchEngineError {
  constructor(message: string, cause?: Error) {
    super(message, 'QUERY_ERROR', cause);
  }
}

/**
 * Main search engine class providing TypeScript interface to Rust engine
 */
export class SearchEngine {
  private native: NativeSearchEngine | null = null;
  private initialized = false;
  private config: SearchConfiguration | null = null;

  constructor() {}

  /**
   * Initialize the search engine with configuration
   */
  async initialize(config: SearchConfiguration): Promise<void> {
    try {
      // Load native module
      if (!this.native) {
        this.native = await this.loadNativeModule();
      }

      const nativeConfig = this.convertToNativeConfig(config);
      await this.native.initialize(nativeConfig);
      
      this.initialized = true;
      this.config = config;
    } catch (error) {
      throw new SearchEngineError(
        `Failed to initialize search engine: ${error instanceof Error ? error.message : String(error)}`,
        'INIT_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Execute a search query
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    this.ensureInitialized();

    try {
      const nativeQuery = this.convertToNativeQuery(query);
      const nativeResponse = await this.native!.search(nativeQuery);
      return this.convertFromNativeResponse(nativeResponse);
    } catch (error) {
      throw new SearchEngineQueryError(
        `Search query failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(document: SearchDocumentType): Promise<void> {
    this.ensureInitialized();

    try {
      const nativeDocument = this.convertToNativeDocument(document);
      await this.native!.indexDocument(nativeDocument);
    } catch (error) {
      throw new SearchEngineIndexError(
        `Document indexing failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Index multiple documents in batch
   */
  async indexDocuments(documents: SearchDocumentType[]): Promise<number> {
    this.ensureInitialized();

    try {
      const nativeDocuments = documents.map(doc => this.convertToNativeDocument(doc));
      return await this.native!.indexDocuments(nativeDocuments);
    } catch (error) {
      throw new SearchEngineIndexError(
        `Batch document indexing failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      return await this.native!.deleteDocument(documentId);
    } catch (error) {
      throw new SearchEngineIndexError(
        `Document deletion failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get search suggestions for a partial query
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<string[]> {
    this.ensureInitialized();

    try {
      return await this.native!.getSuggestions(partialQuery, limit);
    } catch (error) {
      throw new SearchEngineQueryError(
        `Suggestions failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get search analytics
   */
  async getAnalytics(): Promise<SearchAnalytics> {
    this.ensureInitialized();

    try {
      const nativeAnalytics = await this.native!.getAnalytics();
      return this.convertFromNativeAnalytics(nativeAnalytics);
    } catch (error) {
      throw new SearchEngineError(
        `Analytics retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        'ANALYTICS_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Optimize search indices
   */
  async optimizeIndices(): Promise<void> {
    this.ensureInitialized();

    try {
      await this.native!.optimizeIndices();
    } catch (error) {
      throw new SearchEngineError(
        `Index optimization failed: ${error instanceof Error ? error.message : String(error)}`,
        'OPTIMIZATION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clear search cache
   */
  async clearCache(): Promise<void> {
    this.ensureInitialized();

    try {
      await this.native!.clearCache();
    } catch (error) {
      throw new SearchEngineError(
        `Cache clearing failed: ${error instanceof Error ? error.message : String(error)}`,
        'CACHE_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if the search engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration
   */
  getConfiguration(): SearchConfiguration | null {
    return this.config;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.native) {
      throw new SearchEngineNotInitializedError();
    }
  }

  private async loadNativeModule(): Promise<NativeSearchEngine> {
    try {
      // Try to load the native module
      // This would typically be a .node file compiled from Rust
      const nativeModule = require('@flow-desk/search-native');
      
      // Initialize logging
      if (nativeModule.initLogging) {
        nativeModule.initLogging('info');
      }

      return new nativeModule.JsSearchEngine();
    } catch (error) {
      // Fallback for development - use mock implementation
      console.warn('Native search module not available, using mock implementation');
      return this.createMockNativeModule();
    }
  }

  private createMockNativeModule(): NativeSearchEngine {
    // Mock implementation for development/testing
    return {
      async initialize(_config: NativeSearchConfig): Promise<void> {
        console.log('Mock search engine initialized');
      },
      
      async search(query: NativeSearchQuery): Promise<NativeSearchResponse> {
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
      
      async indexDocument(_document: NativeSearchDocument): Promise<void> {
        console.log('Mock: Document indexed');
      },
      
      async indexDocuments(documents: NativeSearchDocument[]): Promise<number> {
        console.log(`Mock: ${documents.length} documents indexed`);
        return documents.length;
      },
      
      async deleteDocument(_documentId: string): Promise<boolean> {
        console.log('Mock: Document deleted');
        return true;
      },
      
      async getSuggestions(partialQuery: string, limit?: number): Promise<string[]> {
        return Array.from({ length: Math.min(limit || 5, 3) }, (_, i) => 
          `${partialQuery} suggestion ${i + 1}`
        );
      },
      
      async getAnalytics(): Promise<NativeSearchAnalytics> {
        return {
          totalQueries: 100,
          avgResponseTimeMs: 150,
          successRate: 0.95,
          popularQueries: ['test', 'search', 'document'],
          errorRate: 0.05,
        };
      },
      
      async optimizeIndices(): Promise<void> {
        console.log('Mock: Indices optimized');
      },
      
      async clearCache(): Promise<void> {
        console.log('Mock: Cache cleared');
      },
    };
  }

  private convertToNativeConfig(config: SearchConfiguration): NativeSearchConfig {
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

  private convertToNativeQuery(query: SearchQuery): NativeSearchQuery {
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

  private convertToNativeDocument(document: SearchDocumentType): NativeSearchDocument {
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

  private convertFromNativeResponse(nativeResponse: NativeSearchResponse): SearchResponse {
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
        contentType: result.contentType as ContentType,
        provider: result.providerId,
        providerType: result.providerType as ProviderType,
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

  private convertFromNativeAnalytics(nativeAnalytics: NativeSearchAnalytics): SearchAnalytics {
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

/**
 * Singleton search engine instance
 */
let searchEngineInstance: SearchEngine | null = null;

/**
 * Get the global search engine instance
 */
export function getSearchEngine(): SearchEngine {
  if (!searchEngineInstance) {
    searchEngineInstance = new SearchEngine();
  }
  return searchEngineInstance;
}

/**
 * Initialize the global search engine
 */
export async function initializeSearchEngine(config: SearchConfiguration): Promise<void> {
  const engine = getSearchEngine();
  await engine.initialize(config);
}

// Export types for external use
export * from '../types/search';
export {
  SearchEngineError,
  SearchEngineNotInitializedError,
  SearchEngineIndexError,
  SearchEngineQueryError,
};