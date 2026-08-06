import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Capability, ForbiddenError, UpstreamError, ValidationError, type AppConfig } from "@omnira/core";
import { OpenAiSttProvider, OpenAiTtsProvider } from "@omnira/voice";
import type { PermissionsService } from "../permissions/service.js";
import { requireAuth } from "../http/authenticate.js";

const speakRequestSchema = z.object({
  text: z.string().min(1).max(4000),
});

/**
 * Two independent capabilities per docs/features/phase-0-foundation.md §0.5:
 * transcribe (so the client can show the text before sending it to chat) and
 * speak (so the client can play the agent's reply). Composition — record,
 * show transcript, send to /v1/chat, speak the reply — is the client's job,
 * not this route's.
 */
export function registerVoiceRoutes(
  app: FastifyInstance,
  config: AppConfig,
  permissionsService: PermissionsService,
): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.post("/voice/transcribe", { preHandler: auth }, async (request, reply) => {
    await assertMicrophoneGranted(permissionsService, request.userId as string);

    const file = await request.file();
    if (!file) {
      throw new ValidationError("No audio file was uploaded");
    }
    const audio = await file.toBuffer();

    if (!config.OPENAI_API_KEY) {
      throw new UpstreamError("Voice transcription is unavailable: OPENAI_API_KEY is not configured on this server.");
    }

    const provider = new OpenAiSttProvider({ apiKey: config.OPENAI_API_KEY });
    const result = await provider.transcribe(audio, file.mimetype);
    reply.status(200).send({ text: result.text });
  });

  app.post("/voice/speak", { preHandler: auth }, async (request, reply) => {
    await assertMicrophoneGranted(permissionsService, request.userId as string);

    const parsed = speakRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError("Invalid speak request", { issues: parsed.error.issues });

    if (!config.OPENAI_API_KEY) {
      throw new UpstreamError("Voice synthesis is unavailable: OPENAI_API_KEY is not configured on this server.");
    }

    const provider = new OpenAiTtsProvider({ apiKey: config.OPENAI_API_KEY });
    const result = await provider.synthesize(parsed.data.text);
    reply.status(200).header("content-type", result.mimeType).send(result.audio);
  });
}

async function assertMicrophoneGranted(permissionsService: PermissionsService, userId: string): Promise<void> {
  const granted = await permissionsService.isActive(userId, Capability.Microphone);
  if (!granted) {
    throw new ForbiddenError("Microphone permission has not been granted for this account.");
  }
}
