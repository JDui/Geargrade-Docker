import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { PageTransition, isDrawerRoute, pageKey } from "./PageTransition";
import { useDashboardSummary } from "./DashboardSummaryProvider";
import { useTheme } from "./ThemeProvider";

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    "shrink-0 rounded-xl px-3 py-2 text-sm transition motion-lift",
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
    <div className={`rounded-xl border border-line/80 px-2.5 py-2 sm:rounded-2xl sm:px-3 ${accentClass}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-textSecondary">{label}</div>
      <div className="mt-1 text-base font-semibold text-textPrimary sm:text-lg">{value}</div>
    </div>
  );
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const { summary } = useDashboardSummary();
  const location = useLocation();
  const previousPageKey = useRef(pageKey(location.pathname));

  useEffect(() => {
    const nextPageKey = pageKey(location.pathname);
    const wasDrawer = isDrawerRoute(location.pathname);

    if (nextPageKey !== previousPageKey.current && !wasDrawer) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }

    previousPageKey.current = nextPageKey;
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-grid bg-[size:18px_18px]">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur motion-fade-in">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="shrink-0 motion-enter motion-delay-0">
              <div className="text-xs uppercase tracking-[0.28em] text-accent/80">Geargrade</div>
              <div className="text-lg font-semibold text-textPrimary">摄影器材档案库</div>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-2 motion-enter motion-delay-1">
              <SummaryBadge label="当前持有" value={summary?.currently_owned_count ?? "--"} accentClass="bg-accent/6" />
              <SummaryBadge label="已售设备" value={summary?.sold_count ?? "--"} accentClass="bg-success/6" />
              <SummaryBadge label="正在感受" value={summary?.feeling_in_progress_count ?? "--"} accentClass="bg-warning/8" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 motion-enter motion-delay-2">
            <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-panelAlt/70 p-1 sm:gap-2">
              <NavLink to="/" end className={navClassName}>
                概览
              </NavLink>
              <NavLink to="/archive" className={navClassName}>
                档案库
              </NavLink>
              <NavLink to="/leaderboards" className={navClassName}>
                排行榜
              </NavLink>
              <NavLink to="/wishlist" className={navClassName}>
                心愿池
              </NavLink>
              <NavLink to="/devices/new" className={navClassName}>
                新增设备
              </NavLink>
            </nav>
            <button type="button" className="button-secondary motion-lift" onClick={toggleTheme}>
              {theme === "dark" ? "亮色模式" : "暗色模式"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <PageTransition />
      </main>
    </div>
  );
}
