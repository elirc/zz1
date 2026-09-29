/**
 * Centralizes owner-assignment rules for org-scoped entities.
 * Called by lead, deal, and activity services before owner fields are written.
 * Calls policy helpers and HTTP errors so "assign to someone else" checks stay server-side.
 * A junior engineer often enforces owner rules in the form UI only and leaves direct API calls unrestricted.
 */
import { forbiddenError, notFoundError } from "@/lib/http/errors";
import { hasOrgPermission, ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { membershipRepository } from "@/repositories/membershipRepository";
import { OrgRequestContext } from "@/types/context";
import { DbClient } from "@/types/db";

export async function resolveAssignableMembership(
  ctx: OrgRequestContext,
  db: DbClient,
  requestedMembershipId?: string | null
) {
  const targetMembershipId = requestedMembershipId ?? ctx.membership.membershipId;

  if (
    targetMembershipId !== ctx.membership.membershipId &&
    !hasOrgPermission(ctx.membership.role, ORG_PERMISSIONS.LEADS_ASSIGN)
  ) {
    // ⚠️ SENIOR NOTE: Assignment is an authorization boundary, not just a convenience field on the record.
    throw forbiddenError("permission_denied", "You are not allowed to assign work to other members.");
  }

  const membership = await membershipRepository.findById(db, ctx.tenantId, targetMembershipId);

  if (!membership) {
    throw notFoundError("membership_not_found", "The selected owner does not belong to this organization.");
  }

  return membership;
}
