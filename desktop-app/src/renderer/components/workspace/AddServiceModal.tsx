/**
 * Add Service Modal Component
 * 
 * Allows users to add web services to their workspace
 */

import React, { useState, useEffect } from 'react';
import { Button, Card, cn } from '../ui';

interface Service {
  id: string;
  name: string;
  url: string;
  type: string;
  iconUrl: string;
  color: string;
  category: string;
}

interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  type: string;
  iconUrl: string;
  color: string;
  category: string;
}

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddService: (service: { name: string; type: string; url: string }) => void;
}

// Comprehensive service configuration with real icons
const PREDEFINED_SERVICES: ServiceConfig[] = [
  // Communication & Collaboration
  {
    id: 'slack',
    name: 'Slack',
    url: 'https://slack.com',
    type: 'communication',
    iconUrl: './assets/service-icons/slack.svg',
    color: '#4A154B',
    category: 'communication'
  },
  {
    id: 'discord',
    name: 'Discord',
    url: 'https://discord.com/app',
    type: 'communication',
    iconUrl: './assets/service-icons/discord.svg',
    color: '#5865F2',
    category: 'communication'
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    url: 'https://teams.microsoft.com',
    type: 'communication',
    iconUrl: './assets/service-icons/teams.svg',
    color: '#6264A7',
    category: 'communication'
  },
  {
    id: 'zoom',
    name: 'Zoom',
    url: 'https://zoom.us/signin',
    type: 'communication',
    iconUrl: './assets/service-icons/zoom.svg',
    color: '#2D8CFF',
    category: 'communication'
  },
  {
    id: 'telegram',
    name: 'Telegram',
    url: 'https://web.telegram.org',
    type: 'communication',
    iconUrl: './assets/service-icons/telegram.svg',
    color: '#0088CC',
    category: 'communication'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Web',
    url: 'https://web.whatsapp.com',
    type: 'communication',
    iconUrl: './assets/service-icons/whatsapp.svg',
    color: '#25D366',
    category: 'communication'
  },

  // Project Management
  {
    id: 'notion',
    name: 'Notion',
    url: 'https://www.notion.so',
    type: 'project-management',
    iconUrl: './assets/service-icons/notion.svg',
    color: '#000000',
    category: 'project-management'
  },
  {
    id: 'trello',
    name: 'Trello',
    url: 'https://trello.com',
    type: 'project-management',
    iconUrl: './assets/service-icons/trello.svg',
    color: '#0079BF',
    category: 'project-management'
  },
  {
    id: 'asana',
    name: 'Asana',
    url: 'https://app.asana.com',
    type: 'project-management',
    iconUrl: './assets/service-icons/asana.svg',
    color: '#F06A6A',
    category: 'project-management'
  },
  {
    id: 'monday',
    name: 'Monday.com',
    url: 'https://monday.com',
    type: 'project-management',
    iconUrl: './assets/service-icons/monday.svg',
    color: '#FF3D57',
    category: 'project-management'
  },
  {
    id: 'jira',
    name: 'Jira',
    url: 'https://atlassian.com',
    type: 'project-management',
    iconUrl: './assets/service-icons/jira.svg',
    color: '#0052CC',
    category: 'project-management'
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    url: 'https://app.clickup.com',
    type: 'project-management',
    iconUrl: './assets/service-icons/clickup.svg',
    color: '#7B68EE',
    category: 'project-management'
  },

  // Development & Code
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com',
    type: 'development',
    iconUrl: './assets/service-icons/github.svg',
    color: '#181717',
    category: 'development'
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    url: 'https://gitlab.com',
    type: 'development',
    iconUrl: './assets/service-icons/gitlab.svg',
    color: '#FC6D26',
    category: 'development'
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    url: 'https://bitbucket.org',
    type: 'development',
    iconUrl: './assets/service-icons/bitbucket.svg',
    color: '#0052CC',
    category: 'development'
  },
  {
    id: 'vscode',
    name: 'VS Code Web',
    url: 'https://vscode.dev',
    type: 'development',
    iconUrl: './assets/service-icons/vscode.svg',
    color: '#007ACC',
    category: 'development'
  },
  {
    id: 'codepen',
    name: 'CodePen',
    url: 'https://codepen.io',
    type: 'development',
    iconUrl: './assets/service-icons/codepen.svg',
    color: '#000000',
    category: 'development'
  },
  {
    id: 'replit',
    name: 'Replit',
    url: 'https://replit.com',
    type: 'development',
    iconUrl: './assets/service-icons/replit.svg',
    color: '#F26207',
    category: 'development'
  },

  // Productivity & Notes
  {
    id: 'obsidian',
    name: 'Obsidian',
    url: 'https://obsidian.md',
    type: 'productivity',
    iconUrl: './assets/service-icons/obsidian.svg',
    color: '#7C3AED',
    category: 'productivity'
  },
  {
    id: 'todoist',
    name: 'Todoist',
    url: 'https://todoist.com',
    type: 'productivity',
    iconUrl: './assets/service-icons/todoist.svg',
    color: '#E44332',
    category: 'productivity'
  },
  {
    id: 'evernote',
    name: 'Evernote',
    url: 'https://www.evernote.com',
    type: 'productivity',
    iconUrl: './assets/service-icons/evernote.svg',
    color: '#00A82D',
    category: 'productivity'
  },
  {
    id: 'onenote',
    name: 'OneNote',
    url: 'https://www.onenote.com',
    type: 'productivity',
    iconUrl: './assets/service-icons/onenote.svg',
    color: '#7719AA',
    category: 'productivity'
  },

  // Design & Creative
  {
    id: 'figma',
    name: 'Figma',
    url: 'https://www.figma.com',
    type: 'design',
    iconUrl: './assets/service-icons/figma.svg',
    color: '#F24E1E',
    category: 'design'
  },
  {
    id: 'sketch',
    name: 'Sketch',
    url: 'https://www.sketch.com',
    type: 'design',
    iconUrl: './assets/service-icons/sketch.svg',
    color: '#F7B500',
    category: 'design'
  },
  {
    id: 'canva',
    name: 'Canva',
    url: 'https://www.canva.com',
    type: 'design',
    iconUrl: './assets/service-icons/canva.svg',
    color: '#00C4CC',
    category: 'design'
  },
  {
    id: 'adobe-xd',
    name: 'Adobe XD',
    url: 'https://www.adobe.com/products/xd.html',
    type: 'design',
    iconUrl: './assets/service-icons/adobe.svg',
    color: '#FF61F6',
    category: 'design'
  },

  // Cloud Storage
  {
    id: 'google-drive',
    name: 'Google Drive',
    url: 'https://drive.google.com',
    type: 'cloud-storage',
    iconUrl: './assets/service-icons/googledrive.svg',
    color: '#4285F4',
    category: 'cloud-storage'
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    url: 'https://www.dropbox.com',
    type: 'cloud-storage',
    iconUrl: './assets/service-icons/dropbox.svg',
    color: '#0061FF',
    category: 'cloud-storage'
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    url: 'https://onedrive.live.com',
    type: 'cloud-storage',
    iconUrl: './assets/service-icons/onedrive.svg',
    color: '#0078D4',
    category: 'cloud-storage'
  },

  // Email & Calendar
  {
    id: 'gmail',
    name: 'Gmail',
    url: 'https://mail.google.com',
    type: 'communication',
    iconUrl: './assets/service-icons/gmail.svg',
    color: '#EA4335',
    category: 'communication'
  },
  {
    id: 'outlook',
    name: 'Outlook',
    url: 'https://outlook.office.com',
    type: 'communication',
    iconUrl: './assets/service-icons/outlook.svg',
    color: '#0078D4',
    category: 'communication'
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    url: 'https://calendar.google.com',
    type: 'productivity',
    iconUrl: './assets/service-icons/gcal.svg',
    color: '#4285F4',
    category: 'productivity'
  },

  // CRM & Sales
  {
    id: 'salesforce',
    name: 'Salesforce',
    url: 'https://salesforce.com',
    type: 'crm',
    iconUrl: './assets/service-icons/salesforce.svg',
    color: '#00A1E0',
    category: 'crm'
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    url: 'https://app.hubspot.com',
    type: 'crm',
    iconUrl: './assets/service-icons/hubspot.svg',
    color: '#FF7A59',
    category: 'crm'
  },

  // Analytics & Marketing
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    url: 'https://analytics.google.com',
    type: 'analytics',
    iconUrl: './assets/service-icons/analytics.svg',
    color: '#F9AB00',
    category: 'analytics'
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    url: 'https://mailchimp.com',
    type: 'analytics',
    iconUrl: './assets/service-icons/mailchimp.svg',
    color: '#FFE01B',
    category: 'analytics'
  },

  // Finance & Accounting
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://dashboard.stripe.com',
    type: 'finance',
    iconUrl: './assets/service-icons/stripe.svg',
    color: '#635BFF',
    category: 'finance'
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    url: 'https://quickbooks.intuit.com',
    type: 'finance',
    iconUrl: './assets/service-icons/quickbooks.svg',
    color: '#0077C5',
    category: 'finance'
  },

  // Social Media
  {
    id: 'twitter',
    name: 'Twitter/X',
    url: 'https://twitter.com',
    type: 'social-media',
    iconUrl: './assets/service-icons/twitter.svg',
    color: '#1DA1F2',
    category: 'social-media'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com',
    type: 'social-media',
    iconUrl: './assets/service-icons/linkedin.svg',
    color: '#0077B5',
    category: 'social-media'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com',
    type: 'social-media',
    iconUrl: './assets/service-icons/instagram.svg',
    color: '#E4405F',
    category: 'social-media'
  },

  // Customer Support
  {
    id: 'zendesk',
    name: 'Zendesk',
    url: 'https://zendesk.com',
    type: 'support',
    iconUrl: './assets/service-icons/zendesk.svg',
    color: '#03363D',
    category: 'support'
  },
  {
    id: 'intercom',
    name: 'Intercom',
    url: 'https://app.intercom.com',
    type: 'support',
    iconUrl: './assets/service-icons/intercom.svg',
    color: '#338DF0',
    category: 'support'
  }
];

// Simple service icon component with fallback
const ServiceIconComponent: React.FC<{
  service: ServiceConfig;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ service, size = 'md', className }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  if (imageError) {
    // Show initials fallback
    const initials = service.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div 
        className={cn(
          sizeClasses[size],
          'rounded flex items-center justify-center border border-border',
          className
        )}
        style={{ backgroundColor: `${service.color}20` }}
      >
        <span 
          className={cn(
            'font-semibold text-xs',
            size === 'sm' ? 'text-[10px]' : 'text-xs'
          )}
          style={{ color: service.color }}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(sizeClasses[size], 'relative overflow-hidden rounded', className)}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted/50 animate-pulse flex items-center justify-center">
          <div className="w-1/2 h-1/2 bg-muted-foreground/30 rounded-sm" />
        </div>
      )}
      <img
        src={service.svgnUrl}
        alt={service.name}
        className={cn(
          'w-full h-full object-contain',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
};

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  onClose,
  onAddService
}) => {
  const [selectedService, setSelectedService] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Organize services by category
  const servicesByCategory = PREDEFINED_SERVICES.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, ServiceConfig[]>);

  // Get selected service config
  const selectedServiceConfig = PREDEFINED_SERVICES.find(s => s.id === selectedService);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService || !selectedServiceConfig) return;
    
    setIsAdding(true);
    try {
      const serviceUrl = customUrl.trim() || selectedServiceConfig.url;
      
      await onAddService({
        name: customName.trim() || selectedServiceConfig.name,
        type: selectedServiceConfig.type,
        url: serviceUrl
      });
      
      // Reset form
      setSelectedService('');
      setCustomName('');
      setCustomUrl('');
      onClose();
    } catch (error) {
      console.error('Failed to add service:', error);
    } finally {
      setIsAdding(false);
    }
  };

  // Category configuration
  const categoryOrder = [
    'communication',
    'project-management', 
    'development',
    'productivity',
    'design',
    'cloud-storage',
    'crm',
    'analytics',
    'finance',
    'social-media',
    'support'
  ];
  
  const categoryLabels: Record<string, string> = {
    'communication': 'Communication & Collaboration',
    'project-management': 'Project Management',
    'development': 'Development & Code',
    'productivity': 'Productivity & Notes',
    'design': 'Design & Creative',
    'cloud-storage': 'Cloud Storage',
    'crm': 'CRM & Sales',
    'support': 'Customer Support',
    'analytics': 'Analytics & Marketing',
    'social-media': 'Social Media',
    'finance': 'Finance & Accounting'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-96 max-w-lg mx-4">
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <h2 className="text-lg font-semibold mb-1">Add Service</h2>
            <p className="text-sm text-muted-foreground">
              Choose a service to add to this workspace
            </p>
          </div>

          {/* Service Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Service</label>
            <div className="max-h-60 overflow-y-auto space-y-3">
              {categoryOrder.map(category => {
                const services = servicesByCategory[category];
                if (!services || services.length === 0) return null;
                
                return (
                  <div key={category} className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {categoryLabels[category] || category}
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                      {services.map(service => (
                        <button
                          key={service.id}
                          type="button"
                          className={cn(
                            'p-3 border rounded-lg text-left hover:border-primary transition-colors',
                            selectedService === service.id ? 'border-primary bg-primary/10' : 'border-border'
                          )}
                          onClick={() => setSelectedService(service.id)}
                        >
                          <div className="flex items-center space-x-3">
                            <ServiceIconComponent 
                              service={service}
                              size="lg"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{service.name}</div>
                              <div className="text-xs text-muted-foreground capitalize">{service.type.replace('-', ' ')}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Name (Optional) */}
          {selectedService && selectedServiceConfig && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Name (Optional)</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={selectedServiceConfig.name}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use default name, or enter a custom name for this service
              </p>
            </div>
          )}

          {/* Custom URL (Optional) */}
          {selectedService && selectedServiceConfig && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom URL (Optional)</label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={selectedServiceConfig.url}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use default URL, or enter your team/organization URL
              </p>
            </div>
          )}

          {/* Preview */}
          {selectedService && selectedServiceConfig && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Preview</label>
              <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                <ServiceIconComponent 
                  service={selectedServiceConfig}
                  size="lg"
                />
                <div>
                  <div className="font-medium text-sm">
                    {customName.trim() || selectedServiceConfig.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customUrl.trim() || selectedServiceConfig.url}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedService || isAdding}
            >
              {isAdding ? 'Adding...' : 'Add Service'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddServiceModal;