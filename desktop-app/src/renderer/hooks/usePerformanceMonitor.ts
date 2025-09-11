import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppDispatch } from '../store'
import { updateComponentPerformance, updateWebVitals } from '../store/slices/performanceSlice'
import { useLogger } from '../logging/RendererLoggingService';

// Performance monitoring - only active in development
const isDev = process.env.NODE_ENV === 'development'

// React DevTools Profiler integration
declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      onCommitFiberRoot?: (id: number, root: any, priorityLevel?: any) => void
      onCommitFiberUnmount?: (id: number, fiber: any) => void
    }
  }
}

interface PerformanceMetrics {
  componentLoadTime: number
  bundleSize: number
  renderTime: number
  reRenderCount: number
  memoryUsage: number
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  cls: number // Cumulative Layout Shift
}

interface UsePerformanceMonitorOptions {
  componentName: string
  enabled?: boolean
  logToConsole?: boolean
}

export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions) => {
  const { componentName, enabled = isDev, logToConsole = isDev } = options
  const dispatch = useAppDispatch()
  const logger = useLogger('usePerformanceMonitor')
  const startTimeRef = useRef<number>(0)
  const renderCountRef = useRef<number>(0)
  const [webVitals, setWebVitals] = useState<Partial<PerformanceMetrics>>({})
  
  const metricsRef = useRef<PerformanceMetrics>({
    componentLoadTime: 0,
    bundleSize: 0,
    renderTime: 0,
    reRenderCount: 0,
    memoryUsage: 0,
    fcp: 0,
    lcp: 0,
    cls: 0
  })

  // Web Vitals measurement
  useEffect(() => {
    if (!enabled) return

    const measureWebVitals = () => {
      // First Contentful Paint
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            setWebVitals(prev => ({ ...prev, fcp: entry.startTime }))
          }
        }
      })

      try {
        observer.observe({ entryTypes: ['paint'] })
      } catch (e) {
        // Paint timing not supported
      }

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        setWebVitals(prev => ({ ...prev, lcp: lastEntry.startTime }))
      })

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
      } catch (e) {
        // LCP not supported
      }

      return () => {
        observer.disconnect()
        lcpObserver.disconnect()
      }
    }

    return measureWebVitals()
  }, [enabled])

  // Component lifecycle tracking
  useEffect(() => {
    if (!enabled) return

    const startTime = performance.now()
    startTimeRef.current = startTime
    renderCountRef.current += 1

    return () => {
      const endTime = performance.now()
      const loadTime = endTime - startTime
      
      metricsRef.current.componentLoadTime = loadTime
      metricsRef.current.reRenderCount = renderCountRef.current
      
      // Memory usage tracking
      if ('memory' in performance) {
        metricsRef.current.memoryUsage = (performance as any).memory.usedJSHeapSize
      }
      
      // Dispatch to Redux store
      dispatch(updateComponentPerformance({
        componentName,
        renderTime: metricsRef.current.renderTime,
        reRenderCount: renderCountRef.current,
        memoryUsage: metricsRef.current.memoryUsage,
        lastUpdated: Date.now()
      }))
      
      // Dispatch web vitals
      if (webVitals.fcp || webVitals.lcp) {
        dispatch(updateWebVitals(webVitals))
      }
      
      if (logToConsole && renderCountRef.current === 1) {
        console.group(`⚡ Performance Metrics - ${componentName}`)
        logger.debug('Console log', undefined, { originalArgs: [`Component load time: ${loadTime.toFixed(2)}ms`], method: 'console.log' })
        logger.debug('Console log', undefined, { originalArgs: [`Re-render count: ${renderCountRef.current}`], method: 'console.log' })
        
        if (webVitals.fcp) logger.debug('Console log', undefined, { originalArgs: [`FCP: ${webVitals.fcp.toFixed(2)}ms`], method: 'console.log' })
        if (webVitals.lcp) logger.debug('Console log', undefined, { originalArgs: [`LCP: ${webVitals.lcp.toFixed(2)}ms`], method: 'console.log' })
        
        console.groupEnd()
      }
    }
  }, [componentName, enabled, logToConsole, webVitals, dispatch])

  const reportPerformanceIssues = useCallback(() => {
    if (!enabled) return

    const metrics = metricsRef.current
    const issues: string[] = []

    if (metrics.reRenderCount > 10) {
      issues.push(`⚠️ High re-render count: ${metrics.reRenderCount}`)
    }
    
    if (metrics.renderTime > 16) {
      issues.push(`⚠️ Slow render: ${metrics.renderTime.toFixed(2)}ms (target: <16ms)`)
    }

    if (webVitals.lcp && webVitals.lcp > 2500) {
      issues.push(`⚠️ Poor LCP: ${webVitals.lcp.toFixed(2)}ms (target: <2500ms)`)
    }

    if (issues.length > 0) {
      console.group(`🚨 Performance Issues - ${componentName}`)
      issues.forEach(issue => logger.warn('Console warning', undefined, { originalArgs: [issue], method: 'console.warn' }))
      console.groupEnd()
    }
  }, [enabled, componentName, webVitals])

  return {
    getMetrics: () => ({ ...metricsRef.current, ...webVitals }),
    getRenderCount: () => renderCountRef.current,
    reportIssues: reportPerformanceIssues,
    markRenderStart: () => {
      if (enabled) {
        startTimeRef.current = performance.now()
      }
    },
    markRenderEnd: () => {
      if (enabled) {
        const renderTime = performance.now() - startTimeRef.current
        metricsRef.current.renderTime = renderTime
        
        if (logToConsole && renderTime > 16) {
          logger.warn('Console warning', undefined, { originalArgs: [`🎨 Slow render for ${componentName}: ${renderTime.toFixed(2)}ms`], method: 'console.warn' })
        }
      }
    },
    webVitals
  }
}

// Hook to monitor bundle chunk loading
export const useBundleMonitor = () => {
  useEffect(() => {
    if (!isDev) return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'resource' && entry.name.includes('.js')) {
          const size = (entry as any).transferSize || 0
          const loadTime = entry.duration
          
          console.log(`📦 Bundle loaded: ${entry.name.split('/').pop()}`)
          console.log(`   Size: ${(size / 1024).toFixed(2)}KB`)
          console.log(`   Load time: ${loadTime.toFixed(2)}ms`)
        }
      })
    })
    
    try {
      observer.observe({ entryTypes: ['resource'] })
    } catch (error) {
      console.warn('Bundle monitoring not supported in this environment')
    }
    
    return () => observer.disconnect()
  }, [])
}