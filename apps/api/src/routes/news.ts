import type { FastifyInstance } from "fastify";
import type { AppConfig } from "@omnira/core";
import { fetchTopHeadlines } from "../news/service.js";
import { requireAuth } from "../http/authenticate.js";

/**
 * Read-only, no permission gate — same tier as get_current_datetime (§5.4):
 * no side effects, nothing user-specific, nothing risky. Auth-gated anyway
 * since every route in this API is, not because headlines need it.
 */
export function registerNewsRoutes(app: FastifyInstance, config: AppConfig): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.get("/news/headlines", { preHandler: auth }, async () => {
    const headlines = await fetchTopHeadlines();
    return { headlines };
  });
}
