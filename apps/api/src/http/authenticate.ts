import type { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "@omnira/core";
import { verifyAccessToken } from "../auth/tokens.js";

/**
 * Fastify preHandler that verifies the bearer access token and sets
 * `request.userId`. Throws UnauthorizedError (caught by the global error
 * handler) rather than replying directly, so every auth failure goes through
 * the standard error envelope.
 */
export function requireAuth(jwtAccessSecret: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing bearer access token");
    }
    const token = header.slice("Bearer ".length);
    const payload = await verifyAccessToken(token, jwtAccessSecret);
    request.userId = payload.sub;
  };
}
