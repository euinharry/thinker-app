/**
 * Thinker Agent Tests
 *
 * Tests for ThinkerAgent: initialization, chat(), streamChat(), error handling.
 * Uses mocked AI provider to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mock Setup
// ============================================================================

const mockChatFn = vi.fn();
const mockStreamChatFn = vi.fn();

vi.mock("@/lib/ai/mimo-provider", () => {
  class MockMimoProvider {
    name = "mimo";
    chat = mockChatFn;
    streamChat = mockStreamChatFn;

    constructor(_config?: any) {}
  }

  return {
    MimoProvider: MockMimoProvider,
  };
});

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.MIMO_API_KEY = "test-api-key";
  process.env.MIMO_BASE_URL = "https://api.test.mimo.ai/v1";
});

// ============================================================================
// ThinkerAgent Tests
// ============================================================================

describe("ThinkerAgent", () => {
  describe("initialization", () => {
    it("creates an instance with default config", async () => {
      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      expect(thinker).toBeDefined();
      expect(thinker.agentType).toBe("thinker");
    });

    it("returns correct agent info", async () => {
      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();
      const info = thinker.getAgentInfo();

      expect(info.id).toBe("thinker");
      expect(info.name).toBe("Thinker");
      expect(info.avatar).toBe("🧠");
      expect(info.personality).toContain("planner");
    });

    it("returns system prompt", async () => {
      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();
      const prompt = thinker.getSystemPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain("Thinker");
      expect(prompt).toContain("planner");
    });

    it("accepts custom configuration", async () => {
      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent({
        model: "custom-model",
        temperature: 0.5,
        maxTokens: 2048,
      });

      expect(thinker).toBeDefined();
      expect(thinker.agentType).toBe("thinker");
    });
  });

  describe("chat()", () => {
    it("throws error for empty message", async () => {
      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.chat("")).rejects.toThrow("Message cannot be empty");
    });

    it("throws error for whitespace-only message", async () => {
      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.chat("   ")).rejects.toThrow("Message cannot be empty");
    });

    it("calls provider with correct request structure", async () => {
      mockChatFn.mockResolvedValue({
        id: "test-id",
        model: "mimo-v2.5-pro",
        choices: [
          {
            message: { role: "assistant", content: "Test response" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();
      const response = await thinker.chat("How should we plan this?");

      expect(mockChatFn).toHaveBeenCalledTimes(1);
      expect(mockChatFn).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "How should we plan this?" }],
          model: "mimo-v2.5-pro",
          system_prompt: expect.stringContaining("Thinker"),
          agent_name: "Thinker",
        })
      );
      expect(response).toBe("Test response");
    });

    it("returns response content from provider", async () => {
      const expectedResponse = "Here is a structured plan with 5 steps...";

      mockChatFn.mockResolvedValue({
        id: "test-id",
        model: "mimo-v2.5-pro",
        choices: [
          {
            message: { role: "assistant", content: expectedResponse },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();
      const response = await thinker.chat("Plan this project");

      expect(response).toBe(expectedResponse);
    });

    it("throws error when provider returns empty response", async () => {
      mockChatFn.mockResolvedValue({
        id: "test-id",
        model: "mimo-v2.5-pro",
        choices: [
          {
            message: { role: "assistant", content: "" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      });

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.chat("Hello")).rejects.toThrow("Empty response from AI provider");
    });

    it("re-throws provider errors", async () => {
      const providerError = {
        code: "rate_limit",
        message: "Rate limit exceeded",
        retryable: true,
      };

      mockChatFn.mockRejectedValue(providerError);

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.chat("Hello")).rejects.toEqual(providerError);
    });

    it("wraps unexpected errors", async () => {
      mockChatFn.mockRejectedValue(new Error("Network error"));

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.chat("Hello")).rejects.toThrow("Thinker agent failed: Network error");
    });
  });

  describe("streamChat()", () => {
    it("throws error for empty message", async () => {
      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.streamChat("")).rejects.toThrow("Message cannot be empty");
    });

    it("calls provider streamChat with correct request", async () => {
      const mockStream = {
        id: "stream-id",
        model: "mimo-v2.5-pro",
        [Symbol.asyncIterator]: async function* () {
          yield { id: "chunk-1", model: "mimo-v2.5-pro", delta: { content: "Plan" }, finish_reason: null };
        },
      };

      mockStreamChatFn.mockResolvedValue(mockStream);

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();
      const stream = await thinker.streamChat("Create a plan");

      expect(mockStreamChatFn).toHaveBeenCalledTimes(1);
      expect(stream).toBeDefined();
    });

    it("re-throws provider errors on stream", async () => {
      const providerError = {
        code: "timeout",
        message: "Request timed out",
        retryable: true,
      };

      mockStreamChatFn.mockRejectedValue(providerError);

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.streamChat("Hello")).rejects.toEqual(providerError);
    });

    it("wraps unexpected errors on stream", async () => {
      mockStreamChatFn.mockRejectedValue(new Error("Connection lost"));

      const { ThinkerAgent } = await import("@/lib/agents/thinker");
      const thinker = new ThinkerAgent();

      await expect(thinker.streamChat("Hello")).rejects.toThrow(
        "Thinker agent stream failed: Connection lost"
      );
    });
  });
});
