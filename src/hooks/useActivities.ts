"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/client";
import { ActivityRow, PaginatedRows } from "@/types/api";

export function useActivities(enabled = true) {
  return useQuery({
    queryKey: ["activities"],
    queryFn: () => apiFetch<PaginatedRows<ActivityRow>>("/api/activities?page=1&pageSize=6"),
    enabled
  });
}
