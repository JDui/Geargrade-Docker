import { useMemo } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  CATEGORY_LABELS,
  RATING_LABELS,
  type AnnualBreakdownMode,
  type DashboardBucket,
  type DeviceCategory,
  type PurchaseYearBreakdown,
  type PurchaseYearBucket,
  type RatingLabel
} from "../../types/device";

interface AnnualPurchaseChartProps {
  totals: PurchaseYearBucket[];
  categoryBreakdown: PurchaseYearBreakdown<DeviceCategory>[];
  ratingBreakdown: PurchaseYearBreakdown<RatingLabel>[];
  mode: AnnualBreakdownMode;
  onModeChange: (mode: AnnualBreakdownMode) => void;
}

const categoryKeys: DeviceCategory[] = ["camera_body", "lens", "action_camera", "drone", "other"];
const categoryPalette: Record<DeviceCategory, string> = {
  camera_body: "#5cc8ff",
  lens: "#55d39b",
  action_camera: "#f7c95f",
  drone: "#f27b8b",
  accessory: "#b28cff",
  other: "#3ed0c3"
};

const ratingKeys: RatingLabel[] = ["god", "excellent", "average", "low"];
const ratingPalette: Record<RatingLabel, string> = {
  god: "#ffd166",
  excellent: "#5dd39e",
  average: "#6eb6ff",
  low: "#ef709d"
};

function breakdownLabel(mode: AnnualBreakdownMode, key: string) {
  return mode === "category" ? CATEGORY_LABELS[key as DeviceCategory] : RATING_LABELS[key as RatingLabel];
}

function toBreakdownMap<T extends string>(items: PurchaseYearBreakdown<T>[]) {
  return new Map(items.map((item) => [item.year, item.buckets]));
}

function toRow<T extends string>(total: PurchaseYearBucket, buckets: DashboardBucket<T>[] | undefined, keys: T[]) {
  return keys.reduce(
    (row, key) => ({
      ...row,
      [key]: buckets?.find((bucket) => bucket.key === key)?.count ?? 0
    }),
    {
      year: String(total.year),
      total: total.count
    } as Record<string, number | string>
  );
}

export function AnnualPurchaseChart({
  totals,
  categoryBreakdown,
  ratingBreakdown,
  mode,
  onModeChange
}: AnnualPurchaseChartProps) {
  const chartConfig = useMemo(() => {
    if (mode === "category") {
      const categoryMap = toBreakdownMap(categoryBreakdown);
      return {
        keys: categoryKeys,
        palette: categoryPalette,
        rows: totals.map((total) => toRow(total, categoryMap.get(total.year), categoryKeys))
      };
    }

    const ratingMap = toBreakdownMap(ratingBreakdown);
    return {
      keys: ratingKeys,
      palette: ratingPalette,
      rows: totals.map((total) => toRow(total, ratingMap.get(total.year), ratingKeys))
    };
  }, [categoryBreakdown, mode, ratingBreakdown, totals]);

  if (!totals.length) {
    return (
      <div className="annual-chart-frame flex items-center justify-center rounded-2xl border border-dashed border-line bg-panelAlt/60 text-sm text-textSecondary">
        暂无可统计的年度购买记录
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-textSecondary">按年份查看购买数量，以及设备分布和等级分布的变化趋势。</div>
        <div className="annual-mode-switch">
          <button
            type="button"
            className={mode === "category" ? "button-primary px-3 py-1.5 text-xs motion-lift" : "button-secondary px-3 py-1.5 text-xs motion-lift"}
            onClick={() => onModeChange("category")}
          >
            设备分布
          </button>
          <button
            type="button"
            className={mode === "rating" ? "button-primary px-3 py-1.5 text-xs motion-lift" : "button-secondary px-3 py-1.5 text-xs motion-lift"}
            onClick={() => onModeChange("rating")}
          >
            等级分布
          </button>
        </div>
      </div>

      <div className="annual-chart-frame rounded-[1.6rem] border border-line/70 bg-panelAlt/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartConfig.rows} margin={{ top: 28, right: 12, left: -18, bottom: 10 }}>
            <XAxis dataKey="year" tick={{ fill: "rgb(var(--color-text-secondary))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "rgb(var(--color-text-secondary))", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--tooltip-border)",
                borderRadius: "14px",
                color: "rgb(var(--color-text-primary))",
                boxShadow: "0 18px 40px rgba(0,0,0,0.24)"
              }}
              formatter={(value: number, key: string) => [`${value}`, breakdownLabel(mode, key)]}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as { total?: number } | undefined;
                const total = row?.total ?? 0;
                return `${label} 年 · 总购买量 ${total}`;
              }}
              labelStyle={{ color: "rgb(var(--color-text-primary))" }}
              itemStyle={{ color: "rgb(var(--color-text-primary))" }}
            />

            {chartConfig.keys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="annual"
                fill={chartConfig.palette[key as keyof typeof chartConfig.palette] as string}
                radius={[
                  key === chartConfig.keys[chartConfig.keys.length - 1] ? 10 : 0,
                  key === chartConfig.keys[chartConfig.keys.length - 1] ? 10 : 0,
                  0,
                  0
                ]}
                maxBarSize={38}
                isAnimationActive
                animationDuration={1100}
                animationEasing="ease-out"
              >
                {key === chartConfig.keys[chartConfig.keys.length - 1] ? (
                  <LabelList dataKey="total" position="top" offset={8} fill="rgb(var(--color-text-primary))" fontSize={12} />
                ) : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
