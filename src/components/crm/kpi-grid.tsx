"use client";

type KpiGridProps = {
  counts?: {
    leads: number;
    contacts: number;
    deals: number;
    exports: number;
  };
  overdueFollowUps?: number;
};

export function KpiGrid({ counts, overdueFollowUps }: KpiGridProps) {
  const metrics = [
    { label: "Leads", value: counts?.leads ?? "--" },
    { label: "Contacts", value: counts?.contacts ?? "--" },
    { label: "Deals", value: counts?.deals ?? "--" },
    { label: "Exports", value: counts?.exports ?? "--" },
    { label: "Overdue follow-ups", value: overdueFollowUps ?? "--" }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <article key={metric.label} className="crm-panel rounded-3xl p-5">
          <p className="text-sm text-slate-500">{metric.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-crm-ink">{metric.value}</p>
        </article>
      ))}
    </div>
  );
}
