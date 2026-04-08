import { Link } from "react-router-dom";

import {
  CATEGORY_LABELS,
  RATING_LABELS,
  STATUS_LABELS,
  type DeviceListItem
} from "../../types/device";
import { formatCurrency, formatDate } from "../../utils/format";

interface DeviceCardProps {
  device: DeviceListItem;
  onArchive: (device: DeviceListItem) => void;
}

function statusClass(status: DeviceListItem["status"]) {
  const palette: Record<DeviceListItem["status"], string> = {
    holding: "bg-success/15 text-success",
    for_sale: "bg-warning/15 text-warning",
    sold: "bg-slate-600/40 text-slate-200",
    archived: "bg-slate-700/50 text-slate-300",
    pending: "bg-accent/15 text-accent",
    broken: "bg-danger/15 text-danger"
  };
  return palette[status];
}

function ratingClass(rating: DeviceListItem["rating"]) {
  const palette: Record<DeviceListItem["rating"], string> = {
    god: "bg-warning/20 text-warning",
    excellent: "bg-success/15 text-success",
    average: "bg-accent/15 text-accent",
    low: "bg-danger/15 text-danger",
    special: "bg-violet-500/15 text-violet-300"
  };
  return palette[rating];
}

function ImageFallback({ device }: { device: DeviceListItem }) {
  return (
    <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl border border-line bg-panelAlt">
      <div className="text-center">
        <div className="text-lg font-semibold text-accent">{device.brand.slice(0, 1)}</div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">No Image</div>
      </div>
    </div>
  );
}

export function DeviceCard({ device, onArchive }: DeviceCardProps) {
  return (
    <article className="panel flex h-full flex-col p-4">
      <div className="flex gap-4">
        {device.image_url ? (
          <img
            src={device.image_url}
            alt={device.name}
            className="h-20 w-24 rounded-xl border border-line object-cover"
          />
        ) : (
          <ImageFallback device={device} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="truncate text-lg font-semibold text-white">{device.name}</h3>
              <p className="text-sm text-slate-400">{device.brand}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ratingClass(device.rating)}`}>
              {RATING_LABELS[device.rating]}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-panelAlt px-2.5 py-1 text-slate-200">
              {CATEGORY_LABELS[device.category]}
            </span>
            <span className={`rounded-full px-2.5 py-1 ${statusClass(device.status)}`}>
              {STATUS_LABELS[device.status]}
            </span>
            {device.mount_system ? (
              <span className="rounded-full bg-panelAlt px-2.5 py-1 text-slate-300">{device.mount_system}</span>
            ) : null}
          </div>
        </div>
      </div>

      <p
        className="mt-4 overflow-hidden text-sm leading-6 text-slate-200"
        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
      >
        {device.summary}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {device.tags.length ? (
          device.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2 py-1 text-xs text-slate-300">
              {tag}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-500">暂无标签</span>
        )}
      </div>

      <div className="mt-4 grid gap-1 text-sm text-slate-300">
        <div>购入价: {formatCurrency(device.purchase_price)}</div>
        <div>购入日期: {formatDate(device.purchase_date)}</div>
      </div>

      <div className="mt-5 flex items-center gap-2 pt-4">
        <Link to={`/devices/${device.id}`} className="button-secondary">
          详情
        </Link>
        <Link to={`/devices/${device.id}/edit`} className="button-secondary">
          编辑
        </Link>
        <button className="button-secondary" type="button" onClick={() => onArchive(device)}>
          归档
        </button>
      </div>
    </article>
  );
}
