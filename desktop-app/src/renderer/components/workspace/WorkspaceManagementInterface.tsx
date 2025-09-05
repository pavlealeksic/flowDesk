import React, { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Settings,
  Globe,
  Shield,
  Users,
  Folder,
  MoreHorizontal,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  TrendingUp
} from 'lucide-react'
import { Button, Card, Input, Avatar, ServiceIcon } from '../ui'
import { cn } from '../ui/utils'
import { useNotifications } from '../ui/NotificationSystem'
import { SmartLoading } from '../ui/LoadingStates'
import type { Workspace } from '../../types/preload'

interface ServiceStatus {
  id: string
  status: 'online' | 'offline' | 'loading' | 'error'
  lastChecked: Date
  responseTime?: number
  uptime?: number
}

interface WorkspaceStats {
  workspaceId: string
  totalServices: number
  activeServices: number
  totalUsers: number
  dataUsage: number
  lastActivity: Date
  weeklyActivity: number[]
}

interface WorkspaceManagementInterfaceProps {
  workspaces: Workspace[]
  currentWorkspaceId: string
  onWorkspaceSelect: (workspaceId: string) => void
  onWorkspaceCreate: (workspace: Omit<Workspace, 'id' | 'created' | 'lastAccessed'>) => void
  onWorkspaceUpdate: (workspaceId: string, updates: Partial<Workspace>) => void
  onWorkspaceDelete: (workspaceId: string) => void
  className?: string
}

const WorkspaceCard: React.FC<{
  workspace: Workspace
  isActive: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  stats?: WorkspaceStats
  serviceStatuses: ServiceStatus[]
}> = ({ 
  workspace, 
  isActive, 
  onSelect, 
  onEdit, 
  onDelete, 
  onDuplicate,
  stats,
  serviceStatuses
}) => {
  const [showActions, setShowActions] = useState(false)

  const activeServices = serviceStatuses.filter(s => s.status === 'online').length
  const totalServices = workspace.services.length

  const getStatusColor = (status: 'online' | 'offline' | 'loading' | 'error') => {
    switch (status) {
      case 'online': return 'text-green-500'
      case 'offline': return 'text-gray-500'
      case 'loading': return 'text-yellow-500'
      case 'error': return 'text-red-500'
    }
  }

  const getStatusIcon = (status: 'online' | 'offline' | 'loading' | 'error') => {
    switch (status) {
      case 'online': return <CheckCircle className="h-3 w-3" />
      case 'offline': return <Clock className="h-3 w-3" />
      case 'loading': return <Activity className="h-3 w-3 animate-pulse" />
      case 'error': return <AlertTriangle className="h-3 w-3" />
    }
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className={cn(
          'relative cursor-pointer transition-all duration-200 hover:shadow-lg',
          isActive && 'ring-2 ring-flow-primary-500 shadow-lg'
        )}
        onClick={onSelect}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                size="md"
                fallback={workspace.name.charAt(0).toUpperCase()}
                className="bg-flow-primary-100 text-flow-primary-700"
              />
              <div>
                <h3 className="font-semibold text-lg">{workspace.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {workspace.services.length} service{workspace.services.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Actions Menu */}
            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEdit}
                    className="h-8 w-8 p-0"
                    title="Edit workspace"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDuplicate}
                    className="h-8 w-8 p-0"
                    title="Duplicate workspace"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title="Delete workspace"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Services Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Services</span>
              <span className={cn(
                'font-medium',
                activeServices === totalServices ? 'text-green-600' : 'text-yellow-600'
              )}>
                {activeServices}/{totalServices} online
              </span>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {workspace.services.slice(0, 6).map((service) => {
                const status = serviceStatuses.find(s => s.id === service.id)
                return (
                  <div
                    key={service.id}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted',
                      status && getStatusColor(status.status)
                    )}
                    title={`${service.name} - ${status?.status || 'unknown'}`}
                  >
                    <ServiceIcon 
                      serviceId={service.type + '-template'}
                      size="sm"
                      fallbackText={service.name}
                    />
                    {status && getStatusIcon(status.status)}
                    <span className="truncate max-w-20">{service.name}</span>
                  </div>
                )
              })}
              
              {workspace.services.length > 6 && (
                <div className="px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
                  +{workspace.services.length - 6} more
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
              <div className="text-center">
                <div className="text-2xl font-bold text-flow-primary-600">
                  {Math.round(stats.dataUsage / 1024 / 1024)}MB
                </div>
                <div className="text-xs text-muted-foreground">Data Used</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-flow-primary-600">
                  {stats.weeklyActivity.reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-xs text-muted-foreground">Weekly Activity</div>
              </div>
            </div>
          )}

          {/* Last accessed */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last accessed</span>
            <span>{workspace.lastAccessed.toLocaleDateString()}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

const CreateWorkspaceModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onCreate: (workspace: Omit<Workspace, 'id' | 'created' | 'lastAccessed'>) => void
}> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  
  const handleCreate = useCallback(() => {
    if (!name.trim()) return
    
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      services: [],
      settings: {
        theme: 'system',
        notifications: true,
        privacy: {
          shareUsage: false,
          allowTracking: false
        }
      }
    })
    
    setName('')
    setDescription('')
    onClose()
  }, [name, description, onCreate, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md p-6"
      >
        <h2 className="text-xl font-semibold mb-4">Create Workspace</h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Name</label>
            <Input
              value={name}
              onChange={setName}
              placeholder="My Workspace"
              autoFocus
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this workspace..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-flow-primary-500"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>
            Create Workspace
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

export const WorkspaceManagementInterface: React.FC<WorkspaceManagementInterfaceProps> = ({
  workspaces,
  currentWorkspaceId,
  onWorkspaceSelect,
  onWorkspaceCreate,
  onWorkspaceUpdate,
  onWorkspaceDelete,
  className
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { success, error, warning } = useNotifications()

  // Mock service statuses - in real app this would come from monitoring
  const serviceStatuses: ServiceStatus[] = useMemo(() => {
    const statuses: ServiceStatus[] = []
    workspaces.forEach(workspace => {
      workspace.services.forEach(service => {
        statuses.push({
          id: service.id,
          status: Math.random() > 0.8 ? 'error' : Math.random() > 0.3 ? 'online' : 'offline',
          lastChecked: new Date(),
          responseTime: Math.floor(Math.random() * 500) + 50,
          uptime: Math.random() * 100
        })
      })
    })
    return statuses
  }, [workspaces])

  // Mock workspace stats
  const workspaceStats: WorkspaceStats[] = useMemo(() => {
    return workspaces.map(workspace => ({
      workspaceId: workspace.id,
      totalServices: workspace.services.length,
      activeServices: serviceStatuses.filter(s => 
        workspace.services.some(svc => svc.id === s.id) && s.status === 'online'
      ).length,
      totalUsers: Math.floor(Math.random() * 10) + 1,
      dataUsage: Math.floor(Math.random() * 1024 * 1024 * 100),
      lastActivity: new Date(),
      weeklyActivity: Array.from({ length: 7 }, () => Math.floor(Math.random() * 50))
    }))
  }, [workspaces, serviceStatuses])

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery) return workspaces
    
    const query = searchQuery.toLowerCase()
    return workspaces.filter(workspace =>
      workspace.name.toLowerCase().includes(query) ||
      workspace.description?.toLowerCase().includes(query) ||
      workspace.services.some(service => 
        service.name.toLowerCase().includes(query)
      )
    )
  }, [workspaces, searchQuery])

  const handleWorkspaceCreate = useCallback((workspaceData: Omit<Workspace, 'id' | 'created' | 'lastAccessed'>) => {
    setIsLoading(true)
    
    try {
      onWorkspaceCreate(workspaceData)
      success('Workspace Created', `"${workspaceData.name}" workspace has been created successfully`)
    } catch (err) {
      error('Creation Failed', 'Failed to create workspace. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [onWorkspaceCreate, success, error])

  const handleWorkspaceDelete = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    if (!workspace) return

    if (workspace.services.length > 0) {
      warning(
        'Workspace Not Empty', 
        `"${workspace.name}" contains ${workspace.services.length} service(s). Remove all services before deleting the workspace.`
      )
      return
    }

    if (window.confirm(`Are you sure you want to delete "${workspace.name}"? This action cannot be undone.`)) {
      onWorkspaceDelete(workspaceId)
      success('Workspace Deleted', `"${workspace.name}" has been deleted`)
    }
  }, [workspaces, onWorkspaceDelete, success, warning])

  const handleWorkspaceDuplicate = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId)
    if (!workspace) return

    const duplicatedWorkspace = {
      ...workspace,
      name: `${workspace.name} (Copy)`,
      services: [] // Don't copy services for security
    }

    delete (duplicatedWorkspace as any).id
    delete (duplicatedWorkspace as any).created
    delete (duplicatedWorkspace as any).lastAccessed

    handleWorkspaceCreate(duplicatedWorkspace)
  }, [workspaces, handleWorkspaceCreate])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your isolated work environments and services
          </p>
        </div>
        
        <Button
          onClick={() => setShowCreateModal(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search workspaces..."
              leftIcon={<Globe className="h-4 w-4" />}
            />
          </div>
          
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Workspace Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <SmartLoading
          isLoading={isLoading}
          hasData={filteredWorkspaces.length > 0}
          className="h-full"
          emptyState={
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Folder className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {searchQuery ? 'No matching workspaces' : 'No workspaces yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                {searchQuery 
                  ? `No workspaces found matching "${searchQuery}"`
                  : 'Create your first workspace to organize your services and maintain privacy isolation'
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Workspace
                </Button>
              )}
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkspaces.map(workspace => {
              const stats = workspaceStats.find(s => s.workspaceId === workspace.id)
              const workspaceServiceStatuses = serviceStatuses.filter(s => 
                workspace.services.some(svc => svc.id === s.id)
              )

              return (
                <WorkspaceCard
                  key={workspace.id}
                  workspace={workspace}
                  isActive={workspace.id === currentWorkspaceId}
                  onSelect={() => onWorkspaceSelect(workspace.id)}
                  onEdit={() => {
                    // TODO: Implement edit modal
                    console.log('Edit workspace:', workspace.id)
                  }}
                  onDelete={() => handleWorkspaceDelete(workspace.id)}
                  onDuplicate={() => handleWorkspaceDuplicate(workspace.id)}
                  stats={stats}
                  serviceStatuses={workspaceServiceStatuses}
                />
              )
            })}
          </div>
        </SmartLoading>
      </div>

      {/* Create Workspace Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateWorkspaceModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onCreate={handleWorkspaceCreate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}