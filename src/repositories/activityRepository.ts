/**
 * Owns tenant-scoped activity persistence and operational follow-up queries.
 * Called by activityService and reportingService.
 * Calls tenant scope helpers so activities cannot drift across lead/contact/deal boundaries.
 * A junior engineer often treats activities as secondary data and forgets they are a source of overdue-work reporting.
 */
import { Prisma } from "@prisma/client";
import { withTenantScope } from "@/lib/db/tenantContext";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export const activityRepository = {
  list(ctx: OrgRequestContext, db: DbClient, where: Prisma.ActivityWhereInput, page: number, pageSize: number) {
    return db.activity.findMany({
      where: withTenantScope(ctx, where),
      include: {
        owner: { include: { user: true } },
        lead: true,
        contact: true,
        deal: true,
        company: true
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    });
  },

  create(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.ActivityUncheckedCreateInput, "organizationId">
  ) {
    return db.activity.create({
      data: {
        ...data,
        organizationId: ctx.tenantId
      },
      include: {
        owner: { include: { user: true } },
        lead: true,
        contact: true,
        deal: true,
        company: true
      }
    });
  },

  countOverdue(ctx: OrgRequestContext, db: DbClient) {
    return db.activity.count({
      where: withTenantScope(ctx, {
        // ⚠️ SENIOR NOTE: Overdue work is a business metric, so the query shape here affects dashboard trustworthiness.
        dueAt: { lt: new Date() },
        completedAt: null
      })
    });
  }
};
