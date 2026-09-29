/**
 * Persists background job records for notifications, exports, reminders, and imports.
 * Called by export, invitation, and operational summary services.
 * Calls Prisma through DbClient so async jobs can be enqueued inside the same transaction as the originating action.
 * A junior engineer often treats background work as "just call another function later" and loses retryable state.
 */
import { Prisma } from "@prisma/client";
import { DbClient } from "@/types/db";

export const asyncJobRepository = {
  create(db: DbClient, data: Prisma.AsyncJobUncheckedCreateInput) {
    return db.asyncJob.create({ data });
  },

  listDue(db: DbClient, runAt = new Date()) {
    return db.asyncJob.findMany({
      where: {
        runAt: { lte: runAt },
        status: "QUEUED"
      },
      orderBy: { runAt: "asc" }
    });
  },

  update(db: DbClient, id: string, data: Prisma.AsyncJobUncheckedUpdateInput) {
    // ⚠️ SENIOR NOTE: Async jobs need durable lifecycle state or retries and failure handling become guesswork.
    return db.asyncJob.update({
      where: { id },
      data
    });
  }
};
