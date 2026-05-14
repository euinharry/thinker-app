/**
 * Chat Stream Route - Orchestration Tests
 *
 * Tests for the orchestrated (no agent param) path of /api/chat/stream.
 * Verifies that StreamingOrchestrator is used and events are correctly
 * formatted as SSE.
 *
 * Uses mocked StreamingOrchestrator to avoid real agent calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrchestrationEvent } from "@/lib/agents/streaming-orchestrator";

// ============================================================================
// Mock Setup
// ============================================================================

const mockOrchestrateStream = vi.fn();

vi.mock("@/lib/agents/streaming-orchestrator", () => ({
  StreamingOrchestrator: class MockStreamingOrchestrator {
    orchestrateStream = mockOrchestrateStream;
  },
}));

// Mock agent modules (not used in orchestrated path but imported by route)
const mockLeaderStreamChat = vi.fn();
vi.mock("@/lib/agents/leader", () => ({
  LeaderAgent: class MockLeaderAgent {
    streamChat = mockLeaderStreamChat;
  },
}));
vi.mock("@/lib/agents/explorer", () => ({
  ExplorerAgent: class MockExplorerAgent {},
}));
vi.mock("@/lib/agents/thinker", () => ({
  ThinkerAgent: class MockThinkerAgent {},
}));
vi.mock("@/lib/agents/critic", () => ({
  CriticAgent: class MockCriticAgent {},
}));

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create an async iterable from an array of events.
 */
function createEventIterable(events: OrchestrationEvent[]): AsyncIterable<OrchestrationEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

/**
 * Create an async iterable that throws after yielding some events.
 */
function createFailingIterable(
  events: OrchestrationEvent[],
  error: Error
): AsyncIterable<OrchestrationEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
      throw error;
    },
  };
}

/**
 * Read all chunks from a ReadableStream and decode them as text.
 */
async function readStreamChunks(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }

  return chunks;
}

/**
 * Parse SSE data lines from raw text chunks.
 * Returns the parsed JSON objects (excluding [DONE]).
 */
function parseSSEData(rawChunks: string[]): unknown[] {
  const fullText = rawChunks.join("");
  const lines = fullText.split("\n\n").filter((line) => line.trim());
  const events: unknown[] = [];

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = line.slice(6);
      if (data === "[DONE]") {
        events.push({ __DONE: true });
      } else {
        events.push(JSON.parse(data));
      }
    }
  }

  return events;
}

/**
 * Create a minimal Request with AbortController for testing.
 */
function createTestRequest(
  message: string,
  agent?: string
): { request: Request; abort: () => void } {
  const controller = new AbortController();
  const url = new URL("http://localhost/api/chat/stream");
  url.searchParams.set("message", message);
  if (agent) {
    url.searchParams.set("agent", agent);
  }

  const request = new Request(url.toString(), {
    method: "GET",
    signal: controller.signal,
  });

  return { request, abort: () => controller.abort() };
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Tests
// ============================================================================

describe("Chat Stream Route - Orchestrated Path", () => {
  describe("uses StreamingOrchestrator", () => {
    it("creates StreamingOrchestrator and calls orchestrateStream()", async () => {
      // Arrange
      const events: OrchestrationEvent[] = [{ type: "done" }];
      mockOrchestrateStream.mockReturnValue(createEventIterable(events));

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Hello");

      // Act
      const response = await GET(request);

      // Assert
      expect(mockOrchestrateStream).toHaveBeenCalledWith("Hello");
      expect(response.status).toBe(200);
    });
  });

  describe("SSE event formatting", () => {
    it("yields each OrchestrationEvent as data: {JSON}\\n\\n", async () => {
      // Arrange
      const events: OrchestrationEvent[] = [
        {
          type: "primary_start",
          agent: { id: "leader", name: "Leader", personality: "Strategic", avatar: "👑" },
        },
        { type: "primary_chunk", delta: "Hello" },
        { type: "primary_chunk", delta: " world" },
        { type: "primary_end", fullResponse: "Hello world" },
        { type: "done" },
      ];
      mockOrchestrateStream.mockReturnValue(createEventIterable(events));

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Hello");

      // Act
      const response = await GET(request);
      const chunks = await readStreamChunks(response.body!);
      const parsed = parseSSEData(chunks);

      // Assert: each event is serialized as SSE data line
      expect(parsed).toHaveLength(6); // 5 events + [DONE]
      expect(parsed[0]).toEqual({
        type: "primary_start",
        agent: { id: "leader", name: "Leader", personality: "Strategic", avatar: "👑" },
      });
      expect(parsed[1]).toEqual({ type: "primary_chunk", delta: "Hello" });
      expect(parsed[2]).toEqual({ type: "primary_chunk", delta: " world" });
      expect(parsed[3]).toEqual({ type: "primary_end", fullResponse: "Hello world" });
      expect(parsed[4]).toEqual({ type: "done" });
    });

    it("sends data: [DONE]\\n\\n at the end", async () => {
      // Arrange
      const events: OrchestrationEvent[] = [{ type: "done" }];
      mockOrchestrateStream.mockReturnValue(createEventIterable(events));

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Test");

      // Act
      const response = await GET(request);
      const chunks = await readStreamChunks(response.body!);
      const fullText = chunks.join("");

      // Assert: [DONE] is the last SSE message
      expect(fullText).toMatch(/data: \[DONE\]\n\n$/);
    });

    it("sends supplement events in correct SSE format", async () => {
      // Arrange
      const events: OrchestrationEvent[] = [
        {
          type: "primary_start",
          agent: { id: "leader", name: "Leader", personality: "Strategic", avatar: "👑" },
        },
        { type: "primary_chunk", delta: "OK" },
        { type: "primary_end", fullResponse: "OK" },
        {
          type: "supplement_decision",
          decisions: [
            { agent: "explorer", shouldSupplement: true, reason: "test" },
          ],
        },
        {
          type: "supplement_start",
          agent: { id: "explorer", name: "Explorer", personality: "Researcher", avatar: "🔍" },
        },
        {
          type: "supplement_response",
          agent: { id: "explorer", name: "Explorer", personality: "Researcher", avatar: "🔍" },
          response: "Explorer says hi",
        },
        {
          type: "supplement_end",
          agent: { id: "explorer", name: "Explorer", personality: "Researcher", avatar: "🔍" },
        },
        { type: "done" },
      ];
      mockOrchestrateStream.mockReturnValue(createEventIterable(events));

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Test");

      // Act
      const response = await GET(request);
      const chunks = await readStreamChunks(response.body!);
      const parsed = parseSSEData(chunks);

      // Assert: all events are correctly formatted
      expect(parsed).toHaveLength(9); // 8 events + [DONE]
      expect(parsed[3]).toEqual({
        type: "supplement_decision",
        decisions: [{ agent: "explorer", shouldSupplement: true, reason: "test" }],
      });
      expect(parsed[4]).toEqual({
        type: "supplement_start",
        agent: { id: "explorer", name: "Explorer", personality: "Researcher", avatar: "🔍" },
      });
      expect(parsed[5]).toEqual({
        type: "supplement_response",
        agent: { id: "explorer", name: "Explorer", personality: "Researcher", avatar: "🔍" },
        response: "Explorer says hi",
      });
      expect(parsed[6]).toEqual({
        type: "supplement_end",
        agent: { id: "explorer", name: "Explorer", personality: "Researcher", avatar: "🔍" },
      });
    });
  });

  describe("SSE headers", () => {
    it("returns correct SSE headers", async () => {
      // Arrange
      const events: OrchestrationEvent[] = [{ type: "done" }];
      mockOrchestrateStream.mockReturnValue(createEventIterable(events));

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Test");

      // Act
      const response = await GET(request);

      // Assert
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
      expect(response.headers.get("Connection")).toBe("keep-alive");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("error handling", () => {
    it("sends SSE error event when orchestrateStream throws", async () => {
      // Arrange
      mockOrchestrateStream.mockReturnValue(
        createFailingIterable([], new Error("Orchestrator failed"))
      );

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Test");

      // Act
      const response = await GET(request);
      const chunks = await readStreamChunks(response.body!);
      const fullText = chunks.join("");

      // Assert: error is sent as SSE data (no [DONE] on error path)
      expect(fullText).toContain("data: ");
      expect(fullText).toContain("Orchestrator failed");
    });

    it("sends SSE error event when orchestrateStream throws during streaming", async () => {
      // Arrange: some events succeed, then error
      const events: OrchestrationEvent[] = [
        { type: "primary_start", agent: { id: "leader", name: "Leader", personality: "Strategic", avatar: "👑" } },
        { type: "primary_chunk", delta: "Partial" },
      ];
      mockOrchestrateStream.mockReturnValue(
        createFailingIterable(events, new Error("Connection lost"))
      );

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Test");

      // Act
      const response = await GET(request);
      const chunks = await readStreamChunks(response.body!);
      const parsed = parseSSEData(chunks);

      // Assert: partial events were sent, then error (no [DONE] on error path)
      expect(parsed[0]).toEqual({
        type: "primary_start",
        agent: { id: "leader", name: "Leader", personality: "Strategic", avatar: "👑" },
      });
      expect(parsed[1]).toEqual({ type: "primary_chunk", delta: "Partial" });
      // Error event is the last event (no [DONE])
      const lastEvent = parsed[parsed.length - 1];
      expect(lastEvent).toEqual({ error: "Connection lost" });
    });
  });

  describe("abort signal handling", () => {
    it("stops yielding events when client disconnects", async () => {
      // Arrange: create a slow iterable that we can abort
      const events: OrchestrationEvent[] = [
        { type: "primary_start", agent: { id: "leader", name: "Leader", personality: "Strategic", avatar: "👑" } },
        { type: "primary_chunk", delta: "Hello" },
        { type: "primary_end", fullResponse: "Hello" },
        { type: "done" },
      ];

      // Create iterable that delays between events
      mockOrchestrateStream.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const event of events) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            yield event;
          }
        },
      });

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request, abort } = createTestRequest("Test");

      // Act: abort immediately
      abort();

      const response = await GET(request);
      const chunks = await readStreamChunks(response.body!);

      // Assert: stream should be empty or minimal (aborted before any events)
      // The exact behavior depends on timing, but no [DONE] should be sent
      const fullText = chunks.join("");
      expect(fullText).not.toContain("[DONE]");
    });
  });

  describe("single-agent path unchanged", () => {
    it("still uses single agent when agent param is specified", async () => {
      // Arrange: mock a single agent response
      mockLeaderStreamChat.mockResolvedValue({
        id: "stream-123",
        model: "mimo",
        async *[Symbol.asyncIterator]() {
          yield { id: "1", model: "mimo", delta: { content: "Hi" }, finish_reason: null };
        },
      });

      const { GET } = await import("@/app/api/chat/stream/route");
      const { request } = createTestRequest("Hello", "leader");

      // Act
      const response = await GET(request);

      // Assert: orchestrateStream was NOT called
      expect(mockOrchestrateStream).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });
});
