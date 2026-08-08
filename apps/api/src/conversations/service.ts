import { ForbiddenError, NotFoundError } from "@omnira/core";
import { ConversationState } from "@omnira/agents";
import type { PrismaClient } from "../db.js";

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: Date;
}

export interface UsageSummary {
  totalConversations: number;
  totalMessages: number;
  messagesLast7Days: number;
  firstActivityAt: Date | null;
  /** Oldest to newest, always exactly 7 entries (today inclusive), zero-filled for days with no messages. */
  messagesByDay: Array<{ date: string; count: number }>;
}

const TITLE_MAX_LENGTH = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 7;

export class ConversationsService {
  constructor(private readonly db: PrismaClient) {}

  async listForUser(userId: string): Promise<ConversationSummary[]> {
    return this.db.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    });
  }

  /** Rehydrates a ConversationState from persisted messages, or creates a fresh one if `conversationId` is unset. */
  async loadOrCreate(userId: string, conversationId: string | undefined): Promise<ConversationState> {
    if (!conversationId) {
      const created = await this.db.conversation.create({ data: { userId } });
      return new ConversationState(userId, created.id);
    }

    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) throw new NotFoundError("Unknown conversationId");
    if (conversation.userId !== userId) throw new ForbiddenError("This conversation belongs to a different user");

    const state = new ConversationState(userId, conversation.id);
    for (const message of conversation.messages) {
      if (message.role === "user") state.addUserTurn(message.content);
      else state.addAssistantTurn(message.content);
    }
    return state;
  }

  async getMessages(userId: string, conversationId: string): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) throw new NotFoundError("Unknown conversationId");
    if (conversation.userId !== userId) throw new ForbiddenError("This conversation belongs to a different user");
    return conversation.messages;
  }

  /** Persists the turn just produced by ChatAgent and sets the title from the first user message, if not already set. */
  async recordTurn(conversationId: string, userMessage: string, assistantReply: string): Promise<void> {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      select: { title: true },
    });

    // Sequential, not $transaction([...]) -- Neon's HTTP driver adapter
    // (apps/api/src/db.ts) rejects Prisma transactions outright ("Transactions
    // are not supported in HTTP mode"), confirmed live in production. None of
    // these three writes need atomicity strongly enough to justify switching
    // back to the WebSocket adapter, which crashes on Netlify Functions for
    // unrelated reasons (see db.ts) -- a message failing to save after its
    // sibling succeeded is a rare, low-stakes inconsistency, not data loss.
    await this.db.message.create({ data: { conversationId, role: "user", content: userMessage } });
    await this.db.message.create({ data: { conversationId, role: "assistant", content: assistantReply } });
    await this.db.conversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        ...(conversation?.title ? {} : { title: userMessage.slice(0, TITLE_MAX_LENGTH) }),
      },
    });
  }

  /**
   * Real usage numbers only — everything here comes straight from
   * Conversation/Message rows this user owns. Deliberately doesn't report on
   * automations, agent-persona choice, terminal runs, or browser opens: none
   * of those are persisted server-side today (see ADR discussion in
   * dockModules.ts on the desktop side), so making up a number for them
   * would be exactly the fabricated-feature problem this project avoids.
   */
  async getUsageSummary(userId: string): Promise<UsageSummary> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const trendStart = new Date(startOfToday.getTime() - (TREND_DAYS - 1) * DAY_MS);

    const [totalConversations, totalMessages, recentMessages, firstConversation] = await Promise.all([
      this.db.conversation.count({ where: { userId } }),
      this.db.message.count({ where: { conversation: { userId } } }),
      this.db.message.findMany({
        where: { conversation: { userId }, createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      this.db.conversation.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);

    const countsByDate = new Map<string, number>();
    for (const { createdAt } of recentMessages) {
      const key = createdAt.toISOString().slice(0, 10);
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }

    const messagesByDay = Array.from({ length: TREND_DAYS }, (_, i) => {
      const key = new Date(trendStart.getTime() + i * DAY_MS).toISOString().slice(0, 10);
      return { date: key, count: countsByDate.get(key) ?? 0 };
    });

    return {
      totalConversations,
      totalMessages,
      messagesLast7Days: recentMessages.length,
      firstActivityAt: firstConversation?.createdAt ?? null,
      messagesByDay,
    };
  }
}
