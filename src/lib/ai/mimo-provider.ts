/**
 * mimo-v2.5-pro AI Provider Implementation
 *
 * Implements the AIProvider interface for the mimo-v2.5-pro API,
 * which uses an OpenAI-compatible REST API format.
 *
 * ## Configuration
 *
 * ```typescript
 * const provider = new MimoProvider({
 *   apiKey: process.env.MIMO_API_KEY!,
 *   baseUrl: process.env.MIMO_BASE_URL!,
 * });
 * ```
 *
 * ## API Compatibility
 *
 * The mimo API follows the OpenAI Chat Completions format:
 * - Endpoint: `POST {baseUrl}/chat/completions`
 * - Auth: Bearer token in Authorization header
 * - Request/response shapes match OpenAI's spec
 *
 * ## Connection Drop Handling
 *
 * Streaming connections can fail due to network issues, timeouts, or
 * server errors. The `streamChat()` method handles this by:
 *
 * - Retrying on transient errors (429 rate limit, 5xx server errors)
 * - Using AbortController for client-side cancellation
 * - Wrapping the async iterator with error recovery
 *
 * @module lib/ai/mimo-provider
 */

import { BaseProvider, registerProvider, parseSSEStream } from "./provider";
import type {
  ChatRequest,
  ChatResponse,
  ProviderError,
  ProviderName,
  StreamChunk,
  StreamResponse,
} from "@/types/ai";

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of retry attempts for transient failures */
const MAX_STREAM_RETRIES = 3;

/** Base delay between retries in milliseconds (exponential backoff) */
const RETRY_BASE_DELAY_MS = 1000;

/** HTTP status codes that are safe to retry */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * mimo-v2.5-pro AI Provider.
 *
 * Extends BaseProvider to implement the mimo API, which is
 * OpenAI-compatible. Uses the `fetch` API for HTTP requests.
 *
 * @example
 * ```typescript
 * const provider = new MimoProvider({
 *   apiKey: "sk-...",
 *   baseUrl: "https://api.mimo.ai/v1",
 * });
 *
 * const response = await provider.chat({
 *   messages: [{ role: "user", content: "Hello!" }],
 *   model: "mimo-v2.5-pro",
 * });
 * ```
 */
export class MimoProvider extends BaseProvider {
  readonly name: ProviderName = "mimo";

  /**
   * Send a chat completion request and return the full response.
   *
   * @param request - Chat request with messages and config
   * @returns Complete chat response
   * @throws {ProviderError} If the API request fails
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const defaults = this.mergeDefaults(request);
    const messages = this.buildMessages(request);

    const url = this.buildUrl("chat/completions");
    const headers = this.buildHeaders();

    const body = JSON.stringify({
      model: defaults.model,
      messages,
      temperature: defaults.temperature,
      max_tokens: defaults.max_tokens,
      stream: false,
    });

    const result = await this.execute(async () => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `mimo API error ${response.status}: ${errorText}`
        );
      }

      return (await response.json()) as ChatResponse;
    });

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * Send a chat completion request and return a streaming response.
   *
   * Initiates a streaming request to the mimo API with `"stream": true`.
   * The returned `StreamResponse` is an async iterable that yields
   * `StreamChunk` objects as they arrive via SSE.
   *
   * ## Connection Drop Handling
   *
   * If the initial request fails with a retryable error (rate limit,
   * server error), the method retries with exponential backoff up to
   * `MAX_STREAM_RETRIES` times. Once the stream is established, the
   * `parseSSEStream()` helper handles the SSE protocol. If the stream
   * breaks mid-read, the error propagates to the consumer.
   *
   * @param request - Chat request with messages and config
   * @returns Async iterable stream of response chunks
   * @throws {ProviderError} If the API request fails after retries
   */
  async streamChat(request: ChatRequest): Promise<StreamResponse> {
    const defaults = this.mergeDefaults(request);
    const messages = this.buildMessages(request);

    const url = this.buildUrl("chat/completions");
    const headers = this.buildHeaders();

    const body = JSON.stringify({
      model: defaults.model,
      messages,
      temperature: defaults.temperature,
      max_tokens: defaults.max_tokens,
      stream: true,
    });

    // Retry loop for transient connection failures
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const result = await this.execute(async () => {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(this.config.timeout!),
        });

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => "Unknown error");
          const error = new Error(
            `mimo API error ${response.status}: ${errorText}`
          );
          // Attach status code for retry decision
          (error as Error & { status?: number }).status = response.status;
          throw error;
        }

        return response;
      });

      if (result.success) {
        const response = result.data;
        const streamId = `stream-${Date.now()}`;

        return {
          id: streamId,
          model: defaults.model,
          [Symbol.asyncIterator]() {
            return parseSSEStream(response);
          },
        };
      }

      // Check if the error is retryable
      lastError = result.error;
      const providerError = result.error as ProviderError;

      // Only retry on retryable provider errors
      if (!providerError.retryable) {
        throw providerError;
      }

      // Check if the underlying HTTP status is retryable
      const cause = providerError.cause;
      if (cause instanceof Error && "status" in cause) {
        const status = (cause as Error & { status?: number }).status;
        if (status !== undefined && !RETRYABLE_STATUS_CODES.has(status)) {
          throw providerError;
        }
      }
    }

    // All retries exhausted
    throw lastError;
  }

  /**
   * Check if the mimo provider is available and configured.
   *
   * Validates that apiKey and baseUrl are set, and optionally
   * makes a lightweight API call to verify connectivity.
   *
   * @returns true if the provider can make requests
   */
  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey || !this.config.baseUrl) {
      return false;
    }

    try {
      const url = this.buildUrl("models");
      const headers = this.buildHeaders();

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

// Self-register the provider so createProvider("mimo", ...) works
registerProvider("mimo", MimoProvider);
