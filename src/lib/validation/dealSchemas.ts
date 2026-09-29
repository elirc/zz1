/**
 * Defines validation for deal creation, list filters, and stage movement.
 * Called by deal route handlers and lead conversion workflows.
 * Calls shared schema primitives and Prisma enums.
 * A junior engineer often validates stage ids but forgets to validate the business intent of moving to that stage.
 */
import { DealStatus } from "@prisma/client";
import { z } from "zod";
import { cuidSchema, paginationSchema, timestampSchema } from "@/lib/validation/commonSchemas";

export const createDealSchema = z.object({
  title: z.string().min(2).max(120),
  value: z.coerce.number().positive(),
  currency: z.string().length(3).default("USD"),
  ownerMembershipId: cuidSchema.optional(),
  pipelineId: cuidSchema.optional(),
  stageId: cuidSchema.optional(),
  companyId: cuidSchema.optional(),
  primaryContactId: cuidSchema.optional(),
  sourceLeadId: cuidSchema.optional(),
  expectedCloseDate: timestampSchema.optional(),
  nextStep: z.string().max(240).optional()
});

export const dealListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(DealStatus).optional(),
  ownerMembershipId: cuidSchema.optional(),
  stageId: cuidSchema.optional(),
  search: z.string().min(1).max(100).optional()
});

export const moveDealStageSchema = z.object({
  // ⚠️ SENIOR NOTE: A valid `stageId` string is not a valid transition; service code still has to prove pipeline compatibility.
  stageId: cuidSchema,
  note: z.string().max(240).optional()
});
