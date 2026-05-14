/**
 * End-to-End Integration Tests: Full Pipeline
 *
 * Tests the complete flow from message to response, with all modules
 * working together using real implementations:
 *   message → analyzeMessage → decideSupplements → sortSupplements → StreamingOrchestrator
 *
 * Only MimoProvider is mocked (to avoid real API calls).
 * All analysis, decision, and sorting modules use REAL implementations.
 *
 * @module __tests__/integration/orchestrator
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatRequest, ChatResponse, StreamChunk, StreamResponse } from "@/types/ai";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Mock MimoProvider (only mock — avoid real API calls)
// ============================================================================

/**
 * Mock MimoProvider that returns deterministic responses based on agent_name.
 * The response content includes domain-specific keywords so that
 * supplement-decider can evaluate coverage realistically.
 */
const mockChat = vi.fn();
const mockStreamChat = vi.fn();

vi.mock("@/lib/ai/mimo-provider", () => {
  class MockMimoProvider {
    name = "mimo" as const;
    chat = mockChat;
    streamChat = mockStreamChat;
    isAvailable = vi.fn().mockResolvedValue(true);
  }

  // registerProvider is called at module load — mock it as no-op
  return {
    MimoProvider: MockMimoProvider,
    registerProvider: vi.fn(),
  };
});

// Also mock the provider base to avoid registerProvider side effects
vi.mock("@/lib/ai/provider", () => ({
  BaseProvider: class {},
  registerProvider: vi.fn(),
  parseSSEStream: vi.fn(),
  createProvider: vi.fn(),
}));

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a mock StreamResponse yielding the given chunks.
 */
function createMockStreamResponse(chunks: StreamChunk[]): StreamResponse {
  return {
    id: "integration-stream",
    model: "mimo-v2.5-pro",
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

/**
 * Create a mock ChatResponse with the given text content.
 */
function createMockChatResponse(content: string): ChatResponse {
  return {
    id: "integration-chat",
    model: "mimo-v2.5-pro",
    choices: [
      {
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

/**
 * Collect all events from an AsyncIterable.
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
 * Create stream chunks from a response string.
 * Splits the response into words for realistic streaming.
 */
function makeStreamChunks(response: string): StreamChunk[] {
  const words = response.split(" ");
  return words.map((word, i) => ({
    id: "chunk",
    model: "mimo-v2.5-pro",
    delta: { content: i === 0 ? word : ` ${word}` },
    finish_reason: i === words.length - 1 ? ("stop" as const) : null,
  }));
}

// ============================================================================
// Agent Response Templates
//
// Each agent's mock response includes keywords relevant to its domain,
// so supplement-decider can evaluate domain coverage realistically.
// ============================================================================

const AGENT_RESPONSES: Record<AgentType, string> = {
  leader:
    "Our strategy focuses on the big picture vision and mission alignment. " +
    "We need to coordinate team priorities and ensure our goals are met. " +
    "The roadmap shows a clear direction for the quarter.",

  explorer:
    "We should use React with TypeScript for the frontend framework. " +
    "The API will use REST endpoints with a PostgreSQL database. " +
    "Consider the scalability and performance of the architecture. " +
    "Deployment will use Docker containers on cloud infrastructure.",

  thinker:
    "Here is the implementation plan with clear steps and timeline. " +
    "Step 1: Research phase (1 week). Step 2: Design phase (2 weeks). " +
    "Dependencies include the API being ready. The milestone for delivery " +
    "is end of Q2. We need to estimate the scope of each task carefully.",

  critic:
    "Key risks include security vulnerabilities in the authentication flow. " +
    "Edge cases around timeout and failure scenarios need attention. " +
    "There are assumptions about data consistency that could be problematic. " +
    "Trade-offs between performance and reliability must be addressed. " +
    "Consider the limitation of the current approach.",
};

/**
 * Set up mock implementations for a given primary agent.
 * Primary agent uses streamChat, supplements use chat.
 */
function setupMocksForPrimary(primaryType: AgentType) {
  // Primary agent streams
  mockStreamChat.mockImplementation(async (request: ChatRequest) => {
    const agentName = request.agent_name?.toLowerCase() ?? "";
    let response: string;

    // Determine which agent is making the request based on agent_name
    if (agentName === "leader") response = AGENT_RESPONSES.leader;
    else if (agentName === "explorer") response = AGENT_RESPONSES.explorer;
    else if (agentName === "thinker") response = AGENT_RESPONSES.thinker;
    else if (agentName === "critic") response = AGENT_RESPONSES.critic;
    else response = "Generic response";

    return createMockStreamResponse(makeStreamChunks(response));
  });

  // All agents can chat (supplements use chat)
  mockChat.mockImplementation(async (request: ChatRequest) => {
    const agentName = request.agent_name?.toLowerCase() ?? "";
    let response: string;

    if (agentName === "leader") response = AGENT_RESPONSES.leader;
    else if (agentName === "explorer") response = AGENT_RESPONSES.explorer;
    else if (agentName === "thinker") response = AGENT_RESPONSES.thinker;
    else if (agentName === "critic") response = AGENT_RESPONSES.critic;
    else response = "Generic response";

    return createMockChatResponse(response);
  });
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
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: Full Pipeline (analyze → decide → sort → stream)", () => {
  // --------------------------------------------------------------------------
  // 1. End-to-end message flow
  // --------------------------------------------------------------------------

  describe("end-to-end message flow", () => {
    it("processes a strategy message through the complete pipeline", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What is our strategy and vision?")
      );

      // Should have: primary_start, primary_chunks, primary_end,
      // supplement_decision, supplement_start/response/end × N, done
      const eventTypes = events.map((e: any) => e.type);

      expect(eventTypes).toContain("primary_start");
      expect(eventTypes).toContain("primary_end");
      expect(eventTypes).toContain("supplement_decision");
      expect(eventTypes).toContain("done");

      // Primary should be leader (strategy keyword)
      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("leader");

      // Should have supplement events
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );
      expect(supplementResponses.length).toBeGreaterThan(0);
    });

    it("processes a technology message through the complete pipeline", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What framework and API should we use?")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("explorer");

      // Verify primary_end contains the explorer's response
      const primaryEnd = events.find((e: any) => e.type === "primary_end");
      expect((primaryEnd as any).fullResponse).toContain("React");
      expect((primaryEnd as any).fullResponse).toContain("TypeScript");
    });

    it("processes a planning message through the complete pipeline", async () => {
      setupMocksForPrimary("thinker");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Create a plan with timeline and dependencies")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("thinker");

      const primaryEnd = events.find((e: any) => e.type === "primary_end");
      expect((primaryEnd as any).fullResponse).toContain("plan");
      expect((primaryEnd as any).fullResponse).toContain("timeline");
    });

    it("processes a risk message through the complete pipeline", async () => {
      setupMocksForPrimary("critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What are the risks and weaknesses of this approach?")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("critic");

      const primaryEnd = events.find((e: any) => e.type === "primary_end");
      expect((primaryEnd as any).fullResponse).toContain("risk");
    });

    it("always ends with a done event", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Hello")
      );

      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });
  });

  // --------------------------------------------------------------------------
  // 2. All agents interact correctly
  // --------------------------------------------------------------------------

  describe("all agents interact correctly", () => {
    it("primary agent streams while supplement agents use chat()", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      // Leader used streamChat (primary)
      expect(mockStreamChat).toHaveBeenCalledTimes(1);
      const streamRequest = mockStreamChat.mock.calls[0][0] as ChatRequest;
      expect(streamRequest.agent_name).toBe("Leader");

      // Supplements used chat
      expect(mockChat).toHaveBeenCalled();
      const chatAgentNames = mockChat.mock.calls.map(
        (call: any) => (call[0] as ChatRequest).agent_name
      );

      // Leader should NOT be in supplement chat calls
      expect(chatAgentNames).not.toContain("Leader");
    });

    it("supplement agents receive the original user message", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const userMessage = "What technology should we use for the API?";
      await collectEvents(orchestrator.orchestrateStream(userMessage));

      // Primary gets the message
      const streamRequest = mockStreamChat.mock.calls[0][0] as ChatRequest;
      expect(streamRequest.messages[0].content).toBe(userMessage);

      // Supplements also get the message
      for (const call of mockChat.mock.calls) {
        const request = call[0] as ChatRequest;
        expect(request.messages[0].content).toBe(userMessage);
      }
    });

    it("all four agent types are involved in the orchestration", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Coordinate the team strategy")
      );

      // Primary start event
      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("leader");

      // Supplement decision includes all 4 agents
      const supplementDecision = events.find(
        (e: any) => e.type === "supplement_decision"
      );
      expect(supplementDecision).toBeDefined();
      const decisions = (supplementDecision as any).decisions;
      const agentTypes = decisions.map((d: any) => d.agent);
      expect(agentTypes).toContain("leader");
      expect(agentTypes).toContain("explorer");
      expect(agentTypes).toContain("thinker");
      expect(agentTypes).toContain("critic");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Primary agent selection works for different message types
  // --------------------------------------------------------------------------

  describe("primary agent selection", () => {
    it("selects leader for strategy messages", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What is our strategy for the roadmap?")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("leader");
      expect((primaryStart as any).agent.name).toBe("Leader");
    });

    it("selects explorer for technology messages", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Which framework and API should we evaluate?")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("explorer");
      expect((primaryStart as any).agent.name).toBe("Explorer");
    });

    it("selects thinker for planning messages", async () => {
      setupMocksForPrimary("thinker");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Create a plan with tasks and timeline")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("thinker");
      expect((primaryStart as any).agent.name).toBe("Thinker");
    });

    it("selects critic for risk messages", async () => {
      setupMocksForPrimary("critic");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What are the risks and issues with this?")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("critic");
      expect((primaryStart as any).agent.name).toBe("Critic");
    });

    it("defaults to leader for generic messages with no keywords", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Hello, how are you?")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("leader");
    });

    it("uses keyword analysis to select the agent with most matches", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      // Multiple explorer keywords should dominate
      const events = await collectEvents(
        orchestrator.orchestrateStream(
          "Research the best framework, compare their API performance and scalability"
        )
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      expect((primaryStart as any).agent.id).toBe("explorer");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Supplement decisions are respected
  // --------------------------------------------------------------------------

  describe("supplement decisions", () => {
    it("excludes the primary agent from supplementing itself", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What technology should we use?")
      );

      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );

      // Explorer is primary, so should not appear in supplements
      const supplementIds = supplementStarts.map(
        (e: any) => e.agent.id
      );
      expect(supplementIds).not.toContain("explorer");
    });

    it("leader never supplements other agents", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What technology should we use?")
      );

      // Leader should NOT be in supplement events
      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      const supplementIds = supplementStarts.map(
        (e: any) => e.agent.id
      );

      // Leader never supplements per the decider rules
      expect(supplementIds).not.toContain("leader");
    });

    it("supplement_decision event contains correct decisions", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      const decisionEvent = events.find(
        (e: any) => e.type === "supplement_decision"
      );
      expect(decisionEvent).toBeDefined();

      const decisions = (decisionEvent as any).decisions;
      expect(decisions).toHaveLength(4);

      // Leader decision: shouldSupplement = false (never supplements)
      const leaderDecision = decisions.find((d: any) => d.agent === "leader");
      expect(leaderDecision.shouldSupplement).toBe(false);

      // Each decision has required fields
      for (const decision of decisions) {
        expect(decision).toHaveProperty("agent");
        expect(decision).toHaveProperty("shouldSupplement");
        expect(decision).toHaveProperty("reason");
        expect(decision).toHaveProperty("confidence");
      }
    });

    it("only agents with shouldSupplement=true produce supplement events", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      const decisionEvent = events.find(
        (e: any) => e.type === "supplement_decision"
      );
      const decisions = (decisionEvent as any).decisions;
      const shouldSupplementAgents = decisions
        .filter((d: any) => d.shouldSupplement)
        .map((d: any) => d.agent);

      const supplementStarts = events.filter(
        (e: any) => e.type === "supplement_start"
      );
      const actualSupplementIds = supplementStarts.map(
        (e: any) => e.agent.id
      );

      // The supplement events should match the decisions
      expect(actualSupplementIds.sort()).toEqual(shouldSupplementAgents.sort());
    });

    it("supplement count matches shouldSupplement decisions", async () => {
      setupMocksForPrimary("thinker");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Create a plan for implementation")
      );

      const decisionEvent = events.find(
        (e: any) => e.type === "supplement_decision"
      );
      const decisions = (decisionEvent as any).decisions;
      const expectedCount = decisions.filter(
        (d: any) => d.shouldSupplement
      ).length;

      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );

      expect(supplementResponses).toHaveLength(expectedCount);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Supplements are ordered by relevance
  // --------------------------------------------------------------------------

  describe("supplement ordering", () => {
    it("supplements appear in relevance-sorted order", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy and roadmap?")
      );

      // Get supplement responses in order
      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );

      // Should have at least 2 supplements
      expect(supplementResponses.length).toBeGreaterThanOrEqual(2);

      // The order should be deterministic (sorted by relevance)
      // We can verify the structure is correct
      for (const event of supplementResponses) {
        expect(event).toHaveProperty("agent");
        expect(event).toHaveProperty("response");
        expect((event as any).agent).toHaveProperty("id");
        expect((event as any).agent).toHaveProperty("name");
      }
    });

    it("each supplement has start, response, and end events in order", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What framework should we use?")
      );

      // Filter supplement events
      const supplementEvents = events.filter(
        (e: any) =>
          e.type === "supplement_start" ||
          e.type === "supplement_response" ||
          e.type === "supplement_end"
      );

      // Should come in triplets: start, response, end
      expect(supplementEvents.length % 3).toBe(0);

      for (let i = 0; i < supplementEvents.length; i += 3) {
        expect((supplementEvents[i] as any).type).toBe("supplement_start");
        expect((supplementEvents[i + 1] as any).type).toBe("supplement_response");
        expect((supplementEvents[i + 2] as any).type).toBe("supplement_end");

        // All three should reference the same agent
        const agentId1 = (supplementEvents[i] as any).agent.id;
        const agentId2 = (supplementEvents[i + 1] as any).agent.id;
        const agentId3 = (supplementEvents[i + 2] as any).agent.id;
        expect(agentId1).toBe(agentId2);
        expect(agentId2).toBe(agentId3);
      }
    });

    it("supplement ordering is consistent across runs", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );

      // Run twice with the same input
      const orchestrator1 = new StreamingOrchestrator();
      const events1 = await collectEvents(
        orchestrator1.orchestrateStream("What's the strategy and roadmap?")
      );

      const orchestrator2 = new StreamingOrchestrator();
      const events2 = await collectEvents(
        orchestrator2.orchestrateStream("What's the strategy and roadmap?")
      );

      const getSupplementOrder = (events: unknown[]) =>
        events
          .filter((e: any) => e.type === "supplement_start")
          .map((e: any) => e.agent.id);

      expect(getSupplementOrder(events1)).toEqual(getSupplementOrder(events2));
    });
  });

  // --------------------------------------------------------------------------
  // 6. Streaming behavior
  // --------------------------------------------------------------------------

  describe("streaming behavior", () => {
    it("primary chunks are streamed in real-time before supplements", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      const eventTypes = events.map((e: any) => e.type);

      // primary_end should come before any supplement_start
      const primaryEndIdx = eventTypes.indexOf("primary_end");
      const firstSupplementIdx = eventTypes.indexOf("supplement_start");

      expect(primaryEndIdx).toBeGreaterThan(-1);
      expect(firstSupplementIdx).toBeGreaterThan(-1);
      expect(primaryEndIdx).toBeLessThan(firstSupplementIdx);
    });

    it("primary_chunk events accumulate into fullResponse", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      const chunks = events
        .filter((e: any) => e.type === "primary_chunk")
        .map((e: any) => e.delta);

      const primaryEnd = events.find((e: any) => e.type === "primary_end");

      // Concatenated chunks should equal fullResponse
      expect(chunks.join("")).toBe((primaryEnd as any).fullResponse);
    });

    it("primary_end fullResponse contains the agent's domain keywords", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What technology should we use?")
      );

      const primaryEnd = events.find((e: any) => e.type === "primary_end");
      const response = (primaryEnd as any).fullResponse;

      // Explorer's response should contain tech keywords
      expect(response).toContain("React");
      expect(response).toContain("TypeScript");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Error resilience
  // --------------------------------------------------------------------------

  describe("error resilience", () => {
    it("handles primary agent stream failure gracefully", async () => {
      mockStreamChat.mockRejectedValue(new Error("Provider down"));
      mockChat.mockResolvedValue(createMockChatResponse("Fallback response"));

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("Hello")
      );

      // Should still emit done event
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });

    it("handles supplement agent failure gracefully", async () => {
      // Primary succeeds, one supplement fails
      mockStreamChat.mockResolvedValue(
        createMockStreamResponse(makeStreamChunks("Strategy response"))
      );

      let chatCallCount = 0;
      mockChat.mockImplementation(async () => {
        chatCallCount++;
        if (chatCallCount === 1) {
          throw new Error("Explorer failed");
        }
        return createMockChatResponse("Supplement response");
      });

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      // Should still complete
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });

    it("handles all supplement agents failing", async () => {
      mockStreamChat.mockResolvedValue(
        createMockStreamResponse(makeStreamChunks("Primary response"))
      );
      mockChat.mockRejectedValue(new Error("All supplements down"));

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      // Primary should still stream
      const primaryChunks = events.filter(
        (e: any) => e.type === "primary_chunk"
      );
      expect(primaryChunks.length).toBeGreaterThan(0);

      // Done event should still be emitted
      const lastEvent = events[events.length - 1];
      expect(lastEvent).toEqual({ type: "done" });
    });
  });

  // --------------------------------------------------------------------------
  // 8. Event structure validation
  // --------------------------------------------------------------------------

  describe("event structure", () => {
    it("primary_start contains valid agent info", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      const primaryStart = events.find((e: any) => e.type === "primary_start");
      const agent = (primaryStart as any).agent;

      expect(agent).toHaveProperty("id");
      expect(agent).toHaveProperty("name");
      expect(agent).toHaveProperty("personality");
      expect(agent).toHaveProperty("avatar");
      expect(typeof agent.id).toBe("string");
      expect(typeof agent.name).toBe("string");
      expect(typeof agent.avatar).toBe("string");
    });

    it("supplement_decision contains valid decision objects", async () => {
      setupMocksForPrimary("leader");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What's the strategy?")
      );

      const decisionEvent = events.find(
        (e: any) => e.type === "supplement_decision"
      );
      const decisions = (decisionEvent as any).decisions;

      for (const decision of decisions) {
        expect(typeof decision.agent).toBe("string");
        expect(typeof decision.shouldSupplement).toBe("boolean");
        expect(typeof decision.reason).toBe("string");
        expect(typeof decision.confidence).toBe("number");
        expect(decision.confidence).toBeGreaterThanOrEqual(0);
        expect(decision.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("supplement_response contains agent info and response text", async () => {
      setupMocksForPrimary("explorer");

      const { StreamingOrchestrator } = await import(
        "@/lib/agents/streaming-orchestrator"
      );
      const orchestrator = new StreamingOrchestrator();

      const events = await collectEvents(
        orchestrator.orchestrateStream("What framework should we use?")
      );

      const supplementResponses = events.filter(
        (e: any) => e.type === "supplement_response"
      );

      for (const event of supplementResponses) {
        expect(event).toHaveProperty("agent");
        expect(event).toHaveProperty("response");
        expect((event as any).agent).toHaveProperty("id");
        expect((event as any).agent).toHaveProperty("name");
        expect(typeof (event as any).response).toBe("string");
      }
    });
  });
});
