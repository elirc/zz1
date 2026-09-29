/**
 * Owns tenant-scoped saved-view persistence.
 * Called by savedViewService and export workflows that snapshot saved filters.
 * Calls tenant scope helpers so personal and org-shared views never cross org boundaries.
 * A junior engineer often scopes views by owner only and forgets owner ids are not globally tenant-safe.
 */
import { Prisma, SavedViewVisibility } from "@prisma/client";
import { withTenantScope } from "@/lib/db/tenantContext";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export const savedViewRepository = {
  list(ctx: OrgRequestContext, db: DbClient) {
    return db.savedView.findMany({
      where: withTenantScope(ctx, {
        // ⚠️ SENIOR NOTE: Personal views are still tenant-scoped; ownerMembershipId alone is not a safe boundary.
        OR: [
          { visibility: SavedViewVisibility.ORGANIZATION },
          { ownerMembershipId: ctx.membership.membershipId }
        ]
      }),
      orderBy: [{ resource: "asc" }, { createdAt: "desc" }]
    });
  },

  create(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.SavedViewUncheckedCreateInput, "organizationId">
  ) {
    return db.savedView.create({
      data: {
        ...data,
        organizationId: ctx.tenantId
      }
    });
  },

  findById(ctx: OrgRequestContext, db: DbClient, id: string) {
    return db.savedView.findFirst({
      where: withTenantScope(ctx, { id })
    });
  }
};
