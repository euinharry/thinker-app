/**
 * Agents Config API Route
 *
 * GET  /api/agents       - List all agent configs (with default fallback)
 * PUT  /api/agents       - Update a specific agent's config
 *
 * ## GET Response
 *
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "leader": { "name": "Leader", "personality": "...", ... },
 *     "explorer": { "name": "Explorer", ... },
 *     "thinker": { "name": "Thinker", ... },
 *     "critic": { "name": "Critic", ... }
 *   }
 * }
 * ```
 *
 * ## PUT Request Body
 *
 * ```json
 * {
 *   "agentId": "leader",
 *   "name": "Custom Leader",
 *   "personality": "Custom personality",
 *   "systemPrompt": "Custom system prompt",
 *   "model": "mimo-v2.5-pro",
 *   "temperature": 0.7,
 *   "avatar": "👑"
 * }
 * ```
 *
 * ## Error Responses
 *
 * - 400: Validation failed or invalid agent ID
 * - 500: Internal server error
 *
 * @module app/api/agents/route
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAllAgentConfigs,
  saveAgentConfig,
  getAgentConfigWithDefaults,
  type PersistedAgentConfig,
} from "@/lib/agents/config";
import { isValidAgentType } from "@/lib/agents/personalities";
import type { AgentType } from "@/types/agent";

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for PUT request body validation.
 *
 * Validates all agent config fields plus the agentId selector.
 */
const UpdateConfigSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  personality: z
    .string()
    .min(1, "Personality is required")
    .max(500, "Personality too long"),
  systemPrompt: z
    .string()
    .min(1, "System prompt is required")
    .max(5000, "System prompt too long"),
  model: z.string().min(1, "Model is required"),
  temperature: z
    .number()
    .min(0, "Temperature must be >= 0")
    .max(2, "Temperature must be <= 2"),
  avatar: z.string().min(1, "Avatar is required").max(10, "Avatar too long"),
});

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/agents
 *
 * Returns all agent configs with default fallback. Each agent's config
 * includes persisted values from the database, falling back to defaults
 * from personalities.ts for any missing fields.
 *
 * @returns JSON response with all agent configs
 */
export async function GET() {
  try {
    // Get persisted configs (may be null for agents without custom config)
    const persistedConfigs = await getAllAgentConfigs();

    // Merge with defaults so every agent always has a complete config
    const agentTypes: AgentType[] = ["leader", "explorer", "thinker", "critic"];
    const configs: Record<string, PersistedAgentConfig> = {};

    for (const agentType of agentTypes) {
      configs[agentType] =
        persistedConfigs[agentType] ??
        (await getAgentConfigWithDefaults(agentType));
    }

    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    console.error("[Agents API] GET Error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/agents
 *
 * Updates a specific agent's configuration. The agentId field in the
 * request body identifies which agent to update.
 *
 * @param request - The incoming HTTP request with config in body
 * @returns JSON response with success status
 */
export async function PUT(request: Request) {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    // Validate with Zod
    const parsed = UpdateConfigSchema.safeParse(body);

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
        { status: 400 },
      );
    }

    const { agentId, ...config } = parsed.data;

    // Validate agent type
    if (!isValidAgentType(agentId)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid agent ID. Must be one of: leader, explorer, thinker, critic",
        },
        { status: 400 },
      );
    }

    // Save config to database
    await saveAgentConfig(agentId as AgentType, config as PersistedAgentConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Agents API] PUT Error:", error);

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
