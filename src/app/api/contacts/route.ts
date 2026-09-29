/**
 * Lists and creates contacts for the active tenant.
 * Called by contact management screens and lead conversion follow-up flows.
 * Calls auth, tenant guard, contact validation, and contactService methods.
 * A junior engineer often forgets contacts are still tenant-owned data even if they feel more "global" than leads.
 */
import { NextRequest } from "next/server";
import { created, route } from "@/lib/http/responses";
import { requireAuthenticatedRequest } from "@/lib/middleware/withAuth";
import { requireOrgRequest } from "@/lib/middleware/withTenantGuard";
import { ORG_PERMISSIONS } from "@/lib/permissions/policy";
import { contactListQuerySchema, createContactSchema } from "@/lib/validation/contactSchemas";
import { contactService } from "@/services/contactService";

export function GET(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.CONTACTS_READ);
    const input = contactListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return contactService.listContacts(ctx, input);
  });
}

export function POST(request: NextRequest) {
  return route(async () => {
    const baseCtx = await requireAuthenticatedRequest(request);
    const ctx = requireOrgRequest(baseCtx, ORG_PERMISSIONS.CONTACTS_WRITE);
    const input = createContactSchema.parse(await request.json());
    return created(await contactService.createContact(ctx, input));
  });
}
