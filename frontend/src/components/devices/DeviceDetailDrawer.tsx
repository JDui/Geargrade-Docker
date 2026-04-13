import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { deleteDevice, fetchDevice } from "../../api/devices";
import { CATEGORY_LABELS, STATUS_LABELS, type DeviceDetail } from "../../types/device";
import { formatCurrency, formatDate } from "../../utils/format";
import {
  formatDeviceTitle,
  isFeelingScore,
  ratingGlyphText,
  ratingLabelText
} from "../../utils/device";

interface DeviceDetailDrawerProps {
  deviceId: string;
  closeTo?: string;
  onChanged: () => void;
}

function saleDateText(device: DeviceDetail) {
  if (device.sale_date) {
    return formatDate(device.sale_date);
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
  onChanged
}: DeviceDetailDrawerProps) {
  const navigate = useNavigate();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchDevice(deviceId)
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
    if (!window.confirm("确认删除这个设备档案吗？")) {
      return;
    }
    await deleteDevice(deviceId);
    onChanged();
    navigate(closeTo);
  }

  const feeling = device ? isFeelingScore(device.score) : false;
  const scoreRankText = !device
    ? "--"
    : feeling
      ? "感受中，不参与评分榜"
      : device.score_rank != null
        ? `#${device.score_rank}`
        : "未上榜";

  const scoreGlyph = useMemo(() => {
    if (!device) {
      return "";
    }
    return ratingGlyphText(device.rating_label, device.score);
  }, [device]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
        onClick={() => navigate(closeTo)}
        aria-label="关闭详情"
      />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xl border-l border-line bg-surface/95 shadow-panel">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.22em] text-accent/80">设备详情</div>
              <h2 className="mt-1 truncate text-xl font-semibold text-textPrimary sm:text-2xl">
                {device ? formatDeviceTitle(device) : "加载中..."}
              </h2>
            </div>
            <button type="button" className="button-secondary" onClick={() => navigate(closeTo)}>
              关闭
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {loading ? <div className="text-textSecondary">正在加载设备详情...</div> : null}
            {error ? (
              <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger">
                {error}
              </div>
            ) : null}

            {!loading && !error && device ? (
              <div className="space-y-5 sm:space-y-6">
                <section className="panel p-4">
                  {device.image_url ? (
                    <img
                      src={device.image_url}
                      alt={device.name}
                      className="mb-4 h-44 w-full rounded-2xl border border-line object-cover sm:h-52"
                    />
                  ) : (
                    <div className="mb-4 flex h-44 items-center justify-center rounded-2xl border border-dashed border-line bg-panelAlt text-textSecondary sm:h-52">
                      暂无设备图片
                    </div>
                  )}
                  <div className="grid gap-3 text-sm text-textPrimary sm:grid-cols-2">
                    <div>
                      <div className="text-textSecondary">品牌</div>
                      <div>{device.brand}</div>
                    </div>
                    <div>
                      <div className="text-textSecondary">类别</div>
                      <div>{CATEGORY_LABELS[device.category]}</div>
                    </div>
                    <div>
                      <div className="text-textSecondary">状态</div>
                      <div>{STATUS_LABELS[device.status]}</div>
                    </div>
                    <div>
                      <div className="text-textSecondary">卡口 / 系统</div>
                      <div>{device.mount_system_label || "未记录"}</div>
                    </div>
                    <div>
                      <div className="text-textSecondary">购入次数</div>
                      <div>第 {device.acquisition_iteration} 次</div>
                    </div>
                    <div>
                      <div className="text-textSecondary">榜单名次（评分榜）</div>
                      <div>{scoreRankText}</div>
                    </div>
                  </div>
                </section>

                <section className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">
                    主观评价系统
                  </div>

                  <div className="score-hero-card mt-4">
                    <div className="score-hero-copy">
                      <div className="score-hero-label">数字评分</div>
                      <div className="score-hero-value">{feeling ? "感受中" : device.score}</div>
                      <div className="score-hero-meta">
                        {feeling ? "当前处于体验阶段" : ratingLabelText(device.rating_label)}
                      </div>
                    </div>
                    <div className={`score-hero-glyph ${feeling ? "is-feeling" : ""}`} aria-hidden="true">
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

                <section className="panel p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">
                    财务与时间记录
                  </div>
                  <div className="mt-4 grid gap-4 text-sm text-textPrimary sm:grid-cols-2">
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-textSecondary">购入价格</div>
                      <div className="mt-1 text-lg text-textPrimary">{formatCurrency(device.purchase_price)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-textSecondary">售出价格</div>
                      <div className="mt-1 text-lg text-textPrimary">{formatCurrency(device.sale_price)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-textSecondary">购入日期</div>
                      <div className="mt-1 text-textPrimary">{formatDate(device.purchase_date)}</div>
                    </div>
                    <div className="rounded-2xl bg-panelAlt p-4">
                      <div className="text-textSecondary">售出日期</div>
                      <div className="mt-1 text-textPrimary">{saleDateText(device)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/devices/${device.id}/edit`} className="button-primary">
                      编辑设备
                    </Link>
                    <button type="button" className="button-danger" onClick={handleDelete}>
                      删除设备
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );
}
