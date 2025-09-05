import { useEffect, useRef, useCallback, useState } from 'react'
import { useAccessibility as useAccessibilityContext } from '../contexts/AccessibilityContext'

// Hook for managing focus trapping in modals and overlays
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement | null>(null)
  const firstFocusableElementRef = useRef<HTMLElement | null>(null)
  const lastFocusableElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    firstFocusableElementRef.current = firstElement
    lastFocusableElementRef.current = lastElement

    // Focus first element when trap activates
    firstElement.focus()

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        // Shift + Tab (going backward)
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab (going forward)
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)

    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  }, [isActive])

  return {
    containerRef,
    firstFocusableElementRef,
    lastFocusableElementRef
  }
}

// Hook for managing focus restoration
export function useFocusRestore() {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const saveFocus = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement
  }, [])

  const restoreFocus = useCallback(() => {
    if (previousActiveElement.current && document.contains(previousActiveElement.current)) {
      previousActiveElement.current.focus()
      previousActiveElement.current = null
    }
  }, [])

  return {
    saveFocus,
    restoreFocus
  }
}

// Hook for managing keyboard navigation in lists and grids
export function useKeyboardNavigation(
  itemsCount: number,
  orientation: 'horizontal' | 'vertical' | 'grid' = 'vertical',
  columns?: number
) {
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLElement | null>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current) return

    const { key } = event
    let newIndex = activeIndex

    if (orientation === 'vertical') {
      switch (key) {
        case 'ArrowDown':
          event.preventDefault()
          newIndex = Math.min(activeIndex + 1, itemsCount - 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          newIndex = Math.max(activeIndex - 1, 0)
          break
        case 'Home':
          event.preventDefault()
          newIndex = 0
          break
        case 'End':
          event.preventDefault()
          newIndex = itemsCount - 1
          break
      }
    } else if (orientation === 'horizontal') {
      switch (key) {
        case 'ArrowRight':
          event.preventDefault()
          newIndex = Math.min(activeIndex + 1, itemsCount - 1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          newIndex = Math.max(activeIndex - 1, 0)
          break
        case 'Home':
          event.preventDefault()
          newIndex = 0
          break
        case 'End':
          event.preventDefault()
          newIndex = itemsCount - 1
          break
      }
    } else if (orientation === 'grid' && columns) {
      switch (key) {
        case 'ArrowRight':
          event.preventDefault()
          newIndex = Math.min(activeIndex + 1, itemsCount - 1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          newIndex = Math.max(activeIndex - 1, 0)
          break
        case 'ArrowDown':
          event.preventDefault()
          newIndex = Math.min(activeIndex + columns, itemsCount - 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          newIndex = Math.max(activeIndex - columns, 0)
          break
        case 'Home':
          if (event.ctrlKey) {
            event.preventDefault()
            newIndex = 0
          } else {
            event.preventDefault()
            const rowStart = Math.floor(activeIndex / columns) * columns
            newIndex = rowStart
          }
          break
        case 'End':
          if (event.ctrlKey) {
            event.preventDefault()
            newIndex = itemsCount - 1
          } else {
            event.preventDefault()
            const rowStart = Math.floor(activeIndex / columns) * columns
            const rowEnd = Math.min(rowStart + columns - 1, itemsCount - 1)
            newIndex = rowEnd
          }
          break
      }
    }

    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex)
      
      // Focus the new active element
      const activeElement = containerRef.current.children[newIndex] as HTMLElement
      if (activeElement?.focus) {
        activeElement.focus()
      }
    }
  }, [activeIndex, itemsCount, orientation, columns])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    activeIndex,
    setActiveIndex,
    containerRef
  }
}

// Hook for managing screen reader announcements
export function useScreenReader() {
  const { settings } = useAccessibilityContext()

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!settings.screenReader) return

    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    
    document.body.appendChild(announcement)
    
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement)
      }
    }, 1000)
  }, [settings.screenReader])

  const announceRegion = useCallback((message: string, regionId: string) => {
    const region = document.getElementById(regionId)
    if (!region || !settings.screenReader) return

    const existingAnnouncement = region.querySelector('[aria-live]')
    if (existingAnnouncement) {
      existingAnnouncement.textContent = message
    } else {
      const announcement = document.createElement('div')
      announcement.setAttribute('aria-live', 'polite')
      announcement.setAttribute('aria-atomic', 'true')
      announcement.className = 'sr-only'
      announcement.textContent = message
      region.appendChild(announcement)
    }
  }, [settings.screenReader])

  return {
    announce,
    announceRegion
  }
}

// Hook for managing high contrast mode
export function useHighContrast() {
  const context = useAccessibilityContext()
  
  if (!context) {
    // Return safe defaults when context is unavailable
    return {
      isHighContrast: false,
      toggleHighContrast: () => {},
      getContrastClass: (lowContrast: string, highContrast: string) => lowContrast
    }
  }

  const { settings, actions } = context

  return {
    isHighContrast: settings.highContrast,
    toggleHighContrast: actions.toggleHighContrast,
    getContrastClass: (lowContrast: string, highContrast: string) => 
      settings.highContrast ? highContrast : lowContrast
  }
}

// Hook for managing reduced motion
export function useReducedMotion() {
  const context = useAccessibilityContext()
  
  if (!context) {
    // Return safe defaults when context is unavailable
    return {
      prefersReducedMotion: false,
      toggleReducedMotion: () => {},
      getAnimationClass: (animated: string, staticClassName: string = '') => animated
    }
  }

  const { settings, actions } = context

  return {
    prefersReducedMotion: settings.reducedMotion,
    toggleReducedMotion: actions.toggleReducedMotion,
    getAnimationClass: (animated: string, staticClassName: string = '') => 
      settings.reducedMotion ? staticClassName : animated
  }
}

// Hook for managing text scaling
export function useTextScaling() {
  const context = useAccessibilityContext()
  
  if (!context) {
    // Return safe defaults when context is unavailable
    return {
      textScale: 1.0,
      setTextScale: () => {},
      increaseTextSize: () => {},
      decreaseTextSize: () => {},
      resetTextSize: () => {},
      getScaledSize: (baseSize: number) => baseSize
    }
  }

  const { settings, actions } = context

  return {
    textScale: settings.textScale,
    setTextScale: actions.setTextScale,
    increaseTextSize: () => actions.setTextScale(Math.min(settings.textScale + 0.1, 2.0)),
    decreaseTextSize: () => actions.setTextScale(Math.max(settings.textScale - 0.1, 0.75)),
    resetTextSize: () => actions.setTextScale(1.0),
    getScaledSize: (baseSize: number) => baseSize * settings.textScale
  }
}

// Hook for managing color accessibility
export function useColorAccessibility() {
  const context = useAccessibilityContext()
  
  if (!context) {
    // Return safe defaults when context is unavailable
    return {
      colorBlindnessMode: 'none' as const,
      setColorBlindnessMode: () => {},
      getColorClass: (baseClass: string) => baseClass,
      isColorBlind: false
    }
  }

  const { settings, actions } = context

  const getColorClass = useCallback((baseClass: string): string => {
    if (settings.colorBlindnessMode === 'none') return baseClass

    // Map colors to colorblind-friendly alternatives
    const colorMap: Record<string, Record<string, string>> = {
      protanopia: {
        'text-red-500': 'text-orange-600',
        'text-green-500': 'text-blue-500',
        'bg-red-500': 'bg-orange-600',
        'bg-green-500': 'bg-blue-500',
        'border-red-500': 'border-orange-600',
        'border-green-500': 'border-blue-500'
      },
      deuteranopia: {
        'text-red-500': 'text-purple-600',
        'text-green-500': 'text-blue-500',
        'bg-red-500': 'bg-purple-600',
        'bg-green-500': 'bg-blue-500',
        'border-red-500': 'border-purple-600',
        'border-green-500': 'border-blue-500'
      },
      tritanopia: {
        'text-blue-500': 'text-red-500',
        'text-yellow-500': 'text-red-500',
        'bg-blue-500': 'bg-red-500',
        'bg-yellow-500': 'bg-red-500',
        'border-blue-500': 'border-red-500',
        'border-yellow-500': 'border-red-500'
      },
      achromatopsia: {
        'text-red-500': 'text-gray-700',
        'text-green-500': 'text-gray-700',
        'text-blue-500': 'text-gray-700',
        'text-yellow-500': 'text-gray-700',
        'bg-red-500': 'bg-gray-700',
        'bg-green-500': 'bg-gray-700',
        'bg-blue-500': 'bg-gray-700',
        'bg-yellow-500': 'bg-gray-700'
      }
    }

    const modeMap = colorMap[settings.colorBlindnessMode]
    return modeMap?.[baseClass] || baseClass
  }, [settings.colorBlindnessMode])

  return {
    colorBlindnessMode: settings.colorBlindnessMode,
    setColorBlindnessMode: actions.setColorBlindnessMode,
    getColorClass,
    isColorBlind: settings.colorBlindnessMode !== 'none'
  }
}

// Hook for managing voice navigation
export function useVoiceNavigation() {
  const context = useAccessibilityContext()
  const [isListening, setIsListening] = useState(false)
  const [lastCommand, setLastCommand] = useState<string>('')
  
  if (!context) {
    // Return safe defaults when context is unavailable
    return {
      isVoiceNavigationEnabled: false,
      toggleVoiceNavigation: () => {},
      isListening: false,
      lastCommand: '',
      startListening: () => null,
      stopListening: () => {},
    }
  }

  const { settings, actions } = context

  const startListening = useCallback(() => {
    if (!settings.voiceNavigation || !('webkitSpeechRecognition' in window)) return

    const recognition = new (window as any).webkitSpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim()
      setLastCommand(command)
    }

    recognition.start()
    return recognition
  }, [settings.voiceNavigation])

  const stopListening = useCallback((recognition: any) => {
    if (recognition) {
      recognition.stop()
      setIsListening(false)
    }
  }, [])

  return {
    isVoiceNavigationEnabled: settings.voiceNavigation,
    toggleVoiceNavigation: actions.toggleVoiceNavigation,
    isListening,
    lastCommand,
    startListening,
    stopListening
  }
}

// Hook for managing keyboard-only navigation
export function useKeyboardOnly() {
  const context = useAccessibilityContext()
  
  if (!context) {
    // Return safe defaults when context is unavailable
    return {
      isKeyboardOnly: false,
      toggleKeyboardOnly: () => {}
    }
  }

  const { settings, actions } = context

  useEffect(() => {
    if (settings.keyboardOnly) {
      // Hide mouse cursor when keyboard-only mode is active
      document.body.style.cursor = 'none'
      
      // Disable pointer events on hover states
      const style = document.createElement('style')
      style.textContent = `
        .keyboard-only *:hover {
          pointer-events: none !important;
        }
        .keyboard-only *:focus {
          pointer-events: auto !important;
        }
      `
      document.head.appendChild(style)

      return () => {
        document.body.style.cursor = 'auto'
        document.head.removeChild(style)
      }
    }
    
    // Return undefined when keyboard-only is not enabled
    return undefined
  }, [settings.keyboardOnly])

  return {
    isKeyboardOnly: settings.keyboardOnly,
    toggleKeyboardOnly: actions.toggleKeyboardOnly
  }
}

// Hook for managing enhanced focus indicators
export function useEnhancedFocus() {
  const context = useAccessibilityContext()
  
  if (!context) {
    // Return safe defaults when context is unavailable
    return {
      isEnhancedFocus: false,
      getFocusClasses: () => ''
    }
  }

  const { settings } = context

  const getFocusClasses = useCallback((element: 'button' | 'input' | 'link' | 'general' = 'general') => {
    if (!settings.enhancedFocus) return ''

    const baseClasses = 'focus:outline-4 focus:outline-offset-4 focus:outline-flow-primary-500'
    
    const elementSpecificClasses = {
      button: 'focus:ring-4 focus:ring-flow-primary-200 focus:ring-opacity-75',
      input: 'focus:border-flow-primary-500 focus:ring-4 focus:ring-flow-primary-200',
      link: 'focus:underline focus:underline-offset-4 focus:decoration-4',
      general: baseClasses
    }

    return `${baseClasses} ${elementSpecificClasses[element]}`
  }, [settings.enhancedFocus])

  return {
    isEnhancedFocus: settings.enhancedFocus,
    getFocusClasses
  }
}

// Hook for managing ARIA live regions
export function useAriaLiveRegion() {
  const regionRef = useRef<HTMLDivElement | null>(null)

  const updateRegion = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!regionRef.current) return

    regionRef.current.setAttribute('aria-live', priority)
    regionRef.current.textContent = message

    // Clear the message after it's been announced
    setTimeout(() => {
      if (regionRef.current) {
        regionRef.current.textContent = ''
      }
    }, 1000)
  }, [])

  return {
    regionRef,
    updateRegion
  }
}