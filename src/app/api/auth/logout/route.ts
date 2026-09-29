/**
 * Clears the current session cookie.
 * Called by the frontend app shell sign-out action.
 * Calls auth/session.ts and shared response helpers only.
 * A junior engineer often deletes auth state in the client but leaves the server cookie active.
 */
import { route } from "@/lib/http/responses";
import { clearSessionCookie } from "@/lib/auth/session";

export function POST() {
  return route(async () => {
    await clearSessionCookie();
    return { success: true };
  });
}
