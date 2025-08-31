/**
 * Search service for integrating with the unified Rust-based search engine
 */

import { app } from 'electron';
import { join } from 'path';
import { 
  SearchEngine, 
  getSearchEngine, 
  initializeSearchEngine,
  SearchConfiguration,
  SearchQuery,
  SearchResponse,
  SearchEngineError,
} from '@flow-desk/shared/search-engine';

// Import Rust engine
import { createRustEngine, type NapiSearchResult } from '@flow-desk/shared-rust/typescript-wrapper';

export class MainSearchService {
  private searchEngine: SearchEngine;
  private rustEngine = createRustEngine();
  private initialized = false;

  constructor() {
    this.searchEngine = getSearchEngine();
  }

  /**
   * Initialize the search service
   */
  async initialize(): Promise<void> {
    try {
      const userDataPath = app.getPath('userData');
      const indexDir = join(userDataPath, 'search-indices');

      const config: SearchConfiguration = {
        global: {
          maxResults: 100,
          timeout: 5000, // 5 seconds
          caching: true,
          cacheTtl: 300, // 5 minutes
          analytics: true,
        },
        indexing: {
          batchSize: 100,
          refreshInterval: 60, // 1 minute
          maxIndexSize: 1024 * 1024 * 1024, // 1GB
          optimizationSchedule: '0 2 * * *', // Daily at 2 AM
        },
        providers: {
          maxConcurrent: 5,
          timeout: 3000,
          retryAttempts: 3,
          backoffMultiplier: 2,
        },
      };

      await initializeSearchEngine(config);
      this.initialized = true;

      console.log('Search service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize search service:', error);
      throw error;
    }
  }

  /**
   * Execute a search query
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    this.ensureInitialized();
    
    try {
      return await this.searchEngine.search(query);
    } catch (error) {
      console.error('Search failed:', error);
      if (error instanceof SearchEngineError) {
        throw error;
      }
      throw new SearchEngineError(`Search failed: ${error}`);
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(document: any): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.searchEngine.indexDocument(document);
    } catch (error) {
      console.error('Document indexing failed:', error);
      throw new SearchEngineError(`Document indexing failed: ${error}`);
    }
  }

  /**
   * Index multiple documents
   */
  async indexDocuments(documents: any[]): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await this.searchEngine.indexDocuments(documents);
    } catch (error) {
      console.error('Batch document indexing failed:', error);
      throw new SearchEngineError(`Batch document indexing failed: ${error}`);
    }
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      return await this.searchEngine.deleteDocument(documentId);
    } catch (error) {
      console.error('Document deletion failed:', error);
      throw new SearchEngineError(`Document deletion failed: ${error}`);
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      return await this.searchEngine.getSuggestions(partialQuery, limit);
    } catch (error) {
      console.error('Getting suggestions failed:', error);
      return []; // Return empty array on error for suggestions
    }
  }

  /**
   * Get search analytics
   */
  async getAnalytics() {
    this.ensureInitialized();
    
    try {
      return await this.searchEngine.getAnalytics();
    } catch (error) {
      console.error('Getting analytics failed:', error);
      throw new SearchEngineError(`Getting analytics failed: ${error}`);
    }
  }

  /**
   * Optimize search indices
   */
  async optimizeIndices(): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.searchEngine.optimizeIndices();
    } catch (error) {
      console.error('Index optimization failed:', error);
      throw new SearchEngineError(`Index optimization failed: ${error}`);
    }
  }

  /**
   * Clear search cache
   */
  async clearCache(): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.searchEngine.clearCache();
    } catch (error) {
      console.error('Cache clearing failed:', error);
      throw new SearchEngineError(`Cache clearing failed: ${error}`);
    }
  }

  /**
   * Check if search service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new SearchEngineError('Search service not initialized', 'NOT_INITIALIZED');
    }
  }
}

// Export singleton instance
let searchServiceInstance: MainSearchService | null = null;

export function getSearchService(): MainSearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new MainSearchService();
  }
  return searchServiceInstance;
}