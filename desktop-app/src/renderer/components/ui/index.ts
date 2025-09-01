// Core UI Components
export * from './Button'
export * from './Input'
export * from './Card'
export * from './Avatar'
export * from './Dropdown'
export * from './ResizablePanel'
export * from './Badge'
export * from './Label'

import React from 'react'

// Utilities and types
export * from './utils'
export * from './types'

// Re-export common icons from lucide-react for convenience
export {
  // Navigation
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Home,
  
  // Actions
  Search,
  Plus,
  Minus,
  X,
  Check,
  Edit,
  Trash2,
  Copy,
  Share,
  Download,
  Upload,
  
  // Communication
  Mail,
  Send,
  Reply,
  ReplyAll,
  Forward,
  Phone,
  MessageSquare,
  Globe,
  Bell,
  
  // Calendar & Time
  Calendar,
  Clock,
  CalendarDays,
  
  // Files & Media
  File,
  Folder,
  Image,
  Paperclip,
  
  // Settings & Config
  Settings,
  Sliders,
  Cog,
  Palette,
  
  // Status & Info
  Info,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  
  // User & Profile
  User,
  Users,
  UserPlus,
  Shield,
  
  // Layout & View
  Layout,
  Grid,
  List,
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  
  // Other commonly used
  Star,
  Heart,
  Bookmark,
  Tag,
  Filter,
  SortAsc,
  SortDesc,
  MoreVertical,
  MoreHorizontal,
  Loader2,
  RefreshCw,
  
  // Text formatting
  Bold,
  Italic,
  Underline,
  Link,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  
  // System & status
  Archive,
  MapPin,
  Minimize2,
  Maximize2,
  Moon,
  Sun,
  Laptop,
  Pin,
  Move,
  Keyboard,
  Monitor,
  
  // Additional components for calendar
  Badge as LucideBadge,
  Hash,
  Type,
  Zap,
  MousePointer,
  Inbox
} from 'lucide-react'

// Simple component type exports (components will be created separately if needed)
export type LabelProps = { children: React.ReactNode; className?: string; htmlFor?: string }
export type DialogProps = { children: React.ReactNode }
export type TabsProps = { children: React.ReactNode }
export type SeparatorProps = { className?: string }
export type TooltipProps = { children: React.ReactNode }