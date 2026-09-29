/**
 * Persists audit log records for platform and tenant actions.
 * Called by src/services/auditService.ts and any workflow that must be traceable.
 * Calls Prisma through the shared DbClient so auditing can participate in transactions.
 * A junior engineer often logs audit events after the main write commits and loses history when the second write fails.
 */
import { Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const auditRepository = {
  create(db: DbClient, data: Prisma.AuditLogUncheckedCreateInput) {
    // ⚠️ SENIOR NOTE: Audit persistence should be transaction-friendly or you will record actions that never actually committed.
    return db.auditLog.create({ data });
  },

  listByOrganization(db: DbClient, organizationId: string, take = 20) {
    return db.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take
    });
  }
};
