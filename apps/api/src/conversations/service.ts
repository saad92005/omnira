import { ForbiddenError, NotFoundError } from "@omnira/core";
import { ConversationState } from "@omnira/agents";
import type { PrismaClient } from "../db.js";

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: Date;
}

const TITLE_MAX_LENGTH = 60;

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

    await this.db.$transaction([
      this.db.message.create({ data: { conversationId, role: "user", content: userMessage } }),
      this.db.message.create({ data: { conversationId, role: "assistant", content: assistantReply } }),
      this.db.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
          ...(conversation?.title ? {} : { title: userMessage.slice(0, TITLE_MAX_LENGTH) }),
        },
      }),
    ]);
  }
}
