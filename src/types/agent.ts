/**
 * Agent-related type definitions for Thinker AI Chat.
 *
 * Defines the structure for multi-agent personalities used in the
 * collaborative AI discussion system. Each agent has a unique role,
 * personality traits, and system prompt that guides its behavior.
 *
 * @module types/agent
 */

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Unique identifier for each agent type.
 * Maps to the predefined agents in the system:
 * - leader: Strategic team leader
 * - explorer: Technical researcher
 * - thinker: Task planner
 * - critic: Quality challenger
 */
export type AgentType = "leader" | "explorer" | "thinker" | "critic";

/**
 * Complete agent definition including personality and behavior configuration.
 *
 * This interface represents a fully configured agent with all the
 * information needed to render it in the UI and configure its AI behavior.
 *
 * @example
 * ```typescript
 * const agent: Agent = getAgentByName("leader");
 * console.log(agent.name);        // "Leader"
 * console.log(agent.personality); // "Strategic visionary..."
 * ```
 */
export interface Agent {
  /** Unique identifier for the agent (matches AgentType) */
  id: AgentType;
  /** Display name of the agent */
  name: string;
  /** Short personality description shown in UI */
  personality: string;
  /** System prompt that guides the agent's AI behavior */
  systemPrompt: string;
  /** Emoji avatar representing the agent visually */
  avatar: string;
}

/**
 * Agent configuration for database storage.
 * Matches the agents table schema in Prisma.
 */
export interface AgentConfig {
  /** Agent identifier (references AgentType) */
  agent_id: AgentType;
  /** AI model to use for this agent */
  model: string;
  /** Sampling temperature (0-2). Higher = more creative */
  temperature: number;
  /** Maximum tokens for agent responses */
  max_tokens?: number;
}

/**
 * Lightweight agent reference used in message metadata.
 * Contains only the fields needed to identify an agent in a message.
 */
export interface AgentReference {
  /** Agent identifier */
  id: AgentType;
  /** Display name */
  name: string;
  /** Emoji avatar */
  avatar: string;
}
