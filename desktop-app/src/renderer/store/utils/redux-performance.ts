import { rendererLogger } from '../../logging/RendererLoggingService';
import { createSelector } from '@reduxjs/toolkit';

// Performance metrics tracking
interface PerformanceMetrics {
  executionTime: number;
  selectorCalls: number;
  cacheHits: number;
  cacheMisses: number;
  averageExecutionTime: number;
}

const performanceMetrics = new Map<string, PerformanceMetrics>();
const logger = rendererLogger;

// Time constants
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Create a performance-enhanced selector
export const createPerformanceSelector = <State, Result>(
  selector: (state: State) => Result,
  selectorName: string
) => {
  let lastExecutionTime = 0;
  let callCount = 0;
  let totalTime = 0;

  return (state: State): Result => {
    const startTime = performance.now();
    
    try {
      const result = selector(state);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Update performance metrics
      callCount++;
      totalTime += executionTime;
      lastExecutionTime = executionTime;
      
      const metrics = performanceMetrics.get(selectorName) || {
        executionTime: 0,
        selectorCalls: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageExecutionTime: 0
      };
      
      metrics.executionTime += executionTime;
      metrics.selectorCalls++;
      metrics.averageExecutionTime = metrics.executionTime / metrics.selectorCalls;
      
      performanceMetrics.set(selectorName, metrics);
      
      // Log slow selectors
      if (executionTime > 16) {
        logger.warn('Console warning', undefined, { originalArgs: [`Slow selector detected: ${selectorName} (${executionTime.toFixed(2)}ms)`], method: 'console.warn' });
      }
      
      return result;
    } catch (error) {
      logger.error('Console error', undefined, { originalArgs: [`Selector error in ${selectorName}:`, error], method: 'console.error' });
      throw error;
    }
  }
};

// Monitor performance over time
export const startPerformanceMonitoring = (interval: number = 5000) => {
  const intervalId = setInterval(() => {
    const metrics = Array.from(performanceMetrics.entries());
    
    metrics.forEach(([selectorName, metrics]) => {
      if (metrics.averageExecutionTime > 10 && metrics.selectorCalls > 5) {
        logger.warn('Console warning', undefined, { originalArgs: [`Slow selector detected: ${selectorName} (avg: ${metrics.averageExecutionTime.toFixed(2)}ms)`], method: 'console.warn' });
      }
    });
  }, interval);
  
  return intervalId;
};

// Get performance metrics for a specific selector
export const getSelectorPerformance = (selectorName: string): PerformanceMetrics | undefined => {
  return performanceMetrics.get(selectorName);
};

// Get all performance metrics
export const getPerformanceMetrics = (): Map<string, PerformanceMetrics> => {
  return new Map(performanceMetrics);
};

// Clear performance metrics
export const clearPerformanceMetrics = (): void => {
  performanceMetrics.clear();
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

// Memoized action creator
export const createMemoizedAction = <T extends (...args: any[]) => any>(
  actionCreator: T,
  memoize: (args: Parameters<T>) => boolean = () => true
) => {
  const lastCall = new Map<string, { result: ReturnType<T>; timestamp: number }>();

  return (...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();

    if (lastCall.has(key)) {
      const { result, timestamp } = lastCall.get(key)!;
      if (now - timestamp < 1000) { // Cache for 1 second
        return result;
      }
    }

    const result = actionCreator(...args);
    lastCall.set(key, { result, timestamp: now });

    return result;
  }
}

// State size monitoring
export const monitorStateSize = (state: unknown, sliceName: string) => {
  const stateSize = JSON.stringify(state).length;
  const warnings: string[] = [];

  // Warn if state is larger than 5MB
  if (stateSize > 5 * 1024 * 1024) {
    warnings.push(`Large state detected in ${sliceName}: ${(stateSize / 1024 / 1024).toFixed(2)}MB`);
  }

  return warnings;
}

// State history tracking
interface StateEntry {
  size: number;
  timestamp: number;
  data: unknown;
}

const stateHistory = new Map<string, StateEntry[]>();

export const trackStateHistory = (sliceName: string, state: unknown) => {
  const now = Date.now();
  const stateSize = JSON.stringify(state).length;

  const entry: StateEntry = {
    size: stateSize,
    timestamp: now,
    data: state
  };

  if (!stateHistory.has(sliceName)) {
    stateHistory.set(sliceName, []);
  }

  const history = stateHistory.get(sliceName)!;
  history.push(entry);

  // Keep only last 100 entries
  if (history.length > 100) {
    history.shift();
  }

  // Analyze state patterns
  const warnings: string[] = [];

  stateHistory.forEach((entries, name) => {
    // Warn if state is larger than 5MB
    if (entries.length > 0 && entries[entries.length - 1].size > 5 * 1024 * 1024) {
      warnings.push(`Large state detected in ${name}: ${(entries[entries.length - 1].size / 1024 / 1024).toFixed(2)}MB`);
    }

    // Warn if state size has been consistently growing
    const recentEntries = entries.filter(entry => now - entry.timestamp < HOUR);

    if (recentEntries.length > 10) {
      const sizes = recentEntries.map(entry => entry.size);
      const isGrowing = sizes.every((size, index) => index === 0 || size >= sizes[index - 1]);
      
      if (isGrowing) {
        warnings.push(`Memory leak suspected in ${name}: state size consistently growing`);
      }
    }
  });

  return warnings;
}

export const getStateHistory = (sliceName: string): StateEntry[] => {
  return stateHistory.get(sliceName) || [];
}

export const clearStateHistory = (sliceName?: string): void => {
  if (sliceName) {
    stateHistory.delete(sliceName);
  } else {
    stateHistory.clear();
  }
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
        logger.error('Console error', undefined, { originalArgs: ['Selector error:', error], method: 'console.error' })
      }
      return fallback
    }
  }
}

export { createSelector }