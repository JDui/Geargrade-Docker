import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { PageTransition, isDrawerRoute, pageKey } from "./PageTransition";
import { useAppSettings } from "./AppSettingsProvider";
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
    <div className={`rounded-xl border border-line/80 px-2 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2 ${accentClass}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-textSecondary sm:text-[11px]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-textPrimary sm:mt-1 sm:text-lg">{value}</div>
    </div>
  );
}

export function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const { contentWidth, reduceMotion, showBackgroundGrid } = useAppSettings();
  const { summary } = useDashboardSummary();
  const location = useLocation();
  const previousPageKey = useRef(pageKey(location.pathname));
  const widthClass = {
    compact: "max-w-5xl",
    default: "max-w-7xl",
    wide: "max-w-screen-2xl"
  }[contentWidth];

  useEffect(() => {
    const nextPageKey = pageKey(location.pathname);
    const wasDrawer = isDrawerRoute(location.pathname);

    if (nextPageKey !== previousPageKey.current && !wasDrawer) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }

    previousPageKey.current = nextPageKey;
  }, [location.pathname, reduceMotion]);

  return (
    <div className={showBackgroundGrid ? "min-h-screen bg-grid bg-[size:18px_18px]" : "min-h-screen"}>
      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/92 backdrop-blur">
        <div className={`mx-auto flex ${widthClass} flex-col gap-2.5 px-3 py-2.5 sm:px-6 sm:py-4 lg:px-8`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 motion-enter motion-delay-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-accent/80 sm:text-xs">Geargrade</div>
              <div className="truncate text-base font-semibold text-textPrimary sm:text-lg">摄影器材档案库</div>
            </div>

            <button
              type="button"
              className="button-secondary shrink-0 px-3 py-2 text-xs sm:text-sm motion-lift"
              onClick={toggleTheme}
            >
              {theme === "dark" ? "亮色模式" : "暗色模式"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 motion-enter motion-delay-1">
            <SummaryBadge label="当前持有" value={summary?.currently_owned_count ?? "--"} accentClass="bg-accent/6" />
            <SummaryBadge label="已售设备" value={summary?.sold_count ?? "--"} accentClass="bg-success/6" />
            <SummaryBadge label="正在感受" value={summary?.feeling_in_progress_count ?? "--"} accentClass="bg-warning/8" />
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-panelAlt/70 p-1 motion-enter motion-delay-2 sm:gap-2">
            <NavLink to="/" end className={navClassName}>
              概览
            </NavLink>
            <NavLink to="/clist" className={navClassName}>
              CList
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
            <NavLink to="/data-tools" className={navClassName}>
              数据工具
            </NavLink>
            <NavLink to="/settings" className={navClassName}>
              设置
            </NavLink>
          </nav>
        </div>
      </header>

      <main className={`mx-auto ${widthClass} px-3 py-4 sm:px-6 sm:py-6 lg:px-8`}>
        <PageTransition />
      </main>
    </div>
  );
}
