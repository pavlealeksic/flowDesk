import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/utils';

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  recipe: any;
  preview?: string;
  popularity?: number;
}

interface TemplatesPanelProps {
  onTemplateSelect: (template: AutomationTemplate) => void;
}

// Mock templates for demonstration
const mockTemplates: AutomationTemplate[] = [
  {
    id: '1',
    name: 'Email Auto-Reply',
    description: 'Automatically reply to emails with a custom message',
    category: 'Email',
    tags: ['email', 'reply', 'productivity'],
    recipe: {},
    popularity: 85
  },
  {
    id: '2',
    name: 'Calendar Reminder',
    description: 'Send notification before calendar events',
    category: 'Calendar',
    tags: ['calendar', 'reminder', 'notification'],
    recipe: {},
    popularity: 92
  },
  {
    id: '3',
    name: 'Task Creator',
    description: 'Create tasks from starred emails automatically',
    category: 'Productivity',
    tags: ['email', 'tasks', 'automation'],
    recipe: {},
    popularity: 78
  },
  {
    id: '4',
    name: 'File Backup',
    description: 'Backup important files to cloud storage',
    category: 'File Management',
    tags: ['files', 'backup', 'cloud'],
    recipe: {},
    popularity: 67
  }
];

export function TemplatesPanel({ onTemplateSelect }: TemplatesPanelProps) {
  const [templates] = useState<AutomationTemplate[]>(mockTemplates);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['All', ...new Set(templates.map(t => t.category))];

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Email': return '📧';
      case 'Calendar': return '📅';
      case 'Productivity': return '⚡';
      case 'File Management': return '📁';
      default: return '📋';
    }
  };

  const getPopularityColor = (popularity: number) => {
    if (popularity >= 90) return 'text-green-600 bg-green-50';
    if (popularity >= 70) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="templates-panel p-4 space-y-4">
      <div className="panel-header">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Automation Templates</h3>
        <p className="text-xs text-gray-500 mb-4">
          Start with a pre-built template and customize it
        </p>
      </div>

      {/* Search */}
      <div className="template-search">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category Filter */}
      <div className="template-categories">
        <div className="flex flex-wrap gap-1">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                "px-2 py-1 text-xs rounded-full transition-colors",
                selectedCategory === category
                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {category !== 'All' && getCategoryIcon(category)} {category}
            </button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      <div className="templates-list space-y-2">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className={cn(
              "template-item p-3 rounded-lg border border-gray-200 bg-white",
              "hover:border-blue-300 hover:shadow-sm transition-all duration-150"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="template-icon text-lg flex-shrink-0" aria-hidden="true">
                {getCategoryIcon(template.category)}
              </div>
              
              <div className="template-info flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="template-name font-medium text-sm text-gray-900">
                    {template.name}
                  </div>
                  {template.popularity && (
                    <div className={cn(
                      "popularity-badge px-2 py-1 rounded-full text-xs",
                      getPopularityColor(template.popularity)
                    )}>
                      {template.popularity}%
                    </div>
                  )}
                </div>
                
                <div className="template-description text-xs text-gray-500 mb-2 leading-relaxed">
                  {template.description}
                </div>
                
                <div className="template-tags flex flex-wrap gap-1 mb-2">
                  {template.tags.map(tag => (
                    <span
                      key={tag}
                      className="tag px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTemplateSelect(template)}
                  className="w-full"
                >
                  Use Template
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="empty-state text-center py-8">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-sm text-gray-500">No templates found</p>
          <p className="text-xs text-gray-400 mt-1">
            Try adjusting your search or category filter
          </p>
        </div>
      )}
    </div>
  );
}