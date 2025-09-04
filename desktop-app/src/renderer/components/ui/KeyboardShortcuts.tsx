import React, { useEffect, useCallback, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Command, Search, X, Keyboard } from 'lucide-react'
import { cn } from './utils'
import { Button } from './Button'

export interface KeyboardShortcut {
  id: string
  keys: string[] // e.g., ['cmd', 'k'] or ['ctrl', 'shift', 'n']
  description: string
  category?: string
  action: () => void
  condition?: () => boolean // Optional condition to enable/disable shortcut
}

interface KeyboardShortcutManagerProps {
  shortcuts: KeyboardShortcut[]
  children: React.ReactNode
}

// Platform detection
const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')

// Key mapping for display
const keyDisplayMap: Record<string, string> = {
  cmd: isMac ? '⌘' : 'Ctrl',
  ctrl: isMac ? '⌃' : 'Ctrl',
  alt: isMac ? '⌥' : 'Alt',
  shift: isMac ? '⇧' : 'Shift',
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  delete: 'Del',
  tab: '⇥',
  space: 'Space',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→'
}

// Normalize keys for cross-platform compatibility
const normalizeKeys = (keys: string[]): string[] => {
  return keys.map(key => {
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'cmd' && !isMac) return 'ctrl'
    if (lowerKey === 'ctrl' && isMac) return 'cmd'
    return lowerKey
  })
}

// Convert event to key combination
const getKeyCombination = (event: KeyboardEvent): string[] => {
  const keys: string[] = []
  
  if (event.metaKey) keys.push('cmd')
  if (event.ctrlKey && !event.metaKey) keys.push('ctrl')
  if (event.altKey) keys.push('alt')
  if (event.shiftKey) keys.push('shift')
  
  const key = event.key.toLowerCase()
  if (!['meta', 'control', 'alt', 'shift'].includes(key)) {
    keys.push(key)
  }
  
  return keys
}

// Check if key combinations match
const keyCombinationsMatch = (combo1: string[], combo2: string[]): boolean => {
  if (combo1.length !== combo2.length) return false
  
  const normalized1 = normalizeKeys(combo1).sort()
  const normalized2 = normalizeKeys(combo2).sort()
  
  return normalized1.every((key, index) => key === normalized2[index])
}

// Format keys for display
const formatKeys = (keys: string[]): string => {
  return keys.map(key => keyDisplayMap[key.toLowerCase()] || key.toUpperCase()).join(' + ')
}

// Shortcut display component
const ShortcutDisplay: React.FC<{ keys: string[]; className?: string }> = ({ keys, className }) => (
  <kbd className={cn(
    'inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-muted border border-border rounded',
    className
  )}>
    {formatKeys(keys)}
  </kbd>
)

// Help modal component
const ShortcutsHelpModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  shortcuts: KeyboardShortcut[]
}> = ({ isOpen, onClose, shortcuts }) => {
  const [filter, setFilter] = useState('')

  const groupedShortcuts = useMemo(() => {
    const filtered = shortcuts.filter(shortcut =>
      shortcut.description.toLowerCase().includes(filter.toLowerCase()) ||
      shortcut.category?.toLowerCase().includes(filter.toLowerCase()) ||
      formatKeys(shortcut.keys).toLowerCase().includes(filter.toLowerCase())
    )

    const grouped = filtered.reduce((acc, shortcut) => {
      const category = shortcut.category || 'General'
      if (!acc[category]) acc[category] = []
      acc[category].push(shortcut)
      return acc
    }, {} as Record<string, KeyboardShortcut[]>)

    return grouped
  }, [shortcuts, filter])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Keyboard className="h-6 w-6" />
            <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-flow-primary-500"
            />
          </div>
        </div>

        {/* Shortcuts list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center justify-between py-2">
                    <span className="text-sm">{shortcut.description}</span>
                    <ShortcutDisplay keys={shortcut.keys} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {Object.keys(groupedShortcuts).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No shortcuts found for "{filter}"</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// Main keyboard shortcut manager
export const KeyboardShortcutManager: React.FC<KeyboardShortcutManagerProps> = ({
  shortcuts,
  children
}) => {
  const [showHelp, setShowHelp] = useState(false)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement)?.contentEditable === 'true') {
      return
    }

    const pressedKeys = getKeyCombination(event)
    
    // Find matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => {
      if (shortcut.condition && !shortcut.condition()) return false
      return keyCombinationsMatch(pressedKeys, shortcut.keys)
    })

    if (matchingShortcut) {
      event.preventDefault()
      event.stopPropagation()
      matchingShortcut.action()
    }
  }, [shortcuts])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  // Add help shortcut
  const allShortcuts = useMemo(() => [
    ...shortcuts,
    {
      id: 'show-shortcuts-help',
      keys: ['?'],
      description: 'Show keyboard shortcuts',
      category: 'Help',
      action: () => setShowHelp(true)
    }
  ], [shortcuts])

  return (
    <>
      {children}
      <AnimatePresence>
        {showHelp && (
          <ShortcutsHelpModal
            isOpen={showHelp}
            onClose={() => setShowHelp(false)}
            shortcuts={allShortcuts}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// Hook for using shortcuts in components
export const useKeyboardShortcuts = (shortcuts: Omit<KeyboardShortcut, 'id'>[]) => {
  const shortcutsWithIds = useMemo(() => 
    shortcuts.map((shortcut, index) => ({
      ...shortcut,
      id: `shortcut-${index}`
    }))
  , [shortcuts])

  return shortcutsWithIds
}

// Common shortcut definitions for reuse
export const commonShortcuts = {
  // Navigation
  goToMail: { keys: ['cmd', '1'], description: 'Go to Mail', category: 'Navigation' },
  goToCalendar: { keys: ['cmd', '2'], description: 'Go to Calendar', category: 'Navigation' },
  goToWorkspace: { keys: ['cmd', '3'], description: 'Go to Workspace', category: 'Navigation' },
  
  // Search
  globalSearch: { keys: ['cmd', 'k'], description: 'Global Search', category: 'Search' },
  searchMail: { keys: ['cmd', 'shift', 'f'], description: 'Search Mail', category: 'Search' },
  
  // Mail actions
  compose: { keys: ['c'], description: 'Compose Email', category: 'Mail' },
  reply: { keys: ['r'], description: 'Reply', category: 'Mail' },
  replyAll: { keys: ['shift', 'r'], description: 'Reply All', category: 'Mail' },
  forward: { keys: ['f'], description: 'Forward', category: 'Mail' },
  archive: { keys: ['e'], description: 'Archive', category: 'Mail' },
  delete: { keys: ['backspace'], description: 'Delete', category: 'Mail' },
  markRead: { keys: ['i'], description: 'Mark as Read/Unread', category: 'Mail' },
  star: { keys: ['s'], description: 'Star/Unstar', category: 'Mail' },
  
  // Calendar actions
  newEvent: { keys: ['n'], description: 'New Event', category: 'Calendar' },
  todayView: { keys: ['t'], description: 'Today View', category: 'Calendar' },
  dayView: { keys: ['d'], description: 'Day View', category: 'Calendar' },
  weekView: { keys: ['w'], description: 'Week View', category: 'Calendar' },
  monthView: { keys: ['m'], description: 'Month View', category: 'Calendar' },
  
  // General
  refresh: { keys: ['cmd', 'r'], description: 'Refresh', category: 'General' },
  settings: { keys: ['cmd', ','], description: 'Settings', category: 'General' },
  help: { keys: ['?'], description: 'Show Help', category: 'General' }
}

// Component for displaying a single shortcut hint
export const ShortcutHint: React.FC<{
  shortcut: Pick<KeyboardShortcut, 'keys' | 'description'>
  className?: string
}> = ({ shortcut, className }) => (
  <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
    <span>{shortcut.description}</span>
    <ShortcutDisplay keys={shortcut.keys} className="ml-auto" />
  </div>
)

// Inline shortcut display for buttons and menu items
export const InlineShortcut: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="ml-auto text-xs text-muted-foreground font-mono">
    {formatKeys(keys)}
  </span>
)