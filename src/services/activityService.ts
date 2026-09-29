/**
 * Owns activity creation and operational follow-up list behavior.
 * Called by activity route handlers and reporting flows.
 * Calls assignment rules, activityRepository, and audit logging.
 * A junior engineer often treats tasks and notes the same way and forgets due dates drive reminder workflows.
 */
import { prisma } from "@/lib/db/prisma";
import { resolveAssignableMembership } from "@/lib/permissions/assignment";
import { activityRepository } from "@/repositories/activityRepository";
import { auditService } from "@/services/auditService";
import { OrgRequestContext } from "@/types/context";

type CreateActivityInput = {
  type: "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE";
  subject: string;
  summary?: string;
  outcome?: string;
  nextAction?: string;
  dueAt?: Date;
  ownerMembershipId?: string;
  leadId?: string;
  contactId?: string;
  dealId?: string;
  companyId?: string;
};

export const activityService = {
  async listActivities(
    ctx: OrgRequestContext,
    input: { page: number; pageSize: number; ownerMembershipId?: string; overdueOnly?: boolean }
  ) {
    const where = {
      ownerMembershipId: input.ownerMembershipId,
      dueAt: input.overdueOnly ? { lt: new Date() } : undefined,
      completedAt: input.overdueOnly ? null : undefined
    };

    const rows = await activityRepository.list(ctx, prisma, where, input.page, input.pageSize);

    return {
      rows,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: rows.length
      }
    };
  },

  async createActivity(ctx: OrgRequestContext, input: CreateActivityInput) {
    return prisma.$transaction(async (tx) => {
      const owner = await resolveAssignableMembership(ctx, tx, input.ownerMembershipId);

      // ⚠️ SENIOR NOTE: Follow-up ownership drives reminders and reporting, so defaulting ownership without intent can hide work.
      const activity = await activityRepository.create(ctx, tx, {
        type: input.type,
        subject: input.subject,
        summary: input.summary,
        outcome: input.outcome,
        nextAction: input.nextAction,
        dueAt: input.dueAt,
        ownerMembershipId: owner.id,
        createdByMembershipId: ctx.membership.membershipId,
        leadId: input.leadId,
        contactId: input.contactId,
        dealId: input.dealId,
        companyId: input.companyId
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "activity",
        entityId: activity.id,
        action: "activity.created",
        summary: `Created ${activity.type.toLowerCase()} activity ${activity.subject}.`,
        metadata: {
          ownerMembershipId: owner.id,
          dueAt: activity.dueAt?.toISOString() ?? null
        }
      });

      return activity;
    });
  }
};
