import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: ReactNode;
  accent?: "accent" | "success" | "warning";
  children?: ReactNode;
}

export function StatCard({ title, value, accent = "accent", children }: StatCardProps) {
  const accentClass = {
    accent: "from-accent/20 to-accent/5",
    success: "from-success/25 to-success/5",
    warning: "from-warning/25 to-warning/5"
  }[accent];

  return (
    <section className={`panel overflow-hidden bg-gradient-to-br ${accentClass} p-5`}>
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="mt-4 text-4xl font-semibold text-white">{value}</div>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
