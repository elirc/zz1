/**
 * Resolves authenticated request context from the incoming Next.js request.
 * Called by route handlers before any service or repository logic runs.
 * Calls auth/session.ts and HTTP error helpers so unauthorized requests fail consistently.
 * A junior engineer often lets handlers fetch auth state ad hoc, which duplicates checks and creates inconsistent bypass paths.
 */
import { NextRequest } from "next/server";
import { PlatformRole, UserStatus } from "@prisma/client";
import { getOptionalSession } from "@/lib/auth/session";
import { forbiddenError, unauthorizedError } from "@/lib/http/errors";
import { RequestContext } from "@/types/context";

function requestIdFromHeaders(request: NextRequest) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export async function requireAuthenticatedRequest(request: NextRequest): Promise<RequestContext> {
  const session = await getOptionalSession(request);

  // ⚠️ SENIOR NOTE: Returning a nullable context here would force every route to remember a second auth branch and eventually one will forget.
  if (!session) {
    throw unauthorizedError("auth_required", "You must be signed in to access this endpoint.");
  }

  if (session.userStatus !== UserStatus.ACTIVE) {
    throw unauthorizedError("user_disabled", "This user account is disabled.");
  }

  return {
    requestId: requestIdFromHeaders(request),
    session,
    tenantId: session.membership?.organizationId ?? null
  };
}

export async function requirePlatformAdminRequest(request: NextRequest): Promise<RequestContext> {
  const ctx = await requireAuthenticatedRequest(request);

  if (ctx.session.platformRole !== PlatformRole.PLATFORM_ADMIN) {
    throw forbiddenError("platform_admin_required", "Platform admin access is required.");
  }

  return ctx;
}
