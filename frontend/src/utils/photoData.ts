import { emptyPhotoFilter, type PhotoFilter, type PhotoRule } from "../api/photoData";

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
