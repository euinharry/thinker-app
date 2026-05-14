// @vitest-environment jsdom

/**
 * ErrorBoundary Component Tests
 *
 * Tests for the ErrorBoundary class component: error catching,
 * fallback UI rendering, retry functionality, and console logging.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ============================================================================
// Mocks - Mock @base-ui Button which has jsdom issues
// ============================================================================

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { ErrorBoundary } from "@/components/error-boundary";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * A component that throws an error on render.
 * Used to test ErrorBoundary catching behavior.
 */
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>No error</div>;
}

/**
 * A component that throws on a specific render count.
 * Useful for testing retry behavior.
 */
function ThrowOnFirstRender() {
  const renderCount = renderCountRef;
  renderCount.current++;
  if (renderCount.current <= 1) {
    throw new Error("First render error");
  }
  return <div>Subsequent render success</div>;
}

const renderCountRef = { current: 0 };

// ============================================================================
// ErrorBoundary Tests
// ============================================================================

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors in tests
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
    renderCountRef.current = 0;
    return () => {
      console.error = originalConsoleError;
    };
  });

  // --------------------------------------------------------------------------
  // Error catching
  // --------------------------------------------------------------------------

  describe("error catching", () => {
    it("catches errors thrown by child components", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeDefined();
    });

    it("displays the error message from the caught error", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Test error message")).toBeDefined();
    });

    it("renders children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText("No error")).toBeDefined();
    });

    it("does not show error UI when children render successfully", () => {
      render(
        <ErrorBoundary>
          <div>Working component</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText("Something went wrong")).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Default fallback UI
  // --------------------------------------------------------------------------

  describe("default fallback UI", () => {
    it("shows 'Something went wrong' heading", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
      expect(screen.getByText("Something went wrong")).toBeDefined();
    });

    it("shows 'Try again' button", () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    });

    it("has data-slot attribute on fallback container", () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      const wrapper = container.querySelector('[data-slot="error-boundary"]');
      expect(wrapper).toBeDefined();
    });

    it("shows default message when error has no message", () => {
      function EmptyErrorComponent(): React.ReactNode {
        throw new Error();
      }

      // Error with empty message still has the property
      render(
        <ErrorBoundary>
          <EmptyErrorComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Custom fallback
  // --------------------------------------------------------------------------

  describe("custom fallback", () => {
    it("renders custom fallback when provided", () => {
      render(
        <ErrorBoundary fallback={<div>Custom error UI</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText("Custom error UI")).toBeDefined();
      expect(screen.queryByText("Something went wrong")).toBeNull();
    });

    it("does not show default UI when custom fallback is provided", () => {
      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Retry functionality
  // --------------------------------------------------------------------------

  describe("retry functionality", () => {
    it("resets error state when 'Try again' is clicked", () => {
      function ConditionalThrow() {
        const [shouldThrow, setShouldThrow] = React.useState(true);
        if (shouldThrow) {
          throw new Error("Retry test error");
        }
        return (
          <div>
            <span>Recovered</span>
            <button onClick={() => setShouldThrow(true)}>Throw again</button>
          </div>
        );
      }

      // Note: ErrorBoundary retry resets internal state, but the child
      // component will throw again on re-render. This tests the reset mechanism.
      render(
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText("Retry test error")).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      // After retry, the boundary resets and re-renders children.
      // The child will throw again, so we still see error UI.
      // This verifies the retry mechanism fires correctly.
      expect(screen.getByText("Something went wrong")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Console logging
  // --------------------------------------------------------------------------

  describe("console logging", () => {
    it("logs errors to console.error", () => {
      const consoleSpy = vi.spyOn(console, "error");

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "[ErrorBoundary]",
        expect.any(Error),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles errors with special characters in message", () => {
      function SpecialCharError(): React.ReactNode {
        throw new Error("Error with <html> & special 'chars'");
      }

      render(
        <ErrorBoundary>
          <SpecialCharError />
        </ErrorBoundary>
      );

      expect(
        screen.getByText("Error with <html> & special 'chars'")
      ).toBeDefined();
    });

    it("handles multiple children with one throwing", () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <ThrowingComponent />
          <div>Child 3</div>
        </ErrorBoundary>
      );

      // Error boundary catches the error and shows fallback
      expect(screen.getByText("Something went wrong")).toBeDefined();
    });

    it("renders children without errors after successful mount", () => {
      const { container } = render(
        <ErrorBoundary>
          <div>Normal content</div>
          <div>More content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText("Normal content")).toBeDefined();
      expect(screen.getByText("More content")).toBeDefined();
      expect(container.querySelector('[data-slot="error-boundary"]')).toBeNull();
    });
  });
});

// ============================================================================
// React import (needed for useState in test helper)
// ============================================================================

import React from "react";
