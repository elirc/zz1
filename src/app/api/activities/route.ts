/**
 * Lists and creates activities for the active tenant.
 * Called by follow-up queues and entity timeline UIs.
 * Calls auth, tenant guard, activity validation, and activityService methods.
 * A junior engineer often treats activity logging as low-risk and leaves it out of permission review.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { activityListQuerySchema, createActivitySchema } from "@/lib/validation/activitySchemas";
import { activityService } from "@/services/activityService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.ACTIVITIES_READ);
    const input = activityListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return activityService.listActivities(ctx, input);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.ACTIVITIES_WRITE);
    const input = createActivitySchema.parse(await request.json());
    return created(await activityService.createActivity(ctx, input));
  });
}
