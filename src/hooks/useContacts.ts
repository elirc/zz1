"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/client";
import { ContactRow, PaginatedRows } from "@/types/api";

export function useContacts(enabled = true) {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiFetch<PaginatedRows<ContactRow>>("/api/contacts?page=1&pageSize=6"),
    enabled
  });
}
