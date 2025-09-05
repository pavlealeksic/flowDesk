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
export * from './ServiceIcon'

// Export compound select components that match expected API
export { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './CompoundSelect';

export { Avatar as AvatarFallback } from './Avatar';

// Note: Proper Tabs components are defined below in the component implementations section

import React from 'react'

// Utilities and types
export * from './utils'
export * from './types'

// Optimized icon exports - only export commonly used icons to reduce bundle size
export { 
  // Navigation icons
  ArrowLeft,
  ArrowRight, 
  Home,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  
  // Action icons
  Edit,
  Trash2,
  Copy,
  Share,
  Download,
  Upload,
  Save,
  Plus,
  Minus,
  RotateCcw,
  
  // Communication icons
  Send,
  Reply,
  ReplyAll,
  Forward,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  
  // Status icons
  Check,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  
  // UI icons
  Settings,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  EyeOff,
  User,
  Users,
  Calendar,
  Clock,
  Star,
  Heart,
  Bookmark,
  Tag,
  File,
  Folder,
  Image,
  Paperclip,
  
  // System icons  
  Power,
  Wifi,
  Battery,
  Signal,
  Volume2,
  VolumeX,
  
  // Additional icons
  RotateCcw as Sync,
  File as Template,
  
  type LucideProps,
  type LucideIcon
} from 'lucide-react'

// Icon aliases for backward compatibility - import directly from lucide-react
export { RotateCcw as Refresh } from 'lucide-react';

// For backwards compatibility, still provide the complete export but warn about bundle size
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

// Simple component implementations for missing UI components
export const Dialog: React.FC<{ 
  children: React.ReactNode; 
  open?: boolean; 
  onOpenChange?: (open: boolean) => void 
}> = ({ children }) => {
  return <div>{children}</div>;
};

export const DialogContent: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};

export const DialogHeader: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};

export const DialogTitle: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className }) => {
  return <h2 className={className}>{children}</h2>;
};

export const DialogTrigger: React.FC<{ 
  children: React.ReactNode; 
  asChild?: boolean 
}> = ({ children }) => {
  return <div>{children}</div>;
};

export const Alert: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  variant?: string 
}> = ({ children, className }) => {
  return <div className={`alert ${className || ''}`}>{children}</div>;
};

export const AlertDescription: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};

export const Progress: React.FC<{ value: number; max?: number; className?: string }> = ({ value, max = 100, className }) => (
  <div className={`progress ${className || ''}`}>
    <div style={{ width: `${(value / max) * 100}%` }} />
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }> = ({ className, ...props }) => (
  <textarea className={`textarea ${className || ''}`} {...props} />
);

export const ScrollArea: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`scroll-area ${className || ''}`}>{children}</div>
);

export const Switch: React.FC<{ 
  checked: boolean; 
  onCheckedChange: (checked: boolean) => void; 
  id?: string;
  className?: string;
}> = ({ checked, onCheckedChange, id, className }) => (
  <input 
    type="checkbox" 
    checked={checked} 
    onChange={(e) => onCheckedChange(e.target.checked)}
    id={id}
    className={`switch ${className || ''}`}
  />
);

export const Tabs: React.FC<{ 
  children: React.ReactNode; 
  value?: string; 
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  className?: string;
}> = ({ children, className }) => <div className={className}>{children}</div>;

export const TabsList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`tabs-list ${className || ''}`}>{children}</div>
);

export const TabsTrigger: React.FC<{ 
  children: React.ReactNode; 
  value: string;
  className?: string;
}> = ({ children, className }) => (
  <button className={`tabs-trigger ${className || ''}`}>{children}</button>
);

export const TabsContent: React.FC<{ 
  children: React.ReactNode; 
  value: string;
  className?: string;
}> = ({ children, className }) => (
  <div className={`tabs-content ${className || ''}`}>{children}</div>
);

export const RadioGroup: React.FC<{ 
  children: React.ReactNode; 
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}> = ({ children, className }) => (
  <div className={`radio-group ${className || ''}`}>{children}</div>
);

export const RadioGroupItem: React.FC<{ 
  value: string;
  id?: string;
  className?: string;
}> = ({ value, id, className }) => (
  <input 
    type="radio" 
    value={value}
    id={id}
    className={`radio-item ${className || ''}`}
  />
);

// Simple component type exports
export type LabelProps = { children: React.ReactNode; className?: string; htmlFor?: string }
export type SeparatorProps = { className?: string }
export type TooltipProps = { children: React.ReactNode }