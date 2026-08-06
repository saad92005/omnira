import { describe, expect, it } from "vitest";
import { Capability, CAPABILITY_DESCRIPTIONS, isGrantActive, type PermissionGrant } from "./permissions.js";

describe("permissions", () => {
  it("has a plain-language description for every capability", () => {
    for (const capability of Object.values(Capability)) {
      expect(CAPABILITY_DESCRIPTIONS[capability]).toBeTruthy();
      expect(CAPABILITY_DESCRIPTIONS[capability].length).toBeGreaterThan(10);
    }
  });

  it("treats a grant with no revocation as active", () => {
    const grant: PermissionGrant = {
      userId: "u1",
      capability: Capability.Microphone,
      grantedAt: new Date(),
      revokedAt: null,
    };
    expect(isGrantActive(grant)).toBe(true);
  });

  it("treats a grant with a revocation timestamp as inactive, even if granted more recently look-alike", () => {
    const grant: PermissionGrant = {
      userId: "u1",
      capability: Capability.Microphone,
      grantedAt: new Date("2026-01-01"),
      revokedAt: new Date("2026-01-02"),
    };
    expect(isGrantActive(grant)).toBe(false);
  });
});
