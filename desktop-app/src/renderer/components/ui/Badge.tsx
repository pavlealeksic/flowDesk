import React from 'react'
import { cn } from './utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
      {
        'bg-primary text-primary-foreground': variant === 'default',
        'bg-muted text-muted-foreground': variant === 'secondary',
        'bg-destructive text-destructive-foreground': variant === 'destructive',
        'border border-border bg-background': variant === 'outline'
      },
      className
    )}>
      {children}
    </span>
  )
}