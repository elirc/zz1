/**
 * Returns active pipelines and stages for the current organization.
 * Called by lead/deal forms that need valid pipeline configuration.
 * Calls auth, tenant guard, and pipelineRepository list queries.
 * A junior engineer often exposes pipeline config without tenant scoping because it "looks like static metadata".
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { pipelineRepository } from "@/repositories/pipelineRepository";
import { prisma } from "@/lib/db/prisma";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.LEADS_READ);
    return pipelineRepository.listByOrganization(prisma, ctx.tenantId);
  });
}
