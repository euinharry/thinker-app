/**
 * AI-related type definitions for Thinker AI Chat.
 * Supports OpenAI-compatible APIs (mimo-v2.5-pro, deepseek, OpenAI, etc.)
 */

// ============================================================================
// Message Types
// ============================================================================

/** Role of a message participant */
export type MessageRole = "user" | "assistant" | "system";

/**
 * A chat message in a conversation.
 * Compatible with OpenAI's message format.
 */
export interface Message {
  /** Unique identifier for the message */
  id: string;
  /** Role of the message sender */
  role: MessageRole;
  /** Text content of the message */
  content: string;
  /** ID of the agent that sent this message (null for user messages) */
  agent_id: string | null;
  /** Timestamp when the message was created */
  created_at: Date;
}

/**
 * Message as sent to the AI API (no DB metadata).
 * Matches OpenAI's chat completion message format.
 */
export interface APIMessage {
  /** Role of the message sender */
  role: MessageRole;
  /** Text content of the message */
  content: string;
  /** Optional name for the participant (used for agent identification) */
  name?: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request payload for a chat completion.
 * Validated before being sent to any AI provider.
 */
export interface ChatRequest {
  /** The messages in the conversation */
  messages: APIMessage[];
  /** Model identifier (e.g., "mimo-v2.5-pro") */
  model: string;
  /** Sampling temperature (0-2). Higher = more random */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** System prompt prepended to the conversation */
  system_prompt?: string;
  /** Agent name for identification in multi-agent scenarios */
  agent_name?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * A single chunk from a streaming response.
 * Each chunk contains a partial text delta.
 */
export interface StreamChunk {
  /** Unique ID for the completion */
  id: string;
  /** The model that generated this chunk */
  model: string;
  /** Delta content for this chunk */
  delta: {
    /** Role (only present in the first chunk) */
    role?: MessageRole;
    /** Partial text content */
    content?: string;
  };
  /** Reason the model stopped (present in final chunk) */
  finish_reason: "stop" | "length" | null;
}

/**
 * Complete (non-streaming) chat response from the AI provider.
 */
export interface ChatResponse {
  /** Unique ID for the completion */
  id: string;
  /** The model that generated the response */
  model: string;
  /** Generated choices (typically 1) */
  choices: Array<{
    message: APIMessage;
    finish_reason: "stop" | "length" | null;
  }>;
  /** Token usage statistics */
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Async iterable stream of chat response chunks.
 * Used for SSE streaming from AI providers.
 */
export interface StreamResponse {
  /** Unique ID for the stream */
  id: string;
  /** The model generating the stream */
  model: string;
  /** Async iterator over stream chunks */
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk>;
}

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Configuration for initializing an AI provider.
 * Each provider implementation may use different fields.
 */
export interface ProviderConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API (e.g., "https://api.mimo.ai/v1") */
  baseUrl: string;
  /** Default model to use if not specified in requests */
  defaultModel?: string;
  /** Default temperature for requests */
  defaultTemperature?: number;
  /** Default max tokens for requests */
  defaultMaxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Supported AI provider names.
 * Extend this union type when adding new providers.
 */
export type ProviderName = "mimo" | "openai" | "deepseek";

/**
 * Result type for provider operations.
 * Uses discriminated union for type-safe error handling.
 */
export type ProviderResult<T> =
  | { success: true; data: T }
  | { success: false; error: ProviderError };

/**
 * Structured error from AI provider operations.
 */
export interface ProviderError {
  /** Error code (e.g., "rate_limit", "auth_error", "timeout") */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Original error from the provider, if any */
  cause?: unknown;
}
