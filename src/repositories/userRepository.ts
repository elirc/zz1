/**
 * Handles user record lookup and creation independent of org membership.
 * Called by org invitation and organization bootstrap services.
 * Calls Prisma directly so service code can decide when users are reused across tenants.
 * A junior engineer often duplicates user rows per organization instead of separating user identity from membership.
 */
import { Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const userRepository = {
  findByEmail(db: DbClient, email: string) {
    return db.user.findUnique({
      // ⚠️ SENIOR NOTE: Normalize email lookup at the repository boundary or auth and invites will disagree about identity.
      where: { email: email.toLowerCase() }
    });
  },

  create(db: DbClient, data: Prisma.UserUncheckedCreateInput) {
    return db.user.create({ data });
  },

  updateLastLogin(db: DbClient, userId: string) {
    return db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() }
    });
  }
};
