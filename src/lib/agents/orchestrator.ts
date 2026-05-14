/**
 * Agent Reply Orchestration
 *
 * Coordinates agents to respond to user messages in a single round.
 * Supports @mention targeting: when a message contains @mentions
 * (e.g., "@Leader @Critic"), only mentioned agents respond.
 * When no @mentions are found, all 4 agents respond.
 *
 * Agents execute in parallel via Promise.allSettled() and responses are
 * returned in a consistent order: Leader → Explorer → Thinker → Critic.
 *
 * ## Usage
 *
 * ```typescript
 * import { Orchestrator } from "@/lib/agents/orchestrator";
 *
 * const orchestrator = new Orchestrator();
 *
 * // All agents respond (no @mentions)
 * const responses = await orchestrator.orchestrate("How should we approach this?");
 *
 * // Only Leader responds (@mention targeting)
 * const responses = await orchestrator.orchestrate("@Leader what's the strategy?");
 *
 * // Leader and Critic respond (multiple @mentions)
 * const responses = await orchestrator.orchestrate("@Leader @Critic discuss this plan");
 * ```
 *
 * ## Architecture
 *
 * ```
 * Orchestrator
 *    ├── parseMentions()        → filter agents by @mentions
 *    ├── LeaderAgent.chat()    ─┐
 *    ├── ExplorerAgent.chat()   ├─ Promise.allSettled() → ordered results
 *    ├── ThinkerAgent.chat()    │
 *    └── CriticAgent.chat()    ─┘
 * ```
 *
 * @module lib/agents/orchestrator
 */

import { LeaderAgent } from "./leader";
import { ExplorerAgent } from "./explorer";
import { ThinkerAgent } from "./thinker";
import { CriticAgent } from "./critic";
import { parseMentions } from "@/lib/chat/mentions";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/**
 * Lightweight agent metadata included in each response.
 * Matches the shape returned by agent.getAgentInfo().
 */
export interface AgentInfo {
  /** Agent type identifier */
  id: AgentType;
  /** Display name */
  name: string;
  /** Short personality description */
  personality: string;
  /** Emoji avatar */
  avatar: string;
}

/**
 * A single agent's response from orchestration.
 */
export interface AgentResponse {
  /** Agent metadata */
  agent: AgentInfo;
  /** The agent's response text (empty string on failure) */
  response: string;
  /** Whether this agent responded successfully */
  success: boolean;
  /** Error message if the agent failed */
  error?: string;
}

// ============================================================================
// Orchestrator
// ============================================================================

/**
 * Orchestrator coordinates agents to respond to a user message.
 *
 * It creates agent instances, optionally filters them based on @mentions
 * in the message, calls them in parallel using Promise.allSettled(),
 * and returns responses ordered consistently as: Leader, Explorer, Thinker, Critic.
 *
 * Failed agents are included in the response with `success: false`
 * and an error message, but do not block other agents.
 *
 * @example
 * ```typescript
 * const orchestrator = new Orchestrator();
 *
 * // All 4 agents respond
 * const responses = await orchestrator.orchestrate("What's our strategy?");
 *
 * // Only Leader responds
 * const responses = await orchestrator.orchestrate("@Leader what's the strategy?");
 * ```
 */
export class Orchestrator {
  /**
   * Orchestrate a response from agents to the given message.
   *
   * When the message contains @mentions (e.g., "@Leader @Critic discuss this"),
   * only the mentioned agents respond. When no @mentions are found, all 4 agents
   * respond (default behavior).
   *
   * All agents are invoked in parallel. If any agent fails, its error
   * is captured and returned alongside successful responses. The order
   * of results follows the canonical order: Leader, Explorer, Thinker, Critic.
   *
   * @param message - The user's message to send to agents
   * @returns Array of agent responses in canonical order
   */
  async orchestrate(message: string): Promise<AgentResponse[]> {
    // Parse @mentions from the message
    const { mentionedAgents, hasMentions } = parseMentions(message);

    // All available agents in canonical order
    const allAgents = [
      new LeaderAgent(),
      new ExplorerAgent(),
      new ThinkerAgent(),
      new CriticAgent(),
    ];

    // Filter agents based on @mentions, or use all if no mentions
    const agents = hasMentions
      ? allAgents.filter((agent) =>
          mentionedAgents.includes(agent.agentType as AgentType)
        )
      : allAgents;

    // Execute filtered agents in parallel
    const results = await Promise.allSettled(
      agents.map(async (agent) => {
        const response = await agent.chat(message);
        return {
          agent: agent.getAgentInfo(),
          response,
          success: true as const,
        };
      })
    );

    // Map settled results, preserving order
    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      return {
        agent: agents[index].getAgentInfo(),
        response: "",
        success: false as const,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason ?? "Agent failed"),
      };
    });
  }
}
