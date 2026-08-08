import { z } from "zod";

/**
 * Environment-based config, validated at process startup. Fails loudly with
 * the specific missing/invalid var rather than surfacing a confusing error
 * deep in application code later. Never read `process.env` directly outside
 * this module — every other package receives config as typed values.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    /** Chat + speech-to-text (ADR-0005) — optional; those routes fail loudly, not silently, when unset. */
    GROQ_API_KEY: z.string().min(1).optional(),
    API_PORT: z.coerce.number().int().positive().default(4000),
    /** Host-assigned port (Render, Railway, etc. all inject this) — wins over API_PORT when set. */
    PORT: z.coerce.number().int().positive().optional(),
    /**
     * An exact browser origin to allow via CORS in addition to
     * localhost/tauri.localhost — set this to the deployed web build's URL
     * (e.g. https://omnira.vercel.app) once apps/api is hosted publicly.
     * Unset (default) means only the local desktop app can reach this server.
     */
    PUBLIC_WEB_ORIGIN: z.string().url().optional(),
    /**
     * Hard kill-switch for the open_app/open_url/create_file/create_folder
     * tools (ADR-0006/0007). Those tools act on whatever machine apps/api
     * runs on — meaningful when that's the user's own PC (Phase 0's
     * local-first deployment), meaningless-to-actively-wrong on a hosted
     * server acting on a phone's request. Set to false on any remote
     * deployment; defaults true for local/desktop use.
     */
    // z.coerce.boolean() would treat the string "false" as truthy
    // (Boolean("false") === true) — an env-var footgun that would make this
    // kill-switch impossible to actually turn off, so parse explicitly instead.
    SYSTEM_CONTROL_AVAILABLE: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .default(true)
      .transform((v) => v === true || v === "true"),
    /** Google Calendar OAuth (Calendar dock panel) — optional; that integration's routes fail loudly, not silently, when unset. */
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    /** Spotify OAuth (Music dock panel) — optional; that integration's routes fail loudly, not silently, when unset. */
    SPOTIFY_CLIENT_ID: z.string().min(1).optional(),
    SPOTIFY_CLIENT_SECRET: z.string().min(1).optional(),
    /** Symmetric key (any length string, SHA-256'd into an AES-256 key — see integrations/crypto.ts) for encrypting stored OAuth tokens at rest. Required only once GOOGLE_CLIENT_ID or SPOTIFY_CLIENT_ID is set. */
    INTEGRATION_ENCRYPTION_KEY: z.string().min(16, "INTEGRATION_ENCRYPTION_KEY must be at least 16 characters").optional(),
  })
  // Host platforms (Render, Railway, ...) inject PORT and expect the app to
  // bind to it; PORT wins over API_PORT when both are present, and is
  // dropped from the resulting config so callers only ever read API_PORT.
  .transform(({ PORT, ...rest }) => ({ ...rest, API_PORT: PORT ?? rest.API_PORT }));

export type AppConfig = Readonly<z.infer<typeof envSchema>>;

export class ConfigError extends Error {
  constructor(issues: z.ZodIssue[]) {
    const summary = issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    super(`Invalid or missing configuration: ${summary}`);
    this.name = "ConfigError";
  }
}

/**
 * Loads and validates config from `process.env` (or a supplied source, for
 * tests). Throws ConfigError synchronously on any missing/invalid var so a
 * misconfigured process never starts serving traffic.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(result.error.issues);
  }
  return result.data;
}
