/**
 * @fileoverview Flow Desk Left Rail Component - Primary navigation sidebar
 * 
 * This component provides the primary navigation interface for Flow Desk, displaying
 * workspace squares and providing workspace management functionality. It serves as
 * the leftmost sidebar in the application layout.
 * 
 * Key features:
 * - Visual workspace representation with color-coded squares
 * - Workspace creation through modal dialog
 * - Context menus for workspace operations
 * - Keyboard navigation and accessibility support
 * - Performance optimized with memoization
 * - Visual feedback for active workspace
 * 
 * @author Flow Desk Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { loadWorkspaces } from '../../store/slices/workspaceSlice';
import CreateWorkspaceModal from '../workspace/CreateWorkspaceModal';
import { 
  Button, 
  cn,
  Plus,
  Edit,
  Trash2,
  Settings
} from '../ui';

/**
 * Workspace interface for left rail display
 * @interface Workspace
 * @property {string} id - Unique workspace identifier
 * @property {string} name - Display name of the workspace
 * @property {string} abbreviation - 2-letter abbreviation for workspace square
 * @property {string} color - Hex color code for workspace theming
 * @property {Array} services - Array of services within the workspace
 * @property {boolean} isActive - Whether this workspace is currently active
 */
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

/**
 * Props for the FlowDeskLeftRail component
 * @interface FlowDeskLeftRailProps
 * @property {function} onWorkspaceSelect - Callback when a workspace is selected
 * @property {string} [activeWorkspaceId] - ID of the currently active workspace
 */
interface FlowDeskLeftRailProps {
  onWorkspaceSelect: (workspaceId: string) => void;
  activeWorkspaceId?: string;
}

/**
 * Flow Desk Left Rail Component - Primary workspace navigation
 * 
 * This component renders the primary sidebar containing workspace squares that users
 * can click to switch between different workspace contexts. Each workspace is
 * represented by a colored square with either a custom icon or 2-letter abbreviation.
 * 
 * Features:
 * - Visual workspace representation with custom colors and icons
 * - Context menu for workspace operations (edit, settings, delete)
 * - Add new workspace button with creation modal
 * - Accessibility support with proper ARIA attributes
 * - Performance optimized with React.memo and memoized workspaces
 * - Visual feedback for active workspace with scaling and ring effects
 * 
 * @component
 * @param {FlowDeskLeftRailProps} props - Component props
 * @returns {JSX.Element} The left rail navigation interface
 * 
 * @example
 * ```tsx
 * <FlowDeskLeftRail
 *   onWorkspaceSelect={handleWorkspaceSelect}
 *   activeWorkspaceId={currentWorkspace?.id}
 * />
 * ```
 */
export const FlowDeskLeftRail: React.FC<FlowDeskLeftRailProps> = memo(({
  onWorkspaceSelect,
  activeWorkspaceId
}) => {
  const dispatch = useAppDispatch();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contextMenuWorkspace, setContextMenuWorkspace] = useState<string | null>(null);
  
  // Get workspaces from Redux store with optimized selector
  const workspaces = useAppSelector(state => 
    Object.values(state.workspace?.workspaces || {})
  ) as Workspace[];

  // Memoize workspaces to prevent unnecessary re-renders
  const memoizedWorkspaces = useMemo(() => workspaces, [workspaces.length, workspaces.map(w => w.id).join(',')])

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
    } catch (error) {
      console.error('Failed to create workspace:', error);
      throw error;
    }
  }, [dispatch, onWorkspaceSelect]);

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
    
    return undefined;
  }, [contextMenuWorkspace]);

  return (
    <div 
      className="w-16 h-full bg-background border-r border-border flex flex-col items-center py-4 px-2.5 space-y-4"
      role="tablist"
      aria-label="Application views"
    >
      {/* Workspace Squares */}
      <div 
        className="flex flex-col space-y-2"
        role="group"
        aria-label="Workspaces"
      >
        {memoizedWorkspaces.map((workspace) => (
          <div key={workspace.id} className="relative">
            <button
              className={cn(
                'w-12 h-12 rounded-xl transition-all cursor-pointer',
                'flex items-center justify-center text-white font-semibold text-sm',
                'hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                workspace.id === activeWorkspaceId
                  ? 'ring-2 ring-white shadow-lg scale-105'
                  : 'hover:ring-2 hover:ring-white/50'
              )}
              style={{ backgroundColor: workspace.color }}
              onClick={() => {
                onWorkspaceSelect(workspace.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuWorkspace(workspace.id);
              }}
              aria-label={`${workspace.name} workspace`}
              aria-pressed={workspace.id === activeWorkspaceId}
              role="tab"
              aria-selected={workspace.id === activeWorkspaceId}
              aria-controls="main-content"
            >
            {(workspace as any).icon ? (
              // Show custom image icon if provided
              <img 
                src={(workspace as any).icon} 
                alt={`${workspace.name} workspace icon`}
                className="w-full h-full rounded-lg object-cover"
                onError={(e) => {
                  // Fallback to abbreviation if image fails to load
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-sm font-bold" aria-hidden="true">${workspace.abbreviation}</span>`;
                  }
                }}
              />
            ) : (
              // Show 2-letter abbreviation if no icon
              <span className="text-sm font-bold" aria-hidden="true">
                {workspace.abbreviation}
              </span>
            )}
            </button>
            
            {/* Context Menu */}
            {contextMenuWorkspace === workspace.id && (
              <div 
                className="absolute left-16 top-0 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
                role="menu"
                aria-label={`${workspace.name} workspace options`}
              >
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center space-x-2 focus:bg-accent focus:outline-none"
                  onClick={() => handleEditWorkspace(workspace.id)}
                  role="menuitem"
                  aria-label={`Edit ${workspace.name} workspace`}
                >
                  <Edit className="h-3 w-3" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center space-x-2 focus:bg-accent focus:outline-none"
                  onClick={() => handleWorkspaceSettings(workspace.id)}
                  role="menuitem"
                  aria-label={`Settings for ${workspace.name} workspace`}
                >
                  <Settings className="h-3 w-3" aria-hidden="true" />
                  <span>Settings</span>
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-destructive/10 text-destructive flex items-center space-x-2 focus:bg-destructive/10 focus:outline-none"
                  onClick={() => handleDeleteWorkspace(workspace.id)}
                  role="menuitem"
                  aria-label={`Delete ${workspace.name} workspace`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
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
        aria-label="Add new workspace"
        description="Create a new workspace for organizing your services"
      >
        <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </Button>
      
      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateWorkspace={handleCreateWorkspace}
      />
    </div>
  );
});

export default FlowDeskLeftRail;