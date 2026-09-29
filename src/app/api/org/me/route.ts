/**
 * Returns the active tenant workspace context for the signed-in user.
 * Called by the workspace shell and dashboard hooks on first load.
 * Calls withAuth.ts, withTenantGuard.ts, and organizationService.getCurrentOrganizationWorkspace().
 * A junior engineer often overfetches raw tables here instead of returning a curated workspace bootstrap payload.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { organizationService } from "@/services/organizationService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx);
    return organizationService.getCurrentOrganizationWorkspace(ctx);
  });
}
