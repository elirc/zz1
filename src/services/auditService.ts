/**
 * Coordinates audit logging so workflows record traceable platform and org events.
 * Called by organization, lead, deal, export, and async workflow services.
 * Calls auditRepository with the active actor identity from request context.
 * A junior engineer often logs only the final entity snapshot and omits the action semantics reviewers need during incidents.
 */
import { Prisma } from "@prisma/client";
import { auditRepository } from "@/repositories/auditRepository";
import { OrgRequestContext, RequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

type AuditInput = {
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  metadata?: Prisma.InputJsonValue;
};

export const auditService = {
  logPlatformEvent(ctx: RequestContext, db: DbClient, input: AuditInput) {
    return auditRepository.create(db, {
      actorUserId: ctx.session.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata
    });
  },

  logOrgEvent(ctx: OrgRequestContext, db: DbClient, input: AuditInput) {
    // ⚠️ SENIOR NOTE: Keep both actorUserId and actorMembershipId. Investigations often need to distinguish identity from org role context.
    return auditRepository.create(db, {
      organizationId: ctx.tenantId,
      actorUserId: ctx.session.userId,
      actorMembershipId: ctx.membership.membershipId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata
    });
  }
};
