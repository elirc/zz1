/**
 * Houses shared validation primitives reused across resource schemas.
 * Called by request schemas in src/lib/validation and by route handlers indirectly through Zod parsing.
 * Calls Zod only, keeping cross-module input rules centralized.
 * A junior engineer often duplicates the same pagination and ID schema dozens of times and drifts behavior subtly.
 */
import { z } from "zod";

export const cuidSchema = z.string().cuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const timestampSchema = z.string().datetime().transform((value) => new Date(value));

export const tagsSchema = z.array(z.string().min(1).max(32)).max(20).default([]);
