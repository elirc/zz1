/**
 * Lists export jobs and queues new exports.
 * Called by list screens and saved view actions.
 * Calls auth, tenant guard, export validation, and exportService methods.
 * A junior engineer often handles exports as synchronous downloads, which falls apart on large datasets.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { requestExportSchema } from "@/lib/validation/exportSchemas";
import { exportService } from "@/services/exportService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.EXPORTS_READ);
    return exportService.listExportJobs(ctx);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.EXPORTS_WRITE);
    const input = requestExportSchema.parse(await request.json());
    return created(await exportService.requestExport(ctx, input));
  });
}
