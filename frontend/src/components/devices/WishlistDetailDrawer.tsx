import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

import { deleteWishlistDevice, fetchWishlistDevice } from "../../api/wishlist";
import { useAnimatedRouteClose } from "../../hooks/useAnimatedRouteClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useAppSettings } from "../layout/AppSettingsProvider";
import type { WishlistDeviceDetail } from "../../types/device";
import { CATEGORY_LABELS } from "../../types/device";
import { formatDateTime } from "../../utils/format";
import {
  formatDeviceTitle,
  isFeelingScore,
  isUnratedScore,
  ratingGlyphText,
  ratingLabelText
} from "../../utils/device";
import { CategoryIcon } from "./CategoryIcon";

interface WishlistDetailDrawerProps {
  deviceId: string;
  closeTo?: string;
  onChanged: () => void;
}

export function WishlistDetailDrawer({ deviceId, closeTo = "/wishlist", onChanged }: WishlistDetailDrawerProps) {
  const navigate = useNavigate();
  const { defaultIconSize } = useAppSettings();
  const detailIconFrameClass = defaultIconSize === "small" ? "h-24 w-24" : "h-32 w-32";
  const detailIconClass = defaultIconSize === "small" ? "h-12 w-12" : "h-16 w-16";
  const [device, setDevice] = useState<WishlistDeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isClosing, isMounted, requestClose } = useAnimatedRouteClose();

  useBodyScrollLock(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchWishlistDevice(deviceId)
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
  }, [deviceId]);

  async function handleDelete() {
    if (!window.confirm("确认删除这个心愿设备吗？")) {
      return;
    }
    await deleteWishlistDevice(deviceId);
    onChanged();
    navigate(closeTo);
  }

  const feeling = device ? isFeelingScore(device.score) : false;
  const unrated = device ? isUnratedScore(device.score) : false;
  const scoreGlyph = useMemo(() => {
    if (!device) {
      return "";
    }
    return ratingGlyphText(device.rating_label, device.score);
  }, [device]);

  function handleClose() {
    requestClose(() => navigate(closeTo));
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
        aria-label="关闭心愿详情"
      />
      <aside className={`drawer-panel drawer-panel-shell ${isClosing ? "motion-slide-out-right" : "motion-slide-in-right"}`}>
        <div className="flex h-full min-h-0 flex-col">
          <div className="drawer-header">
            <div className="min-w-0">
              <div className="dashboard-kicker">心愿池详情</div>
              <h2 className="mt-1 truncate text-xl font-semibold text-textPrimary sm:text-2xl">
                {device ? formatDeviceTitle(device) : "加载中..."}
              </h2>
            </div>
            <button type="button" className="button-secondary motion-lift" onClick={handleClose}>
              关闭
            </button>
          </div>

          <div className="drawer-content flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {loading ? <div className="text-textSecondary">正在加载心愿详情...</div> : null}
            {error ? <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}

            {!loading && !error && device ? (
              <div className="space-y-5 sm:space-y-6">
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
                      <div className="drawer-info-label">卡口 / 系统</div>
                      <div className="drawer-info-value">{device.mount_system_label || "未记录"}</div>
                    </div>
                    <div className="drawer-info-card">
                      <div className="drawer-info-label">第几次想要购入</div>
                      <div className="drawer-info-value">第 {device.acquisition_iteration} 次</div>
                    </div>
                    <div className="drawer-info-card sm:col-span-2">
                      <div className="drawer-info-label">最近更新</div>
                      <div className="drawer-info-value">{formatDateTime(device.updated_at)}</div>
                    </div>
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
                          ? "仍在观察与比较"
                          : unrated
                            ? "当前只记录心愿，不进入等级统计"
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
                  <div className="text-sm font-medium text-textPrimary">标签</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {device.tags.length ? (
                      device.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-line px-2 py-1 text-xs text-textSecondary">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-textSecondary">暂无标签</span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/wishlist/${device.id}/edit`} className="button-secondary motion-lift">
                      编辑心愿
                    </Link>
                    <Link to={`/wishlist/devices/${device.id}/redeem`} className="button-primary motion-lift">
                      兑现
                    </Link>
                    <button type="button" className="button-danger motion-lift" onClick={handleDelete}>
                      删除心愿
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
