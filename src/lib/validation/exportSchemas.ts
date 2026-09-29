/**
 * Defines validation for export and import workflow endpoints.
 * Called by export/import route handlers before jobs are enqueued.
 * Calls Prisma enums and light CSV input validation.
 * A junior engineer often validates the job metadata but not the uploaded content boundary.
 */
import { ImportResource, SavedViewResource } from "@prisma/client";
import { z } from "zod";
import { cuidSchema } from "@/lib/validation/commonSchemas";

export const requestExportSchema = z.object({
  resource: z.nativeEnum(SavedViewResource),
  savedViewId: cuidSchema.optional(),
  filtersSnapshot: z.record(z.any()).optional()
});

export const createContactImportSchema = z.object({
  resource: z.literal(ImportResource.CONTACT),
  fileName: z.string().min(3).max(180),
  // ⚠️ SENIOR NOTE: Import payload size and parsing behavior become ops concerns quickly, so keep the boundary explicit even in a demo app.
  csvText: z.string().min(1)
});
