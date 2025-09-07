/**
 * Global Search Header
 * 
 * Thin search bar that appears at the top of all views
 * Connects to advanced Rust search backend for unified search
 */

import React, { useState, useCallback } from 'react';
import { Search, X, Filter, Loader2 } from 'lucide-react';
import { Button, Input, cn } from '../ui';
import { useAppDispatch, useAppSelector } from '../../store';
import { searchGlobal, selectIsSearching, selectSearchResults } from '../../store/slices/searchSlice';

interface SearchResult {
  type: string;
  title: string;
  content: string;
}

interface GlobalSearchHeaderProps {
  className?: string;
  onResultSelect?: (result: SearchResult) => void;
}

export const GlobalSearchHeader: React.FC<GlobalSearchHeaderProps> = ({
  className,
  onResultSelect
}) => {
  const dispatch = useAppDispatch();
  const isSearching = useAppSelector(selectIsSearching);
  const results = useAppSelector(selectSearchResults);
  
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    try {
      await dispatch(searchGlobal({ 
        query: query.trim(),
        filters: { contentType: 'all' },
        limit: 20 
      })).unwrap();
      setIsExpanded(true);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [query, dispatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      setQuery('');
    }
  }, [handleSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setIsExpanded(false);
  }, []);

  return (
    <div className={cn('border-b border-border/50 bg-background/95 backdrop-blur', className)}>
      {/* Thin header bar */}
      <div className="h-12 px-4 flex items-center gap-3">
        {/* Global search input */}
        <div className="flex-1 max-w-md relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search across all your data..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-10 h-8 text-sm border-border/50 bg-background/80"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Search controls */}
        <div className="flex items-center gap-1">
          {isSearching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
          >
            <Filter className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded search results */}
      {isExpanded && (
        <div className="border-t border-border/50 bg-background/98">
          <div className="max-h-80 overflow-y-auto">
            {results.length > 0 ? (
              <div className="py-2">
                {results.slice(0, 8).map((result: SearchResult, index: number) => (
                  <button
                    key={index}
                    onClick={() => {
                      onResultSelect?.(result);
                      setIsExpanded(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase">
                        {result.type}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium truncate">{result.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {result.content}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {results.length > 8 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/30">
                    {results.length - 8} more results...
                  </div>
                )}
              </div>
            ) : query && !isSearching ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            ) : isSearching ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Searching...
              </div>
            ) : (
              <div className="py-4 px-4 text-xs text-muted-foreground">
                Search across emails, calendar events, files, and more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-[-1]" 
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};

export default GlobalSearchHeader;