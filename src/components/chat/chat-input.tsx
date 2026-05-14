"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ChatInputProps } from "@/types/chat";
import { Send, Loader2 } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

/**
 * ChatInput - Message input area with send button.
 *
 * Features:
 * - Auto-resizing textarea
 * - Enter to send (Shift+Enter for newline)
 * - Escape to clear input
 * - Send button with loading state
 * - Character count indicator
 * - Disabled state while loading
 * - Keyboard shortcut hint
 * - Mobile-responsive layout
 */
export function ChatInput({
  onSend,
  disabled = false,
  maxLength = 10000,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = message.length;
  const isOverLimit = charCount > maxLength;
  const canSend = message.trim().length > 0 && !isOverLimit && !disabled;

  /**
   * Auto-resize textarea to fit content.
   * Resets to single line when empty.
   */
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Set height based on content, with min/max constraints
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 200);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust height when message changes
  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!canSend) return;

      onSend(message.trim());
      setMessage("");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Focus the textarea after sending
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [canSend, message, onSend]
  );

  /**
   * Handle keyboard shortcuts.
   * Enter sends, Shift+Enter adds newline, Escape clears input.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMessage("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    },
    [handleSubmit]
  );

  /**
   * Handle textarea value change.
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setMessage(e.target.value);
    },
    []
  );

  return (
    <div
      data-slot="chat-input"
      className={cn(
        "border-t border-border bg-background",
        "px-3 py-3 sm:px-4"
      )}
      role="form"
      aria-label="Message input form"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {/* Textarea container */}
        <div
          className={cn(
            "flex items-end gap-2 rounded-lg border bg-background px-3 py-2",
            "transition-colors",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50",
            isOverLimit && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
            disabled && "opacity-50"
          )}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength + 100} // Allow slight over-limit for feedback
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none",
              "min-h-[24px] max-h-[200px]",
              "leading-relaxed"
            )}
            aria-label="Message input"
          />

          {/* Send button */}
          <Button
            type="submit"
            size="icon-sm"
            disabled={!canSend}
            className={cn(
              "shrink-0 transition-all",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>

        {/* Footer: character count and hints */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground hidden sm:block">
            <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">
              Enter
            </kbd>{" "}
            to send,{" "}
            <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">
              Shift+Enter
            </kbd>{" "}
            for new line,{" "}
            <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">
              Esc
            </kbd>{" "}
            to clear
          </p>
          <p className="text-xs text-muted-foreground sm:hidden">
            <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">
              Enter
            </kbd>{" "}
            to send
          </p>

          <p
            className={cn(
              "text-xs tabular-nums",
              isOverLimit
                ? "text-destructive font-medium"
                : charCount > maxLength * 0.9
                  ? "text-muted-foreground"
                  : "text-muted-foreground/60"
            )}
          >
            {charCount.toLocaleString()} / {maxLength.toLocaleString()}
          </p>
        </div>
      </form>
    </div>
  );
}
