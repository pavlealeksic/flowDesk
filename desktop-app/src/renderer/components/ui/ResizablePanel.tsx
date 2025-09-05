import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from './utils'
import { type BaseComponentProps } from './types'

export interface ResizablePanelProps extends BaseComponentProps {
  direction: 'horizontal' | 'vertical'
  initialSize?: number
  minSize?: number
  maxSize?: number
  onResize?: (size: number) => void
  disabled?: boolean
  resizerClassName?: string
  resizerStyle?: React.CSSProperties
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  direction,
  initialSize = 250,
  minSize = 100,
  maxSize = 800,
  onResize,
  disabled = false,
  className,
  resizerClassName,
  resizerStyle,
  'data-testid': testId
}) => {
  const [size, setSize] = useState(initialSize)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const resizerRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef(0)
  const startSizeRef = useRef(0)

  const isHorizontal = direction === 'horizontal'

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    
    e.preventDefault()
    setIsResizing(true)
    startPosRef.current = isHorizontal ? e.clientX : e.clientY
    startSizeRef.current = size
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [disabled, isHorizontal, size])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const currentPos = isHorizontal ? e.clientX : e.clientY
    const delta = currentPos - startPosRef.current
    const newSize = Math.min(
      Math.max(startSizeRef.current + delta, minSize),
      maxSize
    )

    setSize(newSize)
    onResize?.(newSize)
  }, [isResizing, isHorizontal, minSize, maxSize, onResize])

  const handleMouseUp = useCallback(() => {
    if (!isResizing) return
    
    setIsResizing(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [isResizing])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const panelStyle = {
    [isHorizontal ? 'width' : 'height']: `${size}px`,
    flexShrink: 0
  }

  const resizerClasses = cn(
    'bg-border hover:bg-border-hover transition-colors duration-150',
    {
      'cursor-col-resize w-1 h-full': isHorizontal,
      'cursor-row-resize h-1 w-full': !isHorizontal,
      'bg-flow-primary-500': isResizing,
      'cursor-not-allowed opacity-50': disabled
    },
    resizerClassName
  )

  return (
    <div
      className={cn(
        'flex',
        {
          'flex-row': isHorizontal,
          'flex-col': !isHorizontal
        }
      )}
      data-testid={testId}
    >
      <div
        ref={panelRef}
        className={cn('overflow-hidden', className)}
        style={panelStyle}
      >
        {children}
      </div>
      
      <div
        ref={resizerRef}
        className={resizerClasses}
        style={resizerStyle}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        aria-label={`Resize ${isHorizontal ? 'horizontal' : 'vertical'} panel`}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return
          
          const step = 10
          const isIncreaseKey = isHorizontal 
            ? e.key === 'ArrowRight'
            : e.key === 'ArrowDown'
          const isDecreaseKey = isHorizontal
            ? e.key === 'ArrowLeft'
            : e.key === 'ArrowUp'

          if (isIncreaseKey || isDecreaseKey) {
            e.preventDefault()
            const delta = isIncreaseKey ? step : -step
            const newSize = Math.min(Math.max(size + delta, minSize), maxSize)
            setSize(newSize)
            onResize?.(newSize)
          }
        }}
      />
    </div>
  )
}

export interface ResizableContainerProps extends BaseComponentProps {
  direction?: 'horizontal' | 'vertical'
  children: React.ReactNode
}

export const ResizableContainer: React.FC<ResizableContainerProps> = ({
  direction = 'horizontal',
  children,
  className,
  'data-testid': testId
}) => {
  return (
    <div
      className={cn(
        'flex overflow-hidden',
        {
          'flex-row h-full': direction === 'horizontal',
          'flex-col w-full': direction === 'vertical'
        },
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  )
}