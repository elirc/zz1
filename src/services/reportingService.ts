/**
 * Owns dashboard-style aggregation queries for org operational reporting.
 * Called by report route handlers and workspace bootstrap pages.
 * Calls Prisma groupBy/count queries with explicit tenant filters.
 * A junior engineer often builds reports by fetching every row first, which is both slow and easy to scope incorrectly.
 */
import { ActivityStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { membershipRepository } from "@/repositories/membershipRepository";
import { OrgRequestContext } from "@/types/context";

export const reportingService = {
  async getDashboard(ctx: OrgRequestContext) {
    // ⚠️ SENIOR NOTE: Aggregations should stay in the database; fetching all rows first will fail both performance and tenant-auditability reviews.
    const [
      leadsByStatus,
      leadsBySource,
      leadsByOwner,
      contactsByStatus,
      pipelineValueByStage,
      overdueFollowUps,
      repActivitySummaries,
      conversionSnapshot,
      orgCounts,
      memberships
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ["status"],
        where: { organizationId: ctx.tenantId },
        _count: { _all: true }
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { organizationId: ctx.tenantId },
        _count: { _all: true }
      }),
      prisma.lead.groupBy({
        by: ["ownerMembershipId"],
        where: { organizationId: ctx.tenantId },
        _count: { _all: true }
      }),
      prisma.contact.groupBy({
        by: ["status"],
        where: { organizationId: ctx.tenantId },
        _count: { _all: true }
      }),
      prisma.deal.groupBy({
        by: ["stageId"],
        where: { organizationId: ctx.tenantId, status: "OPEN" },
        _sum: { value: true }
      }),
      prisma.activity.count({
        where: {
          organizationId: ctx.tenantId,
          dueAt: { lt: new Date() },
          status: ActivityStatus.OPEN
        }
      }),
      prisma.activity.groupBy({
        by: ["ownerMembershipId"],
        where: { organizationId: ctx.tenantId },
        _count: { _all: true }
      }),
      prisma.lead.count({
        where: { organizationId: ctx.tenantId, status: "CONVERTED" }
      }),
      Promise.all([
        prisma.lead.count({ where: { organizationId: ctx.tenantId } }),
        prisma.contact.count({ where: { organizationId: ctx.tenantId } }),
        prisma.deal.count({ where: { organizationId: ctx.tenantId } }),
        prisma.exportJob.count({ where: { organizationId: ctx.tenantId } })
      ]),
      membershipRepository.listByOrganization(prisma, ctx.tenantId)
    ]);

    const membershipMap = new Map(
      memberships.map((membership) => [membership.id, `${membership.user.firstName} ${membership.user.lastName}`])
    );

    return {
      leadsByStatus,
      leadsBySource,
      leadsByOwner: leadsByOwner.map((row) => ({
        ownerMembershipId: row.ownerMembershipId,
        ownerName: row.ownerMembershipId ? membershipMap.get(row.ownerMembershipId) : "Unassigned",
        count: row._count._all
      })),
      contactsByStatus,
      pipelineValueByStage,
      overdueFollowUps,
      repActivitySummaries: repActivitySummaries.map((row) => ({
        ownerMembershipId: row.ownerMembershipId,
        ownerName: row.ownerMembershipId ? membershipMap.get(row.ownerMembershipId) : "Unassigned",
        count: row._count._all
      })),
      conversionSnapshot: {
        convertedLeads: conversionSnapshot
      },
      organizationCounts: {
        leads: orgCounts[0],
        contacts: orgCounts[1],
        deals: orgCounts[2],
        exports: orgCounts[3]
      }
    };
  }
};
