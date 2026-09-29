/**
 * Processes queued async jobs in-process for local development and demos.
 * Called by ops tooling or manual admin actions.
 * Calls the platform admin guard and jobService.processDueJobs().
 * A junior engineer often leaves internal operational routes unauthenticated because "only the team knows the URL".
 */
import { NextRequest } from "next/server";
import { route } from "@/lib/http/responses";
import { requirePlatformAdminRequest } from "@/lib/middleware/withAuth";
import { jobService } from "@/services/jobService";

export function POST(request: NextRequest) {
  return route(async () => {
    await requirePlatformAdminRequest(request);
    return jobService.processDueJobs();
  });
}
