/**
 * Updates an org membership's role or status.
 * Called by organization admin user-management actions.
 * Calls auth, tenant guard, validation, and organizationService.updateMembership().
 * A junior engineer often trusts the route param alone and forgets to re-scope the membership to the active tenant.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { updateMembershipBodySchema } from "@/lib/validation/orgSchemas";
import { organizationService } from "@/services/organizationService";

export function PATCH(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.ORG_USERS_WRITE);
    const routeParams = await params;
    const body = updateMembershipBodySchema.parse(await request.json());

    return organizationService.updateMembership(ctx, {
      membershipId: routeParams.membershipId,
      role: body.role,
      status: body.status
    });
  });
}
