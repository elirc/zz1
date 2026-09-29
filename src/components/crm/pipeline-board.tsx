"use client";

type PipelineBoardProps = {
  deals: Array<{
    id: string;
    title: string;
    value: string | number;
    stage?: { id: string; name: string } | null;
    owner?: { user?: { firstName: string; lastName: string } | null } | null;
  }>;
};

export function PipelineBoard({ deals }: PipelineBoardProps) {
  const grouped = deals.reduce<Record<string, typeof deals>>((accumulator, deal) => {
    const key = deal.stage?.name ?? "Unstaged";
    accumulator[key] = [...(accumulator[key] ?? []), deal];
    return accumulator;
  }, {});

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Object.entries(grouped).map(([stageName, stageDeals]) => (
        <article key={stageName} className="rounded-3xl border border-slate-200 bg-white/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-crm-ink">{stageName}</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{stageDeals.length}</span>
          </div>
          <div className="space-y-3">
            {stageDeals.map((deal) => (
              <div key={deal.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="font-medium text-slate-800">{deal.title}</p>
                <p className="mt-1 text-sm text-slate-500">${deal.value}</p>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
