import React from 'react'
import { motion } from 'framer-motion'
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { cn } from './utils'
import { getZIndexClass } from '../../constants/zIndex'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'primary' | 'muted'
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  const variantClasses = {
    default: 'text-foreground',
    primary: 'text-flow-primary-500',
    muted: 'text-muted-foreground'
  }

  return (
    <Loader2 
      className={cn(
        'animate-spin',
        sizeClasses[size],
        variantClasses[variant],
        className
      )} 
    />
  )
}

interface SkeletonProps {
  className?: string
  children?: React.ReactNode
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, children }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    >
      {children}
    </div>
  )
}

interface LoadingCardProps {
  lines?: number
  showAvatar?: boolean
  className?: string
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  lines = 3,
  showAvatar = false,
  className
}) => {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      <div className="flex items-start space-x-3">
        {showAvatar && (
          <Skeleton className="h-10 w-10 rounded-full" />
        )}
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton 
              key={i} 
              className={cn(
                'h-3',
                i === lines - 1 ? 'w-1/2' : 'w-full'
              )} 
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface ProgressiveLoadingProps {
  isLoading: boolean
  children: React.ReactNode
  skeleton?: React.ReactNode
  className?: string
}

export const ProgressiveLoading: React.FC<ProgressiveLoadingProps> = ({
  isLoading,
  children,
  skeleton,
  className
}) => {
  return (
    <div className={className}>
      {isLoading ? (
        skeleton || <LoadingCard />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  progress?: number
  className?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  progress,
  className
}) => {
  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center',
        getZIndexClass('LOADING_OVERLAY'),
        className
      )}
    >
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" variant="default" />
        <div className="space-y-2">
          <p className="text-sm font-medium">{message}</p>
          {progress !== undefined && (
            <div className="w-64 bg-muted rounded-full h-2">
              <motion.div
                className="bg-flow-primary-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error' | 'syncing'

interface StatusIndicatorProps {
  state: LoadingState
  message?: string
  size?: 'sm' | 'md'
  className?: string
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  message,
  size = 'md',
  className
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5'
  }

  const getIcon = () => {
    switch (state) {
      case 'loading':
        return <LoadingSpinner size={size} />
      case 'syncing':
        return <RefreshCw className={cn(sizeClasses[size], 'animate-spin text-flow-primary-500')} />
      case 'success':
        return <CheckCircle className={cn(sizeClasses[size], 'text-green-500')} />
      case 'error':
        return <AlertCircle className={cn(sizeClasses[size], 'text-destructive')} />
      default:
        return null
    }
  }

  const getColor = () => {
    switch (state) {
      case 'loading':
      case 'syncing':
        return 'text-flow-primary-500'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {getIcon()}
      {message && (
        <span className={cn('text-sm', getColor())}>
          {message}
        </span>
      )}
    </div>
  )
}

interface SmartLoadingProps {
  isLoading: boolean
  hasData: boolean
  error?: string | null
  children: React.ReactNode
  loadingSkeleton?: React.ReactNode
  emptyState?: React.ReactNode
  errorState?: React.ReactNode
  retryAction?: () => void
  className?: string
}

export const SmartLoading: React.FC<SmartLoadingProps> = ({
  isLoading,
  hasData,
  error,
  children,
  loadingSkeleton,
  emptyState,
  errorState,
  retryAction,
  className
}) => {
  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        {errorState || (
          <>
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            {retryAction && (
              <button
                onClick={retryAction}
                className="inline-flex items-center gap-2 px-4 py-2 bg-flow-primary-500 text-white rounded-lg hover:bg-flow-primary-600 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  if (isLoading && !hasData) {
    return (
      <div className={className}>
        {loadingSkeleton || <LoadingCard lines={4} showAvatar />}
      </div>
    )
  }

  if (!hasData && !isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        {emptyState || (
          <>
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No data yet</h3>
            <p className="text-sm text-muted-foreground">
              Content will appear here when available
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={className}>
      {children}
      {isLoading && hasData && (
        <div className="flex items-center justify-center py-4">
          <StatusIndicator state="loading" message="Loading more..." size="sm" />
        </div>
      )}
    </div>
  )
}

// Message-specific loading components
export const MessageListSkeleton: React.FC = () => (
  <div className="space-y-1">
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className="p-4 border-b border-border">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export const CalendarSkeleton: React.FC = () => (
  <div className="space-y-4 p-4">
    {/* Header */}
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
    
    {/* Calendar grid */}
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="aspect-square">
          <Skeleton className="h-full w-full" />
        </div>
      ))}
    </div>
  </div>
)