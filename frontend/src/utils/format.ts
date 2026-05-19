export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "未记录";
  }
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDailyCost(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "未计算";
  }

  const prefix = value > 0 ? "" : value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  const amount = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: absValue >= 100 ? 0 : 1
  }).format(absValue);
  return `${prefix}${amount}/天`;
}

export function formatDate(value: string | null | undefined, precision: "day" | "month" = "day"): string {
  if (!value) {
    return "未记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit"
  };
  if (precision === "day") {
    options.day = "2-digit";
  }

  return new Intl.DateTimeFormat("zh-CN", options).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "未记录";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatDurationDays(days: number): string {
  if (days < 30) {
    return `${days} 天`;
  }
  if (days < 365) {
    return `${(days / 30).toFixed(1)} 个月`;
  }
  return `${(days / 365).toFixed(1)} 年`;
}

export function formatDurationMonths(months: number): string {
  return `${months} 个月`;
}
