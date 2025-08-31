import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button, AlertCircle, RefreshCw } from '../ui'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class MailErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })
    
    // Log error to console
    console.error('Mail Error Boundary caught an error:', error, errorInfo)
    
    // TODO: Send error to logging service
    // logError('mail-error-boundary', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="mb-6">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Something went wrong with Mail</h2>
            <p className="text-muted-foreground max-w-md">
              The mail interface encountered an unexpected error. You can try reloading the component or the entire application.
            </p>
          </div>

          <div className="space-y-3">
            <Button onClick={this.handleRetry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            <Button variant="outline" onClick={this.handleReload} className="w-full">
              Reload Application
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-8 w-full max-w-2xl">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Show Error Details (Development)
              </summary>
              <div className="mt-4 p-4 bg-muted rounded-lg text-left">
                <h3 className="font-mono text-sm font-semibold mb-2">Error:</h3>
                <pre className="text-xs text-destructive mb-4 whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
                
                {this.state.errorInfo && (
                  <>
                    <h3 className="font-mono text-sm font-semibold mb-2">Component Stack:</h3>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}