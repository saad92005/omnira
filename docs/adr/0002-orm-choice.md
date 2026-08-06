# ADR-0002: ORM / Query Layer for Postgres

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Claude Code (technical lead)
- **Supersedes:** none

## Context

ADR-0001 committed to Postgres for `apps/api`. Phase 0.3 (auth & permission
model) needs a concrete query layer before any schema or migration is written.
The two realistic options for a TypeScript backend are Prisma and Drizzle.

## Decision

**Prisma.** `apps/api` uses `@prisma/client` with a `schema.prisma` file as the
single source of truth for the database schema, migrated via `prisma migrate`.

Reasoning: Phase 0 is a solo build (one engineer + one agent) that needs to
move through auth, permissions, and later billing/tenancy schemas quickly and
correctly. Prisma's migration workflow (`migrate dev`/`migrate deploy`),
generated types, and `prisma studio` inspector give more velocity and fewer
footguns at this stage than Drizzle's closer-to-SQL, more manual migration
story. The main cost — a heavier runtime and less direct SQL control — is not
a real constraint yet; Phase 5's multi-tenant row-level isolation work
(`tenant_id` enforcement) is exactly the kind of thing worth revisiting this
decision for, via a new ADR, if Prisma's query builder proves too restrictive
for tenant-scoped queries at that point.

## Consequences

- `packages/core` stays free of any Prisma dependency — only `apps/api` (and
  a future `packages/file-intel` for pgvector queries) depend on
  `@prisma/client`, per the layering rule in `/docs/CONVENTIONS.md`.
- Migrations live in `apps/api/prisma/migrations`, committed to the repo.
- pgvector (ADR-0001) is used via Prisma's `Unsupported("vector(n)")` field
  type plus raw SQL (`$queryRaw`) for similarity search, since Prisma has no
  native vector type — accepted as a known rough edge, revisited if it
  becomes painful in Phase 1's file-intelligence work.

## Alternatives Considered

- **Drizzle** — rejected for Phase 0: lighter, closer to SQL, better native
  fit for pgvector — but its migration tooling requires more manual care, and
  Phase 0's priority is auth/permission correctness delivered quickly, not
  maximal SQL control. Worth revisiting once the schema stabilizes and query
  patterns are well understood.
