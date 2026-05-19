import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CATEGORY_LABELS, type DashboardBucket, type DeviceCategory } from "../../types/device";
import { useAppSettings } from "../layout/AppSettingsProvider";

const palette = ["#5cc8ff", "#55d39b", "#f7c95f", "#f27b8b", "#b28cff", "#3ed0c3"];

interface CategoryDonutChartProps {
  data: DashboardBucket<DeviceCategory>[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  const { reduceMotion } = useAppSettings();
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map((item) => ({
    ...item,
    label: CATEGORY_LABELS[item.key],
    percent: total > 0 ? Math.round((item.count / total) * 100) : 0
  }));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="dashboard-donut-shell motion-enter motion-delay-1 shrink-0">
        <div className="h-[180px] w-full sm:h-[160px] sm:w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                innerRadius={46}
                outerRadius={72}
                paddingAngle={3}
                isAnimationActive={!reduceMotion}
                animationDuration={1000}
                animationEasing="ease-out"
              >
                {chartData.map((entry, index) => (
                  <Cell key={entry.key} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: "14px",
                  color: "rgb(var(--color-text-primary))",
                  boxShadow: "0 18px 40px rgba(0,0,0,0.24)"
                }}
                formatter={(value: number, _name, props) => {
                  const payload = props?.payload as { label?: string; percent?: number } | undefined;
                  const label = payload?.label ?? "未知类别";
                  const percent = payload?.percent ?? 0;
                  return [`${value} 个`, `${label} · ${percent}%`];
                }}
                labelFormatter={() => "设备类别分布"}
                labelStyle={{ color: "rgb(var(--color-text-primary))" }}
                itemStyle={{ color: "rgb(var(--color-text-primary))" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        {chartData.map((item, index) => (
          <div
            key={item.key}
            className="dashboard-tag-row motion-enter"
            style={{ animationDelay: `${220 + index * 70}ms` }}
          >
            <span className="dashboard-tag-row-main">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
              <span className="truncate text-xs">{item.label}</span>
            </span>
            <span className="dashboard-tag-row-meta">
              <span>{item.count}</span>
              <span>{item.percent}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
