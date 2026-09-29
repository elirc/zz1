/**
 * Persists org user invitations and lookup queries.
 * Called by src/services/organizationService.ts during invite workflows.
 * Calls Prisma only, leaving email notification scheduling to higher layers.
 * A junior engineer often treats invitation status as a UI concern and forgets it is part of authorization workflow state.
 */
import { Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const invitationRepository = {
  create(db: DbClient, data: Prisma.InvitationUncheckedCreateInput) {
    // ⚠️ SENIOR NOTE: Invitation rows are part of access-control state, not just email metadata.
    return db.invitation.create({ data });
  },

  listByOrganization(db: DbClient, organizationId: string) {
    return db.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" }
    });
  }
};
