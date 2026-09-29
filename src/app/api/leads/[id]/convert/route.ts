/**
 * Converts a lead into a contact and optionally a deal.
 * Called by lead detail conversion actions.
 * Calls auth, tenant guard, conversion validation, and leadService.convertLead().
 * A junior engineer often treats conversion as a UI convenience and forgets it is a multi-entity backend workflow.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { convertLeadSchema } from "@/lib/validation/leadSchemas";
import { leadService } from "@/services/leadService";

export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.LEADS_CONVERT);
    const input = convertLeadSchema.parse(await request.json());
    const { id } = await params;
    return leadService.convertLead(ctx, id, input);
  });
}
