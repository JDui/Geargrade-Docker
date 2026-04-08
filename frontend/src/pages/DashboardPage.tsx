import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMatch } from "react-router-dom";

import { fetchDashboardSummary } from "../api/dashboard";
import { fetchDevices, updateDevice } from "../api/devices";
import { CategoryDonutChart } from "../components/dashboard/CategoryDonutChart";
import { RatingBarChart } from "../components/dashboard/RatingBarChart";
import { StatCard } from "../components/dashboard/StatCard";
import { DeviceCard } from "../components/devices/DeviceCard";
import { DeviceDetailDrawer } from "../components/devices/DeviceDetailDrawer";
import { DeviceTable } from "../components/devices/DeviceTable";
import { DeviceFiltersBar } from "../components/filters/DeviceFiltersBar";
import { DEFAULT_FILTERS, type DashboardSummary, type DeviceFilters, type DeviceListItem, type ViewMode } from "../types/device";

export default function DashboardPage() {
  const drawerMatch = useMatch("/devices/:deviceId");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<DeviceFilters>(DEFAULT_FILTERS);
  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [filters, deferredSearch]);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    const nextSummary = await fetchDashboardSummary();
    setSummary(nextSummary);
  }

  async function loadDevices(activeFilters: DeviceFilters) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDevices(activeFilters);
      setDevices(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载设备列表失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadDevices(effectiveFilters).catch(() => undefined);
  }, [effectiveFilters]);

  async function handleArchive(device: DeviceListItem) {
    await updateDevice(String(device.id), { status: "archived", is_currently_owned: false });
    await Promise.all([loadDevices(effectiveFilters), loadDashboard()]);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1fr,1fr,1.3fr,1.4fr]">
        <StatCard title="当前持有" value={summary?.currently_owned_count ?? "--"} accent="accent" />
        <StatCard title="已售设备" value={summary?.sold_count ?? "--"} accent="success" />
        <section className="panel p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">评价等级分布</div>
          <div className="mt-3">{summary ? <RatingBarChart data={summary.ratings} /> : <div className="text-slate-500">加载中...</div>}</div>
        </section>
        <section className="panel p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">设备类别分布</div>
          <div className="mt-3">{summary ? <CategoryDonutChart data={summary.categories} /> : <div className="text-slate-500">加载中...</div>}</div>
        </section>
      </section>

      <DeviceFiltersBar
        filters={filters}
        viewMode={viewMode}
        onFiltersChange={setFilters}
        onViewModeChange={setViewMode}
      />

      <section className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">设备库</div>
          <h1 className="mt-1 text-2xl font-semibold text-white">共 {total} 条设备档案</h1>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}

      {loading ? <div className="panel p-5 text-slate-300">正在加载设备列表...</div> : null}

      {!loading && !devices.length ? (
        <div className="panel p-8 text-center">
          <div className="text-lg font-medium text-white">没有匹配到设备</div>
          <p className="mt-2 text-sm text-slate-400">尝试放宽筛选条件，或者先添加第一条设备档案。</p>
        </div>
      ) : null}

      {!loading && devices.length ? (
        viewMode === "cards" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} onArchive={handleArchive} />
            ))}
          </section>
        ) : (
          <DeviceTable items={devices} onArchive={handleArchive} />
        )
      ) : null}

      {drawerMatch?.params.deviceId ? (
        <DeviceDetailDrawer
          deviceId={drawerMatch.params.deviceId}
          onChanged={() => {
            loadDevices(effectiveFilters).catch(() => undefined);
            loadDashboard().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
