import Link from "next/link";

const docs = [
  "docs/architecture/README.md",
  "docs/architecture/domain-model.md",
  "docs/architecture/auth-and-tenant-isolation.md",
  "docs/architecture/request-lifecycle.md",
  "docs/learning/build-journal.md",
  "docs/learning/guided-reading-path.md",
  "docs/learning/load-bearing-files.md",
  "docs/learning/flow-traces.md",
  "docs/learning/concepts-demonstrated.md",
  "docs/learning/testing-rationale.md"
];

export default function ArchitectureDocsIndexPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm uppercase tracking-[0.25em] text-amber-700">Docs index</p>
        <h1 className="text-4xl font-semibold tracking-tight text-crm-ink">Code-anchored architecture notes</h1>
        <p className="text-base leading-8 text-slate-700">
          The source-of-truth docs live as Markdown files in the repo. Open them directly from your editor while reading
          the linked source files.
        </p>
      </div>

      <div className="mt-10 grid gap-3">
        {docs.map((docPath) => (
          <div key={docPath} className="crm-panel rounded-2xl px-5 py-4">
            <code className="text-sm text-slate-700">{docPath}</code>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link className="rounded-full bg-crm-ink px-5 py-3 text-sm font-medium text-white" href="/workspace">
          Back to workspace
        </Link>
      </div>
    </main>
  );
}
