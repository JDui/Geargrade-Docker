import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useNavigate } from "react-router-dom";

import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  type DeviceCategory,
  type DeviceListItem,
  type DeviceStatus,
  type WishlistDeviceListItem,
  type RatingLabel
} from "../../types/device";
import { formatCurrency, formatDate } from "../../utils/format";
import { formatDeviceTitle, isFeelingScore, isUnratedScore, ratingLabelText } from "../../utils/device";

interface CategoryGroup {
  key: DeviceCategory;
  label: string;
  items: CListItem[];
}

type CListItem = DeviceListItem | WishlistDeviceListItem;

interface CListColumn {
  key: string;
  label: string;
  categoryGroups: CategoryGroup[];
}

interface PositionedDevice {
  device: CListItem;
  y: number;
}

interface PositionedCategory {
  key: DeviceCategory;
  label: string;
  y: number;
  items: PositionedDevice[];
  bottomY: number;
}

interface PositionedColumn {
  key: string;
  label: string;
  x: number;
  categoryGroups: PositionedCategory[];
  bottomY: number;
}

interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

interface PointerPoint {
  x: number;
  y: number;
}

const CARD_WIDTH = 220;
const COLUMN_WIDTH = 280;
const ITEM_GAP = 126;
const ROOT_Y = 32;
const TRUNK_Y = 88;
const YEAR_Y = 112;
const CATEGORY_START_Y = 166;
const CATEGORY_ITEM_START_OFFSET = 46;
const CATEGORY_GAP = 34;
const LEFT_PAD = 160;
const RIGHT_PAD = 160;
const BOTTOM_PAD = 120;
const MAX_SCALE = 2.4;
const DEFAULT_MIN_SCALE = 0.12;
const FIT_PADDING = 32;
const NODE_ICON_OFFSET = 18;

const statusPalette: Record<DeviceStatus, string> = {
  holding: "border-success/50 text-success",
  for_sale: "border-warning/55 text-warning",
  sold: "border-textSecondary/45 text-textSecondary",
  broken: "border-danger/55 text-danger"
};

const ratingPalette: Record<RatingLabel, string> = {
  god: "text-warning",
  excellent: "text-success",
  average: "text-accent",
  low: "text-danger"
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as DeviceCategory[];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fitScaleForViewport(width: number, height: number, canvasWidth: number, canvasHeight: number): number {
  if (width <= 0 || height <= 0) {
    return DEFAULT_MIN_SCALE;
  }

  const scale = Math.min((width - FIT_PADDING) / canvasWidth, (height - FIT_PADDING) / canvasHeight);
  return clamp(scale, 0.03, 1);
}

function purchaseYear(device: DeviceListItem): string {
  if (!device.purchase_date) {
    return "undated";
  }

  const date = new Date(device.purchase_date);
  if (Number.isNaN(date.getTime())) {
    return "undated";
  }

  return String(date.getFullYear());
}

function compareByPurchaseDate(left: DeviceListItem, right: DeviceListItem): number {
  const leftTime = left.purchase_date ? new Date(left.purchase_date).getTime() : Number.POSITIVE_INFINITY;
  const rightTime = right.purchase_date ? new Date(right.purchase_date).getTime() : Number.POSITIVE_INFINITY;

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return left.name.localeCompare(right.name);
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  if (leftTime !== rightTime) return leftTime - rightTime;
  return left.name.localeCompare(right.name);
}

function scoreText(device: CListItem): string {
  if (isFeelingScore(device.score)) return "FEEL";
  if (isUnratedScore(device.score)) return "N/A";
  return String(device.score);
}

function titleClass(device: CListItem): string {
  if (device.rating_label) {
    return ratingPalette[device.rating_label];
  }
  if (isFeelingScore(device.score)) {
    return "text-accent";
  }
  if (isUnratedScore(device.score)) {
    return "text-textSecondary";
  }
  return "text-textPrimary";
}

function buildCategoryGroups(items: CListItem[]): CategoryGroup[] {
  const groups = new Map<DeviceCategory, CListItem[]>();

  for (const item of items) {
    const current = groups.get(item.category) ?? [];
    current.push(item);
    groups.set(item.category, current);
  }

  return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
    key: category,
    label: CATEGORY_LABELS[category],
    items: (groups.get(category) ?? []).slice().sort((left, right) => {
      if ("purchase_date" in left && "purchase_date" in right) {
        return compareByPurchaseDate(left, right);
      }
      return left.name.localeCompare(right.name);
    })
  }));
}

function buildYearGroups(items: DeviceListItem[]): CListColumn[] {
  const groups = new Map<string, DeviceListItem[]>();

  for (const item of items) {
    const key = purchaseYear(item);
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => {
      if (left === "undated") return 1;
      if (right === "undated") return -1;
      return Number(left) - Number(right);
    })
    .map(([key, groupItems]) => ({
      key: `year-${key}`,
      label: key === "undated" ? "No Date" : key,
      categoryGroups: buildCategoryGroups(groupItems)
    }));
}

function buildCListColumns(items: DeviceListItem[], wishlistItems: WishlistDeviceListItem[]): CListColumn[] {
  const holdingItems = items.filter((item) => item.status === "holding");

  return [
    {
      key: "holding",
      label: "持有设备",
      categoryGroups: buildCategoryGroups(holdingItems)
    },
    ...buildYearGroups(items),
    {
      key: "wishlist",
      label: "心愿池",
      categoryGroups: buildCategoryGroups(wishlistItems)
    }
  ];
}

function layoutColumns(columns: CListColumn[]): PositionedColumn[] {
  return columns.map((column, columnIndex) => {
    let cursorY = CATEGORY_START_Y;
    const x = LEFT_PAD + columnIndex * COLUMN_WIDTH;
    const categoryGroups = column.categoryGroups.map((category) => {
      const y = cursorY;
      const positionedItems = category.items.map((device, itemIndex) => ({
        device,
        y: y + CATEGORY_ITEM_START_OFFSET + itemIndex * ITEM_GAP
      }));
      const lastItem = positionedItems.at(-1);
      const bottomY = lastItem ? lastItem.y + 90 : y + 24;
      cursorY = bottomY + CATEGORY_GAP;

      return {
        ...category,
        y,
        items: positionedItems,
        bottomY
      };
    });

    return {
      ...column,
      x,
      categoryGroups,
      bottomY: Math.max(YEAR_Y + 72, cursorY - CATEGORY_GAP)
    };
  });
}

interface DeviceCListViewProps {
  items: DeviceListItem[];
  wishlistItems?: WishlistDeviceListItem[];
  detailBasePath?: string;
}

function isDeviceItem(device: CListItem): device is DeviceListItem {
  return "status" in device;
}

export function DeviceCListView({ items, wishlistItems = [], detailBasePath = "/devices" }: DeviceCListViewProps) {
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    active: false,
    moved: false,
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });
  const activePointers = useRef(new Map<number, PointerPoint>());
  const pinchState = useRef({
    active: false,
    startDistance: 0,
    anchorWorldX: 0,
    anchorWorldY: 0
  });
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const columns = useMemo(() => layoutColumns(buildCListColumns(items, wishlistItems)), [items, wishlistItems]);
  const canvasWidth = Math.max(760, LEFT_PAD + RIGHT_PAD + Math.max(columns.length - 1, 0) * COLUMN_WIDTH);
  const canvasHeight = Math.max(420, Math.max(...columns.map((column) => column.bottomY), YEAR_Y + 72) + BOTTOM_PAD);
  const rootX = canvasWidth / 2;
  const firstColumnX = LEFT_PAD;
  const lastColumnX = LEFT_PAD + Math.max(columns.length - 1, 0) * COLUMN_WIDTH;

  function updateView(nextView: ViewTransform | ((current: ViewTransform) => ViewTransform)) {
    setView((current) => {
      const next = typeof nextView === "function" ? nextView(current) : nextView;
      viewRef.current = next;
      return next;
    });
  }

  function minScaleForViewport() {
    const viewport = viewportRef.current;
    if (!viewport) return DEFAULT_MIN_SCALE;

    const rect = viewport.getBoundingClientRect();
    return Math.min(DEFAULT_MIN_SCALE, fitScaleForViewport(rect.width, rect.height, canvasWidth, canvasHeight));
  }

  function zoomBy(clientX: number, clientY: number, scaleFactor: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const minScale = minScaleForViewport();

    updateView((current) => {
      const nextScale = clamp(current.scale * scaleFactor, minScale, MAX_SCALE);
      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale
      };
    });
  }

  function panBy(deltaX: number, deltaY: number) {
    updateView((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY
    }));
  }

  function pointerEntries() {
    return Array.from(activePointers.current.entries());
  }

  function viewportPointFromEvent(event: ReactPointerEvent<HTMLElement>): PointerPoint {
    const viewport = viewportRef.current;
    if (!viewport) {
      return { x: event.clientX, y: event.clientY };
    }

    const rect = viewport.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function startPinch() {
    const entries = pointerEntries();
    if (entries.length < 2) return;

    const [, first] = entries[0];
    const [, second] = entries[1];
    const centerX = (first.x + second.x) / 2;
    const centerY = (first.y + second.y) / 2;
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const currentView = viewRef.current;

    pinchState.current = {
      active: true,
      startDistance: Math.max(distance, 1),
      anchorWorldX: (centerX - currentView.x) / currentView.scale,
      anchorWorldY: (centerY - currentView.y) / currentView.scale
    };
    dragState.current.active = false;
    dragState.current.moved = true;
  }

  function applyPinch() {
    const entries = pointerEntries();
    if (entries.length < 2) return;

    const [, first] = entries[0];
    const [, second] = entries[1];
    const centerX = (first.x + second.x) / 2;
    const centerY = (first.y + second.y) / 2;
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    const { startDistance, anchorWorldX, anchorWorldY } = pinchState.current;
    const minScale = minScaleForViewport();

    updateView((current) => {
      const nextScale = clamp(current.scale * (distance / Math.max(startDistance, 1)), minScale, MAX_SCALE);
      return {
        scale: nextScale,
        x: centerX - anchorWorldX * nextScale,
        y: centerY - anchorWorldY * nextScale
      };
    });

    pinchState.current.startDistance = Math.max(distance, 1);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.pointerType === "mouse" && ![0, 1, 2].includes(event.button)) return;

    if (event.pointerType === "mouse" && event.button !== 0) {
      event.preventDefault();
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activePointers.current.set(event.pointerId, viewportPointFromEvent(event));

    if (activePointers.current.size >= 2) {
      event.preventDefault();
      startPinch();
      return;
    }

    dragState.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    if (activePointers.current.has(event.pointerId)) {
      activePointers.current.set(event.pointerId, viewportPointFromEvent(event));
    }

    if (pinchState.current.active && activePointers.current.size >= 2) {
      event.preventDefault();
      dragState.current.moved = true;
      applyPinch();
      return;
    }

    const current = dragState.current;
    if (!current.active || current.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
      current.moved = true;
    }

    updateView((previous) => ({
      ...previous,
      x: current.originX + deltaX,
      y: current.originY + deltaY
    }));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    if (dragState.current.active) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    activePointers.current.delete(event.pointerId);

    if (pinchState.current.active) {
      dragState.current.moved = true;
      if (activePointers.current.size === 1) {
        const [[pointerId, point]] = pointerEntries();
        dragState.current = {
          active: true,
          moved: true,
          pointerId,
          startX: point.x,
          startY: point.y,
          originX: viewRef.current.x,
          originY: viewRef.current.y
        };
      } else {
        dragState.current.active = false;
      }
      pinchState.current.active = false;
      return;
    }

    if (dragState.current.pointerId === event.pointerId) {
      dragState.current.active = false;
      dragState.current.pointerId = null;
    }
  }

  function handleResetView() {
    updateView({ scale: 1, x: 0, y: 0 });
  }

  function handleFitView() {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const nextScale = fitScaleForViewport(rect.width, rect.height, canvasWidth, canvasHeight);
    updateView({
      scale: nextScale,
      x: Math.max(FIT_PADDING / 2, (rect.width - canvasWidth * nextScale) / 2),
      y: Math.max(FIT_PADDING / 2, (rect.height - canvasHeight * nextScale) / 2)
    });
  }

  function handleNodeClick(deviceId: number, wishlist: boolean) {
    if (dragState.current.moved) {
      dragState.current.moved = false;
      return;
    }
    navigate(`${wishlist ? "/wishlist/devices" : detailBasePath}/${deviceId}`);
  }

  const transformStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    transformOrigin: "0 0"
  };

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();

      if (event.ctrlKey || event.metaKey) {
        zoomBy(event.clientX, event.clientY, clamp(Math.exp(-event.deltaY * 0.01), 0.8, 1.25));
        return;
      }

      const isPixelWheel = event.deltaMode === 0;
      const looksLikeTouchpadPan = isPixelWheel && (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 80);
      if (looksLikeTouchpadPan) {
        panBy(-event.deltaX, -event.deltaY);
        return;
      }

      zoomBy(event.clientX, event.clientY, event.deltaY > 0 ? 0.9 : 1.1);
    }

    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
    };
  }, [canvasHeight, canvasWidth]);

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line bg-panelAlt/45 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-wide text-textPrimary">CList MAP</h3>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-textSecondary">
              {items.length} nodes / {Math.round(view.scale * 100)}%
            </div>
            <button type="button" className="button-secondary px-3 py-1 text-xs" onPointerDown={(event) => event.stopPropagation()} onClick={handleResetView}>
              Reset
            </button>
            <button type="button" className="button-secondary px-3 py-1 text-xs" onPointerDown={(event) => event.stopPropagation()} onClick={handleFitView}>
              Fit
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        data-testid="clist-viewport"
        className="h-[72vh] min-h-[32rem] touch-none select-none overflow-hidden bg-panelAlt text-textPrimary"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div data-testid="clist-canvas" className="relative select-none bg-panelAlt" style={transformStyle}>
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            aria-hidden="true"
          >
            <line x1={rootX} y1={ROOT_Y + 26} x2={rootX} y2={TRUNK_Y} className="stroke-textSecondary/55" strokeWidth="2" />
            <line x1={firstColumnX} y1={TRUNK_Y} x2={lastColumnX} y2={TRUNK_Y} className="stroke-textSecondary/55" strokeWidth="2" />
            {columns.map((column) => {
              return (
                <g key={column.key}>
                  <line x1={column.x} y1={TRUNK_Y} x2={column.x} y2={YEAR_Y - 10} className="stroke-textSecondary/55" strokeWidth="2" />
                  <line x1={column.x} y1={YEAR_Y + 24} x2={column.x} y2={column.bottomY} className="stroke-textSecondary/45" strokeWidth="1.5" />
                  {column.categoryGroups.map((category) => {
                    const iconX = column.x - CARD_WIDTH / 2 - NODE_ICON_OFFSET;
                    const categoryNodeY = category.y + 12;
                    const lastItem = category.items.at(-1);
                    return (
                      <g key={category.key}>
                        <line x1={column.x} y1={categoryNodeY} x2={iconX} y2={categoryNodeY} className="stroke-textSecondary/45" strokeWidth="1.5" />
                        {lastItem ? (
                          <line x1={iconX} y1={categoryNodeY} x2={iconX} y2={lastItem.y + 22} className="stroke-textSecondary/35" strokeWidth="1.5" />
                        ) : null}
                        <circle cx={iconX} cy={categoryNodeY} r="4" className="fill-textSecondary/70" />
                        {category.items.map((item) => (
                          <g key={item.device.id}>
                            <circle cx={iconX} cy={item.y + 22} r="3" className="fill-accent/70" />
                          </g>
                        ))}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          <div
            className="absolute rounded-md border border-accent/50 bg-accent/80 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-black/20"
            style={{ left: rootX, top: ROOT_Y, transform: "translateX(-50%)" }}
          >
            CList
          </div>

          {columns.map((column) => {
            return (
              <div key={column.key}>
                <div
                  className="absolute rounded border border-line bg-panel px-2 py-0.5 text-[10px] font-semibold text-textPrimary shadow-sm"
                  style={{ left: column.x, top: YEAR_Y, transform: "translateX(-50%)" }}
                >
                  {column.label}
                </div>

                {!column.categoryGroups.length ? (
                  <div
                    className="absolute rounded border border-line/70 bg-panel/70 px-2 py-1 text-[10px] text-textSecondary"
                    style={{ left: column.x - CARD_WIDTH / 2, top: CATEGORY_START_Y, width: CARD_WIDTH }}
                  >
                    No devices
                  </div>
                ) : null}

                {column.categoryGroups.map((category) => {
                  const iconX = column.x - CARD_WIDTH / 2 - NODE_ICON_OFFSET;
                  return (
                    <div key={category.key}>
                      <div
                        data-testid={`clist-category-${column.key}-${category.key}`}
                        className="absolute rounded border border-textSecondary/35 bg-panel px-2 py-1 text-[10px] font-semibold text-textPrimary shadow-sm"
                        style={{ left: column.x - CARD_WIDTH / 2, top: category.y, width: CARD_WIDTH }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate">{category.label}</span>
                          <span className="text-textSecondary">{category.items.length}</span>
                        </span>
                      </div>

                      {category.items.map((item) => {
                        const { device } = item;
                        return (
                          <div key={device.id}>
                            <button
                              type="button"
                              data-testid={`clist-device-icon-${column.key}-${device.id}`}
                              className="absolute z-20 h-5 w-5 rounded-full border border-accent/60 bg-panel shadow-sm transition hover:border-accent hover:bg-accent/15 focus:outline-none focus:ring-2 focus:ring-accent/45"
                              style={{ left: iconX, top: item.y + 22, transform: "translate(-50%, -50%)" }}
                              aria-label={`打开${device.name}详情，${column.label}/${category.label}`}
                              onPointerDown={handlePointerDown}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onPointerCancel={handlePointerUp}
                              onClick={() => handleNodeClick(device.id, column.key === "wishlist")}
                            >
                              <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" />
                            </button>
                            <button
                              type="button"
                              data-testid={`clist-device-${column.key}-${device.id}`}
                              className={`group absolute min-h-[5.7rem] rounded-md border bg-panel/90 px-3 py-2 text-left shadow-sm transition hover:bg-panel ${
                                isDeviceItem(device) && device.status === "holding"
                                  ? "clist-rainbow-border"
                                  : "border-line hover:border-accent"
                              }`}
                              style={{ left: column.x - CARD_WIDTH / 2, top: item.y, width: CARD_WIDTH }}
                              onPointerDown={handlePointerDown}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onPointerCancel={handlePointerUp}
                              onClick={() => handleNodeClick(device.id, column.key === "wishlist")}
                            >
                              <span className={`block truncate text-[12px] font-semibold leading-5 ${titleClass(device)}`}>
                                {formatDeviceTitle(device)}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] leading-4 text-textSecondary">
                                {device.brand} / {CATEGORY_LABELS[device.category]}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1.5">
                                {isDeviceItem(device) ? (
                                  <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] ${statusPalette[device.status]}`}>
                                    {STATUS_LABELS[device.status]}
                                  </span>
                                ) : (
                                  <span className="rounded-sm border border-accent/50 px-1.5 py-0.5 text-[9px] text-accent">心愿池</span>
                                )}
                                <span className="rounded-sm border border-line px-1.5 py-0.5 text-[9px] text-textSecondary">
                                  {scoreText(device)}
                                </span>
                                {device.rating_label ? (
                                  <span className="rounded-sm border border-line px-1.5 py-0.5 text-[9px] text-textSecondary">
                                    {ratingLabelText(device.rating_label)}
                                  </span>
                                ) : null}
                              </span>
                              {isDeviceItem(device) ? (
                                <span className="mt-1 block truncate text-[10px] leading-4 text-textSecondary">
                                  {formatDate(device.purchase_date)} / {formatCurrency(device.purchase_price)}
                                </span>
                              ) : null}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
