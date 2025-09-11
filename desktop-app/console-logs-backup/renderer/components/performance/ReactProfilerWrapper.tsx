import React, { Profiler, PropsWithChildren, ProfilerOnRenderCallback } from 'react'

interface ProfilerWrapperProps extends PropsWithChildren {
  id: string
  enabled?: boolean
  logSlowRenders?: boolean
  slowThresholdMs?: number
}

// Enhanced Profiler wrapper with performance insights
export const ReactProfilerWrapper: React.FC<ProfilerWrapperProps> = ({
  id,
  children,
  enabled = process.env.NODE_ENV === 'development',
  logSlowRenders = true,
  slowThresholdMs = 16
}) => {
  const onRenderCallback: ProfilerOnRenderCallback = (
    profilerID: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    if (!enabled) return

    const isSlowRender = actualDuration > slowThresholdMs
    
    if (logSlowRenders && isSlowRender) {
      console.group(`🐌 Slow Render Detected - ${profilerID}`)
      console.log(`Phase: ${phase}`)
      console.log(`Actual duration: ${actualDuration.toFixed(2)}ms`)
      console.log(`Base duration: ${baseDuration.toFixed(2)}ms`)
      console.log(`Start time: ${startTime.toFixed(2)}ms`)
      console.log(`Commit time: ${commitTime.toFixed(2)}ms`)
      console.groupEnd()
    }

    // Send to performance monitoring system
    if (window.performance && window.performance.mark) {
      window.performance.mark(`${profilerID}-render-${phase}`)
      window.performance.measure(
        `${profilerID}-render-duration`,
        `${profilerID}-render-${phase}`
      )
    }
  }

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <Profiler id={id} onRender={onRenderCallback}>
      {children}
    </Profiler>
  )
}

export default ReactProfilerWrapper