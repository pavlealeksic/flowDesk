import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../store'
import {
  Button,
  Input,
  Card,
  cn,
  X,
  Search,
  Plus,
  Edit,
  Trash2,
  Tag,
  Settings,
  ChevronDown,
  ChevronRight
} from '../ui'
import { type BaseComponentProps } from '../ui/types'
import {
  selectSnippets,
  selectSnippetCategories,
  selectSnippetsByCategory,
  saveSnippet,
  updateSnippet,
  deleteSnippet,
  fetchSnippets,
  incrementSnippetUsage
} from '../../store/slices/productivitySlice'
import type { TextSnippet, SnippetVariable } from '../../types/productivity'

interface QuickSnippetsPanelProps extends BaseComponentProps {
  onInsertSnippet: (snippet: TextSnippet) => void
  onClose: () => void
  showManageButton?: boolean
}

interface SnippetItemProps {
  snippet: TextSnippet
  onInsert: (snippet: TextSnippet) => void
  onEdit?: (snippet: TextSnippet) => void
  onDelete?: (snippet: TextSnippet) => void
  isCompact?: boolean
}

const SnippetItem: React.FC<SnippetItemProps> = ({ 
  snippet, 
  onInsert, 
  onEdit, 
  onDelete,
  isCompact = true 
}) => {
  return (
    <div className={cn(
      'group p-2 hover:bg-muted/50 cursor-pointer border-b border-border/50 transition-colors',
      isCompact && 'py-2'
    )}>
      <div className="flex items-start justify-between" onClick={() => onInsert(snippet)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-xs bg-muted px-1 rounded">
                {snippet.shortcut}
              </span>
            </div>
            <span className="text-sm font-medium truncate">{snippet.name}</span>
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-2 pr-2">
            {snippet.isHtml ? 
              snippet.content.replace(/<[^>]*>/g, '').substring(0, 80) :
              snippet.content.substring(0, 80)
            }
            {snippet.content.length > 80 && '...'}
          </p>
          
          {snippet.variables.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Edit className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {snippet.variables.length} variable{snippet.variables.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(snippet)
                }}
                className="h-6 w-6 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(snippet)
                }}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const CategorySection: React.FC<{
  categoryId: string
  categoryName: string
  snippets: TextSnippet[]
  isExpanded: boolean
  onToggle: () => void
  onInsert: (snippet: TextSnippet) => void
}> = ({ categoryId, categoryName, snippets, isExpanded, onToggle, onInsert }) => {
  if (snippets.length === 0) return null

  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 hover:bg-muted/50 text-left"
      >
        <span className="text-sm font-medium">{categoryName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{snippets.length}</span>
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="bg-muted/20">
          {snippets.map(snippet => (
            <SnippetItem
              key={snippet.id}
              snippet={snippet}
              onInsert={onInsert}
              isCompact
            />
          ))}
        </div>
      )}
    </div>
  )
}

const SnippetsManagementModal: React.FC<{
  isOpen: boolean
  onClose: () => void
}> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch()
  const snippets = useAppSelector(selectSnippets)
  const categories = useAppSelector(selectSnippetCategories)

  const [showEditor, setShowEditor] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<TextSnippet | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const handleCreateSnippet = () => {
    setEditingSnippet(undefined)
    setShowEditor(true)
  }

  const handleEditSnippet = (snippet: TextSnippet) => {
    setEditingSnippet(snippet)
    setShowEditor(true)
  }

  const handleDeleteSnippet = async (snippet: TextSnippet) => {
    if (confirm(`Are you sure you want to delete "${snippet.name}"?`)) {
      await dispatch(deleteSnippet(snippet.id))
    }
  }

  const filteredSnippets = useMemo(() => {
    let filtered = snippets
    
    if (searchQuery) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory)
    }
    
    return filtered
  }, [snippets, searchQuery, selectedCategory])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Manage Snippets</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r border-border p-4 space-y-4">
            <Button onClick={handleCreateSnippet} className="w-full justify-start">
              <Plus className="h-4 w-4 mr-2" />
              New Snippet
            </Button>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search snippets..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categories</label>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                    selectedCategory === 'all' && 'bg-muted'
                  )}
                >
                  All Snippets ({snippets.length})
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                      selectedCategory === category.id && 'bg-muted'
                    )}
                  >
                    {category.name} ({category.snippetCount})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-2">
              {filteredSnippets.map(snippet => (
                <SnippetItem
                  key={snippet.id}
                  snippet={snippet}
                  onInsert={() => {}}
                  onEdit={handleEditSnippet}
                  onDelete={handleDeleteSnippet}
                  isCompact={false}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export const QuickSnippetsPanel: React.FC<QuickSnippetsPanelProps> = ({
  onInsertSnippet,
  onClose,
  showManageButton = true,
  className
}) => {
  const dispatch = useAppDispatch()
  const snippets = useAppSelector(selectSnippets)
  const categories = useAppSelector(selectSnippetCategories)

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['common']))
  const [showManageModal, setShowManageModal] = useState(false)

  useEffect(() => {
    dispatch(fetchSnippets())
  }, [dispatch])

  const handleInsertSnippet = useCallback((snippet: TextSnippet) => {
    dispatch(incrementSnippetUsage(snippet.id))
    onInsertSnippet(snippet)
  }, [dispatch, onInsertSnippet])

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  const filteredSnippets = useMemo(() => {
    if (!searchQuery) return snippets.filter(s => s.isActive)
    
    return snippets.filter(s =>
      s.isActive && (
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  }, [snippets, searchQuery])

  const snippetsByCategory = useMemo(() => {
    const grouped: Record<string, TextSnippet[]> = {}
    
    filteredSnippets.forEach(snippet => {
      if (!grouped[snippet.category]) {
        grouped[snippet.category] = []
      }
      grouped[snippet.category].push(snippet)
    })
    
    return grouped
  }, [filteredSnippets])

  const recentSnippets = useMemo(() => {
    return filteredSnippets
      .filter(s => s.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
  }, [filteredSnippets])

  return (
    <>
      <Card className={cn('w-full shadow-lg', className)}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Quick Snippets</span>
          </div>
          
          <div className="flex items-center gap-1">
            {showManageButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManageModal(true)}
                title="Manage Snippets"
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search snippets..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {searchQuery ? (
            // Show filtered results when searching
            <div>
              {filteredSnippets.length > 0 ? (
                filteredSnippets.map(snippet => (
                  <SnippetItem
                    key={snippet.id}
                    snippet={snippet}
                    onInsert={handleInsertSnippet}
                  />
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No snippets found matching "{searchQuery}"
                </div>
              )}
            </div>
          ) : (
            // Show categorized view when not searching
            <div>
              {/* Recently Used */}
              {recentSnippets.length > 0 && (
                <CategorySection
                  categoryId="recent"
                  categoryName="Recently Used"
                  snippets={recentSnippets}
                  isExpanded={expandedCategories.has('recent')}
                  onToggle={() => toggleCategory('recent')}
                  onInsert={handleInsertSnippet}
                />
              )}

              {/* Categories */}
              {categories.map(category => {
                const categorySnippets = snippetsByCategory[category.id] || []
                return (
                  <CategorySection
                    key={category.id}
                    categoryId={category.id}
                    categoryName={category.name}
                    snippets={categorySnippets}
                    isExpanded={expandedCategories.has(category.id)}
                    onToggle={() => toggleCategory(category.id)}
                    onInsert={handleInsertSnippet}
                  />
                )
              })}
            </div>
          )}

          {snippets.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <div className="flex flex-col items-center gap-2">
                <Edit className="h-8 w-8 text-muted-foreground/50" />
                <p>No snippets created yet</p>
                <p className="text-xs">Create snippets to quickly insert common text</p>
                {showManageButton && (
                  <Button
                    size="sm"
                    onClick={() => setShowManageModal(true)}
                    className="mt-2"
                  >
                    Create First Snippet
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MousePointer className="h-3 w-3" />
            <span>Click to insert • {filteredSnippets.length} snippets available</span>
          </div>
        </div>
      </Card>

      <SnippetsManagementModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
      />
    </>
  )
}