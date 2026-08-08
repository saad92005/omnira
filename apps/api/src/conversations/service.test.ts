import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../db.js";
import { ConversationsService } from "./service.js";

function fakeDb(overrides: {
  conversationCount?: number;
  messageCount?: number;
  recentMessages?: Array<{ createdAt: Date }>;
  firstConversation?: { createdAt: Date } | null;
}): PrismaClient {
  return {
    conversation: {
      count: vi.fn().mockResolvedValue(overrides.conversationCount ?? 0),
      findFirst: vi.fn().mockResolvedValue(overrides.firstConversation ?? null),
    },
    message: {
      count: vi.fn().mockResolvedValue(overrides.messageCount ?? 0),
      findMany: vi.fn().mockResolvedValue(overrides.recentMessages ?? []),
    },
  } as unknown as PrismaClient;
}

describe("ConversationsService.getUsageSummary", () => {
  it("returns zeroed totals and a 7-day zero-filled trend for a user with no activity", async () => {
    const service = new ConversationsService(fakeDb({}));
    const summary = await service.getUsageSummary("user-1");

    expect(summary.totalConversations).toBe(0);
    expect(summary.totalMessages).toBe(0);
    expect(summary.messagesLast7Days).toBe(0);
    expect(summary.firstActivityAt).toBeNull();
    expect(summary.messagesByDay).toHaveLength(7);
    expect(summary.messagesByDay.every((d) => d.count === 0)).toBe(true);
    // Oldest to newest, ending today (UTC).
    expect(summary.messagesByDay[6]?.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("buckets recent messages by their UTC calendar day", async () => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const service = new ConversationsService(
      fakeDb({
        conversationCount: 3,
        messageCount: 12,
        recentMessages: [{ createdAt: today }, { createdAt: today }, { createdAt: yesterday }],
        firstConversation: { createdAt: yesterday },
      }),
    );
    const summary = await service.getUsageSummary("user-1");

    expect(summary.totalConversations).toBe(3);
    expect(summary.totalMessages).toBe(12);
    expect(summary.messagesLast7Days).toBe(3);
    expect(summary.firstActivityAt).toBe(yesterday);

    const byDate = new Map(summary.messagesByDay.map((d) => [d.date, d.count]));
    expect(byDate.get(todayKey)).toBe(2);
    expect(byDate.get(yesterdayKey)).toBe(1);
  });
});
