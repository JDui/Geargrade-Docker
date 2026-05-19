import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useMatch, useNavigate } from "react-router-dom";

import { fetchDevices } from "../api/devices";
import { AnnualPurchaseChart } from "../components/dashboard/AnnualPurchaseChart";
import { CategoryDonutChart } from "../components/dashboard/CategoryDonutChart";
import { RatingBarChart } from "../components/dashboard/RatingBarChart";
import { DeviceDetailDrawer } from "../components/devices/DeviceDetailDrawer";
import { useAppSettings } from "../components/layout/AppSettingsProvider";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import { useAnimatedRouteClose } from "../hooks/useAnimatedRouteClose";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { STATUS_LABELS, type AnnualBreakdownMode, type DeviceListItem } from "../types/device";
import { formatDailyCost, formatDate } from "../utils/format";
import { formatDeviceTitle, isFeelingScore, isUnratedScore, ratingLabelText } from "../utils/device";

const HOLDING_STATUSES = new Set(["holding", "for_sale"]);
const HOLDING_OVERLAY_STATE = {
  backgroundLocation: {
    pathname: "/",
    search: "",
    hash: ""
  }
};

type OverlayRouteState = {
  backgroundLocation?: {
    pathname: string;
    search?: string;
    hash?: string;
  };
};

function OverviewTeaser({ device, onOpen }: { device: DeviceListItem; onOpen: () => void }) {
  const { simplifiedMode } = useAppSettings();
  const feeling = isFeelingScore(device.score);
  const unrated = isUnratedScore(device.score);

  return (
    <button type="button" className="overview-teaser-card motion-lift" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-textPrimary">{formatDeviceTitle(device)}</div>
          <div className="mt-1 text-sm text-textSecondary">{device.brand}</div>
        </div>
        <span className="rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success">
          {STATUS_LABELS[device.status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="overview-teaser-label">购入日期</div>
          <div className="overview-teaser-value">{formatDate(device.purchase_date, simplifiedMode ? "month" : "day")}</div>
        </div>
        <div>
          <div className="overview-teaser-label">评分</div>
          <div className="overview-teaser-value">
            {feeling ? "感受中" : unrated ? "暂不做评价" : `${device.score} / ${ratingLabelText(device.rating_label)}`}
          </div>
        </div>
        <div>
          <div className="overview-teaser-label">每日成本</div>
          <div className="overview-teaser-value">{formatDailyCost(device.daily_cost_value)}</div>
        </div>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as OverlayRouteState | null) ?? null;
  const directDrawerMatch = useMatch("/devices/:deviceId");
  const holdingDrawerMatch = useMatch("/holding");
  const holdingDetailMatch = useMatch("/holding/devices/:deviceId");
  const { summary, refreshSummary } = useDashboardSummary();
  const [currentHoldingDevices, setCurrentHoldingDevices] = useState<DeviceListItem[]>([]);
  const [annualMode, setAnnualMode] = useState<AnnualBreakdownMode>("category");

  const holdingPreviewDevices = useMemo(() => currentHoldingDevices.slice(0, 3), [currentHoldingDevices]);
  const isHoldingRoute = Boolean(holdingDrawerMatch || holdingDetailMatch);
  const hasHoldingBackground = routeState?.backgroundLocation?.pathname === "/";
  const isHoldingDrawerVisible = isHoldingRoute && hasHoldingBackground;
  const { isClosing, isMounted, requestClose } = useAnimatedRouteClose(isHoldingDrawerVisible);

  useBodyScrollLock(isMounted);

  useEffect(() => {
    if (isHoldingRoute && !hasHoldingBackground) {
      navigate("/", { replace: true });
    }
  }, [hasHoldingBackground, isHoldingRoute, navigate]);

  async function loadCurrentHoldingDevices() {
    try {
      const result = await fetchDevices({
        search: "",
        category: "",
        status: "",
        rating: "",
        feelingOnly: false,
        purchaseYear: "",
        sortBy: "purchase_date",
        sortOrder: "desc"
      });
      setCurrentHoldingDevices(result.items.filter((device) => HOLDING_STATUSES.has(device.status)));
    } catch {
      setCurrentHoldingDevices([]);
    }
  }

  useEffect(() => {
    loadCurrentHoldingDevices().catch(() => undefined);
  }, []);

  function closeHoldingDrawer() {
    requestClose(() => navigate("/"));
  }

  function openHoldingDrawer() {
    navigate("/holding", { state: HOLDING_OVERLAY_STATE });
  }

  function openHoldingDevice(deviceId: number) {
    navigate(`/holding/devices/${deviceId}`, { state: HOLDING_OVERLAY_STATE });
  }

  const holdingDrawer = isMounted && isHoldingDrawerVisible && typeof document !== "undefined"
    ? createPortal(
      <>
        <button
          type="button"
          className={`drawer-overlay ${isClosing ? "motion-fade-out" : "motion-fade-in"}`}
          onClick={closeHoldingDrawer}
          aria-label="关闭当前持有设备抽屉"
        />
        <aside className={`drawer-panel drawer-panel-shell drawer-panel-wide ${isClosing ? "motion-slide-out-right" : "motion-slide-in-right"}`}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="drawer-header">
              <div className="min-w-0">
                <div className="dashboard-kicker">Holding Collection</div>
                <h2 className="mt-1 text-xl font-semibold text-textPrimary sm:text-2xl">当前持有设备</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-textSecondary">
                  这里汇总持有中和待售设备。点进设备详情后会在这一层之上继续展开，关闭时会逐层返回。
                </p>
              </div>
              <button type="button" className="button-secondary motion-lift shrink-0" onClick={closeHoldingDrawer}>
                关闭
              </button>
            </div>

            <div className="drawer-content flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              <div className="grid gap-3">
                {currentHoldingDevices.map((device, index) => (
                  <div key={device.id} className="motion-enter" style={{ animationDelay: `${120 + index * 70}ms` }}>
                    <OverviewTeaser device={device} onOpen={() => openHoldingDevice(device.id)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </>,
      document.body
    )
    : null;

  return (
    <div className="space-y-3 sm:space-y-5">
      <section className="dashboard-hero dashboard-hero-compact motion-enter motion-delay-0">
        <div className="dashboard-hero-topline">
          <div className="dashboard-hero-title-block">
            <div className="dashboard-kicker">Overview Console</div>
            <h1 className="dashboard-hero-title dashboard-hero-title-compact">概览</h1>
          </div>

          <div className="dashboard-hero-side dashboard-hero-side-inline">
            <div className="dashboard-signal-card dashboard-signal-card-compact motion-enter motion-delay-1">
              <div className="dashboard-signal-label">当前持有</div>
              <div className="dashboard-signal-value dashboard-signal-value-compact">
                {summary?.currently_owned_count ?? currentHoldingDevices.length}
              </div>
            </div>
            <div className="dashboard-signal-card dashboard-signal-card-compact motion-enter motion-delay-2">
              <div className="dashboard-signal-label">已售设备</div>
              <div className="dashboard-signal-value dashboard-signal-value-compact">{summary?.sold_count ?? "--"}</div>
            </div>
            <div className="dashboard-signal-card dashboard-signal-card-compact motion-enter motion-delay-3">
              <div className="dashboard-signal-label">正在感受</div>
              <div className="dashboard-signal-value dashboard-signal-value-compact">
                {summary?.feeling_in_progress_count ?? "--"}
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-hero-actions dashboard-hero-actions-compact">
          <button type="button" className="button-primary motion-lift" onClick={() => navigate("/archive")}>
            进入档案库
          </button>
        </div>
        <div className="dashboard-hero-glow" />
      </section>

      <section className="dashboard-overview-grid dashboard-overview-grid-compact">
        <section className="dashboard-panel dashboard-panel-primary motion-enter motion-delay-1">
          <div className="dashboard-panel-header">
            <div>
              <div className="dashboard-panel-kicker">Annual Pulse</div>
              <h2 className="dashboard-panel-title">年度购买量</h2>
            </div>
            <div className="annual-mode-switch">
              <button
                type="button"
                className={annualMode === "category" ? "button-primary px-3 py-1.5 text-xs motion-lift" : "button-secondary px-3 py-1.5 text-xs motion-lift"}
                onClick={() => setAnnualMode("category")}
              >
                设备分布
              </button>
              <button
                type="button"
                className={annualMode === "rating" ? "button-primary px-3 py-1.5 text-xs motion-lift" : "button-secondary px-3 py-1.5 text-xs motion-lift"}
                onClick={() => setAnnualMode("rating")}
              >
                等级分布
              </button>
            </div>
          </div>
          <AnnualPurchaseChart
            totals={summary?.purchase_years ?? []}
            categoryBreakdown={summary?.purchase_year_category_breakdown ?? []}
            ratingBreakdown={summary?.purchase_year_rating_breakdown ?? []}
            mode={annualMode}
            onModeChange={setAnnualMode}
          />
        </section>

        <section className="dashboard-panel dashboard-panel-secondary motion-enter motion-delay-2">
          <div className="dashboard-panel-header">
            <div>
              <div className="dashboard-panel-kicker">Rating Structure</div>
              <h2 className="dashboard-panel-title">评价等级分布</h2>
            </div>
          </div>
          {summary ? <RatingBarChart data={summary.ratings} /> : <div className="text-textSecondary">加载中...</div>}
        </section>

        <section className="dashboard-panel dashboard-panel-secondary motion-enter motion-delay-3">
          <div className="dashboard-panel-header">
            <div>
              <div className="dashboard-panel-kicker">Category Weight</div>
              <h2 className="dashboard-panel-title">设备类别分布</h2>
            </div>
          </div>
          {summary ? <CategoryDonutChart data={summary.categories} /> : <div className="text-textSecondary">加载中...</div>}
        </section>
      </section>

      <section className="dashboard-teaser-shell motion-enter motion-delay-4">
        <div className="dashboard-panel-header">
          <div>
            <div className="dashboard-panel-kicker">Holding Snapshot</div>
            <h2 className="dashboard-panel-title">当前持有设备</h2>
          </div>
          <button
            type="button"
            className="button-secondary motion-lift"
            onClick={openHoldingDrawer}
            disabled={!currentHoldingDevices.length}
          >
            打开持有设备抽屉
          </button>
        </div>

        {holdingPreviewDevices.length ? (
          <div className="dashboard-teaser-strip">
            {holdingPreviewDevices.map((device) => (
              <OverviewTeaser key={device.id} device={device} onOpen={() => navigate(`/devices/${device.id}`)} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-panelAlt/60 px-4 py-10 text-center text-sm text-textSecondary">
            暂无当前持有设备
          </div>
        )}
      </section>

      {directDrawerMatch?.params.deviceId ? (
        <DeviceDetailDrawer
          deviceId={directDrawerMatch.params.deviceId}
          closeTo="/"
          onChanged={() => {
            loadCurrentHoldingDevices().catch(() => undefined);
            refreshSummary().catch(() => undefined);
          }}
        />
      ) : null}

      {holdingDrawer}

      {holdingDetailMatch?.params.deviceId && isHoldingDrawerVisible ? (
        <DeviceDetailDrawer
          deviceId={holdingDetailMatch.params.deviceId}
          closeTo="/holding"
          closeState={HOLDING_OVERLAY_STATE}
          onChanged={() => {
            loadCurrentHoldingDevices().catch(() => undefined);
            refreshSummary().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
