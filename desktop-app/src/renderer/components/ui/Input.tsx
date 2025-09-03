import React, { forwardRef, useState, useCallback, useEffect, type InputHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, Eye, EyeOff, Search, X, CheckCircle, Info } from 'lucide-react'
import { cn, focusRing } from './utils'
import { type FormComponentProps } from './types'
import { useHighContrast, useReducedMotion, useEnhancedFocus, useScreenReader, useTextScaling } from '../../hooks/useAccessibility'

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
  // Enhanced accessibility props
  label?: string
  description?: string
  showPasswordToggle?: boolean
  validationState?: 'none' | 'error' | 'warning' | 'success'
  validationMessage?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
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
    label,
    description,
    showPasswordToggle,
    validationState,
    validationMessage,
    ariaInvalid,
    ariaDescribedBy,
    required,
    placeholder,
    id,
    'data-testid': testId,
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const [internalValue, setInternalValue] = useState(value || '')
    const [focused, setFocused] = useState(false)
    
    const { isHighContrast, getContrastClass } = useHighContrast()
    const { prefersReducedMotion, getAnimationClass } = useReducedMotion()
    const { getFocusClasses } = useEnhancedFocus()
    const { announce } = useScreenReader()
    const { textScale } = useTextScaling()
    
    const isPasswordType = type === 'password'
    const isSearchType = type === 'search'
    const actualType = (isPasswordType || showPasswordToggle) && showPassword ? 'text' : type
    
    // Determine validation state
    const actualValidationState = error ? 'error' : validationState || 'none'
    const actualVariant = error ? 'error' : 
      actualValidationState === 'success' ? 'success' :
      actualValidationState === 'warning' ? 'warning' :
      variant
    
    // Generate unique IDs
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
    const descriptionId = `${inputId}-description`
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setInternalValue(newValue)
      onChange?.(newValue, e)
      
      // Announce validation changes to screen readers
      if (actualValidationState !== 'none') {
        const message = validationMessage || error
        if (message) {
          announce(`Input validation: ${message}`, 'polite')
        }
      }
    }, [onChange, actualValidationState, validationMessage, error, announce])

    const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true)
      
      // Announce input context to screen readers
      if (label || description) {
        announce(`Focused on ${label || 'input'}${description ? `: ${description}` : ''}`, 'polite')
      }
      
      props.onFocus?.(event)
    }, [label, description, announce, props])

    const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false)
      props.onBlur?.(event)
    }, [props])

    const handleClear = useCallback(() => {
      const newValue = ''
      setInternalValue(newValue)
      onChange?.(newValue, {} as React.ChangeEvent<HTMLInputElement>)
      onClear?.()
      announce('Input cleared', 'polite')
    }, [onChange, onClear, announce])

    const togglePasswordVisibility = useCallback(() => {
      const newVisibility = !showPassword
      setShowPassword(newVisibility)
      announce(newVisibility ? 'Password visible' : 'Password hidden', 'polite')
    }, [showPassword, announce])

    const showClearButton = clearable && internalValue && !disabled
    const actualShowPasswordToggle = (isPasswordType || showPasswordToggle) && !disabled

    const finalLeftIcon = isSearchType && !leftIcon ? <Search className="h-4 w-4 text-muted-foreground" /> : leftIcon

    // Get status icon
    const getStatusIcon = () => {
      switch (actualValidationState) {
        case 'error':
          return <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
        case 'success':
          return <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
        case 'warning':
          return <Info className="h-4 w-4 text-yellow-500" aria-hidden="true" />
        default:
          return null
      }
    }

    const statusIcon = getStatusIcon()

    // Build ARIA describedby
    const ariaDescribedByIds = [
      description && descriptionId,
      helperText && helperId,
      (error || validationMessage) && errorId,
      ariaDescribedBy
    ].filter(Boolean).join(' ')

    useEffect(() => {
      setInternalValue(value || '')
    }, [value])

    return (
      <div className={cn('w-full', containerClassName)}>
        {/* Label */}
        {label && (
          <label 
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium text-foreground mb-1',
              required && "after:content-['*'] after:ml-0.5 after:text-destructive",
              disabled && 'text-muted-foreground cursor-not-allowed'
            )}
            style={{ fontSize: `${textScale}rem` }}
          >
            {label}
          </label>
        )}

        {/* Description */}
        {description && (
          <p
            id={descriptionId}
            className="text-sm text-muted-foreground mb-2"
            style={{ fontSize: `${textScale * 0.875}rem` }}
          >
            {description}
          </p>
        )}

        {/* Input Container */}
        <div className="relative flex items-center">
          {finalLeftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none">
              {finalLeftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            type={actualType}
            id={inputId}
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn(
              inputVariants({ variant: actualVariant, size }),
              getFocusClasses('input'),
              getAnimationClass('transition-all duration-150 ease-out', ''),
              getContrastClass('', 'high-contrast-input'),
              {
                'pl-9': finalLeftIcon,
                'pr-9': showClearButton || actualShowPasswordToggle || rightIcon || statusIcon,
                'pr-16': (showClearButton && actualShowPasswordToggle) || (rightIcon && (showClearButton || actualShowPasswordToggle)) || (statusIcon && (showClearButton || actualShowPasswordToggle)),
                'pr-20': rightIcon && showClearButton && actualShowPasswordToggle && statusIcon
              },
              className
            )}
            style={{ fontSize: `${textScale}rem` }}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            aria-invalid={ariaInvalid || actualValidationState === 'error'}
            aria-describedby={ariaDescribedByIds || undefined}
            aria-required={required}
            data-testid={testId}
            {...props}
          />

          <div className="absolute right-3 flex items-center gap-1">
            {/* Status Icon */}
            {statusIcon}

            {/* Clear Button */}
            {showClearButton && (
              <button
                type="button"
                onClick={handleClear}
                className={cn(
                  'flex items-center justify-center h-4 w-4 rounded-sm transition-colors',
                  'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary',
                  getFocusClasses('button')
                )}
                aria-label="Clear input"
                tabIndex={-1}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            
            {/* Password Toggle */}
            {actualShowPasswordToggle && (
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className={cn(
                  'flex items-center justify-center h-4 w-4 rounded-sm transition-colors',
                  'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary',
                  getFocusClasses('button')
                )}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Eye className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            )}
            
            {/* Right Icon */}
            {rightIcon && (
              <div className="flex items-center text-muted-foreground">
                {rightIcon}
              </div>
            )}
          </div>
        </div>

        {/* Helper Text */}
        {helperText && !error && !validationMessage && (
          <p
            id={helperId}
            className="mt-1 text-sm text-muted-foreground"
            style={{ fontSize: `${textScale * 0.875}rem` }}
          >
            {helperText}
          </p>
        )}

        {/* Error/Validation Message */}
        {(error || validationMessage) && (
          <div
            id={errorId}
            className={cn(
              'mt-1 text-sm flex items-center gap-1',
              actualValidationState === 'error' && 'text-destructive',
              actualValidationState === 'warning' && 'text-yellow-600',
              actualValidationState === 'success' && 'text-green-600'
            )}
            style={{ fontSize: `${textScale * 0.875}rem` }}
            role="alert"
            aria-live="polite"
          >
            {statusIcon}
            {error || validationMessage}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input, inputVariants }