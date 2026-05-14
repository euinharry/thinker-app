/**
 * Orchestrator Tests
 *
 * Tests for the Orchestrator class: parallel execution, response ordering,
 * error handling, and partial failures.
 *
 * Uses mocked agents to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock Setup
// ============================================================================

const mockLeaderChat = vi.fn();
const mockExplorerChat = vi.fn();
const mockThinkerChat = vi.fn();
const mockCriticChat = vi.fn();

vi.mock("@/lib/agents/leader", () => {
  class MockLeaderAgent {
    agentType = "leader";
    chat = mockLeaderChat;
    getAgentInfo() {
      return {
        id: "leader",
        name: "Leader",
        personality: "Strategic visionary",
        avatar: "👑",
      };
    }
  }
  return { LeaderAgent: MockLeaderAgent };
});

vi.mock("@/lib/agents/explorer", () => {
  class MockExplorerAgent {
    agentType = "explorer";
    chat = mockExplorerChat;
    getAgentInfo() {
      return {
        id: "explorer",
        name: "Explorer",
        personality: "Tech researcher",
        avatar: "🔍",
      };
    }
  }
  return { ExplorerAgent: MockExplorerAgent };
});

vi.mock("@/lib/agents/thinker", () => {
  class MockThinkerAgent {
    agentType = "thinker";
    chat = mockThinkerChat;
    getAgentInfo() {
      return {
        id: "thinker",
        name: "Thinker",
        personality: "Task planner",
        avatar: "🧠",
      };
    }
  }
  return { ThinkerAgent: MockThinkerAgent };
});

vi.mock("@/lib/agents/critic", () => {
  class MockCriticAgent {
    agentType = "critic";
    chat = mockCriticChat;
    getAgentInfo() {
      return {
        id: "critic",
        name: "Critic",
        personality: "Quality challenger",
        avatar: "🎯",
      };
    }
  }
  return { CriticAgent: MockCriticAgent };
});

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.MIMO_API_KEY = "test-api-key";
  process.env.MIMO_BASE_URL = "https://api.test.mimo.ai/v1";
});

// ============================================================================
// Orchestrator Tests
// ============================================================================

describe("Orchestrator", () => {
  describe("orchestrate()", () => {
    it("calls all 4 agents in parallel", async () => {
      // Arrange: all agents respond successfully
      mockLeaderChat.mockResolvedValue("Leader response");
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockResolvedValue("Critic response");

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      // Act
      const responses = await orchestrator.orchestrate("Hello team");

      // Assert: all 4 agents were called
      expect(mockLeaderChat).toHaveBeenCalledTimes(1);
      expect(mockExplorerChat).toHaveBeenCalledTimes(1);
      expect(mockThinkerChat).toHaveBeenCalledTimes(1);
      expect(mockCriticChat).toHaveBeenCalledTimes(1);

      // All agents received the same message
      expect(mockLeaderChat).toHaveBeenCalledWith("Hello team");
      expect(mockExplorerChat).toHaveBeenCalledWith("Hello team");
      expect(mockThinkerChat).toHaveBeenCalledWith("Hello team");
      expect(mockCriticChat).toHaveBeenCalledWith("Hello team");

      // All 4 responses returned
      expect(responses).toHaveLength(4);
    });

    it("returns responses in correct order: Leader → Explorer → Thinker → Critic", async () => {
      // Arrange: each agent returns a unique response
      mockLeaderChat.mockResolvedValue("I am Leader");
      mockExplorerChat.mockResolvedValue("I am Explorer");
      mockThinkerChat.mockResolvedValue("I am Thinker");
      mockCriticChat.mockResolvedValue("I am Critic");

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      // Act
      const responses = await orchestrator.orchestrate("Test message");

      // Assert: responses are in canonical order
      expect(responses[0].agent.id).toBe("leader");
      expect(responses[0].response).toBe("I am Leader");
      expect(responses[1].agent.id).toBe("explorer");
      expect(responses[1].response).toBe("I am Explorer");
      expect(responses[2].agent.id).toBe("thinker");
      expect(responses[2].response).toBe("I am Thinker");
      expect(responses[3].agent.id).toBe("critic");
      expect(responses[3].response).toBe("I am Critic");
    });

    it("returns correct agent info for each response", async () => {
      mockLeaderChat.mockResolvedValue("Response");
      mockExplorerChat.mockResolvedValue("Response");
      mockThinkerChat.mockResolvedValue("Response");
      mockCriticChat.mockResolvedValue("Response");

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      const responses = await orchestrator.orchestrate("Test");

      expect(responses[0].agent).toEqual({
        id: "leader",
        name: "Leader",
        personality: "Strategic visionary",
        avatar: "👑",
      });
      expect(responses[1].agent).toEqual({
        id: "explorer",
        name: "Explorer",
        personality: "Tech researcher",
        avatar: "🔍",
      });
      expect(responses[2].agent).toEqual({
        id: "thinker",
        name: "Thinker",
        personality: "Task planner",
        avatar: "🧠",
      });
      expect(responses[3].agent).toEqual({
        id: "critic",
        name: "Critic",
        personality: "Quality challenger",
        avatar: "🎯",
      });
    });

    it("marks all responses as success when all agents succeed", async () => {
      mockLeaderChat.mockResolvedValue("OK");
      mockExplorerChat.mockResolvedValue("OK");
      mockThinkerChat.mockResolvedValue("OK");
      mockCriticChat.mockResolvedValue("OK");

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      const responses = await orchestrator.orchestrate("Test");

      responses.forEach((r) => {
        expect(r.success).toBe(true);
        expect(r.error).toBeUndefined();
      });
    });

    it("handles single agent failure gracefully (partial success)", async () => {
      // Arrange: Leader fails, others succeed
      mockLeaderChat.mockRejectedValue(new Error("Leader is busy"));
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockResolvedValue("Critic response");

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      // Act
      const responses = await orchestrator.orchestrate("Test message");

      // Assert: 4 responses total
      expect(responses).toHaveLength(4);

      // Leader failed
      expect(responses[0].agent.id).toBe("leader");
      expect(responses[0].success).toBe(false);
      expect(responses[0].response).toBe("");
      expect(responses[0].error).toBe("Leader is busy");

      // Others succeeded
      expect(responses[1].success).toBe(true);
      expect(responses[1].response).toBe("Explorer response");
      expect(responses[2].success).toBe(true);
      expect(responses[2].response).toBe("Thinker response");
      expect(responses[3].success).toBe(true);
      expect(responses[3].response).toBe("Critic response");
    });

    it("handles multiple agent failures gracefully", async () => {
      // Arrange: Leader and Critic fail
      mockLeaderChat.mockRejectedValue(new Error("Leader down"));
      mockExplorerChat.mockResolvedValue("Explorer response");
      mockThinkerChat.mockResolvedValue("Thinker response");
      mockCriticChat.mockRejectedValue(new Error("Critic down"));

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      // Act
      const responses = await orchestrator.orchestrate("Test");

      // Assert: 2 failed, 2 succeeded
      expect(responses[0].success).toBe(false);
      expect(responses[0].error).toBe("Leader down");
      expect(responses[1].success).toBe(true);
      expect(responses[2].success).toBe(true);
      expect(responses[3].success).toBe(false);
      expect(responses[3].error).toBe("Critic down");
    });

    it("handles all agents failing", async () => {
      mockLeaderChat.mockRejectedValue(new Error("Fail 1"));
      mockExplorerChat.mockRejectedValue(new Error("Fail 2"));
      mockThinkerChat.mockRejectedValue(new Error("Fail 3"));
      mockCriticChat.mockRejectedValue(new Error("Fail 4"));

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      const responses = await orchestrator.orchestrate("Test");

      expect(responses).toHaveLength(4);
      responses.forEach((r) => {
        expect(r.success).toBe(false);
        expect(r.response).toBe("");
        expect(r.error).toBeDefined();
      });
    });

    it("handles non-Error rejections gracefully", async () => {
      // Arrange: agent throws a string instead of Error
      mockLeaderChat.mockRejectedValue("string error");
      mockExplorerChat.mockResolvedValue("OK");
      mockThinkerChat.mockResolvedValue("OK");
      mockCriticChat.mockResolvedValue("OK");

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      const responses = await orchestrator.orchestrate("Test");

      expect(responses[0].success).toBe(false);
      expect(responses[0].error).toBe("string error");
    });

    it("handles undefined rejection reason", async () => {
      mockLeaderChat.mockRejectedValue(undefined);
      mockExplorerChat.mockResolvedValue("OK");
      mockThinkerChat.mockResolvedValue("OK");
      mockCriticChat.mockResolvedValue("OK");

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      const responses = await orchestrator.orchestrate("Test");

      expect(responses[0].success).toBe(false);
      expect(responses[0].error).toBe("Agent failed");
    });

    it("executes agents in parallel (not sequentially)", async () => {
      // Arrange: each agent takes a different time to respond
      // If executed sequentially, the total time would be the sum
      // If executed in parallel, the total time would be the max
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      mockLeaderChat.mockImplementation(async () => {
        await delay(50);
        return "Leader";
      });
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

      const { Orchestrator } = await import("@/lib/agents/orchestrator");
      const orchestrator = new Orchestrator();

      const start = Date.now();
      const responses = await orchestrator.orchestrate("Test");
      const elapsed = Date.now() - start;

      // All 4 agents responded
      expect(responses).toHaveLength(4);
      responses.forEach((r) => expect(r.success).toBe(true));

      // If sequential: 4 * 50ms = 200ms
      // If parallel: ~50ms (with overhead)
      // Allow generous margin for test environment
      expect(elapsed).toBeLessThan(150);
    });
  });
});
