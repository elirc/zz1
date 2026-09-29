/**
 * Defines validation for lightweight demo authentication routes.
 * Called by auth route handlers before session cookies are created.
 * Calls Zod only so auth input parsing stays boring and reviewable.
 * A junior engineer often treats login payloads as trusted because "it's just for local demo use".
 */
import { z } from "zod";

export const demoLoginSchema = z.object({
  // ⚠️ SENIOR NOTE: Even demo auth needs a validation boundary or you'll accidentally build downstream code that assumes trusted JSON.
  email: z.string().email(),
  organizationId: z.string().cuid().optional()
});
