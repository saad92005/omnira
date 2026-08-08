import type { AppConfig } from "@omnira/core";
import { UpstreamError, ValidationError } from "@omnira/core";

export type ProviderId = "google_calendar" | "spotify";

export interface OAuthProvider {
  id: ProviderId;
  label: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  revokeEndpoint?: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  /** Merged into the authorize URL's query string — e.g. Google's access_type/prompt to guarantee a refresh_token. */
  extraAuthParams?: Record<string, string>;
}

const PROVIDER_DEFS: Record<ProviderId, { label: string; authorizeEndpoint: string; tokenEndpoint: string; revokeEndpoint?: string; scope: string; extraAuthParams?: Record<string, string> }> = {
  google_calendar: {
    label: "Google Calendar",
    authorizeEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    revokeEndpoint: "https://oauth2.googleapis.com/revoke",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    // Google only issues a refresh_token on the first consent unless forced —
    // without these, reconnecting after a revoke silently stops working.
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  spotify: {
    label: "Spotify",
    authorizeEndpoint: "https://accounts.spotify.com/authorize",
    tokenEndpoint: "https://accounts.spotify.com/api/token",
    scope: "user-read-currently-playing user-read-playback-state",
  },
};

/** Throws ValidationError for an unknown id (client bug) vs. UpstreamError for a known provider this deployment hasn't configured (operator gap) — same distinction chat.ts draws for GROQ_API_KEY. */
export function resolveProvider(id: string, config: AppConfig): OAuthProvider {
  const def = PROVIDER_DEFS[id as ProviderId];
  if (!def) throw new ValidationError(`Unknown integration provider: ${id}`);

  const clientId = id === "google_calendar" ? config.GOOGLE_CLIENT_ID : config.SPOTIFY_CLIENT_ID;
  const clientSecret = id === "google_calendar" ? config.GOOGLE_CLIENT_SECRET : config.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new UpstreamError(`${def.label} isn't configured on this server yet.`);
  }

  return { id: id as ProviderId, clientId, clientSecret, ...def };
}
