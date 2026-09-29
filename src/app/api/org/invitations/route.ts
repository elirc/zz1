/**
 * Lists and creates invitations for the active organization.
 * Called by org admin membership management screens.
 * Calls auth, tenant guard, invitation validation, and organizationService invitation workflow.
 * A junior engineer often sends the email immediately in the route instead of persisting retryable notification work.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { createInvitationSchema } from "@/lib/validation/orgSchemas";
import { invitationRepository } from "@/repositories/invitationRepository";
import { organizationService } from "@/services/organizationService";
import { prisma } from "@/lib/db/prisma";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.ORG_USERS_READ);
    return invitationRepository.listByOrganization(prisma, ctx.tenantId);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.ORG_USERS_WRITE);
    const input = createInvitationSchema.parse(await request.json());
    return created(await organizationService.inviteUser(ctx, input));
  });
}
