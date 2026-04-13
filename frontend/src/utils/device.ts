import type { DeviceListItem, MountSystemKey, RatingLabel } from "../types/device";
import { MOUNT_SYSTEM_LABELS, RATING_LABELS } from "../types/device";

const superscriptDigits = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

export function formatAcquisitionSuperscript(iteration: number): string {
  if (iteration <= 1) {
    return "";
  }

  return String(iteration)
    .split("")
    .map((digit) => superscriptDigits[Number(digit)] ?? digit)
    .join("");
}

export function formatDeviceTitle(device: Pick<DeviceListItem, "name" | "acquisition_iteration">): string {
  return `${device.name}${formatAcquisitionSuperscript(device.acquisition_iteration)}`;
}

export function ratingLabelText(rating: RatingLabel | null): string {
  if (!rating) {
    return "正在感受";
  }
  return RATING_LABELS[rating];
}

export function ratingGlyphText(rating: RatingLabel | null, score: number): string {
  if (isFeelingScore(score)) {
    return "感";
  }

  return {
    god: "神",
    excellent: "佳",
    average: "中",
    low: "低"
  }[rating ?? "average"];
}

export function isFeelingScore(score: number): boolean {
  return score === -1;
}

export function scoreToRatingLabel(score: number): RatingLabel | null {
  if (isFeelingScore(score)) return null;
  if (score > 100) return "god";
  if (score >= 80) return "excellent";
  if (score >= 50) return "average";
  return "low";
}

export function mountSystemLabel(key: MountSystemKey | null, custom?: string | null): string | null {
  if (!key) {
    return null;
  }
  if (key === "other") {
    return custom || MOUNT_SYSTEM_LABELS.other;
  }
  return MOUNT_SYSTEM_LABELS[key];
}
