/**
 * Owns tenant-scoped deal CRUD behavior and stage transition rules.
 * Called by deal routes and lead conversion workflows.
 * Calls pipeline validation, dealRepository, assignment history, and audit logging.
 * A junior engineer often updates stage ids directly without deriving the resulting deal status and close timestamps.
 */
import { DealStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveAssignableMembership } from "@/lib/permissions/assignment";
import { conflictError, notFoundError } from "@/lib/http/errors";
import { assignmentHistoryRepository } from "@/repositories/assignmentHistoryRepository";
import { dealRepository } from "@/repositories/dealRepository";
import { auditService } from "@/services/auditService";
import { pipelineService } from "@/services/pipelineService";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

type ListDealsInput = {
  page: number;
  pageSize: number;
  status?: DealStatus;
  ownerMembershipId?: string;
  stageId?: string;
  search?: string;
};

type CreateDealInput = {
  title: string;
  value: number;
  currency: string;
  ownerMembershipId?: string;
  pipelineId?: string;
  stageId?: string;
  companyId?: string;
  primaryContactId?: string;
  sourceLeadId?: string;
  expectedCloseDate?: Date;
  nextStep?: string;
};

export const dealService = {
  async listDeals(ctx: OrgRequestContext, input: ListDealsInput) {
    const where: Prisma.DealWhereInput = {
      status: input.status,
      ownerMembershipId: input.ownerMembershipId,
      stageId: input.stageId,
      OR: input.search
        ? [{ title: { contains: input.search, mode: "insensitive" as const } }]
        : undefined
    };

    const [rows, total] = await Promise.all([
      dealRepository.list(ctx, prisma, where, input.page, input.pageSize),
      dealRepository.count(ctx, prisma, where)
    ]);

    return {
      rows,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total
      }
    };
  },

  async createDeal(ctx: OrgRequestContext, input: CreateDealInput) {
    return prisma.$transaction((tx) => createDealInTransaction(ctx, tx, input));
  },

  async moveDealStage(ctx: OrgRequestContext, dealId: string, input: { stageId: string; note?: string }) {
    return prisma.$transaction(async (tx) => {
      const deal = await dealRepository.findById(ctx, tx, dealId);

      if (!deal) {
        throw notFoundError("deal_not_found", "The deal could not be found in this organization.");
      }

      const nextStage = await pipelineService.requireStage(ctx, tx, input.stageId);

      // ⚠️ SENIOR NOTE: Accepting a stage from another pipeline silently corrupts pipeline metrics and can surface impossible boards.
      if (nextStage.pipelineId !== deal.pipelineId) {
        throw conflictError("stage_pipeline_mismatch", "You cannot move a deal into a stage from another pipeline.");
      }

      const status: DealStatus = nextStage.isClosed
        ? nextStage.isWon
          ? DealStatus.WON
          : DealStatus.LOST
        : DealStatus.OPEN;

      const updated = await dealRepository.update(ctx, tx, dealId, {
        stageId: nextStage.id,
        status,
        closedAt: nextStage.isClosed ? new Date() : null
      });

      await dealRepository.createStageHistory(ctx, tx, {
        dealId,
        fromStageId: deal.stageId,
        toStageId: nextStage.id,
        changedByMembershipId: ctx.membership.membershipId,
        note: input.note
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "deal",
        entityId: dealId,
        action: "deal.stage.moved",
        summary: `Moved deal ${deal.title} to ${nextStage.name}.`,
        metadata: {
          fromStageId: deal.stageId,
          toStageId: nextStage.id
        }
      });

      return updated;
    });
  }
};

export async function createDealInTransaction(ctx: OrgRequestContext, db: DbClient, input: CreateDealInput) {
  const owner = await resolveAssignableMembership(ctx, db, input.ownerMembershipId);
  const pipeline = input.pipelineId
    ? await pipelineService.requirePipeline(ctx, db, input.pipelineId)
    : await pipelineService.requireDefaultPipeline(ctx, db);

  const stage = input.stageId ? await pipelineService.requireStage(ctx, db, input.stageId) : pipeline.stages[0];

  if (!stage || stage.pipelineId !== pipeline.id) {
    throw conflictError("stage_pipeline_mismatch", "The selected stage does not belong to the selected pipeline.");
  }

  const status: DealStatus = stage.isClosed ? (stage.isWon ? DealStatus.WON : DealStatus.LOST) : DealStatus.OPEN;
  const closedAt = stage.isClosed ? new Date() : null;

  const deal = await dealRepository.create(ctx, db, {
    title: input.title,
    value: new Prisma.Decimal(input.value),
    currency: input.currency.toUpperCase(),
    ownerMembershipId: owner.id,
    createdByMembershipId: ctx.membership.membershipId,
    pipelineId: pipeline.id,
    stageId: stage.id,
    companyId: input.companyId,
    primaryContactId: input.primaryContactId,
    sourceLeadId: input.sourceLeadId,
    expectedCloseDate: input.expectedCloseDate,
    nextStep: input.nextStep,
    status,
    closedAt
  });

  await dealRepository.createStageHistory(ctx, db, {
    dealId: deal.id,
    fromStageId: null,
    toStageId: stage.id,
    changedByMembershipId: ctx.membership.membershipId,
    note: "Deal created"
  });

  await assignmentHistoryRepository.create(db, {
    organizationId: ctx.tenantId,
    entityType: "deal",
    entityId: deal.id,
    fromMembershipId: null,
    toMembershipId: owner.id,
    changedByMembershipId: ctx.membership.membershipId,
    reason: "Deal created"
  });

  await auditService.logOrgEvent(ctx, db, {
    entityType: "deal",
    entityId: deal.id,
    action: "deal.created",
    summary: `Created deal ${deal.title}.`,
    metadata: {
      stageId: stage.id,
      pipelineId: pipeline.id,
      ownerMembershipId: owner.id
    }
  });

  return deal;
}
