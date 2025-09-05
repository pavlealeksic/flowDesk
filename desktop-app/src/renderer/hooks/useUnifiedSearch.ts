/**
 * React hook for unified search functionality
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  SearchQuery, 
  SearchDocument, 
  SearchResponse, 
  SearchAnalytics,
  ContentType,
  ProviderType 
} from '@flow-desk/shared';
import type { SearchOptions, SearchResult } from '../types/preload.d.ts';

// Logging stub for renderer process
const log = {
  error: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Search]', message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Search]', message, ...args);
    }
  },
  debug: () => {}, // No-op
};

interface UseUnifiedSearchOptions {
  autoInitialize?: boolean;
  debounceMs?: number;
  maxResults?: number;
  enableSuggestions?: boolean;
}

interface SearchState {
  isInitialized: boolean;
  isSearching: boolean;
  isIndexing: boolean;
  results: SearchResponse['results'];
  totalCount: number;
  executionTime: number;
  suggestions: string[];
  error: string | null;
  analytics: SearchAnalytics | null;
}

interface UseUnifiedSearchReturn extends SearchState {
  // Search operations
  search: (query: string, options?: Partial<SearchQuery>) => Promise<void>;
  clearResults: () => void;
  
  // Document operations
  indexDocument: (document: SearchDocument) => Promise<boolean>;
  indexDocuments: (documents: SearchDocument[]) => Promise<number>;
  deleteDocument: (documentId: string) => Promise<boolean>;
  
  // Suggestions
  getSuggestions: (partialQuery: string) => Promise<void>;
  
  // Analytics
  refreshAnalytics: () => Promise<void>;
  
  // Maintenance
  optimizeIndices: () => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  
  // Initialization
  initialize: () => Promise<boolean>;
}

export function useUnifiedSearch(options: UseUnifiedSearchOptions = {}): UseUnifiedSearchReturn {
  const {
    autoInitialize = true,
    debounceMs = 300,
    maxResults = 50,
    enableSuggestions = true,
  } = options;

  const [state, setState] = useState<SearchState>({
    isInitialized: false,
    isSearching: false,
    isIndexing: false,
    results: [],
    totalCount: 0,
    executionTime: 0,
    suggestions: [],
    error: null,
    analytics: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Initialize search engine
  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const result = await window.searchAPI.initialize();
      
      if (result.success) {
        setState(prev => ({ ...prev, isInitialized: true }));
        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Failed to initialize search engine' 
        }));
        return false;
      }
    } catch (error) {
      log.error('Search initialization error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
      return false;
    }
  }, []);

  // Execute search query
  const search = useCallback(async (query: string, queryOptions: Partial<SearchOptions> = {}): Promise<void> => {
    if (!state.isInitialized) {
      log.warn('Search engine not initialized');
      return;
    }

    if (!query.trim()) {
      setState(prev => ({ ...prev, results: [], totalCount: 0, suggestions: [] }));
      return;
    }

    // Cancel previous search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce search
    debounceTimerRef.current = setTimeout(async () => {
      setState(prev => ({ ...prev, isSearching: true, error: null }));

      try {
        const searchOptions: SearchOptions = {
          query,
          limit: maxResults,
          offset: 0,
          sources: queryOptions?.sources,
          filters: queryOptions?.filters,
        };

        const result = await window.searchAPI.search(searchOptions);

        if (result.success && result.data) {
          setState(prev => ({
            ...prev,
            results: result.data!.results,
            totalCount: result.data!.total,
            executionTime: 0, // executionTime not provided in current API
            suggestions: result.data!.suggestions || [],
            isSearching: false,
          }));
        } else {
          setState(prev => ({
            ...prev,
            error: result.error || 'Search failed',
            results: [],
            totalCount: 0,
            isSearching: false,
          }));
        }
      } catch (error) {
        log.error('Search error:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Search error',
          results: [],
          totalCount: 0,
          isSearching: false,
        }));
      }
    }, debounceMs);
  }, [state.isInitialized, maxResults, enableSuggestions, debounceMs]);

  // Clear search results
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      totalCount: 0,
      suggestions: [],
      executionTime: 0,
    }));
  }, []);

  // Index a single document
  const indexDocument = useCallback(async (document: SearchDocument): Promise<boolean> => {
    if (!state.isInitialized) {
      log.warn('Search engine not initialized');
      return false;
    }

    setState(prev => ({ ...prev, isIndexing: true, error: null }));

    try {
      // Convert SearchDocument to SearchResult format for API
      const searchResult: Partial<SearchResult> = {
        id: document.id,
        title: document.title,
        content: document.content,
        source: document.provider,
        type: document.contentType as 'email' | 'calendar' | 'contact' | 'file' | 'plugin' | 'command',
        metadata: document.metadata,
      };
      
      const result = await window.searchAPI.indexDocument(searchResult);
      
      setState(prev => ({ 
        ...prev, 
        isIndexing: false,
        error: result.success ? null : (result.error || 'Indexing failed')
      }));
      
      return result.success;
    } catch (error) {
      log.error('Document indexing error:', error);
      setState(prev => ({
        ...prev,
        isIndexing: false,
        error: error instanceof Error ? error.message : 'Indexing error',
      }));
      return false;
    }
  }, [state.isInitialized]);

  // Index multiple documents
  const indexDocuments = useCallback(async (documents: SearchDocument[]): Promise<number> => {
    if (!state.isInitialized) {
      log.warn('Search engine not initialized');
      return 0;
    }

    setState(prev => ({ ...prev, isIndexing: true, error: null }));

    try {
      if (!window.searchAPI.indexDocuments) {
        log.warn('Batch indexing not available');
        setState(prev => ({ ...prev, isIndexing: false }));
        return 0;
      }
      // Convert SearchDocument array to SearchResult array for API
      const searchResults: Partial<SearchResult>[] = documents.map(document => ({
        id: document.id,
        title: document.title,
        content: document.content,
        source: document.provider,
        type: document.contentType as 'email' | 'calendar' | 'contact' | 'file' | 'plugin' | 'command',
        metadata: document.metadata,
      }));
      
      const result = await window.searchAPI.indexDocuments(searchResults);
      
      setState(prev => ({ 
        ...prev, 
        isIndexing: false,
        error: result.success ? null : (result.error || 'Batch indexing failed')
      }));
      
      return result.success ? (result.data || 0) : 0;
    } catch (error) {
      log.error('Batch document indexing error:', error);
      setState(prev => ({
        ...prev,
        isIndexing: false,
        error: error instanceof Error ? error.message : 'Batch indexing error',
      }));
      return 0;
    }
  }, [state.isInitialized]);

  // Delete a document
  const deleteDocument = useCallback(async (documentId: string): Promise<boolean> => {
    if (!state.isInitialized) {
      log.warn('Search engine not initialized');
      return false;
    }

    try {
      if (!window.searchAPI.deleteDocument) {
        log.warn('Document deletion not available');
        return false;
      }
      const result = await window.searchAPI.deleteDocument(documentId);
      
      if (!result.success) {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Document deletion failed'
        }));
      }
      
      return result.success && (result.data || false);
    } catch (error) {
      log.error('Document deletion error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Document deletion error',
      }));
      return false;
    }
  }, [state.isInitialized]);

  // Get search suggestions
  const getSuggestions = useCallback(async (partialQuery: string): Promise<void> => {
    if (!state.isInitialized || !enableSuggestions) {
      return;
    }

    try {
      const result = await window.searchAPI.getSuggestions(partialQuery, 10);
      
      if (result.success) {
        setState(prev => ({ ...prev, suggestions: result.data || [] }));
      }
    } catch (error) {
      log.error('Suggestions error:', error);
      // Don't set error state for suggestions
    }
  }, [state.isInitialized, enableSuggestions]);

  // Refresh analytics
  const refreshAnalytics = useCallback(async (): Promise<void> => {
    if (!state.isInitialized) {
      return;
    }

    try {
      const result = await window.searchAPI.getAnalytics();
      
      if (result.success && result.data) {
        setState(prev => ({ ...prev, analytics: result.data as any as SearchAnalytics }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Failed to get analytics'
        }));
      }
    } catch (error) {
      log.error('Analytics error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Analytics error',
      }));
    }
  }, [state.isInitialized]);

  // Optimize indices
  const optimizeIndices = useCallback(async (): Promise<boolean> => {
    if (!state.isInitialized) {
      return false;
    }

    try {
      if (!window.searchAPI.optimizeIndices) {
        log.warn('Index optimization not available');
        return false;
      }
      const result = await window.searchAPI.optimizeIndices();
      
      if (!result.success) {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Index optimization failed'
        }));
      }
      
      if (!result.success) {
        setState(prev => ({
          ...prev,
          error: result.error || 'Index optimization failed'
        }));
        return false;
      }
      return true;
    } catch (error) {
      log.error('Index optimization error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Index optimization error',
      }));
      return false;
    }
  }, [state.isInitialized]);

  // Clear cache
  const clearCache = useCallback(async (): Promise<boolean> => {
    if (!state.isInitialized) {
      return false;
    }

    try {
      if (!window.searchAPI.clearCache) {
        log.warn('Cache clearing not available');
        return false;
      }
      const result = await window.searchAPI.clearCache();
      
      if (!result.success) {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Cache clearing failed'
        }));
        return false;
      }
      return true;
      
    } catch (error) {
      log.error('Cache clearing error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Cache clearing error',
      }));
      return false;
    }
  }, [state.isInitialized]);

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInitialize) {
      initialize();
    }
  }, [autoInitialize, initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    search,
    clearResults,
    indexDocument,
    indexDocuments,
    deleteDocument,
    getSuggestions,
    refreshAnalytics,
    optimizeIndices,
    clearCache,
    initialize,
  };
}