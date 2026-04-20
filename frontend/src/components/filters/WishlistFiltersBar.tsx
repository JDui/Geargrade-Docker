import { useState } from "react";

import {
  CATEGORY_LABELS,
  DEFAULT_WISHLIST_FILTERS,
  RATING_LABELS,
  type DeviceCategory,
  type RatingLabel,
  type ViewMode,
  type WishlistFilters
} from "../../types/device";

interface WishlistFiltersBarProps {
  filters: WishlistFilters;
  viewMode: ViewMode;
  onFiltersChange: (next: WishlistFilters) => void;
  onViewModeChange: (next: ViewMode) => void;
}

const sortOptions = [
  { value: "updated_at", label: "最近更新" },
  { value: "created_at", label: "创建时间" },
  { value: "name", label: "设备名称" },
  { value: "brand", label: "品牌" },
  { value: "category", label: "类别" },
  { value: "score", label: "评分" }
] as const;

function SectionTitle({ children }: { children: string }) {
  return <span className="px-1 text-xs uppercase tracking-[0.18em] text-textSecondary">{children}</span>;
}

export function WishlistFiltersBar({
  filters,
  viewMode,
  onFiltersChange,
  onViewModeChange
}: WishlistFiltersBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const tableMode = viewMode === "table";

  return (
    <section className="panel z-30 p-3 sm:p-4 xl:sticky xl:top-[92px]">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:hidden">
          <div className="grid grid-cols-[minmax(0,1fr),auto,auto] gap-3">
            <input
              className="input min-w-0"
              placeholder="搜索名称、品牌、标签、详细评价..."
              value={filters.search}
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            />
            <button className="button-secondary px-3" type="button" onClick={() => setMobileExpanded((current) => !current)}>
              {mobileExpanded ? "收起筛选" : "筛选"}
            </button>
            <button
              className="button-secondary px-3"
              type="button"
              onClick={() => {
                onFiltersChange(DEFAULT_WISHLIST_FILTERS);
                setMobileExpanded(false);
              }}
            >
              重置
            </button>
          </div>

          {mobileExpanded ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="input"
                  value={filters.category}
                  onChange={(event) => onFiltersChange({ ...filters, category: event.target.value as DeviceCategory | "" })}
                >
                  <option value="">所有类别</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={filters.rating}
                  onChange={(event) => onFiltersChange({ ...filters, rating: event.target.value as RatingLabel | "" })}
                >
                  <option value="">所有评价</option>
                  {Object.entries(RATING_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  className="input"
                  value={filters.feelingOnly ? "true" : ""}
                  onChange={(event) => onFiltersChange({ ...filters, feelingOnly: event.target.value === "true" })}
                >
                  <option value="">感受状态</option>
                  <option value="true">仅感受中</option>
                </select>
              </div>

              <div className="rounded-2xl border border-line bg-panelAlt/50 p-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <SectionTitle>排序</SectionTitle>
                    <select
                      className="input min-w-0 flex-1 py-2"
                      value={filters.sortBy}
                      onChange={(event) => onFiltersChange({ ...filters, sortBy: event.target.value as WishlistFilters["sortBy"] })}
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className={!tableMode ? "w-[8.5rem]" : "pointer-events-none w-0 overflow-hidden opacity-0"}>
                      <div className="sort-toggle">
                        <span
                          className={`sort-toggle-thumb ${filters.sortOrder === "asc" ? "translate-x-0" : "translate-x-full"}`}
                        />
                        <button
                          className={`sort-toggle-option ${filters.sortOrder === "asc" ? "is-active" : ""}`}
                          type="button"
                          onClick={() => onFiltersChange({ ...filters, sortOrder: "asc" })}
                        >
                          升序
                        </button>
                        <button
                          className={`sort-toggle-option ${filters.sortOrder === "desc" ? "is-active" : ""}`}
                          type="button"
                          onClick={() => onFiltersChange({ ...filters, sortOrder: "desc" })}
                        >
                          降序
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SectionTitle>视图</SectionTitle>
                      <button className={viewMode === "cards" ? "button-primary px-3" : "button-secondary px-3"} type="button" onClick={() => onViewModeChange("cards")}>
                        卡片
                      </button>
                      <button className={viewMode === "table" ? "button-primary px-3" : "button-secondary px-3"} type="button" onClick={() => onViewModeChange("table")}>
                        表格
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden space-y-3 sm:block">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,2fr),repeat(3,minmax(0,1fr)),auto]">
            <input
              className="input"
              placeholder="搜索名称、品牌、标签、详细评价..."
              value={filters.search}
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            />
            <select
              className="input"
              value={filters.category}
              onChange={(event) => onFiltersChange({ ...filters, category: event.target.value as DeviceCategory | "" })}
            >
              <option value="">所有类别</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filters.rating}
              onChange={(event) => onFiltersChange({ ...filters, rating: event.target.value as RatingLabel | "" })}
            >
              <option value="">所有评价</option>
              {Object.entries(RATING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filters.feelingOnly ? "true" : ""}
              onChange={(event) => onFiltersChange({ ...filters, feelingOnly: event.target.value === "true" })}
            >
              <option value="">感受状态</option>
              <option value="true">仅感受中</option>
            </select>
            <div className="flex items-center justify-self-end">
              <button className="button-secondary w-full lg:w-auto" type="button" onClick={() => onFiltersChange(DEFAULT_WISHLIST_FILTERS)}>
                重置
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center justify-between gap-4 rounded-2xl border border-line bg-panelAlt/50 px-3 py-3">
              <div className="flex items-center gap-2">
                <SectionTitle>排序</SectionTitle>
                <select
                  className="input min-w-[156px] py-2"
                  value={filters.sortBy}
                  onChange={(event) => onFiltersChange({ ...filters, sortBy: event.target.value as WishlistFilters["sortBy"] })}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div
                  className={[
                    "transition-all duration-300 ease-out",
                    tableMode ? "pointer-events-none w-0 -translate-x-4 overflow-hidden opacity-0" : "w-[8.5rem] translate-x-0 opacity-100"
                  ].join(" ")}
                >
                  <div className="sort-toggle">
                    <span
                      className={`sort-toggle-thumb ${filters.sortOrder === "asc" ? "translate-x-0" : "translate-x-full"}`}
                    />
                    <button className={`sort-toggle-option ${filters.sortOrder === "asc" ? "is-active" : ""}`} type="button" onClick={() => onFiltersChange({ ...filters, sortOrder: "asc" })}>
                      升序
                    </button>
                    <button className={`sort-toggle-option ${filters.sortOrder === "desc" ? "is-active" : ""}`} type="button" onClick={() => onFiltersChange({ ...filters, sortOrder: "desc" })}>
                      降序
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SectionTitle>视图</SectionTitle>
                <button className={viewMode === "cards" ? "button-primary px-3" : "button-secondary px-3"} type="button" onClick={() => onViewModeChange("cards")}>
                  卡片
                </button>
                <button className={viewMode === "table" ? "button-primary px-3" : "button-secondary px-3"} type="button" onClick={() => onViewModeChange("table")}>
                  表格
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
