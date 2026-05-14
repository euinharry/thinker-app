/**
 * Critic Agent Implementation
 *
 * The Critic agent is the team's quality challenger and risk assessor.
 * It uses the mimo-v2.5-pro AI provider to generate responses
 * based on its personality and system prompt.
 *
 * ## Usage
 *
 * ```typescript
 * import { CriticAgent } from "@/lib/agents/critic";
 *
 * const critic = new CriticAgent();
 * const response = await critic.chat("What are the risks of this approach?");
 * console.log(response);
 * ```
 *
 * ## Architecture
 *
 * ```
 * CriticAgent
 *    ├── Personality: from personalities.ts
 *    ├── Provider: MimoProvider (mimo-v2.5-pro)
 *    └── Methods: chat(), streamChat(), getAgentInfo()
 * ```
 *
 * @module lib/agents/critic
 */

import { getAgentByName } from "./personalities";
import { MimoProvider } from "@/lib/ai/mimo-provider";
import type { ChatRequest, ChatResponse, StreamResponse } from "@/types/ai";
import type { Agent, AgentType } from "@/types/agent";

/**
 * Configuration for the Critic agent.
 */
export interface CriticAgentConfig {
  /** AI model to use (default: "mimo-v2.5-pro") */
  model?: string;
  /** Sampling temperature (default: 0.7) */
  temperature?: number;
  /** Maximum tokens for responses (default: 4096) */
  maxTokens?: number;
}

/**
 * Critic Agent - Quality Challenger
 *
 * The Critic agent focuses on scrutinizing plans, identifying risks,
 * challenging assumptions, and ensuring quality standards.
 *
 * @example
 * ```typescript
 * const critic = new CriticAgent();
 * const response = await critic.chat("What could go wrong with this plan?");
 * ```
 */
export class CriticAgent {
  /** The agent personality definition */
  private readonly agent: Agent;

  /** The AI provider for generating responses */
  private readonly provider: MimoProvider;

  /** Agent configuration */
  private readonly config: Required<CriticAgentConfig>;

  /** Agent type identifier */
  readonly agentType: AgentType = "critic";

  constructor(config: CriticAgentConfig = {}) {
    this.agent = getAgentByName("critic");

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
   * Send a message to the Critic agent and get a response.
   *
   * The agent uses its system prompt to guide its response,
   * focusing on critical analysis and risk identification.
   *
   * @param message - The user's message
   * @returns The agent's response text
   * @throws {ProviderError} If the AI provider fails
   *
   * @example
   * ```typescript
   * const critic = new CriticAgent();
   * const response = await critic.chat("Review this architecture");
   * console.log(response); // Critical analysis with risks and concerns
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
        `Critic agent failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send a message to the Critic agent and receive a streaming response.
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
   * const critic = new CriticAgent();
   * const stream = await critic.streamChat("Critique this design...");
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
        `Critic agent stream failed: ${error instanceof Error ? error.message : String(error)}`
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
