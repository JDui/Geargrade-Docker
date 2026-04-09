import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface AnnualPurchaseChartProps {
  data: Array<{ year: number; count: number }>;
}

export function AnnualPurchaseChart({ data }: AnnualPurchaseChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-line bg-panelAlt/60 text-sm text-textSecondary">
        暂无可统计的年度购买记录
      </div>
    );
  }

  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 10, left: -20, bottom: 8 }}>
          <XAxis
            dataKey="year"
            tick={{ fill: "rgb(var(--color-text-secondary))", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "rgb(var(--color-text-secondary))", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--tooltip-bg)",
              border: "1px solid var(--tooltip-border)",
              borderRadius: "12px",
              color: "rgb(var(--color-text-primary))",
              boxShadow: "0 10px 30px rgba(0,0,0,0.18)"
            }}
            formatter={(value: number) => [`${value}`, "购买数量"]}
            labelFormatter={(label) => `${label} 年`}
            labelStyle={{ color: "rgb(var(--color-text-primary))" }}
            itemStyle={{ color: "rgb(var(--color-text-primary))" }}
          />
          <Bar dataKey="count" fill="rgb(var(--color-accent))" radius={[10, 10, 0, 0]}>
            <LabelList
              dataKey="count"
              position="top"
              fill="rgb(var(--color-text-primary))"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
