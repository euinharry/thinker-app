/**
 * Integration Tests: Message Analyzer ↔ Streaming Orchestrator
 *
 * Verifies that the StreamingOrchestrator correctly uses analyzeMessage()
 * to dynamically select the primary agent based on message content.
 *
 * Tests that:
 * - Different messages select different primary agents
 * - Supplements are all agents EXCEPT the primary
 * - The createAgent() factory creates correct agent types
 * - Event flow works with any agent as primary
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StreamChunk, StreamResponse } from "@/types/ai";
import type { AgentInfo } from "@/lib/agents/orchestrator";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Mock Setup
// ============================================================================

// Agent mocks — each agent needs streamChat, chat, and getAgentInfo
const mockLeaderStreamChat = vi.fn();
const mockLeaderChat = vi.fn();
const mockLeaderGetAgentInfo = vi.fn();

const mockExplorerStreamChat = vi.fn();
const mockExplorerChat = vi.fn();
const mockExplorerGetAgentInfo = vi.fn();

const mockThinkerStreamChat = vi.fn();
const mockThinkerChat = vi.fn();
const mockThinkerGetAgentInfo = vi.fn();

const mockCriticStreamChat = vi.fn();
const mockCriticChat = vi.fn();
const mockCriticGetAgentInfo = vi.fn();

vi.mock("@/lib/agents/leader", () => {
  class MockLeaderAgent {
    agentType = "leader";
    streamChat = mockLeaderStreamChat;
    chat = mockLeaderChat;
    getAgentInfo = mockLeaderGetAgentInfo;
  }
  return { LeaderAgent: MockLeaderAgent };
});

vi.mock("@/lib/agents/explorer", () => {
  class MockExplorerAgent {
    agentType = "explorer";
    streamChat = mockExplorerStreamChat;
    chat = mockExplorerChat;
    getAgentInfo = mockExplorerGetAgentInfo;
  }
  return { ExplorerAgent: MockExplorerAgent };
});

vi.mock("@/lib/agents/thinker", () => {
  class MockThinkerAgent {
    agentType = "thinker";
    streamChat = mockThinkerStreamChat;
    chat = mockThinkerChat;
    getAgentInfo = mockThinkerGetAgentInfo;
  }
  return { ThinkerAgent: MockThinkerAgent };
});

vi.mock("@/lib/agents/critic", () => {
  class MockCriticAgent {
    agentType = "critic";
    streamChat = mockCriticStreamChat;
    chat = mockCriticChat;
    getAgentInfo = mockCriticGetAgentInfo;
  }
  return { CriticAgent: MockCriticAgent };
});

// Mock analyzeMessage — we control what primaryAgent it returns
const mockAnalyzeMessage = vi.fn();

vi.mock("@/lib/agents/message-analyzer", () => ({
  analyzeMessage: mockAnalyzeMessage,
}));

// Mock decideSupplements — we control which agents supplement
const mockDecideSupplements = vi.fn();

vi.mock("@/lib/agents/supplement-decider", () => ({
  decideSupplements: mockDecideSupplements,
}));

// Mock sortSupplements — pass through in original order
const mockSortSupplements = vi.fn();

vi.mock("@/lib/agents/relevance-sorter", () => ({
  sortSupplements: mockSortSupplements,
}));

// ============================================================================
// Helpers
// ============================================================================

const AGENT_INFOS: Record<AgentType, AgentInfo> = {
  leader: { id: "leader", name: "Leader", personality: "Strategic visionary", avatar: "👑" },
  explorer: { id: "explorer", name: "Explorer", personality: "Tech researcher", avatar: "🔍" },
  thinker: { id: "thinker", name: "Thinker", personality: "Task planner", avatar: "🧠" },
  critic: { id: "critic", name: "Critic", personality: "Quality challenger", avatar: "🎯" },
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
 * Get the mock streamChat function for a given agent type.
 */
function getStreamChatMock(agentType: AgentType) {
  switch (agentType) {
    case "leader": return mockLeaderStreamChat;
    case "explorer": return mockExplorerStreamChat;
    case "thinker": return mockThinkerStreamChat;
    case "critic": return mockCriticStreamChat;
  }
}

/**
 * Get the mock chat function for a given agent type.
 */
function getChatMock(agentType: AgentType) {
  switch (agentType) {
    case "leader": return mockLeaderChat;
    case "explorer": return mockExplorerChat;
    case "thinker": return mockThinkerChat;
    case "critic": return mockCriticChat;
  }
}

/**
 * Get the mock getAgentInfo function for a given agent type.
 */
function getAgentInfoMock(agentType: AgentType) {
  switch (agentType) {
    case "leader": return mockLeaderGetAgentInfo;
    case "explorer": return mockExplorerGetAgentInfo;
    case "thinker": return mockThinkerGetAgentInfo;
    case "critic": return mockCriticGetAgentInfo;
  }
}

/**
 * Set up all agent info mocks with their standard return values.
 */
function setupAgentInfoMocks() {
  mockLeaderGetAgentInfo.mockReturnValue(AGENT_INFOS.leader);
  mockExplorerGetAgentInfo.mockReturnValue(AGENT_INFOS.explorer);
  mockThinkerGetAgentInfo.mockReturnValue(AGENT_INFOS.thinker);
  mockCriticGetAgentInfo.mockReturnValue(AGENT_INFOS.critic);
}

/**
 * Set up streamChat and chat mocks for all agents.
 * The primary agent uses streamChat; supplements use chat.
 */
function setupAgentResponseMocks(primaryType: AgentType) {
  const defaultChunks: StreamChunk[] = [
    { id: "1", model: "mimo", delta: { content: "OK" }, finish_reason: "stop" },
  ];

  // Primary agent streams
  getStreamChatMock(primaryType).mockResolvedValue(
    createMockStreamResponse(defaultChunks)
  );

  // All agents can chat (supplements use chat)
  for (const type of ["leader", "explorer", "thinker", "critic"] as AgentType[]) {
    getChatMock(type).mockResolvedValue(`${type} response`);
  }
}

/**
 * Set up decideSupplements mock: all non-primary agents supplement.
 * We control this to test the analyzer integration, not the decider logic.
 */
function setupDecideSupplementsMock(primaryType: AgentType) {
  const ALL_TYPES: AgentType[] = ["leader", "explorer", "thinker", "critic"];
  mockDecideSupplements.mockImplementation(
    (_primary: AgentType, _response: string, _agents: AgentType[]) => {
      return ALL_TYPES.map((type) => ({
        agent: type,
        shouldSupplement: type !== primaryType,
        reason: type === primaryType ? "Is primary" : "Domain not covered",
        confidence: 1.0,
      }));
    }
  );

  // sortSupplements: pass through in original order
  mockSortSupplements.mockImplementation(
    (_primaryResponse: string, supplements: Array<{ agentType: AgentType; reason: string; content: string }>) => {
      return supplements;
    }
  );
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

  setupAgentInfoMocks();
});

// ============================================================================
// Tests
// ============================================================================

describe("Integration: Message Analyzer ↔ Streaming Orchestrator", () => {
  describe("dynamic primary agent selection", () => {
    it("selects Explorer as primary when message has explorer keywords", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "explorer",
        confidence: 1.0,
        keywords: ["framework", "API"],
      });
      setupAgentResponseMocks("explorer");
      setupDecideSupplementsMock("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What framework and API should we use?")
      );

      // Assert: analyzeMessage was called with the message
      expect(mockAnalyzeMessage).toHaveBeenCalledWith(
        "What framework and API should we use?"
      );

      // Assert: primary_start has Explorer info
      expect(events[0]).toEqual({
        type: "primary_start",
        agent: AGENT_INFOS.explorer,
      });

      // Assert: Explorer's streamChat was called (not Leader's)
      expect(mockExplorerStreamChat).toHaveBeenCalledWith(
        "What framework and API should we use?"
      );
      expect(mockLeaderStreamChat).not.toHaveBeenCalled();
    });

    it("selects Thinker as primary when message has thinker keywords", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "thinker",
        confidence: 1.0,
        keywords: ["task", "schedule"],
      });
      setupAgentResponseMocks("thinker");
            setupDecideSupplementsMock("thinker");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Break down this task and schedule it")
      );

      // Assert: primary_start has Thinker info
      expect(events[0]).toEqual({
        type: "primary_start",
        agent: AGENT_INFOS.thinker,
      });

      // Assert: Thinker's streamChat was called
      expect(mockThinkerStreamChat).toHaveBeenCalledWith(
        "Break down this task and schedule it"
      );
      expect(mockLeaderStreamChat).not.toHaveBeenCalled();
    });

    it("selects Critic as primary when message has critic keywords", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "critic",
        confidence: 1.0,
        keywords: ["risk", "weakness"],
      });
      setupAgentResponseMocks("critic");
            setupDecideSupplementsMock("critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What are the risks and weaknesses?")
      );

      // Assert: primary_start has Critic info
      expect(events[0]).toEqual({
        type: "primary_start",
        agent: AGENT_INFOS.critic,
      });

      // Assert: Critic's streamChat was called
      expect(mockCriticStreamChat).toHaveBeenCalledWith(
        "What are the risks and weaknesses?"
      );
      expect(mockLeaderStreamChat).not.toHaveBeenCalled();
    });

    it("selects Leader as primary when message has leader keywords", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "leader",
        confidence: 1.0,
        keywords: ["strategy", "vision"],
      });
      setupAgentResponseMocks("leader");
            setupDecideSupplementsMock("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What's our strategy and vision?")
      );

      // Assert: primary_start has Leader info
      expect(events[0]).toEqual({
        type: "primary_start",
        agent: AGENT_INFOS.leader,
      });

      // Assert: Leader's streamChat was called
      expect(mockLeaderStreamChat).toHaveBeenCalledWith(
        "What's our strategy and vision?"
      );
    });

    it("defaults to Leader for empty/generic messages", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "leader",
        confidence: 0,
        keywords: [],
      });
      setupAgentResponseMocks("leader");
            setupDecideSupplementsMock("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Hello")
      );

      // Assert: analyzeMessage was called
      expect(mockAnalyzeMessage).toHaveBeenCalledWith("Hello");

      // Assert: Leader is primary
      expect(events[0]).toEqual({
        type: "primary_start",
        agent: AGENT_INFOS.leader,
      });
    });
  });

  describe("supplement agents exclude primary", () => {
    it("excludes Explorer from supplements when Explorer is primary", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "explorer",
        confidence: 1.0,
        keywords: ["technology"],
      });
      setupAgentResponseMocks("explorer");
            setupDecideSupplementsMock("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What technology should we use?")
      );

      // Assert: 3 supplement agents (leader, thinker, critic — not explorer)
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      expect(supplementStarts).toHaveLength(3);

      const supplementIds = supplementStarts.map(
        (e: any) => e.agent.id
      );
      expect(supplementIds).toContain("leader");
      expect(supplementIds).toContain("thinker");
      expect(supplementIds).toContain("critic");
      expect(supplementIds).not.toContain("explorer");
    });

    it("excludes Thinker from supplements when Thinker is primary", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "thinker",
        confidence: 1.0,
        keywords: ["plan"],
      });
      setupAgentResponseMocks("thinker");
            setupDecideSupplementsMock("thinker");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("Create a plan")
      );

      // Assert: 3 supplement agents (leader, explorer, critic — not thinker)
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      expect(supplementStarts).toHaveLength(3);

      const supplementIds = supplementStarts.map(
        (e: any) => e.agent.id
      );
      expect(supplementIds).toContain("leader");
      expect(supplementIds).toContain("explorer");
      expect(supplementIds).toContain("critic");
      expect(supplementIds).not.toContain("thinker");
    });

    it("excludes Critic from supplements when Critic is primary", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "critic",
        confidence: 1.0,
        keywords: ["risk"],
      });
      setupAgentResponseMocks("critic");
            setupDecideSupplementsMock("critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What are the risks?")
      );

      // Assert: 3 supplement agents (leader, explorer, thinker — not critic)
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      expect(supplementStarts).toHaveLength(3);

      const supplementIds = supplementStarts.map(
        (e: any) => e.agent.id
      );
      expect(supplementIds).toContain("leader");
      expect(supplementIds).toContain("explorer");
      expect(supplementIds).toContain("thinker");
      expect(supplementIds).not.toContain("critic");
    });

    it("excludes Leader from supplements when Leader is primary", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "leader",
        confidence: 1.0,
        keywords: ["strategy"],
      });
      setupAgentResponseMocks("leader");
            setupDecideSupplementsMock("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      // Assert: 3 supplement agents (explorer, thinker, critic — not leader)
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      expect(supplementStarts).toHaveLength(3);

      const supplementIds = supplementStarts.map(
        (e: any) => e.agent.id
      );
      expect(supplementIds).toContain("explorer");
      expect(supplementIds).toContain("thinker");
      expect(supplementIds).toContain("critic");
      expect(supplementIds).not.toContain("leader");
    });
  });

  describe("event flow with non-leader primary", () => {
    it("emits complete event sequence when Explorer is primary", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "explorer",
        confidence: 1.0,
        keywords: ["framework"],
      });

      const chunks: StreamChunk[] = [
        { id: "1", model: "mimo", delta: { content: "Use " }, finish_reason: null },
        { id: "1", model: "mimo", delta: { content: "Next.js" }, finish_reason: "stop" },
      ];
      mockExplorerStreamChat.mockResolvedValue(createMockStreamResponse(chunks));
      mockLeaderChat.mockResolvedValue("Leader supplement");
      mockThinkerChat.mockResolvedValue("Thinker supplement");
      mockCriticChat.mockResolvedValue("Critic supplement");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What framework?")
      );

      // Assert: event types in order
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
        "supplement_start",
        "supplement_response",
        "supplement_end",
        "supplement_start",
        "supplement_response",
        "supplement_end",
        "done",
      ]);

      // Assert: primary_end has concatenated content
      const primaryEnd = events.find((e: any) => e.type === "primary_end");
      expect(primaryEnd).toEqual({
        type: "primary_end",
        fullResponse: "Use Next.js",
      });
    });

    it("calls supplement agents' chat() with the original message", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "thinker",
        confidence: 1.0,
        keywords: ["plan"],
      });
      setupAgentResponseMocks("thinker");
            setupDecideSupplementsMock("thinker");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      await collectEvents(
        orchestrator.orchestrateStream("Create a detailed plan")
      );

      // Assert: supplement agents called with original message
      expect(mockLeaderChat).toHaveBeenCalledWith("Create a detailed plan");
      expect(mockExplorerChat).toHaveBeenCalledWith("Create a detailed plan");
      expect(mockCriticChat).toHaveBeenCalledWith("Create a detailed plan");

      // Assert: primary's streamChat called with original message
      expect(mockThinkerStreamChat).toHaveBeenCalledWith("Create a detailed plan");
    });
  });

  describe("analyzeMessage integration", () => {
    it("passes the message to analyzeMessage", async () => {
      // Arrange
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "leader",
        confidence: 0,
        keywords: [],
      });
      setupAgentResponseMocks("leader");
            setupDecideSupplementsMock("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      await collectEvents(
        orchestrator.orchestrateStream("Test message for analysis")
      );

      // Assert
      expect(mockAnalyzeMessage).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeMessage).toHaveBeenCalledWith("Test message for analysis");
    });

    it("uses analysis result to determine primary agent type", async () => {
      // Arrange: analyzeMessage says critic
      mockAnalyzeMessage.mockReturnValue({
        primaryAgent: "critic",
        confidence: 0.8,
        keywords: ["issue", "problem"],
      });
      setupAgentResponseMocks("critic");
            setupDecideSupplementsMock("critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Act
      const events = await collectEvents(
        orchestrator.orchestrateStream("What issues and problems exist?")
      );

      // Assert: Critic is primary
      expect(events[0]).toEqual({
        type: "primary_start",
        agent: AGENT_INFOS.critic,
      });

      // Assert: Critic's streamChat was used
      expect(mockCriticStreamChat).toHaveBeenCalled();
      expect(mockLeaderStreamChat).not.toHaveBeenCalled();
      expect(mockExplorerStreamChat).not.toHaveBeenCalled();
      expect(mockThinkerStreamChat).not.toHaveBeenCalled();
    });
  });
});
