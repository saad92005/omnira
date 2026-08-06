import { Capability, isGrantActive, type PermissionGrant } from "@omnira/core";
import type { PrismaClient } from "../db.js";

function toDomainGrant(row: { userId: string; capability: string; grantedAt: Date; revokedAt: Date | null }): PermissionGrant {
  return {
    userId: row.userId,
    capability: row.capability as Capability,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
  };
}

export class PermissionsService {
  constructor(private readonly db: PrismaClient) {}

  /** Idempotent: granting an already-active capability does not create a duplicate row. */
  async grant(userId: string, capability: Capability): Promise<PermissionGrant> {
    const active = await this.findActiveGrant(userId, capability);
    if (active) return toDomainGrant(active);

    const created = await this.db.permissionGrant.create({ data: { userId, capability } });
    return toDomainGrant(created);
  }

  /** Revocation halts related capabilities immediately (master prompt §3.3) — it records a fact, never deletes the row. */
  async revoke(userId: string, capability: Capability): Promise<void> {
    const active = await this.findActiveGrant(userId, capability);
    if (!active) return;
    await this.db.permissionGrant.update({ where: { id: active.id }, data: { revokedAt: new Date() } });
  }

  async isActive(userId: string, capability: Capability): Promise<boolean> {
    return (await this.findActiveGrant(userId, capability)) !== null;
  }

  async list(userId: string): Promise<PermissionGrant[]> {
    const rows = await this.db.permissionGrant.findMany({ where: { userId }, orderBy: { grantedAt: "desc" } });
    return rows.map(toDomainGrant).filter((grant, index, all) => {
      // Keep only the most recent row per capability so the list reflects current state.
      return all.findIndex((g) => g.capability === grant.capability) === index;
    });
  }

  private async findActiveGrant(userId: string, capability: Capability) {
    return this.db.permissionGrant.findFirst({
      where: { userId, capability, revokedAt: null },
      orderBy: { grantedAt: "desc" },
    });
  }
}

export { isGrantActive };
