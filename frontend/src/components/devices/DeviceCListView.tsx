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
  type DeviceListItem,
  type DeviceStatus,
  type RatingLabel
} from "../../types/device";
import { formatCurrency, formatDate } from "../../utils/format";
import { formatDeviceTitle, isFeelingScore, isUnratedScore, ratingLabelText } from "../../utils/device";

interface DeviceCListViewProps {
  items: DeviceListItem[];
  detailBasePath?: string;
}

interface YearGroup {
  key: string;
  label: string;
  items: DeviceListItem[];
}

interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

const CARD_WIDTH = 220;
const COLUMN_WIDTH = 280;
const ITEM_GAP = 126;
const ROOT_Y = 32;
const TRUNK_Y = 88;
const YEAR_Y = 112;
const ITEM_START_Y = 172;
const LEFT_PAD = 160;
const RIGHT_PAD = 160;
const BOTTOM_PAD = 120;
const MAX_SCALE = 2.4;
const DEFAULT_MIN_SCALE = 0.12;
const FIT_PADDING = 32;

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

function scoreText(device: DeviceListItem): string {
  if (isFeelingScore(device.score)) return "FEEL";
  if (isUnratedScore(device.score)) return "N/A";
  return String(device.score);
}

function titleClass(device: DeviceListItem): string {
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

function buildYearGroups(items: DeviceListItem[]): YearGroup[] {
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
      key,
      label: key === "undated" ? "No Date" : key,
      items: groupItems.slice().sort(compareByPurchaseDate)
    }));
}

export function DeviceCListView({ items, detailBasePath = "/devices" }: DeviceCListViewProps) {
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const groups = useMemo(() => buildYearGroups(items), [items]);
  const maxItems = Math.max(1, ...groups.map((group) => group.items.length));
  const canvasWidth = Math.max(760, LEFT_PAD + RIGHT_PAD + Math.max(groups.length - 1, 0) * COLUMN_WIDTH);
  const canvasHeight = ITEM_START_Y + maxItems * ITEM_GAP + BOTTOM_PAD;
  const rootX = canvasWidth / 2;
  const firstColumnX = LEFT_PAD;
  const lastColumnX = LEFT_PAD + Math.max(groups.length - 1, 0) * COLUMN_WIDTH;

  function zoomAt(clientX: number, clientY: number, deltaY: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const pointerX = clientX - rect.left;
    const pointerY = clientY - rect.top;
    const minScale = Math.min(DEFAULT_MIN_SCALE, fitScaleForViewport(rect.width, rect.height, canvasWidth, canvasHeight));

    setView((current) => {
      const nextScale = clamp(current.scale * (deltaY > 0 ? 0.9 : 1.1), minScale, MAX_SCALE);
      const worldX = (pointerX - current.x) / current.scale;
      const worldY = (pointerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointerX - worldX * nextScale,
        y: pointerY - worldY * nextScale
      };
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (![0, 1, 2].includes(event.button)) return;

    if (event.button !== 0) {
      event.preventDefault();
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragState.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = dragState.current;
    if (!current.active) return;

    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
      current.moved = true;
    }

    setView((previous) => ({
      ...previous,
      x: current.originX + deltaX,
      y: current.originY + deltaY
    }));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragState.current.active) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    dragState.current.active = false;
  }

  function handleResetView() {
    setView({ scale: 1, x: 0, y: 0 });
  }

  function handleFitView() {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const nextScale = fitScaleForViewport(rect.width, rect.height, canvasWidth, canvasHeight);
    setView({
      scale: nextScale,
      x: Math.max(FIT_PADDING / 2, (rect.width - canvasWidth * nextScale) / 2),
      y: Math.max(FIT_PADDING / 2, (rect.height - canvasHeight * nextScale) / 2)
    });
  }

  function handleNodeClick(deviceId: number) {
    if (dragState.current.moved) {
      dragState.current.moved = false;
      return;
    }
    navigate(`${detailBasePath}/${deviceId}`);
  }

  const transformStyle: CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
    transformOrigin: "0 0"
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      zoomAt(event.clientX, event.clientY, event.deltaY);
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
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-accent/85">CList Map</div>
            <h3 className="mt-1 text-lg font-semibold text-textPrimary">Timeline tree</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-textSecondary">
              {items.length} nodes / {Math.round(view.scale * 100)}%
            </div>
            <button type="button" className="button-secondary px-3 py-1 text-xs" onClick={handleResetView}>
              Reset
            </button>
            <button type="button" className="button-secondary px-3 py-1 text-xs" onClick={handleFitView}>
              Fit
            </button>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        data-testid="clist-viewport"
        className="h-[72vh] min-h-[32rem] touch-none overflow-hidden bg-panelAlt text-textPrimary"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div data-testid="clist-canvas" className="relative bg-panelAlt" style={transformStyle}>
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
            aria-hidden="true"
          >
            <line x1={rootX} y1={ROOT_Y + 26} x2={rootX} y2={TRUNK_Y} className="stroke-textSecondary/55" strokeWidth="2" />
            <line x1={firstColumnX} y1={TRUNK_Y} x2={lastColumnX} y2={TRUNK_Y} className="stroke-textSecondary/55" strokeWidth="2" />
            {groups.map((group, groupIndex) => {
              const columnX = LEFT_PAD + groupIndex * COLUMN_WIDTH;
              const groupBottom = ITEM_START_Y + Math.max(group.items.length - 1, 0) * ITEM_GAP + 90;

              return (
                <g key={group.key}>
                  <line x1={columnX} y1={TRUNK_Y} x2={columnX} y2={YEAR_Y - 10} className="stroke-textSecondary/55" strokeWidth="2" />
                  <line x1={columnX} y1={YEAR_Y + 24} x2={columnX} y2={groupBottom} className="stroke-textSecondary/45" strokeWidth="1.5" />
                  {group.items.map((device, itemIndex) => {
                    const itemY = ITEM_START_Y + itemIndex * ITEM_GAP;
                    return (
                      <g key={device.id}>
                        <line x1={columnX} y1={itemY + 22} x2={columnX - CARD_WIDTH / 2 + 10} y2={itemY + 22} className="stroke-textSecondary/45" strokeWidth="1.5" />
                        <circle cx={columnX} cy={itemY + 22} r="3" className="fill-accent/70" />
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

          {groups.map((group, groupIndex) => {
            const columnX = LEFT_PAD + groupIndex * COLUMN_WIDTH;
            return (
              <div key={group.key}>
                <div
                  className="absolute rounded border border-line bg-panel px-2 py-0.5 text-[10px] font-semibold text-textPrimary shadow-sm"
                  style={{ left: columnX, top: YEAR_Y, transform: "translateX(-50%)" }}
                >
                  {group.label}
                </div>

                {group.items.map((device, itemIndex) => {
                  const itemY = ITEM_START_Y + itemIndex * ITEM_GAP;
                  return (
                    <button
                      key={device.id}
                      type="button"
                      className="group absolute min-h-[5.7rem] rounded-md border border-line bg-panel/90 px-3 py-2 text-left shadow-sm transition hover:border-accent hover:bg-panel"
                      style={{ left: columnX - CARD_WIDTH / 2, top: itemY, width: CARD_WIDTH }}
                      onClick={() => handleNodeClick(device.id)}
                    >
                      <span className={`block truncate text-[12px] font-semibold leading-5 ${titleClass(device)}`}>
                        {formatDeviceTitle(device)}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-4 text-textSecondary">
                        {device.brand} / {CATEGORY_LABELS[device.category]}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] ${statusPalette[device.status]}`}>
                          {STATUS_LABELS[device.status]}
                        </span>
                        <span className="rounded-sm border border-line px-1.5 py-0.5 text-[9px] text-textSecondary">
                          {scoreText(device)}
                        </span>
                        {device.rating_label ? (
                          <span className="rounded-sm border border-line px-1.5 py-0.5 text-[9px] text-textSecondary">
                            {ratingLabelText(device.rating_label)}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-[10px] leading-4 text-textSecondary">
                        {formatDate(device.purchase_date)} / {formatCurrency(device.purchase_price)}
                      </span>
                    </button>
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
