import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn, focusRing } from './utils'
import { type BaseComponentProps, type ContextMenuItem } from './types'

interface DropdownContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement>
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

const useDropdown = () => {
  const context = useContext(DropdownContext)
  if (!context) {
    throw new Error('useDropdown must be used within a DropdownProvider')
  }
  return context
}

export interface DropdownProps extends BaseComponentProps {
  value?: string
  onChange?: (value: string) => void
  options?: Array<{ label: string; value: string }>
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
  modal?: boolean
}

export const Dropdown: React.FC<DropdownProps> = ({
  children,
  value,
  onChange,
  options,
  onOpenChange,
  defaultOpen = false,
  modal = false,
  'data-testid': testId
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const triggerRef = useRef<HTMLElement>(null)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleOpenChange(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const dropdown = document.querySelector('[data-dropdown-content]')
        if (dropdown && !dropdown.contains(e.target as Node)) {
          handleOpenChange(false)
        }
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // If used as a simple select with options prop, render a select dropdown
  if (options && !children) {
    const selectedOption = options.find(opt => opt.value === value)
    
    return (
      <div className="relative" data-testid={testId}>
        <button
          ref={triggerRef as React.RefObject<HTMLButtonElement>}
          className={cn(
            'inline-flex items-center justify-between gap-2 w-full',
            'px-4 py-2 text-sm font-medium',
            'bg-background border border-border rounded-md',
            'hover:bg-accent hover:text-accent-foreground',
            'disabled:opacity-50 disabled:pointer-events-none',
            ...focusRing()
          )}
          onClick={() => handleOpenChange(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span>{selectedOption?.label || 'Select an option...'}</span>
          <ChevronDown className={cn(
            'h-4 w-4 transition-transform duration-150',
            isOpen && 'rotate-180'
          )} />
        </button>
        
        {isOpen && (
          <div
            className={cn(
              'absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2'
            )}
            data-dropdown-content
          >
            {options.map((option) => (
              <div
                key={option.value}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                  'transition-colors duration-150',
                  'hover:bg-accent hover:text-accent-foreground',
                  value === option.value && 'bg-accent text-accent-foreground'
                )}
                onClick={() => {
                  onChange?.(option.value)
                  handleOpenChange(false)
                }}
              >
                <span className="flex-1">{option.label}</span>
                {value === option.value && (
                  <Check className="ml-2 h-4 w-4" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        setIsOpen: handleOpenChange,
        triggerRef
      }}
    >
      <div className="relative" data-testid={testId}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

export interface DropdownTriggerProps extends BaseComponentProps {
  asChild?: boolean
}

export const DropdownTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownTriggerProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, className, asChild = false, ...props }, ref) => {
  const { isOpen, setIsOpen, triggerRef } = useDropdown()

  const handleClick = () => {
    setIsOpen(!isOpen)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(!isOpen)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsOpen(true)
    }
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      ref: (node: HTMLElement) => {
        if (triggerRef.current !== node) {
          (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }
        if (typeof ref === 'function') ref(node as any)
        else if (ref) ref.current = node as any
      },
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      'aria-expanded': isOpen,
      'aria-haspopup': 'true'
    })
  }

  return (
    <button
      ref={(node) => {
        if (triggerRef.current !== node) {
          (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'px-4 py-2 text-sm font-medium',
        'bg-background border border-border rounded-md',
        'hover:bg-accent hover:text-accent-foreground',
        'disabled:opacity-50 disabled:pointer-events-none',
        ...focusRing(),
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-expanded={isOpen}
      aria-haspopup="true"
      {...props}
    >
      {children}
      <ChevronDown className={cn(
        'h-4 w-4 transition-transform duration-150',
        isOpen && 'rotate-180'
      )} />
    </button>
  )
})

DropdownTrigger.displayName = 'DropdownTrigger'

export interface DropdownContentProps extends BaseComponentProps {
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  alignOffset?: number
  minWidth?: number
  maxHeight?: number
}

export const DropdownContent = React.forwardRef<
  HTMLDivElement,
  DropdownContentProps & React.HTMLAttributes<HTMLDivElement>
>(({
  children,
  className,
  align = 'start',
  side = 'bottom',
  sideOffset = 4,
  alignOffset = 0,
  minWidth = 180,
  maxHeight = 300,
  ...props
}, ref) => {
  const { isOpen, triggerRef } = useDropdown()
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return

    const updatePosition = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      let top = 0
      let left = 0

      // Calculate position based on side
      switch (side) {
        case 'bottom':
          top = triggerRect.bottom + sideOffset
          break
        case 'top':
          top = triggerRect.top - sideOffset
          break
        case 'left':
          left = triggerRect.left - sideOffset
          break
        case 'right':
          left = triggerRect.right + sideOffset
          break
      }

      // Calculate position based on align
      if (side === 'top' || side === 'bottom') {
        switch (align) {
          case 'start':
            left = triggerRect.left + alignOffset
            break
          case 'center':
            left = triggerRect.left + triggerRect.width / 2 - minWidth / 2 + alignOffset
            break
          case 'end':
            left = triggerRect.right - minWidth + alignOffset
            break
        }
      } else {
        switch (align) {
          case 'start':
            top = triggerRect.top + alignOffset
            break
          case 'center':
            top = triggerRect.top + triggerRect.height / 2 + alignOffset
            break
          case 'end':
            top = triggerRect.bottom + alignOffset
            break
        }
      }

      // Adjust for viewport boundaries
      if (side === 'top' && contentRef.current) {
        top = Math.max(top - contentRef.current.offsetHeight, 10)
      }
      if (left + minWidth > viewportWidth) {
        left = viewportWidth - minWidth - 10
      }
      if (left < 10) {
        left = 10
      }

      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [isOpen, side, align, sideOffset, alignOffset, minWidth])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={(node) => {
        // Assign to internal ref for component functionality
        ;(contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
      }}
      className={cn(
        'fixed z-50 rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2',
        'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
        'data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        minWidth: minWidth,
        maxHeight: maxHeight
      }}
      data-dropdown-content
      {...props}
    >
      {children}
    </div>,
    document.body
  )
})

DropdownContent.displayName = 'DropdownContent'

export interface DropdownItemProps extends BaseComponentProps {
  disabled?: boolean
  selected?: boolean
  onSelect?: () => void
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  shortcut?: string
}

export const DropdownItem = React.forwardRef<
  HTMLDivElement,
  DropdownItemProps & React.HTMLAttributes<HTMLDivElement>
>(({
  children,
  className,
  disabled = false,
  selected = false,
  onSelect,
  leftIcon,
  rightIcon,
  shortcut,
  ...props
}, ref) => {
  const { setIsOpen } = useDropdown()

  const handleSelect = () => {
    if (disabled) return
    onSelect?.()
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect()
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
        'transition-colors duration-150',
        'focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        selected && 'bg-accent text-accent-foreground',
        !disabled && 'hover:bg-accent hover:text-accent-foreground',
        className
      )}
      data-disabled={disabled ? '' : undefined}
      tabIndex={disabled ? -1 : 0}
      role="menuitem"
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {leftIcon && (
        <span className="mr-2 flex items-center">
          {leftIcon}
        </span>
      )}
      
      <span className="flex-1">{children}</span>
      
      {selected && (
        <Check className="ml-2 h-4 w-4" />
      )}
      
      {shortcut && !selected && (
        <kbd className="ml-2 text-xs text-muted-foreground">
          {shortcut}
        </kbd>
      )}
      
      {rightIcon && !selected && !shortcut && (
        <span className="ml-2 flex items-center">
          {rightIcon}
        </span>
      )}
    </div>
  )
})

DropdownItem.displayName = 'DropdownItem'

export const DropdownSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & BaseComponentProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    role="separator"
    {...props}
  />
))

DropdownSeparator.displayName = 'DropdownSeparator'

export const DropdownLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & BaseComponentProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold text-muted-foreground',
      className
    )}
    {...props}
  />
))

DropdownLabel.displayName = 'DropdownLabel'