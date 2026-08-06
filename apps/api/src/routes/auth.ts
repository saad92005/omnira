import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ValidationError } from "@omnira/core";
import type { AuthService } from "../auth/service.js";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService): void {
  app.post("/auth/register", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid registration payload", { issues: parsed.error.issues });

    const { userId } = await authService.register(parsed.data.email, parsed.data.password);
    reply.status(201).send({ userId });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid login payload", { issues: parsed.error.issues });

    const tokens = await authService.login(parsed.data.email, parsed.data.password);
    reply.status(200).send(tokens);
  });

  app.post("/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid refresh payload", { issues: parsed.error.issues });

    const tokens = await authService.refresh(parsed.data.refreshToken);
    reply.status(200).send(tokens);
  });

  app.post("/auth/logout", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid logout payload", { issues: parsed.error.issues });

    await authService.revoke(parsed.data.refreshToken);
    reply.status(204).send();
  });
}
