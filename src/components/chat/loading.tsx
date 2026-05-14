"use client";

import { cn } from "@/lib/utils";

/**
 * LoadingSpinner - A simple animated spinning indicator.
 *
 * Uses Tailwind's animate-spin utility for smooth rotation.
 * Can be sized via className prop.
 *
 * Usage:
 * ```tsx
 * <LoadingSpinner />
 * <LoadingSpinner className="size-8" />
 * ```
 */
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      data-slot="loading-spinner"
      className={cn("flex items-center justify-center", className)}
    >
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/**
 * AgentTypingIndicator - Shows a typing/thinking animation for an agent.
 *
 * Displays three pulsing dots followed by "{agentName} is thinking..." text.
 * Used when an agent is processing a response.
 *
 * Usage:
 * ```tsx
 * <AgentTypingIndicator agentName="Leader" />
 * ```
 */
export function AgentTypingIndicator({
  agentName,
}: {
  agentName: string;
}) {
  return (
    <div
      data-slot="agent-typing-indicator"
      className="flex items-center gap-2 px-3 py-3 sm:px-4 animate-fade-in"
      role="status"
      aria-label={`${agentName} is typing`}
    >
      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground">
        {agentName} is thinking...
      </span>
    </div>
  );
}

/**
 * MessageSkeleton - Placeholder skeleton for loading message list.
 *
 * Renders three placeholder message rows with pulsing animation.
 * Used during initial message load to indicate content is coming.
 *
 * Usage:
 * ```tsx
 * <MessageSkeleton />
 * ```
 */
export function MessageSkeleton() {
  return (
    <div data-slot="message-skeleton" className="flex flex-col gap-2 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="size-8 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
