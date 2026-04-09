import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CATEGORY_LABELS, type DashboardBucket, type DeviceCategory } from "../../types/device";

const palette = ["#5cc8ff", "#55d39b", "#f7c95f", "#f27b8b", "#b28cff", "#3ed0c3"];

interface CategoryDonutChartProps {
  data: DashboardBucket<DeviceCategory>[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map((item) => ({
    ...item,
    label: CATEGORY_LABELS[item.key],
    percent: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));

  return (
    <div className="space-y-4">
      <div className="h-[240px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="label"
              innerRadius={52}
              outerRadius={82}
              paddingAngle={3}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.key} fill={palette[index % palette.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--tooltip-border)",
                borderRadius: "12px",
                color: "rgb(var(--color-text-primary))",
                boxShadow: "0 10px 30px rgba(0,0,0,0.18)"
              }}
              formatter={(value: number, _name, props) => {
                const payload = props?.payload as { label?: string; percent?: number } | undefined;
                const label = payload?.label ?? "未知类别";
                const percent = payload?.percent ?? 0;
                return [`${value} 台`, `${label} · ${percent}%`];
              }}
              labelFormatter={() => "设备类别"}
              labelStyle={{ color: "rgb(var(--color-text-primary))" }}
              itemStyle={{ color: "rgb(var(--color-text-primary))" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {chartData.map((item, index) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 rounded-xl bg-panelAlt/80 px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-textPrimary">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: palette[index % palette.length] }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-textPrimary">
              {item.count}
              <span className="ml-2 text-xs font-medium text-textSecondary">{item.percent}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
