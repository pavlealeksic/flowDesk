import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Card,
  Button,
  Avatar,
  cn,
  X,
  Maximize,
  Minimize,
  MoreHorizontal,
  Move,
  Pin,
  Settings,
  RefreshCw
} from '../ui'
import { type BaseComponentProps, type PluginInfo } from '../ui/types'

interface PanelPosition {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

interface PluginPanel extends PluginInfo {
  position: PanelPosition
  isDocked: boolean
  isMinimized: boolean
  isPinned: boolean
  content?: React.ReactNode
}

// Mock plugin data (removed for production)
const mockPlugins: PluginPanel[] = [];

interface DraggablePluginPanelProps {
  plugin: PluginPanel
  onPositionChange: (id: string, position: PanelPosition) => void
  onClose: (id: string) => void
  onMinimize: (id: string) => void
  onMaximize: (id: string) => void
  onPin: (id: string) => void
  onDock: (id: string) => void
  onSettings: (id: string) => void
  isActive: boolean
  onActivate: (id: string) => void
}

const DraggablePluginPanel: React.FC<DraggablePluginPanelProps> = ({
  plugin,
  onPositionChange,
  onClose,
  onMinimize,
  onMaximize,
  onPin,
  onDock,
  onSettings,
  isActive,
  onActivate
}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) return
    if ((e.target as HTMLElement).closest('button')) return

    setIsDragging(true)
    setDragStart({
      x: e.clientX - plugin.position.x,
      y: e.clientY - plugin.position.y
    })
    onActivate(plugin.id)
  }, [plugin.position.x, plugin.position.y, plugin.id, onActivate])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: plugin.position.width,
      height: plugin.position.height
    })
  }, [plugin.position.width, plugin.position.height])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - plugin.position.width, e.clientX - dragStart.x))
      const newY = Math.max(0, Math.min(window.innerHeight - plugin.position.height, e.clientY - dragStart.y))
      
      onPositionChange(plugin.id, {
        ...plugin.position,
        x: newX,
        y: newY
      })
    } else if (isResizing) {
      const newWidth = Math.max(200, resizeStart.width + (e.clientX - resizeStart.x))
      const newHeight = Math.max(150, resizeStart.height + (e.clientY - resizeStart.y))
      
      onPositionChange(plugin.id, {
        ...plugin.position,
        width: newWidth,
        height: newHeight
      })
    }
  }, [isDragging, isResizing, dragStart, resizeStart, plugin, onPositionChange])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'none'
      document.body.style.cursor = isDragging ? 'grabbing' : 'nw-resize'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  if (plugin.isMinimized) {
    return (
      <div
        className={cn(
          'fixed bottom-4 bg-card border border-border rounded-lg shadow-lg',
          'flex items-center gap-2 px-3 py-2 cursor-pointer hover:shadow-xl transition-all',
          'z-50'
        )}
        style={{
          left: plugin.position.x,
          transform: 'translateY(0)'
        }}
        onClick={() => onMinimize(plugin.id)}
      >
        <div className="w-3 h-3 rounded-full bg-flow-primary-500" />
        <span className="text-sm font-medium">{plugin.name}</span>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed bg-card border rounded-lg shadow-lg overflow-hidden',
        'transition-shadow duration-200',
        isActive && 'shadow-xl ring-2 ring-flow-primary-500/20',
        isDragging && 'shadow-2xl',
        plugin.isPinned && 'ring-1 ring-yellow-400/30'
      )}
      style={{
        left: plugin.position.x,
        top: plugin.position.y,
        width: plugin.position.width,
        height: plugin.position.height,
        zIndex: plugin.position.zIndex
      }}
      onMouseDown={handleMouseDown}
      onClick={() => onActivate(plugin.id)}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className={cn(
          'flex items-center justify-between p-2 bg-muted/30 border-b border-border',
          'cursor-grab active:cursor-grabbing select-none',
          isDragging && 'cursor-grabbing'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <div className={cn(
              'w-3 h-3 rounded-full',
              plugin.enabled ? 'bg-green-500' : 'bg-gray-400'
            )} />
            {plugin.isPinned && (
              <Pin className="h-3 w-3 text-yellow-500" />
            )}
          </div>
          
          <span className="font-medium text-sm truncate">{plugin.name}</span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onSettings(plugin.id)
            }}
            title="Settings"
          >
            <Settings className="h-3 w-3" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onPin(plugin.id)
            }}
            title={plugin.isPinned ? "Unpin" : "Pin"}
          >
            <Pin className={cn(
              'h-3 w-3',
              plugin.isPinned && 'text-yellow-500'
            )} />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onMinimize(plugin.id)
            }}
            title="Minimize"
          >
            <Minimize className="h-3 w-3" />
          </Button>

          {!plugin.isDocked && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation()
                onDock(plugin.id)
              }}
              title="Dock"
            >
              <Move className="h-3 w-3" />
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onClose(plugin.id)
            }}
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden h-full">
        {plugin.content || (
          <div className="p-4 flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">🔌</div>
            <h3 className="font-medium mb-1">{plugin.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{plugin.description}</p>
            <div className="text-xs text-muted-foreground">v{plugin.version}</div>
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize opacity-0 hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/50" />
      </div>
    </div>
  )
}

interface DockedPluginPanelProps {
  plugin: PluginPanel
  onClose: (id: string) => void
  onFloat: (id: string) => void
  onSettings: (id: string) => void
  isActive: boolean
  onActivate: (id: string) => void
}

const DockedPluginPanel: React.FC<DockedPluginPanelProps> = ({
  plugin,
  onClose,
  onFloat,
  onSettings,
  isActive,
  onActivate
}) => {
  return (
    <Card
      variant="outlined"
      padding="none"
      className={cn(
        'h-full flex flex-col overflow-hidden transition-all',
        isActive && 'ring-2 ring-flow-primary-500/20'
      )}
      onClick={() => onActivate(plugin.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn(
            'w-2 h-2 rounded-full',
            plugin.enabled ? 'bg-green-500' : 'bg-gray-400'
          )} />
          <span className="font-medium text-sm truncate">{plugin.name}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onSettings(plugin.id)
            }}
            title="Settings"
          >
            <Settings className="h-3 w-3" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onFloat(plugin.id)
            }}
            title="Float"
          >
            <Maximize className="h-3 w-3" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onClose(plugin.id)
            }}
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {plugin.content || (
          <div className="p-4 flex flex-col items-center justify-center h-full text-center">
            <div className="text-2xl mb-2">🔌</div>
            <h3 className="font-medium text-sm mb-1">{plugin.name}</h3>
            <p className="text-xs text-muted-foreground">{plugin.description}</p>
          </div>
        )}
      </div>
    </Card>
  )
}

export interface PluginPanelsProps extends BaseComponentProps {
  plugins?: PluginPanel[]
  dockedPanelWidth?: number
  onPluginClose?: (pluginId: string) => void
  onPluginSettings?: (pluginId: string) => void
}

export const PluginPanels: React.FC<PluginPanelsProps> = ({
  plugins = mockPlugins,
  dockedPanelWidth = 300,
  onPluginClose,
  onPluginSettings,
  className,
  'data-testid': testId
}) => {
  const [pluginStates, setPluginStates] = useState<{ [key: string]: PluginPanel }>(
    plugins.reduce((acc, plugin) => ({ ...acc, [plugin.id]: plugin }), {})
  )
  const [activePluginId, setActivePluginId] = useState<string | null>(null)
  const [maxZIndex, setMaxZIndex] = useState(10)

  const dockedPlugins = Object.values(pluginStates).filter(p => p.isDocked && !p.isMinimized)
  const floatingPlugins = Object.values(pluginStates).filter(p => !p.isDocked)

  const updatePlugin = useCallback((id: string, updates: Partial<PluginPanel>) => {
    setPluginStates(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }))
  }, [])

  const handlePositionChange = useCallback((id: string, position: PanelPosition) => {
    updatePlugin(id, { position })
  }, [updatePlugin])

  const handleClose = useCallback((id: string) => {
    setPluginStates(prev => {
      const newState = { ...prev }
      delete newState[id]
      return newState
    })
    onPluginClose?.(id)
  }, [onPluginClose])

  const handleMinimize = useCallback((id: string) => {
    updatePlugin(id, { isMinimized: !pluginStates[id].isMinimized })
  }, [updatePlugin, pluginStates])

  const handlePin = useCallback((id: string) => {
    updatePlugin(id, { isPinned: !pluginStates[id].isPinned })
  }, [updatePlugin, pluginStates])

  const handleDock = useCallback((id: string) => {
    updatePlugin(id, { isDocked: true })
  }, [updatePlugin])

  const handleFloat = useCallback((id: string) => {
    updatePlugin(id, { 
      isDocked: false,
      position: { ...pluginStates[id].position, x: 100, y: 100 }
    })
  }, [updatePlugin, pluginStates])

  const handleActivate = useCallback((id: string) => {
    setActivePluginId(id)
    if (!pluginStates[id].isDocked) {
      const newZIndex = maxZIndex + 1
      setMaxZIndex(newZIndex)
      updatePlugin(id, {
        position: { ...pluginStates[id].position, zIndex: newZIndex }
      })
    }
  }, [pluginStates, maxZIndex, updatePlugin])

  const handleSettings = useCallback((id: string) => {
    onPluginSettings?.(id)
  }, [onPluginSettings])

  return (
    <div className={cn('relative h-full', className)} data-testid={testId}>
      {/* Docked Panels */}
      {dockedPlugins.length > 0 && (
        <div
          className="absolute right-0 top-0 bottom-0 bg-background border-l border-border flex flex-col"
          style={{ width: dockedPanelWidth }}
        >
          {dockedPlugins.map((plugin, index) => (
            <div
              key={plugin.id}
              className="flex-1 min-h-0"
              style={{
                borderBottom: index < dockedPlugins.length - 1 ? '1px solid hsl(var(--border))' : 'none'
              }}
            >
              <DockedPluginPanel
                plugin={plugin}
                onClose={handleClose}
                onFloat={handleFloat}
                onSettings={handleSettings}
                isActive={activePluginId === plugin.id}
                onActivate={handleActivate}
              />
            </div>
          ))}
        </div>
      )}

      {/* Floating Panels */}
      {floatingPlugins.map(plugin => (
        <DraggablePluginPanel
          key={plugin.id}
          plugin={plugin}
          onPositionChange={handlePositionChange}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onMaximize={() => {}} // Not implemented in this example
          onPin={handlePin}
          onDock={handleDock}
          onSettings={handleSettings}
          isActive={activePluginId === plugin.id}
          onActivate={handleActivate}
        />
      ))}
    </div>
  )
}