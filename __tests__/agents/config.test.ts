/**
 * Agent Config Persistence Tests
 *
 * Tests for:
 * - getAgentConfig: load config from database with KV pairs
 * - getAllAgentConfigs: load all agent configs
 * - saveAgentConfig: persist config as KV pairs
 * - getDefaultAgentConfig: default fallback from personalities.ts
 * - getAgentConfigWithDefaults: merged config with fallback
 * - API GET /api/agents: returns all configs
 * - API PUT /api/agents: updates agent config
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    agent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    agentConfig: {
      upsert: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/db", () => ({ default: mockPrisma }));

import {
  getAgentConfig,
  getAllAgentConfigs,
  saveAgentConfig,
  getDefaultAgentConfig,
  getAgentConfigWithDefaults,
} from "@/lib/agents/config";
import { GET, PUT } from "@/app/api/agents/route";

// ──────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────

const leaderAgentRow = {
  id: "agent-uuid-leader",
  name: "Leader",
  personality: "Strategic visionary",
  model: "mimo-v2.5-pro",
  temperature: 0.7,
  createdAt: new Date("2025-01-01"),
};

const explorerAgentRow = {
  id: "agent-uuid-explorer",
  name: "Explorer",
  personality: "Tech researcher",
  model: "mimo-v2.5-pro",
  temperature: 0.7,
  createdAt: new Date("2025-01-01"),
};

function makeConfigRows(
  agentId: string,
  overrides: Record<string, string> = {},
): Array<{ id: string; agentId: string; configKey: string; configValue: string }> {
  const defaults: Record<string, string> = {
    name: "Leader",
    personality: "Strategic visionary who sees the big picture",
    systemPrompt: "You are the Leader...",
    model: "mimo-v2.5-pro",
    temperature: "0.7",
    avatar: "👑",
  };

  const merged = { ...defaults, ...overrides };

  return Object.entries(merged).map(([key, value], i) => ({
    id: `config-${agentId}-${i}`,
    agentId,
    configKey: key,
    configValue: value,
  }));
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Agent Config Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // getAgentConfig
  // =========================================================================

  describe("getAgentConfig", () => {
    it("returns config from database KV pairs", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        ...leaderAgentRow,
        agentConfigs: makeConfigRows("agent-uuid-leader", {
          name: "Custom Leader",
          temperature: "1.2",
        }),
      });

      const config = await getAgentConfig("leader");

      expect(config).toEqual({
        name: "Custom Leader",
        personality: "Strategic visionary who sees the big picture",
        systemPrompt: "You are the Leader...",
        model: "mimo-v2.5-pro",
        temperature: 1.2,
        avatar: "👑",
      });
    });

    it("returns null when agent not in database", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const config = await getAgentConfig("leader");

      expect(config).toBeNull();
    });

    it("returns null when no config entries exist", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        ...leaderAgentRow,
        agentConfigs: [],
      });

      const config = await getAgentConfig("leader");

      expect(config).toBeNull();
    });

    it("falls back to personality defaults for missing KV fields", async () => {
      // Only store model and temperature, missing name/personality/systemPrompt/avatar
      mockPrisma.agent.findUnique.mockResolvedValue({
        ...leaderAgentRow,
        agentConfigs: [
          {
            id: "cfg-1",
            agentId: "agent-uuid-leader",
            configKey: "model",
            configValue: "gpt-4",
          },
          {
            id: "cfg-2",
            agentId: "agent-uuid-leader",
            configKey: "temperature",
            configValue: "0.5",
          },
        ],
      });

      const config = await getAgentConfig("leader");

      expect(config).toEqual({
        name: "Leader", // from personalities.ts
        personality: "Strategic visionary who sees the big picture and coordinates the team", // from personalities.ts
        systemPrompt: expect.stringContaining("You are the Leader"), // from personalities.ts
        model: "gpt-4", // from DB
        temperature: 0.5, // from DB
        avatar: "👑", // from personalities.ts
      });
    });

    it("queries by agent name in database", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      await getAgentConfig("explorer");

      expect(mockPrisma.agent.findUnique).toHaveBeenCalledWith({
        where: { name: "Explorer" },
        include: { agentConfigs: true },
      });
    });
  });

  // =========================================================================
  // getAllAgentConfigs
  // =========================================================================

  describe("getAllAgentConfigs", () => {
    it("returns configs for all 4 agents", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const configs = await getAllAgentConfigs();

      expect(Object.keys(configs)).toEqual([
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);
      expect(configs.leader).toBeNull();
      expect(configs.explorer).toBeNull();
      expect(configs.thinker).toBeNull();
      expect(configs.critic).toBeNull();
    });

    it("returns mixed persisted and null configs", async () => {
      mockPrisma.agent.findUnique
        .mockResolvedValueOnce({
          ...leaderAgentRow,
          agentConfigs: makeConfigRows("agent-uuid-leader"),
        })
        .mockResolvedValueOnce(null) // explorer
        .mockResolvedValueOnce(null) // thinker
        .mockResolvedValueOnce(null); // critic

      const configs = await getAllAgentConfigs();

      expect(configs.leader).not.toBeNull();
      expect(configs.explorer).toBeNull();
      expect(configs.thinker).toBeNull();
      expect(configs.critic).toBeNull();
    });
  });

  // =========================================================================
  // saveAgentConfig
  // =========================================================================

  describe("saveAgentConfig", () => {
    it("creates agent record if not exists and saves all KV pairs", async () => {
      mockPrisma.agent.upsert.mockResolvedValue(leaderAgentRow);
      mockPrisma.agentConfig.upsert.mockResolvedValue({});

      await saveAgentConfig("leader", {
        name: "Custom Leader",
        personality: "Custom personality",
        systemPrompt: "Custom prompt",
        model: "gpt-4",
        temperature: 1.0,
        avatar: "🤖",
      });

      // Should upsert agent record
      expect(mockPrisma.agent.upsert).toHaveBeenCalledWith({
        where: { name: "Leader" },
        update: {},
        create: {
          name: "Leader",
          personality: "Custom personality",
          model: "gpt-4",
          temperature: 1.0,
        },
      });

      // Should upsert 6 config KV pairs
      expect(mockPrisma.agentConfig.upsert).toHaveBeenCalledTimes(6);
    });

    it("upserts each config key with correct compound unique", async () => {
      mockPrisma.agent.upsert.mockResolvedValue(leaderAgentRow);
      mockPrisma.agentConfig.upsert.mockResolvedValue({});

      await saveAgentConfig("leader", {
        name: "Test",
        personality: "Test personality",
        systemPrompt: "Test prompt",
        model: "mimo-v2.5-pro",
        temperature: 0.7,
        avatar: "👑",
      });

      // Check each KV pair upsert
      const upsertCalls = mockPrisma.agentConfig.upsert.mock.calls;

      expect(upsertCalls[0][0]).toEqual({
        where: {
          agentId_configKey: {
            agentId: "agent-uuid-leader",
            configKey: "name",
          },
        },
        update: { configValue: "Test" },
        create: {
          agentId: "agent-uuid-leader",
          configKey: "name",
          configValue: "Test",
        },
      });

      expect(upsertCalls[4][0]).toEqual({
        where: {
          agentId_configKey: {
            agentId: "agent-uuid-leader",
            configKey: "temperature",
          },
        },
        update: { configValue: "0.7" },
        create: {
          agentId: "agent-uuid-leader",
          configKey: "temperature",
          configValue: "0.7",
        },
      });
    });

    it("saves to correct agent for each agent type", async () => {
      mockPrisma.agent.upsert.mockResolvedValue(explorerAgentRow);
      mockPrisma.agentConfig.upsert.mockResolvedValue({});

      await saveAgentConfig("explorer", {
        name: "Custom Explorer",
        personality: "Custom",
        systemPrompt: "Custom",
        model: "mimo-v2.5-pro",
        temperature: 0.7,
        avatar: "🔍",
      });

      expect(mockPrisma.agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: "Explorer" } }),
      );
    });

    it("does not modify existing agent fields on save", async () => {
      mockPrisma.agent.upsert.mockResolvedValue(leaderAgentRow);
      mockPrisma.agentConfig.upsert.mockResolvedValue({});

      await saveAgentConfig("leader", {
        name: "New Name",
        personality: "New personality",
        systemPrompt: "New prompt",
        model: "new-model",
        temperature: 1.5,
        avatar: "🤖",
      });

      // Agent upsert should use empty update (don't modify agent table)
      expect(mockPrisma.agent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
    });
  });

  // =========================================================================
  // getDefaultAgentConfig
  // =========================================================================

  describe("getDefaultAgentConfig", () => {
    it("returns leader defaults from personalities.ts", () => {
      const config = getDefaultAgentConfig("leader");

      expect(config.name).toBe("Leader");
      expect(config.personality).toContain("Strategic visionary");
      expect(config.systemPrompt).toContain("You are the Leader");
      expect(config.model).toBe("mimo-v2.5-pro");
      expect(config.temperature).toBe(0.7);
      expect(config.avatar).toBe("👑");
    });

    it("returns explorer defaults", () => {
      const config = getDefaultAgentConfig("explorer");

      expect(config.name).toBe("Explorer");
      expect(config.personality).toContain("Tech researcher");
      expect(config.avatar).toBe("🔍");
    });

    it("returns thinker defaults", () => {
      const config = getDefaultAgentConfig("thinker");

      expect(config.name).toBe("Thinker");
      expect(config.personality).toContain("Task planner");
      expect(config.avatar).toBe("🧠");
    });

    it("returns critic defaults", () => {
      const config = getDefaultAgentConfig("critic");

      expect(config.name).toBe("Critic");
      expect(config.personality).toContain("Detail-oriented challenger");
      expect(config.avatar).toBe("🎯");
    });
  });

  // =========================================================================
  // getAgentConfigWithDefaults
  // =========================================================================

  describe("getAgentConfigWithDefaults", () => {
    it("returns persisted config when available", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        ...leaderAgentRow,
        agentConfigs: makeConfigRows("agent-uuid-leader", {
          name: "Custom Leader",
        }),
      });

      const config = await getAgentConfigWithDefaults("leader");

      expect(config.name).toBe("Custom Leader");
    });

    it("returns defaults when no persisted config", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const config = await getAgentConfigWithDefaults("leader");

      expect(config.name).toBe("Leader");
      expect(config.personality).toContain("Strategic visionary");
      expect(config.model).toBe("mimo-v2.5-pro");
    });

    it("returns defaults when agent exists but no config entries", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        ...leaderAgentRow,
        agentConfigs: [],
      });

      const config = await getAgentConfigWithDefaults("leader");

      expect(config.name).toBe("Leader");
      expect(config.avatar).toBe("👑");
    });

    it("never returns null", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const config = await getAgentConfigWithDefaults("critic");

      expect(config).not.toBeNull();
      expect(config.name).toBe("Critic");
    });
  });

  // =========================================================================
  // API: GET /api/agents
  // =========================================================================

  describe("GET /api/agents", () => {
    it("returns all agent configs with defaults", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const response = await GET();
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty("leader");
      expect(body.data).toHaveProperty("explorer");
      expect(body.data).toHaveProperty("thinker");
      expect(body.data).toHaveProperty("critic");
    });

    it("each agent has complete config fields", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const response = await GET();
      const body = await response.json();

      for (const agentType of ["leader", "explorer", "thinker", "critic"]) {
        const config = body.data[agentType];
        expect(config).toHaveProperty("name");
        expect(config).toHaveProperty("personality");
        expect(config).toHaveProperty("systemPrompt");
        expect(config).toHaveProperty("model");
        expect(config).toHaveProperty("temperature");
        expect(config).toHaveProperty("avatar");
      }
    });

    it("includes persisted config when available", async () => {
      mockPrisma.agent.findUnique
        .mockResolvedValueOnce({
          ...leaderAgentRow,
          agentConfigs: makeConfigRows("agent-uuid-leader", {
            name: "Custom Leader",
          }),
        })
        .mockResolvedValue(null);

      const response = await GET();
      const body = await response.json();

      expect(body.data.leader.name).toBe("Custom Leader");
    });

    it("returns 500 on database error", async () => {
      mockPrisma.agent.findUnique.mockRejectedValue(new Error("DB error"));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Internal server error");
    });
  });

  // =========================================================================
  // API: PUT /api/agents
  // =========================================================================

  describe("PUT /api/agents", () => {
    function makePutRequest(body: unknown): Request {
      return new Request("http://localhost/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    const validBody = {
      agentId: "leader",
      name: "Custom Leader",
      personality: "Custom personality",
      systemPrompt: "Custom system prompt",
      model: "mimo-v2.5-pro",
      temperature: 0.7,
      avatar: "👑",
    };

    it("saves config and returns success", async () => {
      mockPrisma.agent.upsert.mockResolvedValue(leaderAgentRow);
      mockPrisma.agentConfig.upsert.mockResolvedValue({});

      const response = await PUT(makePutRequest(validBody));
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(mockPrisma.agentConfig.upsert).toHaveBeenCalledTimes(6);
    });

    it("returns 400 for invalid JSON", async () => {
      const request = new Request("http://localhost/api/agents", {
        method: "PUT",
        body: "not-json",
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Invalid JSON in request body");
    });

    it("returns 400 for missing required fields", async () => {
      const response = await PUT(
        makePutRequest({ agentId: "leader" }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Validation failed");
      expect(body.details).toBeDefined();
    });

    it("returns 400 for empty name", async () => {
      const response = await PUT(
        makePutRequest({ ...validBody, name: "" }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Validation failed");
    });

    it("returns 400 for temperature out of range", async () => {
      const response = await PUT(
        makePutRequest({ ...validBody, temperature: 3.0 }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Validation failed");
    });

    it("returns 400 for negative temperature", async () => {
      const response = await PUT(
        makePutRequest({ ...validBody, temperature: -0.1 }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Validation failed");
    });

    it("returns 400 for invalid agent ID", async () => {
      const response = await PUT(
        makePutRequest({ ...validBody, agentId: "unknown" }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain("Invalid agent ID");
    });

    it("returns 500 on database error", async () => {
      mockPrisma.agent.upsert.mockRejectedValue(new Error("DB error"));

      const response = await PUT(makePutRequest(validBody));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Internal server error");
    });

    it("validates agentId is not empty", async () => {
      const response = await PUT(
        makePutRequest({ ...validBody, agentId: "" }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe("Validation failed");
    });

    it("accepts all valid agent types", async () => {
      mockPrisma.agent.upsert.mockResolvedValue(leaderAgentRow);
      mockPrisma.agentConfig.upsert.mockResolvedValue({});

      for (const agentType of ["leader", "explorer", "thinker", "critic"]) {
        vi.clearAllMocks();
        mockPrisma.agent.upsert.mockResolvedValue({ ...leaderAgentRow, name: agentType });
        mockPrisma.agentConfig.upsert.mockResolvedValue({});

        const response = await PUT(
          makePutRequest({ ...validBody, agentId: agentType }),
        );
        const body = await response.json();

        expect(body.success).toBe(true);
      }
    });
  });
});
