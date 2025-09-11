/**
 * Services Sidebar Component
 * 
 * Secondary sidebar showing services for the selected workspace
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Button, 
  cn, 
  Plus, 
  MoreVertical,
  Edit,
  Trash2,
  Settings,
  UserPlus,
  Download
} from '../ui';
import { useLogger } from '../../logging/RendererLoggingService';

interface Service {
  id: string;
  name: string;
  type: string;
  url: string;
  iconUrl?: string;
  isEnabled: boolean;
}

interface ServicesSidebarProps {
  workspaceId?: string;
  workspaceName?: string;
  services: Service[];
  activeServiceId?: string;
  onServiceSelect: (serviceId: string) => void;
  onAddService: () => void;
  onEditService?: (serviceId: string) => void;
  onDeleteService?: (serviceId: string) => void;
  onRetryService?: (serviceId: string) => void;
  onEditWorkspace?: (workspaceId: string) => void;
  onWorkspaceSettings?: (workspaceId: string) => void;
  className?: string;
}

export const ServicesSidebar: React.FC<ServicesSidebarProps> = ({
  workspaceId,
  workspaceName = 'Workspace',
  services,
  activeServiceId,
  onServiceSelect,
  onAddService,
  onEditService,
  onDeleteService,
  onRetryService,
  onEditWorkspace,
  onWorkspaceSettings,
  className
}) => {
  const [contextMenuService, setContextMenuService] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showWorkspaceActions, setShowWorkspaceActions] = useState(false);
  const logger = useLogger('ServicesSidebar');

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuService(null);
      setShowWorkspaceActions(false);
    };
    
    if (contextMenuService || showWorkspaceActions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
    
    return undefined;
  }, [contextMenuService, showWorkspaceActions]);
  
  const getServiceIcon = useCallback((type: string) => {
    // Default icon mapping - will be replaced with configuration from main process
    const defaultIconMap: Record<string, string> = {
      slack: '/service-icons/slack.svg',
      notion: '/service-icons/notion.svg', 
      github: '/service-icons/github.svg',
      jira: '/service-icons/jira.svg',
      teams: '/service-icons/teams.svg',
      discord: '/service-icons/discord.svg',
      trello: '/service-icons/trello.svg',
      asana: '/service-icons/asana.svg',
      linear: '/service-icons/linear.svg',
      clickup: '/service-icons/clickup.png',
      monday: '/service-icons/monday.svg',
      gitlab: '/service-icons/gitlab.svg',
      bitbucket: '/service-icons/bitbucket.png',
      googledrive: '/service-icons/googledrive.svg',
      onedrive: '/service-icons/onedrive.svg',
      dropbox: '/service-icons/dropbox.png',
      figma: '/service-icons/figma.ico',
      miro: '/service-icons/miro.svg',
      salesforce: '/service-icons/salesforce.svg',
      hubspot: '/service-icons/hubspot.svg',
      zendesk: '/service-icons/zendesk.svg',
      intercom: '/service-icons/intercom.svg',
      evernote: '/service-icons/evernote.svg',
      canva: '/service-icons/canva.svg',
      adobe: '/service-icons/adobe.svg',
      analytics: '/service-icons/analytics.svg',
      confluence: '/service-icons/confluence.svg'
    };
    
    // TODO: Get icon mapping from configuration via IPC
    // For now, use the default mapping
    return defaultIconMap[type] || '/service-icons/default.svg';
  }, []);

  if (!workspaceId) {
    return (
      <div className={cn('w-64 h-full bg-muted/30 border-r border-border flex flex-col', className)}>
        <div className="p-4 text-center text-muted-foreground">
          <div className="text-4xl mb-2">🏢</div>
          <p className="text-sm">Select a workspace to view services</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-64 h-full bg-muted/30 border-r border-border flex flex-col', className)}>
      {/* Workspace Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-sm text-foreground">{workspaceName}</h2>
          
          {/* Workspace Actions Dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setShowWorkspaceActions(!showWorkspaceActions);
              }}
              aria-expanded={showWorkspaceActions}
              aria-haspopup="menu"
              aria-label="Workspace actions menu"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
            
            {/* Workspace Actions Menu */}
            {showWorkspaceActions && (
              <div 
                className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
                role="menu"
                aria-orientation="vertical"
              >
                <div
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent flex items-center space-x-2 cursor-pointer"
                  tabIndex={0}
                  onClick={() => {
                    if (workspaceId && onEditWorkspace) {
                      onEditWorkspace(workspaceId);
                    }
                    setShowWorkspaceActions(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (workspaceId && onEditWorkspace) {
                        onEditWorkspace(workspaceId);
                      }
                      setShowWorkspaceActions(false);
                    }
                  }}
                >
                  <Edit className="h-3 w-3" />
                  <span>Edit Workspace</span>
                </div>
                <div
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent flex items-center space-x-2 cursor-pointer"
                  tabIndex={0}
                  onClick={() => {
                    if (workspaceId && onWorkspaceSettings) {
                      onWorkspaceSettings(workspaceId);
                    }
                    setShowWorkspaceActions(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (workspaceId && onWorkspaceSettings) {
                        onWorkspaceSettings(workspaceId);
                      }
                      setShowWorkspaceActions(false);
                    }
                  }}
                >
                  <Settings className="h-3 w-3" />
                  <span>Settings</span>
                </div>
                <div
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent flex items-center space-x-2 cursor-pointer"
                  tabIndex={0}
                  onClick={() => {
                    logger.debug('Console log', undefined, { originalArgs: ['Invite users to workspace:', workspaceId], method: 'console.log' });
                    setShowWorkspaceActions(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      logger.debug('Console log', undefined, { originalArgs: ['Invite users to workspace:', workspaceId], method: 'console.log' });
                      setShowWorkspaceActions(false);
                    }
                  }}
                >
                  <UserPlus className="h-3 w-3" />
                  <span>Invite Users</span>
                </div>
                <div
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent flex items-center space-x-2 cursor-pointer"
                  tabIndex={0}
                  onClick={() => {
                    logger.debug('Console log', undefined, { originalArgs: ['Export workspace:', workspaceId], method: 'console.log' });
                    setShowWorkspaceActions(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      logger.debug('Console log', undefined, { originalArgs: ['Export workspace:', workspaceId], method: 'console.log' });
                      setShowWorkspaceActions(false);
                    }
                  }}
                >
                  <Download className="h-3 w-3" />
                  <span>Export</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{services.length} services</p>
      </div>

      {/* Services List */}
      <div className="flex-1 overflow-y-auto">
        {services.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-2xl mb-2">📱</div>
            <p className="text-sm text-muted-foreground mb-4">No services added yet</p>
            <Button
              size="sm"
              onClick={onAddService}
              className="w-full"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Service
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {services.map((service) => (
              <div key={service.id} className="relative">
                <Button
                  variant={activeServiceId === service.id ? 'primary' : 'ghost'}
                  className={cn(
                    'w-full justify-start items-center h-10 px-3 gap-3',
                    'hover:bg-accent hover:text-accent-foreground',
                    activeServiceId === service.id && 'bg-primary text-primary-foreground'
                  )}
                  onClick={() => onServiceSelect(service.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenuPosition({ x: e.clientX, y: e.clientY });
                    setContextMenuService(service.id);
                  }}
                  disabled={!service.isEnabled}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img 
                      src={getServiceIcon(service.type)} 
                      alt={service.name}
                      className="w-4 h-4 flex-shrink-0 object-contain"
                      onError={(e) => {
                        // Fallback to first letter if icon fails
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const fallback = document.createElement('div');
                          fallback.className = 'w-4 h-4 flex-shrink-0 bg-primary/20 rounded flex items-center justify-center text-xs font-bold';
                          fallback.textContent = service.name[0].toUpperCase();
                          parent.insertBefore(fallback, target.nextSibling);
                        }
                      }}
                    />
                    <span className="text-sm font-medium truncate min-w-0 flex-1">{service.name}</span>
                  </div>
                  {!service.isEnabled && (
                    <div className="flex-shrink-0">
                      <span className="w-2 h-2 bg-gray-400 rounded-full block" />
                    </div>
                  )}
                </Button>
                
                {/* Service Context Menu */}
                {contextMenuService === service.id && (
                  <div 
                    className="fixed bg-card border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
                    style={{ 
                      left: `${contextMenuPosition.x}px`, 
                      top: `${contextMenuPosition.y}px`, 
                      zIndex: 1000 // TODO: Get from configuration
                    }}
                    role="menu"
                    aria-orientation="vertical"
                  >
                    <div
                      role="menuitem"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent flex items-center space-x-2 cursor-pointer"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditService?.(service.id);
                        setContextMenuService(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onEditService?.(service.id);
                          setContextMenuService(null);
                        }
                      }}
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </div>
                    <div
                      role="menuitem"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-destructive/10 focus:bg-destructive/10 text-destructive flex items-center space-x-2 cursor-pointer"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteService?.(service.id);
                        setContextMenuService(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteService?.(service.id);
                          setContextMenuService(null);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Service Button */}
      {services.length > 0 && (
        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddService}
            className="w-full"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Service
          </Button>
        </div>
      )}
    </div>
  );
};

export default ServicesSidebar;