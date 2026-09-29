/**
 * Owns pipeline and stage persistence for organization CRM workflows.
 * Called by pipeline service and downstream lead/deal services that need valid stage references.
 * Calls Prisma directly and keeps tenant scoping explicit in every query shape.
 * A junior engineer often validates a stage id exists without proving it belongs to the same pipeline and organization.
 */
import { Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const pipelineRepository = {
  createPipeline(db: DbClient, data: Prisma.PipelineUncheckedCreateInput) {
    return db.pipeline.create({ data });
  },

  createStages(db: DbClient, data: Prisma.PipelineStageUncheckedCreateInput[]) {
    return db.pipelineStage.createMany({ data });
  },

  listByOrganization(db: DbClient, organizationId: string) {
    return db.pipeline.findMany({
      where: { organizationId, active: true },
      include: {
        stages: {
          where: { active: true },
          orderBy: { position: "asc" }
        }
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });
  },

  findDefault(db: DbClient, organizationId: string) {
    return db.pipeline.findFirst({
      where: { organizationId, isDefault: true, active: true },
      include: {
        stages: {
          where: { active: true },
          orderBy: { position: "asc" }
        }
      }
    });
  },

  findById(db: DbClient, organizationId: string, pipelineId: string) {
    return db.pipeline.findFirst({
      where: {
        id: pipelineId,
        organizationId,
        active: true
      },
      include: {
        stages: {
          where: { active: true },
          orderBy: { position: "asc" }
        }
      }
    });
  },

  findStage(db: DbClient, organizationId: string, stageId: string) {
    return db.pipelineStage.findFirst({
      where: {
        // ⚠️ SENIOR NOTE: Stage existence is not enough; stage must belong to the active tenant before deal/lead services can trust it.
        id: stageId,
        organizationId,
        active: true
      },
      include: {
        pipeline: true
      }
    });
  }
};
