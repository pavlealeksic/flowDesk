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
  Copy,
  Tag,
  Star,
  Filter,
  Download,
  Upload,
  Settings,
  ChevronDown,
  ChevronRight
} from '../ui'
import { type BaseComponentProps } from '../ui/types'
import {
  selectTemplates,
  selectTemplateCategories,
  selectProductivityUI,
  openTemplatesModal,
  closeTemplatesModal,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
  fetchTemplates,
  incrementTemplateUsage
} from '../../store/slices/productivitySlice'
import type { EmailTemplate, TemplateVariable } from '../../types/productivity'

interface EmailTemplatesModalProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate?: (template: EmailTemplate) => void
}

const TemplateVariableEditor: React.FC<{
  variables: TemplateVariable[]
  onChange: (variables: TemplateVariable[]) => void
}> = ({ variables, onChange }) => {
  const addVariable = () => {
    const newVariable: TemplateVariable = {
      name: '',
      label: '',
      type: 'text',
      required: false,
      placeholder: ''
    }
    onChange([...variables, newVariable])
  }

  const updateVariable = (index: number, updates: Partial<TemplateVariable>) => {
    const updated = variables.map((variable, i) => 
      i === index ? { ...variable, ...updates } : variable
    )
    onChange(updated)
  }

  const removeVariable = (index: number) => {
    onChange(variables.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Template Variables</label>
        <Button variant="ghost" size="sm" onClick={addVariable}>
          <Plus className="h-4 w-4 mr-1" />
          Add Variable
        </Button>
      </div>
      
      {variables.map((variable, index) => (
        <div key={index} className="p-3 border border-border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={variable.name}
              onChange={(value) => updateVariable(index, { name: value })}
              placeholder="Variable name (e.g., firstName)"
              className="flex-1"
            />
            <select
              value={variable.type}
              onChange={(e) => updateVariable(index, { type: e.target.value as TemplateVariable['type'] })}
              className="px-2 py-1 border border-border rounded"
            >
              <option value="text">Text</option>
              <option value="email">Email</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeVariable(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={variable.label}
              onChange={(value) => updateVariable(index, { label: value })}
              placeholder="Display label"
            />
            <Input
              value={variable.placeholder || ''}
              onChange={(value) => updateVariable(index, { placeholder: value })}
              placeholder="Placeholder text"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={variable.required}
                onChange={(e) => updateVariable(index, { required: e.target.checked })}
              />
              <span className="text-sm">Required</span>
            </label>
            
            {variable.type === 'select' && (
              <Input
                value={variable.options?.join(', ') || ''}
                onChange={(value) => updateVariable(index, { options: value.split(',').map((o: string) => o.trim()) })}
                placeholder="Options (comma separated)"
                className="flex-1"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const TemplateEditor: React.FC<{
  template?: EmailTemplate
  onSave: (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void
  onCancel: () => void
}> = ({ template, onSave, onCancel }) => {
  const categories = useAppSelector(selectTemplateCategories)
  
  const [formData, setFormData] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    body: template?.body || '',
    category: template?.category || 'general',
    tags: template?.tags || [],
    variables: Array.isArray(template?.variables) 
      ? template.variables.map((v: any) => 
          typeof v === 'string' 
            ? { name: v, label: v, type: 'text' as const, required: false, placeholder: '' }
            : v as TemplateVariable
        )
      : [],
    isPublic: template?.isPublic || false,
    isShared: template?.isShared || false
  })

  const [newTag, setNewTag] = useState('')

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const handleSave = () => {
    if (!formData.name.trim() || !formData.subject.trim()) return
    
    onSave({
      ...formData,
      category: formData.category as 'business' | 'personal' | 'follow-up' | 'meeting' | 'custom',
      variables: formData.variables.map(v => v.name) // Convert to string array
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Template Name</label>
          <Input
            value={formData.name}
            onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
            placeholder="Enter template name"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Subject</label>
        <Input
          value={formData.subject}
          onChange={(value) => setFormData(prev => ({ ...prev, subject: value }))}
          placeholder="Email subject line"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Body</label>
        <textarea
          value={formData.body}
          onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
          placeholder="Email body content. Use {{variableName}} for dynamic content."
          className="w-full h-32 px-3 py-2 border border-border rounded-md resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Use double curly braces for variables: {'{{'} {'{{'} firstName {'}}'} {'}}'}, {'{{'} {'{{'} company {'}}'} {'}}'}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tags</label>
        <div className="flex items-center gap-2">
          <Input
            value={newTag}
            onChange={setNewTag}
            placeholder="Add tag"
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            className="flex-1"
          />
          <Button variant="ghost" size="sm" onClick={handleAddTag}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {formData.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground rounded text-xs"
            >
              <Tag className="h-3 w-3" />
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <TemplateVariableEditor
        variables={formData.variables}
        onChange={(variables) => setFormData(prev => ({ ...prev, variables }))}
      />

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isPublic}
            onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
          />
          <span className="text-sm">Make template public</span>
        </label>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={!formData.name.trim() || !formData.subject.trim()}>
          {template ? 'Update Template' : 'Save Template'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

const TemplateList: React.FC<{
  templates: EmailTemplate[]
  onEdit: (template: EmailTemplate) => void
  onDelete: (template: EmailTemplate) => void
  onSelect?: (template: EmailTemplate) => void
  selectedCategory: string
}> = ({ templates, onEdit, onDelete, onSelect, selectedCategory }) => {
  const dispatch = useAppDispatch()
  
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') return templates
    return templates.filter(t => t.category === selectedCategory)
  }, [templates, selectedCategory])

  const handleUseTemplate = useCallback((template: EmailTemplate) => {
    dispatch(incrementTemplateUsage(template.id))
    onSelect?.(template)
  }, [dispatch, onSelect])

  return (
    <div className="space-y-2">
      {filteredTemplates.map(template => (
        <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium">{template.name}</h3>
                {(template.tags || []).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-muted text-xs rounded">
                    {tag}
                  </span>
                ))}
                {template.usageCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" />
                    {template.usageCount}
                  </span>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mb-1">
                <strong>Subject:</strong> {template.subject}
              </p>
              
              <p className="text-sm text-muted-foreground line-clamp-2">
                {template.body.substring(0, 100)}...
              </p>
              
              {Array.isArray(template.variables) && template.variables.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Variables: {template.variables.map((v: any) => typeof v === 'string' ? v : v.name).join(', ')}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1 ml-4">
              {onSelect && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(template)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(template)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      
      {filteredTemplates.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No templates found in this category.</p>
          <p className="text-sm">Create your first template to get started.</p>
        </div>
      )}
    </div>
  )
}

export const EmailTemplatesModal: React.FC<EmailTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  className
}) => {
  const dispatch = useAppDispatch()
  const templates = useAppSelector(selectTemplates)
  const categories = useAppSelector(selectTemplateCategories)
  const ui = useAppSelector(selectProductivityUI)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>()

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchTemplates())
    }
  }, [isOpen, dispatch])

  const handleCreateTemplate = () => {
    setEditingTemplate(undefined)
    setShowEditor(true)
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleSaveTemplate = async (templateData: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    if (editingTemplate) {
      await dispatch(updateTemplate({ 
        templateId: editingTemplate.id, 
        updates: templateData 
      }))
    } else {
      await dispatch(saveTemplate(templateData))
    }
    setShowEditor(false)
    setEditingTemplate(undefined)
  }

  const handleDeleteTemplate = async (template: EmailTemplate) => {
    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      await dispatch(deleteTemplate(template.id))
    }
  }

  const handleSelectTemplate = (template: EmailTemplate) => {
    onSelectTemplate?.(template)
    onClose()
  }

  const handleClose = () => {
    setShowEditor(false)
    setEditingTemplate(undefined)
    onClose()
  }

  const filteredTemplates = useMemo(() => {
    let filtered = templates
    
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.tags || []).some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    return filtered
  }, [templates, searchQuery])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className={cn('w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col', className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Email Templates</h2>
            <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
              {templates.length} templates
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 border-r border-border p-4 space-y-4">
            <div className="space-y-2">
              <Button
                onClick={handleCreateTemplate}
                className="w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search templates..."
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
                  <span className="flex items-center justify-between">
                    All Templates
                    <span className="text-muted-foreground">{templates.length}</span>
                  </span>
                </button>
                
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors',
                      selectedCategory === category && 'bg-muted'
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {category}
                      </span>
                      <span className="text-muted-foreground">0</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            {showEditor ? (
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium">
                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                  </h3>
                </div>
                
                <TemplateEditor
                  template={editingTemplate}
                  onSave={handleSaveTemplate}
                  onCancel={() => setShowEditor(false)}
                />
              </div>
            ) : (
              <div className="p-6">
                <TemplateList
                  templates={filteredTemplates}
                  onEdit={handleEditTemplate}
                  onDelete={handleDeleteTemplate}
                  onSelect={onSelectTemplate ? handleSelectTemplate : undefined}
                  selectedCategory={selectedCategory}
                />
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}