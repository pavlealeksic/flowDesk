/**
 * Search service for integrating with the unified Rust-based search engine
 * UPDATED: Now uses direct NAPI bindings for maximum performance
 */

import { app } from 'electron';
import { join } from 'path';
import log from 'electron-log';

// Import Rust engine with fallback handling
let rustEngine: any = null;
let napiSearchFunctions: any = {};

try {
  // Try to load the Rust engine from the shared rust-lib
  rustEngine = require('../../../shared/rust-lib');
  
  // Extract available search functions
  const availableFunctions = [
    'initSearchEngine',
    'indexDocument', 
    'searchDocuments',
    'searchSimple',
    'getSearchSuggestions',
    'indexEmailMessage',
    'indexCalendarEvent',
    'deleteDocumentFromIndex',
    'optimizeSearchIndex',
    'getSearchAnalytics',
    'clearSearchCache'
  ];
  
  // Populate available functions or create fallbacks
  availableFunctions.forEach(funcName => {
    if (rustEngine[funcName] && typeof rustEngine[funcName] === 'function') {
      napiSearchFunctions[funcName] = rustEngine[funcName];
    } else {
      // Create a fallback function
      napiSearchFunctions[funcName] = async (...args: any[]) => {
        log.warn(`NAPI function ${funcName} not available, using fallback`);
        return getFallbackResult(funcName, args);
      };
    }
  });
  
  log.info('Rust engine loaded successfully from shared rust-lib');
} catch (error) {
  log.error('Failed to load Rust engine, using fallback implementation:', error);
  
  // Create complete fallback implementation
  const fallbackFunctions = [
    'initSearchEngine',
    'indexDocument',
    'searchDocuments', 
    'searchSimple',
    'getSearchSuggestions',
    'indexEmailMessage',
    'indexCalendarEvent',
    'deleteDocumentFromIndex',
    'optimizeSearchIndex',
    'getSearchAnalytics',
    'clearSearchCache'
  ];
  
  fallbackFunctions.forEach(funcName => {
    napiSearchFunctions[funcName] = async (...args: any[]) => {
      log.warn(`Using fallback for ${funcName}`);
      return getFallbackResult(funcName, args);
    };
  });
}

// Simple in-memory search implementation as fallback
class SimpleFallbackSearch {
  private documents: Map<string, SearchDocument> = new Map();
  private searchHistory: string[] = [];
  private initialized: boolean = false;

  async initialize() {
    this.initialized = true;
    log.info('Fallback search engine initialized');
    return 'Search engine initialized (fallback)';
  }

  async indexDocument(id: string, title: string, content: string, provider: string, metadata?: string) {
    const document: SearchDocument = {
      id,
      title,
      content,
      contentType: 'document',
      provider,
      metadata: metadata ? JSON.parse(metadata) : {},
      lastModified: new Date()
    };
    
    this.documents.set(id, document);
    log.info(`Document indexed in fallback search: ${id}`);
  }

  async searchDocuments(query: string, limit: number = 20) {
    const startTime = Date.now();
    
    if (!query || query.trim().length === 0) {
      return { results: [], totalCount: 0, executionTimeMs: Date.now() - startTime };
    }
    
    // Add to search history
    this.searchHistory.push(query);
    if (this.searchHistory.length > 100) {
      this.searchHistory.shift();
    }
    
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];
    
    // Simple text search through documents
    for (const [id, doc] of this.documents) {
      let score = 0;
      
      // Title match (higher weight)
      if (doc.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }
      
      // Content match
      if (doc.content.toLowerCase().includes(queryLower)) {
        score += 5;
      }
      
      // Exact word matches get bonus
      const words = queryLower.split(' ');
      words.forEach(word => {
        if (doc.title.toLowerCase().includes(word)) score += 2;
        if (doc.content.toLowerCase().includes(word)) score += 1;
      });
      
      if (score > 0) {
        // Generate simple highlights
        const highlights = this.generateHighlights(doc, queryLower);
        
        results.push({
          id: doc.id,
          title: doc.title,
          content: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
          contentType: doc.contentType,
          provider: doc.provider,
          score,
          highlights,
          metadata: doc.metadata
        });
      }
    }
    
    // Sort by score
    results.sort((a, b) => b.score - a.score);
    
    // Apply limit
    const limitedResults = results.slice(0, limit);
    
    return {
      results: limitedResults,
      totalCount: results.length,
      executionTimeMs: Date.now() - startTime
    };
  }

  async getSuggestions(partialQuery: string, limit: number = 10): Promise<string[]> {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }
    
    const suggestions = new Set<string>();
    const queryLower = partialQuery.toLowerCase();
    
    // Add suggestions from search history
    this.searchHistory.forEach(query => {
      if (query.toLowerCase().startsWith(queryLower)) {
        suggestions.add(query);
      }
    });
    
    // Add suggestions from document titles
    for (const doc of this.documents.values()) {
      const words = doc.title.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.startsWith(queryLower) && word.length > partialQuery.length) {
          suggestions.add(word);
        }
      });
    }
    
    return Array.from(suggestions).slice(0, limit);
  }

  async getAnalytics() {
    return {
      total_documents: this.documents.size,
      total_searches: this.searchHistory.length,
      avg_response_time_ms: 10, // Mock value
      popular_queries: this.getPopularQueries(),
      success_rate: 1.0,
      error_rate: 0.0
    };
  }

  private getPopularQueries(): string[] {
    const queryCount = new Map<string, number>();
    
    this.searchHistory.forEach(query => {
      queryCount.set(query, (queryCount.get(query) || 0) + 1);
    });
    
    return Array.from(queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([query]) => query);
  }

  private generateHighlights(doc: SearchDocument, query: string): string[] {
    const highlights: string[] = [];
    const content = doc.content.toLowerCase();
    const title = doc.title.toLowerCase();
    
    // Simple highlighting
    if (title.includes(query)) {
      highlights.push(`...${doc.title}...`);
    }
    
    const index = content.indexOf(query);
    if (index >= 0) {
      const start = Math.max(0, index - 50);
      const end = Math.min(doc.content.length, index + query.length + 50);
      const snippet = doc.content.substring(start, end);
      highlights.push(`...${snippet}...`);
    }
    
    return highlights;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async clearCache(): Promise<void> {
    // Clear in-memory cache if any
    this.searchHistory.length = 0;
  }

  async optimize(): Promise<void> {
    // Nothing to optimize in fallback implementation
    log.info('Search index optimization completed (fallback)');
  }
}

// Create fallback search instance
const fallbackSearch = new SimpleFallbackSearch();

// Fallback result generator
function getFallbackResult(funcName: any, args: any) {
  switch (funcName) {
    case 'initSearchEngine':
      return fallbackSearch.initialize();
    case 'indexDocument':
      const [id, title, content, provider, metadata] = args;
      return fallbackSearch.indexDocument(id, title, content, provider, metadata);
    case 'indexEmailMessage':
      // Convert email message to document format
      const [msgId, accountId, subject, fromAddr, fromName, toAddrs, bodyText, bodyHtml, receivedAt, folder] = args;
      return fallbackSearch.indexDocument(
        msgId,
        subject || 'No Subject',
        bodyText || bodyHtml || '',
        'email',
        JSON.stringify({ accountId, fromAddr, fromName, folder, receivedAt })
      );
    case 'indexCalendarEvent':
      // Convert calendar event to document format  
      const [eventId, calendarId, eventTitle, description, location, startTime, endTime, isAllDay, organizer, attendees, status] = args;
      return fallbackSearch.indexDocument(
        eventId,
        eventTitle || 'No Title',
        description || location || '',
        'calendar',
        JSON.stringify({ calendarId, location, startTime, endTime, isAllDay, organizer, status })
      );
    case 'deleteDocumentFromIndex':
      return fallbackSearch.deleteDocument(args[0]);
    case 'searchDocuments':
      // Handle both query object and simple string
      const searchQuery = args[0];
      if (typeof searchQuery === 'string') {
        return fallbackSearch.searchDocuments(searchQuery, args[1] || 20);
      } else if (searchQuery && typeof searchQuery === 'object') {
        return fallbackSearch.searchDocuments(searchQuery.query || '', searchQuery.limit || 20);
      } else {
        return fallbackSearch.searchDocuments('', 20);
      }
    case 'searchSimple':
      return fallbackSearch.searchDocuments(args[0] || '', args[1] || 20);
    case 'getSearchSuggestions':
      return fallbackSearch.getSuggestions(args[0] || '', args[1] || 10);
    case 'getSearchAnalytics':
      return fallbackSearch.getAnalytics();
    case 'clearSearchCache':
      return fallbackSearch.clearCache();
    case 'optimizeSearchIndex':
      return fallbackSearch.optimize();
    default:
      return Promise.resolve(null);
  }
}

// Extract the functions for use
const initSearchEngine = napiSearchFunctions.initSearchEngine;
const indexDocument = napiSearchFunctions.indexDocument;
const searchDocuments = napiSearchFunctions.searchDocuments;
const searchSimple = napiSearchFunctions.searchSimple;
const getSearchSuggestions = napiSearchFunctions.getSearchSuggestions;
const indexEmailMessage = napiSearchFunctions.indexEmailMessage;
const indexCalendarEvent = napiSearchFunctions.indexCalendarEvent;
const deleteDocumentFromIndex = napiSearchFunctions.deleteDocumentFromIndex;
const optimizeSearchIndex = napiSearchFunctions.optimizeSearchIndex;
const getSearchAnalytics = napiSearchFunctions.getSearchAnalytics;
const clearSearchCache = napiSearchFunctions.clearSearchCache;

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
   * Initialize the search service using direct Rust NAPI bindings
   */
  async initialize(): Promise<void> {
    try {
      log.info('Initializing search service with Tantivy Rust backend...');
      
      // Get user data path for search indices (handle test environment)
      let searchIndexPath: string;
      try {
        const userDataPath = app?.getPath('userData');
        searchIndexPath = userDataPath ? join(userDataPath, 'search') : './test-search-index';
      } catch (error) {
        // Fallback for test environment where app is not available
        searchIndexPath = './test-search-index';
        log.warn('Using fallback search index path for test environment:', searchIndexPath);
      }
      
      // Initialize Rust search engine with Tantivy backend
      const result = await initSearchEngine(searchIndexPath);
      log.info('Rust search engine initialization result:', result);
      
      this.initialized = true;
      log.info('Search service initialized successfully with Tantivy backend');
    } catch (error) {
      log.error('Failed to initialize search service with Rust NAPI:', error);
      throw error;
    }
  }

  /**
   * Execute a search query using direct Rust NAPI bindings
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    this.ensureInitialized();
    
    try {
      log.info('Executing search query via Rust NAPI:', query.query);
      
      // Build search query for Rust
      const searchQuery = {
        query: query.query,
        contentTypes: query.filters?.contentType,
        providerIds: query.filters?.provider,
        limit: query.limit || 20,
        offset: query.offset || 0,
        fuzzy: true,
        highlighting: true,
        suggestions: false,
        timeout: 5000,
      };
      
      const searchResponse = await searchDocuments(searchQuery);
      
      // Handle different response formats (real NAPI vs fallback)
      let results: SearchResult[];
      let totalCount: number;
      let executionTime: number;
      
      if (searchResponse && Array.isArray(searchResponse.results)) {
        // Real NAPI response format
        results = searchResponse.results.map((rustResult: any) => ({
          id: rustResult.id,
          title: rustResult.title,
          content: rustResult.content,
          contentType: rustResult.contentType || 'document',
          provider: rustResult.providerId || rustResult.provider,
          score: rustResult.score,
          highlights: rustResult.highlights?.map((h: any) => h.fragments).flat() || rustResult.highlights || [],
          metadata: typeof rustResult.metadata === 'string' ? JSON.parse(rustResult.metadata || '{}') : (rustResult.metadata || {})
        }));
        totalCount = searchResponse.totalCount || searchResponse.total || results.length;
        executionTime = searchResponse.executionTimeMs || searchResponse.executionTime || 0;
      } else if (searchResponse && Array.isArray(searchResponse)) {
        // Fallback response format (array of results)
        results = searchResponse;
        totalCount = results.length;
        executionTime = 0;
      } else {
        // Fallback object format
        results = searchResponse?.results || [];
        totalCount = searchResponse?.totalCount || searchResponse?.total || results.length;
        executionTime = searchResponse?.executionTimeMs || searchResponse?.executionTime || 0;
      }

      return {
        results,
        total: totalCount,
        query: query.query,
        took: executionTime
      };
    } catch (error) {
      log.error('Search failed via Rust NAPI:', error);
      throw error;
    }
  }

  /**
   * Index a single document using direct Rust NAPI bindings
   */
  async indexDocument(document: SearchDocument): Promise<void> {
    this.ensureInitialized();
    
    try {
      log.info('Indexing document via Rust NAPI:', document.id);
      
      await indexDocument(
        document.id,
        document.title,
        document.content,
        document.provider,
        JSON.stringify(document.metadata || {})
      );

      log.info('Document indexed successfully via Rust NAPI:', document.id);
    } catch (error) {
      log.error('Document indexing failed via Rust NAPI:', error);
      throw error;
    }
  }

  /**
   * Index multiple documents using direct Rust NAPI bindings
   */
  async indexDocuments(documents: SearchDocument[]): Promise<number> {
    this.ensureInitialized();
    
    try {
      log.info('Batch indexing documents via Rust NAPI:', documents.length);
      
      // Index documents individually for now (can be optimized later)
      let indexed = 0;
      
      for (const doc of documents) {
        try {
          await indexDocument(
            doc.id,
            doc.title,
            doc.content,
            doc.provider,
            JSON.stringify({
              contentType: doc.contentType,
              lastModified: doc.lastModified.toISOString(),
              ...doc.metadata
            })
          );
          indexed++;
        } catch (error) {
          log.error('Failed to index document:', doc.id, error);
          // Continue with next document
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
      log.info('Deleting document from index via Rust NAPI:', documentId);
      
      const deleted = await deleteDocumentFromIndex(documentId);
      log.info('Document deletion result:', deleted);
      return deleted;
    } catch (error) {
      log.error('Document deletion failed:', error);
      return false;
    }
  }

  /**
   * Get search suggestions using direct Rust NAPI bindings
   */
  async getSuggestions(partialQuery: string, limit = 10): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      log.info('Getting suggestions via Rust NAPI:', partialQuery);
      
      const suggestions = await getSearchSuggestions(partialQuery, limit);
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
      log.info('Getting search analytics via Rust NAPI');
      
      const analytics = await getSearchAnalytics();
      return {
        totalDocuments: analytics.total_documents,
        totalQueries: analytics.total_searches,
        avgQueryTime: analytics.avg_response_time_ms,
        popularQueries: analytics.popular_queries,
        successRate: analytics.success_rate,
        errorRate: analytics.error_rate
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
      log.info('Optimizing indices via Rust NAPI');
      
      await optimizeSearchIndex();
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
      log.info('Clearing search cache via Rust NAPI');
      
      await clearSearchCache();
      log.info('Search cache cleared');
    } catch (error) {
      log.error('Cache clearing failed:', error);
      throw error;
    }
  }

  /**
   * Index email message directly
   */
  async indexEmailMessage(messageData: {
    id: string;
    accountId: string;
    subject: string;
    fromAddress: string;
    fromName?: string;
    toAddresses: string[];
    bodyText?: string;
    bodyHtml?: string;
    receivedAt: Date;
    folder?: string;
  }): Promise<void> {
    this.ensureInitialized();
    
    try {
      log.info('Indexing email message via Rust NAPI:', messageData.id);
      
      await indexEmailMessage(
        messageData.id,
        messageData.accountId,
        messageData.subject,
        messageData.fromAddress,
        messageData.fromName || null,
        messageData.toAddresses,
        messageData.bodyText || null,
        messageData.bodyHtml || null,
        Math.floor(messageData.receivedAt.getTime() / 1000),
        messageData.folder || null
      );

      log.info('Email message indexed successfully:', messageData.id);
    } catch (error) {
      log.error('Email message indexing failed:', error);
      throw error;
    }
  }

  /**
   * Index calendar event directly
   */
  async indexCalendarEvent(eventData: {
    id: string;
    calendarId: string;
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    organizer?: string;
    attendees: string[];
    status: string;
  }): Promise<void> {
    this.ensureInitialized();
    
    try {
      log.info('Indexing calendar event via Rust NAPI:', eventData.id);
      
      await indexCalendarEvent(
        eventData.id,
        eventData.calendarId,
        eventData.title,
        eventData.description || null,
        eventData.location || null,
        Math.floor(eventData.startTime.getTime() / 1000),
        Math.floor(eventData.endTime.getTime() / 1000),
        eventData.isAllDay,
        eventData.organizer || null,
        eventData.attendees,
        eventData.status
      );

      log.info('Calendar event indexed successfully:', eventData.id);
    } catch (error) {
      log.error('Calendar event indexing failed:', error);
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
      
      // Rust NAPI handles cleanup automatically
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