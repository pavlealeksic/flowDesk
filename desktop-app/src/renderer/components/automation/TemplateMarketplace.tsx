/**
 * TemplateMarketplace - Browse and install automation templates
 * 
 * This component provides:
 * - Browse automation templates by category and popularity
 * - Search and filter templates
 * - Template preview with screenshots and requirements
 * - Installation with variable configuration
 * - Template ratings and reviews
 * - Modern UI with responsive grid layout
 */

import React, { useState, useEffect, useMemo } from 'react';
import { AutomationTemplate, AutomationTemplateVariable } from '@flow-desk/shared';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Dropdown } from '../ui/Dropdown';
import { Modal } from '../ui/Modal';

interface TemplateMarketplaceProps {
  onInstall: (template: AutomationTemplate, variables: Record<string, any>) => void;
  onBack: () => void;
}

export const TemplateMarketplace: React.FC<TemplateMarketplaceProps> = ({
  onInstall,
  onBack
}) => {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'rating' | 'downloads'>('popular');
  const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installVariables, setInstallVariables] = useState<Record<string, any>>({});
  const [installing, setInstalling] = useState(false);

  // Mock templates data - in production this would come from an API
  useEffect(() => {
    const mockTemplates: AutomationTemplate[] = [
      {
        id: 'template-1',
        name: 'Email to Task Automation',
        description: 'Automatically create tasks from important emails based on sender, subject, or keywords.',
        category: 'productivity',
        tags: ['email', 'tasks', 'productivity', 'gmail'],
        icon: '📧',
        screenshots: [],
        author: {
          name: 'FlowDesk Team',
          email: 'team@flowdesk.ai'
        },
        version: '1.2.0',
        requirements: {
          services: ['gmail', 'asana'],
          permissions: ['email:read', 'tasks:write'],
          plugins: []
        },
        variables: [
          {
            name: 'email_filter',
            type: 'string',
            label: 'Email Filter',
            description: 'Keywords to look for in email subject or sender',
            required: true,
            defaultValue: 'urgent, important',
            order: 1
          },
          {
            name: 'task_project',
            type: 'select',
            label: 'Target Project',
            description: 'Which project to create tasks in',
            required: true,
            options: [
              { label: 'Inbox', value: 'inbox' },
              { label: 'Work Projects', value: 'work' },
              { label: 'Personal', value: 'personal' }
            ],
            order: 2
          },
          {
            name: 'task_priority',
            type: 'select',
            label: 'Task Priority',
            description: 'Default priority for created tasks',
            required: false,
            defaultValue: 'normal',
            options: [
              { label: 'Low', value: 'low' },
              { label: 'Normal', value: 'normal' },
              { label: 'High', value: 'high' },
              { label: 'Urgent', value: 'urgent' }
            ],
            order: 3
          }
        ],
        recipe: {
          name: 'Email to Task Automation',
          description: 'Automatically create tasks from important emails',
          category: 'productivity',
          tags: ['email', 'tasks'],
          enabled: true,
          isPublic: false,
          version: '1.2.0',
          trigger: {
            type: 'email_received',
            config: {
              type: 'email_received',
              subjectFilters: ['{{email_filter}}'],
              accountIds: []
            }
          },
          actions: [{
            id: 'create-task',
            type: 'create_task',
            name: 'Create Task',
            description: 'Create a new task from the email',
            config: {
              type: 'create_task',
              service: 'asana',
              projectId: '{{task_project}}',
              task: {
                title: 'Email: {{trigger.subject}}',
                description: '{{trigger.body}}',
                priority: '{{task_priority}}'
              }
            },
            errorHandling: {
              strategy: 'retry',
              logErrors: true,
              notifyOnError: true
            },
            continueOnError: false
          }],
          settings: {
            timeout: 30,
            maxExecutionsPerHour: 100,
            maxConcurrentExecutions: 1,
            priority: 'normal',
            logLevel: 'info',
            variables: {},
            environment: 'production'
          },
          metadata: {
            author: {
              name: 'FlowDesk Team',
              email: 'team@flowdesk.ai'
            }
          }
        },
        stats: {
          downloads: 2543,
          rating: 4.8,
          reviews: 127,
          successRate: 0.96
        },
        status: 'published',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-08-15')
      },
      {
        id: 'template-2',
        name: 'Meeting Notes Generator',
        description: 'Automatically create and organize meeting notes from calendar events with attendee summaries.',
        category: 'calendar',
        tags: ['calendar', 'meetings', 'notes', 'productivity'],
        icon: '📅',
        screenshots: [],
        author: {
          name: 'Productivity Pro',
          email: 'pro@example.com'
        },
        version: '2.0.1',
        requirements: {
          services: ['google-calendar', 'notion'],
          permissions: ['calendar:read', 'documents:write'],
          plugins: []
        },
        variables: [
          {
            name: 'notes_location',
            type: 'select',
            label: 'Notes Storage',
            description: 'Where to store meeting notes',
            required: true,
            options: [
              { label: 'Notion Database', value: 'notion' },
              { label: 'Google Docs', value: 'gdocs' },
              { label: 'Local Files', value: 'local' }
            ],
            order: 1
          },
          {
            name: 'meeting_types',
            type: 'multiselect',
            label: 'Meeting Types',
            description: 'Types of meetings to process',
            required: false,
            options: [
              { label: 'All Meetings', value: 'all' },
              { label: 'Team Meetings', value: 'team' },
              { label: '1:1 Meetings', value: 'one_on_one' },
              { label: 'Client Meetings', value: 'client' }
            ],
            defaultValue: ['all'],
            order: 2
          }
        ],
        recipe: {
          name: 'Meeting Notes Generator',
          description: 'Automatically create and organize meeting notes',
          category: 'calendar',
          tags: ['calendar', 'meetings', 'notes'],
          enabled: true,
          isPublic: false,
          version: '2.0.1',
          trigger: {
            type: 'event_starting',
            config: {
              type: 'event_starting',
              leadTimeMinutes: 5,
              accountIds: []
            }
          },
          actions: [{
            id: 'create-notes',
            type: 'create_file',
            name: 'Create Meeting Notes',
            description: 'Create notes document for the meeting',
            config: {
              type: 'create_file',
              service: '{{notes_location}}',
              contentTemplate: `# {{trigger.title}}

**Date:** {{trigger.startTime}}
**Duration:** {{trigger.duration}}
**Attendees:** {{trigger.attendees}}

## Agenda
- 

## Notes
- 

## Action Items
- 

## Next Steps
- `
            },
            errorHandling: {
              strategy: 'retry',
              logErrors: true,
              notifyOnError: true
            },
            continueOnError: false
          }],
          settings: {
            timeout: 20,
            maxExecutionsPerHour: 50,
            maxConcurrentExecutions: 3,
            priority: 'normal',
            logLevel: 'info',
            variables: {},
            environment: 'production'
          },
          metadata: {
            author: {
              name: 'Productivity Pro',
              email: 'pro@example.com'
            }
          }
        },
        stats: {
          downloads: 1876,
          rating: 4.6,
          reviews: 89,
          successRate: 0.94
        },
        status: 'published',
        createdAt: new Date('2024-02-20'),
        updatedAt: new Date('2024-07-30')
      },
      {
        id: 'template-3',
        name: 'Slack Status from Calendar',
        description: 'Automatically update your Slack status based on calendar events and availability.',
        category: 'communication',
        tags: ['slack', 'calendar', 'status', 'availability'],
        icon: '💬',
        screenshots: [],
        author: {
          name: 'Remote Worker',
          email: 'remote@example.com'
        },
        version: '1.5.2',
        requirements: {
          services: ['slack', 'google-calendar'],
          permissions: ['profile:write', 'calendar:read'],
          plugins: []
        },
        variables: [
          {
            name: 'busy_status',
            type: 'string',
            label: 'Busy Status Message',
            description: 'Status message when in meetings',
            required: false,
            defaultValue: 'In a meeting',
            order: 1
          },
          {
            name: 'busy_emoji',
            type: 'string',
            label: 'Busy Emoji',
            description: 'Emoji to show when busy',
            required: false,
            defaultValue: '📅',
            order: 2
          },
          {
            name: 'update_presence',
            type: 'boolean',
            label: 'Update Presence',
            description: 'Also update Slack presence status',
            required: false,
            defaultValue: true,
            order: 3
          }
        ],
        recipe: {
          name: 'Slack Status from Calendar',
          description: 'Automatically update Slack status from calendar',
          category: 'communication',
          tags: ['slack', 'calendar', 'status'],
          enabled: true,
          isPublic: false,
          version: '1.5.2',
          trigger: {
            type: 'event_starting',
            config: {
              type: 'event_starting',
              leadTimeMinutes: 0,
              accountIds: []
            }
          },
          actions: [{
            id: 'update-slack-status',
            type: 'update_status',
            name: 'Update Slack Status',
            description: 'Update Slack status and presence',
            config: {
              type: 'update_status',
              status: {
                service: 'slack',
                message: '{{busy_status}}',
                emoji: '{{busy_emoji}}'
              }
            },
            errorHandling: {
              strategy: 'retry',
              logErrors: true,
              notifyOnError: false
            },
            continueOnError: true
          }],
          settings: {
            timeout: 10,
            maxExecutionsPerHour: 200,
            maxConcurrentExecutions: 5,
            priority: 'normal',
            logLevel: 'warn',
            variables: {},
            environment: 'production'
          },
          metadata: {
            author: {
              name: 'Remote Worker',
              email: 'remote@example.com'
            }
          }
        },
        stats: {
          downloads: 3421,
          rating: 4.9,
          reviews: 234,
          successRate: 0.98
        },
        status: 'published',
        createdAt: new Date('2024-03-10'),
        updatedAt: new Date('2024-08-25')
      }
    ];

    setTemplates(mockTemplates);
    setLoading(false);
  }, []);

  const categoryOptions = [
    { label: 'All Categories', value: 'all' },
    { label: 'Productivity', value: 'productivity' },
    { label: 'Email', value: 'email' },
    { label: 'Calendar', value: 'calendar' },
    { label: 'Tasks', value: 'tasks' },
    { label: 'Files', value: 'files' },
    { label: 'Communication', value: 'communication' },
    { label: 'Integrations', value: 'integrations' },
    { label: 'Notifications', value: 'notifications' },
    { label: 'Workflows', value: 'workflows' },
    { label: 'Utilities', value: 'utilities' },
    { label: 'Custom', value: 'custom' }
  ];

  const sortOptions = [
    { label: 'Most Popular', value: 'popular' },
    { label: 'Newest', value: 'newest' },
    { label: 'Highest Rated', value: 'rating' },
    { label: 'Most Downloads', value: 'downloads' }
  ];

  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = templates.filter(template => {
      const matchesSearch = searchQuery === '' ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return (b.stats.downloads * b.stats.rating) - (a.stats.downloads * a.stats.rating);
        case 'newest':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'rating':
          return b.stats.rating - a.stats.rating;
        case 'downloads':
          return b.stats.downloads - a.stats.downloads;
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchQuery, selectedCategory, sortBy]);

  const handleInstallClick = (template: AutomationTemplate) => {
    setSelectedTemplate(template);
    // Initialize variables with default values
    const defaultVariables: Record<string, any> = {};
    template.variables.forEach(variable => {
      if (variable.defaultValue !== undefined) {
        defaultVariables[variable.name] = variable.defaultValue;
      }
    });
    setInstallVariables(defaultVariables);
    setShowInstallModal(true);
  };

  const handleInstall = async () => {
    if (!selectedTemplate) return;

    try {
      setInstalling(true);
      await onInstall(selectedTemplate, installVariables);
      setShowInstallModal(false);
      setSelectedTemplate(null);
      setInstallVariables({});
    } catch (error) {
      console.error('Failed to install template:', error);
      // Error handling would be done by parent component
    } finally {
      setInstalling(false);
    }
  };

  const renderVariableInput = (variable: AutomationTemplateVariable) => {
    const value = installVariables[variable.name];

    switch (variable.type) {
      case 'string':
      case 'email':
      case 'url':
        return (
          <Input
            type={variable.type === 'email' ? 'email' : variable.type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => setInstallVariables(prev => ({
              ...prev,
              [variable.name]: e.target.value
            }))}
            placeholder={variable.defaultValue?.toString()}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => setInstallVariables(prev => ({
              ...prev,
              [variable.name]: parseFloat(e.target.value) || 0
            }))}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => setInstallVariables(prev => ({
                ...prev,
                [variable.name]: e.target.checked
              }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Enable this option</span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => setInstallVariables(prev => ({
              ...prev,
              [variable.name]: e.target.value
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select an option...</option>
            {variable.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {variable.options?.map((option) => (
              <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(value || []).includes(option.value)}
                  onChange={(e) => {
                    const currentValues = value || [];
                    const newValues = e.target.checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v: any) => v !== option.value);
                    
                    setInstallVariables(prev => ({
                      ...prev,
                      [variable.name]: newValues
                    }));
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        );

      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => setInstallVariables(prev => ({
              ...prev,
              [variable.name]: e.target.value
            }))}
          />
        );
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      productivity: 'bg-blue-100 text-blue-800',
      email: 'bg-green-100 text-green-800',
      calendar: 'bg-purple-100 text-purple-800',
      tasks: 'bg-orange-100 text-orange-800',
      files: 'bg-gray-100 text-gray-800',
      communication: 'bg-pink-100 text-pink-800',
      integrations: 'bg-indigo-100 text-indigo-800',
      notifications: 'bg-yellow-100 text-yellow-800',
      workflows: 'bg-red-100 text-red-800',
      utilities: 'bg-teal-100 text-teal-800',
      custom: 'bg-slate-100 text-slate-800'
    };
    return colors[category as keyof typeof colors] || colors.custom;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            ← Back to Dashboard
          </Button>
          <div className="h-6 bg-gray-300 rounded w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-300 rounded mb-2" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-gray-100 rounded mb-4" />
                <div className="flex space-x-2 mb-4">
                  <div className="h-5 bg-gray-200 rounded w-12" />
                  <div className="h-5 bg-gray-200 rounded w-12" />
                </div>
                <div className="h-8 bg-gray-300 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          ← Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Template Marketplace</h1>
        <p className="text-gray-600">
          Discover and install automation templates created by the community
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Dropdown
          value={selectedCategory}
          onChange={setSelectedCategory}
          options={categoryOptions}
          className="w-full sm:w-48"
        />
        <Dropdown
          value={sortBy}
          onChange={setSortBy}
          options={sortOptions}
          className="w-full sm:w-48"
        />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <p className="text-sm text-gray-500">by {template.author.name}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium">{template.stats.rating}</span>
                    <span className="text-gray-500">({template.stats.reviews})</span>
                  </div>
                  <div className="text-gray-500">
                    {template.stats.downloads.toLocaleString()} downloads
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">
                {template.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={`text-xs ${getCategoryColor(template.category)}`}>
                  {template.category}
                </Badge>
                {template.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{template.tags.length - 3}
                  </Badge>
                )}
              </div>

              <div className="text-xs text-gray-500 mb-4">
                <div className="mb-1">
                  <strong>Requires:</strong> {template.requirements.services.join(', ')}
                </div>
                <div>
                  <strong>Success Rate:</strong> {Math.round(template.stats.successRate * 100)}%
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Button
                onClick={() => handleInstallClick(template)}
                className="w-full"
                variant="outline"
              >
                Install Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAndSortedTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl text-gray-400">🔍</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No templates found
          </h3>
          <p className="text-gray-500">
            Try adjusting your search or filters to find more templates.
          </p>
        </div>
      )}

      {/* Install Modal */}
      <Modal
        isOpen={showInstallModal}
        onClose={() => {
          setShowInstallModal(false);
          setSelectedTemplate(null);
          setInstallVariables({});
        }}
        title={selectedTemplate ? `Install ${selectedTemplate.name}` : 'Install Template'}
      >
        {selectedTemplate && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Configure Template Variables
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Customize the template settings before installation.
              </p>
            </div>

            <div className="space-y-4">
              {selectedTemplate.variables
                .sort((a, b) => a.order - b.order)
                .map((variable) => (
                  <div key={variable.name} className="space-y-2">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        {variable.label}
                        {variable.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                      {variable.description && (
                        <span className="block text-xs text-gray-500 mt-1">
                          {variable.description}
                        </span>
                      )}
                    </label>
                    {renderVariableInput(variable)}
                  </div>
                ))}
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInstallModal(false);
                  setSelectedTemplate(null);
                  setInstallVariables({});
                }}
                disabled={installing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInstall}
                loading={installing}
                disabled={installing || (selectedTemplate.variables.some(v => 
                  v.required && !installVariables[v.name]
                ))}
              >
                Install Template
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};