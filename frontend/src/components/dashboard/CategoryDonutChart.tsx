import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CATEGORY_LABELS, type DashboardBucket, type DeviceCategory } from "../../types/device";

const palette = ["#5cc8ff", "#55d39b", "#f7c95f", "#f27b8b", "#b28cff", "#3ed0c3"];

interface CategoryDonutChartProps {
  data: DashboardBucket<DeviceCategory>[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    label: CATEGORY_LABELS[item.key]
  }));

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr,160px]">
      <ResponsiveContainer width="100%" height={170}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="label"
            innerRadius={44}
            outerRadius={70}
            paddingAngle={3}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.key} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#111926",
              border: "1px solid #223045",
              borderRadius: "12px",
              color: "#fff"
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid content-start gap-2">
        {chartData.map((item, index) => (
          <div key={item.key} className="flex items-center justify-between gap-2 rounded-xl bg-panelAlt/80 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-slate-200">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette[index % palette.length] }}
              />
              {item.label}
            </span>
            <span className="text-sm font-semibold text-white">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
