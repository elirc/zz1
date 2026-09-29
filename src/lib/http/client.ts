/**
 * Defines the browser-side API fetch helper used by React Query hooks.
 * Called by files in src/hooks and client components that mutate server state.
 * Calls fetch and normalizes the server's `{ data }` / `{ error }` response contract.
 * A junior engineer often duplicates fetch and error parsing in every hook until clients drift from server responses.
 */
export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Request failed.");
  }

  return payload?.data as T;
}
