import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Node doesn't have a global WebSocket in every runtime Omnira deploys to
// (Netlify Functions' Node version, in particular) — Neon's serverless
// driver needs one supplied explicitly rather than assuming it's global.
neonConfig.webSocketConstructor = ws;

/**
 * Single Prisma client for the process, via Neon's serverless driver
 * adapter (HTTP/WebSocket, GA since Prisma 6.16) rather than Prisma's
 * default binary query engine. Not optional for the Netlify Functions
 * deployment — esbuild's function bundler can't trace the binary engine's
 * dynamic `require`, so it never made it into the deployed bundle
 * ("Cannot find module '.prisma/client/default'"). The adapter has no
 * native binary at all, so there's nothing to fail to bundle, and it works
 * identically for the local/desktop persistent-server deployment.
 */
export function createDbClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type { PrismaClient } from "@prisma/client";
