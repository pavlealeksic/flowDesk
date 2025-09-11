import React, { ReactNode } from 'react';
import { Profiler, ProfilerOnRenderCallback } from 'react';
import { useLogger } from '../../logging/RendererLoggingService';

const logger = useLogger('ReactProfilerWrapper');

interface ReactProfilerWrapperProps {
  id: string;
  children: ReactNode;
  enabled?: boolean;
  logSlowRenders?: boolean;
  slowRenderThreshold?: number;
}

/**
 * React Profiler Wrapper for performance monitoring
 * 
 * This component wraps React components with Profiler API to measure and log
 * rendering performance. It provides detailed timing information and slow
 * render detection.
 * 
 * Key features:
 * - React Profiler API integration
 * - Slow render detection and logging
 * - Performance metrics collection
 * - Browser performance API integration
 * - Configurable thresholds and logging
 * 
 * @param id - Unique identifier for the profiled component
 * @param children - React components to wrap
 * @param enabled - Enable/disable profiling (default: true)
 * @param logSlowRenders - Log slow renders (default: true)
 * @param slowRenderThreshold - Threshold for slow renders in ms (default: 16)
 */
export const ReactProfilerWrapper: React.FC<ReactProfilerWrapperProps> = ({
  id,
  children,
  enabled = true,
  logSlowRenders = true,
  slowRenderThreshold = 16,
}) => {
  const logger = useLogger('ReactProfilerWrapper');

  const onRenderCallback: ProfilerOnRenderCallback = (
    profilerID,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime
  ) => {
    // Detect slow renders
    const isSlowRender = actualDuration > slowRenderThreshold;

    // Log slow renders with detailed information
    if (logSlowRenders && isSlowRender) {
      console.group(`🐌 Slow Render Detected - ${profilerID}`)
      logger.debug('Console log', undefined, { originalArgs: [`Phase: ${phase}`], method: 'console.log' })
      logger.debug('Console log', undefined, { originalArgs: [`Actual duration: ${actualDuration.toFixed(2)}ms`], method: 'console.log' })
      logger.debug('Console log', undefined, { originalArgs: [`Base duration: ${baseDuration.toFixed(2)}ms`], method: 'console.log' })
      logger.debug('Console log', undefined, { originalArgs: [`Start time: ${startTime.toFixed(2)}ms`], method: 'console.log' })
      logger.debug('Console log', undefined, { originalArgs: [`Commit time: ${commitTime.toFixed(2)}ms`], method: 'console.log' })
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