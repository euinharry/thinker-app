/**
 * Explorer Agent Implementation
 *
 * The Explorer agent is the team's technical researcher and information gatherer.
 * It uses the mimo-v2.5-pro AI provider to generate responses
 * based on its personality and system prompt.
 *
 * ## Usage
 *
 * ```typescript
 * import { ExplorerAgent } from "@/lib/agents/explorer";
 *
 * const explorer = new ExplorerAgent();
 * const response = await explorer.chat("What technologies should we use?");
 * console.log(response);
 * ```
 *
 * ## Architecture
 *
 * ```
 * ExplorerAgent
 *    ├── Personality: from personalities.ts
 *    ├── Provider: MimoProvider (mimo-v2.5-pro)
 *    └── Methods: chat(), streamChat(), getAgentInfo()
 * ```
 *
 * @module lib/agents/explorer
 */

import { getAgentByName } from "./personalities";
import { MimoProvider } from "@/lib/ai/mimo-provider";
import type { ChatRequest, ChatResponse, StreamResponse } from "@/types/ai";
import type { Agent, AgentType } from "@/types/agent";

/**
 * Configuration for the Explorer agent.
 */
export interface ExplorerAgentConfig {
  /** AI model to use (default: "mimo-v2.5-pro") */
  model?: string;
  /** Sampling temperature (default: 0.7) */
  temperature?: number;
  /** Maximum tokens for responses (default: 4096) */
  maxTokens?: number;
}

/**
 * Explorer Agent - Technical Researcher
 *
 * The Explorer agent focuses on researching technologies, exploring solutions,
 * and providing technical context for team decisions.
 *
 * @example
 * ```typescript
 * const explorer = new ExplorerAgent();
 * const response = await explorer.chat("What frameworks should we consider?");
 * ```
 */
export class ExplorerAgent {
  /** The agent personality definition */
  private readonly agent: Agent;

  /** The AI provider for generating responses */
  private readonly provider: MimoProvider;

  /** Agent configuration */
  private readonly config: Required<ExplorerAgentConfig>;

  /** Agent type identifier */
  readonly agentType: AgentType = "explorer";

  constructor(config: ExplorerAgentConfig = {}) {
    this.agent = getAgentByName("explorer");

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
   * Send a message to the Explorer agent and get a response.
   *
   * The agent uses its system prompt to guide its response,
   * focusing on technical research and solution exploration.
   *
   * @param message - The user's message
   * @returns The agent's response text
   * @throws {ProviderError} If the AI provider fails
   *
   * @example
   * ```typescript
   * const explorer = new ExplorerAgent();
   * const response = await explorer.chat("What are the best state management options?");
   * console.log(response); // Technical research and comparisons
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
        `Explorer agent failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send a message to the Explorer agent and receive a streaming response.
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
   * const explorer = new ExplorerAgent();
   * const stream = await explorer.streamChat("Research these frameworks...");
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
        `Explorer agent stream failed: ${error instanceof Error ? error.message : String(error)}`
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
