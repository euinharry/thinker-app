/**
 * Relevance-Based Supplement Ordering
 *
 * Scores supplements based on keyword overlap with the primary agent's
 * response. Uses simple heuristics (keyword matching, topic overlap)
 * without any AI/LLM calls.
 *
 * ## Algorithm
 *
 * 1. Extract meaningful keywords from primary response and each supplement reason
 * 2. Filter out common stop words and short words (< 2 chars)
 * 3. Score = Jaccard similarity: |intersection| / |union| of keyword sets
 * 4. Sort descending by score (most relevant first)
 * 5. Stable sort: preserves original order for equal scores
 *
 * @module lib/agents/relevance-sorter
 */

import type { AgentType } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/**
 * A supplement decision from a secondary agent.
 * Represents additional context or an alternative perspective
 * to augment the primary agent's response.
 */
export interface SupplementDecision {
  /** Agent that produced this supplement */
  agentType: AgentType;
  /** Reason/explanation for why this supplement is relevant */
  reason: string;
  /** The actual supplement content */
  content: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Common English stop words to exclude from keyword matching.
 * These words carry little semantic meaning and would inflate
 * overlap scores without indicating real topic relevance.
 */
const STOP_WORDS = new Set([
  "the",
  "is",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "into",
  "about",
  "like",
  "through",
  "after",
  "over",
  "between",
  "out",
  "against",
  "during",
  "without",
  "before",
  "under",
  "around",
  "among",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "his",
  "her",
  "has",
  "had",
  "have",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  "not",
  "no",
  "nor",
  "so",
  "if",
  "then",
  "than",
  "too",
  "very",
  "just",
  "also",
  "more",
  "some",
  "any",
  "all",
  "each",
  "every",
  "both",
  "few",
  "most",
  "other",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
  "am",
  "are",
  "was",
  "were",
]);

/** Minimum word length to consider as a meaningful keyword */
const MIN_WORD_LENGTH = 2;

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Extract meaningful keywords from text.
 * Converts to lowercase, splits on non-alphanumeric chars,
 * filters out stop words and short words.
 */
function extractKeywords(text: string): Set<string> {
  if (!text || !text.trim()) {
    return new Set();
  }

  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word));

  return new Set(words);
}

/**
 * Calculate Jaccard similarity between two keyword sets.
 * Returns a value in [0, 1] where 1 means identical sets.
 *
 * Jaccard = |A ∩ B| / |A ∪ B|
 *
 * Returns 0 if both sets are empty (no meaningful keywords).
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;

  if (unionSize === 0) {
    return 0;
  }

  return intersectionSize / unionSize;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Sort supplements by relevance to the primary agent's response.
 *
 * Scores each supplement based on keyword overlap between the primary
 * response text and the supplement's reason field. Returns a new array
 * sorted from most to least relevant.
 *
 * Uses Jaccard similarity on extracted keywords (stop words removed,
 * case-insensitive). Preserves original order for supplements with
 * equal relevance scores (stable sort).
 *
 * @param primaryResponse - The primary agent's response text
 * @param supplements - Array of supplement decisions to sort
 * @returns New array sorted by relevance (most relevant first),
 *          or empty array if primaryResponse is empty/whitespace
 *
 * @example
 * ```typescript
 * const sorted = sortSupplements(
 *   "The authentication system uses JWT tokens",
 *   [
 *     { agentType: "critic", reason: "Consider the UI layout", content: "..." },
 *     { agentType: "explorer", reason: "JWT tokens need refresh logic", content: "..." },
 *   ]
 * );
 * // Explorer supplement comes first (higher keyword overlap)
 * ```
 */
export function sortSupplements(
  primaryResponse: string,
  supplements: SupplementDecision[]
): SupplementDecision[] {
  // Edge case: empty inputs
  if (!primaryResponse || !primaryResponse.trim()) {
    return [];
  }

  if (supplements.length === 0) {
    return [];
  }

  const primaryKeywords = extractKeywords(primaryResponse);

  // Score each supplement
  const scored = supplements.map((supplement, index) => {
    const reasonKeywords = extractKeywords(supplement.reason);
    const score = jaccardSimilarity(primaryKeywords, reasonKeywords);
    return { supplement, score, originalIndex: index };
  });

  // Stable sort descending by score
  // Using originalIndex as tiebreaker ensures stability
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.originalIndex - b.originalIndex;
  });

  return scored.map(({ supplement }) => supplement);
}
