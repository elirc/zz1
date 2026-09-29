/**
 * Owns Prisma client instantiation for the application.
 * Called by repositories, auth/session loading, and seed/test utilities.
 * Calls @prisma/client so higher layers never create ad-hoc database clients.
 * A junior engineer often creates multiple PrismaClient instances and causes connection churn in development.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
