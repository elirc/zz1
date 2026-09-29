/**
 * Owns tenant-scoped contact persistence and lookup queries.
 * Called by contactService and lead conversion workflows.
 * Calls tenantContext helpers and Prisma includes for owner/company relations.
 * A junior engineer often loads contacts without enough relation data and then recreates N+1 lookups in the UI.
 */
import { Prisma } from "@prisma/client";
import { withTenantScope } from "@/lib/db/tenantContext";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export const contactRepository = {
  list(ctx: OrgRequestContext, db: DbClient, where: Prisma.ContactWhereInput, page: number, pageSize: number) {
    return db.contact.findMany({
      where: withTenantScope(ctx, where),
      include: {
        owner: { include: { user: true } },
        company: true,
        sourceLead: true
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
  },

  count(ctx: OrgRequestContext, db: DbClient, where: Prisma.ContactWhereInput) {
    return db.contact.count({
      where: withTenantScope(ctx, where)
    });
  },

  create(
    ctx: OrgRequestContext,
    db: DbClient,
    data: Omit<Prisma.ContactUncheckedCreateInput, "organizationId">
  ) {
    return db.contact.create({
      data: {
        // ⚠️ SENIOR NOTE: Tenant-owned creates should inject organizationId here, not trust callers to remember it.
        ...data,
        organizationId: ctx.tenantId
      },
      include: {
        owner: { include: { user: true } },
        company: true,
        sourceLead: true
      }
    });
  },

  findById(ctx: OrgRequestContext, db: DbClient, contactId: string) {
    return db.contact.findFirst({
      where: withTenantScope(ctx, { id: contactId }),
      include: {
        owner: { include: { user: true } },
        company: true,
        sourceLead: true
      }
    });
  }
};
