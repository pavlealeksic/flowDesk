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
}

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddService: (service: { name: string; type: string; url: string }) => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  onClose,
  onAddService
}) => {
  const [predefinedServices, setPredefinedServices] = useState<Record<string, { name: string; url: string; type: string }>>({});
  const [selectedService, setSelectedService] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Load predefined services on mount
  useEffect(() => {
    if (isOpen && window.flowDesk?.workspace) {
      window.flowDesk.workspace.getPredefinedServices().then(services => {
        setPredefinedServices(services);
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService) return;
    
    setIsAdding(true);
    try {
      const service = predefinedServices[selectedService];
      const serviceUrl = customUrl.trim() || service.url;
      
      await onAddService({
        name: customName.trim() || service.name,
        type: service.type,
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

  const getServiceIcon = (serviceKey: string) => {
    // Import local service icons
    const iconMap: Record<string, string> = {
      // Communication & Collaboration  
      slack: '/src/renderer/assets/service-icons/slack.svg',
      teams: '/src/renderer/assets/service-icons/teams.svg',
      discord: '/src/renderer/assets/service-icons/discord.svg',
      
      // Productivity & Project Management
      notion: '/src/renderer/assets/service-icons/notion.png',
      jira: '/src/renderer/assets/service-icons/jira.png',
      asana: '/src/renderer/assets/service-icons/asana.svg',
      trello: '/src/renderer/assets/service-icons/trello.png',
      linear: '/src/renderer/assets/service-icons/linear.ico',
      clickup: '/src/renderer/assets/service-icons/clickup.png',
      monday: '/src/renderer/assets/service-icons/monday.png',
      
      // Development
      github: '/src/renderer/assets/service-icons/github.svg',
      gitlab: '/src/renderer/assets/service-icons/gitlab.svg',
      bitbucket: '/src/renderer/assets/service-icons/bitbucket.png',
      
      // Cloud Storage
      googledrive: '/src/renderer/assets/service-icons/googledrive.png',
      onedrive: '/src/renderer/assets/service-icons/onedrive.png',
      dropbox: '/src/renderer/assets/service-icons/dropbox.png',
      
      // Design & Creative
      figma: '/src/renderer/assets/service-icons/figma.svg',
      miro: '/src/renderer/assets/service-icons/miro.ico',
      
      // CRM & Sales
      salesforce: '/src/renderer/assets/service-icons/salesforce.png',
      hubspot: '/src/renderer/assets/service-icons/hubspot.ico',
      
      // Support
      zendesk: '/src/renderer/assets/service-icons/zendesk.png',
      intercom: '/src/renderer/assets/service-icons/intercom.png'
    };
    return iconMap[serviceKey] || '/src/renderer/assets/service-icons/default.svg';
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
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {Object.entries(predefinedServices).map(([key, service]) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    'p-3 border rounded-lg text-left hover:border-primary transition-colors',
                    selectedService === key ? 'border-primary bg-primary/10' : 'border-border'
                  )}
                  onClick={() => setSelectedService(key)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-muted/50 rounded-lg overflow-hidden">
                      <img 
                        src={getServiceIcon(key)} 
                        alt={service.name}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          // Fallback to first letter if icon fails
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-6 h-6 bg-primary/20 rounded flex items-center justify-center text-xs font-bold';
                            fallback.textContent = service.name[0].toUpperCase();
                            parent.insertBefore(fallback, target.nextSibling);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{service.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{service.type}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Name (Optional) */}
          {selectedService && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Name (Optional)</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={predefinedServices[selectedService]?.name || 'Service Name'}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use default name, or enter a custom name for this service
              </p>
            </div>
          )}

          {/* Custom URL (Optional) */}
          {selectedService && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom URL (Optional)</label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder={predefinedServices[selectedService]?.url || 'https://...'}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use default URL, or enter your team/organization URL
              </p>
            </div>
          )}

          {/* Preview */}
          {selectedService && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Preview</label>
              <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                <img 
                  src={getServiceIcon(selectedService)} 
                  alt={predefinedServices[selectedService]?.name}
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    // Fallback to first letter if icon fails
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = 'w-8 h-8 bg-primary/20 rounded flex items-center justify-center text-sm font-bold';
                      fallback.textContent = predefinedServices[selectedService]?.name[0].toUpperCase() || '?';
                      parent.insertBefore(fallback, target.nextSibling);
                    }
                  }}
                />
                <div>
                  <div className="font-medium text-sm">
                    {customName.trim() || predefinedServices[selectedService]?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customUrl.trim() || predefinedServices[selectedService]?.url}
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