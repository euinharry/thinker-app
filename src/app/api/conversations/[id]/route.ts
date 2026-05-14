/**
 * Conversation By ID API Route
 *
 * GET /api/conversations/[id] - Get a single conversation with its messages.
 *
 * ## Response
 *
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "conversation": {
 *       "id": "conv-123",
 *       "title": "My Chat",
 *       "messages": [...],
 *       "_count": { "messages": 5 }
 *     }
 *   }
 * }
 * ```
 *
 * ## Error Responses
 *
 * - 400: Invalid conversation ID
 * - 404: Conversation not found
 * - 500: Internal server error
 *
 * @module app/api/conversations/[id]/route
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getConversationById } from "@/lib/db/conversations";

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for conversation ID validation.
 */
const IdParamSchema = z.string().min(1, "Conversation ID cannot be empty");

// ============================================================================
// Route Handler
// ============================================================================

/**
 * GET /api/conversations/[id]
 *
 * Returns a single conversation with all its messages.
 *
 * @param request - The incoming HTTP request
 * @param context - Route context with dynamic params (Promise in Next.js 15+)
 * @returns JSON response with conversation or error
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const parsed = IdParamSchema.safeParse(id);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const conversation = await getConversationById(parsed.data);

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversation not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error("[Conversation API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
