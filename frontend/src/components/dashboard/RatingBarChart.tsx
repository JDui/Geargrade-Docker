import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { RATING_LABELS, type DashboardBucket, type DeviceRating } from "../../types/device";

const barColors: Record<DeviceRating, string> = {
  god: "#f7c95f",
  excellent: "#55d39b",
  average: "#69b8ff",
  low: "#f27b8b",
  special: "#b28cff"
};

interface RatingBarChartProps {
  data: DashboardBucket<DeviceRating>[];
}

export function RatingBarChart({ data }: RatingBarChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    label: RATING_LABELS[item.key]
  }));

  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={chartData}>
        <XAxis dataKey="label" tick={{ fill: "#8ea1bb", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#72839a", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={barColors[entry.key]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
