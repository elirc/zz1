/**
 * Creates a demo session cookie for a seeded user.
 * Called by the frontend login form and manual API clients during local development.
 * Calls auth validation, authService.demoLogin(), and shared response helpers.
 * A junior engineer often puts session-cookie creation directly in the React page, which breaks reviewability and reuse.
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { demoLoginSchema } from "@/lib/validation/authSchemas";
import { authService } from "@/services/authService";

export function POST(request: NextRequest) {
  return route(async () => {
    const input = demoLoginSchema.parse(await request.json());
    return authService.demoLogin(input);
  });
}
