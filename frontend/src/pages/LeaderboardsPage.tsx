import { useEffect, useMemo, useState } from "react";
import { useMatch, useNavigate, useSearchParams } from "react-router-dom";

import {
  fetchFinanceLeaderboard,
  fetchHoldingDurationLeaderboard,
  fetchScoreLeaderboard
} from "../api/leaderboards";
import { DeviceDetailDrawer } from "../components/devices/DeviceDetailDrawer";
import {
  type FinanceLeaderboardItem,
  type HoldingDurationItem,
  type LeaderboardTab,
  type ScoreLeaderboardItem,
  type SortOrder
} from "../types/device";
import { formatCurrency, formatDate, formatDurationDays } from "../utils/format";
import { ratingLabelText } from "../utils/device";

type RankedEntry = {
  rank: number;
  deviceId: number;
  name: string;
  brand: string;
  headline: string;
  meta: string;
};

function tabLabel(tab: LeaderboardTab) {
  return {
    "holding-duration": "持有时间榜",
    score: "评分榜",
    finance: "理财榜"
  }[tab];
}

function normalizeEntries(
  tab: LeaderboardTab,
  items: HoldingDurationItem[] | ScoreLeaderboardItem[] | FinanceLeaderboardItem[]
): RankedEntry[] {
  if (tab === "holding-duration") {
    return (items as HoldingDurationItem[]).map((item) => ({
      rank: item.rank,
      deviceId: item.device_id,
      name: item.name,
      brand: item.brand,
      headline: formatDurationDays(item.duration_days),
      meta: `${formatDate(item.purchase_date)} 至 ${item.sale_date ? formatDate(item.sale_date) : "现在"}`
    }));
  }

  if (tab === "finance") {
    return (items as FinanceLeaderboardItem[]).map((item) => ({
      rank: item.rank,
      deviceId: item.device_id,
      name: item.name,
      brand: item.brand,
      headline: `${item.profit_value >= 0 ? "+" : ""}${formatCurrency(item.profit_value)}`,
      meta: `买入 ${formatCurrency(item.purchase_price)} / 卖出 ${formatCurrency(item.sale_price)}`
    }));
  }

  return (items as ScoreLeaderboardItem[]).map((item) => ({
    rank: item.rank,
    deviceId: item.device_id,
    name: item.name,
    brand: item.brand,
    headline: `${item.score}`,
    meta: ratingLabelText(item.rating_label)
  }));
}

function podiumTone(rank: number) {
  if (rank === 1) return "podium-rank-1";
  if (rank === 2) return "podium-rank-2";
  return "podium-rank-3";
}

function PodiumCard({
  entry,
  onOpen
}: {
  entry: RankedEntry;
  onOpen: (deviceId: number) => void;
}) {
  return (
    <button
      type="button"
      className={`podium-card ${podiumTone(entry.rank)} text-left`}
      onClick={() => onOpen(entry.deviceId)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="podium-badge">TOP #{entry.rank}</span>
        <div className="podium-rank-number">{entry.rank}</div>
      </div>

      <div className="mt-10">
        <div className="text-2xl font-semibold text-textPrimary">{entry.name}</div>
        <div className="mt-1 text-sm text-textSecondary">{entry.brand}</div>
      </div>

      <div className="mt-8">
        <div className="podium-headline">{entry.headline}</div>
        <div className="mt-2 text-sm leading-6 text-textSecondary">{entry.meta}</div>
      </div>
    </button>
  );
}

function LeaderboardList({
  entries,
  onOpen
}: {
  entries: RankedEntry[];
  onOpen: (deviceId: number) => void;
}) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <button
          key={entry.deviceId}
          type="button"
          className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panelAlt/70 px-4 py-4 text-left transition hover:border-accent/30 hover:bg-panelAlt"
          onClick={() => onOpen(entry.deviceId)}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-panelAlt px-3 text-sm font-semibold text-textPrimary">
              #{entry.rank}
            </span>
            <div>
              <div className="font-medium text-textPrimary">{entry.name}</div>
              <div className="text-sm text-textSecondary">{entry.brand}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-textPrimary">{entry.headline}</div>
            <div className="text-sm text-textSecondary">{entry.meta}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function LeaderboardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const drawerMatch = useMatch("/leaderboards/devices/:deviceId");
  const tab = (searchParams.get("tab") as LeaderboardTab | null) ?? "score";
  const sortOrder = (searchParams.get("sort_order") as SortOrder | null) ?? "desc";
  const [holdingItems, setHoldingItems] = useState<HoldingDurationItem[]>([]);
  const [scoreItems, setScoreItems] = useState<ScoreLeaderboardItem[]>([]);
  const [financeItems, setFinanceItems] = useState<FinanceLeaderboardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!["holding-duration", "score", "finance"].includes(tab)) {
      setSearchParams({ tab: "score", sort_order: "desc" }, { replace: true });
      return;
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      setSearchParams({ tab, sort_order: "desc" }, { replace: true });
    }
  }, [setSearchParams, sortOrder, tab]);

  useEffect(() => {
    setError(null);

    const loader =
      tab === "holding-duration"
        ? fetchHoldingDurationLeaderboard(sortOrder).then((result) => setHoldingItems(result.items))
        : tab === "score"
          ? fetchScoreLeaderboard(sortOrder).then((result) => setScoreItems(result.items))
          : fetchFinanceLeaderboard(sortOrder).then((result) => setFinanceItems(result.items));

    loader.catch((err: Error) => setError(err.message));
  }, [tab, sortOrder, refreshToken]);

  const activeItems =
    tab === "holding-duration"
      ? holdingItems
      : tab === "score"
        ? scoreItems
        : financeItems;

  const entries = normalizeEntries(tab, activeItems);
  const podiumEntries = useMemo(
    () => [entries[1], entries[0], entries[2]].filter((entry): entry is RankedEntry => Boolean(entry)),
    [entries]
  );
  const restEntries = entries.slice(3);
  const currentSearch = searchParams.toString();

  function openDetail(deviceId: number) {
    navigate(`/leaderboards/devices/${deviceId}${currentSearch ? `?${currentSearch}` : ""}`);
  }

  function updateParams(next: Partial<{ tab: LeaderboardTab; sort_order: SortOrder }>) {
    const params = new URLSearchParams(searchParams);
    if (next.tab) {
      params.set("tab", next.tab);
    }
    if (next.sort_order) {
      params.set("sort_order", next.sort_order);
    }
    setSearchParams(params);
  }

  return (
    <div className="space-y-6">
      <section className="leaderboard-hero panel overflow-hidden p-6">
        <div className="relative">
          <div className="leaderboard-hero-glow" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-accent/80">排行榜</div>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-textPrimary">排行榜</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-textSecondary">
                用排名视角查看器材偏好、持有时间和买卖结果。
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-line bg-panelAlt/70 p-1">
              <button
                className={sortOrder === "desc" ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => updateParams({ sort_order: "desc" })}
              >
                降序
              </button>
              <button
                className={sortOrder === "asc" ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => updateParams({ sort_order: "asc" })}
              >
                升序
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(["holding-duration", "score", "finance"] as LeaderboardTab[]).map((candidate) => (
              <button
                key={candidate}
                className={tab === candidate ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => updateParams({ tab: candidate })}
              >
                {tabLabel(candidate)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">
          {error}
        </div>
      ) : null}

      <section className="panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-accent/80">{tabLabel(tab)}</div>
            <h2 className="mt-1 text-2xl font-semibold text-textPrimary">Top 3</h2>
          </div>
          <div className="text-sm text-textSecondary">
            当前按 {sortOrder === "desc" ? "降序" : "升序"} 展示
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.92fr,1.14fr,0.98fr] lg:items-end">
          {podiumEntries.length ? (
            podiumEntries.map((entry) => (
              <PodiumCard key={entry.deviceId} entry={entry} onOpen={openDetail} />
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-line bg-panelAlt/70 p-6 text-textSecondary">
              暂无榜单数据。
            </div>
          )}
        </div>
      </section>

      {restEntries.length ? (
        <section className="panel p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">完整排名</div>
          <h3 className="mt-1 text-2xl font-semibold text-textPrimary">完整排名</h3>
          <div className="mt-5">
            <LeaderboardList entries={restEntries} onOpen={openDetail} />
          </div>
        </section>
      ) : null}

      {drawerMatch?.params.deviceId ? (
        <DeviceDetailDrawer
          deviceId={drawerMatch.params.deviceId}
          closeTo={`/leaderboards${currentSearch ? `?${currentSearch}` : ""}`}
          onChanged={() => setRefreshToken((current) => current + 1)}
        />
      ) : null}
    </div>
  );
}
