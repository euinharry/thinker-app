/**
 * Chat API Route
 *
 * POST /api/chat - Send a message to agents and get responses.
 *
 * ## Request Body
 *
 * ```json
 * {
 *   "message": "How should we approach this project?",
 *   "agent": "leader"  // optional, omit for orchestrated multi-agent response
 * }
 * ```
 *
 * ## Response (Orchestrated - no agent specified)
 *
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "responses": [
 *       { "agent": { "id": "leader", "name": "Leader", "avatar": "👑" }, "response": "...", "success": true },
 *       { "agent": { "id": "explorer", "name": "Explorer", "avatar": "🔍" }, "response": "...", "success": true },
 *       { "agent": { "id": "thinker", "name": "Thinker", "avatar": "🧠" }, "response": "...", "success": true },
 *       { "agent": { "id": "critic", "name": "Critic", "avatar": "🎯" }, "response": "...", "success": true }
 *     ]
 *   }
 * }
 * ```
 *
 * ## Response (Single agent - agent specified)
 *
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "response": "Strategic analysis...",
 *     "agent": { "id": "leader", "name": "Leader", "avatar": "👑" }
 *   }
 * }
 * ```
 *
 * ## Error Responses
 *
 * - 400: Invalid request body (missing message, invalid agent)
 * - 500: Internal server error (AI provider failure)
 *
 * @module app/api/chat/route
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { LeaderAgent } from "@/lib/agents/leader";
import { ExplorerAgent } from "@/lib/agents/explorer";
import { ThinkerAgent } from "@/lib/agents/thinker";
import { CriticAgent } from "@/lib/agents/critic";
import { Orchestrator } from "@/lib/agents/orchestrator";
import { isValidAgentType } from "@/lib/agents/personalities";

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for chat request validation.
 *
 * Validates:
 * - message: non-empty string
 * - agent: optional, must be a valid agent type if provided
 */
const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(10000, "Message too long (max 10,000 characters)"),
  agent: z
    .string()
    .optional()
    .refine(
      (val) => !val || isValidAgentType(val),
      "Invalid agent type. Must be one of: leader, explorer, thinker, critic"
    ),
});

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create an agent instance by type.
 *
 * Supports all four agent types: leader, explorer, thinker, critic.
 *
 * @param agentType - The agent type to create
 * @returns Agent instance
 * @throws {Error} If the agent type is not recognized
 */
function createAgent(agentType: string) {
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
// Route Handler
// ============================================================================

/**
 * POST /api/chat
 *
 * Handles chat requests by validating the body, then either:
 * - Orchestrating all 4 agents in parallel (when no agent specified)
 * - Routing to a single agent (when agent is specified via @mention)
 *
 * @param request - The incoming HTTP request
 * @returns JSON response with agent reply or error
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    // Validate with Zod
    const parsed = ChatRequestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: errors,
        },
        { status: 400 }
      );
    }

    const { message, agent: agentType } = parsed.data;

    // Single-agent path: when a specific agent is requested
    if (agentType) {
      const agent = createAgent(agentType);
      const response = await agent.chat(message);

      return NextResponse.json({
        success: true,
        data: {
          response,
          agent: agent.getAgentInfo(),
        },
      });
    }

    // Orchestrated path: all 4 agents respond in parallel
    const orchestrator = new Orchestrator();
    const responses = await orchestrator.orchestrate(message);

    return NextResponse.json({
      success: true,
      data: { responses },
    });
  } catch (error) {
    console.error("[Chat API] Error:", error);

    // Handle known provider errors
    if (error && typeof error === "object" && "code" in error) {
      const providerError = error as { code: string; message: string };
      return NextResponse.json(
        {
          success: false,
          error: providerError.message,
          code: providerError.code,
        },
        { status: 502 }
      );
    }

    // Handle agent initialization errors
    if (error instanceof Error && error.message.includes("not recognized")) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
