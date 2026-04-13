import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";

import { fetchDevices } from "../api/devices";
import { AnnualPurchaseChart } from "../components/dashboard/AnnualPurchaseChart";
import { CategoryDonutChart } from "../components/dashboard/CategoryDonutChart";
import { RatingBarChart } from "../components/dashboard/RatingBarChart";
import { DeviceCard } from "../components/devices/DeviceCard";
import { DeviceDetailDrawer } from "../components/devices/DeviceDetailDrawer";
import { DeviceTable } from "../components/devices/DeviceTable";
import { DeviceFiltersBar } from "../components/filters/DeviceFiltersBar";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import {
  DEFAULT_FILTERS,
  STATUS_LABELS,
  type AnnualBreakdownMode,
  type DeviceFilters,
  type DeviceListItem,
  type ViewMode
} from "../types/device";
import { formatDate } from "../utils/format";
import { formatDeviceTitle, isFeelingScore, ratingLabelText } from "../utils/device";

const HOLDING_STATUSES = new Set(["holding", "for_sale"]);

export default function DashboardPage() {
  const tableSortFields = new Set([
    "name",
    "category",
    "status",
    "score",
    "purchase_price",
    "purchase_date",
    "sale_date"
  ]);
  const navigate = useNavigate();
  const drawerMatch = useMatch("/devices/:deviceId");
  const { summary, refreshSummary } = useDashboardSummary();
  const [devices, setDevices] = useState<DeviceListItem[]>([]);
  const [currentHoldingDevices, setCurrentHoldingDevices] = useState<DeviceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<DeviceFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [annualMode, setAnnualMode] = useState<AnnualBreakdownMode>("category");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: deferredSearch }),
    [filters, deferredSearch]
  );

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
      sortOrder:
        current.sortBy === nextSortBy && current.sortOrder === "desc" ? "asc" : "desc"
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

  async function loadCurrentHoldingDevices() {
    try {
      const result = await fetchDevices(DEFAULT_FILTERS);
      setCurrentHoldingDevices(
        result.items.filter((device) => HOLDING_STATUSES.has(device.status)).slice(0, 4)
      );
    } catch {
      setCurrentHoldingDevices([]);
    }
  }

  useEffect(() => {
    loadDevices(effectiveFilters).catch(() => undefined);
  }, [effectiveFilters]);

  useEffect(() => {
    loadCurrentHoldingDevices().catch(() => undefined);
  }, []);

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="grid gap-4 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="grid gap-4">
          <section className="panel p-4 sm:p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-textSecondary">评价等级分布</div>
            <div className="mt-4">
              {summary ? <RatingBarChart data={summary.ratings} /> : <div className="text-textSecondary">加载中...</div>}
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-textSecondary">设备类别分布</div>
            <div className="mt-4">
              {summary ? (
                <CategoryDonutChart data={summary.categories} />
              ) : (
                <div className="text-textSecondary">加载中...</div>
              )}
            </div>
          </section>
        </div>

        <div className="grid gap-4">
          <section className="panel p-4 sm:p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-textSecondary">年度购买量</div>
            <div className="mt-4">
              {summary ? (
                <AnnualPurchaseChart
                  totals={summary.purchase_years}
                  categoryBreakdown={summary.purchase_year_category_breakdown}
                  ratingBreakdown={summary.purchase_year_rating_breakdown}
                  mode={annualMode}
                  onModeChange={setAnnualMode}
                />
              ) : (
                <div className="text-textSecondary">加载中...</div>
              )}
            </div>
          </section>

          <section className="panel p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.2em] text-textSecondary">当前持有设备</div>
              <div className="text-xs text-textSecondary">
                {summary?.currently_owned_count ?? currentHoldingDevices.length} 台
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {currentHoldingDevices.length ? (
                currentHoldingDevices.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    className="rounded-2xl border border-line bg-panelAlt/70 p-3.5 text-left transition hover:border-accent/30 hover:bg-panelAlt sm:p-4"
                    onClick={() => navigate(`/devices/${device.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-textPrimary">
                          {formatDeviceTitle(device)}
                        </div>
                        <div className="mt-1 text-xs text-textSecondary">{device.brand}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success">
                        {STATUS_LABELS[device.status]}
                      </span>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.16em] text-textSecondary">
                          购入日期
                        </div>
                        <div className="mt-1 text-sm text-textPrimary">
                          {formatDate(device.purchase_date)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-textSecondary">
                          评分
                        </div>
                        <div className="mt-1 text-sm font-medium text-textPrimary">
                          {isFeelingScore(device.score)
                            ? "感受中"
                            : `${device.score} / ${ratingLabelText(device.rating_label)}`}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-line bg-panelAlt/60 px-4 py-8 text-center text-sm text-textSecondary">
                  暂无当前持有设备
                </div>
              )}
            </div>
          </section>
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
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">设备库</div>
          <h1 className="mt-1 text-2xl font-semibold text-textPrimary">共 {total} 条设备档案</h1>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">
          {error}
        </div>
      ) : null}

      {loading ? <div className="panel p-5 text-textSecondary">正在加载设备列表...</div> : null}

      {!loading && !devices.length ? (
        <div className="panel p-8 text-center">
          <div className="text-lg font-medium text-textPrimary">没有匹配到设备</div>
          <p className="mt-2 text-sm text-textSecondary">
            尝试放宽筛选条件，或者先添加第一条设备档案。
          </p>
        </div>
      ) : null}

      {!loading && devices.length ? (
        viewMode === "cards" ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {devices.map((device) => (
              <DeviceCard key={device.id} device={device} />
            ))}
          </section>
        ) : (
          <DeviceTable
            items={devices}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={handleTableSort}
          />
        )
      ) : null}

      {drawerMatch?.params.deviceId ? (
        <DeviceDetailDrawer
          deviceId={drawerMatch.params.deviceId}
          closeTo="/"
          onChanged={() => {
            loadDevices(effectiveFilters).catch(() => undefined);
            loadCurrentHoldingDevices().catch(() => undefined);
            refreshSummary().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
