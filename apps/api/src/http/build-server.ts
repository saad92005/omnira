import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { type AppConfig, type Logger, toOmniraError, withCorrelationId } from "@omnira/core";
import type { PrismaClient } from "../db.js";
import { AuthService } from "../auth/service.js";
import { PermissionsService } from "../permissions/service.js";
import { ConversationsService } from "../conversations/service.js";
import { registerHealthRoutes } from "../routes/health.js";
import { registerAuthRoutes } from "../routes/auth.js";
import { registerPermissionRoutes } from "../routes/permissions.js";
import { registerChatRoutes } from "../routes/chat.js";
import { registerVoiceRoutes } from "../routes/voice.js";

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  db: PrismaClient;
}

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

/**
 * The desktop webview is a browser and enforces CORS like any other — a
 * missing Access-Control-Allow-Origin header doesn't surface as an HTTP
 * error, it fails the fetch() call itself before any response is readable.
 * Scoped to local origins by default: the Vite dev server (any port, since
 * it auto-increments if 1420 is taken) and Tauri's packaged-app origin on
 * Windows/Linux — "any localhost port" is fine for a single-machine desktop
 * app talking to its own local API. `PUBLIC_WEB_ORIGIN` adds exactly one
 * more allowed origin (the deployed web build's URL) once apps/api is
 * hosted publicly — still an explicit allowlist, never a wildcard.
 */
const ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|tauri\.localhost)(:\d+)?$/;

export function buildServer(deps: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: (origin, cb) => {
      // No Origin header at all (curl, server-to-server, same-origin) — allow.
      if (!origin || ALLOWED_ORIGIN.test(origin) || origin === deps.config.PUBLIC_WEB_ORIGIN) {
        cb(null, true);
        return;
      }
      cb(new Error("Origin not allowed"), false);
    },
  });

  app.addHook("onRequest", (request, _reply, done) => {
    const correlationId = (request.headers["x-request-id"] as string | undefined) ?? randomUUID();
    request.headers["x-request-id"] = correlationId;
    withCorrelationId(() => done(), correlationId);
  });

  app.setErrorHandler((error, request, reply) => {
    const omniraError = toOmniraError(error);
    const requestId = (request.headers["x-request-id"] as string) ?? randomUUID();
    deps.logger.error({ requestId, code: omniraError.code }, omniraError.message);
    reply.status(omniraError.httpStatus);
    reply.send(omniraError.toEnvelope(requestId));
  });

  app.setNotFoundHandler((request, reply) => {
    const requestId = (request.headers["x-request-id"] as string) ?? randomUUID();
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: `Route not found: ${request.method} ${request.url}`, requestId },
    });
  });

  const authService = new AuthService(deps.db, { jwtAccessSecret: deps.config.JWT_ACCESS_SECRET });
  const permissionsService = new PermissionsService(deps.db);
  const conversationsService = new ConversationsService(deps.db);

  app.register(
    async (v1) => {
      await v1.register(multipart);
      registerHealthRoutes(v1);
      registerAuthRoutes(v1, authService);
      registerPermissionRoutes(v1, permissionsService, deps.config.JWT_ACCESS_SECRET);
      registerChatRoutes(v1, deps.config, deps.logger, permissionsService, conversationsService);
      registerVoiceRoutes(v1, deps.config, permissionsService);
    },
    { prefix: "/v1" },
  );

  return app;
}
