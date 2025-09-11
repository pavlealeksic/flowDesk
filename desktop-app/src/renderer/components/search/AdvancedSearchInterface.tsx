import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Calendar,
  Mail,
  User,
  Tag,
  Clock,
  X,
  ChevronDown,
  History,
  Star,
  ArrowRight,
  FileText,
  Settings
} from 'lucide-react'
import { cn } from '../ui/utils'
import { Button, Input, Card } from '../ui'
import { useNotifications } from '../ui/NotificationSystem'
import { InlineShortcut } from '../ui/KeyboardShortcuts'
import type { EmailMessage, CalendarEvent } from '@flow-desk/shared'
import { useLogger } from '../../logging/RendererLoggingService';

const logger = useLogger('AdvancedSearchInterface');

export interface SearchResult {
  id: string
  type: 'email' | 'calendar' | 'contact' | 'file'
  title: string
  subtitle?: string
  snippet?: string
  date?: Date
  category?: string
  metadata?: any
  score?: number
}

export interface SearchFilters {
  dateRange?: {
    from?: Date
    to?: Date
  }
  type?: 'all' | 'email' | 'calendar' | 'contact' | 'file'
  sender?: string
  hasAttachments?: boolean
  isStarred?: boolean
  isUnread?: boolean
  categories?: string[]
}

interface AdvancedSearchInterfaceProps {
  onSearch: (query: string, filters: SearchFilters) => Promise<SearchResult[]>
  onResultSelect: (result: SearchResult) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  showFilters?: boolean
  recentSearches?: string[]
  onSaveSearch?: (query: string, filters: SearchFilters, name: string) => void
  savedSearches?: { name: string; query: string; filters: SearchFilters }[]
}

const SearchResultItem: React.FC<{
  result: SearchResult
  query: string
  onSelect: (result: SearchResult) => void
  isSelected?: boolean
}> = ({ result, query, onSelect, isSelected }) => {
  const getIcon = () => {
    switch (result.type) {
      case 'email':
        return <Mail className="h-4 w-4 text-blue-500" />
      case 'calendar':
        return <Calendar className="h-4 w-4 text-green-500" />
      case 'contact':
        return <User className="h-4 w-4 text-purple-500" />
      case 'file':
        return <FileText className="h-4 w-4 text-orange-500" />
      default:
        return <Search className="h-4 w-4 text-muted-foreground" />
    }
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">
          {part}
        </mark>
      ) : part
    )
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors',
        isSelected && 'bg-accent'
      )}
      onClick={() => onSelect(result)}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate">
              {highlightText(result.title, query)}
            </h4>
            
            {result.subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {highlightText(result.subtitle, query)}
              </p>
            )}
            
            {result.snippet && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {highlightText(result.snippet, query)}
              </p>
            )}
          </div>
          
          {result.date && (
            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
              {formatDate(result.date)}
            </span>
          )}
        </div>
        
        {result.category && (
          <div className="flex items-center gap-1 mt-2">
            <Tag className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground capitalize">
              {result.category}
            </span>
          </div>
        )}
      </div>
      
      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  )
}

const SearchFiltersPanel: React.FC<{
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  onClose: () => void
}> = ({ filters, onFiltersChange, onClose }) => {
  const handleFilterChange = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg p-4 space-y-4 z-50"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Search Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Type */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Content Type</label>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'email', label: 'Email' },
            { value: 'calendar', label: 'Calendar' },
            { value: 'contact', label: 'Contacts' },
            { value: 'file', label: 'Files' }
          ].map(option => (
            <Button
              key={option.value}
              variant={filters.type === option.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange('type', option.value as any)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Date Range</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="date"
              value={filters.dateRange?.from?.toISOString().split('T')[0] || ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : undefined
                handleFilterChange('dateRange', { ...filters.dateRange, from: date })
              }}
              className="w-full px-2 py-1 text-xs bg-background border border-border rounded"
              placeholder="From"
            />
          </div>
          <div>
            <input
              type="date"
              value={filters.dateRange?.to?.toISOString().split('T')[0] || ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : undefined
                handleFilterChange('dateRange', { ...filters.dateRange, to: date })
              }}
              className="w-full px-2 py-1 text-xs bg-background border border-border rounded"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Email-specific filters */}
      {(!filters.type || filters.type === 'all' || filters.type === 'email') && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">From Sender</label>
            <Input
              value={filters.sender || ''}
              onChange={(value) => handleFilterChange('sender', value)}
              placeholder="email@example.com"
              className="text-xs"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.hasAttachments || false}
                onChange={(e) => handleFilterChange('hasAttachments', e.target.checked)}
                className="rounded border-border"
              />
              Has attachments
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.isStarred || false}
                onChange={(e) => handleFilterChange('isStarred', e.target.checked)}
                className="rounded border-border"
              />
              Starred
            </label>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.isUnread || false}
                onChange={(e) => handleFilterChange('isUnread', e.target.checked)}
                className="rounded border-border"
              />
              Unread
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Button variant="ghost" size="sm" onClick={() => onFiltersChange({})}>
          Clear All
        </Button>
        <Button size="sm" onClick={onClose}>
          Apply Filters
        </Button>
      </div>
    </motion.div>
  )
}

export const AdvancedSearchInterface: React.FC<AdvancedSearchInterfaceProps> = ({
  onSearch,
  onResultSelect,
  placeholder = 'Search everything...',
  autoFocus = false,
  className,
  showFilters = true,
  recentSearches = [],
  onSaveSearch,
  savedSearches = []
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const { info } = useNotifications()

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== undefined && v !== null)
      }
      return value !== undefined && value !== null && value !== ''
    })
  }, [filters])

  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters = {}) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const searchResults = await onSearch(searchQuery.trim(), searchFilters)
      setResults(searchResults)
      setSelectedIndex(-1)
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: ['Search error:', error], method: 'console.error' })
      info('Search Error', 'Failed to perform search. Please try again.')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [onSearch, info])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    setShowSuggestions(!!value.trim())
    
    // Debounced search
    const timeoutId = setTimeout(() => {
      if (value.trim()) {
        performSearch(value, filters)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [performSearch, filters])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          onResultSelect(results[selectedIndex])
          setQuery('')
          setResults([])
          setShowSuggestions(false)
        } else if (query.trim()) {
          performSearch(query, filters)
        }
        break
      case 'Escape':
        setQuery('')
        setResults([])
        setShowSuggestions(false)
        searchRef.current?.blur()
        break
    }
  }, [showSuggestions, selectedIndex, results, query, filters, performSearch, onResultSelect])

  const handleResultSelect = useCallback((result: SearchResult) => {
    onResultSelect(result)
    setQuery('')
    setResults([])
    setShowSuggestions(false)
  }, [onResultSelect])

  const suggestions = useMemo(() => {
    const allSuggestions = [
      ...recentSearches.map(search => ({ type: 'recent', text: search })),
      ...savedSearches.map(saved => ({ type: 'saved', text: saved.name, query: saved.query }))
    ]
    
    return allSuggestions.slice(0, 5)
  }, [recentSearches, savedSearches])

  return (
    <div className={cn('relative', className)}>
      <Card className="relative">
        <div className="flex items-center gap-2 p-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />

          <div className="flex items-center gap-1">
            {showFilters && (
              <Button
                variant={showFilterPanel || hasActiveFilters ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="h-6"
              >
                <Filter className="h-3 w-3" />
                {hasActiveFilters && (
                  <span className="ml-1 text-xs">({Object.keys(filters).length})</span>
                )}
              </Button>
            )}

            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery('')
                  setResults([])
                  setShowSuggestions(false)
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          <InlineShortcut keys={['cmd', 'k']} />
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilterPanel && (
            <SearchFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              onClose={() => setShowFilterPanel(false)}
            />
          )}
        </AnimatePresence>
      </Card>

      {/* Search Results/Suggestions */}
      <AnimatePresence>
        {showSuggestions && (query || results.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden"
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-flow-primary-500" />
                  Searching...
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    query={query}
                    onSelect={handleResultSelect}
                    isSelected={index === selectedIndex}
                  />
                ))}
              </div>
            ) : query && !isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No results found for "{query}"
              </div>
            ) : suggestions.length > 0 ? (
              <div className="p-2">
                <div className="text-xs text-muted-foreground px-3 py-2 font-medium">
                  Recent & Saved Searches
                </div>
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setQuery((suggestion as any).query || suggestion.text)
                      if ((suggestion as any).query) {
                        performSearch((suggestion as any).query, filters)
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent rounded"
                  >
                    {suggestion.type === 'recent' ? (
                      <History className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <Star className="h-3 w-3 text-muted-foreground" />
                    )}
                    {suggestion.text}
                  </button>
                ))}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}