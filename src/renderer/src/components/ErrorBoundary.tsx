import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

interface ErrorBoundaryProps {
  children?: ReactNode
  /** When this changes (the page moved on), a failure is cleared. It never remounts a page that is working. */
  resetKey?: string
}

interface ErrorBoundaryState {
  failed: boolean
}

/**
 * A page that crashes while it draws shows a short message instead of a blank window, and the rest of the app (the top
 * bar, search, other pages) keeps working. Give it a `resetKey` that changes with the page so going elsewhere clears it.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false })
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('A page failed to draw:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <EmptyState
        heading="Something went wrong"
        message="This page could not be shown. Your notes are safe."
      >
        <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
      </EmptyState>
    )
  }
}
