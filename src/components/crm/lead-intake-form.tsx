"use client";

/**
 * Captures a small lead-creation workflow from the workspace screen.
 * Called by the workspace shell as the fastest way to exercise the lead create request path.
 * Calls useCreateLead() and usePipelines() so form choices stay backed by tenant config.
 * A junior engineer often hardcodes stage ids in the UI and quietly breaks when pipeline config changes.
 */
import { FormEvent, useState } from "react";
import { useCreateLead } from "@/hooks/useLeads";
import { usePipelines } from "@/hooks/usePipelines";

export function LeadIntakeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createLead = useCreateLead();
  const pipelines = usePipelines();

  const defaultStageId = pipelines.data?.[0]?.stages?.[0]?.id;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    createLead.mutate(
      {
        name,
        email: email || undefined,
        companyName: companyName || undefined,
        stageId: defaultStageId,
        source: "WEBSITE",
        priority: "MEDIUM",
        tags: []
      },
      {
        onSuccess: () => {
          setName("");
          setEmail("");
          setCompanyName("");
          setError(null);
        },
        onError: (mutationError) => {
          setError(mutationError instanceof Error ? mutationError.message : "Could not create lead.");
        }
      }
    );
  }

  return (
    <form className="grid gap-3 lg:grid-cols-4" onSubmit={onSubmit}>
      <input
        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
        onChange={(event) => setName(event.target.value)}
        placeholder="Lead name"
        value={name}
      />
      <input
        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        type="email"
        value={email}
      />
      <input
        className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
        onChange={(event) => setCompanyName(event.target.value)}
        placeholder="Company"
        value={companyName}
      />
      <button
        className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-600"
        disabled={createLead.isPending || !defaultStageId}
        type="submit"
      >
        {createLead.isPending ? "Creating..." : "Create lead"}
      </button>
      {error ? <p className="text-sm text-red-600 lg:col-span-4">{error}</p> : null}
    </form>
  );
}
