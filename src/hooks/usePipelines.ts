"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/client";
import { PipelineResponse } from "@/types/api";

export function usePipelines(enabled = true) {
  return useQuery({
    queryKey: ["pipelines"],
    queryFn: () => apiFetch<PipelineResponse>("/api/pipelines"),
    enabled
  });
}
