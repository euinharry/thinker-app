/**
 * @Mention Parser
 *
 * Extracts @agent mentions from user messages to target specific agents.
 * When @mentions are present, only mentioned agents respond.
 * When no @mentions are found, all agents respond (default behavior).
 *
 * ## Usage
 *
 * ```typescript
 * import { parseMentions } from "@/lib/chat/mentions";
 *
 * const result = parseMentions("@Leader what's the strategy?");
 * console.log(result.mentionedAgents); // ["leader"]
 * console.log(result.hasMentions);      // true
 * console.log(result.cleanedMessage);   // "what's the strategy?"
 * ```
 *
 * ## Supported Patterns
 *
 * - `@Leader` - single mention
 * - `@Leader @Critic` - multiple mentions
 * - `@leader` - case-insensitive
 * - `@LEADER` - case-insensitive
 *
 * @module lib/chat/mentions
 */

import { isValidAgentType } from "@/lib/agents/personalities";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Types
// ============================================================================

/**
 * Result of parsing @mentions from a message.
 */
export interface ParsedMentions {
  /** Array of unique agent types found in mentions */
  mentionedAgents: AgentType[];
  /** Whether any valid @mentions were found */
  hasMentions: boolean;
  /** Message with @mentions removed, trimmed */
  cleanedMessage: string;
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse @agent mentions from a user message.
 *
 * Extracts all @word patterns, validates them against known agent types
 * (case-insensitive), and returns the list of mentioned agents along
 * with a cleaned message (mentions removed).
 *
 * Invalid @mentions (e.g., @unknown) are silently ignored.
 * Duplicate mentions are deduplicated (first occurrence wins).
 *
 * @param message - The user's message to parse
 * @returns ParsedMentions with extracted agents and cleaned message
 *
 * @example
 * ```typescript
 * // Single mention
 * parseMentions("@Leader tell me about strategy");
 * // → { mentionedAgents: ["leader"], hasMentions: true, cleanedMessage: "tell me about strategy" }
 *
 * // Multiple mentions
 * parseMentions("@Leader @Critic discuss this plan");
 * // → { mentionedAgents: ["leader", "critic"], hasMentions: true, cleanedMessage: "discuss this plan" }
 *
 * // No mentions
 * parseMentions("What should we do?");
 * // → { mentionedAgents: [], hasMentions: false, cleanedMessage: "What should we do?" }
 *
 * // Case-insensitive
 * parseMentions("@LEADER hello");
 * // → { mentionedAgents: ["leader"], hasMentions: true, cleanedMessage: "hello" }
 *
 * // Invalid mention ignored
 * parseMentions("@unknown @Leader hello");
 * // → { mentionedAgents: ["leader"], hasMentions: true, cleanedMessage: "@unknown hello" }
 * ```
 */
export function parseMentions(message: string): ParsedMentions {
  const mentionRegex = /@(\w+)/g;
  const mentionedAgents: AgentType[] = [];
  let match;

  while ((match = mentionRegex.exec(message)) !== null) {
    const agentName = match[1].toLowerCase();
    if (isValidAgentType(agentName)) {
      // Deduplicate: only add if not already in the list
      if (!mentionedAgents.includes(agentName)) {
        mentionedAgents.push(agentName);
      }
    }
  }

  // Remove valid @mentions from message for cleaner processing
  // Only remove mentions that match known agent types (case-insensitive)
  const cleanedMessage = message
    .replace(/@(\w+)/g, (fullMatch, word) => {
      return isValidAgentType(word.toLowerCase()) ? "" : fullMatch;
    })
    .replace(/\s{2,}/g, " ") // Collapse multiple spaces
    .trim();

  return {
    mentionedAgents,
    hasMentions: mentionedAgents.length > 0,
    cleanedMessage,
  };
}
