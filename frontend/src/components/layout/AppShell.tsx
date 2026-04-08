import { NavLink, Outlet } from "react-router-dom";

import { useDashboardSummary } from "./DashboardSummaryProvider";
import { useTheme } from "./ThemeProvider";

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    "rounded-xl px-3 py-2 text-sm transition",
    isActive ? "bg-accent/12 text-accent" : "text-textSecondary hover:bg-panelAlt hover:text-textPrimary"
  ].join(" ");
}

function SummaryBadge({
  label,
  value,
  accentClass
}: {
  label: string;
  value: number | string;
  accentClass: string;
}) {
  return (
    <div className={`rounded-2xl border border-line/80 px-3 py-2 ${accentClass}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-textSecondary">{label}</div>
      <div className="mt-1 text-lg font-semibold text-textPrimary">{value}</div>
    </div>
  );
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const { summary } = useDashboardSummary();

  return (
    <div className="min-h-screen bg-grid bg-[size:18px_18px]">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="shrink-0">
              <div className="text-xs uppercase tracking-[0.28em] text-accent/80">Geargrade</div>
              <div className="text-lg font-semibold text-textPrimary">摄影器材档案库</div>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-2">
              <SummaryBadge
                label="当前持有"
                value={summary?.currently_owned_count ?? "--"}
                accentClass="bg-accent/6"
              />
              <SummaryBadge
                label="已售设备"
                value={summary?.sold_count ?? "--"}
                accentClass="bg-success/6"
              />
              <SummaryBadge
                label="正在感受"
                value={summary?.feeling_in_progress_count ?? "--"}
                accentClass="bg-warning/8"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex items-center gap-2 rounded-2xl border border-line bg-panelAlt/70 p-1">
              <NavLink to="/" end className={navClassName}>
                首页
              </NavLink>
              <NavLink to="/leaderboards" className={navClassName}>
                排行榜
              </NavLink>
              <NavLink to="/data-tools" className={navClassName}>
                数据工具
              </NavLink>
              <NavLink to="/devices/new" className={navClassName}>
                新增设备
              </NavLink>
            </nav>
            <button type="button" className="button-secondary" onClick={toggleTheme}>
              {theme === "dark" ? "亮色模式" : "暗色模式"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
