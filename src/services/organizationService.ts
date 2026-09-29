/**
 * Coordinates platform org creation and tenant membership administration workflows.
 * Called by platform and org admin route handlers under src/app/api.
 * Calls repositories, pipeline bootstrap, async job enqueueing, and audit logging inside transactions.
 * A junior engineer often spreads this workflow across route handlers and makes partial failure handling unsafe.
 */
import {
  AsyncJobType,
  MembershipRole,
  MembershipStatus,
  Prisma,
  UserStatus
} from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { conflictError, notFoundError } from "@/lib/http/errors";
import { asyncJobRepository } from "@/repositories/asyncJobRepository";
import { invitationRepository } from "@/repositories/invitationRepository";
import { membershipRepository } from "@/repositories/membershipRepository";
import { organizationRepository } from "@/repositories/organizationRepository";
import { userRepository } from "@/repositories/userRepository";
import { auditService } from "@/services/auditService";
import { pipelineService } from "@/services/pipelineService";
import { OrgRequestContext, RequestContext } from "@/types/context";

type CreateOrganizationInput = {
  name: string;
  slug: string;
  plan: "FREE" | "GROWTH" | "ENTERPRISE";
  status: "ACTIVE" | "TRIALING" | "SUSPENDED" | "ARCHIVED";
  website?: string;
  owner: {
    email: string;
    firstName: string;
    lastName: string;
    title?: string;
  };
};

type InviteUserInput = {
  email: string;
  role: MembershipRole;
};

type UpdateMembershipInput = {
  membershipId: string;
  role?: MembershipRole;
  status?: MembershipStatus;
};

export const organizationService = {
  listOrganizations() {
    return organizationRepository.list(prisma);
  },

  async createOrganization(ctx: RequestContext, input: CreateOrganizationInput) {
    return prisma.$transaction(async (tx) => {
      const existingUser = await userRepository.findByEmail(tx, input.owner.email);
      const organization = await organizationRepository.create(tx, {
        name: input.name,
        slug: input.slug,
        plan: input.plan,
        status: input.status,
        website: input.website,
        settings: {
          locale: "en-US",
          timezone: "America/Los_Angeles",
          defaultCurrency: "USD"
        } satisfies Prisma.InputJsonValue
      });

      const user =
        existingUser ??
        (await userRepository.create(tx, {
          email: input.owner.email.toLowerCase(),
          firstName: input.owner.firstName,
          lastName: input.owner.lastName,
          status: UserStatus.ACTIVE
        }));

      const membership = await membershipRepository.create(tx, {
        organizationId: organization.id,
        userId: user.id,
        role: MembershipRole.ORGANIZATION_ADMIN,
        status: MembershipStatus.ACTIVE,
        title: input.owner.title
      });

      await pipelineService.provisionDefaultPipeline(tx, organization.id);

      await auditService.logPlatformEvent(ctx, tx, {
        entityType: "organization",
        entityId: organization.id,
        action: "platform.organization.created",
        summary: `Created organization ${organization.slug} with owner ${user.email}.`,
        metadata: {
          organizationSlug: organization.slug,
          ownerUserId: user.id,
          ownerMembershipId: membership.id
        }
      });

      return {
        organization,
        ownerMembership: membership
      };
    });
  },

  async getCurrentOrganizationWorkspace(ctx: OrgRequestContext) {
    const [organization, memberships, pipelines, recentAudit] = await Promise.all([
      organizationRepository.findById(prisma, ctx.tenantId),
      membershipRepository.listByOrganization(prisma, ctx.tenantId),
      prisma.pipeline.findMany({
        where: { organizationId: ctx.tenantId, active: true },
        include: {
          stages: {
            where: { active: true },
            orderBy: { position: "asc" }
          }
        }
      }),
      prisma.auditLog.findMany({
        where: { organizationId: ctx.tenantId },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    if (!organization) {
      throw notFoundError("organization_not_found", "The active organization could not be found.");
    }

    return {
      organization,
      currentMembership: ctx.membership,
      users: memberships.map((membership) => ({
        membershipId: membership.id,
        role: membership.role,
        status: membership.status,
        title: membership.title,
        user: membership.user
      })),
      pipelines,
      recentAudit
    };
  },

  async inviteUser(ctx: OrgRequestContext, input: InviteUserInput) {
    const existingMemberships = await membershipRepository.listByOrganization(prisma, ctx.tenantId);

    if (existingMemberships.some((membership) => membership.user.email === input.email.toLowerCase())) {
      throw conflictError("membership_exists", "That user already belongs to this organization.");
    }

    return prisma.$transaction(async (tx) => {
      const invitation = await invitationRepository.create(tx, {
        organizationId: ctx.tenantId,
        email: input.email.toLowerCase(),
        role: input.role,
        invitedByUserId: ctx.session.userId,
        token: crypto.randomUUID(),
        expiresAt: addDays(new Date(), 7)
      });

      await asyncJobRepository.create(tx, {
        organizationId: ctx.tenantId,
        type: AsyncJobType.INVITATION_NOTIFICATION,
        payload: {
          invitationId: invitation.id,
          email: invitation.email,
          organizationId: ctx.tenantId
        } satisfies Prisma.InputJsonValue,
        runAt: new Date()
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "invitation",
        entityId: invitation.id,
        action: "org.invitation.created",
        summary: `Invited ${invitation.email} as ${invitation.role}.`,
        metadata: {
          role: invitation.role
        }
      });

      return invitation;
    });
  },

  async updateMembership(ctx: OrgRequestContext, input: UpdateMembershipInput) {
    const membership = await membershipRepository.findById(prisma, ctx.tenantId, input.membershipId);

    if (!membership) {
      throw notFoundError("membership_not_found", "The membership could not be found in this organization.");
    }

    if (
      membership.role === MembershipRole.ORGANIZATION_ADMIN &&
      (input.role && input.role !== MembershipRole.ORGANIZATION_ADMIN || input.status === MembershipStatus.DISABLED)
    ) {
      const adminCount = await membershipRepository.countAdmins(prisma, ctx.tenantId);

      // ⚠️ SENIOR NOTE: Preventing the last active admin from being removed is not a UI concern; it protects tenant recoverability.
      if (adminCount <= 1) {
        throw conflictError(
          "last_admin_guard",
          "You cannot remove or disable the last active organization admin."
        );
      }
    }

    const updated = await membershipRepository.update(prisma, ctx.tenantId, input.membershipId, {
      role: input.role,
      status: input.status
    });

    if (!updated) {
      throw notFoundError("membership_not_found", "The membership update did not persist.");
    }

    await auditService.logOrgEvent(ctx, prisma, {
      entityType: "membership",
      entityId: membership.id,
      action: "org.membership.updated",
      summary: `Updated membership ${membership.id} for ${membership.user.email}.`,
      metadata: {
        previousRole: membership.role,
        nextRole: updated.role,
        previousStatus: membership.status,
        nextStatus: updated.status
      }
    });

    return updated;
  }
};
