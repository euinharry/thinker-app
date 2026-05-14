/**
 * Message Content Analyzer
 *
 * Determines which agent should be the primary responder based on
 * keyword/heuristic analysis of the message content. Uses simple
 * pattern matching — NOT AI-based.
 *
 * ## Agent Keyword Domains
 *
 * | Agent   | Domain Keywords                                       |
 * |---------|-------------------------------------------------------|
 * | Leader  | strategy, vision, goal, prioritize, coordinate, etc.  |
 * | Explorer| technology, framework, API, research, solution, etc.  |
 * | Thinker | task, schedule, feasibility, timeline, plan, etc.     |
 * | Critic  | risk, issue, problem, weakness, edge case, etc.       |
 *
 * ## Usage
 *
 * ```typescript
 * import { analyzeMessage } from "@/lib/agents/message-analyzer";
 *
 * const result = analyzeMessage("What technology should we use?");
 * console.log(result.primaryAgent); // "explorer"
 * console.log(result.confidence);   // 1.0
 * console.log(result.keywords);     // ["technology"]
 * ```
 *
 * @module lib/agents/message-analyzer
 */

import type { AgentType } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of analyzing a message to determine the primary responder agent.
 */
export interface MessageAnalysisResult {
  /** The agent best suited to respond to this message */
  primaryAgent: AgentType;
  /** Confidence score between 0 and 1 (0 = no keywords matched, 1 = all keywords from one agent) */
  confidence: number;
  /** List of matched keywords found in the message (deduplicated, lowercase) */
  keywords: string[];
}

// ============================================================================
// Keyword Definitions
// ============================================================================

/**
 * Keyword-to-agent mapping with weights.
 *
 * Each agent has a set of domain-specific keywords. Multi-word keywords
 * (e.g., "big picture") are matched as phrases. Single-word keywords
 * use word-boundary matching to avoid false positives.
 *
 * Organized by agent for clarity. Priority order determines tie-breaking:
 * leader > explorer > thinker > critic (strategic questions are general).
 */
const AGENT_KEYWORDS: Record<AgentType, string[]> = {
  leader: [
    "strategy",
    "strategic",
    "roadmap",
    "vision",
    "goal",
    "goals",
    "prioritize",
    "coordinate",
    "decision",
    "decisions",
    "big picture",
    "align",
    "alignment",
    "mission",
    "direction",
    "objective",
    "objectives",
    "overview",
    "summary",
    "synthesize",
    "consensus",
    "leadership",
    "team",
    "priorities",
  ],
  explorer: [
    "technology",
    "technologies",
    "framework",
    "frameworks",
    "API",
    "library",
    "libraries",
    "tool",
    "tools",
    "research",
    "solution",
    "solutions",
    "compare",
    "comparison",
    "evaluate",
    "evaluation",
    "architecture",
    "trend",
    "trends",
    "benchmark",
    "performance",
    "stack",
    "database",
    "cloud",
    "deploy",
    "deployment",
    "scale",
    "scalability",
    "frontend",
    "backend",
    "alternative",
    "alternatives",
    "explore",
    "investigate",
    "technical",
    "infrastructure",
    "option",
    "options",
    "integration",
  ],
  thinker: [
    "task",
    "tasks",
    "schedule",
    "feasibility",
    "feasible",
    "timeline",
    "timelines",
    "estimate",
    "estimation",
    "plan",
    "planning",
    "implement",
    "implementation",
    "step",
    "steps",
    "dependency",
    "dependencies",
    "resource",
    "resources",
    "deadline",
    "deadlines",
    "milestone",
    "milestones",
    "break down",
    "action",
    "actions",
    "execute",
    "execution",
    "workflow",
    "process",
    "sprint",
    "agile",
    "decomposition",
    "scope",
    "deliverable",
    "deliverables",
    "sequencing",
  ],
  critic: [
    "risk",
    "risks",
    "issue",
    "issues",
    "problem",
    "problems",
    "weakness",
    "weaknesses",
    "flaw",
    "flaws",
    "concern",
    "concerns",
    "edge case",
    "edge cases",
    "failure",
    "failures",
    "bug",
    "bugs",
    "vulnerability",
    "vulnerabilities",
    "assumption",
    "assumptions",
    "validate",
    "validation",
    "test",
    "testing",
    "quality",
    "challenge",
    "challenges",
    "drawback",
    "drawbacks",
    "limitation",
    "limitations",
    "trade-off",
    "trade-offs",
    "downside",
    "downsides",
    "review",
    "audit",
    "critical",
    "robustness",
    "reliability",
  ],
};

/**
 * Priority order for tie-breaking. Leader is first because
 * strategic/general questions default to the leader.
 */
const AGENT_PRIORITY: AgentType[] = ["leader", "explorer", "thinker", "critic"];

// ============================================================================
// Matching Engine (Pre-compiled Regex Cache)
// ============================================================================

/**
 * Pre-compiled regex cache for single-word keywords.
 * Built once at module load time to avoid repeated RegExp construction.
 * Maps keyword → compiled RegExp with word-boundary matching.
 */
const REGEX_CACHE = new Map<string, RegExp>();

function getOrCompileRegex(keyword: string): RegExp {
  let regex = REGEX_CACHE.get(keyword);
  if (!regex) {
    regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
    REGEX_CACHE.set(keyword, regex);
  }
  return regex;
}

// Pre-compile all agent keywords at module load time
for (const keywords of Object.values(AGENT_KEYWORDS)) {
  for (const keyword of keywords) {
    if (!keyword.includes(" ")) {
      getOrCompileRegex(keyword);
    }
  }
}

/**
 * Check if a keyword exists in the message text.
 *
 * - Multi-word keywords (containing spaces) use case-insensitive includes.
 * - Single-word keywords use word-boundary regex to prevent partial matches
 *   (e.g., "step" should not match "footstep").
 *
 * Uses pre-compiled regex cache for single-word keywords to avoid
 * repeated RegExp construction on every call.
 *
 * @param message - Lowercased message text
 * @param keyword - Lowercased keyword to find
 * @returns true if the keyword is found in the message
 */
function matchesKeyword(message: string, keyword: string): boolean {
  if (keyword.includes(" ")) {
    // Multi-word: simple substring match (already lowercased)
    return message.includes(keyword);
  }

  // Single word: use pre-compiled regex from cache
  const pattern = getOrCompileRegex(keyword);
  return pattern.test(message);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Analyze a message to determine which agent should be the primary responder.
 *
 * Uses keyword-based heuristics to score each agent based on how many
 * domain-specific keywords appear in the message. Returns the agent
 * with the highest score, along with a confidence metric.
 *
 * **Tie-breaking priority**: leader > explorer > thinker > critic.
 * This means when scores are equal, leader wins (strategic questions
 * are considered general/default).
 *
 * @param message - The user's message text to analyze
 * @returns Analysis result with primary agent, confidence, and matched keywords
 *
 * @example
 * ```typescript
 * // Clear explorer signal
 * analyzeMessage("What framework should we use for the API?");
 * // → { primaryAgent: "explorer", confidence: 1.0, keywords: ["framework", "API"] }
 *
 * // Mixed signals, explorer wins (2 vs 1)
 * analyzeMessage("What's our strategy for this API framework?");
 * // → { primaryAgent: "explorer", confidence: 0.67, keywords: ["strategy", "API", "framework"] }
 *
 * // No keywords → defaults to leader
 * analyzeMessage("Hello, how are you?");
 * // → { primaryAgent: "leader", confidence: 0, keywords: [] }
 *
 * // Empty message
 * analyzeMessage("");
 * // → { primaryAgent: "leader", confidence: 0, keywords: [] }
 * ```
 */
export function analyzeMessage(message: string): MessageAnalysisResult {
  // Handle empty/whitespace-only messages
  const normalized = message.trim().toLowerCase();
  if (normalized.length === 0) {
    return {
      primaryAgent: "leader",
      confidence: 0,
      keywords: [],
    };
  }

  // Score each agent by counting keyword matches
  const scores: Record<AgentType, number> = {
    leader: 0,
    explorer: 0,
    thinker: 0,
    critic: 0,
  };

  // Track all matched keywords (deduplicated across agents)
  const allMatchedKeywords: string[] = [];
  // Track which keywords belong to which agent (for the winning agent)
  const keywordsByAgent: Record<AgentType, string[]> = {
    leader: [],
    explorer: [],
    thinker: [],
    critic: [],
  };

  for (const agent of AGENT_PRIORITY) {
    const keywords = AGENT_KEYWORDS[agent];

    for (const keyword of keywords) {
      if (matchesKeyword(normalized, keyword)) {
        scores[agent]++;

        // Track keyword per agent (for determining winner's keywords)
        keywordsByAgent[agent].push(keyword);

        // Track globally (deduplicated)
        if (!allMatchedKeywords.includes(keyword)) {
          allMatchedKeywords.push(keyword);
        }
      }
    }
  }

  // Find the winning agent (highest score, with priority tie-breaking)
  let primaryAgent: AgentType = "leader";
  let highestScore = 0;

  for (const agent of AGENT_PRIORITY) {
    if (scores[agent] > highestScore) {
      highestScore = scores[agent];
      primaryAgent = agent;
    }
  }

  // Calculate confidence: ratio of winning score to total keywords found
  // If no keywords matched, confidence is 0
  const totalMatches = allMatchedKeywords.length;
  const confidence =
    totalMatches === 0 ? 0 : Math.round((highestScore / totalMatches) * 100) / 100;

  // Return keywords from the winning agent (not all matched keywords)
  // If no keywords matched, return empty array
  const winnerKeywords =
    highestScore === 0 ? [] : [...new Set(keywordsByAgent[primaryAgent])];

  return {
    primaryAgent,
    confidence,
    keywords: winnerKeywords,
  };
}
