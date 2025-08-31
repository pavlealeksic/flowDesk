import React, { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn, focusRing, formatKeyboardShortcut } from './utils'
import { type InteractiveComponentProps, type KeyboardShortcut } from './types'

const buttonVariants = cva(
  [
    // Base styles
    'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium',
    'transition-all duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    'select-none',
    // Focus ring
    ...focusRing({ offset: true })
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-primary-foreground shadow-sm',
          'hover:bg-primary/90 active:bg-primary/95',
          'border border-primary/20'
        ],
        secondary: [
          'bg-secondary text-secondary-foreground shadow-sm', 
          'hover:bg-secondary/80 active:bg-secondary/90',
          'border border-border'
        ],
        destructive: [
          'bg-destructive text-destructive-foreground shadow-sm',
          'hover:bg-destructive/90 active:bg-destructive/95',
          'border border-destructive/20'
        ],
        outline: [
          'border border-border bg-background text-foreground shadow-sm',
          'hover:bg-accent hover:text-accent-foreground',
          'active:bg-accent/90'
        ],
        ghost: [
          'text-foreground',
          'hover:bg-accent hover:text-accent-foreground',
          'active:bg-accent/90'
        ],
        link: [
          'text-primary underline-offset-4',
          'hover:underline active:no-underline'
        ]
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md',
        md: 'h-9 px-4 py-2 text-sm rounded-md',
        lg: 'h-10 px-6 py-2 text-base rounded-lg',
        xl: 'h-12 px-8 py-3 text-lg rounded-lg',
        icon: 'h-9 w-9 rounded-md'
      },
      fullWidth: {
        true: 'w-full'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
)

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onKeyDown' | 'role'>,
    VariantProps<typeof buttonVariants>,
    Omit<InteractiveComponentProps, 'onClick' | 'onKeyDown' | 'role'> {
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  shortcut?: KeyboardShortcut
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    fullWidth,
    loading = false,
    disabled,
    leftIcon,
    rightIcon,
    children,
    shortcut,
    onClick,
    'data-testid': testId,
    ...props
  }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) return
      onClick?.(event)
    }

    const showLeftIcon = leftIcon && !loading
    const showRightIcon = rightIcon && !loading
    const showShortcut = shortcut && size !== 'icon' && !loading

    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        ref={ref}
        disabled={disabled || loading}
        onClick={handleClick}
        data-testid={testId}
        title={shortcut ? `${props['aria-label'] || children} (${formatKeyboardShortcut(
          [
            ...(shortcut.modifiers || []),
            shortcut.key
          ].join(' + ')
        )})` : props['aria-label'] || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {showLeftIcon && (
          <span className="flex items-center" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        
        {size !== 'icon' && (
          <span className="flex items-center gap-2">
            {children}
            {showShortcut && (
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                {formatKeyboardShortcut(
                  [
                    ...(shortcut.modifiers || []),
                    shortcut.key
                  ].join(' + ')
                )}
              </kbd>
            )}
          </span>
        )}
        
        {showRightIcon && (
          <span className="flex items-center" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }