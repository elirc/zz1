/**
 * Owns lead CRUD, status transitions, conversion, and tenant-safe assignment behavior.
 * Called by lead route handlers under src/app/api/leads.
 * Calls repositories, pipeline validation, assignment rules, audit logging, and deal/contact creation collaborators.
 * A junior engineer often treats lead conversion as one update statement instead of a multi-entity workflow with state rules.
 */
import { LeadSource, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveAssignableMembership } from "@/lib/permissions/assignment";
import { conflictError, notFoundError } from "@/lib/http/errors";
import { assignmentHistoryRepository } from "@/repositories/assignmentHistoryRepository";
import { contactRepository } from "@/repositories/contactRepository";
import { leadRepository } from "@/repositories/leadRepository";
import { auditService } from "@/services/auditService";
import { createDealInTransaction } from "@/services/dealService";
import { pipelineService } from "@/services/pipelineService";
import { OrgRequestContext } from "@/types/context";

const allowedLeadTransitions: Record<LeadStatus, LeadStatus[]> = {
  NEW: [LeadStatus.WORKING, LeadStatus.UNQUALIFIED, LeadStatus.ARCHIVED],
  WORKING: [LeadStatus.QUALIFIED, LeadStatus.UNQUALIFIED, LeadStatus.ARCHIVED],
  QUALIFIED: [LeadStatus.CONVERTED, LeadStatus.ARCHIVED],
  UNQUALIFIED: [LeadStatus.WORKING, LeadStatus.ARCHIVED],
  CONVERTED: [],
  ARCHIVED: []
};

type ListLeadsInput = {
  page: number;
  pageSize: number;
  status?: LeadStatus;
  source?: LeadSource;
  ownerMembershipId?: string;
  stageId?: string;
  search?: string;
};

type CreateLeadInput = {
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  companyId?: string;
  ownerMembershipId?: string;
  pipelineId?: string;
  stageId?: string;
  source: "WEBSITE" | "REFERRAL" | "OUTBOUND" | "EVENT" | "PARTNER" | "IMPORT" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  qualificationNotes?: string;
  nextFollowUpAt?: Date;
  tags: string[];
};

export function assertAllowedLeadTransition(current: LeadStatus, next: LeadStatus) {
  // ⚠️ SENIOR NOTE: State machines are business invariants; do not "just let admins override it" without adding explicit audited escape hatches.
  if (!allowedLeadTransitions[current].includes(next)) {
    throw conflictError(
      "invalid_lead_transition",
      `Lead status cannot move from ${current} to ${next}.`
    );
  }
}

export const leadService = {
  async listLeads(ctx: OrgRequestContext, input: ListLeadsInput) {
    const where: Prisma.LeadWhereInput = {
      status: input.status,
      source: input.source,
      ownerMembershipId: input.ownerMembershipId,
      stageId: input.stageId,
      OR: input.search
        ? [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
            { companyName: { contains: input.search, mode: "insensitive" as const } }
          ]
        : undefined
    };

    const [rows, total] = await Promise.all([
      leadRepository.list(ctx, prisma, where, input.page, input.pageSize),
      leadRepository.count(ctx, prisma, where)
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

  async createLead(ctx: OrgRequestContext, input: CreateLeadInput) {
    return prisma.$transaction(async (tx) => {
      const owner = await resolveAssignableMembership(ctx, tx, input.ownerMembershipId);
      const pipeline = input.pipelineId
        ? await pipelineService.requirePipeline(ctx, tx, input.pipelineId)
        : await pipelineService.requireDefaultPipeline(ctx, tx);

      const stage = input.stageId
        ? await pipelineService.requireStage(ctx, tx, input.stageId)
        : pipeline.stages[0];

      if (!stage || stage.pipelineId !== pipeline.id) {
        throw conflictError("stage_pipeline_mismatch", "The selected stage does not belong to the selected pipeline.");
      }

      const lead = await leadRepository.create(ctx, tx, {
        name: input.name,
        email: input.email?.toLowerCase(),
        phone: input.phone,
        companyName: input.companyName,
        companyId: input.companyId,
        ownerMembershipId: owner.id,
        createdByMembershipId: ctx.membership.membershipId,
        updatedByMembershipId: ctx.membership.membershipId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        source: input.source,
        priority: input.priority,
        qualificationNotes: input.qualificationNotes,
        nextFollowUpAt: input.nextFollowUpAt,
        tags: input.tags
      });

      await leadRepository.createStatusHistory(ctx, tx, {
        leadId: lead.id,
        fromStatus: null,
        toStatus: lead.status,
        changedByMembershipId: ctx.membership.membershipId,
        reason: "Lead created"
      });

      await assignmentHistoryRepository.create(tx, {
        organizationId: ctx.tenantId,
        entityType: "lead",
        entityId: lead.id,
        fromMembershipId: null,
        toMembershipId: owner.id,
        changedByMembershipId: ctx.membership.membershipId,
        reason: "Lead created"
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "lead",
        entityId: lead.id,
        action: "lead.created",
        summary: `Created lead ${lead.name}.`,
        metadata: {
          ownerMembershipId: owner.id,
          pipelineId: pipeline.id,
          stageId: stage.id
        }
      });

      return lead;
    });
  },

  async transitionStatus(ctx: OrgRequestContext, leadId: string, input: { status: LeadStatus; reason?: string }) {
    return prisma.$transaction(async (tx) => {
      const lead = await leadRepository.findById(ctx, tx, leadId);

      if (!lead) {
        throw notFoundError("lead_not_found", "The lead could not be found in this organization.");
      }

      assertAllowedLeadTransition(lead.status, input.status);

      const updated = await leadRepository.update(ctx, tx, leadId, {
        status: input.status,
        archivedAt: input.status === LeadStatus.ARCHIVED ? new Date() : null,
        updatedByMembershipId: ctx.membership.membershipId
      });

      await leadRepository.createStatusHistory(ctx, tx, {
        leadId,
        fromStatus: lead.status,
        toStatus: input.status,
        changedByMembershipId: ctx.membership.membershipId,
        reason: input.reason
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "lead",
        entityId: leadId,
        action: "lead.status.changed",
        summary: `Moved lead ${lead.name} from ${lead.status} to ${input.status}.`,
        metadata: {
          fromStatus: lead.status,
          toStatus: input.status
        }
      });

      return updated;
    });
  },

  async convertLead(
    ctx: OrgRequestContext,
    leadId: string,
    input: {
      firstName: string;
      lastName: string;
      title?: string;
      createDeal: boolean;
      dealTitle?: string;
      dealValue?: number;
      stageId?: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const lead = await leadRepository.findById(ctx, tx, leadId);

      if (!lead) {
        throw notFoundError("lead_not_found", "The lead could not be found in this organization.");
      }

      if (lead.convertedContact) {
        throw conflictError("lead_already_converted", "This lead has already been converted.");
      }

      // ⚠️ SENIOR NOTE: Conversion should not be allowed from arbitrary statuses or downstream analytics will count fantasy funnel progress.
      if (lead.status !== LeadStatus.WORKING && lead.status !== LeadStatus.QUALIFIED) {
        throw conflictError(
          "lead_not_convertible",
          `Lead ${lead.id} must be WORKING or QUALIFIED before conversion.`
        );
      }

      const contact = await contactRepository.create(ctx, tx, {
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        email: lead.email,
        phone: lead.phone,
        ownerMembershipId: lead.ownerMembershipId ?? ctx.membership.membershipId,
        createdByMembershipId: ctx.membership.membershipId,
        companyId: lead.companyId,
        sourceLeadId: lead.id,
        tags: lead.tags ?? Prisma.JsonNull
      });

      const updatedLead = await leadRepository.update(ctx, tx, leadId, {
        status: LeadStatus.CONVERTED,
        updatedByMembershipId: ctx.membership.membershipId
      });

      await leadRepository.createStatusHistory(ctx, tx, {
        leadId,
        fromStatus: lead.status,
        toStatus: LeadStatus.CONVERTED,
        changedByMembershipId: ctx.membership.membershipId,
        reason: "Lead converted to contact"
      });

      const deal =
        input.createDeal && input.dealTitle && input.dealValue
          ? await createDealInTransaction(ctx, tx, {
              title: input.dealTitle,
              value: input.dealValue,
              currency: "USD",
              ownerMembershipId: lead.ownerMembershipId ?? ctx.membership.membershipId,
              pipelineId: lead.pipelineId ?? undefined,
              stageId: input.stageId ?? lead.stageId ?? undefined,
              companyId: lead.companyId ?? undefined,
              primaryContactId: contact.id,
              sourceLeadId: lead.id
            })
          : null;

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "lead",
        entityId: leadId,
        action: "lead.converted",
        summary: `Converted lead ${lead.name} into contact ${contact.id}.`,
        metadata: {
          contactId: contact.id,
          dealId: deal?.id ?? null
        }
      });

      return {
        lead: updatedLead,
        contact,
        deal
      };
    });
  }
};
