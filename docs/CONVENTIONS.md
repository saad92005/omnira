# Conventions (TypeScript)

Applies to every package in `/apps` and `/packages`. Enforced by
`eslint.config.js` (root) and `tsconfig.base.json` — do not add per-package
exceptions without an ADR explaining why.

## Naming

- **Files:** `kebab-case.ts` (e.g. `conversation-state.ts`). Test files:
  `<name>.test.ts` colocated next to the file under test.
- **Types & classes:** `PascalCase` (`ConversationState`, `ChatAgent`).
- **Functions & variables:** `camelCase`.
- **Constants that are truly fixed values:** `UPPER_SNAKE_CASE`
  (`DEFAULT_TIMEOUT_MS`). Ordinary `const` bindings that aren't global fixed
  values stay `camelCase`.
- **Interfaces:** no `I` prefix — name the thing (`Logger`, not `ILogger`).
- **Enums:** prefer a `const object` + union type over TS `enum` (see
  `packages/core/src/permissions.ts` for the pattern) — plays better with
  `verbatimModuleSyntax` and erasable-syntax tooling.

## Module Style

- `verbatimModuleSyntax` is on: use `import type` / `export type` for
  type-only imports/exports.
- One default export per file only for framework-mandated cases (e.g. a React
  component); everywhere else, named exports.
- No barrel-file re-export sprawl beyond one `src/index.ts` per package that
  defines that package's public surface. Internal modules import from each
  other's concrete paths, not through the barrel.

## Types

- `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are
  all on. Do not use `as` casts to silence them — narrow properly or fix the
  type.
- `any` is an ESLint error (`@typescript-eslint/no-explicit-any`). Use
  `unknown` at trust boundaries (parsed JSON, tool-call arguments, model
  output) and narrow with a schema (Zod) before use.
- Every public function/exported class method has an explicit return type
  (enforced as a warning, tighten to error once the codebase is past Phase 0).

## Errors

- Throw typed errors (subclasses of a shared `OmniraError` in
  `packages/core`), never bare `throw new Error(...)` in application code.
- REST handlers translate typed errors into the standard envelope
  `{ error: { code, message, details, requestId } }` — never let a raw
  exception reach an HTTP response.
- No empty `catch` blocks. If an error is genuinely ignorable, catch the
  specific error type and log why at `debug` level, with a comment on the
  non-obvious reason.

## Testing

- Vitest for unit and integration tests. Test files live next to the source
  file they cover (`foo.ts` + `foo.test.ts`), not in a parallel `__tests__`
  tree.
- A test asserts behavior, not implementation — prefer calling the public
  API of a module over reaching into its internals.

## Formatting

- Prettier is the formatter, not a matter of taste — run `pnpm lint` before
  committing. No manual formatting debates in review.

## Package Boundaries

- A package only imports from another package via that package's declared
  `exports` (its `src/index.ts` surface), never via a deep relative path
  reaching into another package's `src/`.
- Cross-package dependencies follow the layering in the master prompt §4.2:
  `core` depends on nothing else in the monorepo; `agents`/`orchestrator`/
  `voice`/`desktop-bridge` depend on `core` only; `apps/*` depend on
  `packages/*`, never the reverse.
