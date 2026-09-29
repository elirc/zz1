/**
 * Defines lead API validation rules and list-query parsing.
 * Called by lead route handlers before service methods run.
 * Calls shared schema primitives so lead inputs stay consistent across routes.
 * A junior engineer often validates creation but forgets state transitions and conversion payloads are separate boundaries.
 */
import { LeadPriority, LeadSource, LeadStatus } from "@prisma/client";
import { z } from "zod";
import { cuidSchema, paginationSchema, tagsSchema, timestampSchema } from "@/lib/validation/commonSchemas";

export const createLeadSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(40).optional(),
  companyName: z.string().min(2).max(120).optional(),
  companyId: cuidSchema.optional(),
  ownerMembershipId: cuidSchema.optional(),
  pipelineId: cuidSchema.optional(),
  stageId: cuidSchema.optional(),
  source: z.nativeEnum(LeadSource).default(LeadSource.OTHER),
  priority: z.nativeEnum(LeadPriority).default(LeadPriority.MEDIUM),
  qualificationNotes: z.string().max(500).optional(),
  nextFollowUpAt: timestampSchema.optional(),
  tags: tagsSchema
});

export const leadListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  ownerMembershipId: cuidSchema.optional(),
  stageId: cuidSchema.optional(),
  search: z.string().min(1).max(100).optional()
});

export const leadStatusTransitionSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  reason: z.string().max(240).optional()
});

export const convertLeadSchema = z
  .object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    title: z.string().max(100).optional(),
    createDeal: z.boolean().default(false),
    dealTitle: z.string().min(2).max(120).optional(),
    dealValue: z.coerce.number().positive().optional(),
    stageId: cuidSchema.optional()
  })
  // ⚠️ SENIOR NOTE: Conversion is a workflow boundary, so the schema has to defend the optional-deal branch before service code runs.
  .refine((value) => !value.createDeal || (value.dealTitle && value.dealValue), {
    message: "Creating a deal from a lead conversion requires dealTitle and dealValue."
  });
