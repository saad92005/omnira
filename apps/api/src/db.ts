import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client for the process. Not a per-request instantiation —
 * Prisma manages its own connection pool internally.
 */
export function createDbClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: databaseUrl });
}

export type { PrismaClient } from "@prisma/client";
