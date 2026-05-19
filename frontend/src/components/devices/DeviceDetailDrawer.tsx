import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

import { deleteDevice, fetchDevice } from "../../api/devices";
import { useAnimatedRouteClose } from "../../hooks/useAnimatedRouteClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useAppSettings } from "../layout/AppSettingsProvider";
import type { DeviceDetail } from "../../types/device";
import { CATEGORY_LABELS, STATUS_LABELS } from "../../types/device";
import { formatCurrency, formatDailyCost, formatDate } from "../../utils/format";
import {
  formatDeviceTitle,
  isFeelingScore,
  isUnratedScore,
  ratingGlyphText,
  ratingLabelText
} from "../../utils/device";
import { CategoryIcon } from "./CategoryIcon";

interface DeviceDetailDrawerProps {
  deviceId: string;
  closeTo?: string;
  closeState?: unknown;
  onChanged: () => void;
  fetcher?: (deviceId: string) => Promise<DeviceDetail>;
  deleter?: (deviceId: string) => Promise<void>;
  editBasePath?: string;
  showScoreRank?: boolean;
  titleLabel?: string;
}

function saleDateText(device: DeviceDetail, precision: "day" | "month") {
  if (device.sale_date) {
    return formatDate(device.sale_date, precision);
  }

  switch (device.status) {
    case "holding":
      return "持有中";
    case "for_sale":
      return "待售";
    case "broken":
      return "已损坏";
    default:
      return "--";
  }
}

export function DeviceDetailDrawer({
  deviceId,
  closeTo = "/",
  closeState,
  onChanged,
  fetcher = fetchDevice,
  deleter = deleteDevice,
  editBasePath = "/devices",
  showScoreRank = true,
  titleLabel = "设备详情"
}: DeviceDetailDrawerProps) {
  const navigate = useNavigate();
  const { defaultIconSize, simplifiedMode } = useAppSettings();
  const datePrecision: "day" | "month" = simplifiedMode ? "month" : "day";
  const detailIconFrameClass = defaultIconSize === "small" ? "h-24 w-24" : "h-32 w-32";
  const detailIconClass = defaultIconSize === "small" ? "h-12 w-12" : "h-16 w-16";
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isClosing, isMounted, requestClose } = useAnimatedRouteClose();

  useBodyScrollLock(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetcher(deviceId)
      .then((result) => {
        if (active) {
          setDevice(result);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [deviceId, fetcher]);

  async function handleDelete() {
    if (!window.confirm("确认删除这个设备档案吗？")) {
      return;
    }
    await deleter(deviceId);
    onChanged();
    navigate(closeTo, closeState ? { state: closeState } : undefined);
  }

  const feeling = device ? isFeelingScore(device.score) : false;
  const unrated = device ? isUnratedScore(device.score) : false;
  const scoreRankText = !device
    ? "--"
    : feeling
      ? "感受中，不参与评分榜"
      : unrated
        ? "暂不做评价，不参与评分榜"
        : device.score_rank != null
          ? `#${device.score_rank}`
          : "未上榜";

  const scoreGlyph = useMemo(() => {
    if (!device) {
      return "";
    }
    return ratingGlyphText(device.rating_label, device.score);
  }, [device]);

  function handleClose() {
    requestClose(() => navigate(closeTo, closeState ? { state: closeState } : undefined));
  }

  if (typeof document === "undefined" || !isMounted) {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className={`drawer-overlay ${isClosing ? "motion-fade-out" : "motion-fade-in"}`}
        onClick={handleClose}
        aria-label="关闭设备详情"
      />
      <aside className={`drawer-panel drawer-panel-shell drawer-panel-wide ${isClosing ? "motion-slide-out-right" : "motion-slide-in-right"}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="drawer-header">
            <div className="min-w-0">
              <div className="dashboard-kicker">{titleLabel}</div>
              <h2 className="mt-1 truncate text-xl font-semibold text-textPrimary sm:text-2xl">
                {device ? formatDeviceTitle(device) : "加载中..."}
              </h2>
              {device ? (
                <p className="mt-1 text-sm text-textSecondary">
                  {device.brand} · {CATEGORY_LABELS[device.category]}
                </p>
              ) : null}
            </div>
            <button type="button" className="button-secondary motion-lift shrink-0" onClick={handleClose}>
              关闭
            </button>
          </div>

          <div className="drawer-content flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {loading ? <div className="text-textSecondary">正在加载设备详情...</div> : null}
            {error ? <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}

            {!loading && !error && device ? (
              <div className="space-y-4">
                <section className="panel p-4 motion-enter motion-delay-1">
                  {device.image_url ? (
                    <img
                      src={device.image_url}
                      alt={device.name}
                      className="mb-4 h-44 w-full rounded-2xl border border-line object-cover sm:h-52"
                    />
                  ) : (
                    <div className="mb-4 flex justify-center">
                      <div className={`flex ${detailIconFrameClass} items-center justify-center rounded-2xl border border-dashed border-line bg-panelAlt text-accent`}>
                        <CategoryIcon category={device.category} className={detailIconClass} />
                      </div>
                    </div>
                  )}

                  <div className="drawer-info-grid sm:grid-cols-2">
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">品牌</div>
                      <div className="drawer-info-value">{device.brand}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">类别</div>
                      <div className="drawer-info-value">{CATEGORY_LABELS[device.category]}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">状态</div>
                      <div className="drawer-info-value">{STATUS_LABELS[device.status]}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">卡口 / 系统</div>
                      <div className="drawer-info-value">{device.mount_system_label || "未记录"}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">购入次数</div>
                      <div className="drawer-info-value">第 {device.acquisition_iteration} 次</div>
                    </div>
                    {showScoreRank ? (
                      <div className="drawer-info-card">
                        <div className="drawer-info-label">榜单名次（评分榜）</div>
                        <div className="drawer-info-value">{scoreRankText}</div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="panel p-4 motion-enter motion-delay-2">
                  <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">主观评价系统</div>

                  <div className="score-hero-card mt-4">
                    <div className="score-hero-copy">
                      <div className="score-hero-label">数字评分</div>
                      <div className="score-hero-value">{feeling ? "感受中" : unrated ? "暂不做评价" : device.score}</div>
                      <div className="score-hero-meta">
                        {feeling
                          ? "当前处于体验阶段"
                          : unrated
                            ? "当前不进入评分统计和排行榜"
                            : ratingLabelText(device.rating_label)}
                      </div>
                    </div>
                    <div className={`score-hero-glyph ${feeling || unrated ? "is-feeling" : ""}`} aria-hidden="true">
                      {scoreGlyph}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-success/8 p-4">
                      <div className="text-sm font-medium text-success">优点</div>
                      <ul className="mt-3 space-y-2 text-sm text-textPrimary">
                        {device.pros.length ? device.pros.map((item) => <li key={item}>- {item}</li>) : <li>暂无</li>}
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-danger/8 p-4">
                      <div className="text-sm font-medium text-danger">缺点</div>
                      <ul className="mt-3 space-y-2 text-sm text-textPrimary">
                        {device.cons.length ? device.cons.map((item) => <li key={item}>- {item}</li>) : <li>暂无</li>}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-medium text-textPrimary">详细评价</div>
                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-textSecondary">
                      {device.review_detail || "暂无详细评价"}
                    </p>
                  </div>
                </section>

                <section className="panel p-4 motion-enter motion-delay-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">财务与时间记录</div>
                  <div className="mt-4 drawer-info-grid sm:grid-cols-2">
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">购入价格</div>
                      <div className="drawer-info-value text-lg">{formatCurrency(device.purchase_price)}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">售出价格</div>
                      <div className="drawer-info-value text-lg">{formatCurrency(device.sale_price)}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">购入日期</div>
                      <div className="drawer-info-value">{formatDate(device.purchase_date, datePrecision)}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">售出日期</div>
                      <div className="drawer-info-value">{saleDateText(device, datePrecision)}</div>
                    </div>
                    <div className="drawer-info-card sm:col-span-2">
                      <div className="drawer-info-label">每日成本</div>
                      <div className="drawer-info-value text-lg">{formatDailyCost(device.daily_cost_value)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`${editBasePath}/${device.id}/edit`} className="button-primary motion-lift">
                      编辑设备
                    </Link>
                    <button type="button" className="button-danger motion-lift" onClick={handleDelete}>
                      删除设备
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
