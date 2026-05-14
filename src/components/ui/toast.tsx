"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

/** Toast notification type */
export type ToastType = "success" | "error" | "info";

/** Individual toast notification */
export interface Toast {
  /** Unique identifier */
  id: string;
  /** Visual style variant */
  type: ToastType;
  /** Message to display */
  message: string;
  /** Auto-dismiss duration in ms (default: 5000) */
  duration?: number;
}

/** Context value for the toast system */
export interface ToastContextType {
  /** Currently visible toasts */
  toasts: Toast[];
  /** Add a new toast notification */
  addToast: (toast: Omit<Toast, "id">) => void;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextType | null>(null);

// ============================================================================
// Toast Item Component
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

/**
 * Individual toast notification with auto-dismiss and close button.
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      data-slot="toast"
      role="alert"
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg",
        "animate-in slide-in-from-right fade-in duration-300",
        toast.type === "error" &&
          "bg-destructive text-destructive-foreground",
        toast.type === "success" && "bg-green-500 text-white",
        toast.type === "info" && "bg-primary text-primary-foreground"
      )}
    >
      <p className="text-sm">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 rounded-full p-1 hover:bg-white/20"
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ============================================================================
// Toast Provider
// ============================================================================

/**
 * ToastProvider - Provides toast notification context and renders toast container.
 *
 * Must wrap components that use the `useToast` hook.
 * Renders toast notifications in a fixed position at the bottom-right of the viewport.
 *
 * Usage:
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        data-slot="toast-container"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useToast - Hook to access the toast notification system.
 *
 * Must be used within a `ToastProvider`.
 *
 * Returns:
 * - `toasts`: Array of current toast notifications
 * - `addToast`: Function to show a new toast
 * - `removeToast`: Function to dismiss a toast
 *
 * Usage:
 * ```tsx
 * const { addToast } = useToast();
 * addToast({ type: "success", message: "Saved!" });
 * addToast({ type: "error", message: "Failed to save", duration: 10000 });
 * ```
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
