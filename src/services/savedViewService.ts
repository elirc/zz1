/**
 * Owns saved-view CRUD behavior for operational list screens.
 * Called by saved-view route handlers and export workflows.
 * Calls savedViewRepository and audit logging.
 * A junior engineer often stores saved views only in local storage and misses a key multi-user SaaS workflow.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { savedViewRepository } from "@/repositories/savedViewRepository";
import { auditService } from "@/services/auditService";
import { OrgRequestContext } from "@/types/context";

type CreateSavedViewInput = {
  resource: "LEAD" | "CONTACT" | "DEAL" | "ACTIVITY";
  visibility: "PERSONAL" | "ORGANIZATION";
  name: string;
  filters: Prisma.InputJsonValue;
  sort?: Prisma.InputJsonValue;
  columns?: string[];
  isDefault: boolean;
};

export const savedViewService = {
  listSavedViews(ctx: OrgRequestContext) {
    return savedViewRepository.list(ctx, prisma);
  },

  async createSavedView(ctx: OrgRequestContext, input: CreateSavedViewInput) {
    return prisma.$transaction(async (tx) => {
      // ⚠️ SENIOR NOTE: Saved views become part of team workflow once shared, so they deserve audit visibility even if the data shape is "just JSON".
      const savedView = await savedViewRepository.create(ctx, tx, {
        ownerMembershipId: ctx.membership.membershipId,
        resource: input.resource,
        visibility: input.visibility,
        name: input.name,
        filters: input.filters,
        sort: input.sort,
        columns: input.columns,
        isDefault: input.isDefault
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "saved_view",
        entityId: savedView.id,
        action: "saved_view.created",
        summary: `Created saved view ${savedView.name}.`,
        metadata: {
          resource: savedView.resource,
          visibility: savedView.visibility
        }
      });

      return savedView;
    });
  }
};
