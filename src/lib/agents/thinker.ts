/**
 * Thinker Agent Implementation
 *
 * The Thinker agent is the team's task planner and feasibility analyzer.
 * It uses the mimo-v2.5-pro AI provider to generate responses
 * based on its personality and system prompt.
 *
 * ## Usage
 *
 * ```typescript
 * import { ThinkerAgent } from "@/lib/agents/thinker";
 *
 * const thinker = new ThinkerAgent();
 * const response = await thinker.chat("How should we plan this project?");
 * console.log(response);
 * ```
 *
 * ## Architecture
 *
 * ```
 * ThinkerAgent
 *    ├── Personality: from personalities.ts
 *    ├── Provider: MimoProvider (mimo-v2.5-pro)
 *    └── Methods: chat(), streamChat(), getAgentInfo()
 * ```
 *
 * @module lib/agents/thinker
 */

import { getAgentByName } from "./personalities";
import { MimoProvider } from "@/lib/ai/mimo-provider";
import type { ChatRequest, ChatResponse, StreamResponse } from "@/types/ai";
import type { Agent, AgentType } from "@/types/agent";

/**
 * Configuration for the Thinker agent.
 */
export interface ThinkerAgentConfig {
  /** AI model to use (default: "mimo-v2.5-pro") */
  model?: string;
  /** Sampling temperature (default: 0.7) */
  temperature?: number;
  /** Maximum tokens for responses (default: 4096) */
  maxTokens?: number;
}

/**
 * Thinker Agent - Task Planner
 *
 * The Thinker agent focuses on breaking down complex problems into
 * actionable plans, analyzing feasibility, and estimating effort.
 *
 * @example
 * ```typescript
 * const thinker = new ThinkerAgent();
 * const response = await thinker.chat("How should we structure this feature?");
 * ```
 */
export class ThinkerAgent {
  /** The agent personality definition */
  private readonly agent: Agent;

  /** The AI provider for generating responses */
  private readonly provider: MimoProvider;

  /** Agent configuration */
  private readonly config: Required<ThinkerAgentConfig>;

  /** Agent type identifier */
  readonly agentType: AgentType = "thinker";

  constructor(config: ThinkerAgentConfig = {}) {
    this.agent = getAgentByName("thinker");

    this.config = {
      model: config.model ?? "mimo-v2.5-pro",
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
    };

    // Initialize the mimo provider with environment config
    this.provider = new MimoProvider({
      apiKey: process.env.MIMO_API_KEY ?? "",
      baseUrl: process.env.MIMO_BASE_URL ?? "",
    });
  }

  /**
   * Send a message to the Thinker agent and get a response.
   *
   * The agent uses its system prompt to guide its response,
   * focusing on task decomposition and structured planning.
   *
   * @param message - The user's message
   * @returns The agent's response text
   * @throws {ProviderError} If the AI provider fails
   *
   * @example
   * ```typescript
   * const thinker = new ThinkerAgent();
   * const response = await thinker.chat("Break down this project into tasks");
   * console.log(response); // Structured plan with task breakdown
   * ```
   */
  async chat(message: string): Promise<string> {
    if (!message.trim()) {
      throw new Error("Message cannot be empty");
    }

    const request: ChatRequest = {
      messages: [{ role: "user", content: message }],
      model: this.config.model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      system_prompt: this.agent.systemPrompt,
      agent_name: this.agent.name,
    };

    try {
      const response: ChatResponse = await this.provider.chat(request);

      // Extract the response content from the first choice
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from AI provider");
      }

      return content;
    } catch (error) {
      // Re-throw provider errors as-is
      if (error && typeof error === "object" && "code" in error) {
        throw error;
      }

      // Wrap unexpected errors
      throw new Error(
        `Thinker agent failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send a message to the Thinker agent and receive a streaming response.
   *
   * Returns an async iterable `StreamResponse` that yields `StreamChunk`
   * objects as the AI generates them. Use this for real-time UI updates.
   *
   * @param message - The user's message
   * @returns Async iterable stream of response chunks
   * @throws {ProviderError} If the AI provider fails
   *
   * @example
   * ```typescript
   * const thinker = new ThinkerAgent();
   * const stream = await thinker.streamChat("Plan this feature...");
   * for await (const chunk of stream) {
   *   process.stdout.write(chunk.delta.content ?? "");
   * }
   * ```
   */
  async streamChat(message: string): Promise<StreamResponse> {
    if (!message.trim()) {
      throw new Error("Message cannot be empty");
    }

    const request: ChatRequest = {
      messages: [{ role: "user", content: message }],
      model: this.config.model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      system_prompt: this.agent.systemPrompt,
      agent_name: this.agent.name,
    };

    try {
      return await this.provider.streamChat(request);
    } catch (error) {
      // Re-throw provider errors as-is
      if (error && typeof error === "object" && "code" in error) {
        throw error;
      }

      // Wrap unexpected errors
      throw new Error(
        `Thinker agent stream failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get the agent's personality information.
   *
   * @returns Lightweight agent reference for UI display
   */
  getAgentInfo(): { id: AgentType; name: string; personality: string; avatar: string } {
    return {
      id: this.agent.id,
      name: this.agent.name,
      personality: this.agent.personality,
      avatar: this.agent.avatar,
    };
  }

  /**
   * Get the agent's full system prompt.
   *
   * @returns The system prompt used to guide the agent's behavior
   */
  getSystemPrompt(): string {
    return this.agent.systemPrompt;
  }
}
