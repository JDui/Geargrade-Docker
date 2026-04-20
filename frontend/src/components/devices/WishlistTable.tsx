import { useNavigate } from "react-router-dom";

import {
  CATEGORY_LABELS,
  type SortOrder,
  type WishlistDeviceListItem,
  type WishlistSortBy
} from "../../types/device";
import { formatDateTime } from "../../utils/format";
import { formatDeviceTitle, isFeelingScore, isUnratedScore, ratingLabelText } from "../../utils/device";

interface WishlistTableProps {
  items: WishlistDeviceListItem[];
  sortBy: WishlistSortBy;
  sortOrder: SortOrder;
  onSortChange: (sortBy: WishlistSortBy) => void;
}

const sortableColumns: Array<{ key: WishlistSortBy; label: string }> = [
  { key: "name", label: "设备" },
  { key: "brand", label: "品牌" },
  { key: "category", label: "类别" },
  { key: "score", label: "评分" },
  { key: "updated_at", label: "最近更新" }
];

export function WishlistTable({ items, sortBy, sortOrder, onSortChange }: WishlistTableProps) {
  const navigate = useNavigate();

  function renderSortLabel(column: WishlistSortBy, label: string) {
    const active = sortBy === column;
    const suffix = !active ? "" : sortOrder === "desc" ? " ↓" : " ↑";
    return `${label}${suffix}`;
  }

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-left text-sm">
          <thead className="bg-panelAlt/70 text-xs uppercase tracking-[0.16em] text-textSecondary">
            <tr>
              {sortableColumns.map((column) => (
                <th key={column.key} className="px-4 py-3">
                  <button type="button" className="transition hover:text-textPrimary" onClick={() => onSortChange(column.key)}>
                    {renderSortLabel(column.key, column.label)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3">想要购入</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-textPrimary">
            {items.map((device) => {
              const feeling = isFeelingScore(device.score);
              const unrated = isUnratedScore(device.score);
              return (
                <tr key={device.id} className="cursor-pointer hover:bg-panelAlt/40" onClick={() => navigate(`/wishlist/devices/${device.id}`)}>
                  <td className="px-4 py-4">
                    <div className="font-medium text-textPrimary">{formatDeviceTitle(device)}</div>
                    <div className="text-xs text-textSecondary">{device.mount_system_label || "未记录卡口"}</div>
                  </td>
                  <td className="px-4 py-4">{device.brand}</td>
                  <td className="px-4 py-4">{CATEGORY_LABELS[device.category]}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{feeling ? "感受中" : unrated ? "暂不评价" : device.score}</span>
                      {device.rating_label ? <span className="text-xs text-textSecondary">{ratingLabelText(device.rating_label)}</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">{formatDateTime(device.updated_at)}</td>
                  <td className="px-4 py-4">第 {device.acquisition_iteration} 次</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/wishlist/${device.id}/edit`);
                        }}
                      >
                        编辑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
