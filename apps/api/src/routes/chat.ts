import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Capability, UpstreamError, ValidationError, type AppConfig, type Logger } from "@omnira/core";
import { ChatAgent } from "@omnira/agents";
import { GroqProvider } from "@omnira/orchestrator";
import type { PermissionsService } from "../permissions/service.js";
import type { ConversationsService } from "../conversations/service.js";
import { buildToolHandlers } from "../tools/index.js";
import { requireAuth } from "../http/authenticate.js";

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
});

export function registerChatRoutes(
  app: FastifyInstance,
  config: AppConfig,
  logger: Logger,
  permissionsService: PermissionsService,
  conversationsService: ConversationsService,
): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.post("/chat", { preHandler: auth }, async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid chat request", { issues: parsed.error.issues });

    const userId = request.userId as string;
    const { conversationId, message } = parsed.data;

    const state = await conversationsService.loadOrCreate(userId, conversationId);

    if (!config.GROQ_API_KEY) {
      throw new UpstreamError("Chat is unavailable: GROQ_API_KEY is not configured on this server.");
    }

    // SYSTEM_CONTROL_AVAILABLE is a deployment-level kill-switch (ADR-0006/0007):
    // these tools act on whatever machine apps/api runs on, so they must stay
    // off on any hosted deployment regardless of the user's own permission grant.
    const systemControlGranted =
      config.SYSTEM_CONTROL_AVAILABLE && (await permissionsService.isActive(userId, Capability.SystemControl));
    const provider = new GroqProvider({ apiKey: config.GROQ_API_KEY });
    const agent = new ChatAgent(provider, logger, buildToolHandlers(systemControlGranted));
    const result = await agent.respond(state, message);

    await conversationsService.recordTurn(state.id, message, result.reply);

    reply.status(200).send({ conversationId: state.id, reply: result.reply, clientActions: result.clientActions });
  });

  // Voice-capable clients check this before offering the mic hotkey (§3.3 — revoked
  // permissions halt the related capability immediately, not just at grant time).
  app.get("/chat/voice-available", { preHandler: auth }, async (request) => {
    const granted = await permissionsService.isActive(request.userId as string, Capability.Microphone);
    return { voiceAvailable: granted };
  });

  app.get("/conversations", { preHandler: auth }, async (request) => {
    const conversations = await conversationsService.listForUser(request.userId as string);
    return { conversations };
  });

  app.get("/conversations/:id/messages", { preHandler: auth }, async (request) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) throw new ValidationError("Invalid conversation id");

    const messages = await conversationsService.getMessages(request.userId as string, params.data.id);
    return { messages };
  });
}
