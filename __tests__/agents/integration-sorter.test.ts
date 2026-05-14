/**
 * Integration Tests: Relevance Sorter ↔ Streaming Orchestrator
 *
 * Verifies that the StreamingOrchestrator correctly uses sortSupplements()
 * to order supplement agent responses by relevance to the primary agent's
 * response before yielding supplement events.
 *
 * Note: decideSupplements uses real keyword analysis (the mock for
 * supplement-decider doesn't intercept due to relative vs alias import
 * paths). Tests use primary responses with NO domain keywords so all 3
 * non-leader agents supplement. Supplement responses use non-domain
 * keywords with varying overlap to test sorting.
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
 * Helper to extract supplement_response events from collected events.
 */
function getSupplementResponses(events: unknown[]): Array<{ agent: AgentInfo; response: string }> {
  return events
    .filter((e: any) => e.type === "supplement_response")
    .map((e: any) => ({ agent: e.agent, response: e.response }));
}

/**
 * Helper to extract supplement_start agent IDs in order.
 */
function getSupplementOrder(events: unknown[]): string[] {
  return events
    .filter((e: any) => e.type === "supplement_start")
    .map((e: any) => (e as any).agent.id);
}

/**
 * Create a single-chunk stream with the given content.
 */
function singleChunk(content: string): StreamChunk[] {
  return [
    { id: "1", model: "mimo", delta: { content }, finish_reason: "stop" },
  ];
}

// ============================================================================
// Setup
// ============================================================================

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env = { ...originalEnv };
  process.env.MIMO_API_KEY = "test-api-key";
  process.env.MIMO_BASE_URL = "https://api.test.mimo.ai/v1";

  // Default agent info mocks
  mockLeaderGetAgentInfo.mockReturnValue(LEADER_INFO);
  mockExplorerGetAgentInfo.mockReturnValue(EXPLORER_INFO);
  mockThinkerGetAgentInfo.mockReturnValue(THINKER_INFO);
  mockCriticGetAgentInfo.mockReturnValue(CRITIC_INFO);

  // Default: always select leader as primary agent
  mockAnalyzeMessage.mockReturnValue({
    primaryAgent: "leader",
    confidence: 0,
    keywords: [],
  });
});

// ============================================================================
// Relevance Sorter ↔ Streaming Orchestrator Integration Tests
// ============================================================================

describe("Relevance Sorter ↔ Streaming Orchestrator Integration", () => {
  describe("supplement ordering by relevance", () => {
    it("sorts supplements by keyword overlap with primary response", async () => {
      // Primary uses non-domain keywords so all 3 agents supplement.
      // Explorer response has high keyword overlap with primary.
      // Critic response has some keyword overlap.
      // Thinker response has no keyword overlap.
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("painting colors canvas brush strokes artwork")
        )
      );
      // Explorer: overlaps with primary on "canvas" and "artwork"
      mockExplorerChat.mockResolvedValue(
        "canvas artwork museum gallery paintings"
      );
      // Thinker: no overlap with primary
      mockThinkerChat.mockResolvedValue(
        "cooking recipe ingredients food taste"
      );
      // Critic: overlaps with primary on "artwork"
      mockCriticChat.mockResolvedValue(
        "artwork paintings gallery exhibition artist"
      );

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Tell me about art")
      );

      // Assert: Explorer first (highest overlap), Critic second, Thinker last
      const supplementOrder = getSupplementOrder(events);
      expect(supplementOrder).toHaveLength(3);
      expect(supplementOrder[0]).toBe("explorer");
      expect(supplementOrder[1]).toBe("critic");
      expect(supplementOrder[2]).toBe("thinker");
    });

    it("yields supplement events in sorted order, not original order", async () => {
      // Thinker response has highest overlap with primary
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("mountains rivers forest meadow sunshine")
        )
      );
      // Explorer: no overlap
      mockExplorerChat.mockResolvedValue(
        "database schema migration index query"
      );
      // Thinker: overlaps on "mountains" and "forest"
      mockThinkerChat.mockResolvedValue(
        "mountains forest hiking trail adventure"
      );
      // Critic: no overlap
      mockCriticChat.mockResolvedValue(
        "budget forecast revenue expense profit"
      );

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Describe nature")
      );

      // Assert: Thinker should come first (highest overlap)
      const supplementOrder = getSupplementOrder(events);
      expect(supplementOrder).toHaveLength(3);
      expect(supplementOrder[0]).toBe("thinker");
    });

    it("preserves supplement_start, supplement_response, supplement_end triple for each agent", async () => {
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("garden flowers sunlight morning dew")
        )
      );
      mockExplorerChat.mockResolvedValue("garden flowers bloom petals");
      mockThinkerChat.mockResolvedValue("morning sunlight warmth");
      mockCriticChat.mockResolvedValue("dew drops rain moisture");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Tell me about gardens")
      );

      // Assert: each supplement agent has start → response → end
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      const supplementEnds = events.filter(
        (e: any) => e.type === "supplement_end"
      );

      expect(supplementStarts).toHaveLength(3);
      expect(supplementResponses).toHaveLength(3);
      expect(supplementEnds).toHaveLength(3);

      // For each supplement, start comes before response, response before end
      for (const startEvent of supplementStarts) {
        const agentId = (startEvent as any).agent.id;
        const startIdx = events.indexOf(startEvent);
        const responseIdx = events.findIndex(
          (e: any) =>
            e.type === "supplement_response" && e.agent?.id === agentId
        );
        const endIdx = events.findIndex(
          (e: any) => e.type === "supplement_end" && e.agent?.id === agentId
        );
        expect(startIdx).toBeLessThan(responseIdx);
        expect(responseIdx).toBeLessThan(endIdx);
      }
    });
  });

  describe("edge cases", () => {
    it("falls back to original order when primary response is empty", async () => {
      // Primary yields no content chunks → empty fullResponse
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse([
          { id: "1", model: "mimo", delta: {}, finish_reason: "stop" },
        ])
      );
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockResolvedValue("Critic response");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Test")
      );

      // Assert: supplements still appear (in original order since sorting falls back)
      const supplementOrder = getSupplementOrder(events);
      expect(supplementOrder).toHaveLength(3);
    });

    it("handles failed supplement agents by sorting them to the end", async () => {
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("colorful sunset beach ocean waves")
        )
      );
      // Explorer: high overlap
      mockExplorerChat.mockResolvedValue("ocean waves beach sand shoreline");
      // Thinker: some overlap
      mockThinkerChat.mockResolvedValue("sunset evening twilight dusk");
      // Critic: fails → empty response
      mockCriticChat.mockRejectedValue(new Error("Critic down"));

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Describe the beach")
      );

      // Assert: all 3 supplement agents get events (including failed critic)
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      expect(supplementStarts).toHaveLength(3);

      // Explorer should come first (highest relevance)
      const supplementOrder = getSupplementOrder(events);
      expect(supplementOrder[0]).toBe("explorer");

      // Critic (failed, empty response) should be last
      expect(supplementOrder[2]).toBe("critic");

      // Critic's supplement_response should have empty response
      const criticResponse = events.find(
        (e: any) =>
          e.type === "supplement_response" && e.agent?.id === "critic"
      );
      expect((criticResponse as any).response).toBe("");
    });

    it("still emits done event as the final event after sorted supplements", async () => {
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("melody harmony rhythm tempo")
        )
      );
      mockExplorerChat.mockResolvedValue("melody harmony notes chord");
      mockThinkerChat.mockResolvedValue("rhythm tempo beat");
      mockCriticChat.mockResolvedValue("harmony chord progression");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Tell me about music")
      );

      // Assert: last event is done
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });

    it("does not block the primary stream for sorting", async () => {
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("coffee tea morning breakfast")
        )
      );
      mockExplorerChat.mockResolvedValue("coffee beans roast brew");
      mockThinkerChat.mockResolvedValue("morning routine schedule");
      mockCriticChat.mockResolvedValue("breakfast nutrition calories");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Describe morning")
      );

      // Assert: primary_end comes before first supplement_start
      const eventTypes = events.map((e: any) => e.type);
      const primaryEndIdx = eventTypes.indexOf("primary_end");
      const firstSupplementIdx = eventTypes.indexOf("supplement_start");
      expect(primaryEndIdx).toBeLessThan(firstSupplementIdx);
    });
  });

  describe("sortSupplements integration", () => {
    it("uses response content for relevance keyword matching", async () => {
      // Primary uses non-domain keywords so all 3 agents supplement.
      // Explorer: high overlap with primary (ocean, coral, reef, underwater)
      // Critic: some overlap (reef)
      // Thinker: no overlap
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("blue ocean coral reef underwater")
        )
      );
      mockExplorerChat.mockResolvedValue(
        "ocean coral reef marine underwater"
      );
      mockThinkerChat.mockResolvedValue(
        "mountain snow altitude hiking"
      );
      mockCriticChat.mockResolvedValue(
        "reef ecosystem biodiversity"
      );

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Design the system")
      );

      // Assert: Explorer first, Critic second, Thinker last
      const supplementOrder = getSupplementOrder(events);
      expect(supplementOrder).toHaveLength(3);
      expect(supplementOrder[0]).toBe("explorer");
      expect(supplementOrder[1]).toBe("critic");
      expect(supplementOrder[2]).toBe("thinker");
    });

    it("produces stable ordering when supplements have equal relevance", async () => {
      // All supplements use completely different keywords from primary
      // → all have 0 Jaccard score → stable sort preserves original order
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(
          singleChunk("alpha beta gamma delta")
        )
      );
      mockExplorerChat.mockResolvedValue("echo foxtrot golf hotel");
      mockThinkerChat.mockResolvedValue("india juliet kilo lima");
      mockCriticChat.mockResolvedValue("mike november oscar papa");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Test")
      );

      // Assert: stable sort preserves original order
      const supplementOrder = getSupplementOrder(events);
      expect(supplementOrder).toHaveLength(3);
      expect(supplementOrder).toEqual(["explorer", "thinker", "critic"]);
    });
  });
});
