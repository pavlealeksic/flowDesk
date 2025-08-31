import { type ReactNode } from 'react'

// Base component props
export interface BaseComponentProps {
  className?: string
  children?: ReactNode
  'data-testid'?: string
}

// Size variants
export type SizeVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Color variants  
export type ColorVariant = 'primary' | 'secondary' | 'accent' | 'destructive' | 'ghost' | 'outline'

// State variants
export type StateVariant = 'default' | 'hover' | 'active' | 'disabled' | 'loading'

// Layout variants
export type LayoutVariant = 'default' | 'compact' | 'comfortable' | 'spacious'

// Theme variants
export type ThemeVariant = 'light' | 'dark' | 'auto'

// Keyboard shortcut type
export interface KeyboardShortcut {
  key: string
  modifiers?: Array<'cmd' | 'ctrl' | 'alt' | 'shift'>
  description?: string
}

// Common component interfaces
export interface InteractiveComponentProps extends BaseComponentProps {
  disabled?: boolean
  loading?: boolean
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void
  'aria-label'?: string
  'aria-describedby'?: string
  role?: string
  tabIndex?: number
  shortcut?: KeyboardShortcut
}

export interface FormComponentProps extends InteractiveComponentProps {
  name?: string
  value?: string | number | boolean
  onChange?: (value: any, event?: React.ChangeEvent<HTMLElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void
  placeholder?: string
  required?: boolean
  error?: string
  helperText?: string
  id?: string
}

// Layout and positioning
export interface PositionProps {
  top?: number | string
  right?: number | string
  bottom?: number | string
  left?: number | string
  x?: number | string
  y?: number | string
}

export interface DimensionProps {
  width?: number | string
  height?: number | string
  maxWidth?: number | string
  maxHeight?: number | string
  minWidth?: number | string
  minHeight?: number | string
}

// Animation and transitions
export interface AnimationProps {
  animate?: boolean
  duration?: 'fast' | 'base' | 'slow' | number
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | string
  delay?: number
}

// Context menu item
export interface ContextMenuItem {
  id: string
  label: string
  icon?: ReactNode
  shortcut?: KeyboardShortcut
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  submenu?: ContextMenuItem[]
  onClick?: () => void
}

// Notification types
export interface NotificationData {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  icon?: ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  persistent?: boolean
  timestamp: Date
  source?: string
}

// Workspace types
export interface WorkspaceInfo {
  id: string
  name: string
  icon?: string
  type: 'personal' | 'team' | 'organization'
  color?: string
  isActive?: boolean
  unreadCount?: number
}

// Plugin types  
export interface PluginInfo {
  id: string
  name: string
  icon?: ReactNode
  description?: string
  version?: string
  enabled?: boolean
  category?: string
}

// Search types
export interface SearchResult {
  id: string
  type: 'email' | 'contact' | 'event' | 'file' | 'note'
  title: string
  subtitle?: string
  content?: string
  icon?: ReactNode
  source?: string
  timestamp?: Date
  relevance?: number
}

export interface SearchFilter {
  id: string
  label: string
  type: 'text' | 'date' | 'select' | 'boolean'
  value: any
  options?: Array<{ label: string; value: any }>
}

// Mail types
export interface EmailThread {
  id: string
  subject: string
  participants: string[]
  messageCount: number
  lastMessage: Date
  isUnread: boolean
  isStarred: boolean
  hasAttachments: boolean
  labels: string[]
  folder: string
}

export interface EmailMessage {
  id: string
  threadId: string
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  body: string
  htmlBody?: string
  isRead: boolean
  timestamp: Date
  attachments: Array<{
    id: string
    name: string
    size: number
    type: string
  }>
}

// Calendar types
export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  allDay?: boolean
  location?: string
  attendees?: Array<{
    email: string
    name?: string
    status?: 'accepted' | 'declined' | 'tentative' | 'pending'
  }>
  calendar?: {
    id: string
    name: string
    color: string
  }
  recurrence?: string
  reminders?: Array<{
    method: 'popup' | 'email'
    minutes: number
  }>
}