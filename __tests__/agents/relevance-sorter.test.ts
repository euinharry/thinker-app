/**
 * Relevance Sorter Tests
 *
 * Tests for supplement relevance scoring and sorting.
 * Scores supplements based on keyword overlap between
 * the primary agent's response and each supplement's reason.
 *
 * Uses simple keyword matching (no AI/LLM).
 */

import { describe, it, expect } from "vitest";
import {
  sortSupplements,
  type SupplementDecision,
} from "@/lib/agents/relevance-sorter";

// ============================================================================
// Test Helpers
// ============================================================================

/** Create a SupplementDecision with defaults for testing */
function makeSupplement(
  overrides: Partial<SupplementDecision> = {}
): SupplementDecision {
  return {
    agentType: "explorer",
    reason: "Default reason",
    content: "Default content",
    ...overrides,
  };
}

// ============================================================================
// sortSupplements Tests
// ============================================================================

describe("sortSupplements", () => {
  // --------------------------------------------------------------------------
  // Empty / Edge Cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("returns empty array when supplements is empty", () => {
      const result = sortSupplements("Some primary response", []);
      expect(result).toEqual([]);
    });

    it("returns empty array when primary response is empty string", () => {
      const supplements = [
        makeSupplement({ reason: "Some reason" }),
      ];
      const result = sortSupplements("", supplements);
      expect(result).toEqual([]);
    });

    it("returns empty array when primary response is whitespace only", () => {
      const supplements = [
        makeSupplement({ reason: "Some reason" }),
      ];
      const result = sortSupplements("   \n\t  ", supplements);
      expect(result).toEqual([]);
    });

    it("handles supplements with empty reason", () => {
      const supplements = [
        makeSupplement({ reason: "", agentType: "critic" }),
        makeSupplement({
          reason: "The primary response needs review",
          agentType: "thinker",
        }),
      ];
      const result = sortSupplements("The primary response", supplements);
      expect(result).toHaveLength(2);
      // Thinker supplement has keyword overlap ("primary", "response") → higher score
      expect(result[0].agentType).toBe("thinker");
      expect(result[1].agentType).toBe("critic");
    });
  });

  // --------------------------------------------------------------------------
  // Sorting Behavior
  // --------------------------------------------------------------------------

  describe("sorting", () => {
    it("sorts by relevance descending (most relevant first)", () => {
      const supplements = [
        makeSupplement({
          agentType: "critic",
          reason: "Unrelated topic about cooking recipes",
        }),
        makeSupplement({
          agentType: "explorer",
          reason: "The authentication system uses JWT tokens",
        }),
        makeSupplement({
          agentType: "thinker",
          reason: "Database authentication requires secure tokens",
        }),
      ];

      const result = sortSupplements(
        "The authentication system needs JWT tokens for the database",
        supplements
      );

      // explorer and thinker both share keywords with primary
      // critic shares almost none
      expect(result).toHaveLength(3);
      // Critic (least relevant) should be last
      expect(result[2].agentType).toBe("critic");
    });

    it("preserves original order for supplements with equal relevance", () => {
      const supplements = [
        makeSupplement({
          agentType: "leader",
          reason: "Alpha testing is important",
        }),
        makeSupplement({
          agentType: "thinker",
          reason: "Beta testing is important",
        }),
        makeSupplement({
          agentType: "critic",
          reason: "Gamma testing is important",
        }),
      ];

      const result = sortSupplements(
        "Testing is important for quality",
        supplements
      );

      // All share "testing" and "important" equally
      // Original order should be preserved
      expect(result[0].agentType).toBe("leader");
      expect(result[1].agentType).toBe("thinker");
      expect(result[2].agentType).toBe("critic");
    });

    it("does not mutate the original array", () => {
      const supplements = [
        makeSupplement({ agentType: "critic", reason: "Low relevance" }),
        makeSupplement({
          agentType: "explorer",
          reason: "High relevance match",
        }),
      ];
      const original = [...supplements];

      sortSupplements("High relevance match test", supplements);

      expect(supplements).toEqual(original);
    });

    it("preserves all supplement properties in sorted result", () => {
      const supplements = [
        makeSupplement({
          agentType: "critic",
          reason: "No match here",
          content: "Critic content with details",
        }),
        makeSupplement({
          agentType: "explorer",
          reason: "Great match here",
          content: "Explorer content with details",
        }),
      ];

      const result = sortSupplements("Great match", supplements);

      // Check that all properties are preserved
      expect(result[0].content).toBe("Explorer content with details");
      expect(result[0].agentType).toBe("explorer");
      expect(result[0].reason).toBe("Great match here");
      expect(result[1].content).toBe("Critic content with details");
    });
  });

  // --------------------------------------------------------------------------
  // Scoring / Keyword Matching
  // --------------------------------------------------------------------------

  describe("keyword matching", () => {
    it("scores higher when more keywords overlap", () => {
      const highOverlap = makeSupplement({
        agentType: "explorer",
        reason: "React components use TypeScript for type safety",
      });
      const lowOverlap = makeSupplement({
        agentType: "critic",
        reason: "Consider the weather today",
      });

      const result = sortSupplements(
        "React TypeScript components need type safety",
        [lowOverlap, highOverlap]
      );

      expect(result[0].agentType).toBe("explorer");
      expect(result[1].agentType).toBe("critic");
    });

    it("ignores common stop words in matching", () => {
      // "the", "is", "a", "and", "of", "to", "in", "for" are stop words
      const supplement = makeSupplement({
        agentType: "thinker",
        reason: "the system is a combination of parts",
      });

      const result = sortSupplements(
        "the system is designed for a purpose",
        [supplement]
      );

      // Should still find "system" as overlap
      expect(result).toHaveLength(1);
    });

    it("is case insensitive", () => {
      const supplements = [
        makeSupplement({
          agentType: "explorer",
          reason: "REACT COMPONENTS are powerful",
        }),
        makeSupplement({
          agentType: "critic",
          reason: "Unrelated cooking advice",
        }),
      ];

      const result = sortSupplements(
        "react components need testing",
        supplements
      );

      expect(result[0].agentType).toBe("explorer");
    });

    it("handles single-character words by ignoring them", () => {
      const supplements = [
        makeSupplement({
          agentType: "thinker",
          reason: "I think a good approach is best",
        }),
      ];

      // Should not crash, single chars are too short to match
      const result = sortSupplements("I am a person", supplements);
      expect(result).toHaveLength(1);
    });

    it("returns all supplements scored at 0 when no keywords overlap", () => {
      const supplements = [
        makeSupplement({
          agentType: "leader",
          reason: "Elephants live in Africa",
        }),
        makeSupplement({
          agentType: "critic",
          reason: "Quantum physics is fascinating",
        }),
      ];

      const result = sortSupplements(
        "Hello world",
        supplements
      );

      // Both have 0 relevance, order preserved
      expect(result).toHaveLength(2);
      expect(result[0].agentType).toBe("leader");
      expect(result[1].agentType).toBe("critic");
    });
  });

  // --------------------------------------------------------------------------
  // Return Type
  // --------------------------------------------------------------------------

  describe("return type", () => {
    it("returns a new array (not same reference)", () => {
      const supplements = [makeSupplement()];
      const result = sortSupplements("test", supplements);
      expect(result).not.toBe(supplements);
    });

    it("returns all input supplements (none dropped)", () => {
      const supplements = [
        makeSupplement({ agentType: "leader" }),
        makeSupplement({ agentType: "explorer" }),
        makeSupplement({ agentType: "thinker" }),
        makeSupplement({ agentType: "critic" }),
      ];

      const result = sortSupplements("test response", supplements);
      expect(result).toHaveLength(4);
    });
  });
});
