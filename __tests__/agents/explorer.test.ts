/**
 * Explorer Agent Tests
 *
 * Tests for ExplorerAgent: initialization, chat(), streamChat(), error handling.
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
// ExplorerAgent Tests
// ============================================================================

describe("ExplorerAgent", () => {
  describe("initialization", () => {
    it("creates an instance with default config", async () => {
      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      expect(explorer).toBeDefined();
      expect(explorer.agentType).toBe("explorer");
    });

    it("returns correct agent info", async () => {
      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();
      const info = explorer.getAgentInfo();

      expect(info.id).toBe("explorer");
      expect(info.name).toBe("Explorer");
      expect(info.avatar).toBe("🔍");
      expect(info.personality).toContain("researcher");
    });

    it("returns system prompt", async () => {
      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();
      const prompt = explorer.getSystemPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain("Explorer");
      expect(prompt).toContain("research");
    });

    it("accepts custom configuration", async () => {
      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent({
        model: "custom-model",
        temperature: 0.5,
        maxTokens: 2048,
      });

      expect(explorer).toBeDefined();
      expect(explorer.agentType).toBe("explorer");
    });
  });

  describe("chat()", () => {
    it("throws error for empty message", async () => {
      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.chat("")).rejects.toThrow("Message cannot be empty");
    });

    it("throws error for whitespace-only message", async () => {
      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.chat("   ")).rejects.toThrow("Message cannot be empty");
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

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();
      const response = await explorer.chat("What technologies should we use?");

      expect(mockChatFn).toHaveBeenCalledTimes(1);
      expect(mockChatFn).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "What technologies should we use?" }],
          model: "mimo-v2.5-pro",
          system_prompt: expect.stringContaining("Explorer"),
          agent_name: "Explorer",
        })
      );
      expect(response).toBe("Test response");
    });

    it("returns response content from provider", async () => {
      const expectedResponse = "Here are the top frameworks to consider...";

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

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();
      const response = await explorer.chat("What frameworks exist?");

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

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.chat("Hello")).rejects.toThrow("Empty response from AI provider");
    });

    it("re-throws provider errors", async () => {
      const providerError = {
        code: "rate_limit",
        message: "Rate limit exceeded",
        retryable: true,
      };

      mockChatFn.mockRejectedValue(providerError);

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.chat("Hello")).rejects.toEqual(providerError);
    });

    it("wraps unexpected errors", async () => {
      mockChatFn.mockRejectedValue(new Error("Network error"));

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.chat("Hello")).rejects.toThrow("Explorer agent failed: Network error");
    });
  });

  describe("streamChat()", () => {
    it("throws error for empty message", async () => {
      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.streamChat("")).rejects.toThrow("Message cannot be empty");
    });

    it("calls provider streamChat with correct request", async () => {
      const mockStream = {
        id: "stream-id",
        model: "mimo-v2.5-pro",
        [Symbol.asyncIterator]: async function* () {
          yield { id: "chunk-1", model: "mimo-v2.5-pro", delta: { content: "Hello" }, finish_reason: null };
        },
      };

      mockStreamChatFn.mockResolvedValue(mockStream);

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();
      const stream = await explorer.streamChat("Research topic");

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

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.streamChat("Hello")).rejects.toEqual(providerError);
    });

    it("wraps unexpected errors on stream", async () => {
      mockStreamChatFn.mockRejectedValue(new Error("Connection lost"));

      const { ExplorerAgent } = await import("@/lib/agents/explorer");
      const explorer = new ExplorerAgent();

      await expect(explorer.streamChat("Hello")).rejects.toThrow(
        "Explorer agent stream failed: Connection lost"
      );
    });
  });
});
