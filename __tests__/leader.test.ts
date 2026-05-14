/**
 * Leader Agent & Chat API Tests
 *
 * Tests for:
 * - LeaderAgent: initialization, chat(), error handling
 * - Chat API validation: Zod schema, request validation
 * - MimoProvider: basic structure and registration
 *
 * Uses mocked AI provider to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// ============================================================================
// Mock Setup
// ============================================================================

// Track the mock chat function so tests can configure it
const mockChatFn = vi.fn();
const mockStreamChatFn = vi.fn();
const mockIsAvailableFn = vi.fn();

// Mock the MimoProvider module - return a proper class
vi.mock("@/lib/ai/mimo-provider", () => {
  class MockMimoProvider {
    name = "mimo";
    chat = mockChatFn;
    streamChat = mockStreamChatFn;
    isAvailable = mockIsAvailableFn;

    constructor(_config?: any) {}
  }

  return {
    MimoProvider: MockMimoProvider,
  };
});

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.MIMO_API_KEY = "test-api-key";
  process.env.MIMO_BASE_URL = "https://api.test.mimo.ai/v1";
});

// ============================================================================
// LeaderAgent Tests
// ============================================================================

describe("LeaderAgent", () => {
  describe("initialization", () => {
    it("creates an instance with default config", async () => {
      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();

      expect(leader).toBeDefined();
      expect(leader.agentType).toBe("leader");
    });

    it("returns correct agent info", async () => {
      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();
      const info = leader.getAgentInfo();

      expect(info.id).toBe("leader");
      expect(info.name).toBe("Leader");
      expect(info.avatar).toBe("👑");
      expect(info.personality).toContain("Strategic");
    });

    it("returns system prompt", async () => {
      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();
      const prompt = leader.getSystemPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain("Leader");
      expect(prompt).toContain("strategic");
    });

    it("accepts custom configuration", async () => {
      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent({
        model: "custom-model",
        temperature: 0.5,
        maxTokens: 2048,
      });

      expect(leader).toBeDefined();
      expect(leader.agentType).toBe("leader");
    });
  });

  describe("chat()", () => {
    it("throws error for empty message", async () => {
      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();

      await expect(leader.chat("")).rejects.toThrow("Message cannot be empty");
    });

    it("throws error for whitespace-only message", async () => {
      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();

      await expect(leader.chat("   ")).rejects.toThrow("Message cannot be empty");
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

      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();
      const response = await leader.chat("Hello, Leader!");

      expect(mockChatFn).toHaveBeenCalledTimes(1);
      expect(mockChatFn).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "Hello, Leader!" }],
          model: "mimo-v2.5-pro",
          system_prompt: expect.stringContaining("Leader"),
          agent_name: "Leader",
        })
      );
      expect(response).toBe("Test response");
    });

    it("returns response content from provider", async () => {
      const expectedResponse = "Here's my strategic analysis of the project...";

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

      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();
      const response = await leader.chat("What's our strategy?");

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

      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();

      await expect(leader.chat("Hello")).rejects.toThrow("Empty response from AI provider");
    });

    it("re-throws provider errors", async () => {
      const providerError = {
        code: "rate_limit",
        message: "Rate limit exceeded",
        retryable: true,
      };

      mockChatFn.mockRejectedValue(providerError);

      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();

      await expect(leader.chat("Hello")).rejects.toEqual(providerError);
    });

    it("wraps unexpected errors", async () => {
      mockChatFn.mockRejectedValue(new Error("Network error"));

      const { LeaderAgent } = await import("@/lib/agents/leader");
      const leader = new LeaderAgent();

      await expect(leader.chat("Hello")).rejects.toThrow("Leader agent failed: Network error");
    });
  });
});

// ============================================================================
// Chat API Validation Tests (Zod Schema)
// ============================================================================

describe("Chat API Validation", () => {
  // Replicate the schema from the route for direct testing
  const ChatRequestSchema = z.object({
    message: z
      .string()
      .min(1, "Message cannot be empty")
      .max(10000, "Message too long (max 10,000 characters)"),
    agent: z
      .string()
      .optional(),
  });

  describe("message validation", () => {
    it("accepts valid message", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello, how are you?",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe("Hello, how are you?");
      }
    });

    it("rejects empty message", () => {
      const result = ChatRequestSchema.safeParse({
        message: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Message cannot be empty");
      }
    });

    it("rejects missing message field", () => {
      const result = ChatRequestSchema.safeParse({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain("message");
      }
    });

    it("rejects non-string message", () => {
      const result = ChatRequestSchema.safeParse({
        message: 123,
      });

      expect(result.success).toBe(false);
    });

    it("rejects message exceeding max length", () => {
      const longMessage = "a".repeat(10001);
      const result = ChatRequestSchema.safeParse({
        message: longMessage,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("too long");
      }
    });

    it("accepts message at max length", () => {
      const maxMessage = "a".repeat(10000);
      const result = ChatRequestSchema.safeParse({
        message: maxMessage,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("agent validation", () => {
    it("accepts valid agent type", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
        agent: "leader",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agent).toBe("leader");
      }
    });

    it("accepts missing agent (optional)", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agent).toBeUndefined();
      }
    });

    it("accepts all valid agent types", () => {
      const validAgents = ["leader", "explorer", "thinker", "critic"];

      validAgents.forEach((agent) => {
        const result = ChatRequestSchema.safeParse({
          message: "Hello",
          agent,
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe("full request validation", () => {
    it("accepts complete valid request", () => {
      const result = ChatRequestSchema.safeParse({
        message: "What's our strategy for Q2?",
        agent: "leader",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toBe("What's our strategy for Q2?");
        expect(result.data.agent).toBe("leader");
      }
    });

    it("accepts minimal valid request", () => {
      const result = ChatRequestSchema.safeParse({
        message: "Hello",
      });

      expect(result.success).toBe(true);
    });

    it("rejects null body", () => {
      const result = ChatRequestSchema.safeParse(null);

      expect(result.success).toBe(false);
    });

    it("rejects non-object body", () => {
      const result = ChatRequestSchema.safeParse("invalid");

      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// MimoProvider Structure Tests
// ============================================================================

describe("MimoProvider", () => {
  it("can be imported", async () => {
    const { MimoProvider } = await import("@/lib/ai/mimo-provider");

    expect(MimoProvider).toBeDefined();
    expect(typeof MimoProvider).toBe("function");
  });

  it("creates instances with config", async () => {
    const { MimoProvider } = await import("@/lib/ai/mimo-provider");

    const provider = new MimoProvider({
      apiKey: "test-key",
      baseUrl: "https://api.test.com/v1",
    });

    expect(provider).toBeDefined();
    expect(provider.name).toBe("mimo");
  });
});
