import { emptyPhotoFilter, type AnalyticsPoint, type PhotoFilter, type PhotoRule } from "../api/photoData";

export function photoTimelineSeries(items: AnalyticsPoint[], monthly: boolean): AnalyticsPoint[] {
  const counts = new Map<number, number>();
  for (const item of items) {
    if (!(monthly ? /^[1-9]\d{3}-(0[1-9]|1[0-2])$/ : /^[1-9]\d{3}$/).test(item.key)) continue;
    const year = Number(item.key.slice(0, 4));
    const index = monthly ? year * 12 + Number(item.key.slice(5)) - 1 : year;
    counts.set(index, (counts.get(index) || 0) + item.count);
  }
  const indexes = [...counts.keys()].sort((a, b) => a - b);
  if (!indexes.length) return [];
  return Array.from({ length: indexes[indexes.length - 1] - indexes[0] + 1 }, (_, i) => {
    const index = indexes[0] + i;
    return {
      key: monthly ? `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}` : String(index),
      count: counts.get(index) || 0
    };
  });
}

function isPhotoRule(value: unknown, depth = 0): value is PhotoRule {
  if (!value || typeof value !== "object" || depth > 5) return false;
  const rule = value as Record<string, unknown>;
  if ("children" in rule) {
    return ["and", "or", "not"].includes(String(rule.op)) && Array.isArray(rule.children)
      && rule.children.length <= 50 && (rule.op !== "not" || rule.children.length === 1)
      && rule.children.every(child => isPhotoRule(child, depth + 1));
  }
  return typeof rule.field === "string" && typeof rule.op === "string";
}

export function readPhotoFilter(serialized: string | null): PhotoFilter {
  try {
    const value = JSON.parse(serialized || "null");
    if (value?.version === "photo-filter.v1" && isPhotoRule(value.group)) return value;
  } catch {
    // Invalid or outdated links fall back to the full index.
  }
  return emptyPhotoFilter();
}

export function photoFilesDestination(filter: PhotoFilter): string {
  const params = new URLSearchParams({ photo_files: "1" });
  params.set("photo_filter", JSON.stringify(filter));
  return "/data-tools?" + params.toString();
}

const brands: Record<string, string> = {
  sony: "Sony", fujifilm: "Fujifilm", olympus: "Olympus", panasonic: "Panasonic",
  canon: "Canon", nikon: "Nikon", leica: "Leica", pentax: "Pentax", ricoh: "Ricoh",
  dji: "DJI", insta360: "Insta360", om: "OM System"
};

export function photoGearLabel(name: string): string {
  if (name === "未记录") return name;
  const separator = name.indexOf(":");
  if (separator < 0) return name;
  const brand = name.slice(0, separator);
  const model = name.slice(separator + 1).toUpperCase();
  return `${brands[brand] || brand} ${model}`;
}

export function photoGearColor(name: string): string {
  const palette = ["#5cc8ff", "#b4a3ff", "#ffc76f", "#6fdbbd", "#ff95b0", "#98b7ef", "#e9a6e0", "#9cd67e"];
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
