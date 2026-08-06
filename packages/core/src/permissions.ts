/**
 * Capability permission model (master prompt §7). Phase 0 only exercises the
 * `microphone` capability end to end; the rest of the catalog (files, apps,
 * clipboard, terminal, etc.) is added in Phase 1 when desktop-bridge actually
 * implements them. Declaring the full risk-tier shape now means Phase 1 adds
 * rows, not a schema migration.
 *
 * Uses a const-object + union pattern instead of `enum` per
 * /docs/CONVENTIONS.md.
 */
export const Capability = {
  Microphone: "microphone",
  /**
   * A deliberately narrow slice of §7's "app launching" capability: opening
   * a URL or a small allowlisted set of known applications (see
   * apps/api/src/tools/system-control.ts) — never arbitrary command
   * execution. Full desktop-bridge app/window/file control is Phase 1.
   */
  SystemControl: "system_control",
} as const;
export type Capability = (typeof Capability)[keyof typeof Capability];

/** Plain-language description shown on the grant screen (§7 — no jargon, no fine print). */
export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  [Capability.Microphone]:
    "Lets Omnira listen when you press and hold the voice hotkey, so you can talk to it instead of typing.",
  [Capability.SystemControl]:
    "Lets Omnira open websites and a small set of known apps (browser, notepad, calculator, file explorer) on your computer when you ask it to.",
};

/**
 * Tool risk tiers (§5.4). Read-only tools never require confirmation;
 * reversible-write tools may be pre-approved by category; destructive tools
 * always require per-action confirmation unless the user has pre-approved
 * that exact category.
 */
export const RiskTier = {
  ReadOnly: "read_only",
  ReversibleWrite: "reversible_write",
  Destructive: "destructive",
} as const;
export type RiskTier = (typeof RiskTier)[keyof typeof RiskTier];

export interface PermissionGrant {
  userId: string;
  capability: Capability;
  grantedAt: Date;
  /** Non-null once revoked. Revocation is a fact recorded, never a row deletion, to preserve audit history (§13). */
  revokedAt: Date | null;
}

export function isGrantActive(grant: PermissionGrant): boolean {
  return grant.revokedAt === null;
}
