"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Thinking } from "@/components/chat/thinking";
import type { MessageItemProps } from "@/types/chat";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Format a timestamp for display in the chat.
 * Shows time for today, date+time for older messages.
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return timeStr;
  }

  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return `${dateStr} ${timeStr}`;
}

/**
 * MessageItem - Displays a single chat message with agent styling.
 *
 * User messages are right-aligned with primary background.
 * Agent messages are left-aligned with card background, showing
 * the agent's avatar and name.
 *
 * Supports markdown rendering for agent messages including:
 * - Headers, bold, italic
 * - Lists (ordered and unordered)
 * - Code blocks (inline and fenced)
 * - Links and blockquotes
 * - Tables (via remark-gfm)
 */
export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming ?? false;
  const isSupplement = message.isSupplement ?? false;

  const formattedTime = useMemo(
    () => formatTimestamp(message.createdAt),
    [message.createdAt]
  );

  return (
    <div
      data-slot="message-item"
      role="article"
      aria-label={
        isUser
          ? "Your message"
          : isSupplement
            ? `Supplement from ${message.agentName ?? "Agent"}`
            : `Message from ${message.agentName ?? "Agent"}`
      }
      className={cn(
        "group flex gap-3 px-3 py-3 transition-colors sm:px-4",
        "hover:bg-muted/30",
        isUser ? "flex-row-reverse" : "flex-row",
        // Animate entry
        isUser ? "animate-slide-in-right" : "animate-fade-in"
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <Avatar
          size="default"
          className={cn(
            "mt-0.5 shrink-0",
            isSupplement && "opacity-70"
          )}
          data-agent={message.agentType}
        >
          <AvatarFallback
            className={cn(
              "text-base",
              isSupplement
                ? "bg-accent text-accent-foreground"
                : "bg-primary/10"
            )}
          >
            {message.agentAvatar ?? "🤖"}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[80%] lg:max-w-[70%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Agent name and timestamp header */}
        {!isUser && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {message.agentName ?? "Agent"}
            </span>
            {isSupplement && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                  "bg-accent text-[10px] font-medium text-accent-foreground",
                  "border border-border/50"
                )}
              >
                <span className="size-1 rounded-full bg-muted-foreground/50" />
                Supplement
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formattedTime}
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-lg px-3 py-2.5 text-sm leading-relaxed sm:px-3.5",
            "transition-shadow duration-200",
            isUser
              ? "bg-primary text-primary-foreground"
              : cn(
                  "bg-card text-card-foreground border shadow-xs hover:shadow-sm",
                  isSupplement
                    ? "border-l-2 border-l-accent-foreground/20 border-t border-r border-b border-border"
                    : "border border-border"
                ),
            isStreaming && "animate-pulse"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
          ) : (
            <div
              className={cn(
                "prose prose-sm dark:prose-invert max-w-none",
                // Headings
                "prose-headings:font-semibold prose-headings:text-foreground",
                "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm",
                "prose-headings:mt-3 prose-headings:mb-1.5 first:prose-headings:mt-0",
                // Paragraphs
                "prose-p:my-1.5 prose-p:leading-relaxed",
                // Lists
                "prose-ul:my-1.5 prose-ol:my-1.5",
                "prose-li:my-0.5",
                // Code
                "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono",
                "prose-pre:rounded-lg prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border",
                "prose-pre:p-3 prose-pre:my-2",
                // Links
                "prose-a:text-primary prose-a:underline prose-a:underline-offset-2",
                "prose-a:decoration-primary/40 hover:prose-a:decoration-primary",
                // Blockquotes
                "prose-blockquote:border-l-primary/40 prose-blockquote:pl-3 prose-blockquote:italic",
                // Tables (GFM)
                "prose-table:text-sm",
                "prose-th:px-2 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold",
                "prose-td:px-2 prose-td:py-1.5",
                // Horizontal rules
                "prose-hr:my-3 prose-hr:border-border",
                // Strong/bold
                "prose-strong:font-semibold prose-strong:text-foreground"
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* User timestamp (below bubble) */}
        {isUser && (
          <span className="text-xs text-muted-foreground">{formattedTime}</span>
        )}

        {/* Thinking section (agent messages only) */}
        {!isUser && message.thinking && (
          <Thinking content={message.thinking} />
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
            <span>{isSupplement ? "supplementing..." : "typing..."}</span>
          </div>
        )}
      </div>
    </div>
  );
}
