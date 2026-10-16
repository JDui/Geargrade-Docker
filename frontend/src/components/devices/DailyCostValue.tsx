import { formatDailyCost } from "../../utils/format";

interface DailyCostValueProps {
  value: number | null | undefined;
}

export function DailyCostValue({ value }: DailyCostValueProps) {
  const profitable = value != null && Number.isFinite(value) && value < 0;

  return <span className={profitable ? "daily-cost-profit" : undefined}>{formatDailyCost(value)}</span>;
}
