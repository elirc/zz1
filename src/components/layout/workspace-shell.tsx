"use client";

/**
 * Renders the main CRM workspace backed by React Query data hooks.
 * Called by src/app/workspace/page.tsx.
 * Calls workspace, dashboard, leads, contacts, deals, and activities hooks plus UI panels.
 * A junior engineer often lets one giant page own both data fetching and business mutations without intermediate seams.
 */
import Link from "next/link";
import { DemoLoginCard } from "@/components/crm/demo-login-card";
import { EntityTable } from "@/components/crm/entity-table";
import { KpiGrid } from "@/components/crm/kpi-grid";
import { LeadIntakeForm } from "@/components/crm/lead-intake-form";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { SectionCard } from "@/components/layout/section-card";
import { useActivities } from "@/hooks/useActivities";
import { useContacts } from "@/hooks/useContacts";
import { useDashboard } from "@/hooks/useDashboard";
import { useDeals } from "@/hooks/useDeals";
import { useLeads } from "@/hooks/useLeads";
import { useWorkspace } from "@/hooks/useWorkspace";

export function WorkspaceShell() {
  const workspace = useWorkspace();
  const isReady = workspace.isSuccess;
  const dashboard = useDashboard(isReady);
  const leads = useLeads(isReady);
  const contacts = useContacts(isReady);
  const deals = useDeals(isReady);
  const activities = useActivities(isReady);

  if (workspace.error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <DemoLoginCard />
      </main>
    );
  }

  if (workspace.isLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-16">
        <p className="text-sm text-slate-500">Loading workspace...</p>
      </main>
    );
  }

  const currentMembership = workspace.data?.currentMembership;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10">
      <section className="crm-panel rounded-[2rem] p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.25em] text-amber-700">Atlas CRM workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight text-crm-ink">
              {workspace.data?.organization?.name}
            </h1>
            <p className="text-sm text-slate-600">
              Signed in as {workspace.data?.currentMembership?.role} in org {workspace.data?.organization?.slug}
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700" href="/">
              Home
            </Link>
            <Link
              className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700"
              href="/docs/architecture"
            >
              Study the architecture
            </Link>
          </div>
        </div>
      </section>

      <KpiGrid
        counts={dashboard.data?.organizationCounts}
        overdueFollowUps={dashboard.data?.overdueFollowUps}
      />

      <SectionCard
        title="Lead intake"
        subtitle="This form exercises the tenant-scoped lead creation request path using the default pipeline."
      >
        <LeadIntakeForm />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          title="Lead queue"
          subtitle="Notice how operational tables remain thin in the UI because filtering and authorization already live server-side."
        >
          <EntityTable
            columns={["Lead", "Status", "Owner", "Stage"]}
            rows={
              leads.data?.rows?.map((lead: any) => [
                lead.name,
                lead.status,
                lead.owner?.user ? `${lead.owner.user.firstName} ${lead.owner.user.lastName}` : "Unassigned",
                lead.stage?.name
              ]) ?? []
            }
            title="Leads"
          />
        </SectionCard>

        <SectionCard title="Recent activities" subtitle="Task and note history powers overdue follow-up reporting.">
          <EntityTable
            columns={["Subject", "Type", "Owner", "Due"]}
            rows={
              activities.data?.rows?.map((activity: any) => [
                activity.subject,
                activity.type,
                activity.owner?.user
                  ? `${activity.owner.user.firstName} ${activity.owner.user.lastName}`
                  : "Unassigned",
                activity.dueAt ? new Date(activity.dueAt).toLocaleDateString() : "—"
              ]) ?? []
            }
            title="Activities"
          />
        </SectionCard>
      </div>

      <SectionCard title="Pipeline board" subtitle="Open deals grouped by current stage.">
        <PipelineBoard deals={deals.data?.rows ?? []} />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Contacts" subtitle="Converted and manually created contacts stay in the same tenant-scoped table.">
          <EntityTable
            columns={["Name", "Status", "Owner"]}
            rows={
              contacts.data?.rows?.map((contact: any) => [
                `${contact.firstName} ${contact.lastName}`,
                contact.status,
                contact.owner?.user
                  ? `${contact.owner.user.firstName} ${contact.owner.user.lastName}`
                  : "Unassigned"
              ]) ?? []
            }
            title="Contacts"
          />
        </SectionCard>

        <SectionCard title="Tenant admin" subtitle="Org-scoped roles are visible as first-class data, not hidden in client logic.">
          <EntityTable
            columns={["Member", "Role", "Status"]}
            rows={
              workspace.data?.users?.map((entry: any) => [
                `${entry.user.firstName} ${entry.user.lastName}`,
                entry.role,
                entry.status
              ]) ?? []
            }
            title="Memberships"
          />
        </SectionCard>
      </div>

      <SectionCard title="Learning anchor" subtitle="Read the docs after you exercise the UI so the flow traces feel concrete.">
        <p className="text-sm leading-7 text-slate-600">
          Start with <code>src/app/api/leads/route.ts</code>, then follow the lead creation path into
          <code> src/lib/middleware/withAuth.ts</code>, <code>src/lib/middleware/withTenantGuard.ts</code>,
          <code>src/lib/validation/leadSchemas.ts</code>, <code>src/services/leadService.ts</code>, and
          <code>src/repositories/leadRepository.ts</code>.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Current role: <span className="font-medium text-crm-ink">{currentMembership?.role}</span>
        </p>
      </SectionCard>
    </main>
  );
}
