/**
 * AI Provider Strategy Pattern Implementation
 *
 * Implements the Strategy Pattern for multi-provider AI support.
 * Each provider (mimo, openai, deepseek) implements the AIProvider interface,
 * allowing runtime switching between providers.
 *
 * ## Architecture
 *
 * ```
 * AIProvider (interface)
 *    ├── MimoProvider (Task 7)
 *    ├── OpenAIProvider (future)
 *    └── DeepSeekProvider (future)
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * // Create a provider via factory
 * const provider = createProvider("mimo", {
 *   apiKey: process.env.MIMO_API_KEY!,
 *   baseUrl: process.env.MIMO_BASE_URL!,
 * });
 *
 * // Non-streaming chat
 * const response = await provider.chat({
 *   messages: [{ role: "user", content: "Hello!" }],
 *   model: "mimo-v2.5-pro",
 * });
 *
 * // Streaming chat
 * const stream = await provider.streamChat({
 *   messages: [{ role: "user", content: "Hello!" }],
 *   model: "mimo-v2.5-pro",
 * });
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.delta.content ?? "");
 * }
 * ```
 *
 * ## mimo-v2.5-pro API Reference
 *
 * The mimo API is OpenAI-compatible:
 *
 * - **Endpoint**: `POST {baseUrl}/chat/completions`
 * - **Auth**: `Authorization: Bearer {apiKey}`
 * - **Content-Type**: `application/json`
 * - **Request body**:
 *   ```json
 *   {
 *     "model": "mimo-v2.5-pro",
 *     "messages": [{ "role": "user", "content": "Hello" }],
 *     "temperature": 0.7,
 *     "max_tokens": 4096,
 *     "stream": false
 *   }
 *   ```
 * - **Streaming**: Set `"stream": true`, response is SSE with `data: {...}` lines
 * - **SSE format**: Each line is `data: {JSON}\n\n`, terminated by `data: [DONE]`
 *
 * @module lib/ai/provider
 */

import type {
  ChatRequest,
  ChatResponse,
  ProviderConfig,
  ProviderError,
  ProviderName,
  ProviderResult,
  StreamChunk,
  StreamResponse,
} from "@/types/ai";

// ============================================================================
// AIProvider Interface (Strategy)
// ============================================================================

/**
 * Strategy interface for AI providers.
 *
 * All AI provider implementations must implement this interface.
 * This enables runtime switching between providers (mimo, OpenAI, DeepSeek)
 * without changing client code.
 *
 * @example
 * ```typescript
 * const provider: AIProvider = createProvider("mimo", config);
 * const response = await provider.chat(request);
 * ```
 */
export interface AIProvider {
  /** Unique name identifying this provider */
  readonly name: ProviderName;

  /**
   * Send a chat completion request and wait for the full response.
   *
   * @param request - The chat request with messages and configuration
   * @returns The complete chat response
   * @throws {ProviderError} If the request fails
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Send a chat completion request and receive a streaming response.
   *
   * The returned StreamResponse is an async iterable that yields StreamChunk
   * objects as they arrive from the provider via SSE.
   *
   * @param request - The chat request with messages and configuration
   * @returns An async iterable stream of response chunks
   * @throws {ProviderError} If the request fails or streaming is not supported
   */
  streamChat(request: ChatRequest): Promise<StreamResponse>;

  /**
   * Check if the provider is properly configured and reachable.
   *
   * @returns true if the provider can make requests, false otherwise
   */
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// Abstract Base Provider
// ============================================================================

/**
 * Base class for AI provider implementations.
 *
 * Provides common functionality for request building, error handling,
 * and configuration management. Concrete providers extend this class
 * and implement the abstract methods.
 *
 * @abstract
 */
export abstract class BaseProvider implements AIProvider {
  abstract readonly name: ProviderName;

  protected readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = {
      defaultModel: "mimo-v2.5-pro",
      defaultTemperature: 0.7,
      defaultMaxTokens: 4096,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Build the request headers for API calls.
   * @protected
   */
  protected buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /**
   * Build the full API URL for a given endpoint.
   * @protected
   */
  protected buildUrl(endpoint: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    return `${base}/${endpoint.replace(/^\/+/, "")}`;
  }

  /**
   * Merge request options with provider defaults.
   * @protected
   */
  protected mergeDefaults(request: ChatRequest): Required<
    Pick<ChatRequest, "model" | "temperature" | "max_tokens" | "stream">
  > {
    return {
      model: request.model || this.config.defaultModel!,
      temperature: request.temperature ?? this.config.defaultTemperature!,
      max_tokens: request.max_tokens ?? this.config.defaultMaxTokens!,
      stream: request.stream ?? false,
    };
  }

  /**
   * Build the messages array including optional system prompt.
   * @protected
   */
  protected buildMessages(
    request: ChatRequest
  ): ChatRequest["messages"] {
    const messages = [...request.messages];

    if (request.system_prompt) {
      messages.unshift({
        role: "system",
        content: request.system_prompt,
      });
    }

    return messages;
  }

  /**
   * Create a structured ProviderError from an unknown error.
   * @protected
   */
  protected createError(error: unknown): ProviderError {
    if (error instanceof Error) {
      // Check for common HTTP error patterns
      const message = error.message.toLowerCase();

      if (message.includes("401") || message.includes("unauthorized")) {
        return {
          code: "auth_error",
          message: "Authentication failed. Check your API key.",
          retryable: false,
          cause: error,
        };
      }

      if (message.includes("429") || message.includes("rate limit")) {
        return {
          code: "rate_limit",
          message: "Rate limit exceeded. Please retry after a delay.",
          retryable: true,
          cause: error,
        };
      }

      if (message.includes("timeout") || message.includes("abort")) {
        return {
          code: "timeout",
          message: "Request timed out.",
          retryable: true,
          cause: error,
        };
      }

      return {
        code: "unknown",
        message: error.message,
        retryable: false,
        cause: error,
      };
    }

    return {
      code: "unknown",
      message: String(error),
      retryable: false,
      cause: error,
    };
  }

  /**
   * Wrap an operation in a standardized result type.
   * @protected
   */
  protected async execute<T>(
    operation: () => Promise<T>
  ): Promise<ProviderResult<T>> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: this.createError(error) };
    }
  }

  // Subclasses must implement these
  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract streamChat(request: ChatRequest): Promise<StreamResponse>;
  abstract isAvailable(): Promise<boolean>;
}

// ============================================================================
// Provider Factory
// ============================================================================

/** Registry of provider constructors */
const providerRegistry = new Map<
  ProviderName,
  new (config: ProviderConfig) => AIProvider
>();

/**
 * Register a provider implementation.
 *
 * Call this once per provider to make it available via `createProvider()`.
 * Provider implementations register themselves when imported.
 *
 * @param name - The provider name
 * @param constructor - The provider class constructor
 *
 * @example
 * ```typescript
 * // In MimoProvider implementation file:
 * registerProvider("mimo", MimoProvider);
 * ```
 */
export function registerProvider(
  name: ProviderName,
  constructor: new (config: ProviderConfig) => AIProvider
): void {
  providerRegistry.set(name, constructor);
}

/**
 * Create an AI provider instance by name.
 *
 * This is the primary factory function for the Strategy Pattern.
 * It looks up the registered provider and instantiates it with
 * the given configuration.
 *
 * @param name - The provider to create (e.g., "mimo", "openai")
 * @param config - Configuration for the provider
 * @returns An initialized AIProvider instance
 * @throws {Error} If the provider is not registered
 *
 * @example
 * ```typescript
 * const provider = createProvider("mimo", {
 *   apiKey: process.env.MIMO_API_KEY!,
 *   baseUrl: "https://api.mimo.ai/v1",
 * });
 * ```
 */
export function createProvider(
  name: ProviderName,
  config: ProviderConfig
): AIProvider {
  const ProviderClass = providerRegistry.get(name);

  if (!ProviderClass) {
    const registered = Array.from(providerRegistry.keys()).join(", ");
    throw new Error(
      `AI provider "${name}" is not registered. ` +
        `Available providers: ${registered || "none"}. ` +
        `Import the provider implementation before using createProvider().`
    );
  }

  return new ProviderClass(config);
}

/**
 * List all registered provider names.
 *
 * @returns Array of registered provider names
 */
export function getRegisteredProviders(): ProviderName[] {
  return Array.from(providerRegistry.keys());
}

// ============================================================================
// Helper: Parse SSE Stream
// ============================================================================

/**
 * Parse an SSE (Server-Sent Events) stream from a fetch Response into
 * an async iterable of StreamChunks.
 *
 * This is a reusable helper for OpenAI-compatible streaming APIs.
 * The SSE format is:
 * ```
 * data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}
 * data: {"id":"...","choices":[{"delta":{"content":" world"}}]}
 * data: [DONE]
 * ```
 *
 * @param response - The fetch Response with an SSE body
 * @yields Parsed StreamChunk objects
 * @throws {ProviderError} If the stream cannot be parsed
 */
export async function* parseSSEStream(
  response: Response
): AsyncGenerator<StreamChunk> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw {
      code: "stream_error",
      message: "Response body is not readable",
      retryable: false,
    } satisfies ProviderError;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith(":")) continue;

        // Check for stream termination
        if (trimmed === "data: [DONE]") return;

        // Parse SSE data
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);

          try {
            const raw = JSON.parse(jsonStr);
            // Transform OpenAI-compatible format to StreamChunk:
            // Raw: { id, model, choices: [{ delta: { content }, finish_reason }] }
            // StreamChunk: { id, model, delta: { content }, finish_reason }
            const chunk: StreamChunk = {
              id: raw.id ?? "",
              model: raw.model ?? "",
              delta: raw.choices?.[0]?.delta ?? {},
              finish_reason: raw.choices?.[0]?.finish_reason ?? null,
            };
            yield chunk;
          } catch {
            // Skip malformed JSON lines
            console.warn("[AI Provider] Skipping malformed SSE line:", trimmed);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
