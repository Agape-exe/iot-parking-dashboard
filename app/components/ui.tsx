export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Panel administrativo</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-md border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "green" | "red" | "blue" | "amber" | "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}
