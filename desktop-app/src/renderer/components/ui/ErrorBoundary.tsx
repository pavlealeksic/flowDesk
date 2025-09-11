import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react'
import { Button } from './Button'
import { cn } from './utils'
import { rendererLogger } from '../../logging/RendererLoggingService';

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolate?: boolean // Whether this boundary should isolate errors (don't propagate up)
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  eventId: string | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      copied: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      eventId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error details
    rendererLogger.error('Console error', undefined, { originalArgs: ['Error caught by boundary:', error], method: 'console.error' })
    rendererLogger.error('Console error', undefined, { originalArgs: ['Error info:', errorInfo], method: 'console.error' })

    // Report to error tracking service
    this.reportError(error, errorInfo)

    // Call onError callback
    this.props.onError?.(error, errorInfo)
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    if (hasError && prevProps.children !== this.props.children && resetOnPropsChange) {
      this.resetErrorBoundary()
    }

    if (hasError && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || []
      const hasResetKeyChanged = resetKeys.some((resetKey, idx) => {
        return prevResetKeys[idx] !== resetKey
      })

      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }
  }

  reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real app, you would send this to your error reporting service
    // like Sentry, Bugsnag, or your own analytics
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    // Example: Send to analytics
    if ((window.flowDesk as any)?.analytics) {
      (window.flowDesk as any).analytics.captureException(error, {
        context: 'error_boundary',
        extra: errorReport
      })
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId)
    }

    this.resetTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        eventId: null,
        copied: false
      })
    }, 100)
  }

  copyErrorDetails = () => {
    const { error, errorInfo, eventId } = this.state
    const errorDetails = `
Error ID: ${eventId}
Message: ${error?.message}
Stack: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
Timestamp: ${new Date().toISOString()}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
    `.trim()

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true })
      setTimeout(() => {
        this.setState({ copied: false })
      }, 2000)
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { error, errorInfo, eventId, copied } = this.state

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="max-w-md w-full space-y-6">
            <div className="space-y-3">
              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              
              <h2 className="text-xl font-semibold text-foreground">
                Something went wrong
              </h2>
              
              <p className="text-sm text-muted-foreground leading-relaxed">
                We encountered an unexpected error. This has been logged and our team will investigate.
              </p>

              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded-lg text-xs font-mono text-left overflow-x-auto">
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold">Error:</span> {error.message}
                      </div>
                      {eventId && (
                        <div>
                          <span className="font-semibold">ID:</span> {eventId}
                        </div>
                      )}
                      {error.stack && (
                        <div>
                          <span className="font-semibold">Stack:</span>
                          <pre className="mt-1 text-xs whitespace-pre-wrap">{error.stack}</pre>
                        </div>
                      )}
                      {errorInfo?.componentStack && (
                        <div>
                          <span className="font-semibold">Component Stack:</span>
                          <pre className="mt-1 text-xs whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                </details>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.resetErrorBoundary}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>

              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Reload App
              </Button>

              {eventId && (
                <Button
                  variant="outline"
                  onClick={this.copyErrorDetails}
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Details
                    </>
                  )}
                </Button>
              )}
            </div>

            {eventId && (
              <p className="text-xs text-muted-foreground">
                Error ID: <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{eventId}</code>
              </p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Specialized error boundaries for different parts of the app
export const MailErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Mail Error</h3>
        <p className="text-sm text-muted-foreground mb-4">
          There was a problem loading your mail. Please try refreshing or check your connection.
        </p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Mail
        </Button>
      </div>
    }
    onError={(error, errorInfo) => {
      rendererLogger.error('Console error', undefined, { originalArgs: ['Mail component error:', error, errorInfo], method: 'console.error' })
      // Send mail-specific error tracking
    }}
  >
    {children}
  </ErrorBoundary>
)

export const CalendarErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Calendar Error</h3>
        <p className="text-sm text-muted-foreground mb-4">
          There was a problem loading your calendar. Please try refreshing.
        </p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Calendar
        </Button>
      </div>
    }
    onError={(error, errorInfo) => {
      rendererLogger.error('Console error', undefined, { originalArgs: ['Calendar component error:', error, errorInfo], method: 'console.error' })
    }}
  >
    {children}
  </ErrorBoundary>
)

export const WorkspaceErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Workspace Error</h3>
        <p className="text-sm text-muted-foreground mb-4">
          There was a problem loading your workspace. Please try again.
        </p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Workspace
        </Button>
      </div>
    }
    onError={(error, errorInfo) => {
      rendererLogger.error('Console error', undefined, { originalArgs: ['Workspace component error:', error, errorInfo], method: 'console.error' })
    }}
  >
    {children}
  </ErrorBoundary>
)