"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/client";
import { DealRow, PaginatedRows } from "@/types/api";

export function useDeals(enabled = true) {
  return useQuery({
    queryKey: ["deals"],
    queryFn: () => apiFetch<PaginatedRows<DealRow>>("/api/deals?page=1&pageSize=12"),
    enabled
  });
}
