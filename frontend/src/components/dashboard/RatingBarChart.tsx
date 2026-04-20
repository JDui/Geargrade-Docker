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
      <div className="dashboard-rating-rail">
        <div className="flex h-6 w-full overflow-hidden rounded-full">
          {data.map((item, index) => {
            const width = total > 0 && item.count > 0 ? `${(item.count / total) * 100}%` : "0%";
            return (
              <div
                key={item.key}
                className="dashboard-rating-segment"
                style={{
                  width,
                  backgroundColor: barColors[item.key],
                  animationDelay: `${220 + index * 90}ms`
                }}
                title={`${RATING_LABELS[item.key]} ${item.count}`}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {data.map((item, index) => {
          const percent = total > 0 ? `${Math.round((item.count / total) * 100)}%` : "0%";
          return (
            <div
              key={item.key}
              className="dashboard-stat-row dashboard-stat-row-tight motion-enter"
              style={{ animationDelay: `${260 + index * 80}ms` }}
            >
              <span className="dashboard-stat-label">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: barColors[item.key] }} />
                <span>{RATING_LABELS[item.key]}</span>
              </span>
              <span className="dashboard-stat-value">
                <span>{item.count}</span>
                <span className="dashboard-stat-percent">{percent}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
