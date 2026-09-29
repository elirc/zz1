/**
 * Persists assignment change history for leads, deals, and future CRM entities.
 * Called by services whenever ownership is created or reassigned.
 * Calls Prisma through DbClient so assignment history can share the same transaction as the primary write.
 * A junior engineer often mutates owner fields without leaving an operational trail for support and audit teams.
 */
import { Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const assignmentHistoryRepository = {
  create(db: DbClient, data: Prisma.AssignmentHistoryUncheckedCreateInput) {
    // ⚠️ SENIOR NOTE: Ownership changes are compliance-relevant in sales systems, so history should not be optional.
    return db.assignmentHistory.create({ data });
  }
};
