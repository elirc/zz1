/**
 * Owns mocked background job execution for notifications, exports, and CSV imports.
 * Called by the process-due-jobs route and future schedulers.
 * Calls async job persistence plus resource-specific repositories so async work is explicit and testable.
 * A junior engineer often hides background behavior in cron scripts with no shared application abstractions or audit trail.
 */
import Papa from "papaparse";
import { AsyncJobStatus, AsyncJobType, ImportJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { asyncJobRepository } from "@/repositories/asyncJobRepository";
import { contactRepository } from "@/repositories/contactRepository";
import { exportJobRepository } from "@/repositories/exportJobRepository";
import { importJobRepository } from "@/repositories/importJobRepository";
import { OrgRequestContext } from "@/types/context";

export const jobService = {
  async processDueJobs(limit = 20) {
    const jobs = await asyncJobRepository.listDue(prisma);
    const selected = jobs.slice(0, limit);

    const results = [];

    for (const job of selected) {
      await asyncJobRepository.update(prisma, job.id, {
        status: AsyncJobStatus.RUNNING,
        startedAt: new Date(),
        attempts: { increment: 1 }
      });

      try {
        // ⚠️ SENIOR NOTE: Background jobs need explicit per-type branching and durable status writes or retries become non-deterministic.
        switch (job.type) {
          case AsyncJobType.EXPORT_GENERATION: {
            const payload = job.payload as { exportJobId: string; resource: string };
            await exportJobRepository.update(prisma, payload.exportJobId, {
              status: "COMPLETED",
              startedAt: new Date(),
              completedAt: new Date(),
              fileName: `${payload.resource.toLowerCase()}-export-${payload.exportJobId}.csv`,
              fileUrl: `/generated/exports/${payload.exportJobId}.csv`,
              totalRows: 0
            });
            break;
          }
          case AsyncJobType.CSV_IMPORT: {
            const payload = job.payload as { importJobId: string; csvText: string };
            const parsed = Papa.parse<Record<string, string>>(payload.csvText, {
              header: true,
              skipEmptyLines: true
            });

            const importJob = await prisma.importJob.findUnique({
              where: { id: payload.importJobId }
            });

            if (importJob && importJob.organizationId) {
              const ctx = {
                requestId: `job-${job.id}`,
                tenantId: importJob.organizationId,
                membership: {
                  membershipId: importJob.createdByMembershipId,
                  organizationId: importJob.organizationId,
                  organizationName: "",
                  organizationStatus: "ACTIVE",
                  role: "ORGANIZATION_ADMIN",
                  status: "ACTIVE"
                },
                session: {
                  userId: "",
                  email: "",
                  fullName: "",
                  platformRole: "NONE",
                  userStatus: "ACTIVE",
                  membership: null
                }
              } as unknown as OrgRequestContext;

              for (const row of parsed.data) {
                if (!row.firstName || !row.lastName) {
                  continue;
                }

                await contactRepository.create(ctx, prisma, {
                  firstName: row.firstName,
                  lastName: row.lastName,
                  email: row.email?.toLowerCase(),
                  phone: row.phone,
                  ownerMembershipId: importJob.createdByMembershipId,
                  createdByMembershipId: importJob.createdByMembershipId
                });
              }

              await prisma.importJob.update({
                where: { id: importJob.id },
                data: {
                  status: ImportJobStatus.APPLIED,
                  summary: {
                    parsedRows: parsed.data.length
                  }
                }
              });
            }
            break;
          }
          case AsyncJobType.INVITATION_NOTIFICATION:
          case AsyncJobType.ASSIGNMENT_REMINDER:
          case AsyncJobType.SCHEDULED_SUMMARY:
          case AsyncJobType.FOLLOW_UP_REMINDER:
            break;
        }

        await asyncJobRepository.update(prisma, job.id, {
          status: AsyncJobStatus.SUCCEEDED,
          completedAt: new Date()
        });

        results.push({ jobId: job.id, status: "SUCCEEDED" });
      } catch (error) {
        await asyncJobRepository.update(prisma, job.id, {
          status: AsyncJobStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Unknown job failure"
        });
        results.push({ jobId: job.id, status: "FAILED" });
      }
    }

    return results;
  }
};
