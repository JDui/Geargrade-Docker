import { Link } from "react-router-dom";

import {
  CATEGORY_LABELS,
  RATING_LABELS,
  STATUS_LABELS,
  type DeviceListItem
} from "../../types/device";
import { formatCurrency, formatDate } from "../../utils/format";

interface DeviceTableProps {
  items: DeviceListItem[];
  onArchive: (device: DeviceListItem) => void;
}

export function DeviceTable({ items, onArchive }: DeviceTableProps) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-left text-sm">
          <thead className="bg-panelAlt/70 text-xs uppercase tracking-[0.16em] text-slate-400">
            <tr>
              <th className="px-4 py-3">设备</th>
              <th className="px-4 py-3">类别</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">评价</th>
              <th className="px-4 py-3">购入价</th>
              <th className="px-4 py-3">售出价</th>
              <th className="px-4 py-3">购入日期</th>
              <th className="px-4 py-3">售出日期</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-slate-200">
            {items.map((device) => (
              <tr key={device.id} className="hover:bg-panelAlt/40">
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{device.name}</div>
                  <div className="text-xs text-slate-400">{device.brand}</div>
                </td>
                <td className="px-4 py-4">{CATEGORY_LABELS[device.category]}</td>
                <td className="px-4 py-4">{STATUS_LABELS[device.status]}</td>
                <td className="px-4 py-4">{RATING_LABELS[device.rating]}</td>
                <td className="px-4 py-4">{formatCurrency(device.purchase_price)}</td>
                <td className="px-4 py-4">{formatCurrency(device.sale_price)}</td>
                <td className="px-4 py-4">{formatDate(device.purchase_date)}</td>
                <td className="px-4 py-4">{formatDate(device.sale_date)}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
