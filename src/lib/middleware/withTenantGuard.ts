/**
 * Enforces that a request has an active membership and organization context.
 * Called by org-scoped route handlers after authentication and before business logic.
 * Calls tenantContext helpers and permission policy checks.
 * A junior engineer often assumes "logged in" automatically means "authorized for this tenant".
 */
import { MembershipStatus } from "@prisma/client";
import { forbiddenError } from "@/lib/http/errors";
import { requireTenantContext } from "@/lib/db/tenantContext";
import { assertOrgPermission, OrgPermission } from "@/lib/permissions/policy";
import { OrgRequestContext, RequestContext } from "@/types/context";

export function requireOrgRequest(ctx: RequestContext, permission?: OrgPermission): OrgRequestContext {
  const orgCtx = requireTenantContext(ctx);

  // ⚠️ SENIOR NOTE: Org membership status and org status are separate checks; skipping either creates weird half-authorized states.
  if (orgCtx.membership.status !== MembershipStatus.ACTIVE) {
    throw forbiddenError("inactive_membership", "Your membership is not active for this organization.");
  }

  if (!["ACTIVE", "TRIALING"].includes(orgCtx.membership.organizationStatus)) {
    throw forbiddenError("organization_unavailable", "This organization is not currently active.");
  }

  if (permission) {
    assertOrgPermission(orgCtx, permission);
  }

  return orgCtx;
}
