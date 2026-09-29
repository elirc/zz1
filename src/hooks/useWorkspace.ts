"use client";

/**
 * Loads the active org workspace bootstrap payload for the UI shell.
 * Called by src/components/layout/workspace-shell.tsx.
 * Calls apiFetch() and React Query so workspace state stays centralized and cacheable.
 * A junior engineer often lets every panel fetch its own auth/bootstrap data and creates redundant loading states.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/client";
import { WorkspaceResponse } from "@/types/api";

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: () => apiFetch<WorkspaceResponse>("/api/org/me")
  });
}
