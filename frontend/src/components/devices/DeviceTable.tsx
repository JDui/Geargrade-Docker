import { useNavigate } from "react-router-dom";

import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type DeviceListItem,
  type SortBy,
  type SortOrder
} from "../../types/device";
import { formatCurrency, formatDate } from "../../utils/format";
import { formatDeviceTitle, isFeelingScore, ratingLabelText } from "../../utils/device";

interface DeviceTableProps {
  items: DeviceListItem[];
  sortBy: SortBy;
  sortOrder: SortOrder;
  onSortChange: (sortBy: SortBy) => void;
}

const sortableColumns: Array<{ key: SortBy; label: string }> = [
  { key: "name", label: "设备" },
  { key: "category", label: "类别" },
  { key: "status", label: "状态" },
  { key: "score", label: "评分" },
  { key: "purchase_price", label: "购入价" },
  { key: "purchase_date", label: "购入日期" },
  { key: "sale_date", label: "售出日期" }
];

export function DeviceTable({
  items,
  sortBy,
  sortOrder,
  onSortChange
}: DeviceTableProps) {
  const navigate = useNavigate();

  function renderSortLabel(column: SortBy, label: string) {
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
                  <button
                    type="button"
                    className="transition hover:text-textPrimary"
                    onClick={() => onSortChange(column.key)}
                  >
                    {renderSortLabel(column.key, column.label)}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-textPrimary">
            {items.map((device) => {
              const feeling = isFeelingScore(device.score);
              return (
                <tr
                  key={device.id}
                  className="cursor-pointer hover:bg-panelAlt/40"
                  onClick={() => navigate(`/devices/${device.id}`)}
                >
                  <td className="px-4 py-4">
                    <div className="font-medium text-textPrimary">{formatDeviceTitle(device)}</div>
                    <div className="text-xs text-textSecondary">{device.brand}</div>
                  </td>
                  <td className="px-4 py-4">{CATEGORY_LABELS[device.category]}</td>
                  <td className="px-4 py-4">{STATUS_LABELS[device.status]}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{feeling ? "感受中" : device.score}</span>
                      {device.rating_label ? (
                        <span className="text-xs text-textSecondary">
                          {ratingLabelText(device.rating_label)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">{formatCurrency(device.purchase_price)}</td>
                  <td className="px-4 py-4">{formatDate(device.purchase_date)}</td>
                  <td className="px-4 py-4">{formatDate(device.sale_date)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/devices/${device.id}/edit`);
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
