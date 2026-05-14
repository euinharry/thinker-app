// @vitest-environment jsdom

/**
 * Toast Component Tests
 *
 * Tests for ToastProvider, useToast hook, and toast notifications:
 * rendering, auto-dismiss, manual dismiss, different types, and context.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { ToastProvider, useToast } from "@/components/ui/toast";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper component that uses the useToast hook and exposes its API
 * via button clicks for testing.
 */
function ToastConsumer() {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <div>
      <span data-testid="toast-count">{toasts.length}</span>
      <button
        onClick={() =>
          addToast({ type: "success", message: "Success message" })
        }
      >
        Add success
      </button>
      <button
        onClick={() =>
          addToast({ type: "error", message: "Error message" })
        }
      >
        Add error
      </button>
      <button
        onClick={() =>
          addToast({ type: "info", message: "Info message" })
        }
      >
        Add info
      </button>
      <button
        onClick={() =>
          addToast({
            type: "success",
            message: "Custom duration",
            duration: 10000,
          })
        }
      >
        Add custom duration
      </button>
      {toasts.length > 0 && (
        <button onClick={() => removeToast(toasts[0].id)}>
          Remove first
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Toast Tests
// ============================================================================

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // ToastProvider rendering
  // --------------------------------------------------------------------------

  describe("ToastProvider rendering", () => {
    it("renders children", () => {
      render(
        <ToastProvider>
          <div>Child content</div>
        </ToastProvider>
      );

      expect(screen.getByText("Child content")).toBeDefined();
    });

    it("renders toast container", () => {
      const { container } = render(
        <ToastProvider>
          <div>Child</div>
        </ToastProvider>
      );

      const toastContainer = container.querySelector(
        '[data-slot="toast-container"]'
      );
      expect(toastContainer).toBeDefined();
    });

    it("has aria-label on toast container", () => {
      const { container } = render(
        <ToastProvider>
          <div>Child</div>
        </ToastProvider>
      );

      const toastContainer = container.querySelector(
        '[aria-label="Notifications"]'
      );
      expect(toastContainer).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // useToast hook
  // --------------------------------------------------------------------------

  describe("useToast hook", () => {
    it("throws error when used outside ToastProvider", () => {
      // Suppress console.error for expected error
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        render(<ToastConsumer />);
      }).toThrow("useToast must be used within a ToastProvider");

      consoleSpy.mockRestore();
    });

    it("provides toasts, addToast, and removeToast", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      expect(screen.getByTestId("toast-count").textContent).toBe("0");
      expect(screen.getByText("Add success")).toBeDefined();
      expect(screen.getByText("Add error")).toBeDefined();
      expect(screen.getByText("Add info")).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Adding toasts
  // --------------------------------------------------------------------------

  describe("adding toasts", () => {
    it("adds a toast when addToast is called", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));

      expect(screen.getByTestId("toast-count").textContent).toBe("1");
      expect(screen.getByText("Success message")).toBeDefined();
    });

    it("adds multiple toasts", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));
      fireEvent.click(screen.getByText("Add error"));
      fireEvent.click(screen.getByText("Add info"));

      expect(screen.getByTestId("toast-count").textContent).toBe("3");
      expect(screen.getByText("Success message")).toBeDefined();
      expect(screen.getByText("Error message")).toBeDefined();
      expect(screen.getByText("Info message")).toBeDefined();
    });

    it("renders toast with role=alert for accessibility", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));

      const toast = screen.getByRole("alert");
      expect(toast).toBeDefined();
      expect(toast.textContent).toContain("Success message");
    });

    it("has data-slot attribute on toast items", () => {
      const { container } = render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));

      const toast = container.querySelector('[data-slot="toast"]');
      expect(toast).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Toast types
  // --------------------------------------------------------------------------

  describe("toast types", () => {
    it("applies destructive style for error toasts", () => {
      const { container } = render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add error"));

      const toast = container.querySelector('[data-slot="toast"]') as HTMLElement;
      expect(toast.className).toContain("bg-destructive");
    });

    it("applies green style for success toasts", () => {
      const { container } = render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));

      const toast = container.querySelector('[data-slot="toast"]') as HTMLElement;
      expect(toast.className).toContain("bg-green-500");
    });

    it("applies primary style for info toasts", () => {
      const { container } = render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add info"));

      const toast = container.querySelector('[data-slot="toast"]') as HTMLElement;
      expect(toast.className).toContain("bg-primary");
    });
  });

  // --------------------------------------------------------------------------
  // Manual dismiss
  // --------------------------------------------------------------------------

  describe("manual dismiss", () => {
    it("removes toast when close button is clicked", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));
      expect(screen.getByTestId("toast-count").textContent).toBe("1");

      fireEvent.click(screen.getByLabelText("Dismiss notification"));
      expect(screen.getByTestId("toast-count").textContent).toBe("0");
    });

    it("removes the correct toast when multiple exist", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));
      fireEvent.click(screen.getByText("Add error"));

      expect(screen.getByTestId("toast-count").textContent).toBe("2");

      // Remove first toast
      fireEvent.click(screen.getByText("Remove first"));
      expect(screen.getByTestId("toast-count").textContent).toBe("1");
    });

    it("close button has aria-label for accessibility", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));

      const closeButton = screen.getByLabelText("Dismiss notification");
      expect(closeButton).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Auto-dismiss
  // --------------------------------------------------------------------------

  describe("auto-dismiss", () => {
    it("auto-dismisses toast after default duration (5000ms)", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));
      expect(screen.getByTestId("toast-count").textContent).toBe("1");

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByTestId("toast-count").textContent).toBe("0");
    });

    it("auto-dismisses toast after custom duration", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add custom duration"));
      expect(screen.getByTestId("toast-count").textContent).toBe("1");

      // Not dismissed at default time
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("toast-count").textContent).toBe("1");

      // Dismissed at custom time
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("toast-count").textContent).toBe("0");
    });

    it("does not dismiss before timeout", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));

      act(() => {
        vi.advanceTimersByTime(4999);
      });

      expect(screen.getByTestId("toast-count").textContent).toBe("1");
    });

    it("handles multiple toasts with independent timers", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));
      fireEvent.click(screen.getByText("Add custom duration"));

      expect(screen.getByTestId("toast-count").textContent).toBe("2");

      // After 5s, first toast dismissed, second still visible
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("toast-count").textContent).toBe("1");
      expect(screen.getByText("Custom duration")).toBeDefined();

      // After 10s total, second toast dismissed
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByTestId("toast-count").textContent).toBe("0");
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles adding and immediately removing a toast", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));
      fireEvent.click(screen.getByLabelText("Dismiss notification"));

      expect(screen.getByTestId("toast-count").textContent).toBe("0");
    });

    it("handles rapid toast additions", () => {
      render(
        <ToastProvider>
          <ToastConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add success"));
      fireEvent.click(screen.getByText("Add error"));
      fireEvent.click(screen.getByText("Add info"));
      fireEvent.click(screen.getByText("Add success"));

      expect(screen.getByTestId("toast-count").textContent).toBe("4");
    });

    it("toast messages handle special characters", () => {
      function SpecialCharConsumer() {
        const { addToast } = useToast();
        return (
          <button
            onClick={() =>
              addToast({
                type: "error",
                message: "Error with <html> & special 'chars'",
              })
            }
          >
            Add special
          </button>
        );
      }

      render(
        <ToastProvider>
          <SpecialCharConsumer />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Add special"));

      expect(
        screen.getByText("Error with <html> & special 'chars'")
      ).toBeDefined();
    });
  });
});
