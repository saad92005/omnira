import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
// Generated into src/generated/prisma (schema.prisma's generator `output`)
// instead of the default node_modules/@prisma/client location — see the
// comment there for why: pnpm's node_modules/.prisma symlink structure was
// exactly what broke Netlify Functions' bundler ("Cannot find module
// '.prisma/client/default'"), independent of using a driver adapter.
import { PrismaClient } from "./generated/prisma/client.js";
import ws from "ws";

// Node doesn't have a global WebSocket in every runtime Omnira deploys to
// (Netlify Functions' Node version, in particular) — Neon's serverless
// driver needs one supplied explicitly rather than assuming it's global.
neonConfig.webSocketConstructor = ws;

/**
 * Single Prisma client for the process, via Neon's serverless driver
 * adapter (HTTP/WebSocket, GA since Prisma 6.16). Works identically for the
 * local/desktop persistent-server deployment as well as Netlify Functions.
 */
export function createDbClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type { PrismaClient } from "./generated/prisma/client.js";
