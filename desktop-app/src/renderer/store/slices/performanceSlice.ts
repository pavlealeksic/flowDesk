import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ComponentPerformance {
  componentName: string
  renderTime: number
  reRenderCount: number
  memoryUsage: number
  lastUpdated: number
}

interface WebVitals {
  fcp?: number // First Contentful Paint
  lcp?: number // Largest Contentful Paint
  cls?: number // Cumulative Layout Shift
  fid?: number // First Input Delay
  ttfb?: number // Time to First Byte
}

interface PerformanceState {
  components: Record<string, ComponentPerformance>
  webVitals: WebVitals
  bundleSize: number
  totalComponents: number
  slowRenderThreshold: number
  isMonitoringEnabled: boolean
  performanceWarnings: string[]
}

const initialState: PerformanceState = {
  components: {},
  webVitals: {},
  bundleSize: 0,
  totalComponents: 0,
  slowRenderThreshold: 16, // 16ms for 60fps
  isMonitoringEnabled: process.env.NODE_ENV === 'development',
  performanceWarnings: []
}

const performanceSlice = createSlice({
  name: 'performance',
  initialState,
  reducers: {
    updateComponentPerformance: (
      state,
      action: PayloadAction<ComponentPerformance>
    ) => {
      const { componentName } = action.payload
      state.components[componentName] = action.payload
      state.totalComponents = Object.keys(state.components).length

      // Check for performance issues
      if (action.payload.renderTime > state.slowRenderThreshold) {
        const warning = `Slow render detected in ${componentName}: ${action.payload.renderTime.toFixed(2)}ms`
        if (!state.performanceWarnings.includes(warning)) {
          state.performanceWarnings.push(warning)
        }
      }

      if (action.payload.reRenderCount > 10) {
        const warning = `High re-render count in ${componentName}: ${action.payload.reRenderCount}`
        if (!state.performanceWarnings.includes(warning)) {
          state.performanceWarnings.push(warning)
        }
      }
    },

    updateWebVitals: (state, action: PayloadAction<Partial<WebVitals>>) => {
      state.webVitals = { ...state.webVitals, ...action.payload }
    },

    updateBundleSize: (state, action: PayloadAction<number>) => {
      state.bundleSize = action.payload
    },

    setMonitoringEnabled: (state, action: PayloadAction<boolean>) => {
      state.isMonitoringEnabled = action.payload
    },

    setSlowRenderThreshold: (state, action: PayloadAction<number>) => {
      state.slowRenderThreshold = action.payload
    },

    clearPerformanceWarnings: (state) => {
      state.performanceWarnings = []
    },

    clearComponentData: (state, action: PayloadAction<string>) => {
      delete state.components[action.payload]
      state.totalComponents = Object.keys(state.components).length
    },

    resetPerformanceData: (state) => {
      state.components = {}
      state.webVitals = {}
      state.performanceWarnings = []
      state.totalComponents = 0
    }
  }
})

export const {
  updateComponentPerformance,
  updateWebVitals,
  updateBundleSize,
  setMonitoringEnabled,
  setSlowRenderThreshold,
  clearPerformanceWarnings,
  clearComponentData,
  resetPerformanceData
} = performanceSlice.actions

// Selectors
export const selectPerformanceData = (state: { performance: PerformanceState }) => state.performance
export const selectComponentPerformance = (componentName: string) => (state: { performance: PerformanceState }) =>
  state.performance.components[componentName]
export const selectSlowComponents = (state: { performance: PerformanceState }) =>
  Object.values(state.performance.components).filter(
    component => component.renderTime > state.performance.slowRenderThreshold
  )
export const selectHighReRenderComponents = (state: { performance: PerformanceState }) =>
  Object.values(state.performance.components).filter(
    component => component.reRenderCount > 10
  )
export const selectWebVitals = (state: { performance: PerformanceState }) => state.performance.webVitals
export const selectPerformanceWarnings = (state: { performance: PerformanceState }) => state.performance.performanceWarnings

export { type PerformanceState }
export default performanceSlice.reducer