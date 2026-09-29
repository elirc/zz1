/**
 * Defines validation boundaries for platform org admin and tenant admin endpoints.
 * Called by organization and invitation route handlers before service logic runs.
 * Calls shared schema primitives from commonSchemas.ts to keep input validation centralized.
 * A junior engineer often validates happy-path fields only and forgets role/status transitions are API inputs too.
 */
import { MembershipRole, MembershipStatus, OrganizationPlan, OrganizationStatus } from "@prisma/client";
import { z } from "zod";
import { cuidSchema } from "@/lib/validation/commonSchemas";

export const createOrganizationSchema = z.object({
  name: z.string().min(3).max(120),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  plan: z.nativeEnum(OrganizationPlan).default(OrganizationPlan.FREE),
  status: z.nativeEnum(OrganizationStatus).default(OrganizationStatus.TRIALING),
  website: z.string().url().optional(),
  owner: z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(60),
    lastName: z.string().min(1).max(60),
    title: z.string().min(2).max(100).optional()
  })
});

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole)
});

export const updateMembershipSchema = z
  .object({
    membershipId: cuidSchema,
    role: z.nativeEnum(MembershipRole).optional(),
    status: z.nativeEnum(MembershipStatus).optional()
  })
  .refine((value) => value.role || value.status, {
    message: "At least one membership field must be updated."
  });

export const updateMembershipBodySchema = z
  .object({
    role: z.nativeEnum(MembershipRole).optional(),
    status: z.nativeEnum(MembershipStatus).optional()
  })
  // ⚠️ SENIOR NOTE: Partial update endpoints still need a semantic rule or callers can send empty payloads that look successful.
  .refine((value) => value.role || value.status, {
    message: "At least one membership field must be updated."
  });
