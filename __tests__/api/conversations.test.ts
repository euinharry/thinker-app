/**
 * Conversations API Route Tests
 *
 * Tests for:
 * - GET /api/conversations: list with pagination
 * - GET /api/conversations/[id]: get conversation by ID with messages
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
const { mockListConversations, mockGetConversationById } = vi.hoisted(() => {
  return {
    mockListConversations: vi.fn(),
    mockGetConversationById: vi.fn(),
  };
});

vi.mock("@/lib/db/conversations", () => ({
  listConversations: mockListConversations,
  getConversationById: mockGetConversationById,
}));

import { GET as listGET } from "@/app/api/conversations/route";
import { GET as idGET } from "@/app/api/conversations/[id]/route";

// ── Fixtures ──────────────────────────────────────

const fixedDate = new Date("2025-01-01T00:00:00Z");

function makeConversation(id: string, title = "Test Conversation") {
  return {
    id,
    title,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };
}

function makeConversationWithMessages(
  id: string,
  messages: Array<{ id: string; content: string; role: string }> = []
) {
  return {
    ...makeConversation(id),
    messages: messages.map((m) => ({
      ...m,
      agentId: null,
      replyTo: null,
      createdAt: fixedDate,
    })),
    _count: { messages: messages.length },
  };
}

// ── Helpers ───────────────────────────────────────

function makeRequest(url: string): Request {
  return new Request(url);
}

// ── Tests ─────────────────────────────────────────

describe("Conversations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/conversations
  // =========================================================================

  describe("GET /api/conversations", () => {
    it("returns conversations with default pagination", async () => {
      const convs = [
        { ...makeConversation("conv-1"), _count: { messages: 5 } },
        { ...makeConversation("conv-2"), _count: { messages: 3 } },
      ];
      mockListConversations.mockResolvedValue({
        data: convs,
        nextCursor: null,
        hasMore: false,
      });

      const res = await listGET(makeRequest("http://localhost/api/conversations"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.conversations).toHaveLength(2);
      expect(body.data.hasMore).toBe(false);
      expect(body.data.nextCursor).toBeNull();
      expect(mockListConversations).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 20,
      });
    });

    it("passes cursor and limit from query params", async () => {
      mockListConversations.mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
      });

      const res = await listGET(
        makeRequest("http://localhost/api/conversations?cursor=conv-5&limit=10")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockListConversations).toHaveBeenCalledWith({
        cursor: "conv-5",
        limit: 10,
      });
    });

    it("returns nextCursor and hasMore when more results exist", async () => {
      const convs = Array.from({ length: 10 }, (_, i) => ({
        ...makeConversation(`conv-${i}`),
        _count: { messages: 0 },
      }));
      mockListConversations.mockResolvedValue({
        data: convs,
        nextCursor: "conv-9",
        hasMore: true,
      });

      const res = await listGET(
        makeRequest("http://localhost/api/conversations?limit=10")
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.hasMore).toBe(true);
      expect(body.data.nextCursor).toBe("conv-9");
    });

    it("returns 400 for invalid limit (non-numeric)", async () => {
      const res = await listGET(
        makeRequest("http://localhost/api/conversations?limit=abc")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Validation failed");
    });

    it("returns 400 for limit out of range (> 100)", async () => {
      const res = await listGET(
        makeRequest("http://localhost/api/conversations?limit=500")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it("returns 400 for limit < 1", async () => {
      const res = await listGET(
        makeRequest("http://localhost/api/conversations?limit=0")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it("returns 400 for empty cursor string", async () => {
      const res = await listGET(
        makeRequest("http://localhost/api/conversations?cursor=")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
    });

    it("returns 500 on database error", async () => {
      mockListConversations.mockRejectedValue(new Error("DB connection failed"));

      const res = await listGET(makeRequest("http://localhost/api/conversations"));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Internal server error");
    });

    it("handles limit at boundary (1)", async () => {
      mockListConversations.mockResolvedValue({
        data: [makeConversation("conv-1")],
        nextCursor: null,
        hasMore: false,
      });

      const res = await listGET(
        makeRequest("http://localhost/api/conversations?limit=1")
      );

      expect(res.status).toBe(200);
      expect(mockListConversations).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 1,
      });
    });

    it("handles limit at boundary (100)", async () => {
      mockListConversations.mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
      });

      const res = await listGET(
        makeRequest("http://localhost/api/conversations?limit=100")
      );

      expect(res.status).toBe(200);
      expect(mockListConversations).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 100,
      });
    });
  });

  // =========================================================================
  // GET /api/conversations/[id]
  // =========================================================================

  describe("GET /api/conversations/[id]", () => {
    it("returns conversation with messages", async () => {
      const conv = makeConversationWithMessages("conv-1", [
        { id: "msg-1", content: "Hello", role: "user" },
        { id: "msg-2", content: "Hi there!", role: "assistant" },
      ]);
      mockGetConversationById.mockResolvedValue(conv);

      const res = await idGET(
        makeRequest("http://localhost/api/conversations/conv-1"),
        { params: Promise.resolve({ id: "conv-1" }) }
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.conversation.id).toBe("conv-1");
      expect(body.data.conversation.messages).toHaveLength(2);
      expect(body.data.conversation._count.messages).toBe(2);
      expect(mockGetConversationById).toHaveBeenCalledWith("conv-1");
    });

    it("returns 404 for nonexistent conversation", async () => {
      mockGetConversationById.mockResolvedValue(null);

      const res = await idGET(
        makeRequest("http://localhost/api/conversations/nonexistent"),
        { params: Promise.resolve({ id: "nonexistent" }) }
      );
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Conversation not found");
    });

    it("returns 500 on database error", async () => {
      mockGetConversationById.mockRejectedValue(new Error("DB failure"));

      const res = await idGET(
        makeRequest("http://localhost/api/conversations/conv-1"),
        { params: Promise.resolve({ id: "conv-1" }) }
      );
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Internal server error");
    });

    it("returns conversation with empty messages array", async () => {
      const conv = makeConversationWithMessages("conv-1", []);
      mockGetConversationById.mockResolvedValue(conv);

      const res = await idGET(
        makeRequest("http://localhost/api/conversations/conv-1"),
        { params: Promise.resolve({ id: "conv-1" }) }
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.conversation.messages).toHaveLength(0);
      expect(body.data.conversation._count.messages).toBe(0);
    });

    it("returns messages ordered by createdAt (asc)", async () => {
      const date1 = new Date("2025-01-01T00:00:00Z");
      const date2 = new Date("2025-01-01T00:01:00Z");
      const conv = makeConversationWithMessages("conv-1", [
        { id: "msg-1", content: "First", role: "user" },
        { id: "msg-2", content: "Second", role: "assistant" },
      ]);
      // Override createdAt to verify ordering
      conv.messages[0].createdAt = date1;
      conv.messages[1].createdAt = date2;
      mockGetConversationById.mockResolvedValue(conv);

      const res = await idGET(
        makeRequest("http://localhost/api/conversations/conv-1"),
        { params: Promise.resolve({ id: "conv-1" }) }
      );
      const body = await res.json();

      expect(body.data.conversation.messages[0].content).toBe("First");
      expect(body.data.conversation.messages[1].content).toBe("Second");
    });
  });
});
