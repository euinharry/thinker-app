/**
 * Supplement Decider
 *
 * Role-based supplement decision mechanism for the multi-agent system.
 * Each agent (except Leader) evaluates whether the primary agent's response
 * covers its domain of expertise using keyword-based heuristics.
 *
 * ## How It Works
 *
 * 1. The primary agent produces a response
 * 2. Each other agent checks if the response covers its domain keywords
 * 3. If domain keywords are missing, the agent recommends supplementation
 * 4. Confidence is based on how many domain keywords are absent
 *
 * ## Domain Keyword Mapping
 *
 * | Agent    | Domain Keywords                                           |
 * |----------|-----------------------------------------------------------|
 * | Leader   | (never supplements)                                       |
 * | Explorer | framework, library, technology, API, database, ...        |
 * | Thinker  | plan, step, timeline, feasibility, dependency, ...        |
 * | Critic   | risk, edge case, failure, security, assumption, ...       |
 *
 * @module lib/agents/supplement-decider
 */

import type { AgentType } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/**
 * Decision about whether an agent should supplement the primary response.
 */
export interface SupplementDecision {
  /** The agent being evaluated */
  agent: AgentType;
  /** Whether this agent should supplement the primary response */
  shouldSupplement: boolean;
  /** Human-readable reason for the decision */
  reason: string;
  /** Confidence score (0-1) indicating certainty of the decision */
  confidence: number;
}

// ============================================================================
// Domain Keywords
// ============================================================================

/**
 * Keywords that indicate an agent's domain is covered in a response.
 * If these keywords appear in the primary response, the agent considers
 * its domain sufficiently addressed.
 */
const DOMAIN_KEYWORDS: Record<AgentType, readonly string[]> = {
  // Leader never supplements — empty keywords (unused)
  leader: [],

  // Explorer: technical implementation and research domain
  explorer: [
    "framework",
    "library",
    "technology",
    "tech stack",
    "api",
    "database",
    "db",
    "architecture",
    "performance",
    "scalability",
    "deployment",
    "infrastructure",
    "algorithm",
    "implementation",
    "code",
    "server",
    "cloud",
    "microservice",
    "container",
    "docker",
    "kubernetes",
    "ci/cd",
    "testing",
    "benchmark",
    "latency",
    "throughput",
    "cache",
    "cdn",
    "sql",
    "nosql",
    "rest",
    "graphql",
    "websocket",
    "react",
    "node",
    "python",
    "typescript",
    "javascript",
    "rust",
    "golang",
  ],

  // Thinker: planning and structure domain
  thinker: [
    "plan",
    "step",
    "timeline",
    "feasibility",
    "feasible",
    "dependency",
    "task",
    "milestone",
    "roadmap",
    "strategy",
    "approach",
    "phase",
    "sprint",
    "schedule",
    "estimate",
    "scope",
    "deliverable",
    "backlog",
    "priority",
    "workflow",
    "iteration",
    "breakdown",
    "sequence",
    "prerequisite",
    "action item",
    "next step",
    "first",
    "second",
    "third",
    "1.",
    "2.",
    "3.",
  ],

  // Critic: risks and quality domain
  critic: [
    "risk",
    "edge case",
    "failure",
    "security",
    "assumption",
    "limitation",
    "concern",
    "trade-off",
    "tradeoff",
    "challenge",
    "pitfall",
    "vulnerability",
    "test",
    "validation",
    "error handling",
    "fault",
    "bug",
    "regression",
    "mitigation",
    "fallback",
    "timeout",
    "race condition",
    "deadlock",
    "scalability concern",
    "what could go wrong",
    "counter-example",
    "worst case",
    "downside",
    "drawback",
  ],
};

// ============================================================================
// Thresholds
// ============================================================================

/**
 * Minimum number of domain keywords that must be found to consider
 * the domain covered. If fewer keywords are found, supplementation
 * is recommended.
 */
const MIN_KEYWORDS_FOUND = 2;

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Count how many domain keywords are present in the response.
 *
 * A response only needs to mention a few domain-specific terms to
 * demonstrate coverage. We count unique keyword matches, not ratio.
 *
 * @param response - The primary agent's response text
 * @param keywords - Domain keywords to check for
 * @returns Number of keywords found in the response
 */
function countKeywordMatches(response: string, keywords: readonly string[]): number {
  if (keywords.length === 0) return 0;

  const lowerResponse = response.toLowerCase();
  let found = 0;

  for (const keyword of keywords) {
    if (lowerResponse.includes(keyword.toLowerCase())) {
      found++;
    }
  }

  return found;
}

/**
 * Generate a reason string for why an agent should/should not supplement.
 *
 * @param agent - The agent type
 * @param shouldSupplement - Whether supplementation is recommended
 * @returns Human-readable reason
 */
function generateReason(agent: AgentType, shouldSupplement: boolean): string {
  const domainDescriptions: Record<AgentType, string> = {
    leader: "strategic oversight",
    explorer: "technical details and implementation",
    thinker: "planning and structured steps",
    critic: "risks, edge cases, and quality concerns",
  };

  const domain = domainDescriptions[agent];

  if (shouldSupplement) {
    return `Primary response lacks coverage of ${domain}`;
  }

  return `Primary response adequately covers ${domain}`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Decide which agents should supplement the primary agent's response.
 *
 * Each agent (except Leader) evaluates whether the primary response
 * covers its domain of expertise using keyword-based heuristics.
 * If the response is missing domain keywords, the agent recommends
 * supplementation with a confidence score.
 *
 * **Leader never supplements** — it defers to other agents or is
 * typically the primary agent itself.
 *
 * **Primary agent never supplements itself** — it already provided
 * its perspective as the primary response.
 *
 * @param primaryAgent - The agent that produced the primary response
 * @param primaryResponse - The text of the primary agent's response
 * @param allAgents - List of agents to evaluate for supplementation
 * @returns Array of supplement decisions, one per agent in allAgents
 *
 * @example
 * ```typescript
 * const decisions = decideSupplements(
 *   "leader",
 *   "We should focus on business goals and timeline.",
 *   ["leader", "explorer", "thinker", "critic"]
 * );
 *
 * // Explorer might supplement because no technical keywords found
 * const explorerDecision = decisions.find(d => d.agent === "explorer");
 * console.log(explorerDecision?.shouldSupplement); // true
 * console.log(explorerDecision?.reason); // "Primary response lacks coverage of technical details..."
 * ```
 */
export function decideSupplements(
  primaryAgent: AgentType,
  primaryResponse: string,
  allAgents: AgentType[]
): SupplementDecision[] {
  return allAgents.map((agent) => {
    // Leader never supplements
    if (agent === "leader") {
      return {
        agent,
        shouldSupplement: false,
        reason: "Leader defers to specialized agents and does not supplement",
        confidence: 1,
      };
    }

    // Agent does not supplement its own response
    if (agent === primaryAgent) {
      return {
        agent,
        shouldSupplement: false,
        reason: `${capitalize(agent)} already provided its perspective as the primary response`,
        confidence: 1,
      };
    }

    // Evaluate domain keyword coverage
    const keywords = DOMAIN_KEYWORDS[agent];
    const matchCount = countKeywordMatches(primaryResponse, keywords);
    const shouldSupplement = matchCount < MIN_KEYWORDS_FOUND;

    // Confidence: more matches → higher confidence domain is covered
    // Fewer matches → higher confidence supplementation is needed
    const confidence = shouldSupplement
      ? Math.min(1, 0.7 + (MIN_KEYWORDS_FOUND - matchCount) * 0.1)
      : Math.min(1, 0.5 + matchCount * 0.1);

    return {
      agent,
      shouldSupplement,
      reason: generateReason(agent, shouldSupplement),
      confidence: Math.round(confidence * 100) / 100,
    };
  });
}

/**
 * Capitalize the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
