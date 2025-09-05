import React, { forwardRef, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react'
import { cn } from './utils'
import { Button } from './Button'
import { useFocusTrap, useFocusRestore, useScreenReader, useHighContrast, useReducedMotion, useEnhancedFocus } from '../../hooks/useAccessibility'
import { getZIndexClass } from '../../constants/zIndex'
import { useBlockingOverlay } from '../../hooks/useBrowserViewVisibility'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info'
  // Accessibility props
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  preventScroll?: boolean
  initialFocus?: HTMLElement | string | null
  finalFocus?: HTMLElement | string | null
  // ARIA props
  'aria-labelledby'?: string
  'aria-describedby'?: string
  role?: 'dialog' | 'alertdialog'
  // Screen reader
  announceOnOpen?: boolean
  className?: string
  overlayClassName?: string
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md',
    variant = 'default',
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showCloseButton = true,
    preventScroll = true,
    initialFocus = null,
    finalFocus = null,
    announceOnOpen = true,
    className,
    overlayClassName,
    role = 'dialog',
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    ...props
  }, ref) => {
    const modalRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)
    const previousActiveElementRef = useRef<HTMLElement | null>(null)
    
    const { containerRef } = useFocusTrap(isOpen)
    const { saveFocus, restoreFocus } = useFocusRestore()
    const { announce } = useScreenReader()
    const { isHighContrast, getContrastClass } = useHighContrast()
    const { prefersReducedMotion, getAnimationClass } = useReducedMotion()
    const { getFocusClasses } = useEnhancedFocus()

    // Generate unique IDs for accessibility and BrowserView management
    const modalId = `modal-${Math.random().toString(36).substr(2, 9)}`
    
    // Block BrowserViews when modal is open
    useBlockingOverlay(
      modalId,
      isOpen,
      role === 'alertdialog' ? 'ALERT_MODAL' : 'MODAL'
    )
    const titleId = title ? `${modalId}-title` : ariaLabelledby
    const descriptionId = description ? `${modalId}-description` : ariaDescribedby

    // Get variant icon and styling
    const getVariantIcon = () => {
      switch (variant) {
        case 'danger':
          return <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        case 'warning':
          return <AlertTriangle className="h-6 w-6 text-yellow-500" aria-hidden="true" />
        case 'success':
          return <CheckCircle className="h-6 w-6 text-green-500" aria-hidden="true" />
        case 'info':
          return <Info className="h-6 w-6 text-blue-500" aria-hidden="true" />
        default:
          return null
      }
    }

    const getVariantClasses = () => {
      switch (variant) {
        case 'danger':
          return 'border-destructive/20 bg-destructive/5'
        case 'warning':
          return 'border-yellow-500/20 bg-yellow-500/5'
        case 'success':
          return 'border-green-500/20 bg-green-500/5'
        case 'info':
          return 'border-blue-500/20 bg-blue-500/5'
        default:
          return 'border-border'
      }
    }

    const getSizeClasses = () => {
      switch (size) {
        case 'sm':
          return 'max-w-md'
        case 'md':
          return 'max-w-lg'
        case 'lg':
          return 'max-w-2xl'
        case 'xl':
          return 'max-w-4xl'
        case 'full':
          return 'max-w-[95vw] max-h-[95vh]'
        default:
          return 'max-w-lg'
      }
    }

    // Handle escape key
    useEffect(() => {
      if (!isOpen || !closeOnEscape) return

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }

      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, closeOnEscape, onClose])

    // Handle scroll prevention
    useEffect(() => {
      if (!isOpen || !preventScroll) return

      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      
      return () => {
        document.body.style.overflow = originalStyle
      }
    }, [isOpen, preventScroll])

    // Handle focus management
    useEffect(() => {
      if (!isOpen) return

      // Save current focus
      saveFocus()

      // Focus management after modal opens
      const handleInitialFocus = () => {
        let elementToFocus: HTMLElement | null = null

        if (initialFocus) {
          if (typeof initialFocus === 'string') {
            elementToFocus = document.querySelector(initialFocus)
          } else {
            elementToFocus = initialFocus
          }
        }

        // Default focus order: close button, then first focusable element
        if (!elementToFocus) {
          const closeButton = modalRef.current?.querySelector('[data-close-button]') as HTMLElement
          if (closeButton) {
            elementToFocus = closeButton
          } else {
            const focusableElements = modalRef.current?.querySelectorAll(
              'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            )
            if (focusableElements && focusableElements.length > 0) {
              elementToFocus = focusableElements[0] as HTMLElement
            }
          }
        }

        if (elementToFocus) {
          elementToFocus.focus()
        }
      }

      // Slight delay to ensure modal is rendered
      const timeoutId = setTimeout(handleInitialFocus, 100)

      return () => {
        clearTimeout(timeoutId)
        if (!finalFocus) {
          restoreFocus()
        } else if (typeof finalFocus === 'string') {
          const element = document.querySelector(finalFocus) as HTMLElement
          element?.focus()
        } else {
          finalFocus?.focus()
        }
      }
    }, [isOpen, initialFocus, finalFocus, saveFocus, restoreFocus])

    // Announce modal opening to screen readers
    useEffect(() => {
      if (isOpen && announceOnOpen) {
        const announcement = title 
          ? `Dialog opened: ${title}${description ? `. ${description}` : ''}`
          : 'Dialog opened'
        
        announce(announcement, 'assertive')
      }
    }, [isOpen, announceOnOpen, title, description, announce])

    // Handle overlay click
    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onClose()
      }
    }

    // Handle close button click
    const handleCloseClick = () => {
      announce('Dialog closed', 'polite')
      onClose()
    }

    if (!isOpen) return null

    const modalContent = (
      <div
        ref={overlayRef}
        className={cn(
          'fixed inset-0 flex items-center justify-center p-4',
          getZIndexClass('MODAL_BACKDROP'),
          'bg-black/50 backdrop-blur-sm',
          getAnimationClass('animate-fade-in', ''),
          overlayClassName
        )}
        onClick={handleOverlayClick}
        role="presentation"
      >
        <div
          ref={(node) => {
            modalRef.current = node
            containerRef.current = node
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
          }}
          className={cn(
            'relative w-full bg-background rounded-lg border shadow-lg',
            'focus:outline-none',
            getZIndexClass(role === 'alertdialog' ? 'ALERT_MODAL' : 'MODAL'),
            getSizeClasses(),
            getVariantClasses(),
            getContrastClass('', 'high-contrast-modal'),
            getAnimationClass('animate-slide-in', ''),
            className
          )}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          {...props}
        >
          {/* Close Button */}
          {showCloseButton && (
            <Button
              data-close-button
              onClick={handleCloseClick}
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4"
              aria-label="Close dialog"
              leftIcon={<X className="h-4 w-4" />}
            />
          )}

          {/* Header */}
          {(title || description) && (
            <div className="flex items-start gap-3 p-6 pb-4">
              {getVariantIcon()}
              <div className="flex-1">
                {title && (
                  <h2
                    id={titleId}
                    className={cn(
                      'text-lg font-semibold text-foreground',
                      variant === 'danger' && 'text-destructive',
                      variant === 'warning' && 'text-yellow-600',
                      variant === 'success' && 'text-green-600',
                      variant === 'info' && 'text-blue-600'
                    )}
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm text-muted-foreground"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="px-6 pb-6">
            {children}
          </div>
        </div>
      </div>
    )

    // Render modal in a portal
    return createPortal(modalContent, document.body)
  }
)

Modal.displayName = 'Modal'

// Modal components for common use cases
export const ConfirmModal = forwardRef<HTMLDivElement, 
  Omit<ModalProps, 'children'> & {
    onConfirm: () => void
    confirmText?: string
    cancelText?: string
    confirmVariant?: 'primary' | 'destructive'
    isLoading?: boolean
  }
>(({
  onConfirm,
  onClose,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  isLoading = false,
  variant = 'default',
  ...props
}, ref) => {
  return (
    <Modal
      ref={ref}
      onClose={onClose}
      role="alertdialog"
      variant={variant}
      {...props}
    >
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          aria-label={cancelText}
        >
          {cancelText}
        </Button>
        <Button
          variant={confirmVariant}
          onClick={onConfirm}
          loading={isLoading}
          loadingText="Processing..."
          aria-label={confirmText}
          description={variant === 'danger' ? 'This action cannot be undone' : undefined}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
})

ConfirmModal.displayName = 'ConfirmModal'

export { Modal }