import type { FastifyInstance } from "fastify";
import { Capability, ForbiddenError, UpstreamError, ValidationError, type AppConfig } from "@omnira/core";
import { GroqSttProvider } from "@omnira/voice";
import type { PermissionsService } from "../permissions/service.js";
import { requireAuth } from "../http/authenticate.js";

/**
 * Transcription only, per docs/features/phase-0-foundation.md §0.5 (so the
 * client can show the text before sending it to chat) — the reply is spoken
 * back client-side via the browser's `speechSynthesis`, not a server route
 * (ADR-0005). Composition — record, show transcript, send to /v1/chat, speak
 * the reply — is the client's job, not this route's.
 */
export function registerVoiceRoutes(
  app: FastifyInstance,
  config: AppConfig,
  permissionsService: PermissionsService,
): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.post("/voice/transcribe", { preHandler: auth }, async (request, reply) => {
    const granted = await permissionsService.isActive(request.userId as string, Capability.Microphone);
    if (!granted) {
      throw new ForbiddenError("Microphone permission has not been granted for this account.");
    }

    const file = await request.file();
    if (!file) {
      throw new ValidationError("No audio file was uploaded");
    }
    const audio = await file.toBuffer();

    if (!config.GROQ_API_KEY) {
      throw new UpstreamError("Voice transcription is unavailable: GROQ_API_KEY is not configured on this server.");
    }

    const provider = new GroqSttProvider({ apiKey: config.GROQ_API_KEY });
    const result = await provider.transcribe(audio, file.mimetype);
    reply.status(200).send({ text: result.text });
  });
}
