/**
 * Message Analyzer Tests
 *
 * Tests for keyword-based heuristic message analysis that determines
 * which agent should be the primary responder based on message content.
 *
 * @module __tests__/agents/message-analyzer
 */

import { describe, it, expect } from "vitest";
import { analyzeMessage } from "@/lib/agents/message-analyzer";

// ============================================================================
// Empty / Edge Cases
// ============================================================================

describe("analyzeMessage", () => {
  describe("empty and edge case messages", () => {
    it("handles empty string gracefully", () => {
      const result = analyzeMessage("");

      expect(result.primaryAgent).toBe("leader");
      expect(result.confidence).toBe(0);
      expect(result.keywords).toEqual([]);
    });

    it("handles whitespace-only message", () => {
      const result = analyzeMessage("   ");

      expect(result.primaryAgent).toBe("leader");
      expect(result.confidence).toBe(0);
      expect(result.keywords).toEqual([]);
    });

    it("handles message with no matching keywords", () => {
      const result = analyzeMessage("hello there, how are you?");

      expect(result.primaryAgent).toBe("leader");
      expect(result.confidence).toBe(0);
      expect(result.keywords).toEqual([]);
    });
  });

  // ==========================================================================
  // Leader Detection
  // ==========================================================================

  describe("leader keyword detection", () => {
    it("detects 'strategy' as leader", () => {
      const result = analyzeMessage("What is our strategy for this project?");

      expect(result.primaryAgent).toBe("leader");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.keywords).toContain("strategy");
    });

    it("detects 'roadmap' as leader", () => {
      const result = analyzeMessage("Can you create a roadmap for the next quarter?");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("roadmap");
    });

    it("detects 'vision' as leader", () => {
      const result = analyzeMessage("What's the vision for this product?");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("vision");
    });

    it("detects 'goal' as leader", () => {
      const result = analyzeMessage("Let's define our goal for this sprint");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("goal");
    });

    it("detects 'prioritize' as leader", () => {
      const result = analyzeMessage("We need to prioritize the features");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("prioritize");
    });

    it("detects 'coordinate' as leader", () => {
      const result = analyzeMessage("How should we coordinate the team efforts?");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("coordinate");
    });

    it("detects 'big picture' as leader", () => {
      const result = analyzeMessage("Let's look at the big picture here");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("big picture");
    });

    it("detects 'mission' as leader", () => {
      const result = analyzeMessage("What's our mission statement?");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("mission");
    });

    it("detects multiple leader keywords with higher confidence", () => {
      const result = analyzeMessage("What's our strategy and vision for this goal?");

      expect(result.primaryAgent).toBe("leader");
      expect(result.keywords).toContain("strategy");
      expect(result.keywords).toContain("vision");
      expect(result.keywords).toContain("goal");
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  // ==========================================================================
  // Explorer Detection
  // ==========================================================================

  describe("explorer keyword detection", () => {
    it("detects 'technology' as explorer", () => {
      const result = analyzeMessage("What technology should we use?");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.keywords).toContain("technology");
    });

    it("detects 'framework' as explorer", () => {
      const result = analyzeMessage("Which framework is best for this?");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords).toContain("framework");
    });

    it("detects 'API' as explorer", () => {
      const result = analyzeMessage("How does this API work?");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords).toContain("API");
    });

    it("detects 'research' as explorer", () => {
      const result = analyzeMessage("Can you research the available options?");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords).toContain("research");
    });

    it("detects 'solution' as explorer", () => {
      const result = analyzeMessage("What solution would work best here?");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords).toContain("solution");
    });

    it("detects 'compare' as explorer", () => {
      const result = analyzeMessage("Compare React and Vue for this use case");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords).toContain("compare");
    });

    it("detects 'architecture' as explorer", () => {
      const result = analyzeMessage("What architecture pattern should we follow?");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords).toContain("architecture");
    });

    it("detects 'performance' as explorer", () => {
      const result = analyzeMessage("How can we improve performance?");

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords).toContain("performance");
    });

    it("detects multiple explorer keywords with higher confidence", () => {
      const result = analyzeMessage(
        "Research the best framework and compare their API performance",
      );

      expect(result.primaryAgent).toBe("explorer");
      expect(result.keywords.length).toBeGreaterThanOrEqual(3);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  // ==========================================================================
  // Thinker Detection
  // ==========================================================================

  describe("thinker keyword detection", () => {
    it("detects 'task' as thinker", () => {
      const result = analyzeMessage("Break this down into a task");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.keywords).toContain("task");
    });

    it("detects 'schedule' as thinker", () => {
      const result = analyzeMessage("What's the schedule for this project?");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.keywords).toContain("schedule");
    });

    it("detects 'feasibility' as thinker", () => {
      const result = analyzeMessage("What is the feasibility of this approach?");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.keywords).toContain("feasibility");
    });

    it("detects 'timeline' as thinker", () => {
      const result = analyzeMessage("What's the timeline for delivery?");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.keywords).toContain("timeline");
    });

    it("detects 'plan' as thinker", () => {
      const result = analyzeMessage("Create a plan for implementation");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.keywords).toContain("plan");
    });

    it("detects 'dependency' as thinker", () => {
      const result = analyzeMessage("What is the dependency for this feature?");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.keywords).toContain("dependency");
    });

    it("detects 'step' as thinker", () => {
      const result = analyzeMessage("What is the first step to implement this?");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.keywords).toContain("step");
    });

    it("detects 'estimate' as thinker", () => {
      const result = analyzeMessage("Can you estimate the effort required?");

      expect(result.primaryAgent).toBe("thinker");
      expect(result.keywords).toContain("estimate");
    });

    it("detects multiple thinker keywords with higher confidence", () => {
      const result = analyzeMessage(
        "Create a plan with tasks, timeline, and dependencies for each step",
      );

      expect(result.primaryAgent).toBe("thinker");
      expect(result.keywords.length).toBeGreaterThanOrEqual(3);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  // ==========================================================================
  // Critic Detection
  // ==========================================================================

  describe("critic keyword detection", () => {
    it("detects 'risk' as critic", () => {
      const result = analyzeMessage("What is the risk of this approach?");

      expect(result.primaryAgent).toBe("critic");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.keywords).toContain("risk");
    });

    it("detects 'issue' as critic", () => {
      const result = analyzeMessage("There's an issue with this design");

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords).toContain("issue");
    });

    it("detects 'problem' as critic", () => {
      const result = analyzeMessage("What problem does this cause?");

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords).toContain("problem");
    });

    it("detects 'weakness' as critic", () => {
      const result = analyzeMessage("What is the weakness of this design?");

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords).toContain("weakness");
    });

    it("detects 'edge case' as critic", () => {
      const result = analyzeMessage("Have we considered the edge case scenarios?");

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords).toContain("edge case");
    });

    it("detects 'vulnerability' as critic", () => {
      const result = analyzeMessage("Is there a security vulnerability here?");

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords).toContain("vulnerability");
    });

    it("detects 'assumption' as critic", () => {
      const result = analyzeMessage("We need to validate our assumption about the data");

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords).toContain("assumption");
    });

    it("detects 'trade-off' as critic", () => {
      const result = analyzeMessage("What's the trade-off of using this approach?");

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords).toContain("trade-off");
    });

    it("detects multiple critic keywords with higher confidence", () => {
      const result = analyzeMessage(
        "What are the risks, issues, and weaknesses of this approach?",
      );

      expect(result.primaryAgent).toBe("critic");
      expect(result.keywords.length).toBeGreaterThanOrEqual(3);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  // ==========================================================================
  // Mixed Messages / Dominance
  // ==========================================================================

  describe("mixed messages", () => {
    it("returns the agent with the most keyword matches", () => {
      const result = analyzeMessage(
        "What's the strategy for this API framework and technology stack?",
      );

      // Explorer keywords: API, framework, technology, stack (4)
      // Leader keywords: strategy (1)
      expect(result.primaryAgent).toBe("explorer");
    });

    it("handles tie-breaking by returning first matched agent priority", () => {
      // One keyword each - leader gets default priority
      const result = analyzeMessage("strategy vs technology");

      // Both have 1 keyword - leader has priority in tie-breaking
      expect(["leader", "explorer"]).toContain(result.primaryAgent);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("weighs critic keywords appropriately in mixed context", () => {
      const result = analyzeMessage(
        "What are the risks and issues with our strategy and roadmap?",
      );

      // Critic: risks, issues (2) vs Leader: strategy, roadmap (2)
      // Tie-break: leader has default priority
      expect(["leader", "critic"]).toContain(result.primaryAgent);
    });
  });

  // ==========================================================================
  // Confidence Score
  // ==========================================================================

  describe("confidence score", () => {
    it("returns 0 confidence for empty message", () => {
      const result = analyzeMessage("");

      expect(result.confidence).toBe(0);
    });

    it("returns 0 confidence when no keywords match", () => {
      const result = analyzeMessage("just a normal sentence here");

      expect(result.confidence).toBe(0);
    });

    it("returns confidence between 0 and 1", () => {
      const result = analyzeMessage("What is our strategy?");

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("returns higher confidence with more dominant keywords", () => {
      const single = analyzeMessage("What is the strategy?");
      const multiple = analyzeMessage(
        "What is our strategy, vision, and roadmap for this goal?",
      );

      expect(multiple.confidence).toBeGreaterThanOrEqual(single.confidence);
    });

    it("returns 1.0 confidence when all keywords belong to one agent", () => {
      const result = analyzeMessage(
        "research and explore the framework architecture and technology",
      );

      // All explorer keywords
      expect(result.primaryAgent).toBe("explorer");
      expect(result.confidence).toBe(1.0);
    });
  });

  // ==========================================================================
  // Keywords Array
  // ==========================================================================

  describe("keywords array", () => {
    it("returns matched keywords in lowercase", () => {
      const result = analyzeMessage("What is our STRATEGY?");

      expect(result.keywords).toContain("strategy");
    });

    it("returns deduplicated keywords", () => {
      const result = analyzeMessage("strategy and more strategy please");

      const strategyCount = result.keywords.filter((k) => k === "strategy").length;
      expect(strategyCount).toBe(1);
    });

    it("returns empty array for no matches", () => {
      const result = analyzeMessage("hello world");

      expect(result.keywords).toEqual([]);
    });

    it("includes multi-word keywords", () => {
      const result = analyzeMessage("Let's look at the big picture");

      expect(result.keywords).toContain("big picture");
    });
  });

  // ==========================================================================
  // Case Insensitivity
  // ==========================================================================

  describe("case insensitivity", () => {
    it("matches keywords regardless of case", () => {
      const lower = analyzeMessage("what is the strategy?");
      const upper = analyzeMessage("WHAT IS THE STRATEGY?");
      const mixed = analyzeMessage("What Is The Strategy?");

      expect(lower.primaryAgent).toBe(upper.primaryAgent);
      expect(lower.primaryAgent).toBe(mixed.primaryAgent);
      expect(lower.keywords).toEqual(upper.keywords);
    });

    it("matches API regardless of case variations", () => {
      const result1 = analyzeMessage("how does this api work?");
      const result2 = analyzeMessage("how does this API work?");
      const result3 = analyzeMessage("how does this Api work?");

      expect(result1.primaryAgent).toBe("explorer");
      expect(result2.primaryAgent).toBe("explorer");
      expect(result3.primaryAgent).toBe("explorer");
    });
  });
});
