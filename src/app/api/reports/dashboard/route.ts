/**
 * Returns aggregated dashboard metrics for the active organization.
 * Called by the workspace dashboard and admin reporting panels.
 * Calls auth, tenant guard, and reportingService.getDashboard().
 * A junior engineer often exposes raw tables and leaves aggregation work to the browser, which is slow and less secure.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { reportingService } from "@/services/reportingService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.REPORTS_READ);
    return reportingService.getDashboard(ctx);
  });
}
