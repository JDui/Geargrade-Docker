import { RATING_LABELS, type DashboardBucket, type RatingLabel } from "../../types/device";

const barColors: Record<RatingLabel, string> = {
  god: "#f7c95f",
  excellent: "#55d39b",
  average: "#69b8ff",
  low: "#f27b8b"
};

interface RatingBarChartProps {
  data: DashboardBucket<RatingLabel>[];
}

export function RatingBarChart({ data }: RatingBarChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-full border border-line bg-panelAlt">
        <div className="flex h-5 w-full">
          {data.map((item) => {
            const width =
              total > 0 && item.count > 0 ? `${(item.count / total) * 100}%` : "0%";
            return (
              <div
                key={item.key}
                className="h-full transition-[width]"
                style={{ width, backgroundColor: barColors[item.key] }}
                title={`${RATING_LABELS[item.key]} ${item.count}`}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((item) => {
          const percent = total > 0 ? `${Math.round((item.count / total) * 100)}%` : "0%";
          return (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-xl bg-panelAlt/80 px-3 py-3"
            >
              <span className="flex items-center gap-2 text-sm text-textPrimary">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: barColors[item.key] }}
                />
                {RATING_LABELS[item.key]}
              </span>
              <span className="text-sm font-semibold text-textPrimary">
                {item.count}
                <span className="ml-2 text-xs font-medium text-textSecondary">{percent}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
