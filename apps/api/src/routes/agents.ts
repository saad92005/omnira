import type { FastifyInstance } from "fastify";
import type { AppConfig } from "@omnira/core";
import { AGENT_PERSONAS } from "../agents/personas.js";
import { requireAuth } from "../http/authenticate.js";

/** Read-only, same tier as /news/headlines — no side effects, nothing user-specific. */
export function registerAgentRoutes(app: FastifyInstance, config: AppConfig): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.get("/agents", { preHandler: auth }, async () => {
    return { agents: AGENT_PERSONAS.map(({ id, label, description }) => ({ id, label, description })) };
  });
}
