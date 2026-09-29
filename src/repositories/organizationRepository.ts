/**
 * Owns database access for platform-level organization records.
 * Called by src/services/organizationService.ts for creation and workspace reads.
 * Calls Prisma directly and leaves workflow decisions to the service layer.
 * A junior engineer often mixes membership creation into the repository and makes transaction boundaries hard to reason about.
 */
import { Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const organizationRepository = {
  create(db: DbClient, data: Prisma.OrganizationUncheckedCreateInput) {
    // ⚠️ SENIOR NOTE: Org creation stays narrow here so membership, audit, and pipeline bootstrap remain in one service-layer transaction.
    return db.organization.create({ data });
  },

  list(db: DbClient) {
    return db.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            memberships: true,
            leads: true,
            contacts: true,
            deals: true
          }
        }
      }
    });
  },

  findById(db: DbClient, id: string) {
    return db.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            memberships: true,
            leads: true,
            contacts: true,
            deals: true,
            exportJobs: true
          }
        }
      }
    });
  }
};
