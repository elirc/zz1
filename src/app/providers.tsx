"use client";

/**
 * Provides client-side state containers for the app shell.
 * Called by src/app/layout.tsx and consumed by hooks in src/hooks.
 * Calls @tanstack/react-query so data-fetching logic stays outside React pages.
 * A junior engineer often forgets to centralize query client creation and ends up resetting cache on every render.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useState } from "react";

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1
          }
        }
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
