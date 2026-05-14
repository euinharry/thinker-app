/**
 * Streaming Orchestrator
 *
 * Coordinates agents with real-time streaming for the primary agent.
 * The primary agent (Leader) streams its response in real-time via
 * `for await`, then the supplement decider evaluates which agents
 * should supplement based on domain keyword coverage. Only agents
 * whose domains are not covered are executed in parallel.
 *
 * ## Event Flow
 *
 * 1. `primary_start` — primary agent begins streaming
 * 2. `primary_chunk` × N — real-time deltas from primary
 * 3. `primary_end` — primary finished, full response included
 * 4. `supplement_decision` — which agents will supplement (and why)
 * 5. Per supplement agent (parallel, filtered by decider):
 *    - `supplement_start`
 *    - `supplement_response`
 *    - `supplement_end`
 * 6. `done` — orchestration complete
 *
 * @module lib/agents/streaming-orchestrator
 */

import { LeaderAgent } from "./leader";
import { ExplorerAgent } from "./explorer";
import { ThinkerAgent } from "./thinker";
import { CriticAgent } from "./critic";
import { analyzeMessage } from "./message-analyzer";
import { decideSupplements } from "./supplement-decider";
import type { SupplementDecision } from "./supplement-decider";
import { sortSupplements } from "./relevance-sorter";
import type { SupplementDecision as RelevanceSupplementDecision } from "./relevance-sorter";
import type { AgentInfo } from "./orchestrator";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Event Types
// ============================================================================

export interface PrimaryStartEvent {
  type: "primary_start";
  agent: AgentInfo;
}

export interface PrimaryChunkEvent {
  type: "primary_chunk";
  delta: string;
}

export interface PrimaryEndEvent {
  type: "primary_end";
  fullResponse: string;
}

export interface SupplementDecisionEvent {
  type: "supplement_decision";
  decisions: SupplementDecision[];
}

export interface SupplementStartEvent {
  type: "supplement_start";
  agent: AgentInfo;
}

export interface SupplementResponseEvent {
  type: "supplement_response";
  agent: AgentInfo;
  response: string;
}

export interface SupplementEndEvent {
  type: "supplement_end";
  agent: AgentInfo;
}

export interface DoneEvent {
  type: "done";
}

export type OrchestrationEvent =
  | PrimaryStartEvent
  | PrimaryChunkEvent
  | PrimaryEndEvent
  | SupplementDecisionEvent
  | SupplementStartEvent
  | SupplementResponseEvent
  | SupplementEndEvent
  | DoneEvent;

// ============================================================================
// Agent Factory
// ============================================================================

const ALL_AGENT_TYPES: AgentType[] = ["leader", "explorer", "thinker", "critic"];

function createAgent(agentType: AgentType) {
  switch (agentType) {
    case "leader":
      return new LeaderAgent();
    case "explorer":
      return new ExplorerAgent();
    case "thinker":
      return new ThinkerAgent();
    case "critic":
      return new CriticAgent();
    default:
      throw new Error(`Agent "${agentType}" is not recognized`);
  }
}

// ============================================================================
// StreamingOrchestrator
// ============================================================================

export class StreamingOrchestrator {
  async *orchestrateStream(message: string): AsyncIterable<OrchestrationEvent> {
    // Analyze message to determine the primary agent dynamically
    const analysis = analyzeMessage(message);
    const primaryAgentType = analysis.primaryAgent;
    const primaryAgent = createAgent(primaryAgentType);

    // Emit primary_start
    const primaryInfo = primaryAgent.getAgentInfo();
    yield { type: "primary_start", agent: primaryInfo };

    // Stream primary agent in real-time
    let fullResponse: string;

    try {
      const stream = await primaryAgent.streamChat(message);
      fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.delta?.content;
        if (content !== undefined && content !== "") {
          fullResponse += content;
          yield { type: "primary_chunk", delta: content };
        }
      }
    } catch (error) {
      fullResponse = "";
    }

    // Emit primary_end with full response
    yield { type: "primary_end", fullResponse };

    // Use supplement decider to determine which agents should supplement.
    const decisions = decideSupplements(primaryAgentType, fullResponse, ALL_AGENT_TYPES);

    // Yield supplement_decision event for transparency
    yield { type: "supplement_decision", decisions };

    // Filter to only agents that should supplement, then create instances
    const supplementAgents = decisions
      .filter((d) => d.shouldSupplement)
      .map((d) => createAgent(d.agent));

    // Execute supplement agents in parallel via Promise.allSettled()
    const supplementPromises = supplementAgents.map(async (agent) => {
      const info = agent.getAgentInfo();
      try {
        const response = await agent.chat(message);
        return { info, response, success: true as const, error: undefined };
      } catch (error) {
        return {
          info,
          response: "",
          success: false as const,
          error:
            error instanceof Error
              ? error.message
              : String(error ?? "Agent failed"),
        };
      }
    });

    const results = await Promise.allSettled(supplementPromises);

    // Map agent type → result (info + response) for sorted lookup
    const resultMap = new Map<AgentType, { info: AgentInfo; response: string }>();

    const activeDecisions = decisions.filter((d) => d.shouldSupplement);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const decision = activeDecisions[i];

      if (result.status === "fulfilled") {
        resultMap.set(decision.agent, {
          info: result.value.info,
          response: result.value.response,
        });
      } else {
        // Rejected: create info and use empty response
        const agent = createAgent(decision.agent);
        resultMap.set(decision.agent, {
          info: agent.getAgentInfo(),
          response: "",
        });
      }
    }

    // Build relevance-sorter decisions from supplement results.
    // Use response content as the reason field so sortSupplements scores
    // based on keyword overlap between primary response and supplement content.
    const relevanceSupplements: RelevanceSupplementDecision[] =
      activeDecisions.map((d) => ({
        agentType: d.agent,
        reason: resultMap.get(d.agent)?.response ?? "",
        content: resultMap.get(d.agent)?.response ?? "",
      }));

    // Sort supplements by relevance to primary response
    const sorted = sortSupplements(fullResponse, relevanceSupplements);

    // Fall back to original order if sorting returns empty (empty primary response)
    const finalOrder = sorted.length > 0 ? sorted : relevanceSupplements;

    // Emit supplement events in relevance-sorted order
    for (const supplement of finalOrder) {
      const result = resultMap.get(supplement.agentType)!;
      yield { type: "supplement_start", agent: result.info };
      yield { type: "supplement_response", agent: result.info, response: supplement.content };
      yield { type: "supplement_end", agent: result.info };
    }

    // Emit done
    yield { type: "done" };
  }
}
