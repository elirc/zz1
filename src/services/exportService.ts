/**
 * Owns export job creation and export history reads.
 * Called by export route handlers and background job processing.
 * Calls saved view lookup, export job persistence, async job enqueueing, and audit logging.
 * A junior engineer often generates CSV inline in the request and turns large exports into timeout risks.
 */
import { AsyncJobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asyncJobRepository } from "@/repositories/asyncJobRepository";
import { exportJobRepository } from "@/repositories/exportJobRepository";
import { savedViewRepository } from "@/repositories/savedViewRepository";
import { auditService } from "@/services/auditService";
import { OrgRequestContext } from "@/types/context";

type RequestExportInput = {
  resource: "LEAD" | "CONTACT" | "DEAL" | "ACTIVITY";
  savedViewId?: string;
  filtersSnapshot?: Prisma.InputJsonValue;
};

export const exportService = {
  listExportJobs(ctx: OrgRequestContext) {
    return exportJobRepository.list(ctx, prisma);
  },

  async requestExport(ctx: OrgRequestContext, input: RequestExportInput) {
    return prisma.$transaction(async (tx) => {
      const savedView = input.savedViewId ? await savedViewRepository.findById(ctx, tx, input.savedViewId) : null;

      // ⚠️ SENIOR NOTE: Capture the filter snapshot at request time or the exported dataset can drift if the saved view changes later.
      const exportJob = await exportJobRepository.create(ctx, tx, {
        requestedByMembershipId: ctx.membership.membershipId,
        resource: input.resource,
        savedViewId: savedView?.id,
        filtersSnapshot: input.filtersSnapshot ?? savedView?.filters ?? Prisma.JsonNull
      });

      await asyncJobRepository.create(tx, {
        organizationId: ctx.tenantId,
        type: AsyncJobType.EXPORT_GENERATION,
        payload: {
          exportJobId: exportJob.id,
          resource: input.resource
        } satisfies Prisma.InputJsonValue,
        runAt: new Date()
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "export_job",
        entityId: exportJob.id,
        action: "export.requested",
        summary: `Queued ${input.resource.toLowerCase()} export ${exportJob.id}.`,
        metadata: {
          savedViewId: savedView?.id ?? null
        }
      });

      return exportJob;
    });
  }
};
