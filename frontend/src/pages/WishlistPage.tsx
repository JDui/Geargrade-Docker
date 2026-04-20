import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useMatch } from "react-router-dom";

import { fetchWishlistDevices } from "../api/wishlist";
import { WishlistCard } from "../components/devices/WishlistCard";
import { WishlistDetailDrawer } from "../components/devices/WishlistDetailDrawer";
import { WishlistTable } from "../components/devices/WishlistTable";
import { WishlistFiltersBar } from "../components/filters/WishlistFiltersBar";
import {
  DEFAULT_WISHLIST_FILTERS,
  type ViewMode,
  type WishlistDeviceListItem,
  type WishlistFilters
} from "../types/device";

export default function WishlistPage() {
  const tableSortFields = new Set(["name", "brand", "category", "score", "updated_at", "created_at"]);
  const drawerMatch = useMatch("/wishlist/devices/:deviceId");
  const [devices, setDevices] = useState<WishlistDeviceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<WishlistFilters>(DEFAULT_WISHLIST_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [filters, deferredSearch]);

  function handleTableSort(nextSortBy: WishlistFilters["sortBy"]) {
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
        sortBy: "updated_at",
        sortOrder: "desc"
      }));
    }
  }

  async function loadDevices(activeFilters: WishlistFilters) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWishlistDevices(activeFilters);
      setDevices(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载心愿池失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices(effectiveFilters).catch(() => undefined);
  }, [effectiveFilters]);

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Wishlist</div>
            <h1 className="mt-1 text-3xl font-semibold text-textPrimary">心愿池</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-textSecondary">
              这里存放还没买到，或者未来想再次回购的设备。它不参与主设备库统计、排行榜、每日成本和主库导入导出。
            </p>
          </div>
          <Link to="/wishlist/new" className="button-primary">
            新增心愿设备
          </Link>
        </div>
      </section>

      <WishlistFiltersBar filters={filters} viewMode={viewMode} onFiltersChange={setFilters} onViewModeChange={handleViewModeChange} />

      <section className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">Wishlist Devices</div>
          <h2 className="mt-1 text-2xl font-semibold text-textPrimary">共 {total} 条心愿设备</h2>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}
      {loading ? <div className="panel p-5 text-textSecondary">正在加载心愿池...</div> : null}

      {!loading && !devices.length ? (
        <div className="panel p-8 text-center">
          <div className="text-lg font-medium text-textPrimary">心愿池里还没有匹配设备</div>
          <p className="mt-2 text-sm text-textSecondary">你可以先新增一条心愿设备，或者调整筛选条件。</p>
        </div>
      ) : null}

      {!loading && devices.length ? (
        viewMode === "cards" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <WishlistCard key={device.id} device={device} />
            ))}
          </section>
        ) : (
          <WishlistTable items={devices} sortBy={filters.sortBy} sortOrder={filters.sortOrder} onSortChange={handleTableSort} />
        )
      ) : null}

      {drawerMatch?.params.deviceId ? (
        <WishlistDetailDrawer
          deviceId={drawerMatch.params.deviceId}
          closeTo="/wishlist"
          onChanged={() => {
            loadDevices(effectiveFilters).catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
