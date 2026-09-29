"use client";

/**
 * Renders the demo login form used to create a session cookie.
 * Called by the workspace shell when `/api/org/me` returns unauthenticated.
 * Calls the demo auth route and refreshes workspace queries on success.
 * A junior engineer often mixes auth fetches into layout effects instead of giving the user a clear action boundary.
 */
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/http/client";
import { SectionCard } from "@/components/layout/section-card";

const demoEmails = [
  "platform@atlascrm.dev",
  "admin@northwindcrm.dev",
  "manager@northwindcrm.dev",
  "rep@northwindcrm.dev"
];

export function DemoLoginCard() {
  const [email, setEmail] = useState(demoEmails[1]);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: { email: string }) =>
      apiFetch("/api/auth/demo-login", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries();
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Login failed.");
    }
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate({ email });
  }

  return (
    <SectionCard
      title="Demo access"
      subtitle="Seed the database, then sign in with one of the seeded emails below to load a tenant-scoped workspace."
      className="mx-auto w-full max-w-xl"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="email">
            Demo email
          </label>
          <input
            id="email"
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500"
            onChange={(event) => setEmail(event.target.value)}
            value={email}
          />
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {demoEmails.map((candidate) => (
            <button
              key={candidate}
              className="rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-400"
              onClick={() => setEmail(candidate)}
              type="button"
            >
              {candidate}
            </button>
          ))}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          className="rounded-full bg-crm-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-900"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? "Signing in..." : "Create session"}
        </button>
      </form>
    </SectionCard>
  );
}
