"use client";

import { cn } from "@/lib/utils";
import { MessageItem } from "@/components/chat/message-item";
import type { MessageListProps } from "@/types/chat";
import { useEffect, useRef, useCallback } from "react";
import { MessageSquare, Loader2 } from "lucide-react";

/**
 * MessageList - Displays a scrollable list of chat messages.
 *
 * Features:
 * - Auto-scrolls to bottom when new messages arrive
 * - Loading skeleton for initial message load
 * - Empty state with call-to-action when no messages
 * - Streaming indicator when a response is being generated
 */
export function MessageList({
  messages,
  isLoading = false,
  isGenerating = false,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  /**
   * Scroll to the bottom of the message list.
   * Uses smooth scrolling for better UX.
   */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  /**
   * Track whether the user is near the bottom of the list.
   * Only auto-scroll if they're already near the bottom.
   */
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Consider "near bottom" if within 150px of the bottom
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 150;
  }, []);

  // Auto-scroll when messages change (only if near bottom)
  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages.length, scrollToBottom]);

  // Auto-scroll when streaming content changes
  useEffect(() => {
    if (isGenerating && isNearBottomRef.current) {
      const interval = setInterval(() => {
        if (isNearBottomRef.current) {
          scrollToBottom();
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isGenerating, scrollToBottom]);

  // Initial load state
  if (isLoading) {
    return (
      <div
        data-slot="message-list"
        role="status"
        aria-label="Loading messages"
        className="flex flex-1 items-center justify-center p-4 sm:p-8"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        data-slot="message-list"
        role="status"
        aria-label="No messages"
        className="flex flex-1 items-center justify-center p-4 sm:p-8"
      >
        <div className="flex flex-col items-center gap-4 text-center animate-fade-in">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium text-foreground">
              No messages yet
            </h3>
            <p className="max-w-sm text-xs text-muted-foreground">
              Start a conversation by typing a message below. The agents will
              respond with their unique perspectives.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="message-list"
      ref={scrollRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      className={cn(
        "flex-1 overflow-y-auto",
        // Smooth scrolling on mobile
        "scroll-smooth",
        // Custom scrollbar styling
        "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
      )}
    >
      <div className="flex flex-col gap-0.5 py-2">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* Streaming indicator */}
        {isGenerating && (
          <div
            className="flex items-center gap-2 px-3 py-3 sm:px-4 animate-fade-in"
            role="status"
            aria-label="Agent is responding"
          >
            <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
