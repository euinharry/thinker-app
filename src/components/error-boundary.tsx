"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Props for the ErrorBoundary component.
 */
interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional custom fallback UI to render when an error occurs */
  fallback?: ReactNode;
}

/**
 * State for the ErrorBoundary component.
 */
interface ErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The caught error, if any */
  error?: Error;
}

/**
 * ErrorBoundary - Catches React rendering errors and displays a fallback UI.
 *
 * Uses React's class component error boundary lifecycle methods:
 * - getDerivedStateFromError: Updates state when an error is thrown
 * - componentDidCatch: Logs error details to console
 *
 * Features:
 * - Default fallback UI with error message and retry button
 * - Custom fallback support via `fallback` prop
 * - Retry functionality to reset error state
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          data-slot="error-boundary"
          className="flex flex-col items-center justify-center gap-4 p-8"
        >
          <div className="text-center">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <Button onClick={this.handleRetry} variant="outline">
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
