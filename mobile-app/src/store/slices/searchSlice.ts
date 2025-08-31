/**
 * Search Store Slice - Manages unified search across all data sources
 */

import { StateCreator } from 'zustand';

export interface SearchProvider {
  id: string;
  name: string;
  type: 'mail' | 'calendar' | 'files' | 'chat' | 'plugin';
  isEnabled: boolean;
  searchableFields: string[];
  lastIndexed?: Date;
}

export interface SearchResult {
  id: string;
  providerId: string;
  type: 'email' | 'event' | 'file' | 'message' | 'contact' | 'note';
  title: string;
  snippet: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  lastModified: Date;
  url?: string;
  iconUrl?: string;
}

export interface SearchQuery {
  id: string;
  query: string;
  filters: SearchFilters;
  timestamp: Date;
}

export interface SearchFilters {
  providers?: string[];
  types?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sender?: string;
  tags?: string[];
  workspaceId?: string;
}

export interface SearchIndex {
  totalDocuments: number;
  lastFullIndex?: Date;
  isIndexing: boolean;
  indexingProgress: number;
}

export interface SearchSlice {
  // State
  providers: SearchProvider[];
  results: SearchResult[];
  recentQueries: SearchQuery[];
  currentQuery: string;
  filters: SearchFilters;
  index: SearchIndex;
  isSearching: boolean;
  searchError: string | null;
  
  // Search operations
  search: (query: string, filters?: Partial<SearchFilters>) => Promise<void>;
  clearSearch: () => void;
  applyFilters: (filters: Partial<SearchFilters>) => void;
  
  // Provider management
  enableProvider: (providerId: string) => void;
  disableProvider: (providerId: string) => void;
  refreshProvider: (providerId: string) => Promise<void>;
  
  // Index management
  rebuildIndex: () => Promise<void>;
  getIndexStatus: () => SearchIndex;
  
  // Query history
  addToHistory: (query: SearchQuery) => void;
  clearHistory: () => void;
  removeFromHistory: (queryId: string) => void;
  
  // Utility functions
  getResultsByType: (type: string) => SearchResult[];
  getProviderResults: (providerId: string) => SearchResult[];
  getTopResults: (limit: number) => SearchResult[];
}

// Mock search implementation
class SearchEngine {
  static async search(query: string, providers: SearchProvider[], filters: SearchFilters): Promise<SearchResult[]> {
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (!query.trim()) {
      return [];
    }
    
    // Mock results based on query
    const mockResults: SearchResult[] = [
      {
        id: 'result_1',
        providerId: 'mail',
        type: 'email',
        title: `Email containing "${query}"`,
        snippet: `This is a sample email that contains the search term ${query}...`,
        metadata: {
          from: 'sender@example.com',
          date: new Date().toISOString(),
          folder: 'inbox',
        },
        relevanceScore: 0.95,
        lastModified: new Date(),
      },
      {
        id: 'result_2',
        providerId: 'calendar',
        type: 'event',
        title: `Meeting about ${query}`,
        snippet: `Calendar event discussing ${query} and related topics...`,
        metadata: {
          start: new Date().toISOString(),
          location: 'Conference Room A',
          attendees: ['user@example.com'],
        },
        relevanceScore: 0.85,
        lastModified: new Date(),
      },
    ];
    
    // Apply filters
    let filteredResults = mockResults;
    
    if (filters.types && filters.types.length > 0) {
      filteredResults = filteredResults.filter(r => filters.types!.includes(r.type));
    }
    
    if (filters.providers && filters.providers.length > 0) {
      filteredResults = filteredResults.filter(r => filters.providers!.includes(r.providerId));
    }
    
    return filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

export const createSearchStore: StateCreator<
  any,
  [],
  [],
  SearchSlice
> = (set, get) => ({
  // Initial state
  providers: [
    {
      id: 'mail',
      name: 'Mail',
      type: 'mail',
      isEnabled: true,
      searchableFields: ['subject', 'body', 'from', 'to'],
    },
    {
      id: 'calendar',
      name: 'Calendar',
      type: 'calendar',
      isEnabled: true,
      searchableFields: ['title', 'description', 'location', 'attendees'],
    },
    {
      id: 'files',
      name: 'Files',
      type: 'files',
      isEnabled: false,
      searchableFields: ['filename', 'content', 'tags'],
    },
  ],
  results: [],
  recentQueries: [],
  currentQuery: '',
  filters: {},
  index: {
    totalDocuments: 0,
    isIndexing: false,
    indexingProgress: 0,
  },
  isSearching: false,
  searchError: null,
  
  // Search operations
  search: async (query, additionalFilters = {}) => {
    if (!query.trim()) {
      get().clearSearch();
      return;
    }
    
    set((state: any) => {
      state.isSearching = true;
      state.searchError = null;
      state.currentQuery = query;
      state.filters = { ...state.filters, ...additionalFilters };
    });
    
    try {
      const enabledProviders = get().providers.filter(p => p.isEnabled);
      const results = await SearchEngine.search(query, enabledProviders, get().filters);
      
      set((state: any) => {
        state.results = results;
        state.isSearching = false;
      });
      
      // Add to history
      const searchQuery: SearchQuery = {
        id: `query_${Date.now()}`,
        query,
        filters: get().filters,
        timestamp: new Date(),
      };
      
      get().addToHistory(searchQuery);
    } catch (error) {
      console.error('Search error:', error);
      set((state: any) => {
        state.isSearching = false;
        state.searchError = error instanceof Error ? error.message : 'Search failed';
        state.results = [];
      });
    }
  },
  
  clearSearch: () => {
    set((state: any) => {
      state.results = [];
      state.currentQuery = '';
      state.filters = {};
      state.searchError = null;
    });
  },
  
  applyFilters: (newFilters) => {
    const currentQuery = get().currentQuery;
    if (currentQuery) {
      get().search(currentQuery, newFilters);
    } else {
      set((state: any) => {
        state.filters = { ...state.filters, ...newFilters };
      });
    }
  },
  
  // Provider management
  enableProvider: (providerId) => {
    set((state: any) => {
      const provider = state.providers.find((p: SearchProvider) => p.id === providerId);
      if (provider) {
        provider.isEnabled = true;
      }
    });
    
    // Re-search if there's an active query
    const currentQuery = get().currentQuery;
    if (currentQuery) {
      get().search(currentQuery);
    }
  },
  
  disableProvider: (providerId) => {
    set((state: any) => {
      const provider = state.providers.find((p: SearchProvider) => p.id === providerId);
      if (provider) {
        provider.isEnabled = false;
      }
      
      // Remove results from this provider
      state.results = state.results.filter((r: SearchResult) => r.providerId !== providerId);
    });
  },
  
  refreshProvider: async (providerId) => {
    const provider = get().providers.find(p => p.id === providerId);
    if (!provider) return;
    
    // Mock refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    set((state: any) => {
      const providerIndex = state.providers.findIndex((p: SearchProvider) => p.id === providerId);
      if (providerIndex >= 0) {
        state.providers[providerIndex].lastIndexed = new Date();
      }
    });
  },
  
  // Index management
  rebuildIndex: async () => {
    set((state: any) => {
      state.index.isIndexing = true;
      state.index.indexingProgress = 0;
    });
    
    // Mock indexing process
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      set((state: any) => {
        state.index.indexingProgress = i;
      });
    }
    
    set((state: any) => {
      state.index.isIndexing = false;
      state.index.lastFullIndex = new Date();
      state.index.totalDocuments = 1000; // Mock document count
    });
  },
  
  getIndexStatus: () => {
    return get().index;
  },
  
  // Query history
  addToHistory: (query) => {
    set((state: any) => {
      // Remove duplicates and limit to 20 recent queries
      state.recentQueries = [
        query,
        ...state.recentQueries.filter((q: SearchQuery) => q.query !== query.query)
      ].slice(0, 20);
    });
  },
  
  clearHistory: () => {
    set((state: any) => {
      state.recentQueries = [];
    });
  },
  
  removeFromHistory: (queryId) => {
    set((state: any) => {
      state.recentQueries = state.recentQueries.filter((q: SearchQuery) => q.id !== queryId);
    });
  },
  
  // Utility functions
  getResultsByType: (type) => {
    return get().results.filter(r => r.type === type);
  },
  
  getProviderResults: (providerId) => {
    return get().results.filter(r => r.providerId === providerId);
  },
  
  getTopResults: (limit) => {
    return get().results.slice(0, limit);
  },
});