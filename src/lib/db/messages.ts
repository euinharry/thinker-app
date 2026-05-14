import prisma from '@/lib/db';
import type { Message } from '@/generated/prisma/client';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateMessageInput {
  conversationId: string;
  content: string;
  role: 'user' | 'agent';
  agentId?: string;
  replyTo?: string;
}

export interface UpdateMessageInput {
  content: string;
}

export interface PaginationOptions {
  cursor?: string; // message id
  limit?: number;  // default 50
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type MessageWithRelations = Message & {
  agent: { id: string; name: string } | null;
  parent: { id: string; content: string } | null;
};

export type MessageWithReplies = Message & {
  agent: { id: string; name: string } | null;
  replies: Message[];
};

// ──────────────────────────────────────────────
// CRUD Operations
// ──────────────────────────────────────────────

/**
 * Create a new message in a conversation.
 * Optionally links to an agent and/or replies to another message.
 */
export async function createMessage(
  input: CreateMessageInput,
): Promise<Message> {
  const { conversationId, content, role, agentId, replyTo } = input;

  // Validate replyTo belongs to same conversation
  if (replyTo) {
    const parent = await prisma.message.findUnique({
      where: { id: replyTo },
      select: { conversationId: true },
    });
    if (!parent) {
      throw new Error(`Parent message ${replyTo} not found`);
    }
    if (parent.conversationId !== conversationId) {
      throw new Error(
        `Parent message ${replyTo} does not belong to conversation ${conversationId}`,
      );
    }
  }

  return prisma.message.create({
    data: {
      conversationId,
      content,
      role,
      agentId: agentId ?? null,
      replyTo: replyTo ?? null,
    },
  });
}

/**
 * Get a single message by ID with agent and parent info.
 */
export async function getMessageById(
  id: string,
): Promise<MessageWithRelations | null> {
  return prisma.message.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true } },
      parent: { select: { id: true, content: true } },
    },
  });
}

/**
 * Get messages in a conversation with cursor-based pagination.
 * Returns messages in chronological order (oldest first).
 */
export async function getMessagesByConversation(
  conversationId: string,
  options: PaginationOptions = {},
): Promise<PaginatedResult<MessageWithRelations>> {
  const { cursor, limit = 50 } = options;
  const take = Math.min(Math.max(limit, 1), 100);

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0, // skip the cursor itself
    take: take + 1, // fetch one extra to determine hasMore
    include: {
      agent: { select: { id: true, name: true } },
      parent: { select: { id: true, content: true } },
    },
  });

  const hasMore = messages.length > take;
  const data = hasMore ? messages.slice(0, take) : messages;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}

/**
 * Update a message's content.
 */
export async function updateMessage(
  id: string,
  input: UpdateMessageInput,
): Promise<Message> {
  return prisma.message.update({
    where: { id },
    data: { content: input.content },
  });
}

/**
 * Delete a message by ID.
 * Note: Schema has no soft-delete column, so this is a hard delete.
 * Replies to this message remain (onDelete: NoAction on parent relation).
 */
export async function deleteMessage(id: string): Promise<Message> {
  return prisma.message.delete({
    where: { id },
  });
}

// ──────────────────────────────────────────────
// Threading
// ──────────────────────────────────────────────

/**
 * Get a message with its direct replies (one level deep).
 */
export async function getMessageWithReplies(
  id: string,
): Promise<MessageWithReplies | null> {
  return prisma.message.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

/**
 * Get the full thread starting from a root message.
 * Walks up to maxDepth levels of nesting.
 */
export async function getThread(
  rootId: string,
  maxDepth: number = 10,
): Promise<MessageWithReplies | null> {
  if (maxDepth < 1) maxDepth = 1;

  const root = await prisma.message.findUnique({
    where: { id: rootId },
    include: {
      agent: { select: { id: true, name: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!root) return null;

  // Recursively fetch replies up to maxDepth
  async function attachReplies(
    msg: MessageWithReplies,
    depth: number,
  ): Promise<MessageWithReplies> {
    if (depth >= maxDepth) {
      return { ...msg, replies: [] };
    }

    const repliesWithNested = await Promise.all(
      msg.replies.map(async (reply) => {
        const fullReply = await prisma.message.findUnique({
          where: { id: reply.id },
          include: {
            agent: { select: { id: true, name: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });
        if (!fullReply) return reply as unknown as MessageWithReplies;
        return attachReplies(fullReply, depth + 1);
      }),
    );

    return { ...msg, replies: repliesWithNested as unknown as Message[] };
  }

  return attachReplies(root, 1);
}
