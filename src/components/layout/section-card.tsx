import { PropsWithChildren } from "react";
import clsx from "clsx";

type SectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  className?: string;
}>;

export function SectionCard({ title, subtitle, className, children }: SectionCardProps) {
  return (
    <section className={clsx("crm-panel rounded-3xl p-6", className)}>
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-crm-ink">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
