/**
 * Memory Cleanup Hook
 * 
 * Provides utilities for managing memory usage and preventing leaks
 */

import { useEffect, useRef, useCallback } from 'react'

interface MemoryCleanupOptions {
  // Maximum number of items to keep in memory
  maxItems?: number
  // Cleanup interval in milliseconds
  cleanupInterval?: number
  // Enable performance monitoring
  enablePerfMonitoring?: boolean
}

export const useMemoryCleanup = (options: MemoryCleanupOptions = {}) => {
  const {
    maxItems = 1000,
    cleanupInterval = 30000, // 30 seconds
    enablePerfMonitoring = false
  } = options

  const cleanupCallbacks = useRef<Set<() => void>>(new Set())
  const memoryUsage = useRef<number>(0)
  const performanceObserver = useRef<PerformanceObserver | null>(null)

  // Register a cleanup callback
  const registerCleanup = useCallback((cleanup: () => void) => {
    cleanupCallbacks.current.add(cleanup)
    
    return () => {
      cleanupCallbacks.current.delete(cleanup)
    }
  }, [])

  // Force garbage collection (if available)
  const forceGC = useCallback(() => {
    if (window.gc) {
      window.gc()
    }
  }, [])

  // Get current memory usage
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
      }
    }
    return null
  }, [])

  // Cleanup stale data based on age or size limits
  const cleanupStaleData = useCallback(<T>(
    items: T[],
    maxCount: number,
    getAge?: (item: T) => number
  ): T[] => {
    if (items.length <= maxCount) {
      return items
    }

    if (getAge) {
      // Sort by age and keep most recent
      return items
        .sort((a, b) => getAge(b) - getAge(a))
        .slice(0, maxCount)
    } else {
      // Keep most recent items
      return items.slice(-maxCount)
    }
  }, [])

  // Cleanup interval effect
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (cleanupInterval > 0) {
      interval = setInterval(() => {
        // Run all registered cleanup callbacks
        cleanupCallbacks.current.forEach(callback => {
          try {
            callback()
          } catch (error) {
            console.error('Cleanup callback error:', error)
          }
        })

        // Update memory usage
        const memory = getMemoryUsage()
        if (memory) {
          memoryUsage.current = memory.used
          
          // Log memory usage if monitoring is enabled
          if (enablePerfMonitoring && memory.used > memory.limit * 0.8) {
            console.warn('High memory usage detected:', memory)
          }
        }

        // Force GC if memory usage is high
        if (memory && memory.used > memory.limit * 0.9) {
          forceGC()
        }
      }, cleanupInterval)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [cleanupInterval, enablePerfMonitoring, forceGC, getMemoryUsage])

  // Performance monitoring
  useEffect(() => {
    if (enablePerfMonitoring && 'PerformanceObserver' in window) {
      performanceObserver.current = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.entryType === 'measure' || entry.entryType === 'navigation') {
            console.log(`Performance: ${entry.name} took ${entry.duration}ms`)
          }
        })
      })

      try {
        performanceObserver.current.observe({ entryTypes: ['measure', 'navigation'] })
      } catch (error) {
        console.warn('Performance observer not supported:', error)
      }
    }

    return () => {
      if (performanceObserver.current) {
        performanceObserver.current.disconnect()
      }
    }
  }, [enablePerfMonitoring])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Run all cleanup callbacks
      cleanupCallbacks.current.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.error('Unmount cleanup error:', error)
        }
      })
      
      cleanupCallbacks.current.clear()
      
      if (performanceObserver.current) {
        performanceObserver.current.disconnect()
      }
    }
  }, [])

  return {
    registerCleanup,
    forceGC,
    getMemoryUsage,
    cleanupStaleData,
    currentMemoryUsage: memoryUsage.current
  }
}

// Extend window type for TypeScript
declare global {
  interface Window {
    gc?: () => void
  }
}