import { defineConfig } from "vitest/config";

// Requires a running, migrated Postgres — see README: `docker compose up -d db`
// then `pnpm --filter @omnira/api prisma:migrate` from the repo root.
export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
