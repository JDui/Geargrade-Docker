import { NavLink, Outlet } from "react-router-dom";

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    "rounded-xl px-3 py-2 text-sm transition",
    isActive ? "bg-accent/12 text-accent" : "text-slate-300 hover:bg-panelAlt hover:text-white"
  ].join(" ");
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-grid bg-[size:18px_18px]">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-accent/80">Geargrade</div>
            <div className="text-lg font-semibold text-white">摄影器材档案库</div>
          </div>
          <nav className="flex items-center gap-2 rounded-2xl border border-line bg-panelAlt/70 p-1">
            <NavLink to="/" end className={navClassName}>
              首页
            </NavLink>
            <NavLink to="/devices/new" className={navClassName}>
              新增设备
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
