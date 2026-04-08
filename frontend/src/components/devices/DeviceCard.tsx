import { Link, useNavigate } from "react-router-dom";

import { CATEGORY_LABELS, STATUS_LABELS, type DeviceListItem } from "../../types/device";
import { formatCurrency, formatDate } from "../../utils/format";
import { formatDeviceTitle, isFeelingScore, ratingLabelText } from "../../utils/device";

function statusClass(status: DeviceListItem["status"]) {
  const palette: Record<DeviceListItem["status"], string> = {
    holding: "bg-success/15 text-success",
    for_sale: "bg-warning/15 text-warning",
    sold: "bg-panelAlt text-textPrimary",
    broken: "bg-danger/15 text-danger"
  };
  return palette[status];
}

function ratingClass(rating: NonNullable<DeviceListItem["rating_label"]>) {
  const palette: Record<NonNullable<DeviceListItem["rating_label"]>, string> = {
    god: "bg-warning/20 text-warning",
    excellent: "bg-success/15 text-success",
    average: "bg-accent/15 text-accent",
    low: "bg-danger/15 text-danger"
  };
  return palette[rating];
}

function ImageFallback({ device }: { device: DeviceListItem }) {
  return (
    <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-xl border border-line bg-panelAlt">
      <div className="text-center">
        <div className="text-lg font-semibold text-accent">{device.brand.slice(0, 1)}</div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-textSecondary">No Image</div>
      </div>
    </div>
  );
}

export function DeviceCard({ device }: { device: DeviceListItem }) {
  const navigate = useNavigate();
  const feeling = isFeelingScore(device.score);

  return (
    <article className="panel flex h-full flex-col overflow-hidden">
      <button
        type="button"
        className="flex flex-1 flex-col p-4 text-left transition hover:bg-panelAlt/20 active:scale-[0.995]"
        onClick={() => navigate(`/devices/${device.id}`)}
      >
        <div className="flex gap-4">
          {device.image_url ? (
            <img
              src={device.image_url}
              alt={device.name}
              className="h-24 w-28 rounded-xl border border-line object-cover"
            />
          ) : (
            <ImageFallback device={device} />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="truncate text-lg font-semibold text-textPrimary">{formatDeviceTitle(device)}</h3>
                <p className="text-sm text-textSecondary">{device.brand}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {device.rating_label ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ratingClass(device.rating_label)}`}>
                    {ratingLabelText(device.rating_label)}
                  </span>
                ) : null}
                {feeling ? (
                  <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">正在感受</span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-panelAlt px-2.5 py-1 text-textPrimary">
                {CATEGORY_LABELS[device.category]}
              </span>
              <span className={`rounded-full px-2.5 py-1 ${statusClass(device.status)}`}>
                {STATUS_LABELS[device.status]}
              </span>
              {device.mount_system_label ? (
                <span className="rounded-full bg-panelAlt px-2.5 py-1 text-textSecondary">{device.mount_system_label}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-panelAlt px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-textSecondary">评分</div>
            <div className="mt-1 text-lg font-semibold text-textPrimary">{feeling ? "感受中" : device.score}</div>
          </div>
          <div className="rounded-xl bg-panelAlt px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-textSecondary">购入价</div>
            <div className="mt-1 text-sm font-medium text-textPrimary">{formatCurrency(device.purchase_price)}</div>
          </div>
          <div className="rounded-xl bg-panelAlt px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-textSecondary">购入日期</div>
            <div className="mt-1 text-sm font-medium text-textPrimary">{formatDate(device.purchase_date)}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {device.tags.length ? (
            device.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line px-2 py-1 text-xs text-textSecondary">
                {tag}
              </span>
            ))
          ) : (
            <span className="text-xs text-textSecondary">暂无标签</span>
          )}
        </div>
      </button>

      <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
        <Link to={`/devices/${device.id}/edit`} className="button-secondary">
          编辑
        </Link>
      </div>
    </article>
  );
}
