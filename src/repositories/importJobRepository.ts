/**
 * Owns tenant-scoped import job persistence.
 * Called by contact import workflows and future CSV ingestion jobs.
 * Calls tenant scope helpers so uploaded import artifacts stay isolated by organization.
 * A junior engineer often processes imported rows without preserving the source file job record for traceability.
 */
import { Prisma } from "@prisma/client";
import { withTenantScope } from "@/lib/db/tenantContext";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export const importJobRepository = {
  create(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.ImportJobUncheckedCreateInput, "organizationId">
  ) {
    return db.importJob.create({
      data: {
        ...data,
        organizationId: ctx.tenantId
      }
    });
  },

  list(ctx: OrgRequestContext, db: DbClient) {
    return db.importJob.findMany({
      // ⚠️ SENIOR NOTE: Bulk import history is tenant-sensitive operational data and should be reviewable by org, not global.
      where: withTenantScope(ctx),
      orderBy: { createdAt: "desc" }
    });
  }
};
