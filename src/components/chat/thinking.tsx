"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for the Thinking component.
 */
interface ThinkingProps {
  /** The thinking/reasoning content to display */
  content: string;
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * Thinking - Collapsible section displaying agent reasoning.
 *
 * Renders a toggle button that expands/collapses the thinking content.
 * Styled differently from the main message (muted background, smaller
 * monospace text) to visually distinguish reasoning from output.
 *
 * Returns null when content is empty or whitespace-only.
 *
 * Accessibility:
 * - Uses aria-expanded on the toggle button
 * - Uses aria-label describing the action
 * - Supports keyboard activation via native button semantics
 */
export function Thinking({ content, className }: ThinkingProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Hide when no meaningful content
  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className={cn("mt-2", className)} data-slot="thinking">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground",
          "hover:text-foreground transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "rounded-sm px-0.5"
        )}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse thinking process" : "Expand thinking process"}
      >
        {isExpanded ? (
          <ChevronDown className="size-3" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3" aria-hidden="true" />
        )}
        <span>Thinking process</span>
      </button>

      {/* Collapsible thinking content */}
      {isExpanded && (
        <div
          className={cn(
            "mt-1 rounded-md bg-muted/50 p-3",
            "text-xs text-muted-foreground font-mono",
            "whitespace-pre-wrap break-words",
            "border border-border",
            "animate-fade-in"
          )}
          role="region"
          aria-label="Thinking process content"
        >
          {content}
        </div>
      )}
    </div>
  );
}
