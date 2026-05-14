/**
 * StreamingOrchestrator Tests
 *
 * Tests for the StreamingOrchestrator class: real-time primary agent streaming,
 * supplement agent execution after primary completes, error handling, and
 * event ordering.
 *
 * Uses mocked agents to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StreamChunk, StreamResponse } from "@/types/ai";
import type { AgentInfo } from "@/lib/agents/orchestrator";

// ============================================================================
// Mock Setup
// ============================================================================

const mockLeaderStreamChat = vi.fn();
const mockLeaderGetAgentInfo = vi.fn();
const mockExplorerChat = vi.fn();
const mockExplorerGetAgentInfo = vi.fn();
const mockThinkerChat = vi.fn();
const mockThinkerGetAgentInfo = vi.fn();
const mockCriticChat = vi.fn();
const mockCriticGetAgentInfo = vi.fn();

vi.mock("@/lib/agents/leader", () => {
  class MockLeaderAgent {
    agentType = "leader";
    streamChat = mockLeaderStreamChat;
    getAgentInfo = mockLeaderGetAgentInfo;
  }
  return { LeaderAgent: MockLeaderAgent };
});

vi.mock("@/lib/agents/explorer", () => {
  class MockExplorerAgent {
    agentType = "explorer";
    chat = mockExplorerChat;
    getAgentInfo = mockExplorerGetAgentInfo;
  }
  return { ExplorerAgent: MockExplorerAgent };
});

vi.mock("@/lib/agents/thinker", () => {
  class MockThinkerAgent {
    agentType = "thinker";
    chat = mockThinkerChat;
    getAgentInfo = mockThinkerGetAgentInfo;
  }
  return { ThinkerAgent: MockThinkerAgent };
});

vi.mock("@/lib/agents/critic", () => {
  class MockCriticAgent {
    agentType = "critic";
    chat = mockCriticChat;
    getAgentInfo = mockCriticGetAgentInfo;
  }
  return { CriticAgent: MockCriticAgent };
});

// Mock analyzeMessage to always return "leader" as primary (matches original behavior)
const mockAnalyzeMessage = vi.fn();
vi.mock("@/lib/agents/message-analyzer", () => ({
  analyzeMessage: mockAnalyzeMessage,
}));

// ============================================================================
// Helpers
// ============================================================================

const LEADER_INFO: AgentInfo = {
  id: "leader",
  name: "Leader",
  personality: "Strategic visionary",
  avatar: "👑",
};

const EXPLORER_INFO: AgentInfo = {
  id: "explorer",
  name: "Explorer",
  personality: "Tech researcher",
  avatar: "🔍",
};

const THINKER_INFO: AgentInfo = {
  id: "thinker",
  name: "Thinker",
  personality: "Task planner",
  avatar: "🧠",
};

const CRITIC_INFO: AgentInfo = {
  id: "critic",
  name: "Critic",
  personality: "Quality challenger",
  avatar: "🎯",
};

/**
 * Create a mock StreamResponse that yields the given chunks.
 */
function createMockStreamResponse(chunks: StreamChunk[]): StreamResponse {
  return {
    id: "stream-test-123",
    model: "mimo-v2.5-pro",
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

/**
 * Helper to collect all events from an AsyncIterable.
 */
async function collectEvents(
  iterable: AsyncIterable<unknown>
): Promise<unknown[]> {
  const events: unknown[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

/**
 * Create a delayed mock stream to simulate real-time streaming.
 */
function createDelayedStreamResponse(
  chunks: StreamChunk[],
  delayMs: number = 10
): StreamResponse {
  return {
    id: "stream-delayed",
    model: "mimo-v2.5-pro",
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        yield chunk;
      }
    },
  };
}

// ============================================================================
// Setup
// ============================================================================

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.MIMO_API_KEY = "test-api-key";
  process.env.MIMO_BASE_URL = "https://api.test.mimo.ai/v1";

  // Default agent info mocks
  mockLeaderGetAgentInfo.mockReturnValue(LEADER_INFO);
  mockExplorerGetAgentInfo.mockReturnValue(EXPLORER_INFO);
  mockThinkerGetAgentInfo.mockReturnValue(THINKER_INFO);
  mockCriticGetAgentInfo.mockReturnValue(CRITIC_INFO);

  // Default: analyzeMessage returns leader as primary (original behavior)
  mockAnalyzeMessage.mockReturnValue({
    primaryAgent: "leader",
    confidence: 0,
    keywords: [],
  });
});

// ============================================================================
// StreamingOrchestrator Tests
// ============================================================================

describe("StreamingOrchestrator", () => {
  describe("orchestrateStream() - event types", () => {
    it("emits primary_start event with agent info", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Hi" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: " there" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockResolvedValue("Critic response");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Hello"));

      // Assert: first event is primary_start
      expect(events[0]).toEqual({
        type: "primary_start",
        agent: LEADER_INFO,
      });
    });

    it("emits primary_chunk events with delta content", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Hello" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: " world" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: "!" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockResolvedValue("Critic response");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: primary_chunk events
      const chunkEvents = events.filter(
        (e: any) => e.type === "primary_chunk"
      );
      expect(chunkEvents).toHaveLength(3);
      expect(chunkEvents[0]).toEqual({ type: "primary_chunk", delta: "Hello" });
      expect(chunkEvents[1]).toEqual({ type: "primary_chunk", delta: " world" });
      expect(chunkEvents[2]).toEqual({ type: "primary_chunk", delta: "!" });
    });

    it("emits primary_end event with full response", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Hello" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: " world" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockResolvedValue("Critic response");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: primary_end has concatenated content
      const primaryEnd = events.find((e: any) => e.type === "primary_end");
      expect(primaryEnd).toEqual({
        type: "primary_end",
        fullResponse: "Hello world",
      });
    });

    it("emits supplement_start, supplement_response, supplement_end for each supplement agent", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Done" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer says hi");
      mockThinkerChat.mockResolvedValue("Thinker says hi");
      mockCriticChat.mockResolvedValue("Critic says hi");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: supplement events for explorer, thinker, critic
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      const supplementEnds = events.filter(
        (e: any) => e.type === "supplement_end"
      );

      // 3 supplement agents (all except leader)
      expect(supplementStarts).toHaveLength(3);
      expect(supplementResponses).toHaveLength(3);
      expect(supplementEnds).toHaveLength(3);

      // Each supplement_start has agent info
      for (const event of supplementStarts) {
        expect(event).toHaveProperty("agent");
        expect((event as any).agent).toHaveProperty("id");
      }

      // Each supplement_response has agent info and response
      const responseTexts = supplementResponses.map(
        (e: any) => e.response
      );
      expect(responseTexts).toContain("Explorer says hi");
      expect(responseTexts).toContain("Thinker says hi");
      expect(responseTexts).toContain("Critic says hi");
    });

    it("emits done event as the final event", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "OK" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: last event is done
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });
  });

  describe("orchestrateStream() - event ordering", () => {
    it("streams primary chunks before supplement events", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Part1" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: " Part2" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createDelayedStreamResponse(chunks, 20));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: primary events come before supplement events
      const eventTypes = events.map((e: any) => e.type);
      const primaryEndIndex = eventTypes.indexOf("primary_end");
      const firstSupplementIndex = eventTypes.indexOf("supplement_start");

      expect(primaryEndIndex).toBeGreaterThan(-1);
      expect(firstSupplementIndex).toBeGreaterThan(-1);
      expect(primaryEndIndex).toBeLessThan(firstSupplementIndex);
    });

    it("does not emit supplement events during primary streaming", async () => {
      // Arrange: slow primary stream
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Slow" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: " response" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createDelayedStreamResponse(chunks, 50));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: no supplement events appear before primary_end
      let primaryEnded = false;
      for (const event of events) {
        if ((event as any).type === "primary_end") {
          primaryEnded = true;
        }
        if (!primaryEnded) {
          expect((event as any).type).not.toMatch(/^supplement_/);
        }
      }
    });
  });

  describe("orchestrateStream() - primary agent", () => {
    it("calls primary agent's streamChat with the message", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "OK" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      await collectEvents(orchestrator.orchestrateStream("Test message"));

      // Assert
      expect(mockLeaderStreamChat).toHaveBeenCalledWith("Test message");
    });

    it("handles chunks with undefined content gracefully", async () => {
      // Arrange: some chunks have no content
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { role: "assistant" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: "Hello" }, finish_reason: null },
        { id: "1", model: "mimo", delta: {}, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: only chunks with content produce primary_chunk events
      const chunkEvents = events.filter(
        (e: any) => e.type === "primary_chunk"
      );
      expect(chunkEvents).toHaveLength(1);
      expect(chunkEvents[0]).toEqual({ type: "primary_chunk", delta: "Hello" });

      // Full response should only include chunks with content
      const primaryEnd = events.find((e: any) => e.type === "primary_end");
      expect((primaryEnd as any).fullResponse).toBe("Hello");
    });
  });

  describe("orchestrateStream() - supplement agents", () => {
    it("calls all supplement agents with the original message", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "OK" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      await collectEvents(orchestrator.orchestrateStream("Hello team"));

      // Assert: all supplement agents called with original message
      expect(mockExplorerChat).toHaveBeenCalledWith("Hello team");
      expect(mockThinkerChat).toHaveBeenCalledWith("Hello team");
      expect(mockCriticChat).toHaveBeenCalledWith("Hello team");
    });

    it("executes supplement agents in parallel via Promise.allSettled()", async () => {
      // Arrange: each supplement takes different time
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "OK" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));

      mockExplorerChat.mockImplementation(async () => {
        await delay(50);
        return "Explorer";
      });
      mockThinkerChat.mockImplementation(async () => {
        await delay(50);
        return "Thinker";
      });
      mockCriticChat.mockImplementation(async () => {
        await delay(50);
        return "Critic";
      });

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const start = Date.now();
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));
      const elapsed = Date.now() - start;

      // Assert: all supplements responded
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      expect(supplementResponses).toHaveLength(3);

      // If sequential: 3 * 50ms = 150ms
      // If parallel: ~50ms (with overhead)
      expect(elapsed).toBeLessThan(150);
    });

    it("handles supplement agent failure gracefully", async () => {
      // Arrange: Explorer fails, others succeed
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "OK" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockRejectedValue(new Error("Explorer is down"));
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockResolvedValue("Critic response");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: still emits done event (doesn't crash)
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });

      // Explorer should have supplement_start and supplement_end
      const explorerStart = events.find(
        (e: any) => e.type === "supplement_start" && e.agent?.id === "explorer"
      );
      expect(explorerStart).toBeDefined();
    });

    it("handles all supplement agents failing", async () => {
      // Arrange: all supplements fail
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "OK" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockRejectedValue(new Error("Explorer down"));
      mockThinkerChat.mockRejectedValue(new Error("Thinker down"));
      mockCriticChat.mockRejectedValue(new Error("Critic down"));

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: primary still streamed, done still emitted
      const primaryChunks = events.filter(
        (e: any) => e.type === "primary_chunk"
      );
      expect(primaryChunks).toHaveLength(1);

      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });
  });

  describe("orchestrateStream() - primary agent failure", () => {
    it("handles primary streamChat rejection gracefully", async () => {
      // Arrange: primary agent throws before streaming
      mockLeaderStreamChat.mockRejectedValue(new Error("Provider down"));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: should still emit done event (doesn't crash)
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });

    it("handles error during primary streaming gracefully", async () => {
      // Arrange: stream yields one chunk then throws
      const errorStream: StreamResponse = {
        id: "stream-error",
        model: "mimo",
        async *[Symbol.asyncIterator]() {
          yield {
            id: "1",
            model: "mimo",
            delta: { content: "Partial" },
            finish_reason: null,
          };
          throw new Error("Connection lost");
        },
      };
      mockLeaderStreamChat.mockResolvedValue(errorStream);
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: partial chunks were emitted before error
      const chunkEvents = events.filter(
        (e: any) => e.type === "primary_chunk"
      );
      expect(chunkEvents).toHaveLength(1);
      expect(chunkEvents[0]).toEqual({ type: "primary_chunk", delta: "Partial" });

      // Done event still emitted
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });
  });

  describe("orchestrateStream() - yields events in real-time", () => {
    it("yields primary_chunk events as they arrive (not buffered)", async () => {
      // Arrange: stream with delays between chunks
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "First" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: " Second" }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: " Third" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(
        createDelayedStreamResponse(chunks, 30)
      );
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act: collect events with timestamps
      const timestamps: number[] = [];
      const events: unknown[] = [];
      for await (const event of orchestrator.orchestrateStream("Test")) {
        timestamps.push(Date.now());
        events.push(event);
      }

      // Assert: primary_chunk events are spaced out (not all at once)
      const chunkTimestamps = events
        .filter((e: any) => e.type === "primary_chunk")
        .map((_, i) => timestamps[events.indexOf(events.filter((e: any) => e.type === "primary_chunk")[i])]);

      // Chunks should have gaps between them (at least 15ms apart)
      for (let i = 1; i < chunkTimestamps.length; i++) {
        expect(chunkTimestamps[i] - chunkTimestamps[i - 1]).toBeGreaterThanOrEqual(10);
      }
    });
  });
});
