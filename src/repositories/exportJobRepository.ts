/**
 * Owns tenant-scoped export job persistence and job-state transitions.
 * Called by exportService and background job processing.
 * Calls tenant scope helpers so exported data never detaches from the requesting organization.
 * A junior engineer often stores exported file metadata separately from the job record and loses auditability.
 */
import { Prisma } from "@prisma/client";
import { withTenantScope } from "@/lib/db/tenantContext";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export const exportJobRepository = {
  list(ctx: OrgRequestContext, db: DbClient) {
    return db.exportJob.findMany({
      where: withTenantScope(ctx),
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: { include: { user: true } },
        savedView: true
      }
    });
  },

  create(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.ExportJobUncheckedCreateInput, "organizationId">
  ) {
    return db.exportJob.create({
      data: {
        ...data,
        organizationId: ctx.tenantId
      }
    });
  },

  findById(ctx: OrgRequestContext, db: DbClient, id: string) {
    return db.exportJob.findFirst({
      where: withTenantScope(ctx, { id }),
      include: {
        requestedBy: { include: { user: true } },
        savedView: true
      }
    });
  },

  update(db: DbClient, id: string, data: Prisma.ExportJobUncheckedUpdateInput) {
    // ⚠️ SENIOR NOTE: Export completion metadata needs to stay on the job row so requesters and ops see one lifecycle source of truth.
    return db.exportJob.update({
      where: { id },
      data
    });
  }
};
