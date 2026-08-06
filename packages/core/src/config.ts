import { z } from "zod";

/**
 * Environment-based config, validated at process startup. Fails loudly with
 * the specific missing/invalid var rather than surfacing a confusing error
 * deep in application code later. Never read `process.env` directly outside
 * this module — every other package receives config as typed values.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  /** Chat + speech-to-text (ADR-0005) — optional; those routes fail loudly, not silently, when unset. */
  GROQ_API_KEY: z.string().min(1).optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
});

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
