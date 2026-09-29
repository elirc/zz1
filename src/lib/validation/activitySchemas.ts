/**
 * Defines validation for activity and follow-up creation endpoints.
 * Called by activity route handlers before service logic runs.
 * Calls shared schemas and Prisma enums to keep task/note inputs explicit.
 * A junior engineer often forgets activities need a parent entity anchor for useful auditability.
 */
import { ActivityType } from "@prisma/client";
import { z } from "zod";
import { cuidSchema, paginationSchema, timestampSchema } from "@/lib/validation/commonSchemas";

export const createActivitySchema = z
  .object({
    type: z.nativeEnum(ActivityType),
    subject: z.string().min(2).max(120),
    summary: z.string().max(1000).optional(),
    outcome: z.string().max(240).optional(),
    nextAction: z.string().max(240).optional(),
    dueAt: timestampSchema.optional(),
    ownerMembershipId: cuidSchema.optional(),
    leadId: cuidSchema.optional(),
    contactId: cuidSchema.optional(),
    dealId: cuidSchema.optional(),
    companyId: cuidSchema.optional()
  })
  // ⚠️ SENIOR NOTE: Unattached activity rows become operational garbage because no entity timeline can reliably own them later.
  .refine((value) => value.leadId || value.contactId || value.dealId || value.companyId, {
    message: "An activity must be attached to at least one CRM entity."
  });

export const activityListQuerySchema = paginationSchema.extend({
  ownerMembershipId: cuidSchema.optional(),
  overdueOnly: z.coerce.boolean().optional()
});
