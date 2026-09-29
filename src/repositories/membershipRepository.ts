/**
 * Owns org-scoped membership queries and writes.
 * Called by organization services, tenant guards, and reporting flows.
 * Calls Prisma with explicit organization filters so tenant boundaries stay reviewable.
 * A junior engineer often looks up a membership by id without also checking organizationId.
 */
import { MembershipRole, MembershipStatus, Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const membershipRepository = {
  create(db: DbClient, data: Prisma.MembershipUncheckedCreateInput) {
    return db.membership.create({
      data,
      include: {
        user: true,
        organization: true
      }
    });
  },

  listByOrganization(db: DbClient, organizationId: string) {
    return db.membership.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        user: true
      }
    });
  },

  countAdmins(db: DbClient, organizationId: string) {
    return db.membership.count({
      where: {
        organizationId,
        role: MembershipRole.ORGANIZATION_ADMIN,
        status: MembershipStatus.ACTIVE
      }
    });
  },

  findById(db: DbClient, organizationId: string, membershipId: string) {
    return db.membership.findFirst({
      where: {
        // ⚠️ SENIOR NOTE: Looking up membership by id alone is a classic tenant leak because ids are globally unique but still tenant-sensitive.
        id: membershipId,
        organizationId
      },
      include: {
        user: true,
        organization: true
      }
    });
  },

  async update(db: DbClient, organizationId: string, membershipId: string, data: Prisma.MembershipUpdateInput) {
    await db.membership.updateMany({
      where: {
        id: membershipId,
        organizationId
      },
      data
    });

    return this.findById(db, organizationId, membershipId);
  }
};
