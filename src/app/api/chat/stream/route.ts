/**
 * Chat Streaming API Route
 *
 * GET /api/chat/stream?message=hello - Stream AI responses via SSE.
 *
 * ## Query Parameters
 *
 * - `message` (required): The user's message to send to the agent
 * - `agent` (optional): Agent type (default: orchestrated multi-agent response).
 *   When omitted, all 4 agents respond in parallel and each response is sent
 *   as a separate SSE event. When specified, only that agent responds.
 *
 * ## Response (Orchestrated - no agent specified)
 *
 * Sends 4 SSE events (one per agent), each containing agent metadata:
 *
 * ```
 * data: {"type":"agent_start","agent":{"id":"leader","name":"Leader","avatar":"👑"}}
 *
 * data: {"type":"agent_response","agent":{"id":"leader","name":"Leader","avatar":"👑"},"response":"Strategic analysis...","success":true}
 *
 * data: {"type":"agent_start","agent":{"id":"explorer","name":"Explorer","avatar":"🔍"}}
 *
 * data: {"type":"agent_response","agent":{"id":"explorer","name":"Explorer","avatar":"🔍"},"response":"Research findings...","success":true}
 *
 * ... (thinker, critic)
 *
 * data: [DONE]
 * ```
 *
 * ## Response (Single agent - agent specified)
 *
 * Returns a streaming SSE response with the agent's response chunks:
 *
 * ```
 * data: {"id":"stream-123","delta":{"content":"Hello"}}
 *
 * data: {"id":"stream-123","delta":{"content":" world"}}
 *
 * data: [DONE]
 * ```
 *
 * ## Error Responses
 *
 * - 400: Missing or invalid message parameter
 * - 502: AI provider error (upstream failure)
 * - 500: Internal server error
 *
 * ## Connection Handling
 *
 * - The stream is automatically closed when the client disconnects
 * - The AbortController signal is used to cancel the upstream AI request
 * - Errors during streaming are sent as SSE error events before closing
 *
 * @module app/api/chat/stream/route
 */

import { NextResponse } from "next/server";
import { LeaderAgent } from "@/lib/agents/leader";
import { ExplorerAgent } from "@/lib/agents/explorer";
import { ThinkerAgent } from "@/lib/agents/thinker";
import { CriticAgent } from "@/lib/agents/critic";
import { StreamingOrchestrator } from "@/lib/agents/streaming-orchestrator";
import type { StreamChunk } from "@/types/ai";

// ============================================================================
// Constants
// ============================================================================

/** SSE Content-Type header value */
const SSE_CONTENT_TYPE = "text/event-stream";

/** SSE Cache-Control header to prevent caching */
const SSE_CACHE_CONTROL = "no-cache, no-transform";

/** SSE Connection header to keep the connection alive */
const SSE_CONNECTION = "keep-alive";

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create an agent instance by type.
 *
 * Supports all four agent types: leader, explorer, thinker, critic.
 *
 * @param agentType - The agent type to create
 * @returns Agent instance
 * @throws {Error} If the agent type is not recognized
 */
function createAgent(agentType: string) {
  switch (agentType) {
    case "leader":
      return new LeaderAgent();
    case "explorer":
      return new ExplorerAgent();
    case "thinker":
      return new ThinkerAgent();
    case "critic":
      return new CriticAgent();
    default:
      throw new Error(`Agent "${agentType}" is not recognized`);
  }
}

// ============================================================================
// SSE Helpers
// ============================================================================

/**
 * Format a StreamChunk as an SSE data line.
 *
 * Converts the chunk to JSON and wraps it in the SSE `data:` format.
 * Each message is terminated with `\n\n` as per the SSE specification.
 *
 * @param chunk - The stream chunk to format
 * @returns Formatted SSE string
 */
function formatSSEChunk(chunk: StreamChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Format an error as an SSE event.
 *
 * Sends the error as a JSON object in the SSE data format so clients
 * can parse and display error messages.
 *
 * @param error - The error message or object
 * @returns Formatted SSE error string
 */
function formatSSEError(error: string): string {
  return `data: ${JSON.stringify({ error })}\n\n`;
}

/**
 * Format an orchestrator event as an SSE data line.
 *
 * @param event - The event object to send
 * @returns Formatted SSE string
 */
function formatSSEEvent(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Create a ReadableStream that converts an async iterable of StreamChunks
 * into SSE-formatted text.
 *
 * This function:
 * 1. Iterates over the stream chunks
 * 2. Formats each chunk as an SSE data line
 * 3. Sends `data: [DONE]` when the stream completes
 * 4. Handles errors by sending an SSE error event
 * 5. Closes the stream when done or on client disconnect
 *
 * @param stream - The async iterable stream from the AI provider
 * @param signal - AbortSignal for client disconnection detection
 * @returns ReadableStream of SSE-formatted text
 */
function createSSEStream(
  stream: AsyncIterable<StreamChunk>,
  signal: AbortSignal
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // Listen for client disconnection
      const onAbort = () => {
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      };
      signal.addEventListener("abort", onAbort, { once: true });

      try {
        for await (const chunk of stream) {
          // Check if client disconnected before sending
          if (signal.aborted) break;

          const sseData = formatSSEChunk(chunk);
          controller.enqueue(encoder.encode(sseData));
        }

        // Send the termination signal if client is still connected
        if (!signal.aborted) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
      } catch (error) {
        // Send error as SSE event before closing
        if (!signal.aborted) {
          const errorMessage =
            error instanceof Error ? error.message : "Stream error";
          controller.enqueue(encoder.encode(formatSSEError(errorMessage)));
        }
      } finally {
        signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      }
    },
  });
}

/**
 * Create a ReadableStream that sends orchestrated agent responses via SSE.
 *
 * Uses StreamingOrchestrator to coordinate agents with real-time streaming.
 * The primary agent streams its response in real-time, then supplement agents
 * are executed based on domain coverage. Each OrchestrationEvent is yielded
 * as an SSE data line.
 *
 * @param message - The user's message
 * @param signal - AbortSignal for client disconnection detection
 * @returns ReadableStream of SSE-formatted text
 */
function createOrchestratedSSEStream(
  message: string,
  signal: AbortSignal
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const onAbort = () => {
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      };
      signal.addEventListener("abort", onAbort, { once: true });

      try {
        const orchestrator = new StreamingOrchestrator();

        for await (const event of orchestrator.orchestrateStream(message)) {
          // Check if client disconnected before sending
          if (signal.aborted) break;

          // Yield each orchestration event as SSE
          controller.enqueue(encoder.encode(formatSSEEvent(event)));
        }

        // Send the termination signal if client is still connected
        if (!signal.aborted) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        }
      } catch (error) {
        if (!signal.aborted) {
          const errorMessage =
            error instanceof Error ? error.message : "Stream error";
          controller.enqueue(encoder.encode(formatSSEError(errorMessage)));
        }
      } finally {
        signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      }
    },
  });
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * GET /api/chat/stream
 *
 * Handles SSE streaming chat requests. Accepts a `message` query parameter
 * and an optional `agent` parameter.
 *
 * - When `agent` is specified: streams that single agent's response chunks
 * - When `agent` is omitted: orchestrates all 4 agents and sends each
 *   response as a separate SSE event
 *
 * @param request - The incoming HTTP request with query parameters
 * @returns SSE response stream
 */
export async function GET(request: Request) {
  // Parse query parameters
  const url = new URL(request.url);
  const message = url.searchParams.get("message");
  const agentType = url.searchParams.get("agent");

  // Validate message parameter
  if (!message || !message.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or empty 'message' query parameter",
      },
      { status: 400 }
    );
  }

  if (message.length > 10000) {
    return NextResponse.json(
      {
        success: false,
        error: "Message too long (max 10,000 characters)",
      },
      { status: 400 }
    );
  }

  const sseHeaders = {
    "Content-Type": SSE_CONTENT_TYPE,
    "Cache-Control": SSE_CACHE_CONTROL,
    Connection: SSE_CONNECTION,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    // Orchestrated path: all 4 agents respond (no specific agent requested)
    if (!agentType) {
      const sseStream = createOrchestratedSSEStream(message, request.signal);

      return new Response(sseStream, {
        status: 200,
        headers: sseHeaders,
      });
    }

    // Single-agent path: stream that agent's response
    const agent = createAgent(agentType);
    const stream = await agent.streamChat(message);
    const sseStream = createSSEStream(stream, request.signal);

    return new Response(sseStream, {
      status: 200,
      headers: sseHeaders,
    });
  } catch (error) {
    console.error("[Chat Stream API] Error:", error);

    // Handle known provider errors
    if (error && typeof error === "object" && "code" in error) {
      const providerError = error as { code: string; message: string };
      return NextResponse.json(
        {
          success: false,
          error: providerError.message,
          code: providerError.code,
        },
        { status: 502 }
      );
    }

    // Handle agent initialization errors
    if (
      error instanceof Error &&
      error.message.includes("not recognized")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
