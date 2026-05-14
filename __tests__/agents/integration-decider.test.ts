/**
 * Supplement Decider Integration Tests
 *
 * Tests that the StreamingOrchestrator correctly integrates with the
 * supplement decider: only agents with shouldSupplement=true are executed,
 * supplement_decision events are yielded, and the decider is called with
 * the right arguments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StreamingOrchestrator } from "@/lib/agents/streaming-orchestrator";
import type { StreamChunk, StreamResponse } from "@/types/ai";
import type { AgentInfo } from "@/lib/agents/orchestrator";
import type { SupplementDecision } from "@/lib/agents/supplement-decider";

// ============================================================================
// Mock Setup — use vi.hoisted() so references are available in vi.mock factories
// ============================================================================

const {
  mockLeaderStreamChat,
  mockLeaderGetAgentInfo,
  mockExplorerChat,
  mockExplorerGetAgentInfo,
  mockThinkerChat,
  mockThinkerGetAgentInfo,
  mockCriticChat,
  mockCriticGetAgentInfo,
  mockDecideSupplements,
  mockAnalyzeMessage,
} = vi.hoisted(() => ({
  mockLeaderStreamChat: vi.fn(),
  mockLeaderGetAgentInfo: vi.fn(),
  mockExplorerChat: vi.fn(),
  mockExplorerGetAgentInfo: vi.fn(),
  mockThinkerChat: vi.fn(),
  mockThinkerGetAgentInfo: vi.fn(),
  mockCriticChat: vi.fn(),
  mockCriticGetAgentInfo: vi.fn(),
  mockDecideSupplements: vi.fn(),
  mockAnalyzeMessage: vi.fn(),
}));

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

vi.mock("@/lib/agents/supplement-decider", () => ({
  decideSupplements: mockDecideSupplements,
}));

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
 * Helper to create a standard single-chunk stream.
 */
function singleChunkStream(content: string): StreamChunk[] {
  return [
    { id: "1", model: "mimo", delta: { content }, finish_reason: "stop" },
  ];
}

/**
 * Create mock decisions where all agents supplement.
 */
function allSupplementDecisions(): SupplementDecision[] {
  return [
    { agent: "leader", shouldSupplement: false, reason: "Leader defers", confidence: 1 },
    { agent: "explorer", shouldSupplement: true, reason: "Missing tech", confidence: 0.8 },
    { agent: "thinker", shouldSupplement: true, reason: "Missing plan", confidence: 0.8 },
    { agent: "critic", shouldSupplement: true, reason: "Missing risks", confidence: 0.8 },
  ];
}

/**
 * Create mock decisions where only explorer supplements.
 */
function explorerOnlyDecisions(): SupplementDecision[] {
  return [
    { agent: "leader", shouldSupplement: false, reason: "Leader defers", confidence: 1 },
    { agent: "explorer", shouldSupplement: true, reason: "Missing tech", confidence: 0.8 },
    { agent: "thinker", shouldSupplement: false, reason: "Plan covered", confidence: 0.7 },
    { agent: "critic", shouldSupplement: false, reason: "Risks covered", confidence: 0.7 },
  ];
}

/**
 * Create mock decisions where no agents supplement.
 */
function noSupplementDecisions(): SupplementDecision[] {
  return [
    { agent: "leader", shouldSupplement: false, reason: "Leader defers", confidence: 1 },
    { agent: "explorer", shouldSupplement: false, reason: "Tech covered", confidence: 0.7 },
    { agent: "thinker", shouldSupplement: false, reason: "Plan covered", confidence: 0.7 },
    { agent: "critic", shouldSupplement: false, reason: "Risks covered", confidence: 0.7 },
  ];
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

  // Default: all non-leader agents supplement
  mockDecideSupplements.mockReturnValue(allSupplementDecisions());

  // Default: analyzeMessage returns leader as primary
  mockAnalyzeMessage.mockReturnValue({
    primaryAgent: "leader",
    confidence: 0,
    keywords: [],
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("StreamingOrchestrator + SupplementDecider integration", () => {
  it("DIAGNOSTIC: check mock wiring", async () => {
    mockDecideSupplements.mockReturnValue([]);
    mockLeaderStreamChat.mockResolvedValue(
      createMockStreamResponse(singleChunkStream("Hello"))
    );

    // Verify mock wiring
    const leaderMod = await import("@/lib/agents/leader");
    const inst = new leaderMod.LeaderAgent();
    console.log("streamChat === mock:", inst.streamChat === mockLeaderStreamChat);
    console.log("getAgentInfo === mock:", inst.getAgentInfo === mockLeaderGetAgentInfo);
    console.log("getAgentInfo():", JSON.stringify(inst.getAgentInfo()));

    // Now test the orchestrator
    const orchestrator = new StreamingOrchestrator();
    const events: unknown[] = [];
    for await (const event of orchestrator.orchestrateStream("Test")) {
      events.push(event);
    }

    console.log("Event types:", events.map((e: any) => e.type));
    console.log("mockDecideSupplements calls:", mockDecideSupplements.mock.calls.length);
    console.log("mockLeaderStreamChat calls:", mockLeaderStreamChat.mock.calls.length);
    if (mockDecideSupplements.mock.calls.length > 0) {
      console.log("decideSupplements args:", JSON.stringify(mockDecideSupplements.mock.calls[0]));
    }

    expect(true).toBe(true);
  });

  describe("decideSupplements() is called correctly", () => {
    it("calls decideSupplements with leader as primary agent", async () => {
      // Arrange
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Hello"))
      );
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const orchestrator = new StreamingOrchestrator();

      // Act
      await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert
      expect(mockDecideSupplements).toHaveBeenCalledWith(
        "leader",
        "Hello",
        ["leader", "explorer", "thinker", "critic"]
      );
    });

    it("calls decideSupplements with the full assembled response", async () => {
      // Arrange: multiple chunks
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Part1" }, finish_reason: null },
        { id: "2", model: "mimo", delta: { content: " Part2" }, finish_reason: "stop" },
      ];
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const orchestrator = new StreamingOrchestrator();

      // Act
      await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: fullResponse is concatenated chunks
      expect(mockDecideSupplements).toHaveBeenCalledWith(
        "leader",
        "Part1 Part2",
        expect.any(Array)
      );
    });

    it("calls decideSupplements with empty string when primary fails", async () => {
      // Arrange: primary throws
      mockLeaderStreamChat.mockRejectedValue(new Error("Provider down"));
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const orchestrator = new StreamingOrchestrator();

      // Act
      await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: empty fullResponse
      expect(mockDecideSupplements).toHaveBeenCalledWith(
        "leader",
        "",
        expect.any(Array)
      );
    });
  });

  describe("supplement_decision event", () => {
    it("yields supplement_decision event after primary_end", async () => {
      // Arrange
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Hello"))
      );
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: supplement_decision appears after primary_end
      const primaryEndIndex = events.findIndex(
        (e: any) => e.type === "primary_end"
      );
      const decisionIndex = events.findIndex(
        (e: any) => e.type === "supplement_decision"
      );

      expect(primaryEndIndex).toBeGreaterThan(-1);
      expect(decisionIndex).toBeGreaterThan(-1);
      expect(decisionIndex).toBe(primaryEndIndex + 1);
    });

    it("supplement_decision contains all decisions from the decider", async () => {
      // Arrange
      const decisions = allSupplementDecisions();
      mockDecideSupplements.mockReturnValue(decisions);
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Hello"))
      );
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert
      const decisionEvent = events.find(
        (e: any) => e.type === "supplement_decision"
      );
      expect(decisionEvent).toEqual({
        type: "supplement_decision",
        decisions,
      });
    });
  });

  describe("filtered supplement execution", () => {
    it("only executes supplements where shouldSupplement is true", async () => {
      // Arrange: only explorer should supplement
      mockDecideSupplements.mockReturnValue(explorerOnlyDecisions());
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Hello"))
      );
      mockExplorerChat.mockResolvedValue("Explorer response");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: only explorer gets supplement events
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      expect(supplementResponses).toHaveLength(1);
      expect((supplementResponses[0] as any).agent.id).toBe("explorer");
      expect((supplementResponses[0] as any).response).toBe("Explorer response");

      // Explorer chat was called
      expect(mockExplorerChat).toHaveBeenCalledWith("Test");

      // Thinker and Critic chat were NOT called
      expect(mockThinkerChat).not.toHaveBeenCalled();
      expect(mockCriticChat).not.toHaveBeenCalled();
    });

    it("executes multiple filtered supplements in parallel", async () => {
      // Arrange: explorer and critic supplement, thinker does not
      const decisions: SupplementDecision[] = [
        { agent: "leader", shouldSupplement: false, reason: "Leader defers", confidence: 1 },
        { agent: "explorer", shouldSupplement: true, reason: "Missing tech", confidence: 0.8 },
        { agent: "thinker", shouldSupplement: false, reason: "Plan covered", confidence: 0.7 },
        { agent: "critic", shouldSupplement: true, reason: "Missing risks", confidence: 0.8 },
      ];
      mockDecideSupplements.mockReturnValue(decisions);
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Hello"))
      );
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockCriticChat.mockResolvedValue("Critic response");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: explorer and critic have supplement events
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      expect(supplementResponses).toHaveLength(2);

      const agentIds = supplementResponses.map((e: any) => e.agent.id);
      expect(agentIds).toContain("explorer");
      expect(agentIds).toContain("critic");

      // Thinker was NOT called
      expect(mockThinkerChat).not.toHaveBeenCalled();
    });

    it("emits no supplement events when no agents should supplement", async () => {
      // Arrange: no agents supplement
      mockDecideSupplements.mockReturnValue(noSupplementDecisions());
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Comprehensive answer"))
      );

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: no supplement events at all
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      const supplementEnds = events.filter(
        (e: any) => e.type === "supplement_end"
      );

      expect(supplementStarts).toHaveLength(0);
      expect(supplementResponses).toHaveLength(0);
      expect(supplementEnds).toHaveLength(0);

      // No supplement agent chat methods were called
      expect(mockExplorerChat).not.toHaveBeenCalled();
      expect(mockThinkerChat).not.toHaveBeenCalled();
      expect(mockCriticChat).not.toHaveBeenCalled();

      // Still emits supplement_decision and done
      const decisionEvent = events.find(
        (e: any) => e.type === "supplement_decision"
      );
      expect(decisionEvent).toBeDefined();

      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });

    it("executes all supplements when all non-leader agents should supplement", async () => {
      // Arrange: all non-leader supplement
      mockDecideSupplements.mockReturnValue(allSupplementDecisions());
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Brief"))
      );
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: all three non-leader supplements executed
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      expect(supplementResponses).toHaveLength(3);

      expect(mockExplorerChat).toHaveBeenCalledWith("Test");
      expect(mockThinkerChat).toHaveBeenCalledWith("Test");
      expect(mockCriticChat).toHaveBeenCalledWith("Test");
    });
  });

  describe("event ordering with decider", () => {
    it("maintains correct event order: primary_start → chunks → primary_end → supplement_decision → supplements → done", async () => {
      // Arrange
      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Hi" }, finish_reason: null },
        { id: "2", model: "mimo", delta: { content: " there" }, finish_reason: "stop" },
      ];
      mockDecideSupplements.mockReturnValue(explorerOnlyDecisions());
      mockLeaderStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockExplorerChat.mockResolvedValue("Explorer says hi");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: event types in correct order
      const eventTypes = events.map((e: any) => e.type);
      expect(eventTypes).toEqual([
        "primary_start",
        "primary_chunk",
        "primary_chunk",
        "primary_end",
        "supplement_decision",
        "supplement_start",
        "supplement_response",
        "supplement_end",
        "done",
      ]);
    });

    it("supplement_decision comes before any supplement events", async () => {
      // Arrange
      mockDecideSupplements.mockReturnValue(allSupplementDecisions());
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("OK"))
      );
      mockExplorerChat.mockResolvedValue("Explorer");
      mockThinkerChat.mockResolvedValue("Thinker");
      mockCriticChat.mockResolvedValue("Critic");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert
      const decisionIndex = events.findIndex(
        (e: any) => e.type === "supplement_decision"
      );
      const firstSupplementIndex = events.findIndex(
        (e: any) => e.type === "supplement_start"
      );

      expect(decisionIndex).toBeGreaterThan(-1);
      expect(firstSupplementIndex).toBeGreaterThan(-1);
      expect(decisionIndex).toBeLessThan(firstSupplementIndex);
    });
  });

  describe("supplement failure with filtered agents", () => {
    it("handles filtered supplement agent failure gracefully", async () => {
      // Arrange: explorer and critic supplement, explorer fails
      const decisions: SupplementDecision[] = [
        { agent: "leader", shouldSupplement: false, reason: "Leader defers", confidence: 1 },
        { agent: "explorer", shouldSupplement: true, reason: "Missing tech", confidence: 0.8 },
        { agent: "thinker", shouldSupplement: false, reason: "Plan covered", confidence: 0.7 },
        { agent: "critic", shouldSupplement: true, reason: "Missing risks", confidence: 0.8 },
      ];
      mockDecideSupplements.mockReturnValue(decisions);
      mockLeaderStreamChat.mockResolvedValue(
        createMockStreamResponse(singleChunkStream("Hello"))
      );
      mockExplorerChat.mockRejectedValue(new Error("Explorer down"));
      mockCriticChat.mockResolvedValue("Critic response");

      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(orchestrator.orchestrateStream("Test"));

      // Assert: done event is still emitted
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });

      // Critic still got its events
      const criticResponse = events.find(
        (e: any) => e.type === "supplement_response" && e.agent?.id === "critic"
      );
      expect(criticResponse).toBeDefined();
    });
  });
});
