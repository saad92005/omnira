import { PrismaNeonHTTP } from "@prisma/adapter-neon";
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
  const adapter = new PrismaNeonHTTP(databaseUrl, {});
  return new PrismaClient({ adapter });
}

export type { PrismaClient } from "./generated/prisma/client.js";
