import React, { forwardRef, useEffect, useRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn, focusRing, formatKeyboardShortcut } from './utils'
import { type InteractiveComponentProps, type KeyboardShortcut } from './types'
import { useHighContrast, useReducedMotion, useEnhancedFocus, useColorAccessibility, useScreenReader } from '../../hooks/useAccessibility'

const buttonVariants = cva(
  [
    // Base styles
    'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium',
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
        sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
        md: 'h-9 px-4 py-2 text-sm rounded-md gap-2',
        lg: 'h-10 px-6 py-2 text-base rounded-lg gap-2',
        xl: 'h-12 px-8 py-3 text-lg rounded-lg gap-2.5',
        icon: 'h-9 w-9 rounded-md p-0'
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
  // Enhanced accessibility props
  'aria-expanded'?: boolean
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  'aria-controls'?: string
  'aria-pressed'?: boolean
  // Screen reader description
  description?: string
  // Loading announcement
  loadingText?: string
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
    description,
    loadingText = 'Loading',
    'data-testid': testId,
    'aria-expanded': ariaExpanded,
    'aria-haspopup': ariaHaspopup,
    'aria-controls': ariaControls,
    'aria-pressed': ariaPressed,
    ...props
  }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null)
    const { isHighContrast, getContrastClass } = useHighContrast()
    const { prefersReducedMotion, getAnimationClass } = useReducedMotion()
    const { getFocusClasses } = useEnhancedFocus()
    const { getColorClass } = useColorAccessibility()
    const { announce } = useScreenReader()

    // Announce loading state changes to screen readers
    useEffect(() => {
      if (loading) {
        announce(loadingText, 'assertive')
      }
    }, [loading, loadingText, announce])

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) return
      
      // Announce button press for screen readers
      if (children) {
        announce(`${children} button pressed`)
      }
      
      onClick?.(event)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      // Handle Enter and Space keys for better accessibility
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.key === ' ') {
          event.preventDefault() // Prevent page scroll
        }
        if (!loading && !disabled && onClick) {
          onClick(event as any)
        }
      }
      
      // Handle Escape key for expandable buttons
      if (event.key === 'Escape' && ariaExpanded) {
        // Close expanded state if applicable
        const expandedElement = ariaControls ? document.getElementById(ariaControls) : null
        if (expandedElement) {
          expandedElement.setAttribute('aria-hidden', 'true')
        }
      }

      props.onKeyDown?.(event)
    }

    const showLeftIcon = leftIcon && !loading
    const showRightIcon = rightIcon && !loading
    const showShortcut = shortcut && size !== 'icon' && !loading
    const isIconOnly = size === 'icon' || (!children && (leftIcon || rightIcon))
    const hasContent = Boolean(children)

    // Build enhanced class names with accessibility features
    const buttonClasses = cn(
      buttonVariants({ variant, size, fullWidth }),
      getFocusClasses('button'),
      getAnimationClass('transition-all duration-150 ease-out', 'transition-none'),
      getContrastClass('', 'high-contrast-button'),
      className
    )

    // Generate comprehensive aria-label
    const generateAriaLabel = () => {
      let label = props['aria-label'] || (typeof children === 'string' ? children : '')
      
      if (loading) {
        label += ` ${loadingText}`
      }
      
      if (disabled) {
        label += ' (disabled)'
      }
      
      if (shortcut) {
        label += ` (keyboard shortcut: ${formatKeyboardShortcut([
          ...(shortcut.modifiers || []),
          shortcut.key
        ].join(' + '))})`
      }

      if (ariaPressed !== undefined) {
        label += ` (${ariaPressed ? 'pressed' : 'not pressed'})`
      }

      if (ariaExpanded !== undefined) {
        label += ` (${ariaExpanded ? 'expanded' : 'collapsed'})`
      }
      
      return label
    }

    return (
      <button
        ref={(node) => {
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
          buttonRef.current = node
        }}
        className={buttonClasses}
        disabled={disabled || loading}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-testid={testId}
        aria-label={generateAriaLabel()}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHaspopup}
        aria-controls={ariaControls}
        aria-pressed={ariaPressed}
        aria-describedby={description ? `${testId || 'button'}-description` : undefined}
        aria-busy={loading}
        title={shortcut ? formatKeyboardShortcut([
          ...(shortcut.modifiers || []),
          shortcut.key
        ].join(' + ')) : undefined}
        {...props}
      >
        {/* Loading indicator */}
        {loading && (
          <Loader2 
            className={cn(
              'animate-spin',
              size === 'sm' ? 'h-3 w-3' : 
              size === 'lg' ? 'h-5 w-5' : 
              size === 'xl' ? 'h-6 w-6' : 
              'h-4 w-4'
            )}
            aria-hidden="true"
            role="status"
            aria-label={loadingText}
          />
        )}
        
        {/* Left icon */}
        {showLeftIcon && (
          <span className="flex items-center justify-center" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        
        {/* Button content (text + keyboard shortcut) */}
        {hasContent && !isIconOnly && (
          <>
            <span className="button-text">{children}</span>
            {showShortcut && (
              <kbd 
                className="ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"
                aria-hidden="true"
              >
                {formatKeyboardShortcut([
                  ...(shortcut.modifiers || []),
                  shortcut.key
                ].join(' + '))}
              </kbd>
            )}
          </>
        )}
        
        {/* Icon-only content */}
        {isIconOnly && !loading && (
          <span className="flex items-center justify-center" aria-hidden="true">
            {leftIcon || rightIcon}
          </span>
        )}
        
        {/* Right icon */}
        {showRightIcon && !isIconOnly && (
          <span className="flex items-center justify-center" aria-hidden="true">
            {rightIcon}
          </span>
        )}

        {/* Hidden description for screen readers */}
        {description && (
          <span
            id={`${testId || 'button'}-description`}
            className="sr-only"
            aria-hidden="false"
          >
            {description}
          </span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button, buttonVariants }