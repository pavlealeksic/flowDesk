import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Card,
  Button,
  Input,
  Avatar,
  cn,
  Search,
  X,
  Filter,
  Calendar,
  Mail,
  File,
  Users,
  Clock,
  MapPin,
  Tag,
  ArrowRight,
  Loader2,
  SortAsc,
  SortDesc,
  ChevronDown
} from '../ui'
import { type BaseComponentProps, type SearchResult, type SearchFilter } from '../ui/types'

// Mock search data
const mockResults: SearchResult[] = [
  {
    id: '1',
    type: 'email',
    title: 'Q4 Planning Meeting',
    subtitle: 'john@company.com',
    content: 'Hi team, I wanted to schedule our Q4 planning meeting for next week. Please let me know your availability for Tuesday or Wednesday afternoon.',
    source: 'Mail',
    timestamp: new Date('2024-01-15T10:30:00'),
    relevance: 0.95,
    icon: <Mail className="h-4 w-4" />
  },
  {
    id: '2',
    type: 'contact',
    title: 'John Doe',
    subtitle: 'Senior Developer',
    content: 'john@company.com • +1 (555) 123-4567',
    source: 'Contacts',
    relevance: 0.88,
    icon: <Users className="h-4 w-4" />
  },
  {
    id: '3',
    type: 'event',
    title: 'Team Standup',
    subtitle: 'Today at 9:00 AM',
    content: 'Daily team sync meeting in Conference Room A',
    source: 'Calendar',
    timestamp: new Date('2024-01-15T09:00:00'),
    relevance: 0.82,
    icon: <Calendar className="h-4 w-4" />
  },
  {
    id: '4',
    type: 'file',
    title: 'Q4_Planning_Agenda.pdf',
    subtitle: '125 KB • Modified 2 hours ago',
    content: 'Quarterly planning meeting agenda and objectives',
    source: 'Files',
    timestamp: new Date('2024-01-15T08:30:00'),
    relevance: 0.76,
    icon: <File className="h-4 w-4" />
  },
  {
    id: '5',
    type: 'note',
    title: 'Project Requirements',
    subtitle: 'Personal Notes',
    content: 'Key requirements for the new customer portal project including authentication, user management, and reporting features.',
    source: 'Notes',
    timestamp: new Date('2024-01-14T16:45:00'),
    relevance: 0.71
  }
]

const mockFilters: SearchFilter[] = [
  {
    id: 'type',
    label: 'Type',
    type: 'select',
    value: 'all',
    options: [
      { label: 'All', value: 'all' },
      { label: 'Emails', value: 'email' },
      { label: 'Contacts', value: 'contact' },
      { label: 'Events', value: 'event' },
      { label: 'Files', value: 'file' },
      { label: 'Notes', value: 'note' }
    ]
  },
  {
    id: 'dateRange',
    label: 'Date Range',
    type: 'select',
    value: 'all',
    options: [
      { label: 'Any time', value: 'all' },
      { label: 'Today', value: 'today' },
      { label: 'This week', value: 'week' },
      { label: 'This month', value: 'month' },
      { label: 'This year', value: 'year' }
    ]
  },
  {
    id: 'source',
    label: 'Source',
    type: 'select',
    value: 'all',
    options: [
      { label: 'All sources', value: 'all' },
      { label: 'Mail', value: 'mail' },
      { label: 'Calendar', value: 'calendar' },
      { label: 'Contacts', value: 'contacts' },
      { label: 'Files', value: 'files' },
      { label: 'Notes', value: 'notes' }
    ]
  }
]

interface SearchResultItemProps {
  result: SearchResult
  onSelect: (result: SearchResult) => void
  isSelected?: boolean
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  onSelect,
  isSelected = false
}) => {
  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    
    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      })
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'email':
        return 'text-blue-500'
      case 'contact':
        return 'text-green-500'
      case 'event':
        return 'text-purple-500'
      case 'file':
        return 'text-orange-500'
      case 'note':
        return 'text-indigo-500'
      default:
        return 'text-muted-foreground'
    }
  }

  const getRelevanceColor = (relevance: number) => {
    if (relevance >= 0.9) return 'text-green-600 bg-green-100'
    if (relevance >= 0.8) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-600 bg-gray-100'
  }

  return (
    <Card
      variant={isSelected ? 'elevated' : 'default'}
      padding="none"
      className={cn(
        'cursor-pointer transition-all hover:shadow-md group',
        isSelected && 'ring-2 ring-flow-primary-500 bg-flow-primary-50 dark:bg-flow-primary-950'
      )}
      onClick={() => onSelect(result)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn('flex-shrink-0 mt-1', getTypeColor(result.type))}>
            {result.icon || <Search className="h-4 w-4" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm group-hover:text-flow-primary-600 transition-colors truncate">
                  {result.title}
                </h3>
                {result.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {result.subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {result.relevance && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-medium',
                    getRelevanceColor(result.relevance)
                  )}>
                    {Math.round(result.relevance * 100)}%
                  </span>
                )}
                
                {result.timestamp && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimestamp(result.timestamp)}</span>
                  </div>
                )}
              </div>
            </div>

            {result.content && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {result.content}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.source && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                    {result.source}
                  </span>
                )}
                <span className="text-xs text-muted-foreground capitalize">
                  {result.type}
                </span>
              </div>

              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

interface SearchFiltersProps {
  filters: SearchFilter[]
  onFilterChange: (filterId: string, value: any) => void
  onClearFilters: () => void
}

const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onFilterChange,
  onClearFilters
}) => {
  const hasActiveFilters = filters.some(filter => 
    (filter.type === 'select' && filter.value !== 'all') ||
    (filter.type === 'boolean' && filter.value === true) ||
    (filter.type === 'text' && filter.value) ||
    (filter.type === 'date' && filter.value)
  )

  return (
    <div className="p-4 border-b border-border bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h3 className="font-medium text-sm">Filters</h3>
        </div>
        
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearFilters}
            className="text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {filters.map(filter => (
          <div key={filter.id} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {filter.label}
            </label>
            
            {filter.type === 'select' && filter.options && (
              <select
                value={filter.value}
                onChange={(e) => onFilterChange(filter.id, e.target.value)}
                className="w-full h-8 px-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-flow-primary-500"
              >
                {filter.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            
            {filter.type === 'text' && (
              <Input
                size="sm"
                value={filter.value || ''}
                onChange={(value) => onFilterChange(filter.id, value)}
                placeholder={`Enter ${filter.label.toLowerCase()}...`}
              />
            )}
            
            {filter.type === 'boolean' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.value || false}
                  onChange={(e) => onFilterChange(filter.id, e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm">Enable {filter.label.toLowerCase()}</span>
              </label>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export interface SearchInterfaceProps extends BaseComponentProps {
  placeholder?: string
  onSearch?: (query: string, filters: SearchFilter[]) => Promise<SearchResult[]>
  onResultSelect?: (result: SearchResult) => void
  initialQuery?: string
  maxHeight?: number
  showFilters?: boolean
  autoFocus?: boolean
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  placeholder = 'Search anything...',
  onSearch,
  onResultSelect,
  initialQuery = '',
  maxHeight = 600,
  showFilters = true,
  autoFocus = true,
  className,
  'data-testid': testId
}) => {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [filters, setFilters] = useState<SearchFilter[]>(mockFilters)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      if (onSearch) {
        const searchResults = await onSearch(searchQuery, filters)
        setResults(searchResults)
      } else {
        // Mock search implementation
        await new Promise(resolve => setTimeout(resolve, 300))
        const filteredResults = mockResults.filter(result => {
          const matchesQuery = result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              result.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              result.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
          
          const typeFilter = filters.find(f => f.id === 'type')
          const matchesType = !typeFilter || typeFilter.value === 'all' || result.type === typeFilter.value
          
          const sourceFilter = filters.find(f => f.id === 'source')
          const matchesSource = !sourceFilter || sourceFilter.value === 'all' || 
                               result.source?.toLowerCase() === sourceFilter.value
          
          return matchesQuery && matchesType && matchesSource
        })

        // Sort results
        const sortedResults = [...filteredResults].sort((a, b) => {
          if (sortBy === 'relevance') {
            const relevanceA = a.relevance || 0
            const relevanceB = b.relevance || 0
            return sortOrder === 'desc' ? relevanceB - relevanceA : relevanceA - relevanceB
          } else {
            const dateA = a.timestamp?.getTime() || 0
            const dateB = b.timestamp?.getTime() || 0
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
          }
        })

        setResults(sortedResults)
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
      setSelectedIndex(-1)
    }
  }, [filters, onSearch, sortBy, sortOrder])

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery)
    performSearch(searchQuery)
  }, [performSearch])

  const handleFilterChange = useCallback((filterId: string, value: any) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId ? { ...filter, value } : filter
    ))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters(prev => prev.map(filter => ({
      ...filter,
      value: filter.type === 'select' ? 'all' : 
             filter.type === 'boolean' ? false : 
             filter.type === 'text' ? '' : null
    })))
  }, [])

  const handleResultSelect = useCallback((result: SearchResult) => {
    onResultSelect?.(result)
  }, [onResultSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleResultSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSelectedIndex(-1)
      searchInputRef.current?.blur()
    }
  }, [results, selectedIndex, handleResultSelect])

  useEffect(() => {
    if (query) {
      performSearch(query)
    }
  }, [filters, sortBy, sortOrder])

  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [autoFocus])

  return (
    <div className={cn('flex flex-col bg-card border border-border rounded-lg shadow-lg overflow-hidden', className)} data-testid={testId}>
      {/* Search Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              ref={searchInputRef}
              type="search"
              placeholder={placeholder}
              value={query}
              onChange={handleSearch}
              onKeyDown={handleKeyDown}
              leftIcon={<Search className="h-4 w-4" />}
              rightIcon={isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
              clearable
              onClear={() => {
                setQuery('')
                setResults([])
                setSelectedIndex(-1)
              }}
              className="text-base"
            />
          </div>
          
          {showFilters && (
            <Button
              variant={showFilterPanel ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              leftIcon={<Filter className="h-4 w-4" />}
            >
              Filters
            </Button>
          )}
        </div>

        {/* Sort Options */}
        {results.length > 0 && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </span>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSortBy(sortBy === 'relevance' ? 'date' : 'relevance')}
                className="text-xs"
              >
                Sort by {sortBy}
                {sortOrder === 'desc' ? <SortDesc className="h-3 w-3 ml-1" /> : <SortAsc className="h-3 w-3 ml-1" />}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="h-6 w-6 p-0"
              >
                {sortOrder === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && showFilterPanel && (
        <SearchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Results */}
      <div
        ref={resultsRef}
        className="flex-1 overflow-y-auto"
        style={{ maxHeight }}
      >
        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : results.length > 0 ? (
          <div className="p-4 space-y-3">
            {results.map((result, index) => (
              <SearchResultItem
                key={result.id}
                result={result}
                onSelect={handleResultSelect}
                isSelected={index === selectedIndex}
              />
            ))}
          </div>
        ) : query ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">No results found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search terms or filters
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">Universal Search</h3>
            <p className="text-sm text-muted-foreground">
              Search across emails, contacts, files, and more
            </p>
          </div>
        )}
      </div>
    </div>
  )
}