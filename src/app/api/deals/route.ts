/**
 * Lists and creates deals for the active tenant.
 * Called by pipeline screens and lead conversion follow-up workflows.
 * Calls auth, tenant guard, Zod validation, and dealService methods.
 * A junior engineer often builds deal creation around UI stage columns and forgets the server owns stage validity.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { createDealSchema, dealListQuerySchema } from "@/lib/validation/dealSchemas";
import { dealService } from "@/services/dealService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.DEALS_READ);
    const input = dealListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return dealService.listDeals(ctx, input);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.DEALS_WRITE);
    const input = createDealSchema.parse(await request.json());
    return created(await dealService.createDeal(ctx, input));
  });
}
