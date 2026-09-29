/**
 * Owns tenant-scoped lead queries, writes, and status history persistence.
 * Called by src/services/leadService.ts for CRUD and conversion workflows.
 * Calls tenantContext helpers so every lead query carries organizationId explicitly.
 * A junior engineer often writes a perfect where clause for the parent lead and forgets the history insert also needs organizationId.
 */
import { Prisma } from "@prisma/client";
import { withTenantScope } from "@/lib/db/tenantContext";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export const leadRepository = {
  list(ctx: OrgRequestContext, db: DbClient, where: Prisma.LeadWhereInput, page: number, pageSize: number) {
    return db.lead.findMany({
      where: withTenantScope(ctx, where),
      include: {
        owner: { include: { user: true } },
        stage: true,
        pipeline: true,
        company: true
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
  },

  count(ctx: OrgRequestContext, db: DbClient, where: Prisma.LeadWhereInput) {
    return db.lead.count({
      where: withTenantScope(ctx, where)
    });
  },

  create(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.LeadUncheckedCreateInput, "organizationId">
  ) {
    return db.lead.create({
      data: {
        ...data,
        organizationId: ctx.tenantId
      },
      include: {
        owner: { include: { user: true } },
        stage: true,
        pipeline: true,
        company: true
      }
    });
  },

  findById(ctx: OrgRequestContext, db: DbClient, leadId: string) {
    return db.lead.findFirst({
      // ⚠️ SENIOR NOTE: Lead detail views need history and activity included together or the UI will reintroduce N+1 lookups elsewhere.
      where: withTenantScope(ctx, { id: leadId }),
      include: {
        owner: { include: { user: true } },
        stage: true,
        pipeline: true,
        company: true,
        convertedContact: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20
        },
        statusHistory: {
          orderBy: { createdAt: "desc" }
        }
      }
    });
  },

  async update(ctx: OrgRequestContext, db: DbClient, leadId: string, data: Prisma.LeadUncheckedUpdateInput) {
    await db.lead.updateMany({
      // ⚠️ SENIOR NOTE: `updateMany` plus a scoped follow-up read prevents accidental cross-tenant single-row updates by bare id.
      where: withTenantScope(ctx, { id: leadId }),
      data
    });

    return this.findById(ctx, db, leadId);
  },

  createStatusHistory(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.LeadStatusHistoryUncheckedCreateInput, "organizationId">
  ) {
    return db.leadStatusHistory.create({
      data: {
        ...data,
        organizationId: ctx.tenantId
      }
    });
  }
};
