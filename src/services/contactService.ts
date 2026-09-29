/**
 * Owns tenant-scoped contact CRUD behavior.
 * Called by contact routes and lead conversion workflows.
 * Calls contactRepository, assignment rules, and audit logging.
 * A junior engineer often treats contacts as simple rows and forgets owner validation and source-lead traceability.
 */
import { ContactStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { resolveAssignableMembership } from "@/lib/permissions/assignment";
import { contactRepository } from "@/repositories/contactRepository";
import { auditService } from "@/services/auditService";
import { OrgRequestContext } from "@/types/context";

type ListContactsInput = {
  page: number;
  pageSize: number;
  status?: ContactStatus;
  ownerMembershipId?: string;
  search?: string;
};

type CreateContactInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  status: ContactStatus;
  ownerMembershipId?: string;
  companyId?: string;
  sourceLeadId?: string;
  tags: string[];
};

export const contactService = {
  async listContacts(ctx: OrgRequestContext, input: ListContactsInput) {
    const where: Prisma.ContactWhereInput = {
      status: input.status,
      ownerMembershipId: input.ownerMembershipId,
      OR: input.search
        ? [
            { firstName: { contains: input.search, mode: "insensitive" as const } },
            { lastName: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } }
          ]
        : undefined
    };

    const [rows, total] = await Promise.all([
      contactRepository.list(ctx, prisma, where, input.page, input.pageSize),
      contactRepository.count(ctx, prisma, where)
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

  async createContact(ctx: OrgRequestContext, input: CreateContactInput) {
    return prisma.$transaction(async (tx) => {
      const owner = await resolveAssignableMembership(ctx, tx, input.ownerMembershipId);

      // ⚠️ SENIOR NOTE: Contact creation needs the same assignment policy as leads or conversion paths become privilege bypasses.
      const contact = await contactRepository.create(ctx, tx, {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email?.toLowerCase(),
        phone: input.phone,
        title: input.title,
        status: input.status,
        ownerMembershipId: owner.id,
        createdByMembershipId: ctx.membership.membershipId,
        companyId: input.companyId,
        sourceLeadId: input.sourceLeadId,
        tags: input.tags
      });

      await auditService.logOrgEvent(ctx, tx, {
        entityType: "contact",
        entityId: contact.id,
        action: "contact.created",
        summary: `Created contact ${contact.firstName} ${contact.lastName}.`,
        metadata: {
          ownerMembershipId: owner.id,
          sourceLeadId: input.sourceLeadId ?? null
        }
      });

      return contact;
    });
  }
};
