/**
 * Conversations API Route
 *
 * GET /api/conversations - List conversations with cursor-based pagination.
 *
 * ## Query Parameters
 *
 * | Param  | Type   | Default | Description                          |
 * |--------|--------|---------|--------------------------------------|
 * | cursor | string | -       | Conversation ID to start after       |
 * | limit  | number | 20      | Number of results (1-100)            |
 *
 * ## Response
 *
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "conversations": [...],
 *     "nextCursor": "conv-xyz" | null,
 *     "hasMore": false
 *   }
 * }
 * ```
 *
 * ## Error Responses
 *
 * - 400: Invalid query parameters
 * - 500: Internal server error
 *
 * @module app/api/conversations/route
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { listConversations } from "@/lib/db/conversations";

// ============================================================================
// Request Validation Schema
// ============================================================================

/**
 * Zod schema for query parameter validation.
 *
 * Validates:
 * - cursor: optional non-empty string (conversation ID)
 * - limit: optional number between 1 and 100, defaults to 20
 */
const ListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

// ============================================================================
// Route Handler
// ============================================================================

/**
 * GET /api/conversations
 *
 * Returns a paginated list of conversations ordered by most recently updated.
 * Supports cursor-based pagination via `cursor` and `limit` query params.
 *
 * @param request - The incoming HTTP request
 * @returns JSON response with conversations or error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = ListQuerySchema.safeParse({
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

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

    const { cursor, limit } = parsed.data;
    const result = await listConversations({ cursor, limit });

    return NextResponse.json({
      success: true,
      data: {
        conversations: result.data,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("[Conversations API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
