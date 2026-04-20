import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMatch } from "react-router-dom";

import { fetchDevices } from "../api/devices";
import { DeviceCard } from "../components/devices/DeviceCard";
import { DeviceDetailDrawer } from "../components/devices/DeviceDetailDrawer";
import { DeviceTable } from "../components/devices/DeviceTable";
import { DeviceFiltersBar } from "../components/filters/DeviceFiltersBar";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import { DEFAULT_FILTERS, type DeviceFilters, type DeviceListItem, type ViewMode } from "../types/device";

export default function ArchivePage() {
  const tableSortFields = new Set(["name", "category", "status", "score", "purchase_price", "purchase_date", "sale_date"]);

  const drawerMatch = useMatch("/archive/devices/:deviceId");
  const { summary, refreshSummary } = useDashboardSummary();
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<DeviceFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [filters, deferredSearch]);

  const availablePurchaseYears = useMemo(() => {
    const years = (summary?.purchase_years ?? []).map((item) => item.year);
    if (!years.length) {
      return [];
    }

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const options: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      options.push(year);
    }
    return options;
  }, [summary]);

  function handleTableSort(nextSortBy: DeviceFilters["sortBy"]) {
    setFilters((current) => ({
      ...current,
      sortBy: nextSortBy,
      sortOrder: current.sortBy === nextSortBy && current.sortOrder === "desc" ? "asc" : "desc"
    }));
  }

  function handleViewModeChange(nextViewMode: ViewMode) {
    setViewMode(nextViewMode);
    if (nextViewMode === "table" && !tableSortFields.has(filters.sortBy)) {
      setFilters((current) => ({
        ...current,
        sortBy: "purchase_date",
        sortOrder: "desc"
      }));
    }
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
    loadDevices(effectiveFilters).catch(() => undefined);
  }, [effectiveFilters]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Archive</div>
          <h1 className="mt-1 text-3xl font-semibold text-textPrimary">档案库</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">
            这里处理筛选、搜索、卡片流、表格视图和设备详情。概览页只保留统计与趋势模块。
          </p>
        </div>
      </section>

      <DeviceFiltersBar
        filters={filters}
        viewMode={viewMode}
        availablePurchaseYears={availablePurchaseYears}
        onFiltersChange={setFilters}
        onViewModeChange={handleViewModeChange}
      />

      <section className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">Archive Collection</div>
          <h2 className="mt-1 text-2xl font-semibold text-textPrimary">共 {total} 条设备档案</h2>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}
      {loading ? <div className="panel p-5 text-textSecondary">正在加载设备列表...</div> : null}

      {!loading && !devices.length ? (
        <div className="panel p-8 text-center">
          <div className="text-lg font-medium text-textPrimary">没有匹配到设备</div>
          <p className="mt-2 text-sm text-textSecondary">尝试放宽筛选条件，或者先添加第一条设备档案。</p>
        </div>
      ) : null}

      {!loading && devices.length ? (
        viewMode === "cards" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} detailBasePath="/archive/devices" />
            ))}
          </section>
        ) : (
          <DeviceTable
            items={devices}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={handleTableSort}
            detailBasePath="/archive/devices"
          />
        )
      ) : null}

      {drawerMatch?.params.deviceId ? (
        <DeviceDetailDrawer
          deviceId={drawerMatch.params.deviceId}
          closeTo="/archive"
          onChanged={() => {
            loadDevices(effectiveFilters).catch(() => undefined);
            refreshSummary().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
