/**
 * Lists and creates saved views for operational CRM tables.
 * Called by list screens that persist filter and column state.
 * Calls auth, tenant guard, validation, and savedViewService methods.
 * A junior engineer often assumes saved views are harmless preferences and skips tenant-aware authorization.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { createSavedViewSchema } from "@/lib/validation/savedViewSchemas";
import { savedViewService } from "@/services/savedViewService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.SAVED_VIEWS_MANAGE);
    return savedViewService.listSavedViews(ctx);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.SAVED_VIEWS_MANAGE);
    const input = createSavedViewSchema.parse(await request.json());
    return created(await savedViewService.createSavedView(ctx, input));
  });
}
