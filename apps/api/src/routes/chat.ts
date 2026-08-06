import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Capability, ForbiddenError, UpstreamError, ValidationError, type AppConfig, type Logger } from "@omnira/core";
import { ChatAgent, ConversationState } from "@omnira/agents";
import { AnthropicProvider } from "@omnira/orchestrator";
import type { PermissionsService } from "../permissions/service.js";
import { requireAuth } from "../http/authenticate.js";

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
});

/**
 * Phase 0 conversation store is in-memory, scoped to this process — there is
 * no `conversations` table yet (that's Phase 1+ persistence work). A process
 * restart loses in-flight conversations; acceptable for the Phase 0 walking
 * skeleton, called out in PROJECT_INDEX.md as a known limitation.
 */
const conversations = new Map<string, ConversationState>();

export function registerChatRoutes(
  app: FastifyInstance,
  config: AppConfig,
  logger: Logger,
  permissionsService: PermissionsService,
): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.post("/chat", { preHandler: auth }, async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid chat request", { issues: parsed.error.issues });

    const userId = request.userId as string;
    const { conversationId, message } = parsed.data;

    let state = conversationId ? conversations.get(conversationId) : undefined;
    if (conversationId && !state) {
      throw new ValidationError("Unknown conversationId");
    }
    if (!state) {
      state = new ConversationState(userId);
      conversations.set(state.id, state);
    }
    if (state.userId !== userId) {
      throw new ForbiddenError("This conversation belongs to a different user");
    }

    if (!config.ANTHROPIC_API_KEY) {
      throw new UpstreamError(
        "Chat is unavailable: ANTHROPIC_API_KEY is not configured on this server.",
      );
    }

    const provider = new AnthropicProvider({ apiKey: config.ANTHROPIC_API_KEY });
    const agent = new ChatAgent(provider, logger);
    const result = await agent.respond(state, message);

    reply.status(200).send({ conversationId: state.id, reply: result.reply });
  });

  // Voice-capable clients check this before offering the mic hotkey (§3.3 — revoked
  // permissions halt the related capability immediately, not just at grant time).
  app.get("/chat/voice-available", { preHandler: auth }, async (request) => {
    const granted = await permissionsService.isActive(request.userId as string, Capability.Microphone);
    return { voiceAvailable: granted };
  });
}
