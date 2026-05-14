/**
 * Agent Personalities Tests
 *
 * Tests for the agent personality system including:
 * - getAgentByName: retrieves agent by type
 * - getAllAgents: returns all agents
 * - isValidAgentType: validates agent type strings
 */

import { describe, it, expect } from "vitest";
import {
  getAgentByName,
  getAllAgents,
  isValidAgentType,
} from "@/lib/agents/personalities";
import { EXPECTED_AGENT_NAMES, EXPECTED_AGENT_COUNT } from "./utils/test-helpers";
import type { AgentType } from "@/types/agent";

describe("Agent Personalities", () => {
  // ==========================================================================
  // getAgentByName
  // ==========================================================================

  describe("getAgentByName", () => {
    it("returns the Leader agent for 'leader'", () => {
      const agent = getAgentByName("leader");

      expect(agent.id).toBe("leader");
      expect(agent.name).toBe("Leader");
      expect(agent.personality).toContain("Strategic");
      expect(agent.avatar).toBe("👑");
      expect(agent.systemPrompt).toBeDefined();
      expect(agent.systemPrompt.length).toBeGreaterThan(0);
    });

    it("returns the Explorer agent for 'explorer'", () => {
      const agent = getAgentByName("explorer");

      expect(agent.id).toBe("explorer");
      expect(agent.name).toBe("Explorer");
      expect(agent.personality).toContain("researcher");
      expect(agent.avatar).toBe("🔍");
      expect(agent.systemPrompt).toBeDefined();
    });

    it("returns the Thinker agent for 'thinker'", () => {
      const agent = getAgentByName("thinker");

      expect(agent.id).toBe("thinker");
      expect(agent.name).toBe("Thinker");
      expect(agent.personality).toContain("planner");
      expect(agent.avatar).toBe("🧠");
      expect(agent.systemPrompt).toBeDefined();
    });

    it("returns the Critic agent for 'critic'", () => {
      const agent = getAgentByName("critic");

      expect(agent.id).toBe("critic");
      expect(agent.name).toBe("Critic");
      expect(agent.personality).toContain("challenger");
      expect(agent.avatar).toBe("🎯");
      expect(agent.systemPrompt).toBeDefined();
    });

    it("returns consistent results on multiple calls", () => {
      const first = getAgentByName("leader");
      const second = getAgentByName("leader");

      expect(first).toEqual(second);
    });
  });

  // ==========================================================================
  // getAllAgents
  // ==========================================================================

  describe("getAllAgents", () => {
    it("returns exactly 4 agents", () => {
      const agents = getAllAgents();

      expect(agents).toHaveLength(EXPECTED_AGENT_COUNT);
    });

    it("returns all expected agent types", () => {
      const agents = getAllAgents();
      const agentIds = agents.map((a) => a.id);

      EXPECTED_AGENT_NAMES.forEach((name) => {
        expect(agentIds).toContain(name);
      });
    });

    it("each agent has required fields", () => {
      const agents = getAllAgents();

      agents.forEach((agent) => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.personality).toBeDefined();
        expect(agent.avatar).toBeDefined();
        expect(agent.systemPrompt).toBeDefined();
      });
    });

    it("all agents have unique IDs", () => {
      const agents = getAllAgents();
      const ids = agents.map((a) => a.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(agents.length);
    });

    it("all agents have unique avatars", () => {
      const agents = getAllAgents();
      const avatars = agents.map((a) => a.avatar);
      const uniqueAvatars = new Set(avatars);

      expect(uniqueAvatars.size).toBe(agents.length);
    });
  });

  // ==========================================================================
  // isValidAgentType
  // ==========================================================================

  describe("isValidAgentType", () => {
    it.each(EXPECTED_AGENT_NAMES)(
      "returns true for valid agent type '%s'",
      (name) => {
        expect(isValidAgentType(name)).toBe(true);
      }
    );

    it.each(["unknown", "admin", "", "LEADER", "Explorer"])(
      "returns false for invalid agent type '%s'",
      (name) => {
        expect(isValidAgentType(name)).toBe(false);
      }
    );

    it("narrows type correctly with TypeScript", () => {
      const input: string = "leader";

      if (isValidAgentType(input)) {
        // TypeScript should narrow this to AgentType
        const agent = getAgentByName(input);
        expect(agent.id).toBe("leader");
      }
    });
  });
});
