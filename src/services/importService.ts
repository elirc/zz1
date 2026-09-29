/**
 * Owns CSV import job creation for contacts.
 * Called by import route handlers and background job processing.
 * Calls import job persistence, async job enqueueing, and audit logging.
 * A junior engineer often parses the CSV in the request path and loses retryability if any row fails.
 */
import { AsyncJobType, ImportResource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asyncJobRepository } from "@/repositories/asyncJobRepository";
import { importJobRepository } from "@/repositories/importJobRepository";
import { auditService } from "@/services/auditService";
import { OrgRequestContext } from "@/types/context";

export const importService = {
  listImports(ctx: OrgRequestContext) {
    return importJobRepository.list(ctx, prisma);
  },

  async requestContactImport(ctx: OrgRequestContext, input: { fileName: string; csvText: string }) {
    return prisma.$transaction(async (tx) => {
      // ⚠️ SENIOR NOTE: Queue the raw import first; parsing inline would make retries and failure analysis much harder.
      const importJob = await importJobRepository.create(ctx, tx, {
        createdByMembershipId: ctx.membership.membershipId,
        resource: ImportResource.CONTACT,
        fileName: input.fileName,
        summary: {
          queuedBytes: input.csvText.length
        } satisfies Prisma.InputJsonValue
      });

      await asyncJobRepository.create(tx, {
        organizationId: ctx.tenantId,
        type: AsyncJobType.CSV_IMPORT,
        payload: {
          importJobId: importJob.id,
          fileName: input.fileName,
          csvText: input.csvText
        } satisfies Prisma.InputJsonValue,
        runAt: new Date()
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "import_job",
        entityId: importJob.id,
        action: "import.requested",
        summary: `Queued contact import ${input.fileName}.`
      });

      return importJob;
    });
  }
};
