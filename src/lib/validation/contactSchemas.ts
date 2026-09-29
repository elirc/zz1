/**
 * Defines validation rules for contact CRUD endpoints.
 * Called by contact route handlers and lead conversion workflows.
 * Calls shared schema primitives and Prisma enums.
 * A junior engineer often assumes converted contacts never need the same validation as manually created contacts.
 */
import { ContactStatus } from "@prisma/client";
import { z } from "zod";
import { cuidSchema, paginationSchema, tagsSchema } from "@/lib/validation/commonSchemas";

export const createContactSchema = z.object({
  // ⚠️ SENIOR NOTE: Converted contacts and manually created contacts share the same schema boundary so downstream logic stays consistent.
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(40).optional(),
  title: z.string().max(100).optional(),
  status: z.nativeEnum(ContactStatus).default(ContactStatus.ACTIVE),
  ownerMembershipId: cuidSchema.optional(),
  companyId: cuidSchema.optional(),
  sourceLeadId: cuidSchema.optional(),
  tags: tagsSchema
});

export const contactListQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ContactStatus).optional(),
  ownerMembershipId: cuidSchema.optional(),
  search: z.string().min(1).max(100).optional()
});
