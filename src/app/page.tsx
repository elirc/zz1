import Link from "next/link";

const highlights = [
  "Tenant-aware authorization is explicit in services and route guards.",
  "Leads, contacts, deals, activities, exports, and reporting share one reviewable backend shape.",
  "Docs point at real files so you can study how production-grade backend flows are stitched together."
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-16">
      <section className="max-w-3xl space-y-6">
        <div className="inline-flex rounded-full border border-amber-400/40 bg-white/70 px-4 py-2 text-sm font-medium text-amber-700">
          Atlas CRM • Multi-tenant SaaS training project
        </div>
        <div className="space-y-4">
          <h1 className="text-5xl font-semibold tracking-tight text-crm-ink sm:text-6xl">
            Backend-first CRM architecture with explicit tenant isolation.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-700">
            This codebase is organized like a team-owned internal SaaS product, with route handlers,
            validation, services, repositories, audit logs, and learning docs evolving together.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <article key={item} className="crm-panel rounded-3xl p-6">
            <p className="text-sm leading-7 text-slate-700">{item}</p>
          </article>
        ))}
      </section>

      <section className="flex flex-wrap gap-4">
        <Link
          className="rounded-full bg-crm-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-900"
          href="/workspace"
        >
          Open CRM workspace
        </Link>
        <Link
          className="rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
          href="/docs/architecture"
        >
          Read architecture docs
        </Link>
      </section>
    </main>
  );
}
