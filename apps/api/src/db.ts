import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
// Generated into src/generated/prisma (schema.prisma's generator `output`)
// instead of the default node_modules/@prisma/client location — see the
// comment there for why: pnpm's node_modules/.prisma symlink structure was
// exactly what broke Netlify Functions' bundler ("Cannot find module
// '.prisma/client/default'").
import { PrismaClient } from "./generated/prisma/client.js";

/**
 * Single Prisma client for the process, via Neon's HTTP-based driver
 * adapter (GA since Prisma 6.16) — not the WebSocket/Pool-based `PrismaNeon`
 * variant, which crashed with a bare "Runtime exited with error: exit
 * status 1" on Netlify Functions (AWS Lambda's per-invocation execution
 * model doesn't suit a persistent WebSocket connection the way a real
 * server or an edge/Workers runtime does). HTTP is stateless per query —
 * no connection lifecycle to manage across invocations — which is Neon's
 * own recommended shape for traditional Lambda-style functions. Every
 * `$transaction` call in this codebase uses the batch-array form
 * (`$transaction([...])`, not the interactive callback form), which the
 * HTTP driver supports; if that ever changes, this needs to change too.
 */
export function createDbClient(databaseUrl: string): PrismaClient {
  const adapter = isNeonUrl(databaseUrl)
    ? new PrismaNeonHTTP(databaseUrl, {})
    : // Neon's HTTP driver only speaks to Neon's HTTP endpoint, so a plain
      // Postgres (the docker-compose `db` service, CI, a self-hosted server)
      // needs the standard TCP driver instead. Same Prisma client either way.
      new PrismaPg({ connectionString: databaseUrl }, schemaOption(databaseUrl));
  return new PrismaClient({ adapter });
}

export function isNeonUrl(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

/** Honours Prisma's `?schema=` URL parameter, which the pg adapter doesn't read itself. */
function schemaOption(databaseUrl: string): { schema: string } | undefined {
  try {
    const schema = new URL(databaseUrl).searchParams.get("schema");
    return schema ? { schema } : undefined;
  } catch {
    return undefined;
  }
}

export type { PrismaClient } from "./generated/prisma/client.js";
