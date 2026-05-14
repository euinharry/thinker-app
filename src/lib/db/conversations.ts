import prisma from '@/lib/db';
import type { Conversation } from '@/generated/prisma/client';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CreateConversationInput {
  title?: string;
}

export interface UpdateConversationInput {
  title: string;
}

export interface ConversationPaginationOptions {
  cursor?: string; // conversation id
  limit?: number;  // default 20
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type ConversationWithMessageCount = Conversation & {
  _count: { messages: number };
};

export type ConversationWithMessages = Conversation & {
  messages: {
    id: string;
    content: string;
    role: string;
    agentId: string | null;
    replyTo: string | null;
    createdAt: Date;
  }[];
  _count: { messages: number };
};

// ──────────────────────────────────────────────
// CRUD Operations
// ──────────────────────────────────────────────

/**
 * Create a new conversation.
 */
export async function createConversation(
  input: CreateConversationInput = {},
): Promise<Conversation> {
  return prisma.conversation.create({
    data: {
      title: input.title ?? 'New Conversation',
    },
  });
}

/**
 * Get a conversation by ID with its messages.
 */
export async function getConversationById(
  id: string,
): Promise<ConversationWithMessages | null> {
  return prisma.conversation.findUnique({
    where: { id },
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
}

/**
 * List all conversations with cursor-based pagination.
 * Returns conversations in reverse chronological order (newest first).
 */
export async function listConversations(
  options: ConversationPaginationOptions = {},
): Promise<PaginatedResult<ConversationWithMessageCount>> {
  const { cursor, limit = 20 } = options;
  const take = Math.min(Math.max(limit, 1), 100);

  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    take: take + 1,
    include: {
      _count: { select: { messages: true } },
    },
  });

  const hasMore = conversations.length > take;
  const data = hasMore ? conversations.slice(0, take) : conversations;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}

/**
 * Update a conversation's title.
 */
export async function updateConversation(
  id: string,
  input: UpdateConversationInput,
): Promise<Conversation> {
  return prisma.conversation.update({
    where: { id },
    data: { title: input.title },
  });
}

/**
 * Delete a conversation and all its messages (cascade).
 */
export async function deleteConversation(id: string): Promise<Conversation> {
  return prisma.conversation.delete({
    where: { id },
  });
}
