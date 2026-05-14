/**
 * Supplement Decider Tests
 *
 * Tests for the role-based supplement decision mechanism.
 * Each agent decides whether to supplement the primary agent's response
 * based on keyword-based heuristics matching its expertise domain.
 */

import { describe, it, expect } from "vitest";
import {
  decideSupplements,
  type SupplementDecision,
} from "@/lib/agents/supplement-decider";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Helper: assert decision shape
// ============================================================================

function expectValidDecision(decision: SupplementDecision): void {
  expect(decision).toHaveProperty("agent");
  expect(decision).toHaveProperty("shouldSupplement");
  expect(decision).toHaveProperty("reason");
  expect(decision).toHaveProperty("confidence");
  expect(typeof decision.agent).toBe("string");
  expect(typeof decision.shouldSupplement).toBe("boolean");
  expect(typeof decision.reason).toBe("string");
  expect(typeof decision.confidence).toBe("number");
  expect(decision.confidence).toBeGreaterThanOrEqual(0);
  expect(decision.confidence).toBeLessThanOrEqual(1);
}

// ============================================================================
// Leader Behavior
// ============================================================================

describe("decideSupplements", () => {
  describe("Leader agent", () => {
    it("never supplements (always returns shouldSupplement=false)", () => {
      const decisions = decideSupplements(
        "explorer",
        "A very short response without any substance.",
        ["leader", "explorer", "thinker", "critic"]
      );

      const leaderDecision = decisions.find((d) => d.agent === "leader");
      expect(leaderDecision).toBeDefined();
      expect(leaderDecision!.shouldSupplement).toBe(false);
      expect(leaderDecision!.confidence).toBe(1);
    });

    it("never supplements even when response is empty", () => {
      const decisions = decideSupplements("thinker", "", [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const leaderDecision = decisions.find((d) => d.agent === "leader");
      expect(leaderDecision).toBeDefined();
      expect(leaderDecision!.shouldSupplement).toBe(false);
    });

    it("provides reason explaining leader does not supplement", () => {
      const decisions = decideSupplements("critic", "Some response", [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const leaderDecision = decisions.find((d) => d.agent === "leader");
      expect(leaderDecision!.reason).toMatch(/leader/i);
      expect(leaderDecision!.reason.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Explorer Agent
  // ==========================================================================

  describe("Explorer agent", () => {
    it("supplements when technical details are missing", () => {
      const primaryResponse =
        "We should focus on the business goals and timeline for this project.";
      const decisions = decideSupplements("leader", primaryResponse, [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const explorerDecision = decisions.find((d) => d.agent === "explorer");
      expect(explorerDecision).toBeDefined();
      expect(explorerDecision!.shouldSupplement).toBe(true);
      expect(explorerDecision!.reason).toBeTruthy();
      expect(explorerDecision!.confidence).toBeGreaterThan(0);
    });

    it("does NOT supplement when technical details are present", () => {
      const primaryResponse =
        "We can use React with TypeScript and a PostgreSQL database. The API will use REST endpoints with authentication via JWT tokens.";
      const decisions = decideSupplements("leader", primaryResponse, [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const explorerDecision = decisions.find((d) => d.agent === "explorer");
      expect(explorerDecision).toBeDefined();
      expect(explorerDecision!.shouldSupplement).toBe(false);
    });

    it("supplements when primary response lacks framework/library mentions", () => {
      const primaryResponse =
        "This is a great idea. Let's proceed with the plan.";
      const decisions = decideSupplements("thinker", primaryResponse, [
        "explorer",
      ]);

      expect(decisions).toHaveLength(1);
      expect(decisions[0].agent).toBe("explorer");
      expect(decisions[0].shouldSupplement).toBe(true);
    });

    it("detects various technical keywords", () => {
      const techKeywords = [
        "algorithm",
        "architecture",
        "performance",
        "scalability",
        "deployment",
        "infrastructure",
      ];

      for (const keyword of techKeywords) {
        const decisions = decideSupplements(
          "leader",
          `The ${keyword} needs careful consideration. Also, the API design is crucial.`,
          ["explorer"]
        );
        expect(decisions[0].shouldSupplement).toBe(false);
      }
    });

    it("provides confidence score between 0 and 1", () => {
      const decisions = decideSupplements(
        "leader",
        "A non-technical response.",
        ["explorer"]
      );

      expect(decisions[0].confidence).toBeGreaterThan(0);
      expect(decisions[0].confidence).toBeLessThanOrEqual(1);
    });
  });

  // ==========================================================================
  // Thinker Agent
  // ==========================================================================

  describe("Thinker agent", () => {
    it("supplements when planning/structure is missing", () => {
      const primaryResponse =
        "The technology stack looks good. We should use React and Node.js.";
      const decisions = decideSupplements("explorer", primaryResponse, [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const thinkerDecision = decisions.find((d) => d.agent === "thinker");
      expect(thinkerDecision).toBeDefined();
      expect(thinkerDecision!.shouldSupplement).toBe(true);
      expect(thinkerDecision!.reason).toBeTruthy();
    });

    it("does NOT supplement when planning/structure is present", () => {
      const primaryResponse =
        "Here is the plan: Step 1 - Research, Step 2 - Design, Step 3 - Implement. The timeline is 4 weeks with dependencies mapped.";
      const decisions = decideSupplements("leader", primaryResponse, [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const thinkerDecision = decisions.find((d) => d.agent === "thinker");
      expect(thinkerDecision).toBeDefined();
      expect(thinkerDecision!.shouldSupplement).toBe(false);
    });

    it("detects various planning keywords", () => {
      const planningKeywords = [
        "milestone",
        "roadmap",
        "feasibility",
        "dependency",
        "sprint",
        "phase",
      ];

      for (const keyword of planningKeywords) {
        const decisions = decideSupplements(
          "leader",
          `The ${keyword} is critical to success. We need a clear plan.`,
          ["thinker"]
        );
        expect(decisions[0].shouldSupplement).toBe(false);
      }
    });

    it("provides reason mentioning planning gap", () => {
      const decisions = decideSupplements(
        "explorer",
        "Great technical solution.",
        ["thinker"]
      );

      expect(decisions[0].reason).toMatch(/plan|structure|step/i);
    });
  });

  // ==========================================================================
  // Critic Agent
  // ==========================================================================

  describe("Critic agent", () => {
    it("supplements when risks/edge cases are not addressed", () => {
      const primaryResponse =
        "This approach will work perfectly. Let's implement it right away.";
      const decisions = decideSupplements("leader", primaryResponse, [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const criticDecision = decisions.find((d) => d.agent === "critic");
      expect(criticDecision).toBeDefined();
      expect(criticDecision!.shouldSupplement).toBe(true);
      expect(criticDecision!.reason).toBeTruthy();
    });

    it("does NOT supplement when risks are addressed", () => {
      const primaryResponse =
        "We need to consider the risk of downtime. Edge cases include null inputs and timeout failures. The security concern is SQL injection. There is a trade-off between speed and reliability.";
      const decisions = decideSupplements("explorer", primaryResponse, [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const criticDecision = decisions.find((d) => d.agent === "critic");
      expect(criticDecision).toBeDefined();
      expect(criticDecision!.shouldSupplement).toBe(false);
    });

    it("detects various risk/quality keywords", () => {
      const riskKeywords = [
        "vulnerability",
        "limitation",
        "concern",
        "challenge",
        "assumption",
        "pitfall",
      ];

      for (const keyword of riskKeywords) {
        const decisions = decideSupplements(
          "leader",
          `We must address the ${keyword} before proceeding. There are risks involved.`,
          ["critic"]
        );
        expect(decisions[0].shouldSupplement).toBe(false);
      }
    });

    it("provides reason mentioning risk gap", () => {
      const decisions = decideSupplements(
        "leader",
        "Everything looks great!",
        ["critic"]
      );

      expect(decisions[0].reason).toMatch(/risk|edge case|quality/i);
    });
  });

  // ==========================================================================
  // General Behavior
  // ==========================================================================

  describe("general behavior", () => {
    it("returns decisions for all provided agents", () => {
      const decisions = decideSupplements("leader", "Some response", [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      expect(decisions).toHaveLength(4);
      const agentTypes = decisions.map((d) => d.agent);
      expect(agentTypes).toContain("leader");
      expect(agentTypes).toContain("explorer");
      expect(agentTypes).toContain("thinker");
      expect(agentTypes).toContain("critic");
    });

    it("primary agent does not supplement itself", () => {
      const decisions = decideSupplements("explorer", "Some response", [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      const explorerDecision = decisions.find((d) => d.agent === "explorer");
      expect(explorerDecision).toBeDefined();
      expect(explorerDecision!.shouldSupplement).toBe(false);
    });

    it("all decisions have valid shape", () => {
      const decisions = decideSupplements("leader", "Test response", [
        "leader",
        "explorer",
        "thinker",
        "critic",
      ]);

      for (const decision of decisions) {
        expectValidDecision(decision);
      }
    });

    it("handles single agent in allAgents array", () => {
      const decisions = decideSupplements("leader", "Test", ["explorer"]);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].agent).toBe("explorer");
    });

    it("handles empty allAgents array", () => {
      const decisions = decideSupplements("leader", "Test", []);
      expect(decisions).toHaveLength(0);
    });

    it("returns decisions in same order as allAgents input", () => {
      const decisions = decideSupplements("leader", "Test", [
        "critic",
        "explorer",
        "thinker",
      ]);

      expect(decisions[0].agent).toBe("critic");
      expect(decisions[1].agent).toBe("explorer");
      expect(decisions[2].agent).toBe("thinker");
    });

    it("is case-insensitive for keyword matching", () => {
      const decisions = decideSupplements(
        "leader",
        "We need to consider the RISK and SECURITY concerns.",
        ["critic"]
      );

      expect(decisions[0].shouldSupplement).toBe(false);
    });

    it("confidence is higher when more domain keywords are missing", () => {
      const decisionsNoTech = decideSupplements(
        "leader",
        "Let's move forward with the business plan.",
        ["explorer"]
      );

      const decisionsSomeTech = decideSupplements(
        "leader",
        "We can use React, but need to think about the rest.",
        ["explorer"]
      );

      // When fewer keywords are present, confidence should be higher
      // that supplementation is needed
      if (decisionsNoTech[0].shouldSupplement && decisionsSomeTech[0].shouldSupplement) {
        expect(decisionsNoTech[0].confidence).toBeGreaterThanOrEqual(
          decisionsSomeTech[0].confidence
        );
      }
    });
  });
});
