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

export function DeviceFiltersBar({
  filters,
  viewMode,
  onFiltersChange,
  onViewModeChange
}: DeviceFiltersBarProps) {
  return (
    <section className="panel sticky top-[132px] z-30 p-4 xl:top-[92px]">
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
          <option value="">所有评级</option>
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

        <input
          className="field"
          placeholder="购入年份"
          inputMode="numeric"
          value={filters.purchaseYear}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              purchaseYear: event.target.value.replace(/[^\d]/g, "").slice(0, 4)
            })
          }
        />

        <div className="flex items-center gap-2 justify-self-end">
          {viewMode === "cards" ? (
            <>
              <select
                className="field min-w-[132px]"
                value={filters.sortBy}
                onChange={(event) =>
                  onFiltersChange({ ...filters, sortBy: event.target.value as DeviceFilters["sortBy"] })
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="field min-w-[96px]"
                value={filters.sortOrder}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    sortOrder: event.target.value as DeviceFilters["sortOrder"]
                  })
                }
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </>
          ) : null}

          <button
            className={viewMode === "cards" ? "button-primary" : "button-secondary"}
            type="button"
            onClick={() => onViewModeChange("cards")}
          >
            卡片
          </button>
          <button
            className={viewMode === "table" ? "button-primary" : "button-secondary"}
            type="button"
            onClick={() => onViewModeChange("table")}
          >
            表格
          </button>
          <button className="button-secondary" type="button" onClick={() => onFiltersChange(DEFAULT_FILTERS)}>
            重置
          </button>
        </div>
      </div>
    </section>
  );
}
