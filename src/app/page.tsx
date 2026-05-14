"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { useToast } from "@/components/ui/toast";
import type { ChatMessage } from "@/types/chat";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/** Agent metadata from API response */
interface AgentInfo {
  id: AgentType;
  name: string;
  avatar: string;
}

/** SSE event: agent started responding */
interface SSEAgentStartEvent {
  type: "agent_start";
  agent: AgentInfo;
}

/** SSE event: agent response complete */
interface SSEAgentResponseEvent {
  type: "agent_response";
  agent: AgentInfo;
  response: string;
  success: boolean;
  error?: string;
}

/** SSE event: primary agent started streaming (orchestrator mode) */
interface SSEPrimaryStartEvent {
  type: "primary_start";
  agent: AgentInfo;
}

/** SSE event: incremental chunk from primary agent (orchestrator mode) */
interface SSEPrimaryChunkEvent {
  type: "primary_chunk";
  delta: string;
}

/** SSE event: primary agent finished streaming (orchestrator mode) */
interface SSEPrimaryEndEvent {
  type: "primary_end";
  fullResponse: string;
}

/** SSE event: supplement agent started (orchestrator mode) */
interface SSESupplementStartEvent {
  type: "supplement_start";
  agent: AgentInfo;
}

/** SSE event: supplement agent response (orchestrator mode) */
interface SSESupplementResponseEvent {
  type: "supplement_response";
  agent: AgentInfo;
  response: string;
}

/** SSE event: supplement agent finished (orchestrator mode) */
interface SSESupplementEndEvent {
  type: "supplement_end";
  agent: AgentInfo;
}

/** SSE event: orchestration complete (orchestrator mode) */
interface SSEDoneEvent {
  type: "done";
}

/** Union of all SSE event types we handle */
type SSEEvent =
  | SSEAgentStartEvent
  | SSEAgentResponseEvent
  | SSEPrimaryStartEvent
  | SSEPrimaryChunkEvent
  | SSEPrimaryEndEvent
  | SSESupplementStartEvent
  | SSESupplementResponseEvent
  | SSESupplementEndEvent
  | SSEDoneEvent;

// ============================================================================
// Helpers
// ============================================================================

/** Generate a unique ID for messages */
function generateId(): string {
  return crypto.randomUUID();
}

/** Create a user ChatMessage */
function createUserMessage(content: string): ChatMessage {
  return {
    id: generateId(),
    role: "user",
    content,
    agentType: null,
    agentName: null,
    agentAvatar: null,
    createdAt: new Date(),
  };
}

/** Create an agent ChatMessage from API response data */
function createAgentMessage(
  content: string,
  agent: AgentInfo,
  isStreaming = false,
  isSupplement = false
): ChatMessage {
  return {
    id: generateId(),
    role: "agent",
    content,
    agentType: agent.id,
    agentName: agent.name,
    agentAvatar: agent.avatar,
    createdAt: new Date(),
    isStreaming,
    isSupplement,
  };
}

// ============================================================================
// Component
// ============================================================================

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { addToast } = useToast();

  /** AbortController ref for cleaning up in-flight SSE streams on unmount */
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up any in-flight stream when the component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Send a message to the API and process agent responses via SSE streaming.
   *
   * Supports two modes:
   * - Legacy (single-agent via `agent` param): `agent_start` + `agent_response`
   * - Orchestrator (multi-agent, default): `primary_start`, `primary_chunk`,
   *   `primary_end`, `supplement_start`, `supplement_response`,
   *   `supplement_end`, `done`
   *
   * Flow:
   * 1. Add user message to the list
   * 2. Show generating state
   * 3. GET /api/chat/stream?message=... (SSE)
   * 4. Parse SSE events incrementally
   * 5. Handle errors with toast notifications
   */
  const handleSend = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage = createUserMessage(content);
      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(
          `/api/chat/stream?message=${encodeURIComponent(content)}`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          // Try to parse error body, fall back to status text
          const errorBody = await response.json().catch(() => null);
          throw new Error(
            errorBody?.error ??
              `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let primaryMessageId: string | null = null;
        let primaryAgentId: AgentType | null = null;
        let primaryMessageContent = "";
        let isFirstAgent = true;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const parts = buffer.split("\n\n");
          buffer = parts.pop()!; // Keep incomplete tail in buffer

          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);

            // Stream termination signal
            if (data === "[DONE]") {
              // Finalize primary if still streaming
              if (primaryMessageId) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === primaryMessageId
                      ? { ...msg, isStreaming: false }
                      : msg
                  )
                );
              }
              continue;
            }

            let event: SSEEvent;
            try {
              event = JSON.parse(data) as SSEEvent;
            } catch {
              // Malformed JSON — skip this event
              continue;
            }

            // Handle error events from the SSE stream
            if ("error" in event && typeof event.error === "string") {
              throw new Error(event.error);
            }

            if (event.type === "agent_start" && isFirstAgent) {
              // Legacy: Primary agent starts — create a streaming placeholder message
              const primaryMsg = createAgentMessage("", event.agent, true);
              primaryMessageId = primaryMsg.id;
              primaryAgentId = event.agent.id;
              primaryMessageContent = "";
              setMessages((prev) => [...prev, primaryMsg]);
              isFirstAgent = false;
            } else if (event.type === "agent_response") {
              // Legacy: Full response event (single-agent mode)
              const responseContent =
                event.success && event.response
                  ? event.response
                  : `*Error: ${event.error ?? "Agent failed to respond"}*`;

              if (
                primaryMessageId &&
                primaryAgentId &&
                event.agent.id === primaryAgentId
              ) {
                // Primary agent response — update the streaming message
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === primaryMessageId
                      ? { ...msg, content: responseContent, isStreaming: false }
                      : msg
                  )
                );
              } else {
                // Supplement agent — add as independent message
                setMessages((prev) => [
                  ...prev,
                  createAgentMessage(responseContent, event.agent),
                ]);
              }
            } else if (event.type === "primary_start") {
              // Orchestrator: Primary agent starts streaming
              const primaryMsg = createAgentMessage("", event.agent, true);
              primaryMessageId = primaryMsg.id;
              primaryAgentId = event.agent.id;
              primaryMessageContent = "";
              setMessages((prev) => [...prev, primaryMsg]);
              isFirstAgent = false;
            } else if (event.type === "primary_chunk") {
              // Orchestrator: Incremental chunk — append to primary message
              primaryMessageContent += event.delta;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === primaryMessageId
                    ? { ...msg, content: primaryMessageContent }
                    : msg
                )
              );
            } else if (event.type === "primary_end") {
              // Orchestrator: Primary finished — use full response and stop streaming
              primaryMessageContent = event.fullResponse;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === primaryMessageId
                    ? {
                        ...msg,
                        content: event.fullResponse,
                        isStreaming: false,
                      }
                    : msg
                )
              );
            } else if (event.type === "supplement_start") {
              // Orchestrator: Supplement agent starts — create placeholder
              setMessages((prev) => [
                ...prev,
                createAgentMessage("", event.agent, true, true),
              ]);
            } else if (event.type === "supplement_response") {
              // Orchestrator: Supplement response — find and update the message
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.role === "agent" &&
                  msg.agentType === event.agent.id &&
                  msg.isStreaming
                    ? { ...msg, content: event.response }
                    : msg
                )
              );
            } else if (event.type === "supplement_end") {
              // Orchestrator: Supplement finished — stop streaming indicator
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.role === "agent" &&
                  msg.agentType === event.agent.id &&
                  msg.isStreaming
                    ? { ...msg, isStreaming: false }
                    : msg
                )
              );
            } else if (event.type === "done") {
              // Orchestrator: All done — finalize any remaining streaming messages
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.isStreaming ? { ...msg, isStreaming: false } : msg
                )
              );
            }
          }
        }
      } catch (error) {
        // Swallow abort errors (user navigated away or component unmounted)
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Something went wrong";

        addToast({
          type: "error",
          message: errorMessage,
          duration: 8000,
        });
      } finally {
        abortControllerRef.current = null;
        setIsGenerating(false);
      }
    },
    [addToast]
  );

  return (
    <div className="flex h-full flex-col">
      {messages.length === 0 ? (
        /* Welcome screen — shown when no messages */
        <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-2xl text-center animate-fade-in">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome to Thinker
            </h2>
            <p className="mt-3 text-base text-muted-foreground sm:mt-4 sm:text-lg">
              A collaborative AI discussion platform where multiple agents work
              together to explore ideas, plan tasks, and challenge assumptions.
            </p>
            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-4">
                <span className="text-xl sm:text-2xl">👑</span>
                <h3 className="mt-1.5 font-semibold sm:mt-2">Leader</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Strategic visionary who sees the big picture
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-4">
                <span className="text-xl sm:text-2xl">🔍</span>
                <h3 className="mt-1.5 font-semibold sm:mt-2">Explorer</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Tech researcher who gathers information
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-4">
                <span className="text-xl sm:text-2xl">🧠</span>
                <h3 className="mt-1.5 font-semibold sm:mt-2">Thinker</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Task planner who creates structured plans
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:p-4">
                <span className="text-xl sm:text-2xl">🎯</span>
                <h3 className="mt-1.5 font-semibold sm:mt-2">Critic</h3>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Quality challenger who ensures robustness
                </p>
              </div>
            </div>
          </div>

          {/* Input at bottom even on welcome screen */}
          <div className="w-full max-w-3xl mt-6">
            <ChatInput
              onSend={handleSend}
              disabled={isGenerating}
              placeholder="Ask the agents anything..."
            />
          </div>
        </div>
      ) : (
        /* Chat interface — shown when messages exist */
        <>
          <MessageList
            messages={messages}
            isGenerating={isGenerating}
          />
          <div className="mx-auto w-full max-w-3xl">
            <ChatInput
              onSend={handleSend}
              disabled={isGenerating}
              placeholder="Ask the agents anything..."
            />
          </div>
        </>
      )}
    </div>
  );
}
