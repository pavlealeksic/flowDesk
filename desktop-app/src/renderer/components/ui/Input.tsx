import React, { forwardRef, type InputHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, Eye, EyeOff, Search, X } from 'lucide-react'
import { cn, focusRing } from './utils'
import { type FormComponentProps } from './types'

const inputVariants = cva(
  [
    // Base styles
    'flex w-full rounded-md border bg-background px-3 py-2 text-sm',
    'placeholder:text-muted-foreground',
    'transition-all duration-150 ease-out',
    'disabled:cursor-not-allowed disabled:opacity-50',
    // Focus styles
    'focus:outline-none focus:ring-2 focus:ring-flow-primary-500 focus:ring-offset-2 focus:ring-offset-background',
    'focus:border-flow-primary-500'
  ],
  {
    variants: {
      variant: {
        default: [
          'border-border',
          'hover:border-border/80',
          'focus:border-flow-primary-500'
        ],
        error: [
          'border-destructive text-destructive',
          'focus:border-destructive focus:ring-destructive'
        ],
        success: [
          'border-green-500 text-green-600',
          'focus:border-green-500 focus:ring-green-500'
        ]
      },
      size: {
        sm: 'h-8 px-2 py-1 text-xs rounded',
        md: 'h-9 px-3 py-2 text-sm rounded-md',
        lg: 'h-10 px-4 py-2 text-base rounded-lg'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
)

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'onBlur' | 'onClick' | 'onFocus' | 'onKeyDown' | 'role' | 'value'>,
    VariantProps<typeof inputVariants>,
    Omit<FormComponentProps, 'children' | 'onBlur' | 'onClick' | 'onFocus' | 'onKeyDown' | 'role' | 'value'> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  clearable?: boolean
  onClear?: () => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void // Custom onKeyDown handler
  value?: string // Custom value property  
  containerClassName?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    containerClassName,
    variant,
    size,
    type = 'text',
    leftIcon,
    rightIcon,
    clearable = false,
    onClear,
    value,
    onChange,
    error,
    helperText,
    disabled,
    'data-testid': testId,
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const [internalValue, setInternalValue] = React.useState(value || '')
    
    const isPasswordType = type === 'password'
    const isSearchType = type === 'search'
    const actualType = isPasswordType && showPassword ? 'text' : type
    
    const hasError = !!error
    const actualVariant = hasError ? 'error' : variant

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setInternalValue(newValue)
      onChange?.(newValue, e)
    }

    const handleClear = () => {
      const newValue = ''
      setInternalValue(newValue)
      onChange?.(newValue)
      onClear?.()
    }

    const togglePasswordVisibility = () => {
      setShowPassword(prev => !prev)
    }

    const showClearButton = clearable && internalValue && !disabled
    const showPasswordToggle = isPasswordType && !disabled

    const finalLeftIcon = isSearchType && !leftIcon ? <Search className="h-4 w-4 text-muted-foreground" /> : leftIcon

    React.useEffect(() => {
      setInternalValue(value || '')
    }, [value])

    return (
      <div className={cn('relative flex flex-col gap-1', containerClassName)}>
        <div className="relative flex items-center">
          {finalLeftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none">
              {finalLeftIcon}
            </div>
          )}
          
          <input
            type={actualType}
            className={cn(
              inputVariants({ variant: actualVariant, size }),
              {
                'pl-9': finalLeftIcon,
                'pr-9': showClearButton || showPasswordToggle || rightIcon,
                'pr-16': (showClearButton && showPasswordToggle) || (rightIcon && (showClearButton || showPasswordToggle))
              },
              className
            )}
            ref={ref}
            value={internalValue}
            onChange={handleChange}
            disabled={disabled}
            data-testid={testId}
            {...props}
          />

          <div className="absolute right-3 flex items-center gap-1">
            {showClearButton && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center justify-center h-4 w-4 rounded-sm hover:bg-muted transition-colors"
                aria-label="Clear input"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            
            {showPasswordToggle && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="flex items-center justify-center h-4 w-4 rounded-sm hover:bg-muted transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Eye className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )}
            
            {rightIcon && !showClearButton && !showPasswordToggle && (
              <div className="flex items-center pointer-events-none">
                {rightIcon}
              </div>
            )}
          </div>
        </div>

        {(error || helperText) && (
          <div className="flex items-center gap-1 text-xs">
            {error ? (
              <>
                <AlertCircle className="h-3 w-3 text-destructive flex-shrink-0" />
                <span className="text-destructive">{error}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{helperText}</span>
            )}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input, inputVariants }