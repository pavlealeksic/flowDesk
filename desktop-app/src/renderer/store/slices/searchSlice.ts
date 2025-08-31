import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'

// Declare global window interface for search API

interface SearchResult {
  id: string
  type: 'email' | 'calendar' | 'contact' | 'file' | 'plugin' | 'command'
  title: string
  description?: string
  snippet?: string
  metadata?: Record<string, any>
  score: number
  source: string
  url?: string
  icon?: string
  timestamp?: number
}

interface SearchFilter {
  field: string
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than'
  value: any
}

interface SearchState {
  query: string
  results: SearchResult[]
  totalResults: number
  isSearching: boolean
  searchHistory: string[]
  savedSearches: Array<{
    id: string
    name: string
    query: string
    filters: SearchFilter[]
    createdAt: number
  }>
  filters: SearchFilter[]
  sortBy: 'relevance' | 'date' | 'title' | 'source'
  sortOrder: 'asc' | 'desc'
  pagination: {
    page: number
    limit: number
    hasMore: boolean
  }
  providers: Array<{
    id: string
    name: string
    enabled: boolean
    weight: number
  }>
  error: string | null
}

// Async thunks for search operations
export const performSearch = createAsyncThunk(
  'search/performSearch',
  async ({ query, page = 1 }: { query: string; page?: number }, { rejectWithValue, getState }) => {
    try {
      if (!window.searchAPI) {
        throw new Error('Search API not available');
      }
      
      const result = await window.searchAPI.search({
        query,
        limit: (getState() as any).search.pagination.limit,
        offset: ((page - 1) * (getState() as any).search.pagination.limit)
      });
      
      if (!result.success) {
        return rejectWithValue(result.error || 'Search failed');
      }
      
      return {
        results: result.data?.results || [],
        totalResults: result.data?.total || 0,
        hasMore: result.data?.results?.length === (getState() as any).search.pagination.limit
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const getSearchSuggestions = createAsyncThunk(
  'search/getSuggestions',
  async (partialQuery: string, { rejectWithValue }) => {
    try {
      if (!window.searchAPI) {
        throw new Error('Search API not available');
      }
      
      const result = await window.searchAPI.getSuggestions(partialQuery, 10);
      
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to get suggestions');
      }
      
      return result.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const indexSearchDocument = createAsyncThunk(
  'search/indexDocument',
  async (document: any, { rejectWithValue }) => {
    try {
      if (!window.searchAPI) {
        throw new Error('Search API not available');
      }
      
      const result = await window.searchAPI.indexDocument(document);
      
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to index document');
      }
      
      return document.id;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const initializeSearch = createAsyncThunk(
  'search/initialize',
  async (_, { rejectWithValue }) => {
    try {
      if (!window.searchAPI) {
        throw new Error('Search API not available');
      }
      
      const result = await window.searchAPI.initialize();
      
      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to initialize search');
      }
      
      return true;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

const initialState: SearchState = {
  query: '',
  results: [],
  totalResults: 0,
  isSearching: false,
  searchHistory: [],
  savedSearches: [],
  filters: [],
  sortBy: 'relevance',
  sortOrder: 'desc',
  pagination: {
    page: 1,
    limit: 50,
    hasMore: false
  },
  providers: [
    { id: 'mail', name: 'Mail', enabled: true, weight: 1.0 },
    { id: 'calendar', name: 'Calendar', enabled: true, weight: 0.8 },
    { id: 'files', name: 'Files', enabled: true, weight: 0.6 },
    { id: 'contacts', name: 'Contacts', enabled: true, weight: 0.7 },
    { id: 'plugins', name: 'Plugins', enabled: true, weight: 0.5 },
    { id: 'commands', name: 'Commands', enabled: true, weight: 0.9 }
  ],
  error: null
}

const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload
    },
    
    setSearching: (state, action: PayloadAction<boolean>) => {
      state.isSearching = action.payload
    },
    
    setResults: (state, action: PayloadAction<{ results: SearchResult[]; totalResults: number; hasMore: boolean }>) => {
      const { results, totalResults, hasMore } = action.payload
      if (state.pagination.page === 1) {
        state.results = results
      } else {
        state.results.push(...results)
      }
      state.totalResults = totalResults
      state.pagination.hasMore = hasMore
    },
    
    clearResults: (state) => {
      state.results = []
      state.totalResults = 0
      state.pagination.page = 1
      state.pagination.hasMore = false
    },
    
    addToHistory: (state, action: PayloadAction<string>) => {
      const query = action.payload.trim()
      if (query && !state.searchHistory.includes(query)) {
        state.searchHistory.unshift(query)
        // Keep only last 50 searches
        if (state.searchHistory.length > 50) {
          state.searchHistory = state.searchHistory.slice(0, 50)
        }
      }
    },
    
    clearHistory: (state) => {
      state.searchHistory = []
    },
    
    addSavedSearch: (state, action: PayloadAction<{ name: string; query: string; filters: SearchFilter[] }>) => {
      const savedSearch = {
        ...action.payload,
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now()
      }
      state.savedSearches.push(savedSearch)
    },
    
    removeSavedSearch: (state, action: PayloadAction<string>) => {
      const index = state.savedSearches.findIndex(s => s.id === action.payload)
      if (index > -1) {
        state.savedSearches.splice(index, 1)
      }
    },
    
    setFilters: (state, action: PayloadAction<SearchFilter[]>) => {
      state.filters = action.payload
    },
    
    addFilter: (state, action: PayloadAction<SearchFilter>) => {
      state.filters.push(action.payload)
    },
    
    removeFilter: (state, action: PayloadAction<number>) => {
      state.filters.splice(action.payload, 1)
    },
    
    clearFilters: (state) => {
      state.filters = []
    },
    
    setSorting: (state, action: PayloadAction<{ sortBy: SearchState['sortBy']; sortOrder: 'asc' | 'desc' }>) => {
      state.sortBy = action.payload.sortBy
      state.sortOrder = action.payload.sortOrder
    },
    
    setPagination: (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
      if (action.payload.page !== undefined) {
        state.pagination.page = action.payload.page
      }
      if (action.payload.limit !== undefined) {
        state.pagination.limit = action.payload.limit
      }
    },
    
    loadMore: (state) => {
      if (state.pagination.hasMore) {
        state.pagination.page += 1
      }
    },
    
    updateProvider: (state, action: PayloadAction<{ id: string; updates: Partial<SearchState['providers'][0]> }>) => {
      const { id, updates } = action.payload
      const provider = state.providers.find(p => p.id === id)
      if (provider) {
        Object.assign(provider, updates)
      }
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    // Perform search
    builder
      .addCase(performSearch.pending, (state, action) => {
        state.isSearching = true;
        state.error = null;
        // Reset pagination if it's a new search
        const isNewSearch = action.meta.arg.page === 1;
        if (isNewSearch) {
          state.pagination.page = 1;
        }
      })
      .addCase(performSearch.fulfilled, (state, action) => {
        state.isSearching = false;
        const { results, totalResults, hasMore } = action.payload;
        if (state.pagination.page === 1) {
          state.results = results;
        } else {
          state.results.push(...results);
        }
        state.totalResults = totalResults;
        state.pagination.hasMore = hasMore;
        // Add query to history if it's a new search
        if (state.pagination.page === 1 && state.query) {
          const query = state.query.trim();
          if (query && !state.searchHistory.includes(query)) {
            state.searchHistory.unshift(query);
            if (state.searchHistory.length > 50) {
              state.searchHistory = state.searchHistory.slice(0, 50);
            }
          }
        }
      })
      .addCase(performSearch.rejected, (state, action) => {
        state.isSearching = false;
        state.error = action.payload as string;
      });

    // Get suggestions
    builder
      .addCase(getSearchSuggestions.fulfilled, (state, action) => {
        // Store suggestions in a way that can be used by components
        // For now, we don't store them in state but return them directly
      });

    // Index document
    builder
      .addCase(indexSearchDocument.pending, (state) => {
        state.error = null;
      })
      .addCase(indexSearchDocument.fulfilled, (state) => {
        // Document indexed successfully
      })
      .addCase(indexSearchDocument.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Initialize search
    builder
      .addCase(initializeSearch.pending, (state) => {
        state.error = null;
      })
      .addCase(initializeSearch.fulfilled, (state) => {
        // Search engine initialized successfully
      })
      .addCase(initializeSearch.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  }
})

export const {
  setQuery,
  setSearching,
  setResults,
  clearResults,
  addToHistory,
  clearHistory,
  addSavedSearch,
  removeSavedSearch,
  setFilters,
  addFilter,
  removeFilter,
  clearFilters,
  setSorting,
  setPagination,
  loadMore,
  updateProvider,
  setError,
  clearError
} = searchSlice.actions

export default searchSlice.reducer