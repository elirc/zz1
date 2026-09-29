/**
 * Owns tenant-scoped deal persistence, list queries, and stage history writes.
 * Called by dealService and lead conversion flows.
 * Calls tenant scope helpers so both the current deal row and stage history stay inside one organization.
 * A junior engineer often updates deal.stageId but forgets to persist the historical transition.
 */
import { Prisma } from "@prisma/client";
import { withTenantScope } from "@/lib/db/tenantContext";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export const dealRepository = {
  list(ctx: OrgRequestContext, db: DbClient, where: Prisma.DealWhereInput, page: number, pageSize: number) {
    return db.deal.findMany({
      where: withTenantScope(ctx, where),
      include: {
        owner: { include: { user: true } },
        stage: true,
        pipeline: true,
        company: true,
        primaryContact: true
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
  },

  count(ctx: OrgRequestContext, db: DbClient, where: Prisma.DealWhereInput) {
    return db.deal.count({
      where: withTenantScope(ctx, where)
    });
  },

  create(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.DealUncheckedCreateInput, "organizationId">
  ) {
    return db.deal.create({
      data: {
        ...data,
        organizationId: ctx.tenantId
      },
      include: {
        owner: { include: { user: true } },
        stage: true,
        pipeline: true,
        company: true,
        primaryContact: true
      }
    });
  },

  findById(ctx: OrgRequestContext, db: DbClient, dealId: string) {
    return db.deal.findFirst({
      // ⚠️ SENIOR NOTE: Deal detail needs stage history eagerly or stage-driven UIs become query-heavy and inconsistent.
      where: withTenantScope(ctx, { id: dealId }),
      include: {
        owner: { include: { user: true } },
        stage: true,
        pipeline: true,
        company: true,
        primaryContact: true,
        stageHistory: {
          orderBy: { createdAt: "desc" },
          include: {
            fromStage: true,
            toStage: true
          }
        }
      }
    });
  },

  async update(ctx: OrgRequestContext, db: DbClient, dealId: string, data: Prisma.DealUncheckedUpdateInput) {
    await db.deal.updateMany({
      where: withTenantScope(ctx, { id: dealId }),
      data
    });

    return this.findById(ctx, db, dealId);
  },

  createStageHistory(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.DealStageHistoryUncheckedCreateInput, "organizationId">
  ) {
    return db.dealStageHistory.create({
      data: {
        // ⚠️ SENIOR NOTE: Stage history is the audit trail for pipeline movement; losing it weakens reporting and investigations.
        ...data,
        organizationId: ctx.tenantId
      }
    });
  }
};
