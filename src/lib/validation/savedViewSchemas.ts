/**
 * Defines validation for saved table-view persistence.
 * Called by saved-view route handlers before the service layer stores filter payloads.
 * Calls Prisma enums and Zod JSON-like records.
 * A junior engineer often stores UI-only view state without validating the resource type it belongs to.
 */
import { SavedViewResource, SavedViewVisibility } from "@prisma/client";
import { z } from "zod";

export const createSavedViewSchema = z.object({
  // ⚠️ SENIOR NOTE: Saved views are persisted org data, not just UI state, so resource typing matters for future migrations and exports.
  resource: z.nativeEnum(SavedViewResource),
  visibility: z.nativeEnum(SavedViewVisibility).default(SavedViewVisibility.PERSONAL),
  name: z.string().min(2).max(120),
  filters: z.record(z.any()),
  sort: z.record(z.any()).optional(),
  columns: z.array(z.string()).optional(),
  isDefault: z.boolean().default(false)
});
