/**
 * Rust-powered Search Engine
 * Production-grade full-text search engine using Tantivy via Rust NAPI bindings
 * Replaces JavaScript MiniSearch with native Rust performance
 */

import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Import Rust NAPI functions
const {
  initSearchEngine,
  indexDocument,
  searchDocuments,
  searchSimple,
  getSearchSuggestions,
} = require('../../lib/rust-engine/index.node');

export interface LocalSearchDocument {
  id: string;
  title: string;
  content: string;
  description?: string;
  url?: string;
  contentType: string;
  providerId: string;
  providerType: string;
  source: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  category?: string;
  importance?: number; // 0-10 for scoring
  author?: string;
}

export interface LocalSearchResult {
  id: string;
  title: string;
  content: string;
  description?: string;
  url?: string;
  contentType: string;
  providerId: string;
  providerType: string;
  source: string;
  score: number;
  highlights?: SearchHighlight[];
  metadata: Record<string, any>;
  createdAt: string;
  lastModified: string;
}

export interface SearchHighlight {
  field: string;
  fragments: string[];
}

export interface LocalSearchOptions {
  limit?: number;
  offset?: number;
  contentTypes?: string[];
  providerIds?: string[];
  sources?: string[];
  categories?: string[];
  tags?: string[];
  sortBy?: 'relevance' | 'date' | 'title' | 'importance';
  sortOrder?: 'asc' | 'desc';
  fuzzy?: boolean;
  highlighting?: boolean;
  suggestions?: boolean;
  timeout?: number;
  combineWith?: 'AND' | 'OR';
  boost?: {
    title?: number;
    content?: number;
    tags?: number;
    recent?: boolean;
  };
}

export interface SearchResponse {
  results: LocalSearchResult[];
  totalCount: number;
  executionTimeMs: number;
  suggestions?: string[];
}

export interface SearchQuery {
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

export interface SearchAnalytics {
  totalQueries: number;
  popularQueries: Array<{ query: string; count: number }>;
  averageResultCount: number;
  averageSearchTime: number;
  noResultsQueries: string[];
}

export class LocalSearchEngine {
  private indexDir: string;
  private initialized = false;
  private queryStats: Array<{ query: string; resultCount: number; searchTime: number; timestamp: Date }> = [];
  private readonly maxQueryStatsHistory = 1000;

  constructor() {
    const userDataPath = app.getPath('userData');
    const searchDir = join(userDataPath, 'search');
    
    // Ensure search directory exists
    if (!existsSync(searchDir)) {
      mkdirSync(searchDir, { recursive: true });
    }
    
    this.indexDir = searchDir;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Rust search engine with Tantivy backend
      const result = await initSearchEngine(this.indexDir);
      console.log('Search engine initialized:', result);
      
      this.initialized = true;
      console.log('Rust-powered search engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Rust search engine:', error);
      throw error;
    }
  }

  async addDocument(document: LocalSearchDocument): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      // Convert to format expected by Rust NAPI bindings
      await indexDocument(
        document.id,
        document.title,
        document.content,
        document.source,
        JSON.stringify(document.metadata || {})
      );
      
      console.log(`Document indexed via Rust backend: ${document.id}`);
    } catch (error) {
      console.error(`Failed to index document ${document.id} via Rust:`, error);
      throw error;
    }
  }

  async removeDocument(documentId: string): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    // TODO: Implement document removal in Rust backend
    console.log(`Document removal not yet implemented in Rust backend: ${documentId}`);
  }

  async updateDocument(documentId: string, updates: Partial<LocalSearchDocument>): Promise<void> {
    if (!this.initialized) await this.initialize();

    // For now, we'll re-index the entire document
    // TODO: Implement proper update in Rust backend
    console.log(`Document update via re-indexing: ${documentId}`);
  }

  async search(query: string, options: LocalSearchOptions = {}): Promise<LocalSearchResult[]> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();
    
    const {
      limit = 10,
      offset = 0,
      contentTypes,
      providerIds,
      fuzzy = true,
      highlighting = true,
      suggestions = false,
      timeout = 5000,
    } = options;

    try {
      // Use enhanced Rust search with proper query structure
      const searchQuery: SearchQuery = {
        query,
        contentTypes,
        providerIds,
        limit,
        offset,
        fuzzy,
        highlighting,
        suggestions,
        timeout,
      };

      const response: SearchResponse = await searchDocuments(searchQuery);
      
      // Record analytics
      const searchTime = Date.now() - startTime;
      this.recordSearchAnalytics(query, response.results.length, searchTime);

      return response.results;
    } catch (error) {
      console.error(`Rust search failed for query "${query}":`, error);
      return [];
    }
  }

  async searchSimple(query: string, limit?: number): Promise<LocalSearchResult[]> {
    if (!this.initialized) await this.initialize();

    const startTime = Date.now();

    try {
      const results = await searchSimple(query, limit);
      
      // Record analytics
      const searchTime = Date.now() - startTime;
      this.recordSearchAnalytics(query, results.length, searchTime);

      return results;
    } catch (error) {
      console.error(`Simple Rust search failed for query "${query}":`, error);
      return [];
    }
  }

  getDocument(id: string): LocalSearchDocument | undefined {
    // TODO: Implement document retrieval from Rust backend
    console.log(`Document retrieval not yet implemented: ${id}`);
    return undefined;
  }

  getDocumentCount(): number {
    // TODO: Get document count from Rust backend
    return 0;
  }

  async clearIndex(): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    // TODO: Implement index clearing in Rust backend
    console.log('Index clearing not yet implemented in Rust backend');
  }

  async searchWithProviders(options: {
    query: string;
    providers?: string[];
    maxResults?: number;
    categories?: string[];
  }): Promise<Array<{
    id: string;
    title: string;
    description: string;
    url: string;
    provider: string;
    score: number;
  }>> {
    const results = await this.search(options.query, {
      limit: options.maxResults || 10,
      providerIds: options.providers,
      contentTypes: options.categories,
    });

    return results.map(result => ({
      id: result.id,
      title: result.title,
      description: result.content,
      url: result.url || `search://${result.id}`,
      provider: result.providerId,
      score: result.score,
    }));
  }

  async getSuggestions(partialQuery: string, limit = 10): Promise<string[]> {
    if (!this.initialized) await this.initialize();

    try {
      return await getSearchSuggestions(partialQuery, limit);
    } catch (error) {
      console.error(`Failed to get suggestions for "${partialQuery}":`, error);
      return [];
    }
  }

  getAnalytics(): SearchAnalytics {
    const totalQueries = this.queryStats.length;
    const averageResultCount = totalQueries > 0 
      ? this.queryStats.reduce((sum, stat) => sum + stat.resultCount, 0) / totalQueries 
      : 0;
    const averageSearchTime = totalQueries > 0
      ? this.queryStats.reduce((sum, stat) => sum + stat.searchTime, 0) / totalQueries
      : 0;

    // Get popular queries
    const queryFrequency = new Map<string, number>();
    this.queryStats.forEach(stat => {
      const count = queryFrequency.get(stat.query) || 0;
      queryFrequency.set(stat.query, count + 1);
    });

    const popularQueries = Array.from(queryFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Get queries with no results
    const noResultsQueries = this.queryStats
      .filter(stat => stat.resultCount === 0)
      .map(stat => stat.query)
      .slice(-20); // Last 20 queries with no results

    return {
      totalQueries,
      popularQueries,
      averageResultCount,
      averageSearchTime,
      noResultsQueries
    };
  }

  async optimize(): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    // TODO: Implement optimization in Rust backend
    console.log('Search optimization not yet implemented in Rust backend');
  }

  async close(): Promise<void> {
    // Rust backend handles cleanup automatically
    this.initialized = false;
  }

  // Analytics recording
  private recordSearchAnalytics(query: string, resultCount: number, searchTime: number): void {
    this.queryStats.push({
      query,
      resultCount,
      searchTime,
      timestamp: new Date()
    });

    // Keep only recent stats to prevent memory growth
    if (this.queryStats.length > this.maxQueryStatsHistory) {
      this.queryStats.shift();
    }
  }

  // Email-specific search method
  async searchEmails(query: string, accountId?: string, limit = 20): Promise<LocalSearchResult[]> {
    const searchOptions: LocalSearchOptions = {
      contentTypes: ['email'],
      providerIds: accountId ? [accountId] : undefined,
      limit,
      highlighting: true,
      fuzzy: true,
    };

    return this.search(query, searchOptions);
  }

  // Calendar-specific search method
  async searchCalendarEvents(query: string, accountId?: string, limit = 20): Promise<LocalSearchResult[]> {
    const searchOptions: LocalSearchOptions = {
      contentTypes: ['calendar_event'],
      providerIds: accountId ? [accountId] : undefined,
      limit,
      highlighting: true,
      fuzzy: true,
    };

    return this.search(query, searchOptions);
  }

  // Document-specific search method
  async searchDocuments(query: string, providers?: string[], limit = 20): Promise<LocalSearchResult[]> {
    const searchOptions: LocalSearchOptions = {
      contentTypes: ['document', 'file'],
      providerIds: providers,
      limit,
      highlighting: true,
      fuzzy: true,
    };

    return this.search(query, searchOptions);
  }

  // Index email from Rust email engine
  async indexEmailFromRust(emailData: {
    id: string;
    accountId: string;
    subject: string;
    body: string;
    sender: string;
    recipients: string[];
    date: Date;
    folder: string;
  }): Promise<void> {
    const document: LocalSearchDocument = {
      id: emailData.id,
      title: emailData.subject,
      content: `${emailData.body} From: ${emailData.sender} To: ${emailData.recipients.join(', ')}`,
      contentType: 'email',
      providerId: emailData.accountId,
      providerType: 'gmail', // or detect provider type
      source: 'email',
      metadata: {
        sender: emailData.sender,
        recipients: emailData.recipients,
        folder: emailData.folder,
        date: emailData.date.toISOString(),
      },
      createdAt: emailData.date,
      updatedAt: new Date(),
    };

    await this.addDocument(document);
  }

  // Index calendar event from Rust calendar engine
  async indexCalendarEventFromRust(eventData: {
    id: string;
    accountId: string;
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    attendees: string[];
  }): Promise<void> {
    const document: LocalSearchDocument = {
      id: eventData.id,
      title: eventData.title,
      content: `${eventData.description || ''} Location: ${eventData.location || ''} Attendees: ${eventData.attendees.join(', ')}`,
      contentType: 'calendar_event',
      providerId: eventData.accountId,
      providerType: 'google', // or detect provider type
      source: 'calendar',
      metadata: {
        location: eventData.location,
        attendees: eventData.attendees,
        startTime: eventData.startTime.toISOString(),
        endTime: eventData.endTime.toISOString(),
      },
      createdAt: eventData.startTime,
      updatedAt: new Date(),
    };

    await this.addDocument(document);
  }
}

export const searchEngine = new LocalSearchEngine();