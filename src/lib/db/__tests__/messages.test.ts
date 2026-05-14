import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures the mock is available when vi.mock is hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    message: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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
  createMessage,
  getMessageById,
  getMessagesByConversation,
  updateMessage,
  deleteMessage,
  getMessageWithReplies,
  getThread,
} from '../messages';

const fixedDate = new Date('2025-01-01T00:00:00Z');

const baseMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  content: 'Hello',
  role: 'user' as const,
  agentId: null,
  replyTo: null,
  createdAt: fixedDate,
};

describe('messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createMessage ──────────────────────────────────

  describe('createMessage', () => {
    it('should create a message with required fields', async () => {
      mockPrisma.message.create.mockResolvedValue(baseMessage);

      const result = await createMessage({
        conversationId: 'conv-1',
        content: 'Hello',
        role: 'user',
      });

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-1',
          content: 'Hello',
          role: 'user',
          agentId: null,
          replyTo: null,
        },
      });
      expect(result).toEqual(baseMessage);
    });

    it('should create a message with agentId and replyTo', async () => {
      const msgWithAgent = {
        ...baseMessage,
        agentId: 'agent-1',
        replyTo: 'msg-0',
      };
      mockPrisma.message.findUnique.mockResolvedValue({
        conversationId: 'conv-1',
      });
      mockPrisma.message.create.mockResolvedValue(msgWithAgent);

      const result = await createMessage({
        conversationId: 'conv-1',
        content: 'Reply',
        role: 'agent',
        agentId: 'agent-1',
        replyTo: 'msg-0',
      });

      expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-0' },
        select: { conversationId: true },
      });
      expect(result.agentId).toBe('agent-1');
      expect(result.replyTo).toBe('msg-0');
    });

    it('should throw if parent message not found', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      await expect(
        createMessage({
          conversationId: 'conv-1',
          content: 'Reply',
          role: 'user',
          replyTo: 'nonexistent',
        }),
      ).rejects.toThrow('Parent message nonexistent not found');
    });

    it('should throw if parent message is in different conversation', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        conversationId: 'conv-other',
      });

      await expect(
        createMessage({
          conversationId: 'conv-1',
          content: 'Reply',
          role: 'user',
          replyTo: 'msg-other-conv',
        }),
      ).rejects.toThrow('does not belong to conversation');
    });
  });

  // ── getMessageById ─────────────────────────────────

  describe('getMessageById', () => {
    it('should return message with agent and parent', async () => {
      const fullMessage = {
        ...baseMessage,
        agent: { id: 'agent-1', name: 'Bot' },
        parent: null,
      };
      mockPrisma.message.findUnique.mockResolvedValue(fullMessage);

      const result = await getMessageById('msg-1');

      expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        include: {
          agent: { select: { id: true, name: true } },
          parent: { select: { id: true, content: true } },
        },
      });
      expect(result).toEqual(fullMessage);
    });

    it('should return null for nonexistent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await getMessageById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ── getMessagesByConversation (pagination) ─────────

  describe('getMessagesByConversation', () => {
    it('should return messages with default pagination', async () => {
      const messages = [
        { ...baseMessage, agent: null, parent: null },
        { ...baseMessage, id: 'msg-2', agent: null, parent: null },
      ];
      mockPrisma.message.findMany.mockResolvedValue(messages);

      const result = await getMessagesByConversation('conv-1');

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'asc' },
        cursor: undefined,
        skip: 0,
        take: 51,
        include: {
          agent: { select: { id: true, name: true } },
          parent: { select: { id: true, content: true } },
        },
      });
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should detect hasMore and return nextCursor', async () => {
      const messages = Array.from({ length: 51 }, (_, i) => ({
        ...baseMessage,
        id: `msg-${i}`,
        agent: null,
        parent: null,
      }));
      mockPrisma.message.findMany.mockResolvedValue(messages);

      const result = await getMessagesByConversation('conv-1', { limit: 50 });

      expect(result.data).toHaveLength(50);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('msg-49');
    });

    it('should use cursor for subsequent pages', async () => {
      const messages = [
        { ...baseMessage, id: 'msg-5', agent: null, parent: null },
      ];
      mockPrisma.message.findMany.mockResolvedValue(messages);

      const result = await getMessagesByConversation('conv-1', {
        cursor: 'msg-4',
        limit: 10,
      });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'msg-4' },
          skip: 1,
          take: 11,
        }),
      );
      expect(result.hasMore).toBe(false);
    });

    it('should clamp limit between 1 and 100', async () => {
      mockPrisma.message.findMany.mockResolvedValue([]);

      await getMessagesByConversation('conv-1', { limit: 500 });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 }),
      );
    });
  });

  // ── updateMessage ──────────────────────────────────

  describe('updateMessage', () => {
    it('should update message content', async () => {
      const updated = { ...baseMessage, content: 'Updated' };
      mockPrisma.message.update.mockResolvedValue(updated);

      const result = await updateMessage('msg-1', { content: 'Updated' });

      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { content: 'Updated' },
      });
      expect(result.content).toBe('Updated');
    });
  });

  // ── deleteMessage ──────────────────────────────────

  describe('deleteMessage', () => {
    it('should delete message by id', async () => {
      mockPrisma.message.delete.mockResolvedValue(baseMessage);

      const result = await deleteMessage('msg-1');

      expect(mockPrisma.message.delete).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
      });
      expect(result).toEqual(baseMessage);
    });
  });

  // ── Threading ──────────────────────────────────────

  describe('getMessageWithReplies', () => {
    it('should return message with direct replies', async () => {
      const msgWithReplies = {
        ...baseMessage,
        agent: null,
        replies: [
          { ...baseMessage, id: 'msg-2', content: 'Reply 1', replyTo: 'msg-1' },
          { ...baseMessage, id: 'msg-3', content: 'Reply 2', replyTo: 'msg-1' },
        ],
      };
      mockPrisma.message.findUnique.mockResolvedValue(msgWithReplies);

      const result = await getMessageWithReplies('msg-1');

      expect(result).toBeDefined();
      expect(result!.replies).toHaveLength(2);
      expect(result!.replies[0].replyTo).toBe('msg-1');
    });

    it('should return null for nonexistent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await getMessageWithReplies('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getThread', () => {
    it('should return null for nonexistent root', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const result = await getThread('nonexistent');

      expect(result).toBeNull();
    });

    it('should return root message with empty replies when no replies exist', async () => {
      const root = {
        ...baseMessage,
        agent: null,
        replies: [],
      };
      mockPrisma.message.findUnique.mockResolvedValue(root);

      const result = await getThread('msg-1');

      expect(result).toBeDefined();
      expect(result!.replies).toHaveLength(0);
    });

    it('should recursively fetch nested replies', async () => {
      const root = {
        ...baseMessage,
        id: 'msg-root',
        agent: null,
        replies: [
          {
            ...baseMessage,
            id: 'msg-child',
            replyTo: 'msg-root',
            agent: null,
            replies: [],
          },
        ],
      };
      const child = {
        ...baseMessage,
        id: 'msg-child',
        replyTo: 'msg-root',
        agent: null,
        replies: [],
      };

      // First call: findUnique for root
      // Second call: findUnique for child (recursive)
      mockPrisma.message.findUnique
        .mockResolvedValueOnce(root)
        .mockResolvedValueOnce(child);

      const result = await getThread('msg-root');

      expect(result).toBeDefined();
      expect(result!.replies).toHaveLength(1);
    });
  });
});
