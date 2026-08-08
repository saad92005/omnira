import type { FastifyInstance } from "fastify";
import type { AppConfig } from "@omnira/core";
import type { ConversationsService } from "../conversations/service.js";
import { requireAuth } from "../http/authenticate.js";

/** Read-only usage stats derived from the caller's own persisted conversations/messages — see ConversationsService.getUsageSummary for what is and isn't tracked. */
export function registerAnalyticsRoutes(app: FastifyInstance, config: AppConfig, conversationsService: ConversationsService): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.get("/analytics/summary", { preHandler: auth }, async (request) => {
    return conversationsService.getUsageSummary(request.userId as string);
  });
}
