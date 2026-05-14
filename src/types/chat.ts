/**
 * Chat UI type definitions for Thinker AI Chat.
 *
 * Types used by chat components (MessageList, MessageItem, ChatInput).
 * These are UI-focused types that may extend or transform the core
 * Message type from types/ai.ts.
 *
 * @module types/chat
 */

import type { AgentType } from "@/types/agent";

// ============================================================================
// Chat Message Types
// ============================================================================

/**
 * A message as displayed in the chat UI.
 *
 * Extends the base message with UI-specific fields like
 * agent metadata and loading state.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message sender */
  role: "user" | "agent";
  /** Text content of the message */
  content: string;
  /** Agent type that sent this message (null for user messages) */
  agentType: AgentType | null;
  /** Agent display name (null for user messages) */
  agentName: string | null;
  /** Agent emoji avatar (null for user messages) */
  agentAvatar: string | null;
  /** Timestamp when the message was created */
  createdAt: Date;
  /** Whether this message is currently being streamed/generated */
  isStreaming?: boolean;
  /** Whether this is a supplement response from a non-primary agent in orchestrator mode */
  isSupplement?: boolean;
  /** Agent's thinking/reasoning process (if model exposes it) */
  thinking?: string;
}

/**
 * Agent metadata for rendering agent-styled messages.
 * Used to look up agent info from agent_id.
 */
export interface AgentMeta {
  /** Agent type identifier */
  type: AgentType;
  /** Display name */
  name: string;
  /** Emoji avatar */
  avatar: string;
}

// ============================================================================
// Chat Input Types
// ============================================================================

/**
 * Props for the ChatInput component.
 */
export interface ChatInputProps {
  /** Callback when user sends a message */
  onSend: (message: string) => void;
  /** Whether the input is disabled (e.g., while loading) */
  disabled?: boolean;
  /** Maximum character count for messages */
  maxLength?: number;
  /** Placeholder text for the input */
  placeholder?: string;
}

// ============================================================================
// Message List Types
// ============================================================================

/**
 * Props for the MessageList component.
 */
export interface MessageListProps {
  /** Array of messages to display */
  messages: ChatMessage[];
  /** Whether messages are currently being loaded */
  isLoading?: boolean;
  /** Whether a response is currently being generated */
  isGenerating?: boolean;
}

/**
 * Props for the MessageItem component.
 */
export interface MessageItemProps {
  /** The message to display */
  message: ChatMessage;
}
