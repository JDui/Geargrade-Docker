import { useState } from "react";

import {
  CATEGORY_LABELS,
  DEFAULT_FILTERS,
  RATING_LABELS,
  STATUS_LABELS,
  type DeviceCategory,
  type DeviceFilters,
  type DeviceStatus,
  type RatingLabel,
  type ViewMode
} from "../../types/device";

interface DeviceFiltersBarProps {
  filters: DeviceFilters;
  viewMode: ViewMode;
  availablePurchaseYears: number[];
  onFiltersChange: (next: DeviceFilters) => void;
  onViewModeChange: (next: ViewMode) => void;
}

const sortOptions = [
  { value: "name", label: "设备名称" },
  { value: "category", label: "类别" },
  { value: "status", label: "状态" },
  { value: "purchase_date", label: "购入时间" },
  { value: "sale_date", label: "售出时间" },
  { value: "purchase_price", label: "购入价格" },
  { value: "sale_price", label: "售出价格" },
  { value: "score", label: "评分" },
  { value: "updated_at", label: "最近更新" },
  { value: "created_at", label: "创建时间" }
] as const;

function SectionTitle({ children }: { children: string }) {
  return <span className="px-1 text-xs uppercase tracking-[0.18em] text-textSecondary">{children}</span>;
}

export function DeviceFiltersBar({
  filters,
  viewMode,
  availablePurchaseYears,
  onFiltersChange,
  onViewModeChange
}: DeviceFiltersBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const tableMode = viewMode === "table";

  return (
    <section className="panel z-30 p-3 sm:p-4 xl:sticky xl:top-[92px]">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:hidden">
          <div className="grid gap-3 grid-cols-[minmax(0,1fr),auto,auto]">
            <input
              className="field min-w-0"
              placeholder="搜索名称、品牌、标签、详细评价..."
              value={filters.search}
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            />
            <button
              className="button-secondary px-3"
              type="button"
              onClick={() => setMobileExpanded((current) => !current)}
            >
              {mobileExpanded ? "收起筛选" : "筛选"}
            </button>
            <button
              className="button-secondary px-3"
              type="button"
              onClick={() => {
                onFiltersChange(DEFAULT_FILTERS);
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
                  className="field"
                  value={filters.category}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      category: event.target.value as DeviceCategory | ""
                    })
                  }
                >
                  <option value="">所有类别</option>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  className="field"
                  value={filters.status}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      status: event.target.value as DeviceStatus | ""
                    })
                  }
                >
                  <option value="">所有状态</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  className="field"
                  value={filters.rating}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      rating: event.target.value as RatingLabel | ""
                    })
                  }
                >
                  <option value="">所有评价</option>
                  {Object.entries(RATING_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  className="field"
                  value={filters.feelingOnly ? "true" : ""}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      feelingOnly: event.target.value === "true"
                    })
                  }
                >
                  <option value="">感受状态</option>
                  <option value="true">仅正在感受</option>
                </select>

                <select
                  className="field"
                  value={filters.purchaseYear}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      purchaseYear: event.target.value
                    })
                  }
                >
                  <option value="">所有购入年份</option>
                  {availablePurchaseYears.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-line bg-panelAlt/50 p-3">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <SectionTitle>排序</SectionTitle>
                    <select
                      className="field min-w-0 flex-1 py-2"
                      value={filters.sortBy}
                      onChange={(event) =>
                        onFiltersChange({
                          ...filters,
                          sortBy: event.target.value as DeviceFilters["sortBy"]
                        })
                      }
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={[
                        "transition-all duration-300 ease-out",
                        tableMode
                          ? "pointer-events-none w-0 -translate-x-4 overflow-hidden opacity-0"
                          : "w-[8.5rem] translate-x-0 opacity-100"
                      ].join(" ")}
                      aria-hidden={tableMode}
                    >
                      <div className="sort-toggle">
                        <span
                          className={`sort-toggle-thumb ${filters.sortOrder === "asc" ? "translate-x-0" : "translate-x-full"}`}
                        />
                        <button
                          className={`sort-toggle-option ${filters.sortOrder === "asc" ? "is-active" : ""}`}
                          type="button"
                          onClick={() => onFiltersChange({ ...filters, sortOrder: "asc" })}
                          tabIndex={tableMode ? -1 : 0}
                        >
                          升序
                        </button>
                        <button
                          className={`sort-toggle-option ${filters.sortOrder === "desc" ? "is-active" : ""}`}
                          type="button"
                          onClick={() => onFiltersChange({ ...filters, sortOrder: "desc" })}
                          tabIndex={tableMode ? -1 : 0}
                        >
                          降序
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <SectionTitle>视图</SectionTitle>
                      <button
                        className={viewMode === "cards" ? "button-primary px-3" : "button-secondary px-3"}
                        type="button"
                        onClick={() => onViewModeChange("cards")}
                      >
                        卡片
                      </button>
                      <button
                        className={viewMode === "table" ? "button-primary px-3" : "button-secondary px-3"}
                        type="button"
                        onClick={() => onViewModeChange("table")}
                      >
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
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,2fr),repeat(5,minmax(0,1fr)),auto]">
            <input
              className="field"
              placeholder="搜索名称、品牌、标签、详细评价..."
              value={filters.search}
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            />

            <select
              className="field"
              value={filters.category}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  category: event.target.value as DeviceCategory | ""
                })
              }
            >
              <option value="">所有类别</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              className="field"
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  status: event.target.value as DeviceStatus | ""
                })
              }
            >
              <option value="">所有状态</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              className="field"
              value={filters.rating}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  rating: event.target.value as RatingLabel | ""
                })
              }
            >
              <option value="">所有评价</option>
              {Object.entries(RATING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              className="field"
              value={filters.feelingOnly ? "true" : ""}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  feelingOnly: event.target.value === "true"
                })
              }
            >
              <option value="">感受状态</option>
              <option value="true">仅正在感受</option>
            </select>

            <select
              className="field"
              value={filters.purchaseYear}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  purchaseYear: event.target.value
                })
              }
            >
              <option value="">所有购入年份</option>
              {availablePurchaseYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-self-end">
              <button className="button-secondary w-full lg:w-auto" type="button" onClick={() => onFiltersChange(DEFAULT_FILTERS)}>
                重置
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center justify-between gap-4 rounded-2xl border border-line bg-panelAlt/50 px-3 py-3">
              <div className="flex items-center gap-2">
                <SectionTitle>排序</SectionTitle>
                <select
                  className="field min-w-[156px] py-2"
                  value={filters.sortBy}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      sortBy: event.target.value as DeviceFilters["sortBy"]
                    })
                  }
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
                    tableMode
                      ? "pointer-events-none w-0 -translate-x-4 overflow-hidden opacity-0"
                      : "w-[8.5rem] translate-x-0 opacity-100"
                  ].join(" ")}
                  aria-hidden={tableMode}
                >
                  <div className="sort-toggle">
                    <span
                      className={`sort-toggle-thumb ${filters.sortOrder === "asc" ? "translate-x-0" : "translate-x-full"}`}
                    />
                    <button
                      className={`sort-toggle-option ${filters.sortOrder === "asc" ? "is-active" : ""}`}
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, sortOrder: "asc" })}
                      tabIndex={tableMode ? -1 : 0}
                    >
                      升序
                    </button>
                    <button
                      className={`sort-toggle-option ${filters.sortOrder === "desc" ? "is-active" : ""}`}
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, sortOrder: "desc" })}
                      tabIndex={tableMode ? -1 : 0}
                    >
                      降序
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SectionTitle>视图</SectionTitle>
                <button
                  className={viewMode === "cards" ? "button-primary px-3" : "button-secondary px-3"}
                  type="button"
                  onClick={() => onViewModeChange("cards")}
                >
                  卡片
                </button>
                <button
                  className={viewMode === "table" ? "button-primary px-3" : "button-secondary px-3"}
                  type="button"
                  onClick={() => onViewModeChange("table")}
                >
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
