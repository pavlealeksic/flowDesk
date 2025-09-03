import { useEffect, useRef } from 'react'

interface PerformanceMetrics {
  componentLoadTime: number
  bundleSize: number
  renderTime: number
}

interface UsePerformanceMonitorOptions {
  componentName: string
  enabled?: boolean
  logToConsole?: boolean
}

export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions) => {
  const { componentName, enabled = __DEV__, logToConsole = __DEV__ } = options
  const startTimeRef = useRef<number>(0)
  const metricsRef = useRef<PerformanceMetrics>({
    componentLoadTime: 0,
    bundleSize: 0,
    renderTime: 0
  })

  useEffect(() => {
    if (!enabled) return

    const startTime = performance.now()
    startTimeRef.current = startTime

    return () => {
      const endTime = performance.now()
      const loadTime = endTime - startTime
      
      metricsRef.current.componentLoadTime = loadTime
      
      if (logToConsole) {
        console.group(`⚡ Performance Metrics - ${componentName}`)
        console.log(`Component load time: ${loadTime.toFixed(2)}ms`)
        
        // Check if PerformanceObserver is available
        if ('PerformanceObserver' in window) {
          try {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries()
              entries.forEach((entry) => {
                if (entry.entryType === 'resource' && entry.name.includes(componentName.toLowerCase())) {
                  console.log(`Resource load time: ${entry.duration.toFixed(2)}ms`)
                  console.log(`Transfer size: ${(entry as any).transferSize || 0} bytes`)
                }
              })
            })
            
            observer.observe({ entryTypes: ['resource'] })
            
            // Clean up observer after a delay
            setTimeout(() => observer.disconnect(), 1000)
          } catch (error) {
            // PerformanceObserver not supported or error occurred
          }
        }
        
        console.groupEnd()
      }
    }
  }, [componentName, enabled, logToConsole])

  return {
    getMetrics: () => metricsRef.current,
    markRenderStart: () => {
      if (enabled) {
        startTimeRef.current = performance.now()
      }
    },
    markRenderEnd: () => {
      if (enabled) {
        const renderTime = performance.now() - startTimeRef.current
        metricsRef.current.renderTime = renderTime
        
        if (logToConsole) {
          console.log(`🎨 Render time for ${componentName}: ${renderTime.toFixed(2)}ms`)
        }
      }
    }
  }
}

// Hook to monitor bundle chunk loading
export const useBundleMonitor = () => {
  useEffect(() => {
    if (!__DEV__) return

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