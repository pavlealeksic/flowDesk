/**
 * Flow Desk Left Rail Component
 * 
 * Primary sidebar with Mail, Calendar buttons and Workspace squares
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { loadWorkspaces } from '../../store/slices/workspaceSlice';
import CreateWorkspaceModal from '../workspace/CreateWorkspaceModal';
import { 
  Button, 
  cn,
  Plus,
  Mail,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Settings,
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem
} from '../ui';

interface Workspace {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  services: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    isEnabled: boolean;
  }>;
  isActive: boolean;
}

interface FlowDeskLeftRailProps {
  onViewSelect: (view: 'mail' | 'calendar' | 'workspace') => void;
  onWorkspaceSelect: (workspaceId: string) => void;
  activeView: 'mail' | 'calendar' | 'workspace';
  activeWorkspaceId?: string;
}

export const FlowDeskLeftRail: React.FC<FlowDeskLeftRailProps> = ({
  onViewSelect,
  onWorkspaceSelect,
  activeView,
  activeWorkspaceId
}) => {
  const dispatch = useAppDispatch();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contextMenuWorkspace, setContextMenuWorkspace] = useState<string | null>(null);
  
  // Get workspaces from Redux store with memoization
  const workspaces = useAppSelector(state => 
    Object.values(state.workspace?.workspaces || {}),
    (left, right) => JSON.stringify(left) === JSON.stringify(right)
  ) as Workspace[];

  const handleCreateWorkspace = useCallback(async (workspaceData: {
    name: string;
    icon: string;
    color: string;
    browserIsolation: 'shared' | 'isolated';
  }) => {
    try {
      const workspaceId = await window.flowDesk.workspace.create({
        name: workspaceData.name,
        icon: workspaceData.icon,
        color: workspaceData.color,
        browserIsolation: workspaceData.browserIsolation
      });
      
      console.log('Created workspace:', workspaceId, workspaceData);
      
      // Refresh workspace list
      dispatch(loadWorkspaces());
      
      // Switch to the new workspace
      onWorkspaceSelect(workspaceId);
      onViewSelect('workspace');
    } catch (error) {
      console.error('Failed to create workspace:', error);
      throw error;
    }
  }, [dispatch, onWorkspaceSelect, onViewSelect]);

  const handleEditWorkspace = useCallback((workspaceId: string) => {
    // TODO: Implement edit workspace modal
    console.log('Edit workspace:', workspaceId);
    setContextMenuWorkspace(null);
  }, []);

  const handleDeleteWorkspace = useCallback(async (workspaceId: string) => {
    try {
      await window.flowDesk.workspace.delete(workspaceId);
      dispatch(loadWorkspaces());
      setContextMenuWorkspace(null);
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  }, [dispatch]);

  const handleWorkspaceSettings = useCallback((workspaceId: string) => {
    // TODO: Implement workspace settings
    console.log('Workspace settings:', workspaceId);
    setContextMenuWorkspace(null);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuWorkspace(null);
    };
    
    if (contextMenuWorkspace) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuWorkspace]);

  return (
    <div className="w-16 bg-background border-r border-border flex flex-col items-center py-4 space-y-4">
      {/* Mail Button */}
      <Button
        variant={activeView === 'mail' ? 'primary' : 'ghost'}
        size="sm"
        className={cn(
          'w-12 h-12 p-0 rounded-xl transition-all',
          activeView === 'mail' && 'bg-primary text-primary-foreground shadow-md'
        )}
        onClick={() => onViewSelect('mail')}
        title="Mail"
      >
        <Mail className="h-5 w-5" />
      </Button>

      {/* Calendar Button */}
      <Button
        variant={activeView === 'calendar' ? 'primary' : 'ghost'}
        size="sm"
        className={cn(
          'w-12 h-12 p-0 rounded-xl transition-all',
          activeView === 'calendar' && 'bg-primary text-primary-foreground shadow-md'
        )}
        onClick={() => onViewSelect('calendar')}
        title="Calendar"
      >
        <Calendar className="h-5 w-5" />
      </Button>

      {/* Divider */}
      <div className="w-8 h-px bg-border my-2" />

      {/* Workspace Squares */}
      <div className="flex flex-col space-y-2">
        {workspaces.map((workspace) => (
          <div key={workspace.id} className="relative">
            <button
              className={cn(
                'w-12 h-12 rounded-xl transition-all cursor-pointer',
                'flex items-center justify-center text-white font-semibold text-sm',
                'hover:scale-105 active:scale-95',
                workspace.id === activeWorkspaceId && activeView === 'workspace'
                  ? 'ring-2 ring-white shadow-lg scale-105'
                  : 'hover:ring-2 hover:ring-white/50'
              )}
              style={{ backgroundColor: workspace.color }}
              onClick={() => {
                onWorkspaceSelect(workspace.id);
                onViewSelect('workspace');
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuWorkspace(workspace.id);
              }}
              title={workspace.name}
            >
            {workspace.icon ? (
              // Show custom image icon if provided
              <img 
                src={workspace.icon} 
                alt={workspace.name} 
                className="w-full h-full rounded-lg object-cover"
                onError={(e) => {
                  // Fallback to abbreviation if image fails to load
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-sm font-bold">${workspace.abbreviation}</span>`;
                  }
                }}
              />
            ) : (
              // Show 2-letter abbreviation if no icon
              <span className="text-sm font-bold">
                {workspace.abbreviation}
              </span>
            )}
            </button>
            
            {/* Context Menu */}
            {contextMenuWorkspace === workspace.id && (
              <div className="absolute left-16 top-0 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center space-x-2"
                  onClick={() => handleEditWorkspace(workspace.id)}
                >
                  <Edit className="h-3 w-3" />
                  <span>Edit</span>
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center space-x-2"
                  onClick={() => handleWorkspaceSettings(workspace.id)}
                >
                  <Settings className="h-3 w-3" />
                  <span>Settings</span>
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center space-x-2"
                  onClick={() => handleDeleteWorkspace(workspace.id)}
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Workspace Button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-12 h-12 p-0 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
        onClick={() => setShowCreateModal(true)}
        title="Add Workspace"
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
      </Button>
      
      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateWorkspace={handleCreateWorkspace}
      />
    </div>
  );
};

export default FlowDeskLeftRail;