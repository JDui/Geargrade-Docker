import { useMemo, useState } from "react";

import { CATEGORY_LABELS, type DeviceCategory, type DeviceListItem } from "../../types/device";
import { CategoryIcon } from "./CategoryIcon";
import { DeviceCard } from "./DeviceCard";

interface CategoryDrawerListProps {
  items: DeviceListItem[];
  detailBasePath?: string;
  editBasePath?: string;
}

interface CategoryGroup {
  category: DeviceCategory;
  label: string;
  items: DeviceListItem[];
}

export function CategoryDrawerList({
  items,
  detailBasePath = "/devices",
  editBasePath = "/devices"
}: CategoryDrawerListProps) {
  const [openCategories, setOpenCategories] = useState<Set<DeviceCategory>>(new Set());

  const groups = useMemo<CategoryGroup[]>(() => {
    const grouped = new Map<DeviceCategory, DeviceListItem[]>();
    for (const item of items) {
      const current = grouped.get(item.category) ?? [];
      current.push(item);
      grouped.set(item.category, current);
    }
    return (Object.keys(CATEGORY_LABELS) as DeviceCategory[])
      .filter((category) => grouped.has(category))
      .map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        items: grouped.get(category) ?? []
      }));
  }, [items]);

  const allOpen = groups.length > 0 && groups.every((group) => openCategories.has(group.category));

  function toggle(category: DeviceCategory) {
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleAll() {
    setOpenCategories(allOpen ? new Set() : new Set(groups.map((group) => group.category)));
  }

  if (!groups.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-textSecondary">按类别收纳</div>
        <button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={toggleAll}>
          {allOpen ? "全部收起" : "全部展开"}
        </button>
      </div>

      {groups.map((group) => {
        const open = openCategories.has(group.category);
        return (
          <section key={group.category} className="panel overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-panelAlt/40"
              onClick={() => toggle(group.category)}
              aria-expanded={open}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 text-accent">
                  <CategoryIcon category={group.category} className="h-5 w-5" />
                </span>
                <span className="font-semibold text-textPrimary">{group.label}</span>
                <span className="shrink-0 rounded-full bg-panelAlt px-2 py-0.5 text-xs text-textSecondary">
                  {group.items.length}
                </span>
              </span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-4 w-4 shrink-0 text-textSecondary transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <path d="M5 7.5l5 5 5-5" />
              </svg>
            </button>

            {open ? (
              <div className="border-t border-line p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      detailBasePath={detailBasePath}
                      editBasePath={editBasePath}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
