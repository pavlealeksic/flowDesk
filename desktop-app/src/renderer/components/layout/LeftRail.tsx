import React, { useState } from 'react'
import { useAppSelector, useAppDispatch } from '../../store'
import { switchWorkspace } from '../../store/slices/workspaceSlice'
import { 
  Button, 
  Avatar, 
  Dropdown, 
  DropdownTrigger, 
  DropdownContent, 
  DropdownItem, 
  DropdownSeparator,
  cn,
  Plus,
  Settings,
  Search,
  Mail,
  Calendar,
  Users,
  Grid,
  ChevronDown,
  MoreVertical
} from '../ui'
import { type BaseComponentProps, type WorkspaceInfo } from '../ui/types'

interface AppLauncherItem {
  id: string
  name: string
  icon: React.ReactNode
  isActive?: boolean
  unreadCount?: number
  shortcut?: string
  onClick?: () => void
}

const defaultApps: AppLauncherItem[] = [
  {
    id: 'search',
    name: 'Search',
    icon: <Search className="h-5 w-5" />,
    shortcut: 'Cmd+K'
  },
  {
    id: 'mail',
    name: 'Mail',
    icon: <Mail className="h-5 w-5" />,
    shortcut: 'Cmd+1',
    unreadCount: 12
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: <Calendar className="h-5 w-5" />,
    shortcut: 'Cmd+2'
  },
  {
    id: 'contacts',
    name: 'Contacts', 
    icon: <Users className="h-5 w-5" />,
    shortcut: 'Cmd+3'
  },
  {
    id: 'apps',
    name: 'Apps',
    icon: <Grid className="h-5 w-5" />,
    shortcut: 'Cmd+9'
  }
]

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceInfo[]
  currentWorkspaceId: string | null
  onSwitchWorkspace: (workspaceId: string) => void
  onCreateWorkspace: () => void
  onManageWorkspaces: () => void
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  currentWorkspaceId,
  onSwitchWorkspace,
  onCreateWorkspace,
  onManageWorkspaces
}) => {
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId)

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 h-12 px-3"
        >
          <Avatar
            size="sm"
            src={currentWorkspace?.icon}
            fallback={currentWorkspace?.name || 'W'}
            className="flex-shrink-0"
          />
          <div className="flex-1 text-left overflow-hidden">
            <div className="font-medium text-sm truncate">
              {currentWorkspace?.name || 'Select Workspace'}
            </div>
            <div className="text-xs text-muted-foreground capitalize">
              {currentWorkspace?.type || 'workspace'}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownTrigger>
      
      <DropdownContent align="start" minWidth={280}>
        {workspaces.map((workspace) => (
          <DropdownItem
            key={workspace.id}
            selected={workspace.id === currentWorkspaceId}
            onSelect={() => onSwitchWorkspace(workspace.id)}
            leftIcon={
              <Avatar
                size="xs"
                src={workspace.icon}
                fallback={workspace.name}
              />
            }
            rightIcon={
              workspace.unreadCount ? (
                <span className="bg-flow-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {workspace.unreadCount > 99 ? '99+' : workspace.unreadCount}
                </span>
              ) : undefined
            }
          >
            <div className="flex flex-col">
              <span className="font-medium">{workspace.name}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {workspace.type}
              </span>
            </div>
          </DropdownItem>
        ))}
        
        <DropdownSeparator />
        
        <DropdownItem
          onSelect={onCreateWorkspace}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Create Workspace
        </DropdownItem>
        
        <DropdownItem
          onSelect={onManageWorkspaces}
          leftIcon={<Settings className="h-4 w-4" />}
        >
          Manage Workspaces
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}

interface AppLauncherProps {
  apps: AppLauncherItem[]
  activeAppId?: string
  onAppSelect: (appId: string) => void
}

const AppLauncher: React.FC<AppLauncherProps> = ({
  apps,
  activeAppId,
  onAppSelect
}) => {
  return (
    <div className="flex flex-col gap-1">
      {apps.map((app) => (
        <Button
          key={app.id}
          variant={app.isActive || app.id === activeAppId ? 'secondary' : 'ghost'}
          className={cn(
            'w-full justify-start gap-3 h-10 px-3 relative',
            'hover:bg-accent hover:text-accent-foreground',
            (app.isActive || app.id === activeAppId) && 'bg-accent text-accent-foreground'
          )}
          onClick={() => onAppSelect(app.id)}
          shortcut={app.shortcut ? {
            key: app.shortcut.split('+').pop() || '',
            modifiers: app.shortcut.includes('Cmd') ? ['cmd'] : []
          } : undefined}
        >
          <span className="flex items-center">
            {app.icon}
          </span>
          
          <span className="flex-1 text-left font-medium">
            {app.name}
          </span>
          
          {app.unreadCount && app.unreadCount > 0 && (
            <span className="bg-flow-primary-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center font-medium">
              {app.unreadCount > 99 ? '99+' : app.unreadCount}
            </span>
          )}
        </Button>
      ))}
    </div>
  )
}

export interface LeftRailProps extends BaseComponentProps {
  width?: number
  collapsed?: boolean
  onToggleCollapse?: (collapsed: boolean) => void
  onAppSelect?: (appId: string) => void
  activeAppId?: string
}

export const LeftRail: React.FC<LeftRailProps> = ({
  width = 280,
  collapsed = false,
  onToggleCollapse,
  onAppSelect,
  activeAppId,
  className,
  'data-testid': testId
}) => {
  const dispatch = useAppDispatch()
  const { workspaces, currentWorkspaceId } = useAppSelector(state => state.workspace)
  const [apps] = useState<AppLauncherItem[]>(defaultApps)

  // Convert workspace data to the format expected by WorkspaceSwitcher
  const workspaceList: WorkspaceInfo[] = Object.values(workspaces).map(ws => ({
    id: ws.id,
    name: ws.name,
    icon: ws.icon,
    type: (ws.type as 'personal' | 'team' | 'organization') || 'personal',
    isActive: ws.id === currentWorkspaceId,
    // Add unread count logic here based on your business logic
    unreadCount: 0
  }))

  const handleSwitchWorkspace = (workspaceId: string) => {
    dispatch(switchWorkspace(workspaceId))
  }

  const handleCreateWorkspace = () => {
    // Implement workspace creation logic
    console.log('Create workspace')
  }

  const handleManageWorkspaces = () => {
    // Implement workspace management logic
    console.log('Manage workspaces')
  }

  const handleAppSelect = (appId: string) => {
    onAppSelect?.(appId)
  }

  if (collapsed) {
    return (
      <div
        className={cn(
          'flex flex-col h-full bg-card border-r border-border',
          'w-16 py-4 px-2 gap-4',
          className
        )}
        data-testid={testId}
      >
        <div className="flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleCollapse?.(false)}
            className="h-10 w-10"
          >
            <Avatar
              size="sm"
              src={workspaceList.find(w => w.id === currentWorkspaceId)?.icon}
              fallback={workspaceList.find(w => w.id === currentWorkspaceId)?.name || 'W'}
            />
          </Button>
        </div>

        <div className="flex flex-col gap-1">
          {apps.slice(0, 4).map((app) => (
            <Button
              key={app.id}
              variant={app.id === activeAppId ? 'secondary' : 'ghost'}
              size="icon"
              className={cn(
                'h-10 w-10 relative',
                app.id === activeAppId && 'bg-accent text-accent-foreground'
              )}
              onClick={() => handleAppSelect(app.id)}
              title={`${app.name}${app.shortcut ? ` (${app.shortcut})` : ''}`}
            >
              {app.icon}
              {app.unreadCount && app.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-flow-primary-500 text-white text-xs h-5 w-5 rounded-full flex items-center justify-center font-medium">
                  {app.unreadCount > 9 ? '9+' : app.unreadCount}
                </span>
              )}
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title="More options"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-card border-r border-border',
        'py-4 px-3 gap-4',
        className
      )}
      style={{ width }}
      data-testid={testId}
    >
      {/* Workspace Switcher */}
      <div className="px-1">
        <WorkspaceSwitcher
          workspaces={workspaceList}
          currentWorkspaceId={currentWorkspaceId}
          onSwitchWorkspace={handleSwitchWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
          onManageWorkspaces={handleManageWorkspaces}
        />
      </div>

      {/* App Launcher */}
      <div className="flex-1 overflow-y-auto">
        <AppLauncher
          apps={apps}
          activeAppId={activeAppId}
          onAppSelect={handleAppSelect}
        />
      </div>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-1 pt-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-10 px-3"
          onClick={() => onToggleCollapse?.(true)}
        >
          <Settings className="h-5 w-5" />
          <span className="flex-1 text-left font-medium">Settings</span>
        </Button>
      </div>
    </div>
  )
}