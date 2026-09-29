/**
 * Queues contact CSV imports and lists prior import jobs.
 * Called by tenant admin bulk-import screens.
 * Calls auth, tenant guard, import validation, and importService methods.
 * A junior engineer often lets bulk imports bypass the same auth and audit path as manual CRUD.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { createContactImportSchema } from "@/lib/validation/exportSchemas";
import { importService } from "@/services/importService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.CONTACTS_WRITE);
    return importService.listImports(ctx);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.CONTACTS_WRITE);
    const input = createContactImportSchema.parse(await request.json());
    return created(await importService.requestContactImport(ctx, input));
  });
}
