"use client";

type EntityTableProps = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null | undefined>>;
};

export function EntityTable({ title, columns, rows }: EntityTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/80">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`} className="border-t border-slate-100 text-slate-700">
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${index}-${cellIndex}`} className="px-5 py-4">
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-slate-500" colSpan={columns.length}>
                  No rows yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
