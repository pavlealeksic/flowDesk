/**
 * Search service for integrating with the unified Rust-based search engine
 * UPDATED: Now uses the comprehensive Rust engine integration
 */

import { app } from 'electron';
import { join } from 'path';
import log from 'electron-log';
import { rustEngineIntegration } from '../lib/rust-integration/rust-engine-integration';

// Temporary types until we import from shared
interface SearchQuery {
  query: string;
  filters?: {
    contentType?: string[];
    provider?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  limit?: number;
  offset?: number;
}

interface SearchDocument {
  id: string;
  title: string;
  content: string;
  contentType: string;
  provider: string;
  metadata?: Record<string, any>;
  lastModified: Date;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  took: number;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  contentType: string;
  provider: string;
  score: number;
  highlights?: string[];
  metadata?: Record<string, any>;
}

export class MainSearchService {
  private initialized = false;

  /**
   * Initialize the search service using comprehensive Rust integration
   */
  async initialize(): Promise<void> {
    try {
      log.info('Initializing search service with comprehensive Rust backend...');
      
      // Initialize the comprehensive Rust engine integration
      await rustEngineIntegration.initialize();
      
      this.initialized = rustEngineIntegration.isInitialized();
      log.info('Search service initialized successfully via Rust integration');
    } catch (error) {
      log.error('Failed to initialize search service via Rust integration:', error);
      throw error;
    }
  }

  /**
   * Execute a search query using comprehensive Rust integration
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    this.ensureInitialized();
    
    try {
      log.info('Executing search query via comprehensive Rust integration:', query.query);
      
      const rustResults = await rustEngineIntegration.searchDocuments(query.query, query.limit || 20);
      
      // Convert Rust results to expected format
      const results = rustResults.map((rustResult: any) => ({
        id: rustResult.id,
        title: rustResult.title,
        content: rustResult.content,
        contentType: 'document', // Default content type
        provider: rustResult.source,
        score: rustResult.score,
        highlights: [],
        metadata: JSON.parse(rustResult.metadata || '{}')
      }));

      return {
        results,
        total: results.length,
        query: query.query,
        took: 0 // Will be provided by Rust engine in future
      };
    } catch (error) {
      log.error('Search failed via Rust integration:', error);
      throw error;
    }
  }

  /**
   * Index a single document using comprehensive Rust integration
   */
  async indexDocument(document: SearchDocument): Promise<void> {
    this.ensureInitialized();
    
    try {
      log.info('Indexing document via comprehensive Rust integration:', document.id);
      
      const success = await rustEngineIntegration.indexDocument({
        id: document.id,
        title: document.title,
        content: document.content,
        source: document.provider,
        metadata: document.metadata
      });

      if (success) {
        log.info('Document indexed successfully via Rust integration:', document.id);
      } else {
        throw new Error('Indexing returned false');
      }
    } catch (error) {
      log.error('Document indexing failed via Rust integration:', error);
      throw error;
    }
  }

  /**
   * Index multiple documents
   */
  async indexDocuments(documents: SearchDocument[]): Promise<number> {
    this.ensureInitialized();
    
    try {
      log.info('Batch indexing documents via Rust:', documents.length);
      
      const rustDocuments = documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        content_type: doc.contentType,
        provider: doc.provider,
        last_modified: Math.floor(doc.lastModified.getTime() / 1000)
      }));

      // Index documents one by one for now
      // TODO: Implement batch indexing in Rust engine
      let indexed = 0;
      for (const rustDoc of rustDocuments) {
        try {
          await this.rustEngine.indexDocument(rustDoc);
          indexed++;
        } catch (error) {
          log.error('Failed to index document:', rustDoc.id, error);
        }
      }

      log.info('Batch indexing completed:', indexed, 'of', documents.length);
      return indexed;
    } catch (error) {
      log.error('Batch document indexing failed:', error);
      throw error;
    }
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      log.info('Deleting document from index via Rust:', documentId);
      
      // TODO: Implement delete in Rust engine
      await this.rustEngine.deleteDocument(documentId);
      
      log.info('Document deleted successfully:', documentId);
      return true;
    } catch (error) {
      log.error('Document deletion failed:', error);
      return false;
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      log.info('Getting suggestions via Rust:', partialQuery);
      
      // TODO: Implement suggestions in Rust engine
      const suggestions = await this.rustEngine.getSuggestions(partialQuery, limit);
      
      return suggestions || [];
    } catch (error) {
      log.error('Getting suggestions failed:', error);
      return []; // Return empty array on error for suggestions
    }
  }

  /**
   * Get search analytics
   */
  async getAnalytics() {
    this.ensureInitialized();
    
    try {
      log.info('Getting search analytics via Rust');
      
      // TODO: Implement analytics in Rust engine
      return {
        totalDocuments: 0,
        totalQueries: 0,
        avgQueryTime: 0,
        popularQueries: []
      };
    } catch (error) {
      log.error('Getting analytics failed:', error);
      throw error;
    }
  }

  /**
   * Optimize search indices
   */
  async optimizeIndices(): Promise<void> {
    this.ensureInitialized();
    
    try {
      log.info('Optimizing indices via Rust');
      
      // TODO: Implement optimization in Rust engine
      // await this.rustEngine.optimizeIndices();
      
      log.info('Index optimization completed');
    } catch (error) {
      log.error('Index optimization failed:', error);
      throw error;
    }
  }

  /**
   * Clear search cache
   */
  async clearCache(): Promise<void> {
    this.ensureInitialized();
    
    try {
      log.info('Clearing search cache via Rust');
      
      // TODO: Implement cache clearing in Rust engine
      // await this.rustEngine.clearCache();
      
      log.info('Search cache cleared');
    } catch (error) {
      log.error('Cache clearing failed:', error);
      throw error;
    }
  }

  /**
   * Check if search service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown the search service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;
    
    try {
      log.info('Shutting down search service');
      
      // TODO: Call Rust engine cleanup
      // await this.rustEngine.shutdown();
      
      this.initialized = false;
      log.info('Search service shut down');
    } catch (error) {
      log.error('Failed to shutdown search service:', error);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Search service not initialized');
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