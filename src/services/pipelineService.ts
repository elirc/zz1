/**
 * Owns pipeline setup and stage lookup rules for tenant CRM workflows.
 * Called by organization bootstrap and later by lead/deal services.
 * Calls pipelineRepository and shared error helpers to keep stage validation centralized.
 * A junior engineer often hardcodes stage ids in services instead of resolving them from tenant configuration.
 */
import { PipelineStage } from "@prisma/client";
import { conflictError, notFoundError } from "@/lib/http/errors";
import { pipelineRepository } from "@/repositories/pipelineRepository";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

const defaultStages = [
  { key: "inbox", name: "Inbox", position: 1, probability: 5, isClosed: false, isWon: false },
  { key: "working", name: "Working", position: 2, probability: 20, isClosed: false, isWon: false },
  { key: "qualified", name: "Qualified", position: 3, probability: 45, isClosed: false, isWon: false },
  { key: "proposal", name: "Proposal", position: 4, probability: 70, isClosed: false, isWon: false },
  { key: "won", name: "Won", position: 5, probability: 100, isClosed: true, isWon: true },
  { key: "lost", name: "Lost", position: 6, probability: 0, isClosed: true, isWon: false }
];

export const pipelineService = {
  async provisionDefaultPipeline(db: DbClient, organizationId: string) {
    const existing = await pipelineRepository.findDefault(db, organizationId);

    // ⚠️ SENIOR NOTE: Provisioning must be idempotent because org bootstrap and seed paths may both call it.
    if (existing) {
      return existing;
    }

    const pipeline = await pipelineRepository.createPipeline(db, {
      organizationId,
      name: "Core Revenue Pipeline",
      key: "core-revenue",
      isDefault: true
    });

    await pipelineRepository.createStages(
      db,
      defaultStages.map((stage) => ({
        organizationId,
        pipelineId: pipeline.id,
        ...stage
      }))
    );

    return pipelineRepository.findDefault(db, organizationId);
  },

  async requireStage(ctx: OrgRequestContext, db: DbClient, stageId: string): Promise<PipelineStage & { pipelineId: string }> {
    const stage = await pipelineRepository.findStage(db, ctx.tenantId, stageId);

    if (!stage) {
      throw notFoundError("pipeline_stage_not_found", "The requested pipeline stage was not found in this organization.");
    }

    return stage;
  },

  async requireDefaultPipeline(ctx: OrgRequestContext, db: DbClient) {
    const pipeline = await pipelineRepository.findDefault(db, ctx.tenantId);

    if (!pipeline) {
      throw conflictError("default_pipeline_missing", "This organization is missing its default pipeline.");
    }

    return pipeline;
  },

  async requirePipeline(ctx: OrgRequestContext, db: DbClient, pipelineId: string) {
    const pipeline = await pipelineRepository.findById(db, ctx.tenantId, pipelineId);

    if (!pipeline) {
      throw notFoundError("pipeline_not_found", "The requested pipeline was not found in this organization.");
    }

    return pipeline;
  }
};
