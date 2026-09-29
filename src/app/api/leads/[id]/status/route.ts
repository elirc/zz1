/**
 * Applies a lead status transition through the service-layer state machine.
 * Called by lead detail and queue-management actions.
 * Calls auth, tenant guard, status schema validation, and leadService.transitionStatus().
 * A junior engineer often updates statuses directly in the database and bypasses history writes and transition validation.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { leadStatusTransitionSchema } from "@/lib/validation/leadSchemas";
import { leadService } from "@/services/leadService";

export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.LEADS_WRITE);
    const input = leadStatusTransitionSchema.parse(await request.json());
    const { id } = await params;
    return leadService.transitionStatus(ctx, id, input);
  });
}
