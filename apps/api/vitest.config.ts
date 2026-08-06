import { defineConfig } from "vitest/config";

// Unit tests only — no live Postgres required. Integration tests
// (*.integration.test.ts) run separately via `pnpm test:integration`,
// which needs `docker compose up -d db` and a migrated database first.
export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
  },
});
