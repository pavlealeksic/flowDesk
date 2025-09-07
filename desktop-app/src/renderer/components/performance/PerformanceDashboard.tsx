import React, { memo } from 'react'
import { useAppSelector } from '../../store'
import { 
  selectPerformanceData, 
  selectSlowComponents, 
  selectWebVitals,
  selectPerformanceWarnings 
} from '../../store/slices/performanceSlice'
import { Card } from '../ui/Card'

interface PerformanceDashboardProps {
  className?: string
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = memo(({ className }) => {
  const performanceData = useAppSelector(selectPerformanceData)
  const slowComponents = useAppSelector(selectSlowComponents)
  const webVitals = useAppSelector(selectWebVitals)
  const warnings = useAppSelector(selectPerformanceWarnings)

  if (!performanceData.isMonitoringEnabled) {
    return (
      <Card className={className}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">Performance Monitoring</h3>
          <p className="text-muted-foreground">
            Performance monitoring is disabled. Enable it in development mode to see metrics.
          </p>
        </div>
      </Card>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getScoreColor = (score: number, type: 'fcp' | 'lcp' | 'cls') => {
    switch (type) {
      case 'fcp':
        return score <= 1800 ? 'text-green-600' : score <= 3000 ? 'text-yellow-600' : 'text-red-600'
      case 'lcp':
        return score <= 2500 ? 'text-green-600' : score <= 4000 ? 'text-yellow-600' : 'text-red-600'
      case 'cls':
        return score <= 0.1 ? 'text-green-600' : score <= 0.25 ? 'text-yellow-600' : 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className={className}>
      <h2 className="text-2xl font-bold mb-6">Performance Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Component Stats */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Component Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Components</span>
                <span className="font-medium">{performanceData.totalComponents}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slow Components</span>
                <span className={`font-medium ${slowComponents.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {slowComponents.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bundle Size</span>
                <span className="font-medium">{formatBytes(performanceData.bundleSize)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Web Vitals */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Web Vitals</h3>
            <div className="space-y-3">
              {webVitals.fcp && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">FCP</span>
                  <span className={`font-medium ${getScoreColor(webVitals.fcp, 'fcp')}`}>
                    {webVitals.fcp.toFixed(0)}ms
                  </span>
                </div>
              )}
              {webVitals.lcp && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LCP</span>
                  <span className={`font-medium ${getScoreColor(webVitals.lcp, 'lcp')}`}>
                    {webVitals.lcp.toFixed(0)}ms
                  </span>
                </div>
              )}
              {webVitals.cls && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CLS</span>
                  <span className={`font-medium ${getScoreColor(webVitals.cls, 'cls')}`}>
                    {webVitals.cls.toFixed(3)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Memory Usage */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Memory Usage</h3>
            <div className="space-y-3">
              {Object.values(performanceData.components).map((component) => (
                <div key={component.componentName} className="flex justify-between">
                  <span className="text-muted-foreground truncate mr-2">
                    {component.componentName}
                  </span>
                  <span className="font-medium text-sm">
                    {formatBytes(component.memoryUsage)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Warnings */}
      {warnings.length > 0 && (
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Performance Issues</h3>
            <div className="space-y-2">
              {warnings.map((warning, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <span className="text-red-700 text-sm">{warning}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Slow Components Details */}
      {slowComponents.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Slow Components</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Component</th>
                    <th className="text-left py-2">Render Time</th>
                    <th className="text-left py-2">Re-renders</th>
                    <th className="text-left py-2">Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {slowComponents.map((component) => (
                    <tr key={component.componentName} className="border-b">
                      <td className="py-2 font-medium">{component.componentName}</td>
                      <td className="py-2 text-red-600">{component.renderTime.toFixed(2)}ms</td>
                      <td className="py-2">{component.reRenderCount}</td>
                      <td className="py-2">{formatBytes(component.memoryUsage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Performance Tips */}
      <Card className="mt-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Optimization Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Component Optimization</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Use React.memo for pure components</li>
                <li>• Optimize useCallback and useMemo dependencies</li>
                <li>• Avoid inline objects and functions in JSX</li>
                <li>• Use lazy loading for heavy components</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Bundle Optimization</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Enable code splitting</li>
                <li>• Tree-shake unused imports</li>
                <li>• Optimize asset loading</li>
                <li>• Use dynamic imports for routes</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
})

export default PerformanceDashboard