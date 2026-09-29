/**
 * Lists and creates tenant-scoped leads.
 * Called by CRM list screens and lead creation forms.
 * Calls auth guard, tenant guard, Zod validation, and leadService methods.
 * A junior engineer often pushes lead business rules into the table component instead of keeping them server-side here and in services.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { createLeadSchema, leadListQuerySchema } from "@/lib/validation/leadSchemas";
import { leadService } from "@/services/leadService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.LEADS_READ);
    const input = leadListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return leadService.listLeads(ctx, input);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.LEADS_WRITE);
    const input = createLeadSchema.parse(await request.json());
    return created(await leadService.createLead(ctx, input));
  });
}
