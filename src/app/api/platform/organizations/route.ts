/**
 * Handles platform-admin organization listing and creation.
 * Called by admin UI and seeded bootstrap workflows.
 * Calls withAuth.ts, orgSchemas.ts, and organizationService.ts in that order.
 * A junior engineer often skips the platform-only guard because "the page is hidden anyway".
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requirePlatformAdminRequest } from "@/lib/middleware/withAuth";
import { createOrganizationSchema } from "@/lib/validation/orgSchemas";
import { organizationService } from "@/services/organizationService";

export function GET(request: NextRequest) {
  return route(async () => {
    await requirePlatformAdminRequest(request);
    return organizationService.listOrganizations();
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const ctx = await requirePlatformAdminRequest(request);
    const input = createOrganizationSchema.parse(await request.json());
    return created(await organizationService.createOrganization(ctx, input));
  });
}
