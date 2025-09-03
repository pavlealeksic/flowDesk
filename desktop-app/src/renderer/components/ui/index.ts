// Core UI Components
export * from './Button'
export * from './Input'
export * from './Card'
export * from './Avatar'
export * from './Dropdown'
export * from './Select'
export * from './ResizablePanel'
export * from './Badge'
export * from './Label'
export * from './Modal'

import React from 'react'

// Utilities and types
export * from './utils'
export * from './types'

// For now, export all icons to get the build working
// TODO: Optimize to export only used icons once we have a complete list
export * from 'lucide-react'

// Lazy-loaded icon groups for better code splitting
export const getNavigationIcons = async () => {
  const icons = await import('lucide-react')
  return {
    ArrowLeft: icons.ArrowLeft,
    ArrowRight: icons.ArrowRight,
    Home: icons.Home,
  }
}

export const getActionIcons = async () => {
  const icons = await import('lucide-react')
  return {
    Edit: icons.Edit,
    Trash2: icons.Trash2,
    Copy: icons.Copy,
    Share: icons.Share,
    Download: icons.Download,
    Upload: icons.Upload,
  }
}

export const getCommunicationIcons = async () => {
  const icons = await import('lucide-react')
  return {
    Send: icons.Send,
    Reply: icons.Reply,
    ReplyAll: icons.ReplyAll,
    Forward: icons.Forward,
    Phone: icons.Phone,
    MessageSquare: icons.MessageSquare,
    Globe: icons.Globe,
  }
}

// Simple component type exports (components will be created separately if needed)
export type LabelProps = { children: React.ReactNode; className?: string; htmlFor?: string }
export type DialogProps = { children: React.ReactNode }
export type TabsProps = { children: React.ReactNode }
export type SeparatorProps = { className?: string }
export type TooltipProps = { children: React.ReactNode }