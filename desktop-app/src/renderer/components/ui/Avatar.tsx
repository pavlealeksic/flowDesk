import React, { useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { User } from 'lucide-react'
import { cn } from './utils'
import { type BaseComponentProps } from './types'

const avatarVariants = cva(
  [
    'relative flex shrink-0 overflow-hidden',
    'bg-muted text-muted-foreground',
    'select-none'
  ],
  {
    variants: {
      size: {
        xs: 'h-6 w-6 text-xs',
        sm: 'h-8 w-8 text-sm',
        md: 'h-10 w-10 text-base',
        lg: 'h-12 w-12 text-lg',
        xl: 'h-16 w-16 text-xl',
        '2xl': 'h-20 w-20 text-2xl'
      },
      shape: {
        circle: 'rounded-full',
        square: 'rounded-md',
        rounded: 'rounded-lg'
      },
      status: {
        none: '',
        online: 'ring-2 ring-green-500',
        away: 'ring-2 ring-yellow-500',
        busy: 'ring-2 ring-red-500',
        offline: 'ring-2 ring-gray-400'
      }
    },
    defaultVariants: {
      size: 'md',
      shape: 'circle',
      status: 'none'
    }
  }
)

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants>,
    BaseComponentProps {
  src?: string
  alt?: string
  fallback?: string
  showStatus?: boolean
  statusPosition?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
}

export const Avatar: React.FC<AvatarProps> = ({
  className,
  src,
  alt,
  fallback,
  size,
  shape,
  status,
  showStatus = false,
  statusPosition = 'bottom-right',
  'data-testid': testId,
  ...props
}) => {
  const [imageFailed, setImageFailed] = useState(false)

  const getInitials = (name?: string) => {
    if (!name) return null
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }

  const handleImageError = () => {
    setImageFailed(true)
  }

  const statusPositionClasses = {
    'top-right': 'top-0 right-0',
    'bottom-right': 'bottom-0 right-0',
    'top-left': 'top-0 left-0',
    'bottom-left': 'bottom-0 left-0'
  }

  const statusSizeClasses = {
    xs: 'h-2 w-2',
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
    xl: 'h-4 w-4',
    '2xl': 'h-5 w-5'
  }

  return (
    <div
      className={cn(avatarVariants({ size, shape, status }), className)}
      data-testid={testId}
      {...props}
    >
      {src && !imageFailed ? (
        <img
          className="aspect-square h-full w-full object-cover"
          src={src}
          alt={alt || 'Avatar'}
          onError={handleImageError}
        />
      ) : fallback ? (
        <div className="flex h-full w-full items-center justify-center font-medium">
          {getInitials(fallback) || (
            <User className={cn({
              'h-3 w-3': size === 'xs',
              'h-4 w-4': size === 'sm',
              'h-5 w-5': size === 'md',
              'h-6 w-6': size === 'lg',
              'h-8 w-8': size === 'xl',
              'h-10 w-10': size === '2xl'
            })} />
          )}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <User className={cn({
            'h-3 w-3': size === 'xs',
            'h-4 w-4': size === 'sm',
            'h-5 w-5': size === 'md',
            'h-6 w-6': size === 'lg',
            'h-8 w-8': size === 'xl',
            'h-10 w-10': size === '2xl'
          })} />
        </div>
      )}
      
      {showStatus && status && status !== 'none' && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-background',
            statusPositionClasses[statusPosition],
            statusSizeClasses[size || 'md'],
            {
              'bg-green-500': status === 'online',
              'bg-yellow-500': status === 'away', 
              'bg-red-500': status === 'busy',
              'bg-gray-400': status === 'offline'
            }
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  )
}

export interface AvatarGroupProps extends BaseComponentProps {
  avatars: Array<{
    src?: string
    alt?: string
    fallback?: string
  }>
  size?: VariantProps<typeof avatarVariants>['size']
  shape?: VariantProps<typeof avatarVariants>['shape']
  max?: number
  spacing?: 'tight' | 'normal' | 'loose'
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  size = 'md',
  shape = 'circle',
  max = 5,
  spacing = 'normal',
  className,
  'data-testid': testId
}) => {
  const displayAvatars = avatars.slice(0, max)
  const remainingCount = Math.max(0, avatars.length - max)
  
  const spacingClasses = {
    tight: '-space-x-1',
    normal: '-space-x-2',
    loose: '-space-x-1'
  }

  return (
    <div
      className={cn(
        'flex items-center',
        spacingClasses[spacing],
        className
      )}
      data-testid={testId}
    >
      {displayAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          {...avatar}
          size={size}
          shape={shape}
          className="ring-2 ring-background"
        />
      ))}
      
      {remainingCount > 0 && (
        <div
          className={cn(
            avatarVariants({ size, shape }),
            'ring-2 ring-background',
            'flex items-center justify-center',
            'bg-muted text-muted-foreground',
            'font-medium'
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  )
}