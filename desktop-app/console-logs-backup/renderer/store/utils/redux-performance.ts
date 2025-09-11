import { createSelector } from '@reduxjs/toolkit'

/**
 * Redux Performance Utilities
 * 
 * This module contains utilities to optimize Redux performance by:
 * 1. Normalizing state shape
 * 2. Creating efficient selectors
 * 3. Handling serialization properly
 * 4. Managing state updates efficiently
 */

// Date serialization utilities
export const serializeDate = (date: Date | string | null | undefined): string | null => {
  if (!date) return null
  if (typeof date === 'string') return date
  return date.toISOString()
}

export const deserializeDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null
  try {
    return new Date(dateString)
  } catch {
    return null
  }
}

// State normalization utilities
export interface NormalizedEntity {
  id: string
  [key: string]: unknown
}

export interface NormalizedState<T extends NormalizedEntity> {
  byId: Record<string, T>
  allIds: string[]
}

export const normalizeArray = <T extends NormalizedEntity>(array: T[]): NormalizedState<T> => {
  const byId: Record<string, T> = {}
  const allIds: string[] = []

  array.forEach((item) => {
    byId[item.id] = item
    allIds.push(item.id)
  })

  return { byId, allIds }
}

export const denormalizeState = <T extends NormalizedEntity>(
  normalizedState: NormalizedState<T>
): T[] => {
  return normalizedState.allIds.map(id => normalizedState.byId[id]).filter(Boolean)
}

// Selector performance utilities
export const createCachedSelector = <State, Result>(
  selectors: ((state: State) => unknown)[],
  resultFunc: (...args: unknown[]) => Result,
  keySelector?: (state: State, ...args: unknown[]) => string
) => {
  if (keySelector) {
    return createSelector(selectors, resultFunc, {
      memoizeOptions: {
        resultEqualityCheck: (a, b) => a === b
      }
    })
  }
  return createSelector(selectors, resultFunc)
}

// Performance monitoring utilities
export interface PerformanceMetrics {
  selectorCalls: number
  averageExecutionTime: number
  lastExecutionTime: number
}

const performanceMetrics = new Map<string, PerformanceMetrics>()

export const measureSelectorPerformance = <T>(
  selectorName: string,
  selector: () => T
): T => {
  const start = performance.now()
  const result = selector()
  const executionTime = performance.now() - start

  const existing = performanceMetrics.get(selectorName) || {
    selectorCalls: 0,
    averageExecutionTime: 0,
    lastExecutionTime: 0
  }

  const newMetrics: PerformanceMetrics = {
    selectorCalls: existing.selectorCalls + 1,
    averageExecutionTime: (existing.averageExecutionTime * existing.selectorCalls + executionTime) / (existing.selectorCalls + 1),
    lastExecutionTime: executionTime
  }

  performanceMetrics.set(selectorName, newMetrics)

  // Warn if selector is consistently slow
  if (newMetrics.averageExecutionTime > 10 && newMetrics.selectorCalls > 5) {
    console.warn(`Slow selector detected: ${selectorName} (avg: ${newMetrics.averageExecutionTime.toFixed(2)}ms)`)
  }

  return result
}

export const getPerformanceMetrics = (): Map<string, PerformanceMetrics> => {
  return new Map(performanceMetrics)
}

export const clearPerformanceMetrics = (): void => {
  performanceMetrics.clear()
}

// Debounced action dispatcher
export const createDebouncedDispatch = (dispatch: (action: unknown) => void, delay: number = 300) => {
  let timeoutId: NodeJS.Timeout | null = null

  return (action: unknown) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      dispatch(action)
      timeoutId = null
    }, delay)
  }
}

// Batched state updates
export const createBatchedUpdater = <T>(
  updateAction: (updates: T[]) => unknown,
  batchSize: number = 10,
  batchDelay: number = 100
) => {
  let batch: T[] = []
  let timeoutId: NodeJS.Timeout | null = null

  const flush = (dispatch: (action: unknown) => void) => {
    if (batch.length > 0) {
      dispatch(updateAction([...batch]))
      batch = []
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return (dispatch: (action: unknown) => void, update: T) => {
    batch.push(update)

    if (batch.length >= batchSize) {
      flush(dispatch)
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => flush(dispatch), batchDelay)
    }
  }
}

// Memory leak detection utilities
const stateHistory = new Map<string, { size: number, timestamp: number }>()

export const trackStateSize = (sliceName: string, state: unknown): void => {
  const size = JSON.stringify(state).length
  const timestamp = Date.now()

  stateHistory.set(sliceName, { size, timestamp })

  // Clean old entries (keep last 100)
  if (stateHistory.size > 100) {
    const entries = Array.from(stateHistory.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, entries.length - 100)
    toRemove.forEach(([key]) => stateHistory.delete(key))
  }
}

export const detectMemoryLeaks = (): string[] => {
  const warnings: string[] = []
  const now = Date.now()
  const HOUR = 60 * 60 * 1000

  stateHistory.forEach((entry, sliceName) => {
    // Warn if state is larger than 5MB
    if (entry.size > 5 * 1024 * 1024) {
      warnings.push(`Large state detected in ${sliceName}: ${(entry.size / 1024 / 1024).toFixed(2)}MB`)
    }

    // Warn if state size has been consistently growing
    const recentEntries = Array.from(stateHistory.entries())
      .filter(([_, e]) => now - e.timestamp < HOUR)
      .filter(([name]) => name === sliceName)

    if (recentEntries.length > 10) {
      const sizes = recentEntries.map(([_, e]) => e.size)
      const isGrowing = sizes.every((size, index) => index === 0 || size >= sizes[index - 1])
      
      if (isGrowing) {
        warnings.push(`Memory leak suspected in ${sliceName}: state size consistently growing`)
      }
    }
  })

  return warnings
}

// Production optimizations
export const createProductionSelector = <State, Result>(
  selector: (state: State) => Result,
  fallback: Result
) => {
  return (state: State): Result => {
    try {
      return selector(state)
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Selector error:', error)
      }
      return fallback
    }
  }
}

export { createSelector }