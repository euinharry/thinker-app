import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures the mock is available when vi.mock is hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    conversation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@/lib/db', () => ({ default: mockPrisma }));

import {
  createConversation,
  getConversationById,
  listConversations,
  updateConversation,
  deleteConversation,
} from '../conversations';

const fixedDate = new Date('2025-01-01T00:00:00Z');

const baseConversation = {
  id: 'conv-1',
  title: 'New Conversation',
  createdAt: fixedDate,
  updatedAt: fixedDate,
};

describe('conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createConversation ─────────────────────────────

  describe('createConversation', () => {
    it('should create conversation with default title', async () => {
      mockPrisma.conversation.create.mockResolvedValue(baseConversation);

      const result = await createConversation();

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: { title: 'New Conversation' },
      });
      expect(result).toEqual(baseConversation);
    });

    it('should create conversation with custom title', async () => {
      const custom = { ...baseConversation, title: 'Custom Title' };
      mockPrisma.conversation.create.mockResolvedValue(custom);

      const result = await createConversation({ title: 'Custom Title' });

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: { title: 'Custom Title' },
      });
      expect(result.title).toBe('Custom Title');
    });
  });

  // ── getConversationById ────────────────────────────

  describe('getConversationById', () => {
    it('should return conversation with messages', async () => {
      const full = {
        ...baseConversation,
        messages: [
          {
            id: 'msg-1',
            content: 'Hello',
            role: 'user',
            agentId: null,
            replyTo: null,
            createdAt: fixedDate,
          },
        ],
        _count: { messages: 1 },
      };
      mockPrisma.conversation.findUnique.mockResolvedValue(full);

      const result = await getConversationById('conv-1');

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              content: true,
              role: true,
              agentId: true,
              replyTo: true,
              createdAt: true,
            },
          },
          _count: { select: { messages: true } },
        },
      });
      expect(result!.messages).toHaveLength(1);
      expect(result!._count.messages).toBe(1);
    });

    it('should return null for nonexistent conversation', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const result = await getConversationById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ── listConversations (pagination) ─────────────────

  describe('listConversations', () => {
    it('should return conversations with default pagination', async () => {
      const convs = [
        { ...baseConversation, _count: { messages: 5 } },
        { ...baseConversation, id: 'conv-2', _count: { messages: 3 } },
      ];
      mockPrisma.conversation.findMany.mockResolvedValue(convs);

      const result = await listConversations();

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: 'desc' },
        cursor: undefined,
        skip: 0,
        take: 21,
        include: {
          _count: { select: { messages: true } },
        },
      });
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should detect hasMore and return nextCursor', async () => {
      const convs = Array.from({ length: 21 }, (_, i) => ({
        ...baseConversation,
        id: `conv-${i}`,
        _count: { messages: 0 },
      }));
      mockPrisma.conversation.findMany.mockResolvedValue(convs);

      const result = await listConversations({ limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('conv-19');
    });

    it('should use cursor for subsequent pages', async () => {
      const convs = [
        { ...baseConversation, id: 'conv-5', _count: { messages: 0 } },
      ];
      mockPrisma.conversation.findMany.mockResolvedValue(convs);

      const result = await listConversations({
        cursor: 'conv-4',
        limit: 10,
      });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'conv-4' },
          skip: 1,
          take: 11,
        }),
      );
      expect(result.hasMore).toBe(false);
    });

    it('should clamp limit between 1 and 100', async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);

      await listConversations({ limit: 500 });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 }),
      );
    });
  });

  // ── updateConversation ─────────────────────────────

  describe('updateConversation', () => {
    it('should update conversation title', async () => {
      const updated = { ...baseConversation, title: 'Updated Title' };
      mockPrisma.conversation.update.mockResolvedValue(updated);

      const result = await updateConversation('conv-1', {
        title: 'Updated Title',
      });

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { title: 'Updated Title' },
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  // ── deleteConversation ─────────────────────────────

  describe('deleteConversation', () => {
    it('should delete conversation by id', async () => {
      mockPrisma.conversation.delete.mockResolvedValue(baseConversation);

      const result = await deleteConversation('conv-1');

      expect(mockPrisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
      });
      expect(result).toEqual(baseConversation);
    });
  });
});
