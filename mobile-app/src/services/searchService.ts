/**
 * Mobile Search Service - React Native bridge to Rust search engine
 * Provides unified search across all data sources with <300ms performance
 */

import { NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundJob from 'react-native-background-job';
import { 
  SearchQuery, 
  SearchResult as SearchResultType, 
  SearchProvider,
  SearchAnalytics 
} from '../types/search';

interface NativeSearchModule {
  // Core search operations
  initialize(config: SearchConfig): Promise<boolean>;
  search(query: SearchQuery): Promise<SearchResponse>;
  indexDocument(document: SearchDocument): Promise<boolean>;
  indexDocuments(documents: SearchDocument[]): Promise<number>;
  deleteDocument(documentId: string): Promise<boolean>;
  
  // Analytics and optimization
  getAnalytics(): Promise<SearchAnalytics>;
  optimizeIndices(): Promise<boolean>;
  clearCache(): Promise<boolean>;
  
  // Provider management
  enableProvider(providerId: string): Promise<boolean>;
  disableProvider(providerId: string): Promise<boolean>;
  getProviderStatus(): Promise<ProviderStatus[]>;
  
  // Background indexing
  startBackgroundIndexing(): Promise<boolean>;
  stopBackgroundIndexing(): Promise<boolean>;
  getIndexingStatus(): Promise<IndexingStatus>;
  
  // Performance monitoring
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  setPerformanceTarget(targetMs: number): Promise<boolean>;
}

interface SearchConfig {
  indexDir: string;
  maxMemoryMb: number;
  targetResponseTimeMs: number;
  enableOfflineSearch: boolean;
  enableVoiceSearch: boolean;
  backgroundIndexingEnabled: boolean;
  providers: ProviderConfig[];
}

interface ProviderConfig {
  id: string;
  type: string;
  enabled: boolean;
  config: Record<string, any>;
}

interface SearchResponse {
  results: SearchResultType[];
  totalCount: number;
  executionTimeMs: number;
  fromCache: boolean;
  suggestions?: string[];
  facets?: SearchFacet[];
}

interface SearchFacet {
  field: string;
  values: FacetValue[];
}

interface FacetValue {
  value: string;
  count: number;
}

interface SearchDocument {
  id: string;
  title: string;
  content: string;
  contentType: string;
  providerId: string;
  metadata: Record<string, any>;
  url?: string;
}

interface ProviderStatus {
  id: string;
  enabled: boolean;
  healthy: boolean;
  lastSync?: Date;
  documentCount: number;
  errorRate: number;
}

interface IndexingStatus {
  isIndexing: boolean;
  progress: number;
  totalDocuments: number;
  indexedDocuments: number;
  currentProvider?: string;
  estimatedTimeRemaining?: number;
}

interface PerformanceMetrics {
  avgResponseTimeMs: number;
  targetResponseTimeMs: number;
  performanceCompliance: number;
  cacheHitRate: number;
  errorRate: number;
  healthScore: number;
}

// Get native module (would be implemented in native code)
const NativeSearch: NativeSearchModule = NativeModules.FlowDeskSearch || {
  // Mock implementation for development
  async initialize() { return true; },
  async search(query) { 
    await new Promise(resolve => setTimeout(resolve, 150));
    return { 
      results: [], 
      totalCount: 0, 
      executionTimeMs: 150,
      fromCache: false 
    }; 
  },
  async indexDocument() { return true; },
  async indexDocuments(docs) { return docs.length; },
  async deleteDocument() { return true; },
  async getAnalytics() { return {} as SearchAnalytics; },
  async optimizeIndices() { return true; },
  async clearCache() { return true; },
  async enableProvider() { return true; },
  async disableProvider() { return true; },
  async getProviderStatus() { return []; },
  async startBackgroundIndexing() { return true; },
  async stopBackgroundIndexing() { return true; },
  async getIndexingStatus() { 
    return { 
      isIndexing: false, 
      progress: 0, 
      totalDocuments: 0, 
      indexedDocuments: 0 
    }; 
  },
  async getPerformanceMetrics() {
    return {
      avgResponseTimeMs: 180,
      targetResponseTimeMs: 300,
      performanceCompliance: 95,
      cacheHitRate: 0.75,
      errorRate: 0.02,
      healthScore: 92
    };
  },
  async setPerformanceTarget() { return true; },
};

// Event emitter for real-time updates
const searchEventEmitter = new NativeEventEmitter(NativeModules.FlowDeskSearch);

export class MobileSearchService {
  private initialized = false;
  private indexingListeners: ((status: IndexingStatus) => void)[] = [];
  private performanceListeners: ((metrics: PerformanceMetrics) => void)[] = [];
  
  constructor() {
    this.setupEventListeners();
  }
  
  /**
   * Initialize the mobile search service
   */
  async initialize(): Promise<boolean> {
    try {
      // Get app directories for search indices
      const indexDir = await this.getIndexDirectory();
      
      const config: SearchConfig = {
        indexDir,
        maxMemoryMb: 256, // Conservative for mobile
        targetResponseTimeMs: 300,
        enableOfflineSearch: true,
        enableVoiceSearch: true,
        backgroundIndexingEnabled: true,
        providers: [
          {
            id: 'mail',
            type: 'mail',
            enabled: true,
            config: { syncFrequencyMinutes: 15 }
          },
          {
            id: 'calendar',
            type: 'calendar', 
            enabled: true,
            config: { syncFrequencyMinutes: 30 }
          },
          {
            id: 'contacts',
            type: 'contacts',
            enabled: true,
            config: { syncFrequencyMinutes: 60 }
          },
          {
            id: 'files',
            type: 'files',
            enabled: false, // Disabled by default due to storage concerns
            config: { maxFileSizeMB: 10 }
          }
        ]
      };
      
      const result = await NativeSearch.initialize(config);
      this.initialized = result;
      
      if (result) {
        // Start background indexing
        await this.startBackgroundIndexing();
        
        // Setup performance monitoring
        this.setupPerformanceMonitoring();
        
        console.log('Mobile search service initialized successfully');
      }
      
      return result;
    } catch (error) {
      console.error('Failed to initialize mobile search service:', error);
      return false;
    }
  }
  
  /**
   * Execute a search query with performance monitoring
   */
  async search(query: string, options: Partial<SearchQuery> = {}): Promise<SearchResponse> {
    if (!this.initialized) {
      throw new Error('Search service not initialized');
    }
    
    const startTime = Date.now();
    
    try {
      const searchQuery: SearchQuery = {
        query: query.trim(),
        contentTypes: options.contentTypes || [],
        providers: options.providers || [],
        limit: options.limit || 50,
        offset: options.offset || 0,
        options: {
          highlighting: true,
          suggestions: true,
          fuzzy: true,
          facets: true,
          timeout: 5000,
          useCache: true,
          cacheThreshold: 100, // Cache queries taking >100ms
          ...options.options
        }
      };
      
      const response = await NativeSearch.search(searchQuery);
      
      // Performance monitoring
      const executionTime = Date.now() - startTime;
      if (executionTime > 300) {
        console.warn(`Search performance warning: ${executionTime}ms for query "${query}"`);
      }
      
      // Cache frequently searched queries
      if (!response.fromCache && response.results.length > 0) {
        await this.cacheSearchResults(query, response);
      }
      
      return response;
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }
  
  /**
   * Index a document for search
   */
  async indexDocument(document: SearchDocument): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }
    
    try {
      return await NativeSearch.indexDocument(document);
    } catch (error) {
      console.error('Document indexing failed:', error);
      return false;
    }
  }
  
  /**
   * Index multiple documents in batch
   */
  async indexDocuments(documents: SearchDocument[]): Promise<number> {
    if (!this.initialized) {
      return 0;
    }
    
    try {
      // Process in batches to avoid memory issues on mobile
      const batchSize = 50;
      let totalIndexed = 0;
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const indexed = await NativeSearch.indexDocuments(batch);
        totalIndexed += indexed;
        
        // Small delay between batches to prevent blocking
        if (i + batchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return totalIndexed;
    } catch (error) {
      console.error('Batch document indexing failed:', error);
      return 0;
    }
  }
  
  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(partialQuery: string): Promise<string[]> {
    if (!this.initialized || partialQuery.length < 2) {
      return [];
    }
    
    try {
      // Use cached suggestions for performance
      const cacheKey = `suggestions:${partialQuery.toLowerCase()}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        const { suggestions, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 300000) { // 5 minutes cache
          return suggestions;
        }
      }
      
      // Mock suggestion logic (would call native method)
      const suggestions = await this.generateSuggestions(partialQuery);
      
      // Cache suggestions
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        suggestions,
        timestamp: Date.now()
      }));
      
      return suggestions;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }
  
  /**
   * Voice search functionality
   */
  async startVoiceSearch(): Promise<string> {
    // Would integrate with React Native Voice library
    return new Promise((resolve, reject) => {
      // Mock voice recognition
      setTimeout(() => {
        resolve("sample voice query");
      }, 2000);
    });
  }
  
  /**
   * Get search analytics
   */
  async getAnalytics(): Promise<SearchAnalytics> {
    if (!this.initialized) {
      throw new Error('Search service not initialized');
    }
    
    return await NativeSearch.getAnalytics();
  }
  
  /**
   * Start background indexing
   */
  async startBackgroundIndexing(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }
    
    try {
      // Register background job for iOS/Android
      BackgroundJob.register({
        jobKey: 'searchIndexing',
        period: 900000, // 15 minutes
      });
      
      BackgroundJob.start({
        jobKey: 'searchIndexing',
        period: 900000,
      });
      
      return await NativeSearch.startBackgroundIndexing();
    } catch (error) {
      console.error('Failed to start background indexing:', error);
      return false;
    }
  }
  
  /**
   * Stop background indexing
   */
  async stopBackgroundIndexing(): Promise<boolean> {
    try {
      BackgroundJob.stop({ jobKey: 'searchIndexing' });
      return await NativeSearch.stopBackgroundIndexing();
    } catch (error) {
      console.error('Failed to stop background indexing:', error);
      return false;
    }
  }
  
  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    if (!this.initialized) {
      throw new Error('Search service not initialized');
    }
    
    return await NativeSearch.getPerformanceMetrics();
  }
  
  /**
   * Optimize search indices
   */
  async optimizeIndices(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }
    
    try {
      return await NativeSearch.optimizeIndices();
    } catch (error) {
      console.error('Index optimization failed:', error);
      return false;
    }
  }
  
  /**
   * Clear search cache
   */
  async clearCache(): Promise<boolean> {
    try {
      // Clear AsyncStorage cache
      const keys = await AsyncStorage.getAllKeys();
      const searchKeys = keys.filter(key => 
        key.startsWith('search:') || key.startsWith('suggestions:')
      );
      await AsyncStorage.multiRemove(searchKeys);
      
      // Clear native cache
      if (this.initialized) {
        return await NativeSearch.clearCache();
      }
      
      return true;
    } catch (error) {
      console.error('Cache clearing failed:', error);
      return false;
    }
  }
  
  /**
   * Add listener for indexing status updates
   */
  onIndexingStatusChange(listener: (status: IndexingStatus) => void): () => void {
    this.indexingListeners.push(listener);
    
    return () => {
      const index = this.indexingListeners.indexOf(listener);
      if (index > -1) {
        this.indexingListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * Add listener for performance metrics updates
   */
  onPerformanceUpdate(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.performanceListeners.push(listener);
    
    return () => {
      const index = this.performanceListeners.indexOf(listener);
      if (index > -1) {
        this.performanceListeners.splice(index, 1);
      }
    };
  }
  
  private async getIndexDirectory(): Promise<string> {
    // Would use RNFS or similar to get app's documents directory
    return '/app/documents/search_indices';
  }
  
  private async cacheSearchResults(query: string, response: SearchResponse): Promise<void> {
    try {
      const cacheKey = `search:${query.toLowerCase()}`;
      const cacheData = {
        response,
        timestamp: Date.now(),
        ttl: 300000 // 5 minutes
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to cache search results:', error);
    }
  }
  
  private async generateSuggestions(partialQuery: string): Promise<string[]> {
    // Mock implementation - would call native method
    const commonSuggestions = [
      'meeting', 'email', 'document', 'calendar', 'task', 
      'project', 'contact', 'file', 'note', 'message'
    ];
    
    return commonSuggestions
      .filter(s => s.toLowerCase().includes(partialQuery.toLowerCase()))
      .slice(0, 5);
  }
  
  private setupEventListeners(): void {
    // Listen for indexing status updates
    searchEventEmitter.addListener('indexingStatusChanged', (status: IndexingStatus) => {
      this.indexingListeners.forEach(listener => listener(status));
    });
    
    // Listen for performance metrics updates
    searchEventEmitter.addListener('performanceMetricsUpdated', (metrics: PerformanceMetrics) => {
      this.performanceListeners.forEach(listener => listener(metrics));
    });
  }
  
  private setupPerformanceMonitoring(): void {
    // Monitor performance every 5 minutes
    setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics();
        
        // Alert if performance degraded
        if (metrics.performanceCompliance < 80) {
          console.warn('Search performance degradation detected:', metrics);
        }
        
        // Auto-optimize if needed
        if (metrics.performanceCompliance < 60) {
          console.log('Starting automatic search optimization...');
          await this.optimizeIndices();
        }
      } catch (error) {
        console.error('Performance monitoring failed:', error);
      }
    }, 300000); // 5 minutes
  }
}

// Singleton instance
export const mobileSearchService = new MobileSearchService();

// Export types
export type {
  SearchConfig,
  SearchResponse,
  SearchDocument,
  ProviderStatus,
  IndexingStatus,
  PerformanceMetrics,
  SearchFacet,
  FacetValue
};