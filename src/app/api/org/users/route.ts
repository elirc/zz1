/**
 * Lists memberships for the active organization.
 * Called by tenant admin UI and onboarding flows.
 * Calls request guards, permission policy, and organizationService workspace read.
 * A junior engineer often forgets that listing users is tenant-sensitive operational data.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { membershipRepository } from "@/repositories/membershipRepository";
import { prisma } from "@/lib/db/prisma";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.ORG_USERS_READ);
    return membershipRepository.listByOrganization(prisma, ctx.tenantId);
  });
}
