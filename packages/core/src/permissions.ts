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
} as const;
export type Capability = (typeof Capability)[keyof typeof Capability];

/** Plain-language description shown on the grant screen (§7 — no jargon, no fine print). */
export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  [Capability.Microphone]:
    "Lets Omnira listen when you press and hold the voice hotkey, so you can talk to it instead of typing.",
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
