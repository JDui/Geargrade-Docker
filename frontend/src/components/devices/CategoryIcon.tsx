import type { DeviceCategory } from "../../types/device";
import { CATEGORY_LABELS } from "../../types/device";
import type { DefaultIconSize } from "../layout/AppSettingsProvider";

interface CategoryIconProps {
  category: DeviceCategory;
  className?: string;
}

function iconPath(category: DeviceCategory) {
  switch (category) {
    case "camera_body":
      return (
        <>
          <path d="M5 9.5h3.2l1.4-2h4.8l1.4 2H19a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z" />
          <circle cx="12" cy="14.5" r="3.2" />
          <path d="M17.2 12h.1" />
        </>
      );
    case "lens":
      return (
        <>
          <rect x="5" y="7" width="14" height="12" rx="3" />
          <path d="M8 7.5V19M16 7.5V19" />
          <circle cx="12" cy="13" r="2.7" />
        </>
      );
    case "action_camera":
      return (
        <>
          <rect x="4" y="8" width="16" height="11" rx="3" />
          <circle cx="10" cy="13.5" r="3" />
          <path d="M15.5 12h1.5M15.5 15h1.5M8 6h8" />
        </>
      );
    case "drone":
      return (
        <>
          <path d="M9 12h6M12 9v6" />
          <rect x="9.3" y="9.3" width="5.4" height="5.4" rx="1.4" />
          <circle cx="5.5" cy="5.5" r="2.2" />
          <circle cx="18.5" cy="5.5" r="2.2" />
          <circle cx="5.5" cy="18.5" r="2.2" />
          <circle cx="18.5" cy="18.5" r="2.2" />
          <path d="M7.1 7.1 9.8 9.8M16.9 7.1l-2.7 2.7M7.1 16.9l2.7-2.7M16.9 16.9l-2.7-2.7" />
        </>
      );
    case "accessory":
      return (
        <>
          <path d="M7 7h10v10H7z" />
          <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
        </>
      );
    default:
      return (
        <>
          <path d="M12 4 4.8 8.2v7.6L12 20l7.2-4.2V8.2L12 4Z" />
          <path d="M12 8v8M8.5 10l7 4M15.5 10l-7 4" />
        </>
      );
  }
}

export function CategoryIcon({ category, className = "h-10 w-10" }: CategoryIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={`${CATEGORY_LABELS[category]}默认图标`}
    >
      {iconPath(category)}
    </svg>
  );
}

export function CategoryIconFallback({
  category,
  size = "medium",
  className
}: {
  category: DeviceCategory;
  size?: DefaultIconSize;
  className?: string;
}) {
  const frameClass = className ?? (size === "small" ? "h-20 w-24" : "h-24 w-28");
  const iconClass = size === "small" ? "h-9 w-9" : "h-11 w-11";

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl border border-line bg-panelAlt text-accent ${frameClass}`}>
      <CategoryIcon category={category} className={iconClass} />
    </div>
  );
}
