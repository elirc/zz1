/**
 * Moves a deal through pipeline stages.
 * Called by drag-and-drop or detail-page stage actions.
 * Calls auth, tenant guard, stage validation, and dealService.moveDealStage().
 * A junior engineer often trusts the client’s drag result and skips server-side pipeline membership checks.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { moveDealStageSchema } from "@/lib/validation/dealSchemas";
import { dealService } from "@/services/dealService";

export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.DEALS_STAGE_MOVE);
    const input = moveDealStageSchema.parse(await request.json());
    const { id } = await params;
    return dealService.moveDealStage(ctx, id, input);
  });
}
