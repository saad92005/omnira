import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ValidationError, type AppConfig } from "@omnira/core";
import { fetchUpcomingEvents } from "../integrations/google-calendar.js";
import { IntegrationsService } from "../integrations/oauth-service.js";
import { resolveProvider } from "../integrations/providers.js";
import { fetchNowPlaying } from "../integrations/spotify.js";
import { requireAuth } from "../http/authenticate.js";

const providerParam = z.object({ provider: z.enum(["google_calendar", "spotify"]) });

function apiOrigin(config: AppConfig): string {
  // The literal loopback IP, not the "localhost" hostname — Spotify's OAuth
  // app dashboard rejects http://localhost redirect URIs as "not secure"
  // and requires 127.0.0.1 specifically (RFC 8252's recommendation for
  // native-app loopback redirects, which Google accepts too).
  return config.PUBLIC_WEB_ORIGIN ?? `http://127.0.0.1:${config.API_PORT}`;
}

function confirmationPage(title: string, body: string): string {
  // Plain HTML for a browser tab, not the app itself — no build step, no
  // framework, matches this project's "server renders its own small pages"
  // footprint elsewhere (none yet, but same spirit as the JSON error envelope:
  // minimal and self-contained).
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0f1a;color:#f4f6ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
main{text-align:center;max-width:360px;padding:24px}
h1{font-size:18px;margin:0 0 8px}
p{color:#8b93ac;font-size:14px;line-height:1.5;margin:0}</style>
</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

export function registerIntegrationRoutes(app: FastifyInstance, config: AppConfig, integrations: IntegrationsService): void {
  const auth = requireAuth(config.JWT_ACCESS_SECRET);

  app.get("/integrations/:provider/connect", { preHandler: auth }, async (request) => {
    const params = providerParam.safeParse(request.params);
    if (!params.success) throw new ValidationError("Unknown integration provider");

    const provider = resolveProvider(params.data.provider, config);
    const redirectUri = `${apiOrigin(config)}/v1/integrations/${provider.id}/callback`;
    const url = await integrations.buildAuthorizeUrl(request.userId as string, provider, redirectUri);
    return { url };
  });

  // Hit directly by the browser after the user approves/denies on Google's or
  // Spotify's own consent screen — no bearer token available here, identity
  // instead comes from the OAuthState row the /connect call created.
  app.get("/integrations/:provider/callback", async (request, reply) => {
    const params = providerParam.safeParse(request.params);
    const query = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).safeParse(request.query);

    reply.type("text/html");
    if (!params.success || !query.success) {
      return reply.status(400).send(confirmationPage("Something went wrong", "This connection link looks malformed. Go back to Omnira and try connecting again."));
    }
    if (query.data.error) {
      return reply.send(confirmationPage("Not connected", "You can close this tab. Nothing was connected."));
    }
    if (!query.data.code || !query.data.state) {
      return reply.status(400).send(confirmationPage("Something went wrong", "This connection link is missing required parameters. Go back to Omnira and try again."));
    }

    const provider = resolveProvider(params.data.provider, config);
    const redirectUri = `${apiOrigin(config)}/v1/integrations/${provider.id}/callback`;

    try {
      await integrations.handleCallback(provider, query.data.code, query.data.state, redirectUri);
    } catch (err) {
      return reply.status(400).send(confirmationPage("Couldn't connect", err instanceof Error ? err.message : "Something went wrong. Go back to Omnira and try again."));
    }

    return reply.send(confirmationPage(`Connected to ${provider.label}`, "You can close this tab and go back to Omnira."));
  });

  app.get("/integrations/:provider/status", { preHandler: auth }, async (request) => {
    const params = providerParam.safeParse(request.params);
    if (!params.success) throw new ValidationError("Unknown integration provider");
    return integrations.getStatus(request.userId as string, params.data.provider);
  });

  app.post("/integrations/:provider/disconnect", { preHandler: auth }, async (request, reply) => {
    const params = providerParam.safeParse(request.params);
    if (!params.success) throw new ValidationError("Unknown integration provider");
    await integrations.disconnect(request.userId as string, params.data.provider);
    reply.status(204).send();
  });

  app.get("/integrations/google_calendar/events", { preHandler: auth }, async (request) => {
    const provider = resolveProvider("google_calendar", config);
    const accessToken = await integrations.getValidAccessToken(request.userId as string, provider);
    const events = await fetchUpcomingEvents(accessToken);
    return { events };
  });

  app.get("/integrations/spotify/now-playing", { preHandler: auth }, async (request) => {
    const provider = resolveProvider("spotify", config);
    const accessToken = await integrations.getValidAccessToken(request.userId as string, provider);
    const nowPlaying = await fetchNowPlaying(accessToken);
    return { nowPlaying };
  });
}
