"use client"

import React from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)
    // Log to console (replace with real logging service in production)
    console.error("[ErrorBoundary] Caught error:", error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Something went wrong</h2>
          <p className="text-slate-400 text-sm max-w-md mb-2">
            An unexpected error occurred while rendering this section.
          </p>
          {this.state.error && (
            <details className="mb-6 max-w-lg w-full text-left">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 mb-2">
                Show error details
              </summary>
              <pre className="text-xs bg-slate-800/80 border border-slate-700 rounded-lg p-3 overflow-x-auto text-red-400 font-mono whitespace-pre-wrap">
                {this.state.error.message}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Retry loading this section"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try Again
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium transition-all border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Go to dashboard"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              Dashboard
            </a>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/** Lightweight functional wrapper for use in page files */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  const Wrapped = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return Wrapped
}
