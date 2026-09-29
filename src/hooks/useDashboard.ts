"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/client";
import { DashboardResponse } from "@/types/api";

export function useDashboard(enabled = true) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/api/reports/dashboard"),
    enabled
  });
}
