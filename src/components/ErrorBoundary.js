'use client'

import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('OS Error Boundary caught an exception:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-bg-primary flex flex-col justify-center items-center p-6 z-[9999] font-mono text-primary">
          <div className="max-w-2xl w-full border-l-4 border-danger bg-bg-secondary p-8 shadow-2xl">
            <h1 className="text-3xl font-display text-danger mb-4 tracking-tighter uppercase flex items-center gap-3">
              <div className="w-4 h-4 bg-danger animate-pulse" />
              SYSTEM MALFUNCTION
            </h1>
            <p className="text-secondary mb-6 leading-relaxed">
              A critical exception occurred within the operating system runtime. The process has been halted to prevent data corruption.
            </p>
            <div className="bg-bg-tertiary p-4 rounded border border-border-color mb-8 overflow-auto max-h-48 text-xs text-danger font-mono whitespace-pre-wrap">
              {this.state.error?.toString() || 'Unknown runtime error.'}
            </div>
            <div className="flex gap-4">
              <button 
                className="btn btn-primary bg-danger border-danger hover:bg-danger-hover"
                onClick={() => window.location.href = '/'}
              >
                REBOOT OS
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                IGNORE EXCEPTION
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
