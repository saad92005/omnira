import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Capability, ValidationError } from "@omnira/core";
import type { PermissionsService } from "../permissions/service.js";
import { requireAuth } from "../http/authenticate.js";

const capabilityParamSchema = z.object({
  capability: z.nativeEnum(Capability),
});

export function registerPermissionRoutes(
  app: FastifyInstance,
  permissionsService: PermissionsService,
  jwtAccessSecret: string,
): void {
  const auth = requireAuth(jwtAccessSecret);

  app.get("/permissions", { preHandler: auth }, async (request) => {
    const grants = await permissionsService.list(request.userId as string);
    return { grants };
  });

  app.post("/permissions/:capability/grant", { preHandler: auth }, async (request, reply) => {
    const parsed = capabilityParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError("Unknown capability", { issues: parsed.error.issues });

    const grant = await permissionsService.grant(request.userId as string, parsed.data.capability);
    reply.status(200).send({ grant });
  });

  app.post("/permissions/:capability/revoke", { preHandler: auth }, async (request, reply) => {
    const parsed = capabilityParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError("Unknown capability", { issues: parsed.error.issues });

    await permissionsService.revoke(request.userId as string, parsed.data.capability);
    reply.status(204).send();
  });
}
